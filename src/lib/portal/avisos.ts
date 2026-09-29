import "server-only";
import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";
import { TOKEN_SAUDACAO } from "@/lib/saudacao";
import { contaTemAcessoConciliacao } from "@/lib/conciliacao/planoGuard";

/**
 * O que o órgão publicou, avisado ao cliente.
 *
 * Regina, 29/09/2026: *"implemente os avisos para os clientes que tiverem no
 * plano intermediário e premium."*
 *
 * Três fatos valem uma mensagem, e nenhum deles o cliente descobre sozinho
 * sem ligar para o órgão:
 *
 * 1. **O órgão registrou pagamento.** Chega antes do extrato, porque o
 *    registro no SIAFI antecede o crédito na conta.
 * 2. **Liquidou e não pagou.** O órgão reconheceu a dívida formalmente e o
 *    dinheiro não saiu. É a cobrança com prova documental — e é o que o CP
 *    System promete fazer.
 * 3. **Nota publicada e não cadastrada.** O órgão sabe de uma nota que o
 *    sistema não conhece; é trabalho já feito e não lançado.
 *
 * **Uma mensagem por empresa por rodada, nunca uma por fato.** Cliente com
 * quarenta notas novas receberia quarenta mensagens, e quarenta mensagens
 * viram silêncio — a pessoa desliga a notificação e perde também as que
 * importam. E cada fato é anunciado **uma vez na vida**, marcado em
 * `avisadoEm` na própria linha de origem.
 */

/** Dias entre liquidar e o silêncio virar cobrança. */
const DIAS_LIQUIDADO_SEM_PAGAR = 30;

/** Quantos itens listar antes de resumir em "e mais N". */
const ITENS_NA_LISTA = 5;

export type ResumoAvisosPortal = {
  empresasAvaliadas: number;
  mensagensEnviadas: number;
  pagamentosAvisados: number;
  liquidacoesAvisadas: number;
  notasAvisadas: number;
  detalhes: string[];
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });

export async function avisarNovidadesDoPortal(): Promise<ResumoAvisosPortal> {
  const r: ResumoAvisosPortal = {
    empresasAvaliadas: 0, mensagensEnviadas: 0,
    pagamentosAvisados: 0, liquidacoesAvisadas: 0, notasAvisadas: 0, detalhes: [],
  };

  const empresas = await prisma.empresa.findMany({
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      contaId: true,
      conta: {
        select: {
          plano: true,
          conciliacaoCortesiaAte: true,
          usuarios: {
            orderBy: { criadoEm: "asc" },
            select: { id: true, nome: true, telefoneWhatsApp: true, optInWhatsApp: true },
          },
        },
      },
    },
  });

  const agora = new Date();
  const limiteLiquidacao = new Date(agora.getTime() - DIAS_LIQUIDADO_SEM_PAGAR * 86400_000);

  for (const empresa of empresas) {
    if (!contaTemAcessoConciliacao(empresa.conta)) continue;
    r.empresasAvaliadas++;

    const titular = empresa.conta.usuarios.find((u) => u.telefoneWhatsApp && u.optInWhatsApp);
    if (!titular) continue;

    const [pagamentos, liquidacoes, notas] = await Promise.all([
      prisma.documentoPortal.findMany({
        where: { empresaId: empresa.id, fase: "PAGAMENTO", avisadoEm: null },
        orderBy: { data: "desc" },
        select: { id: true, data: true, valor: true, orgao: true, empenho: { select: { numero: true } } },
      }),
      // Liquidado há mais de 30 dias e sem nenhum pagamento no mesmo empenho.
      // Sem o empenho não dá para afirmar que não foi paga, então essas ficam
      // de fora — acusar atraso que não existe queima a confiança no aviso.
      prisma.documentoPortal.findMany({
        where: {
          empresaId: empresa.id,
          fase: "LIQUIDACAO",
          avisadoEm: null,
          data: { lte: limiteLiquidacao },
          codigoEmpenhoPortal: { not: null },
        },
        orderBy: { data: "asc" },
        select: { id: true, data: true, valor: true, orgao: true, codigoEmpenhoPortal: true },
      }),
      prisma.notaFiscalPortal.findMany({
        where: { empresaId: empresa.id, avisadoEm: null, notaFiscalId: null },
        orderBy: { dataEmissao: "desc" },
        select: { id: true, numero: true, serie: true, valor: true, dataEmissao: true, orgaoDestinatario: true },
      }),
    ]);

    const pagosPorEmpenho = new Set(
      (
        await prisma.documentoPortal.findMany({
          where: { empresaId: empresa.id, fase: "PAGAMENTO", codigoEmpenhoPortal: { not: null } },
          select: { codigoEmpenhoPortal: true },
        })
      ).map((p) => p.codigoEmpenhoPortal!),
    );
    const semPagamento = liquidacoes.filter((l) => !pagosPorEmpenho.has(l.codigoEmpenhoPortal!));

    if (pagamentos.length === 0 && semPagamento.length === 0 && notas.length === 0) continue;

    const nome = empresa.nomeFantasia || empresa.razaoSocial;
    const texto = montarMensagem({
      primeiroNome: titular.nome.split(" ")[0] || titular.nome,
      empresa: nome,
      pagamentos,
      liquidacoesParadas: semPagamento,
      notas,
    });

    const enviou = await dispararNotificacao({
      usuarioId: titular.id,
      tipo: "PORTAL_TRANSPARENCIA",
      // Uma mensagem por empresa por dia. Se a rodada repetir, a chave
      // impede o segundo disparo em vez de confiar em quem chama.
      referenciaId: `portal-${empresa.id}-${agora.toISOString().slice(0, 10)}`,
      mensagem: texto,
    }).catch(() => ({ enviado: false }));

    if (!enviou.enviado) {
      r.detalhes.push(`${nome}: não enviou`);
      continue;
    }

    // Só marca depois de o envio dar certo. Marcar antes transformaria uma
    // falha de rede em fato perdido para sempre.
    const marca = new Date();
    await Promise.all([
      pagamentos.length
        ? prisma.documentoPortal.updateMany({ where: { id: { in: pagamentos.map((p) => p.id) } }, data: { avisadoEm: marca } })
        : null,
      semPagamento.length
        ? prisma.documentoPortal.updateMany({ where: { id: { in: semPagamento.map((l) => l.id) } }, data: { avisadoEm: marca } })
        : null,
      notas.length
        ? prisma.notaFiscalPortal.updateMany({ where: { id: { in: notas.map((n) => n.id) } }, data: { avisadoEm: marca } })
        : null,
    ]);

    r.mensagensEnviadas++;
    r.pagamentosAvisados += pagamentos.length;
    r.liquidacoesAvisadas += semPagamento.length;
    r.notasAvisadas += notas.length;
    r.detalhes.push(
      `${nome}: ${pagamentos.length} pagamento(s), ${semPagamento.length} liquidação(ões) parada(s), ${notas.length} nota(s)`,
    );
  }

  return r;
}

function montarMensagem(o: {
  primeiroNome: string;
  empresa: string;
  pagamentos: { data: Date; valor: number; orgao: string | null; empenho: { numero: string } | null }[];
  liquidacoesParadas: { data: Date; valor: number; orgao: string | null }[];
  notas: { numero: string; serie: string | null; valor: number; dataEmissao: Date; orgaoDestinatario: string | null }[];
}): string {
  const blocos: string[] = [];

  if (o.pagamentos.length > 0) {
    const total = o.pagamentos.reduce((s, p) => s + p.valor, 0);
    const linhas = o.pagamentos.slice(0, ITENS_NA_LISTA).map((p) => {
      const ref = p.empenho ? ` · empenho ${p.empenho.numero}` : "";
      return `   ▫ ${dia(p.data)} — ${brl(p.valor)} — ${p.orgao ?? "órgão não informado"}${ref}`;
    });
    const resto = o.pagamentos.length - linhas.length;
    blocos.push(
      `💰 *O órgão registrou pagamento*\n` +
      `${o.pagamentos.length === 1 ? "Um pagamento" : `${o.pagamentos.length} pagamentos`}, somando *${brl(total)}*:\n` +
      linhas.join("\n") +
      (resto > 0 ? `\n   ▫ e mais ${resto}` : "") +
      `\n\nVale conferir se já caiu na conta.`,
    );
  }

  if (o.liquidacoesParadas.length > 0) {
    const total = o.liquidacoesParadas.reduce((s, l) => s + l.valor, 0);
    const linhas = o.liquidacoesParadas.slice(0, ITENS_NA_LISTA).map((l) => {
      const dias = Math.floor((Date.now() - l.data.getTime()) / 86400_000);
      return `   ▫ ${dia(l.data)} (há ${dias} dias) — ${brl(l.valor)} — ${l.orgao ?? "órgão não informado"}`;
    });
    const resto = o.liquidacoesParadas.length - linhas.length;
    blocos.push(
      `⏳ *Liquidado e ainda não pago*\n` +
      `O órgão reconheceu formalmente a dívida há mais de ${DIAS_LIQUIDADO_SEM_PAGAR} dias e o pagamento não foi registrado — *${brl(total)}* no total:\n` +
      linhas.join("\n") +
      (resto > 0 ? `\n   ▫ e mais ${resto}` : "") +
      `\n\nÉ cobrança com documento na mão: a liquidação está publicada no Portal da Transparência.`,
    );
  }

  if (o.notas.length > 0) {
    const total = o.notas.reduce((s, n) => s + n.valor, 0);
    const linhas = o.notas.slice(0, ITENS_NA_LISTA).map(
      (n) => `   ▫ NF ${n.numero}${n.serie ? `/${n.serie}` : ""} — ${dia(n.dataEmissao)} — ${brl(n.valor)} — ${n.orgaoDestinatario ?? "—"}`,
    );
    const resto = o.notas.length - linhas.length;
    blocos.push(
      `📄 *Notas suas que não estão cadastradas aqui*\n` +
      `O órgão publicou ${o.notas.length === 1 ? "uma nota" : `${o.notas.length} notas`} de *${o.empresa}*, somando *${brl(total)}*, que não encontramos no sistema:\n` +
      linhas.join("\n") +
      (resto > 0 ? `\n   ▫ e mais ${resto}` : "") +
      `\n\nCadastrando, elas entram no controle de prazo e de recebimento.`,
    );
  }

  return (
    `${TOKEN_SAUDACAO}, ${o.primeiroNome}!\n\n` +
    `Novidades do *Portal da Transparência* sobre *${o.empresa}*:\n\n` +
    blocos.join("\n\n") +
    `\n\nOs detalhes estão em *Conciliação bancária → Conferência pelo órgão*, no sistema.\n\n` +
    `Contato CP System`
  );
}
