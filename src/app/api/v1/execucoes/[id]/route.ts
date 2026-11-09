import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SELECT_EXECUCAO, autenticarApi, ehErro, erroApi, serializarExecucao } from "@/lib/apiPublica";

// GET /api/v1/execucoes/{id}
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await autenticarApi(req, "leitura");
  if (ehErro(ctx)) return ctx;
  const { id } = await params;
  const e = await prisma.empenho.findFirst({ where: { id, empresa: { contaId: ctx.contaId } }, select: SELECT_EXECUCAO });
  if (!e) return erroApi(404, "nao_encontrada", "Execução não encontrada.");
  return NextResponse.json({ dados: serializarExecucao(e) }, { headers: { "Cache-Control": "no-store" } });
}
