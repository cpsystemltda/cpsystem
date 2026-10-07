import "server-only";
import { prisma } from "@/lib/prisma";
import { ehDiaUtilBrt, horaBrt, inicioDoDiaBrt } from "@/lib/saudacao";
import { ondeNaoFoiDescartada } from "@/lib/marcasDaFila";

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

/** Hora do cron de prospecção em Brasília (`5 12 * * 1-5` em UTC). */
const PROSPECCAO_HORA_BRT = 9;
/**
 * A partir de que horas a ausência de prospecção vira problema.
 *
 * São 10 envios espaçados de 3 a 5 minutos, então a última sai por volta das
 * 10h. Antes disso, "0 de 10" não é falha — é a fila ainda andando.
 */
const PROSPECCAO_COBRAR_A_PARTIR_DE = 11;

export async function conferirOperacao(): Promise<RelatorioSentinela> {
  const agora = new Date();
  // O dia é o de Brasília. Com `setHours` o corte caía às 21h daqui, porque na
  // Vercel o processo roda em UTC.
  const inicioDoDia = inicioDoDiaBrt(agora);

  const linhas: string[] = [];
  const achados: Achado[] = [];

  // ── 1. O que saiu hoje ────────────────────────────────────────────────────
  const [entregues, falhas, presas] = await Promise.all([
    prisma.mensagemSaidaWhatsApp.count({ where: { status: "ENVIADA", enviadaEm: { gte: inicioDoDia } } }),
    prisma.mensagemSaidaWhatsApp.findMany({
      // Descarte e expiração não são falha de canal — ver `marcasDaFila.ts`.
      // Antes só o descarte era ignorado, e a expiração nem existia: a
      // mensagem vencida ficava PENDENTE para sempre e virava "presa há mais
      // de 2h" em toda rodada, muito depois de a ponte ter voltado.
      where: { status: "FALHOU", criadoEm: { gte: inicioDoDia }, ...ondeNaoFoiDescartada() },
      select: { destino: true, tipo: true, erro: true },
      take: 5,
    }),
    // Presa = pendente entre 2h e 24h, sem hora marcada. Mensagem sã não fica
    // esperando: a ponte busca de minuto em minuto.
    //
    // O teto de 24h importa: passou disso, a fila expira e marca a mensagem,
    // e o que já foi encerrado não é problema aberto. Sem esse teto o alarme
    // nunca mais desligava.
    prisma.mensagemSaidaWhatsApp.count({
      where: {
        status: "PENDENTE",
        criadoEm: {
          lt: new Date(agora.getTime() - 2 * 3600_000),
          gte: new Date(agora.getTime() - 24 * 3600_000),
        },
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

  // ── A ponte está viva? ────────────────────────────────────────────────────
  //
  // Esta é a pergunta que "mensagens presas" não responde: fila vazia com
  // ponte morta parece operação tranquila. Foi assim que o fim de semana de
  // 03 e 04/10/2026 passou sem ninguém notar que nada saía.
  const batimento = await prisma.batimentoPonte.findUnique({
    where: { id: "unico" },
    select: { ultimoEm: true },
  });
  const minutosSemBuscar = batimento
    ? Math.round((agora.getTime() - batimento.ultimoEm.getTime()) / 60_000)
    : null;

  if (minutosSemBuscar === null) {
    linhas.push(`🔌 Ponte: *sem batimento registrado ainda*`);
  } else if (minutosSemBuscar <= 15) {
    linhas.push(`🔌 Ponte: *ativa* — última busca há ${minutosSemBuscar} min`);
  } else {
    const horas = Math.floor(minutosSemBuscar / 60);
    const quanto = horas >= 1 ? `${horas}h` : `${minutosSemBuscar} min`;
    linhas.push(`🔌 Ponte: *parada há ${quanto}*`);
    achados.push({
      grave: true,
      texto:
        `A ponte não busca a fila há ${quanto}. Enquanto ela estiver parada nada sai — ` +
        `e aviso que passar de 24h é descartado por vencimento.`,
    });
  }

  // Falha com "Z-API" no texto significa que algum caminho de envio escapou da
  // ponte. É a assinatura exata do problema que custou uma semana.
  const zapiVazando = await prisma.mensagemSaidaWhatsApp.count({
    where: { erro: { contains: "Z-API" }, criadoEm: { gte: new Date(agora.getTime() - 7 * 86400_000) } },
  });
  const notifZapi = await prisma.notificacaoWhatsApp.count({
    where: { erro: { contains: "Z-API" }, criadoEm: { gte: new Date(agora.getTime() - 2 * 86400_000) } },
  });
  if (zapiVazando + notifZapi > 0) {
    achados.push({
      grave: true,
      texto: `${zapiVazando + notifZapi} envio(s) ainda tentaram sair pela Z-API. Algum caminho escapou da ponte.`,
    });
  }

  // ── 2. Clientes sem notícia ───────────────────────────────────────────────
  //
  // O sinal que faltava na semana passada: o César ficou dias sem receber
  // nada e ninguém soube até a Regina perguntar.
  const limite = new Date(agora.getTime() - DIAS_SEM_NOTICIA_ALERTA * 86400_000);

  // Sócio não é cliente (regra da Regina, 24/09). O Igor tem dois cadastros com
  // o mesmo telefone — um de super admin e outro de analista — e o de analista
  // caía nesta lista como se fosse cliente parado. Casa pelos 11 últimos
  // dígitos porque um dos cadastros tem o 55 do país e o outro não.
  const internos = await prisma.usuario.findMany({
    where: { superAdmin: true, telefoneWhatsApp: { not: null } },
    select: { telefoneWhatsApp: true },
  });
  const soDigitos = (t: string | null) => (t ?? "").replace(/\D/g, "").slice(-11);
  const telefonesInternos = new Set(internos.map((u) => soDigitos(u.telefoneWhatsApp)).filter(Boolean));

  const todos = await prisma.usuario.findMany({
    where: {
      superAdmin: false,
      telefoneWhatsApp: { not: null },
      optInWhatsApp: true,
      conta: { statusAssinatura: { in: ["ATIVA", "TRIAL", "INADIMPLENTE"] } },
    },
    select: {
      id: true,
      nome: true,
      telefoneWhatsApp: true,
      conta: { select: { tipo: true } },
      notificacoesWhats: {
        where: { status: "ENVIADA" },
        orderBy: { enviadaEm: "desc" },
        take: 1,
        select: { enviadaEm: true },
      },
    },
  });
  const clientes = todos.filter((c) => !telefonesInternos.has(soDigitos(c.telefoneWhatsApp)));

  const mudos = clientes.filter((c) => {
    const ultima = c.notificacoesWhats[0]?.enviadaEm;
    return !ultima || ultima < limite;
  });

  // Cliente sem mensagem não é sintoma de nada sozinho: quem está em dia e sem
  // prazo à vista não tem o que receber. O que denuncia canal quebrado é NADA
  // sair para NINGUÉM — e é só nesse caso que isto vira problema. Antes, com
  // "mais da metade dos clientes", o relatório gritava todo dia por nada.
  const entreguesNaJanela = await prisma.mensagemSaidaWhatsApp.count({
    where: { status: "ENVIADA", enviadaEm: { gte: limite } },
  });

  linhas.push(`👥 Clientes ativos: *${clientes.length}* · sem mensagem há ${DIAS_SEM_NOTICIA_ALERTA}+ dias: *${mudos.length}*`);

  if (mudos.length > 0) {
    const lista = mudos.slice(0, 8).map((m) => `   ▫ ${m.nome}`).join("\n");
    achados.push(
      entreguesNaJanela === 0
        ? {
            grave: true,
            texto: `Nada saiu para ninguém nas últimas ${DIAS_SEM_NOTICIA_ALERTA * 24}h. O canal pode estar fora do ar:\n${lista}`,
          }
        : {
            grave: false,
            texto: `Sem mensagem há ${DIAS_SEM_NOTICIA_ALERTA}+ dias — pode ser só ausência de prazo, não é falha por si:\n${lista}`,
          },
    );
  }

  // ── 3. Prospecção do dia ──────────────────────────────────────────────────
  const prospeccaoHoje = await prisma.leadProspeccao.count({
    where: { dataPrimeiroContato: { gte: inicioDoDia } },
  });
  // Regina, 28/09: *"falando que a prospecção não rodou, que pode ter falhado,
  // sendo que são 8 da manhã. Você tem que se ligar no que está passando de
  // recado, senão confunde mais do que ajuda."*
  //
  // Ela está certa e o erro era de relógio, duas vezes: o dia útil vinha de
  // `getUTCDay()` — que às 21h de domingo já diz segunda — e a cobrança não
  // olhava a hora, então o relatório das 8h reclamava de um cron que só roda
  // às 9h. Agora só cobra depois que a janela passou.
  const diaUtil = ehDiaUtilBrt(agora);
  const hora = horaBrt(agora);

  if (!diaUtil) {
    linhas.push(`📣 Prospecção: *não roda hoje* — só em dia útil`);
  } else if (hora < PROSPECCAO_COBRAR_A_PARTIR_DE) {
    linhas.push(`📣 Prospecção: sai às ${PROSPECCAO_HORA_BRT}h — *${prospeccaoHoje}* até agora`);
  } else {
    linhas.push(`📣 Prospecções hoje: *${prospeccaoHoje}* de 10`);
    if (prospeccaoHoje === 0) {
      achados.push({
        grave: true,
        texto: `Nenhuma prospecção saiu até as ${hora}h, e é dia útil. O cron das ${PROSPECCAO_HORA_BRT}h falhou.`,
      });
    }
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
