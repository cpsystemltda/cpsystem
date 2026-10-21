import { NextRequest, NextResponse } from "next/server";

/**
 * Executa sob demanda o que a régua diária faz com nota fiscal e cartão —
 * sem a parte de cobrança da régua, que já tem hora própria.
 *
 * Serve para dois momentos: testar em produção depois de um deploy (a chave
 * do Asaas só existe lá) e destravar à mão quando alguém não quer esperar o
 * cron das 09:00. Tudo o que roda aqui é idempotente: ligar emissão em quem
 * já tem, emitir nota de cobrança que já tem nota e reenviar PDF já enviado
 * não acontecem.
 */
export async function POST(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }
  const inicio = Date.now();
  const { rotinaNotaFiscalDiaria } = await import("@/lib/notaFiscalAutomatica");
  const { conferirCartoesDasAssinaturas } = await import("@/lib/cartaoAssinatura");

  const notaFiscal = await rotinaNotaFiscalDiaria().catch((e) => ({ erro: (e as Error).message.slice(0, 300) }));
  const cartoes = await conferirCartoesDasAssinaturas().catch((e) => ({ erro: (e as Error).message.slice(0, 300) }));

  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    notaFiscal,
    cartoes,
    executadoEm: new Date().toISOString(),
  });
}
