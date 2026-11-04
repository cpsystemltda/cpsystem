import { NextResponse } from "next/server";
import { descobrirLeads, diaDePublicacaoDaRodada, estoqueDeProspeccao } from "@/lib/leads/descobrir";
import { avisarEquipe } from "@/lib/alertaInterno";

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
 *
 * Em 03 e 04/11/2026 a prospecção saiu vazia ("sem lead elegível") e ninguém
 * soube por quê: esta rotina rodava, não achava nada e não contava a ninguém.
 * Agora toda rodada que busca — e toda que falha — fala no grupo da equipe,
 * e a sentinela mostra o estoque duas vezes por dia. Rotina diária que não
 * diz que rodou é rotina que para em silêncio ([[rotina-diaria-obrigatoria]]).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Abaixo disto, repõe. Dez por dia, então é pouco mais de uma semana de folga. */
const ESTOQUE_MINIMO = 80;

const dataBr = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const esperado = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== esperado) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  // O estoque que conta é o que dá para abordar: alvo ideal, não contatado e
  // com celular. Contar a lista inteira esconderia justamente o que acabou.
  const estoque = await estoqueDeProspeccao();

  if (estoque >= ESTOQUE_MINIMO) {
    return NextResponse.json({ ok: true, estoque, repos: false, motivo: "estoque suficiente" });
  }

  // Um dia de publicação por rodada, girando pelo último ano — o porquê está
  // em `diaDePublicacaoDaRodada`.
  const dia = diaDePublicacaoDaRodada(new Date());

  try {
    const r = await descobrirLeads({
      publicadosDe: dia,
      publicadosAte: dia,
      venceEntreDias: [15, 150],
      valorMinimo: 20_000,
      limite: 120,
      maxPaginas: 60,
    });
    const estoqueDepois = await estoqueDeProspeccao();

    const linhas = [
      `📡 *Descoberta de leads*`,
      ``,
      `Estoque para abordar: *${estoque}* → *${estoqueDepois}*`,
      `PNCP: contratos publicados em ${dataBr(dia)} — ${r.paginasLidas} página(s), ${r.contratosVistos} contratos`,
      `Empresas candidatas: ${r.empresasCandidatas} · já conhecidas: ${r.jaConheciamos}`,
      `Consultadas na Receita: ${r.consultadasNaReceita} · sem celular: ${r.semCelular} · fora de atividade: ${r.foraDeAtividade}`,
      `Gravados: *${r.gravados}* (${r.alvoIdeal} no perfil ideal)`,
    ];
    if (r.detalhes.length) linhas.push(``, ...r.detalhes.map((d) => `▫ ${d}`));
    if (estoqueDepois === 0) {
      linhas.push(``, `⚠️ Estoque continua zerado: a prospecção das 9h não vai sair. Se repetir amanhã, a fonte (PNCP ou BrasilAPI) precisa de atenção.`);
    } else if (r.alvoIdeal === 0) {
      linhas.push(``, `ℹ️ Nenhum lead novo no perfil ideal nesta rodada; amanhã a janela é outra.`);
    }
    await avisarEquipe(linhas.join("\n")).catch(() => {});

    return NextResponse.json({
      ok: true,
      estoqueAntes: estoque,
      estoqueDepois,
      repos: true,
      janela: dia.toISOString().slice(0, 10),
      ...r,
    });
  } catch (e) {
    console.error("[descobrir-leads] falhou:", e);
    await avisarEquipe(
      `⚠️ *Descoberta de leads falhou*\n\n` +
        `Estoque para abordar: *${estoque}*. A rodada de hoje (contratos de ${dataBr(dia)}) parou com erro:\n` +
        `▫ ${(e as Error).message.slice(0, 200)}\n\n` +
        `Sem reposição, a prospecção das 9h sai vazia.`,
    ).catch(() => {});
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
