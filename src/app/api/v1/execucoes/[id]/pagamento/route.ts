import { NextResponse } from "next/server";
import { autenticarApi, ehErro, erroApi } from "@/lib/apiPublica";
import { registrarPagamentoExecucao } from "@/lib/pagamentoExecucao";

// POST /api/v1/execucoes/{id}/pagamento — baixa de pagamento (escopo pagamentos:escrita).
// Corpo JSON: { "data": "2026-11-09", "observacao": "opcional" }. Idempotente:
// execução já paga devolve 200 com jaEstavaPago=true.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await autenticarApi(req, "pagamentos:escrita");
  if (ehErro(ctx)) return ctx;
  const { id } = await params;
  let corpo: { data?: string; observacao?: string } = {};
  try {
    corpo = await req.json();
  } catch {
    return erroApi(400, "json_invalido", 'Envie JSON: {"data":"AAAA-MM-DD"}.');
  }
  if (!corpo.data || !/^\d{4}-\d{2}-\d{2}$/.test(corpo.data)) return erroApi(400, "data_invalida", 'Informe "data" no formato AAAA-MM-DD.');
  const r = await registrarPagamentoExecucao({ contaId: ctx.contaId, empenhoId: id, data: new Date(`${corpo.data}T12:00:00.000Z`), origem: `API (token ${ctx.tokenId.slice(-6)})`, observacao: typeof corpo.observacao === "string" ? corpo.observacao.slice(0, 300) : null });
  if (!r.ok) return erroApi(r.status, "pagamento_recusado", r.erro);
  return NextResponse.json({ ok: true, execucaoId: id, status: "PAGO", jaEstavaPago: r.jaEstavaPago }, { headers: { "Cache-Control": "no-store" } });
}
