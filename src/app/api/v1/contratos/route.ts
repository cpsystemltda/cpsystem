import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autenticarApi, ehErro } from "@/lib/apiPublica";

// GET /api/v1/contratos — contratos da conta (resumo). ?vigentes=true filtra os em vigência.
export async function GET(req: Request) {
  const ctx = await autenticarApi(req, "leitura");
  if (ehErro(ctx)) return ctx;
  const u = new URL(req.url);
  const vigentes = u.searchParams.get("vigentes") === "true";
  const rows = await prisma.contrato.findMany({
    where: { empresa: { contaId: ctx.contaId }, ...(vigentes ? { vigenciaFim: { gte: new Date() } } : {}) },
    select: { id: true, numero: true, objeto: true, tipo: true, orgaoNome: true, orgaoCnpj: true, vigenciaInicio: true, vigenciaFim: true, empresa: { select: { id: true, razaoSocial: true, cnpj: true } }, itens: { select: { valorTotal: true } }, atualizadoEm: true },
    orderBy: { vigenciaFim: "desc" },
    take: 1000,
  });
  return NextResponse.json({
    dados: rows.map((c) => ({ id: c.id, numero: c.numero, objeto: c.objeto, tipo: c.tipo, orgao: { nome: c.orgaoNome, cnpj: c.orgaoCnpj }, empresa: { id: c.empresa.id, nome: c.empresa.razaoSocial, cnpj: c.empresa.cnpj }, vigenciaInicio: c.vigenciaInicio.toISOString().slice(0, 10), vigenciaFim: c.vigenciaFim.toISOString().slice(0, 10), valorItens: Math.round(c.itens.reduce((s, i) => s + i.valorTotal, 0) * 100) / 100, atualizadoEm: c.atualizadoEm.toISOString(), url: `https://cpsystem.app.br/contratos/${c.id}` })),
    total: rows.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
