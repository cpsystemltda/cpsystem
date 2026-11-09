import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autenticarApi, ehErro } from "@/lib/apiPublica";

// GET /api/v1/atas — atas de registro de preços da conta, com itens. ?vigentes=true.
export async function GET(req: Request) {
  const ctx = await autenticarApi(req, "leitura");
  if (ehErro(ctx)) return ctx;
  const u = new URL(req.url);
  const vigentes = u.searchParams.get("vigentes") === "true";
  const rows = await prisma.ata.findMany({
    where: { empresa: { contaId: ctx.contaId }, ...(vigentes ? { vigenciaFim: { gte: new Date() } } : {}) },
    select: { id: true, numero: true, objeto: true, orgaoNome: true, orgaoCnpj: true, vigenciaInicio: true, vigenciaFim: true, empresa: { select: { id: true, razaoSocial: true, cnpj: true } }, itens: { select: { id: true, numero: true, lote: true, descricao: true, unidade: true, quantidade: true, valorUnitario: true, valorTotal: true } } },
    orderBy: { vigenciaFim: "desc" },
    take: 500,
  });
  return NextResponse.json({
    dados: rows.map((a) => ({ id: a.id, numero: a.numero, objeto: a.objeto, orgao: { nome: a.orgaoNome, cnpj: a.orgaoCnpj }, empresa: { id: a.empresa.id, nome: a.empresa.razaoSocial, cnpj: a.empresa.cnpj }, vigenciaInicio: a.vigenciaInicio.toISOString().slice(0, 10), vigenciaFim: a.vigenciaFim.toISOString().slice(0, 10), itens: a.itens, url: `https://cpsystem.app.br/atas/${a.id}` })),
    total: rows.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
