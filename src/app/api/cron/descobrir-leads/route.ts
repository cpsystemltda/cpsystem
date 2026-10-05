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

  // A janela GIRA a cada rodada.
  //
  // O PNCP devolve 429 por volta da oitava página, então cada rodada lê uns
  // 3.500 contratos — sempre os primeiros da janela. Com janela fixa, a
  // segunda noite releria exatamente os mesmos e devolveria quase só
  // "já conhecíamos": foi o que aconteceu na primeira tentativa, 67 de 160.
  //
  // Girando por mês de publicação, cada noite entra numa fatia diferente dos
  // últimos seis meses. Contrato publicado há meio ano ainda serve: o que
  // importa para a abordagem é quando ele VENCE, não quando foi assinado.
  const fatia = hoje.getDate() % 6; // 0 a 5 meses atrás
  const publicadosAte = new Date(hoje.getTime() - fatia * 30 * 86400_000);
  const publicadosDe = new Date(publicadosAte.getTime() - 30 * 86400_000);

  try {
    const r = await descobrirLeads({
      publicadosDe,
      publicadosAte,
      venceEntreDias: [15, 150],
      valorMinimo: 20_000,
      limite: 120,
      maxPaginas: 60,
    });
    return NextResponse.json({
      ok: true,
      estoqueAntes: estoque,
      repos: true,
      janela: `${publicadosDe.toISOString().slice(0, 10)} a ${publicadosAte.toISOString().slice(0, 10)}`,
      ...r,
    });
  } catch (e) {
    console.error("[descobrir-leads] falhou:", e);
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
