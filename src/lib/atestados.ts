/**
 * Atestado de Capacidade Técnica — quando cobrar, de quem, e até quando.
 *
 * Regina 11/09: "ao final de cada Contrato ou Ata as empresas costumam
 * solicitar ao órgão um documento atestando que cumpriu suas obrigações com
 * pontualidade e rigor técnico. Seria legal se o sistema gerasse um alerta
 * dentro dos módulos informando que aquele Contrato/Ata findou e que ele
 * precisa solicitar o Atestado."
 *
 * Por que isso importa mais do que parece: o atestado é o que comprova
 * qualificação técnica na PRÓXIMA licitação (Lei 14.133, art. 67). Quem não
 * pede na hora certa costuma descobrir que precisa dele no meio de um novo
 * certame — e aí o servidor que acompanhou a execução já saiu do setor, o
 * processo está arquivado e o pedido vira uma novela. O valor do alerta é
 * pedir enquanto a execução ainda está fresca para o órgão.
 *
 * A régua tem quatro estados, e os três primeiros existem para o aviso SUMIR
 * quando já não cabe. Alerta que não sabe a hora de calar vira ruído, e o
 * cliente para de ler todos os outros junto:
 *
 *   ANEXADO         → o PDF está no sistema. Acabou.
 *   DISPENSADO      → o cliente disse que não vai pedir. Decisão dele, respeitada.
 *   AGUARDANDO_ORGAO→ ele pediu, o órgão não entregou. O aviso muda de dono:
 *                     não é mais "peça", é "cobre o órgão — já são X dias".
 *   PENDENTE        → encerrou e ninguém fez nada. Este é o que cobra.
 *
 * Uma trava de precisão: `vigenciaFim` é atualizado pelo termo aditivo de
 * prorrogação (actions/contratuais.ts), então ele é sempre o fim EFETIVO.
 * Contrato prorrogado não dispara nada — que seria o pior erro possível aqui.
 */

/** Meia-noite UTC do dia da data. As vigências são gravadas em 00:00 UTC. */
function diaUtc(d: Date): number {
  return Math.floor(d.getTime() / 86400000);
}

/**
 * Dias completos entre duas datas, contados por dia de calendário UTC.
 *
 * Fixado em UTC de propósito: a produção roda em UTC, o dev roda em BRT, e uma
 * conta que muda de resultado conforme a máquina é uma conta que não dá pra
 * testar. Com vigência gravada em 00:00 UTC, uma Ata que vale até 11/09 só
 * passa a contar 1 dia de encerrada em 12/09 — o cliente nunca é cobrado no
 * último dia em que o documento ainda está valendo.
 */
export function diasDecorridos(de: Date, ate: Date): number {
  return diaUtc(ate) - diaUtc(de);
}

export type SituacaoAtestado =
  | { estado: "VIGENTE" }
  | { estado: "ANEXADO"; quantidade: number }
  | { estado: "DISPENSADO"; em: Date; motivo: string | null }
  | { estado: "AGUARDANDO_ORGAO"; solicitadoEm: Date; diasDeEspera: number }
  | { estado: "PENDENTE"; encerradaEm: Date; diasDesdeEncerramento: number };

/** O mínimo que a função precisa saber — serve Ata e Contrato igualmente. */
export type DocumentoParaAtestado = {
  vigenciaFim: Date;
  atestadoSolicitadoEm: Date | null;
  atestadoDispensadoEm: Date | null;
  atestadoDispensaMotivo?: string | null;
  /** Quantos atestados já anexados. Aceita a lista ou só a contagem. */
  atestados?: unknown[] | number;
};

export function situacaoAtestado(
  doc: DocumentoParaAtestado,
  hoje: Date = new Date(),
): SituacaoAtestado {
  const quantidade = Array.isArray(doc.atestados)
    ? doc.atestados.length
    : typeof doc.atestados === "number"
      ? doc.atestados
      : 0;

  // Anexado vence tudo, inclusive vigência: órgão que emite antes do fim
  // (contrato de entrega única, por exemplo) já resolveu a pendência.
  if (quantidade > 0) return { estado: "ANEXADO", quantidade };

  if (doc.atestadoDispensadoEm) {
    return {
      estado: "DISPENSADO",
      em: doc.atestadoDispensadoEm,
      motivo: doc.atestadoDispensaMotivo ?? null,
    };
  }

  if (doc.atestadoSolicitadoEm) {
    return {
      estado: "AGUARDANDO_ORGAO",
      solicitadoEm: doc.atestadoSolicitadoEm,
      diasDeEspera: Math.max(0, diasDecorridos(doc.atestadoSolicitadoEm, hoje)),
    };
  }

  const diasDesdeEncerramento = diasDecorridos(doc.vigenciaFim, hoje);
  if (diasDesdeEncerramento < 1) return { estado: "VIGENTE" };

  return { estado: "PENDENTE", encerradaEm: doc.vigenciaFim, diasDesdeEncerramento };
}

/**
 * Filtro Prisma de "encerrada e devendo atestado" — o que o banner do módulo
 * conta e o que o filtro `?atestado=pendente` lista. Serve Ata e Contrato: os
 * dois têm exatamente estes campos e a relação `atestados`.
 *
 * `lt: inicioDeHojeUtc` e não `lt: agora`: com a vigência em 00:00 UTC, usar o
 * instante atual marcaria como encerrado um documento que ainda vale hoje.
 */
export function whereAtestadoPendente(hoje: Date = new Date()) {
  const inicioDeHojeUtc = new Date(diaUtc(hoje) * 86400000);
  return {
    vigenciaFim: { lt: inicioDeHojeUtc },
    atestadoSolicitadoEm: null,
    atestadoDispensadoEm: null,
    atestados: { none: {} },
  };
}

/** Já pediu ao órgão e continua sem o documento — a cobrança muda de alvo. */
export function whereAguardandoOrgao() {
  return {
    atestadoSolicitadoEm: { not: null },
    atestadoDispensadoEm: null,
    atestados: { none: {} },
  };
}

/**
 * Em que dias o WhatsApp fala sobre isso.
 *
 * Não é diário de propósito. O cliente não consegue agir todo dia sobre a
 * mesma coisa — quem depende de protocolo em órgão público mede a resposta em
 * semanas — e repetir todo dia só ensina a ignorar o resumo inteiro.
 *
 * Depois de encerrado: no dia seguinte (enquanto a execução está fresca no
 * órgão), 15, 30 e 60 dias. Passou de 60 sem ação, o alerta de WhatsApp para;
 * o banner no módulo continua lá, silencioso, até ele anexar ou dispensar.
 */
export const CADENCIA_COBRANCA_DIAS = [1, 15, 30, 60] as const;

/**
 * Depois de solicitado: 15 e 30 dias de espera. Aqui o texto é outro — quem
 * está devendo é o órgão, e o que o cliente precisa é do empurrão pra cobrar.
 */
export const CADENCIA_ESPERA_DIAS = [15, 30] as const;

export function deveAvisarHoje(situacao: SituacaoAtestado): boolean {
  if (situacao.estado === "PENDENTE") {
    return (CADENCIA_COBRANCA_DIAS as readonly number[]).includes(
      situacao.diasDesdeEncerramento,
    );
  }
  if (situacao.estado === "AGUARDANDO_ORGAO") {
    return (CADENCIA_ESPERA_DIAS as readonly number[]).includes(situacao.diasDeEspera);
  }
  return false;
}
