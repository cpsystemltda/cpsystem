import { NextResponse } from "next/server";
import { prospectarDoDia } from "@/lib/prospeccaoDiaria";
import { avisarEquipe } from "@/lib/alertaInterno";

/**
 * Prospecção diária — 12:00 UTC (09:00 BRT), de segunda a sexta.
 *
 * Regina, 24/09/2026, às 11h de uma quinta-feira: *"nenhuma mensagem foi
 * enviada de forma automática, como sempre foi feito."* A prospecção morava
 * num script que dependia de alguém rodar; dia sem alguém, dia sem prospecção,
 * e nenhum sinal de que tinha falhado.
 *
 * 09:00 BRT porque é quando quem decide compra ainda está no começo do dia.
 * Só dias úteis: abordagem comercial no sábado queima o contato e o número.
 *
 * O cron ENFILEIRA com hora marcada — não envia. Quem entrega é a ponte,
 * respeitando o intervalo de 3 a 5 minutos entre uma mensagem e outra. Sem
 * isso a automação seria impossível: função de servidor não fica 40 minutos
 * dormindo entre envios.
 *
 * O resultado vai para o grupo de suporte todo dia, inclusive quando não há o
 * que mandar. Silêncio foi exatamente o que deixou isso parar sem ninguém ver.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  // Dia útil só. `getUTCDay()` com o fuso do Brasil: às 12:00 UTC a data já é
  // a mesma no BRT, então não há risco de virar o dia.
  const diaSemana = new Date().getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) {
    return NextResponse.json({ ok: true, pulado: "fim de semana" });
  }

  const inicio = Date.now();
  const resumo = await prospectarDoDia();

  await avisarEquipe(
    resumo.enfileiradas > 0
      ? `📣 *Prospecção do dia*\n\n` +
          `${resumo.enfileiradas} abordagens na fila, da primeira às ${resumo.primeiraAs} ` +
          `até a última às ${resumo.ultimaAs}.\n\n` +
          `Teto do dia: 10 · já feitas antes deste disparo: ${resumo.jaFeitasHoje}`
      : `📣 *Prospecção do dia*\n\nNada enfileirado — ${resumo.motivo ?? "sem motivo registrado"}.` +
          (resumo.semCelular > 0 ? `\n\n${resumo.semCelular} leads descartados por não ter celular.` : ""),
  ).catch(() => {});

  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    executadoEm: new Date().toISOString(),
  });
}
