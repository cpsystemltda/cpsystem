"use server";

/**
 * IA Minutas — gera textos jurídicos sob demanda a partir de dados
 * estruturados do contrato / procedimento.
 *
 * Tipos suportados:
 *   - PEDIDO_REAJUSTE       — ofício de pedido de reajuste de preços
 *   - DEFESA_PROCEDIMENTO   — minuta de defesa administrativa
 *   - RECURSO_PROCEDIMENTO  — minuta de recurso administrativo
 *
 * Tudo é "ponto de partida" — caberá ao usuário revisar antes de protocolar.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";

export type TipoMinuta = "PEDIDO_REAJUSTE" | "DEFESA_PROCEDIMENTO" | "RECURSO_PROCEDIMENTO";

export type MinutaResult =
  | { ok: true; minuta: string; demo: boolean; titulo: string }
  | { ok: false; erro: string };

const SYSTEM_BASE = `Você é um advogado especialista em contratações públicas brasileiras (Lei 14.133/2021 e legado da 8.666/93). Sua tarefa é redigir minutas formais e fundamentadas, no padrão usado em ofícios e peças jurídicas administrativas.

REGRAS:
- Linguagem técnica, formal, objetiva.
- Cite os dispositivos legais relevantes (Lei 14.133/2021 artigos correspondentes).
- Estrutura padrão: cabeçalho com partes, qualificação, fatos, fundamentação jurídica, pedido, fechamento (local, data, assinatura).
- Use placeholders \`[[...]]\` para informações que o usuário precisa preencher manualmente (testemunhas, anexos específicos, etc.).
- NUNCA invente datas, valores ou números — use APENAS os fornecidos.
- Retorne APENAS o texto da minuta em markdown simples, sem comentários adicionais.`;

export async function gerarMinutaIaAction(
  tipo: TipoMinuta,
  recursoId: string,
): Promise<MinutaResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  try {
    if (tipo === "PEDIDO_REAJUSTE") {
      return await gerarPedidoReajuste(usuario.contaId, recursoId);
    }
    if (tipo === "DEFESA_PROCEDIMENTO" || tipo === "RECURSO_PROCEDIMENTO") {
      return await gerarPecaProcedimento(usuario.contaId, recursoId, tipo);
    }
    return { ok: false, erro: "Tipo de minuta não suportado." };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro ao gerar minuta." };
  }
}

// ============================================================
// PEDIDO DE REAJUSTE
// ============================================================
async function gerarPedidoReajuste(contaId: string, contratoId: string): Promise<MinutaResult> {
  const c = await prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId } },
    include: {
      empresa: true,
      itens: { select: { descricao: true, quantidade: true, valorUnitario: true, valorTotal: true } },
      reajustes: { orderBy: { dataPedido: "desc" }, take: 5 },
    },
  });
  if (!c) return { ok: false, erro: "Contrato não encontrado." };

  const valorAtual = c.itens.reduce((s, i) => s + i.valorTotal, 0);
  const ultimoReajuste = c.reajustes[0];

  const contexto = `
CONTRATO ${c.numero}
- Processo administrativo: ${c.processoAdministrativo}
- Órgão contratante: ${c.orgaoNome} (CNPJ ${c.orgaoCnpj})
- Objeto: ${c.objeto}
- Data de assinatura: ${c.dataAssinatura.toISOString().slice(0, 10)}
- Vigência: ${c.vigenciaInicio.toISOString().slice(0, 10)} a ${c.vigenciaFim.toISOString().slice(0, 10)}
- Valor atual: R$ ${valorAtual.toFixed(2)}
- Marco do orçamento estimado: ${c.marcoOrcamentoEstimado?.toISOString().slice(0, 10) ?? "não definido"}

CONTRATADA:
- Razão social: ${c.empresa.razaoSocial}
- Nome fantasia: ${c.empresa.nomeFantasia ?? "—"}
- CNPJ: ${c.empresa.cnpj}

REAJUSTE ANTERIOR (se houver):
${ultimoReajuste
  ? `- Data: ${ultimoReajuste.dataPedido.toISOString().slice(0, 10)}\n- Índice: ${ultimoReajuste.indice}\n- Percentual: ${ultimoReajuste.percentual.toFixed(4)}%`
  : "Nenhum reajuste anterior registrado."}
`.trim();

  const prompt = `Redija minuta de OFÍCIO DE PEDIDO DE REAJUSTE DE PREÇOS conforme Lei 14.133/2021 (art. 25 e 92, §3º — direito ao reajuste anual). Estrutura:

1. Cabeçalho (Contratada → Órgão)
2. Referência (Contrato, processo)
3. Fundamentação: marco do orçamento estimado, decurso do interregno mínimo de 12 meses, base legal (art. 25 da Lei 14.133/2021).
4. Pedido: aplicação do índice pactuado, indicação do percentual acumulado no período (use placeholder \`[[PERCENTUAL_ACUMULADO]]\` — não invente valor) e novo valor unitário.
5. Pedido final: deferimento e formalização via apostilamento (Lei 14.133 art. 136, I).
6. Fechamento (local, data, assinatura representante legal).

CONTEXTO DO CONTRATO:
${contexto}`;

  const res = await chamarClaude(prompt);
  if (!res.ok) return res;
  return { ...res, titulo: `Pedido de reajuste — Contrato ${c.numero}` };
}

// ============================================================
// DEFESA / RECURSO
// ============================================================
async function gerarPecaProcedimento(
  contaId: string,
  procedimentoId: string,
  tipo: "DEFESA_PROCEDIMENTO" | "RECURSO_PROCEDIMENTO",
): Promise<MinutaResult> {
  const p = await prisma.procedimentoApuratorio.findFirst({
    where: {
      id: procedimentoId,
      OR: [
        { contrato: { empresa: { contaId } } },
        { ata: { empresa: { contaId } } },
        { empenho: { empresa: { contaId } } },
      ],
    },
    include: {
      andamentos: { orderBy: { dataEvento: "asc" } },
      contrato: { include: { empresa: true } },
      ata: { include: { empresa: true } },
      empenho: { include: { empresa: true } },
    },
  });
  if (!p) return { ok: false, erro: "Procedimento não encontrado." };

  const empresa = p.contrato?.empresa ?? p.ata?.empresa ?? p.empenho?.empresa;
  if (!empresa) return { ok: false, erro: "Empresa do procedimento não encontrada." };

  const contratoRotulo = p.contrato
    ? `Contrato ${p.contrato.numero}`
    : p.empenho
      ? `Empenho ${p.empenho.numero}`
      : p.ata
        ? `Ata ${p.ata.numero}`
        : "—";

  const contexto = `
PROCEDIMENTO APURATÓRIO
- Número: ${p.numero ?? "—"}
- Notificação prévia: ${p.notificacaoNumero ?? "—"}
- Assunto: ${p.assunto}
- Descrição: ${p.descricao}
- Data de abertura: ${p.dataAbertura.toISOString().slice(0, 10)}
- Vínculo: ${contratoRotulo}
- Órgão: ${p.contrato?.orgaoNome ?? p.empenho?.orgaoNome ?? p.ata?.orgaoNome ?? "—"}
- Autoridade competente: ${p.autoridade ?? "—"}
- Comissão: ${p.comissaoMembros.join(" · ") || p.comissao || "—"}

ANDAMENTOS REGISTRADOS:
${p.andamentos.map((a) => `- ${a.dataEvento.toISOString().slice(0, 10)} | ${a.fase} | ${a.descricao}`).join("\n")}

EMPRESA (parte interessada):
- Razão social: ${empresa.razaoSocial}
- Nome fantasia: ${empresa.nomeFantasia ?? "—"}
- CNPJ: ${empresa.cnpj}
- Endereço: ${empresa.endereco ?? "—"}
`.trim();

  let prompt = "";
  if (tipo === "DEFESA_PROCEDIMENTO") {
    prompt = `Redija minuta de DEFESA ADMINISTRATIVA em procedimento apuratório (Lei 14.133/2021 art. 158). Estrutura:

1. Cabeçalho: à Comissão Processante / Autoridade Competente
2. Qualificação da defendente
3. Síntese dos fatos imputados
4. Preliminares (se cabíveis — usar placeholder \`[[PRELIMINARES]]\` se nenhuma evidente)
5. Mérito: refutação dos fatos, sustentação técnica e jurídica
6. Pedido de produção de provas (Lei 14.133 art. 158, §1º) — placeholder \`[[ROL_DE_PROVAS]]\`
7. Pedido principal: improcedência / arquivamento
8. Fechamento

Pontos-chave:
- Citar Lei 14.133/2021 art. 158 (direito ao contraditório e ampla defesa)
- Citar princípios constitucionais (CF 5º, LV)
- Argumentar com base nos andamentos registrados

CONTEXTO:
${contexto}`;
  } else {
    prompt = `Redija minuta de RECURSO ADMINISTRATIVO contra decisão proferida no procedimento apuratório (Lei 14.133/2021 art. 165 e 166). Estrutura:

1. Cabeçalho: à Autoridade Competente (instância superior)
2. Tempestividade: prazo de 15 dias úteis da decisão (art. 165)
3. Qualificação da recorrente
4. Síntese da decisão recorrida (use placeholder \`[[TEOR_DA_DECISAO]]\` se não houver detalhes específicos nos andamentos)
5. Razões do recurso: fundamentação técnica e jurídica
6. Pedido de produção de provas complementares — placeholder se aplicável
7. Pedido principal: reforma integral da decisão, improcedência da imputação
8. Pedido subsidiário: redução / atenuação da penalidade (Lei 14.133 art. 156, §1º — dosimetria)
9. Fechamento

Pontos-chave:
- Citar Lei 14.133/2021 art. 165 (cabimento), art. 166 (efeito suspensivo)
- Argumentos sobre dosimetria (proporcionalidade, razoabilidade)
- Identificar a decisão recorrida nos andamentos

CONTEXTO:
${contexto}`;
  }

  const res = await chamarClaude(prompt);
  if (!res.ok) return res;
  const tituloRotulo = tipo === "DEFESA_PROCEDIMENTO" ? "Defesa administrativa" : "Recurso administrativo";
  return { ...res, titulo: `${tituloRotulo} — ${contratoRotulo}` };
}

// ============================================================
// Cliente Claude
// ============================================================
async function chamarClaude(prompt: string): Promise<MinutaResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return {
      ok: true,
      demo: true,
      titulo: "(demo)",
      minuta: minutaMock(prompt),
    };
  }
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return { ok: false, erro: "Modelo não retornou texto." };
  }
  return { ok: true, demo: false, titulo: "", minuta: block.text };
}

function minutaMock(prompt: string): string {
  if (prompt.includes("PEDIDO DE REAJUSTE")) {
    return `# OFÍCIO DE PEDIDO DE REAJUSTE DE PREÇOS — DEMO

**[[ÓRGÃO CONTRATANTE]]**
A/C: Setor de Contratos

Referência: Contrato administrativo nº [[NÚMERO]], processo [[PROCESSO]].

Senhor(a) Gestor(a),

[[CONTRATADA]], inscrita no CNPJ sob o nº [[CNPJ]], vem respeitosamente requerer o **reajuste anual** do contrato em epígrafe, nos termos do art. 25 da Lei nº 14.133/2021.

## Fundamentação

Decorrido o interregno mínimo de 12 (doze) meses contados a partir do marco do orçamento estimado, a contratada faz jus à recomposição dos preços contratuais pela aplicação do índice pactuado, garantindo o equilíbrio econômico-financeiro previsto no art. 92, §3º.

## Pedido

Requer-se a aplicação do índice contratual, com percentual acumulado de **[[PERCENTUAL_ACUMULADO]]%** no período de [[PERIODO_DE]] a [[PERIODO_ATE]], resultando no novo valor unitário a ser formalizado por **apostilamento** (Lei 14.133 art. 136, I).

Termos em que pede deferimento.

[[CIDADE]], [[DATA]].

____________________
**[[REPRESENTANTE LEGAL]]**
[[CARGO]]

---
*Minuta gerada em modo demonstração. Configure ANTHROPIC_API_KEY pra resposta real.*`;
  }
  if (prompt.includes("DEFESA ADMINISTRATIVA")) {
    return `# DEFESA ADMINISTRATIVA — DEMO

**À Comissão Processante** / Autoridade Competente

Processo: [[PROCESSO]]

[[CONTRATADA]], inscrita no CNPJ nº [[CNPJ]], vem, respeitosamente, apresentar **DEFESA ADMINISTRATIVA** nos autos do procedimento em epígrafe, com fulcro no art. 158 da Lei nº 14.133/2021 e no art. 5º, LV da Constituição Federal.

## I. DOS FATOS

[[FATOS]]

## II. DAS PRELIMINARES

[[PRELIMINARES]]

## III. DO MÉRITO

A defendente contesta integralmente a imputação, conforme razões a seguir:
- [[ARGUMENTO_1]]
- [[ARGUMENTO_2]]

## IV. DA PRODUÇÃO DE PROVAS

Requer-se a produção das seguintes provas (Lei 14.133 art. 158, §1º): [[ROL_DE_PROVAS]].

## V. DO PEDIDO

Diante do exposto, requer-se:
a) o **acolhimento integral da defesa**;
b) a **improcedência das imputações** e o consequente **arquivamento** do procedimento.

Termos em que pede deferimento.

[[CIDADE]], [[DATA]].

____________________
**[[REPRESENTANTE LEGAL]]**

---
*Minuta gerada em modo demonstração. Configure ANTHROPIC_API_KEY pra resposta real.*`;
  }
  return `# RECURSO ADMINISTRATIVO — DEMO

**À Autoridade Competente** (instância superior)

[[CONTRATADA]] vem, com fulcro no art. 165 e 166 da Lei 14.133/2021, interpor RECURSO ADMINISTRATIVO contra a decisão exarada no procedimento [[PROCESSO]].

## I. TEMPESTIVIDADE

Recurso interposto no prazo de 15 (quinze) dias úteis previsto no art. 165 da Lei 14.133/2021.

## II. DA DECISÃO RECORRIDA

[[TEOR_DA_DECISAO]]

## III. RAZÕES

- [[ARGUMENTO_1]]
- [[ARGUMENTO_2]]

## IV. PEDIDOS

Requer-se:
a) o **conhecimento** e provimento do presente recurso;
b) a **reforma integral da decisão recorrida**;
c) subsidiariamente, a **redução/atenuação da penalidade** com base na dosimetria (Lei 14.133 art. 156, §1º).

[[CIDADE]], [[DATA]].

____________________
**[[REPRESENTANTE LEGAL]]**

---
*Minuta gerada em modo demonstração. Configure ANTHROPIC_API_KEY pra resposta real.*`;
}
