import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autenticarApi, ehErro } from "@/lib/apiPublica";

// GET /api/v1/status — confere o token: conta, escopos. Útil para testar a integração.
export async function GET(req: Request) {
  const ctx = await autenticarApi(req, "leitura");
  if (ehErro(ctx)) return ctx;
  const conta = await prisma.conta.findUnique({ where: { id: ctx.contaId }, select: { empresas: { select: { razaoSocial: true, cnpj: true } } } });
  return NextResponse.json({ ok: true, empresas: conta?.empresas ?? [], escopos: ctx.escopos, versao: "v1" }, { headers: { "Cache-Control": "no-store" } });
}
