"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { criarSessao, hashSenha, exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { normalizarCpf, signupIndicadorSchema } from "@/lib/validators";
import { validarSenhaSegura } from "@/lib/senhaSegura";
import { garantirCupomDoAnalista } from "@/lib/indicacao";

/**
 * Programa de Indicação (Regina 02/11/2026): cadastro público de quem vai
 * indicar sem ser analista, e o cupom pessoal de quem já é.
 *
 * O indicador nasce como conta ANALISTA + linha de Analista com
 * `indicador = true` — é a mesma máquina de comissão (R$ 29,90 por empresa
 * indicada que paga, PIX no dia 20), sem um segundo caminho para manter.
 */
export type ResultadoIndicador = {
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
};

function valoresParaEcho(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k === "senha" || k === "confirmacaoSenha") continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Origem da visita (gclid/UTMs) — os mesmos campos escondidos do signup. */
function atribuicao(formData: FormData) {
  const pega = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 200) || null;
  return {
    gclid: pega("gclid"),
    utmSource: pega("utmSource"),
    utmMedium: pega("utmMedium"),
    utmCampaign: pega("utmCampaign"),
    utmTerm: pega("utmTerm"),
  };
}

export async function signupIndicadorAction(
  _prev: ResultadoIndicador | null,
  formData: FormData,
): Promise<ResultadoIndicador> {
  const valores = valoresParaEcho(formData);
  const parsed = signupIndicadorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores };
  }

  const v = parsed.data;
  const nome = v.nome.trim().replace(/\s+/g, " ");
  const email = v.email.trim().toLowerCase();
  const cpf = normalizarCpf(v.cpf);
  const telefone = v.telefone.trim();
  const cidade = v.cidade.trim();
  const pix = v.pix.trim();

  const senhaCheck = await validarSenhaSegura(v.senha, { email, nome });
  if (!senhaCheck.ok) {
    return { erro: senhaCheck.erro, campos: { senha: senhaCheck.erro }, valores };
  }

  const emailExiste = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
  if (emailExiste) {
    return { erro: "Este e-mail já tem conta no CP System. Entre com ele para ver o seu cupom.", campos: { email: "E-mail já cadastrado" }, valores };
  }
  const cpfExiste = await prisma.analista.findUnique({ where: { cpf }, select: { id: true } });
  if (cpfExiste) {
    return { erro: "Este CPF já está cadastrado como analista ou indicador. Entre com o e-mail da conta.", campos: { cpf: "CPF já cadastrado" }, valores };
  }

  const senhaHash = await hashSenha(v.senha);

  const conta = await prisma.conta.create({
    data: {
      tipo: "ANALISTA",
      plano: "BASICO",
      statusAssinatura: "ATIVA", // indicador não paga assinatura — só recebe comissão
      // O indicador aceita o mesmo Contrato de Adesão ao Programa de Analista
      // Parceiro v1.0: é ele que rege o papel de embaixador (comissão por
      // indicação, pagamento dia 20, condutas vedadas).
      termosAceitosEm: new Date(),
      termosAceitosVersao: "1.0",
      ...atribuicao(formData),
      usuarios: {
        create: {
          nome,
          email,
          senhaHash,
          perfil: "ADMIN",
          telefoneWhatsApp: telefone.replace(/\D/g, ""),
          optInWhatsApp: true,
        },
      },
      analista: {
        create: {
          nomeCompleto: nome,
          cpf,
          telefone,
          endereco: cidade,
          email,
          pix,
          indicador: true,
          ativo: true,
        },
      },
    },
    select: { id: true, usuarios: { select: { id: true }, take: 1 }, analista: { select: { id: true, nomeCompleto: true } } },
  });

  // O cupom nasce junto com a conta: a pessoa sai do cadastro com o código
  // na mão, sem segundo passo.
  if (conta.analista) {
    await garantirCupomDoAnalista(conta.analista, conta.usuarios[0]?.id ?? null).catch((e) =>
      console.error("[indicacao] cupom não gerado no cadastro:", e),
    );
  }

  const contaId = conta.id;
  after(async () => {
    try {
      const { darBoasVindas } = await import("@/lib/boasVindas");
      await darBoasVindas(contaId);
    } catch (e) {
      console.error("[indicacao] boas-vindas falharam:", e);
    }
  });

  await criarSessao(conta.usuarios[0].id);
  redirect("/indicacao?novo=1");
}

/** Analista que já existia e ainda não tinha cupom: gera o dele. */
export async function gerarMeuCupomAction(): Promise<{ ok?: true; codigo?: string; erro?: string }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const analista = await prisma.analista.findUnique({
    where: { contaId: usuario.contaId },
    select: { id: true, nomeCompleto: true },
  });
  if (!analista) return { erro: "Só contas de analista ou indicador têm cupom." };
  try {
    const cupom = await garantirCupomDoAnalista(analista, usuario.id);
    revalidatePath("/indicacao");
    return { ok: true, codigo: cupom.codigo };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não consegui gerar o cupom." };
  }
}
