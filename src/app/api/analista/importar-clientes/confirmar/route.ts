import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { validarCnpj } from "@/lib/cnpj";
import { normalizarCnpj, portes, naturezasJuridicas } from "@/lib/validators";

/**
 * Etapa que grava a carteira importada (opcao B, aprovada pela Regina em
 * 18/08). A leitura da planilha e a consulta a Receita acontecem antes; aqui
 * chega a lista ja conferida pelo analista.
 *
 * O que cada linha vira: uma Conta do tipo EMPRESA + a Empresa + o
 * VinculoAnalista ATIVO. Essa e a unica forma de a empresa aparecer na carteira
 * dele — "empresa vinculada" no painel e sempre conta + vinculo.
 *
 * Decisoes que valem registrar:
 * - A conta nasce SEM usuario: ninguem consegue logar nela. Ela e um cadastro
 *   de carteira, nao um cliente do CP System — o cliente vira cliente quando
 *   assina, e ai o cadastro e absorvido pelo signup (ver actions/auth.ts).
 * - Por isso tambem nasce sem cobranca, sem cartao e com trialAteEm nulo: nao
 *   entra na regua de cobranca nem no aviso de fim de trial, e nao pode contar
 *   como receita em lugar nenhum.
 * - O vinculo entra com percentual e fixo ZERADOS. O analista ajusta os termos
 *   depois, empresa por empresa, no painel. Chutar 29,90 aqui criaria cobranca
 *   que ninguem combinou.
 * - Nada e gravado sem CNPJ valido: sem ele nao ha como cobrar nem emitir nota,
 *   e duas empresas diferentes acabariam colididas na mesma linha.
 */

export const maxDuration = 60;

const MAX_LINHAS = 200;

const linhaSchema = z.object({
  razaoSocial: z.string().trim().min(2, "Razão social muito curta"),
  nomeFantasia: z.string().trim().optional().nullable(),
  cnpj: z.string().trim().min(14, "CNPJ obrigatório"),
  porte: z.enum(portes, { message: "Porte não informado" }),
  cnaePrincipal: z.string().trim().optional().nullable(),
  naturezaJuridica: z.enum(naturezasJuridicas, { message: "Natureza jurídica não informada" }),
  endereco: z.string().trim().min(5, "Endereço muito curto"),
  complemento: z.string().trim().optional().nullable(),
  cep: z.string().trim().min(8, "CEP inválido"),
  email: z.string().trim().email("E-mail inválido"),
  telefones: z.string().trim().min(8, "Telefone inválido"),
  responsavel: z.string().trim().min(2, "Responsável não informado"),
  /** Linha da planilha — so pra o analista se localizar no resultado. */
  linha: z.number().optional(),
});

type Resultado = {
  linha: number;
  razaoSocial: string;
  cnpj: string;
  situacao: "criada" | "ja_existia" | "erro";
  detalhe?: string;
};

export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const analista = await prisma.analista.findFirst({
    where: { contaId: usuario.contaId },
    select: { id: true, nomeCompleto: true },
  });
  if (!analista) {
    return NextResponse.json({ erro: "Disponível apenas para contas de analista." }, { status: 403 });
  }

  const corpo = await req.json().catch(() => null);
  const bruto = Array.isArray(corpo?.clientes) ? corpo.clientes : null;
  if (!bruto || bruto.length === 0) {
    return NextResponse.json({ erro: "Nenhuma empresa para importar." }, { status: 400 });
  }
  if (bruto.length > MAX_LINHAS) {
    return NextResponse.json(
      { erro: `Importe no máximo ${MAX_LINHAS} empresas por vez.` },
      { status: 400 },
    );
  }

  const resultados: Resultado[] = [];
  const cnpjsNesteLote = new Set<string>();

  for (const item of bruto) {
    const linhaNum = Number(item?.linha) || 0;
    const nome = String(item?.razaoSocial ?? "").trim() || "(sem nome)";
    const cnpjNorm = normalizarCnpj(String(item?.cnpj ?? ""));

    const parsed = linhaSchema.safeParse(item);
    if (!parsed.success) {
      resultados.push({
        linha: linhaNum,
        razaoSocial: nome,
        cnpj: cnpjNorm,
        situacao: "erro",
        detalhe: parsed.error.issues[0]?.message ?? "Dados incompletos",
      });
      continue;
    }

    const v = parsed.data;
    const cnpj = normalizarCnpj(v.cnpj);
    // Revalida os digitos no servidor: a tela ja checa, mas quem grava e aqui.
    if (!validarCnpj(cnpj)) {
      resultados.push({
        linha: linhaNum,
        razaoSocial: v.razaoSocial,
        cnpj,
        situacao: "erro",
        detalhe: "CNPJ inválido — confira os dígitos",
      });
      continue;
    }
    // Planilha com a mesma empresa em duas linhas (filial repetida, subtotal
    // duplicado) nao pode virar duas contas.
    if (cnpjsNesteLote.has(cnpj)) {
      resultados.push({
        linha: linhaNum,
        razaoSocial: v.razaoSocial,
        cnpj,
        situacao: "ja_existia",
        detalhe: "CNPJ repetido na própria planilha",
      });
      continue;
    }
    cnpjsNesteLote.add(cnpj);

    const jaExiste = await prisma.empresa.findUnique({
      where: { cnpj },
      select: { razaoSocial: true },
    });
    if (jaExiste) {
      resultados.push({
        linha: linhaNum,
        razaoSocial: v.razaoSocial,
        cnpj,
        situacao: "ja_existia",
        detalhe: `Já cadastrada como ${jaExiste.razaoSocial}`,
      });
      continue;
    }

    try {
      const conta = await prisma.conta.create({
        data: {
          tipo: "EMPRESA",
          plano: "BASICO",
          statusAssinatura: "TRIAL",
          // Sem trialAteEm de proposito — ver comentario do topo.
          trialAteEm: null,
          empresas: {
            create: {
              razaoSocial: v.razaoSocial,
              nomeFantasia: v.nomeFantasia?.trim() || null,
              cnpj,
              porte: v.porte,
              cnaePrincipal: v.cnaePrincipal?.trim() || null,
              naturezaJuridica: v.naturezaJuridica,
              endereco: v.endereco,
              complemento: v.complemento?.trim() || null,
              cep: v.cep.replace(/\D/g, ""),
              email: v.email.toLowerCase(),
              emails: [v.email.toLowerCase()],
              telefones: v.telefones,
              telefonesLista: [v.telefones],
              responsavel: v.responsavel,
            },
          },
          vinculosAnalista: {
            create: {
              analistaId: analista.id,
              dataInicio: new Date(),
              percentualComissao: 0,
              fixoMensal: 0,
              diaVencimentoFixo: 5,
              status: "ATIVO",
              observacoes: "Importada da planilha da carteira do analista.",
            },
          },
        },
        select: { id: true },
      });

      await registrarAuditoria({
        contaId: usuario.contaId,
        usuarioId: usuario.id,
        acao: "CRIAR",
        recurso: "Empresa",
        recursoId: conta.id,
        resumo: `Importou ${v.razaoSocial} (${cnpj}) da planilha da carteira`,
      });

      resultados.push({
        linha: linhaNum,
        razaoSocial: v.razaoSocial,
        cnpj,
        situacao: "criada",
      });
    } catch (err) {
      resultados.push({
        linha: linhaNum,
        razaoSocial: v.razaoSocial,
        cnpj,
        situacao: "erro",
        detalhe: err instanceof Error ? err.message : "Falha ao gravar",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    criadas: resultados.filter((r) => r.situacao === "criada").length,
    jaExistiam: resultados.filter((r) => r.situacao === "ja_existia").length,
    erros: resultados.filter((r) => r.situacao === "erro").length,
    resultados,
  });
}
