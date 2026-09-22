import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Fila de saída do WhatsApp — a ponte vem buscar o que há pra entregar.
 *
 * Regina, 22/09/2026: *"os nossos clientes não estão recebendo as mensagens
 * com resumo, com os avisos, todos os dias antes, nove horas da manhã já tinha
 * mensagem lá. O que está acontecendo?"*
 *
 * O que estava acontecendo: os crons rodavam certinho, a mensagem era montada
 * e gravada, e o envio morria na porta com `Z-API /status 400` — assinatura
 * vencida em 18/09. Quatro dias de cliente sem receber nada, e o sistema
 * marcando FALHOU num campo que ninguém olhava.
 *
 * O DESENHO, e por que ele é assim: a ponte roda na máquina da Regina, em
 * localhost, e a Vercel não alcança ela. Então quem liga é a ponte — de minuto
 * em minuto ela pergunta o que há pra mandar (GET), entrega pelo WhatsApp e
 * conta o que aconteceu (POST). Mesmo truque do `ponte-inbound`, ao contrário:
 * sem túnel, sem porta aberta, sem servidor externo.
 *
 * O banco já era a fila — `NotificacaoWhatsApp` nasce PENDENTE e tem telefone,
 * texto, status e erro. Não precisou de tabela nova: precisou de alguém vir
 * buscar.
 */
export const dynamic = "force-dynamic";

/** Nunca entregar mensagem velha: aviso de prazo de ontem é ruído hoje. */
const VALIDADE_HORAS = 24;

/** Teto por rodada — a ponte manda com intervalo, não em rajada. */
const LOTE = 10;

/**
 * Teto por pessoa em cada rodada.
 *
 * A fila acumulou quatro dias de Z-API fora, e o represado tinha 4 avisos de
 * empenho pro mesmo cliente e 6 de comissão pro mesmo analista. Soltar isso de
 * uma vez é o flood de 08/07 outra vez — o que fez a Regina exigir kill switch
 * e teto diário. Represa não justifica enxurrada.
 */
const POR_PESSOA_NA_RODADA = 2;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.PONTE_INBOUND_SECRET;
  if (!segredo) return true; // sem segredo configurado, não trava a entrega
  return req.headers.get("x-ponte-secret") === segredo;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  const candidatas = await prisma.notificacaoWhatsApp.findMany({
    where: {
      // FALHOU entra junto: é exatamente o que a Z-API deixou para trás. Sem
      // isso, o cliente que ficou sem o aviso continuaria sem ele.
      status: { in: ["PENDENTE", "FALHOU"] },
      criadoEm: { gte: new Date(Date.now() - VALIDADE_HORAS * 3600_000) },
    },
    orderBy: { criadoEm: "desc" }, // a mais nova de cada assunto é a que vale
    select: { id: true, usuarioId: true, telefone: true, mensagem: true, tipo: true },
  });

  // Mesma pessoa, mesmo assunto: só a versão mais recente vai. As anteriores
  // saem da fila — quatro avisos do mesmo empenho não informam quatro vezes
  // mais, só queimam a paciência de quem recebe.
  const jaTem = new Set<string>();
  const porPessoa = new Map<string, number>();
  const escolhidas: typeof candidatas = [];
  const descartadas: string[] = [];

  for (const m of candidatas) {
    const assunto = `${m.usuarioId}:${m.tipo}`;
    if (jaTem.has(assunto)) {
      descartadas.push(m.id);
      continue;
    }
    jaTem.add(assunto);

    const quantas = porPessoa.get(m.usuarioId) ?? 0;
    if (quantas >= POR_PESSOA_NA_RODADA) continue; // fica pra próxima rodada
    porPessoa.set(m.usuarioId, quantas + 1);

    escolhidas.push(m);
    if (escolhidas.length >= LOTE) break;
  }

  if (descartadas.length > 0) {
    await prisma.notificacaoWhatsApp.updateMany({
      where: { id: { in: descartadas } },
      data: { status: "FALHOU", erro: "substituída por versão mais recente do mesmo aviso" },
    });
  }

  return NextResponse.json({
    mensagens: escolhidas.map(({ id, telefone, mensagem, tipo }) => ({
      id, telefone, mensagem, tipo,
    })),
  });
}

type Resultado = { id: string; ok: boolean; erro?: string };

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  let body: { resultados?: Resultado[] };
  try {
    body = (await req.json()) as { resultados?: Resultado[] };
  } catch {
    return NextResponse.json({ erro: "json inválido" }, { status: 400 });
  }

  const resultados = (body.resultados ?? []).slice(0, 100);
  let entregues = 0;

  for (const r of resultados) {
    if (!r?.id) continue;
    try {
      await prisma.notificacaoWhatsApp.update({
        where: { id: r.id },
        data: r.ok
          ? { status: "ENVIADA", enviadaEm: new Date(), erro: null }
          : { status: "FALHOU", erro: (r.erro || "ponte não entregou").slice(0, 500) },
      });
      if (r.ok) entregues++;
    } catch {
      // Registro apagado entre o GET e o POST não invalida o resto do lote.
    }
  }

  return NextResponse.json({ ok: true, entregues });
}
