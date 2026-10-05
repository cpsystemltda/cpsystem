import { NextResponse } from "next/server";
import { descobrirLeads } from "@/lib/leads/descobrir";
import { prisma } from "@/lib/prisma";

/**
 * Repõe a lista de prospecção antes de ela acabar.
 *
 * Em 05/10/2026 a lista importada zerou: restavam 66 leads no perfil ideal e
 * **nenhum com celular**. A prospecção ia parar no dia seguinte por falta de
 * gente para abordar. Lista comprada ou importada sempre acaba; a que se
 * repõe sozinha, não.
 *
 * Roda de madrugada, de segunda a sexta, e só trabalha quando o estoque está
 * baixo — buscar todo dia encheria o banco de lead que envelhece antes de ser
 * usado, e o gancho da abordagem é o contrato vencendo.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Abaixo disto, repõe. Dez por dia, então é pouco mais de uma semana de folga. */
const ESTOQUE_MINIMO = 80;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const esperado = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== esperado) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  // O estoque que conta é o que dá para abordar: alvo ideal, não contatado e
  // com celular. Contar a lista inteira esconderia justamente o que acabou.
  const naoContatados = await prisma.leadProspeccao.findMany({
    where: { alvoIdeal: true, situacao: "NAO_CONTATADO", telefone: { not: null } },
    select: { telefone: true },
  });
  const estoque = naoContatados.filter((l) => {
    const d = (l.telefone || "").replace(/\D/g, "");
    return d.length === 11 && d[2] === "9";
  }).length;

  if (estoque >= ESTOQUE_MINIMO) {
    return NextResponse.json({ ok: true, estoque, repos: false, motivo: "estoque suficiente" });
  }

  const hoje = new Date();
  try {
    const r = await descobrirLeads({
      // Contratos publicados nos últimos 90 dias: é onde está quem assinou
      // recentemente e tem vigência terminando dentro da janela de abordagem.
      publicadosDe: new Date(hoje.getTime() - 90 * 86400_000),
      publicadosAte: hoje,
      venceEntreDias: [15, 150],
      valorMinimo: 20_000,
      limite: 120,
      maxPaginas: 60,
    });
    return NextResponse.json({ ok: true, estoqueAntes: estoque, repos: true, ...r });
  } catch (e) {
    console.error("[descobrir-leads] falhou:", e);
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
