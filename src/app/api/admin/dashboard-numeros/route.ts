import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inicioDoDiaVigencia } from "@/lib/diaVigencia";

/**
 * Os números do painel, calculados pelo código que está NO AR.
 *
 * Existe porque em 24/09/2026 a Regina viu o painel de um cliente zerado,
 * eu afirmei ter corrigido, e ela recarregou e continuou errado. Sem um jeito
 * de perguntar à produção o que ela está calculando, a conversa vira "mas aqui
 * funciona" — que é exatamente o que não ajuda ninguém.
 *
 * Devolve também o corte de vigência em uso: se voltar o instante atual em vez
 * da meia-noite, é sinal de que a versão publicada é velha.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }
  const conta = url.searchParams.get("conta");
  if (!conta) return NextResponse.json({ erro: "informe ?conta=<contaId>" }, { status: 400 });

  const diaVigencia = inicioDoDiaVigencia();
  const filtroEmpresa = { contaId: conta };

  const [atasVig, contratosVig, empenhos] = await Promise.all([
    prisma.ata.findMany({
      where: { empresa: filtroEmpresa, vigenciaFim: { gte: diaVigencia } },
      select: { numero: true, vigenciaFim: true, itens: { select: { valorTotal: true } } },
    }),
    prisma.contrato.findMany({
      where: { empresa: filtroEmpresa, vigenciaFim: { gte: diaVigencia } },
      select: { numero: true, itens: { select: { valorTotal: true } } },
    }),
    prisma.empenho.findMany({
      where: { empresa: filtroEmpresa },
      select: { numero: true, status: true, itens: { select: { valorTotal: true } } },
    }),
  ]);

  const soma = (itens: { valorTotal: number }[]) => itens.reduce((s, i) => s + i.valorTotal, 0);
  const contratado = atasVig.reduce((s, a) => s + soma(a.itens), 0) + contratosVig.reduce((s, c) => s + soma(c.itens), 0);
  const executado = empenhos
    .filter((e) => ["ENTREGUE", "NF_EMITIDA", "NF_ENCAMINHADA", "PAGO"].includes(e.status))
    .reduce((s, e) => s + soma(e.itens), 0);

  return NextResponse.json({
    corteDeVigenciaEmUso: diaVigencia.toISOString(),
    agora: new Date().toISOString(),
    atasVigentes: atasVig.length,
    contratosVigentes: contratosVig.length,
    valoresContratados: Number(contratado.toFixed(2)),
    valoresExecutados: Number(executado.toFixed(2)),
    valoresAExecutar: Number(Math.max(0, contratado - executado).toFixed(2)),
    empenhos: empenhos.map((e) => ({ numero: e.numero, status: e.status, valor: Number(soma(e.itens).toFixed(2)) })),
    atas: atasVig.map((a) => ({ numero: a.numero, vigenciaFim: a.vigenciaFim, valor: Number(soma(a.itens).toFixed(2)) })),
  });
}
