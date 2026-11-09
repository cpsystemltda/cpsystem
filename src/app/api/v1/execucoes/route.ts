import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SELECT_EXECUCAO, autenticarApi, ehErro, erroApi, parseDataParam, serializarExecucao } from "@/lib/apiPublica";

// GET /api/v1/execucoes — lista execuções (empenhos/ordens) da conta.
// Filtros: status, pago=true|false, emitidasDesde, emitidasAte,
// atualizadasDesde (sincronização incremental), pagina (1..), porPagina (≤ 200).
export async function GET(req: Request) {
  const ctx = await autenticarApi(req, "leitura");
  if (ehErro(ctx)) return ctx;
  const u = new URL(req.url);
  const pagina = Math.max(1, Number(u.searchParams.get("pagina")) || 1);
  const porPagina = Math.min(200, Math.max(1, Number(u.searchParams.get("porPagina")) || 50));
  const status = u.searchParams.get("status");
  const pago = u.searchParams.get("pago");
  const STATUS = ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO", "ENTREGUE", "NF_EMITIDA", "NF_ENCAMINHADA", "PAGO"];
  if (status && !STATUS.includes(status)) return erroApi(400, "status_invalido", `status deve ser um de: ${STATUS.join(", ")}`);
  const desde = parseDataParam(u.searchParams.get("emitidasDesde"));
  const ate = parseDataParam(u.searchParams.get("emitidasAte"));
  const atualizadas = parseDataParam(u.searchParams.get("atualizadasDesde"));
  const where = {
    empresa: { contaId: ctx.contaId },
    ...(status ? { status: status as "PAGO" } : {}),
    ...(pago === "true" ? { status: "PAGO" as const } : pago === "false" ? { status: { not: "PAGO" as const } } : {}),
    ...(desde || ate ? { dataEmissao: { ...(desde ? { gte: desde } : {}), ...(ate ? { lte: new Date(ate.getTime() + 86_399_999) } : {}) } } : {}),
    ...(atualizadas ? { atualizadoEm: { gte: atualizadas } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.empenho.count({ where }),
    prisma.empenho.findMany({ where, select: SELECT_EXECUCAO, orderBy: [{ dataEmissao: "desc" }, { id: "asc" }], skip: (pagina - 1) * porPagina, take: porPagina }),
  ]);
  return NextResponse.json({ dados: rows.map(serializarExecucao), pagina, porPagina, total, paginas: Math.ceil(total / porPagina) }, { headers: { "Cache-Control": "no-store" } });
}
