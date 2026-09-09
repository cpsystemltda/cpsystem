import { NextResponse } from "next/server";
import { avisarExclusaoProxima, excluirTrialsAbandonados } from "@/lib/trialAbandonado";

/**
 * Fim de linha do teste abandonado — todo dia às 14:00 UTC (11:00 BRT).
 *
 * Regina 09/09: bloquear no fim do trial (já acontece no acesso), avisar antes
 * de apagar, e apagar só depois de 30 dias sem pagamento.
 *
 * A exclusão só roda de verdade com EXCLUIR_TRIAL_ABANDONADO=1 no ambiente.
 * Sem isso, o cron apenas simula e reporta — apagar conta de cliente não tem
 * desfazer, e não quero que dependa apenas de eu ter escrito a query certa.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  const aviso = await avisarExclusaoProxima();
  const exclusao = await excluirTrialsAbandonados({
    simular: process.env.EXCLUIR_TRIAL_ABANDONADO !== "1",
  });

  return NextResponse.json({ ok: true, aviso, exclusao, executadoEm: new Date().toISOString() });
}
