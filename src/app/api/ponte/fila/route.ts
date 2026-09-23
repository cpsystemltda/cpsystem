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

/**
 * Marca de quem já saiu da fila por ter sido substituída.
 *
 * Detalhe que custou três mensagens repetidas pro César na primeira hora: o
 * descarte gravava status FALHOU, e FALHOU é justamente o que a fila recolhe.
 * As descartadas voltavam na rodada seguinte, uma por vez. Sem status próprio
 * no enum, a marca fica no texto do erro — e é ela que exclui daqui pra frente.
 */
const MARCA_DESCARTE = "substituída por versão mais recente";

/**
 * Avisos que se substituem, e só eles.
 *
 * Resumo e lembrete são retratos do mesmo estado: o de hoje torna o de ontem
 * inútil, e mandar os dois é ruído. Já COMISSAO_LIBERADA e NF_EMITIDA_CLIENTE
 * são FATOS distintos — três comissões são três dinheiros, e colapsar isso
 * sumiria com dois avisos que o analista tem direito de receber. Fora desta
 * lista, nada é descartado por duplicidade.
 */
const SUBSTITUIVEIS = new Set([
  "RESUMO_SEMANAL_EMPRESA",
  "RESUMO_SEMANAL_ANALISTA",
  "VENCIMENTO_EMPENHO",
  "PLANO_ATRASADO",
  "ATIVACAO",
]);

/** Teto diário por pessoa, o mesmo do disparo (Regina 08/07, depois do flood). */
const LIMITE_DIARIO_POR_PESSOA = 4;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.PONTE_INBOUND_SECRET;
  if (!segredo) return true; // sem segredo configurado, não trava a entrega
  return req.headers.get("x-ponte-secret") === segredo;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  const brutas = await prisma.mensagemSaidaWhatsApp.findMany({
    where: {
      // FALHOU entra junto: é exatamente o que a Z-API deixou para trás. Sem
      // isso, o cliente que ficou sem o aviso continuaria sem ele.
      status: { in: ["PENDENTE", "FALHOU"] },
      criadoEm: { gte: new Date(Date.now() - VALIDADE_HORAS * 3600_000) },
      // `NOT` sozinho descartaria toda linha com `erro` nulo — que são
      // justamente as novas, nunca tentadas. Em SQL, NOT(NULL LIKE 'x%') é
      // NULL, e NULL não é verdadeiro. Custou uma fila que parecia vazia com
      // três mensagens dentro.
      OR: [{ erro: null }, { NOT: { erro: { startsWith: MARCA_DESCARTE } } }],
      tentativas: { lt: 5 },
    },
    orderBy: { criadoEm: "desc" }, // a mais nova de cada assunto é a que vale
    select: {
      id: true, usuarioId: true, destino: true, texto: true, tipo: true,
      documentoUrl: true, nomeArquivo: true,
    },
  });

  // Aviso interno (grupo de suporte) não tem usuário nem assunto, e não pode
  // ser silenciado por teto nenhum: é a equipe descobrindo que um cliente está
  // esperando. Vai sempre, e na frente.
  const candidatas = brutas.map((m) => ({
    id: m.id,
    usuarioId: m.usuarioId ?? `avulso:${m.id}`,
    telefone: m.destino,
    mensagem: m.texto,
    tipo: m.tipo ?? `avulso:${m.id}`,
    documentoUrl: m.documentoUrl,
    nomeArquivo: m.nomeArquivo,
  }));

  // Mesma pessoa, mesmo assunto: só a versão mais recente vai. As anteriores
  // saem da fila — quatro avisos do mesmo empenho não informam quatro vezes
  // mais, só queimam a paciência de quem recebe.
  // Quanto cada um já recebeu hoje. O teto diário é do disparo, mas a entrega
  // agora acontece depois e em outro lugar — se não contar aqui também, a fila
  // vira a porta dos fundos do limite que existe justamente pra não afogar
  // ninguém.
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const enviadasHoje = await prisma.notificacaoWhatsApp.groupBy({
    by: ["usuarioId"],
    where: { status: "ENVIADA", enviadaEm: { gte: inicioDoDia } },
    _count: { _all: true },
  });
  const jaRecebeuHoje = new Map(
    enviadasHoje.map((r) => [r.usuarioId, r._count._all]),
  );

  const jaTem = new Set<string>();
  const porPessoa = new Map<string, number>();
  const escolhidas: typeof candidatas = [];
  const descartadas: string[] = [];

  for (const m of candidatas) {
    const assunto = `${m.usuarioId}:${m.tipo}`;
    if (SUBSTITUIVEIS.has(m.tipo)) {
      if (jaTem.has(assunto)) {
        descartadas.push(m.id);
        continue;
      }
      jaTem.add(assunto);
    }

    const hoje = jaRecebeuHoje.get(m.usuarioId) ?? 0;
    const quantas = porPessoa.get(m.usuarioId) ?? 0;
    if (hoje + quantas >= LIMITE_DIARIO_POR_PESSOA) continue; // teto do dia
    if (quantas >= POR_PESSOA_NA_RODADA) continue; // fica pra próxima rodada
    porPessoa.set(m.usuarioId, quantas + 1);

    escolhidas.push(m);
    if (escolhidas.length >= LOTE) break;
  }

  if (descartadas.length > 0) {
    await prisma.mensagemSaidaWhatsApp.updateMany({
      where: { id: { in: descartadas } },
      data: { status: "FALHOU", erro: `${MARCA_DESCARTE} do mesmo aviso` },
    });
  }

  // Conta a tentativa antes de entregar. Mensagem que derruba a ponte no meio
  // do caminho volta pra fila, e sem este contador voltaria pra sempre.
  if (escolhidas.length > 0) {
    await prisma.mensagemSaidaWhatsApp.updateMany({
      where: { id: { in: escolhidas.map((m) => m.id) } },
      data: { tentativas: { increment: 1 } },
    });
  }

  return NextResponse.json({
    mensagens: escolhidas.map((m) => ({
      id: m.id,
      telefone: m.telefone,
      mensagem: m.mensagem,
      tipo: m.tipo,
      // Anexo: a ponte baixa e manda como documento. É o que faltava pra nota
      // fiscal chegar em PDF, e não como link (Regina 07/07 e de novo 22/09).
      documentoUrl: m.documentoUrl ?? undefined,
      nomeArquivo: m.nomeArquivo ?? undefined,
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
      const dados = r.ok
        ? { status: "ENVIADA" as const, enviadaEm: new Date(), erro: null }
        : { status: "FALHOU" as const, erro: (r.erro || "ponte não entregou").slice(0, 500) };

      const linha = await prisma.mensagemSaidaWhatsApp.update({
        where: { id: r.id },
        data: dados,
        select: { notificacaoId: true },
      });

      // O registro de negócio anda junto. Sem isso, `NotificacaoWhatsApp`
      // ficaria eternamente PENDENTE e a idempotência mandaria de novo.
      if (linha.notificacaoId) {
        await prisma.notificacaoWhatsApp
          .update({ where: { id: linha.notificacaoId }, data: dados })
          .catch(() => {});
      }
      if (r.ok) entregues++;
    } catch {
      // Registro apagado entre o GET e o POST não invalida o resto do lote.
    }
  }

  return NextResponse.json({ ok: true, entregues });
}
