import { prisma } from "@/lib/prisma";

/**
 * Conversoes offline pro Google Ads — a receita que o pixel nao consegue ver.
 *
 * O cadastro acontece no navegador, entao a conversao "sign_up" vai por gtag.
 * Ja o pagamento e confirmado pelo webhook do gateway, sem navegador nenhum:
 * nao existe pagina pra disparar evento. A ponte e o gclid guardado no signup —
 * com ele o Google consegue casar "esse clique virou R$ 397 de assinatura".
 *
 * O formato abaixo e o do upload de conversoes offline do Google Ads
 * (Metas > Uploads). A primeira linha com `Parameters:TimeZone` e obrigatoria.
 */

export const NOME_CONVERSAO_ASSINATURA = "Assinatura paga";
const TIMEZONE = "America/Sao_Paulo";

export type LinhaConversao = {
  gclid: string;
  quando: Date;
  valor: number;
  contaId: string;
};

/**
 * Contas que vieram de anuncio, ja pagaram pelo menos uma fatura e ainda nao
 * foram reportadas. Usa a PRIMEIRA cobranca paga: o que a campanha comprou foi
 * a aquisicao do cliente, nao cada renovacao mensal.
 */
export async function conversoesPendentes(): Promise<LinhaConversao[]> {
  const contas = await prisma.conta.findMany({
    where: {
      gclid: { not: null },
      conversaoEnviadaEm: null,
      cobrancas: { some: { status: "PAGA", pagaEm: { not: null } } },
    },
    select: {
      id: true,
      gclid: true,
      cobrancas: {
        where: { status: "PAGA", pagaEm: { not: null } },
        orderBy: { pagaEm: "asc" },
        take: 1,
        select: { pagaEm: true, valor: true },
      },
    },
  });

  const linhas: LinhaConversao[] = [];
  for (const c of contas) {
    const primeira = c.cobrancas[0];
    if (!c.gclid || !primeira?.pagaEm) continue;
    linhas.push({
      gclid: c.gclid,
      quando: primeira.pagaEm,
      valor: Number(primeira.valor),
      contaId: c.id,
    });
  }
  return linhas;
}

/** "2026-08-10 14:30:00" no fuso de Brasilia, que e o declarado no cabecalho. */
function formatarData(d: Date): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  // o locale sv-SE ja entrega "YYYY-MM-DD HH:mm:ss"
  return partes.replace("T", " ");
}

export function montarCsv(linhas: LinhaConversao[]): string {
  const out = [
    `Parameters:TimeZone=${TIMEZONE}`,
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
  ];
  for (const l of linhas) {
    out.push(
      [
        l.gclid,
        NOME_CONVERSAO_ASSINATURA,
        formatarData(l.quando),
        l.valor.toFixed(2),
        "BRL",
      ].join(","),
    );
  }
  return out.join("\n");
}

/**
 * Marca as contas como exportadas. Chamado so DEPOIS de gerar o arquivo, pra
 * que a mesma venda nao seja contada duas vezes num upload seguinte.
 */
export async function marcarEnviadas(contaIds: string[]) {
  if (contaIds.length === 0) return;
  await prisma.conta.updateMany({
    where: { id: { in: contaIds } },
    data: { conversaoEnviadaEm: new Date() },
  });
}
