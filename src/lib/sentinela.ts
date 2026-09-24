import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Sentinela — o sistema conferindo a si mesmo, todo dia.
 *
 * Regina, 24/09/2026: *"eu não tenho que ficar te lembrando disso. Isso tem
 * que estar na sua programação diária."* Ela está certa, e mais do que isso:
 * não pode depender nem da memória dela nem da minha.
 *
 * O padrão que se repetiu a semana inteira nunca foi um bug difícil — foi
 * **silêncio**. A Z-API venceu e as mensagens pararam; a fila ficou cega por
 * um filtro errado; a prospecção dependia de alguém rodar um script. Em todos
 * os casos o sistema achava que estava trabalhando, e o primeiro a perceber
 * foi a cliente, irritada, horas depois.
 *
 * Este módulo existe para que isso seja impossível de acontecer em silêncio:
 * uma vez por dia ele olha o que saiu, o que falhou, o que travou e quem está
 * sem notícia há dias — e conta no grupo de suporte, inclusive quando está
 * tudo bem. Relatório que só aparece quando há problema vira relatório que
 * ninguém sabe se está funcionando.
 */

export type Achado = { grave: boolean; texto: string };

export type RelatorioSentinela = {
  linhas: string[];
  achados: Achado[];
  tudoCerto: boolean;
};

const DIAS_SEM_NOTICIA_ALERTA = 2;

export async function conferirOperacao(): Promise<RelatorioSentinela> {
  const agora = new Date();
  const inicioDoDia = new Date(agora);
  inicioDoDia.setHours(0, 0, 0, 0);

  const linhas: string[] = [];
  const achados: Achado[] = [];

  // ── 1. O que saiu hoje ────────────────────────────────────────────────────
  const [entregues, falhas, presas] = await Promise.all([
    prisma.mensagemSaidaWhatsApp.count({ where: { status: "ENVIADA", enviadaEm: { gte: inicioDoDia } } }),
    prisma.mensagemSaidaWhatsApp.findMany({
      where: { status: "FALHOU", criadoEm: { gte: inicioDoDia }, NOT: { erro: { startsWith: "substituída" } } },
      select: { destino: true, tipo: true, erro: true },
      take: 5,
    }),
    // Presa = pendente há mais de 2h sem hora marcada. Mensagem sã não fica
    // esperando: a ponte busca de minuto em minuto.
    prisma.mensagemSaidaWhatsApp.count({
      where: {
        status: "PENDENTE",
        criadoEm: { lt: new Date(agora.getTime() - 2 * 3600_000) },
        OR: [{ agendadoPara: null }, { agendadoPara: { lte: agora } }],
      },
    }),
  ]);

  linhas.push(`📤 Entregues hoje: *${entregues}*`);

  if (falhas.length > 0) {
    achados.push({
      grave: true,
      texto:
        `${falhas.length} envio(s) falharam hoje:\n` +
        falhas.map((f) => `   ▫ ${f.tipo ?? "avulso"} → ${f.destino}: ${f.erro?.slice(0, 60)}`).join("\n"),
    });
  }

  if (presas > 0) {
    achados.push({
      grave: true,
      texto: `${presas} mensagem(ns) presas há mais de 2h na fila. A ponte pode estar fora do ar.`,
    });
  }

  // ── 2. Clientes sem notícia ───────────────────────────────────────────────
  //
  // O sinal que faltava na semana passada: o César ficou dias sem receber
  // nada e ninguém soube até a Regina perguntar.
  const limite = new Date(agora.getTime() - DIAS_SEM_NOTICIA_ALERTA * 86400_000);
  const clientes = await prisma.usuario.findMany({
    where: {
      superAdmin: false,
      telefoneWhatsApp: { not: null },
      optInWhatsApp: true,
      conta: { statusAssinatura: { in: ["ATIVA", "TRIAL", "INADIMPLENTE"] } },
    },
    select: {
      id: true,
      nome: true,
      conta: { select: { tipo: true } },
      notificacoesWhats: {
        where: { status: "ENVIADA" },
        orderBy: { enviadaEm: "desc" },
        take: 1,
        select: { enviadaEm: true },
      },
    },
  });

  const mudos = clientes.filter((c) => {
    const ultima = c.notificacoesWhats[0]?.enviadaEm;
    return !ultima || ultima < limite;
  });

  linhas.push(`👥 Clientes ativos: *${clientes.length}* · sem notícia há ${DIAS_SEM_NOTICIA_ALERTA}+ dias: *${mudos.length}*`);

  if (mudos.length > 0) {
    achados.push({
      grave: mudos.length > clientes.length / 2,
      texto:
        `Sem receber nada há ${DIAS_SEM_NOTICIA_ALERTA}+ dias:\n` +
        mudos.slice(0, 8).map((m) => `   ▫ ${m.nome}`).join("\n"),
    });
  }

  // ── 3. Prospecção do dia ──────────────────────────────────────────────────
  const prospeccaoHoje = await prisma.leadProspeccao.count({
    where: { dataPrimeiroContato: { gte: inicioDoDia } },
  });
  const diaUtil = agora.getUTCDay() >= 1 && agora.getUTCDay() <= 5;
  linhas.push(`📣 Prospecções hoje: *${prospeccaoHoje}* de 10`);
  if (diaUtil && prospeccaoHoje === 0) {
    achados.push({ grave: true, texto: "Nenhuma prospecção saiu hoje, e é dia útil. O cron das 9h pode ter falhado." });
  }

  // ── 4. Mensagens que ninguém respondeu ────────────────────────────────────
  const semResposta = await prisma.mensagemInboundWhatsApp.count({
    where: { criadoEm: { gte: inicioDoDia } },
  });
  linhas.push(`💬 Mensagens recebidas hoje: *${semResposta}*`);

  return { linhas, achados, tudoCerto: achados.length === 0 };
}

/** O texto que vai para o grupo — curto quando está tudo bem, detalhado quando não está. */
export function montarTextoSentinela(r: RelatorioSentinela): string {
  const graves = r.achados.filter((a) => a.grave).length;
  const cabecalho = r.tudoCerto
    ? `✅ *Operação conferida — tudo certo*`
    : graves > 0
      ? `⚠️ *Operação conferida — ${graves} ${graves === 1 ? "problema" : "problemas"} a resolver*`
      : `🔎 *Operação conferida — nada quebrado, ${r.achados.length} ${r.achados.length === 1 ? "observação" : "observações"}*`;

  const corpo = r.linhas.join("\n");
  const alertas = r.achados.length
    ? "\n\n" + r.achados.map((a) => `${a.grave ? "⚠️" : "ℹ️"} ${a.texto}`).join("\n\n")
    : "";

  return `${cabecalho}\n\n${corpo}${alertas}`;
}
