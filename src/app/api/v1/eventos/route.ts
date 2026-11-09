import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SELECT_EXECUCAO, autenticarApi, ehErro, erroApi, eventoDaExecucao, parseDataParam } from "@/lib/apiPublica";

// GET /api/v1/eventos?de=AAAA-MM-DD&ate=AAAA-MM-DD — agenda das execuções
// (mesma janela da agenda do CP System). Padrão: hoje −30 a hoje +90 dias.
// Intervalo máximo: 366 dias.
export async function GET(req: Request) {
  const ctx = await autenticarApi(req, "leitura");
  if (ehErro(ctx)) return ctx;
  const u = new URL(req.url);
  const hoje = new Date();
  const de = parseDataParam(u.searchParams.get("de")) ?? new Date(hoje.getTime() - 30 * 86_400_000);
  const ate = parseDataParam(u.searchParams.get("ate")) ?? new Date(hoje.getTime() + 90 * 86_400_000);
  if (ate < de) return erroApi(400, "intervalo_invalido", '"ate" é anterior a "de".');
  if (ate.getTime() - de.getTime() > 366 * 86_400_000) return erroApi(400, "intervalo_grande", "Intervalo máximo de 366 dias.");
  // Pré-filtro largo pela vigência; a janela exata é calculada por execução.
  const rows = await prisma.empenho.findMany({
    where: { empresa: { contaId: ctx.contaId }, vigenciaFim: { gte: new Date(de.getTime() - 400 * 86_400_000) }, dataEmissao: { lte: ate } },
    select: SELECT_EXECUCAO,
    take: 2000,
  });
  const fimDia = new Date(ate.getTime() + 86_399_999);
  const eventos = rows
    .map(eventoDaExecucao)
    .filter((ev) => ev.inicio && ev.fim && new Date(`${ev.fim}T00:00:00Z`) >= de && new Date(`${ev.inicio}T00:00:00Z`) <= fimDia)
    .sort((a, b) => (a.inicio ?? "").localeCompare(b.inicio ?? ""));
  return NextResponse.json({ dados: eventos, de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10), total: eventos.length }, { headers: { "Cache-Control": "no-store" } });
}
