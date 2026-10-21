import "server-only";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";
import type { ConfigNotaFiscal } from "@/lib/gateway/types";

/**
 * Nota fiscal da mensalidade, para todo cliente, sem ninguém pedir.
 *
 * Regina, 17/10/2026: *"resolva para que as notas fiscais estejam no sistema
 * e também sejam enviadas para o cliente de forma automática."* E em 21/10,
 * com razão: *"por que cargas d'água você ainda não resolveu o envio da
 * nota? Resolve essa situação."*
 *
 * O que estava quebrado era mais simples e mais grave do que parecia: **o
 * sistema nunca pedia a emissão**. Ele sabia criar cobrança, assinatura e PIX,
 * recebia o webhook da nota e mandava o PDF ao cliente — mas a nota em si só
 * nascia quando alguém entrava no painel do Asaas e emitia à mão. Foi assim
 * com as notas 3 e 4 do primeiro cliente, e foi assim que a C2Vendas pagou
 * outubro e ficou sem nota.
 *
 * Dois caminhos, que se cobrem:
 *
 * 1. **Automático no provedor**: cada assinatura recebe a configuração de
 *    emissão (`invoiceSettings`). A cada pagamento confirmado o Asaas emite,
 *    o webhook `INVOICE_AUTHORIZED` chega, e o PDF segue ao cliente pelo
 *    caminho que já existe.
 * 2. **Varredura diária**: toda mensalidade PAGA sem nota é conferida no
 *    Asaas e, se não houver nota lá, a emissão é pedida. Cobre o que o
 *    caminho 1 perdeu — assinatura criada antes da configuração, pagamento
 *    anterior a hoje, configuração removida no painel.
 *
 * **De onde vêm os dados fiscais:** de uma assinatura já configurada no
 * painel ou, na falta dela, da última nota que a prefeitura AUTORIZOU. Nenhuma
 * alíquota mora no código — fixar alíquota aqui seria assinar documento
 * fiscal por conta própria. O molde é o que já foi aceito.
 */

export type ResumoNotaAutomatica = {
  assinaturas: number;
  jaTinham: number;
  configuradas: number;
  semMolde: boolean;
  falhas: string[];
};

export type ResumoEmissaoPendentes = {
  verificadas: number;
  jaTinhamNota: number;
  emitidas: Array<{ cobrancaId: string; paymentId: string; invoiceId: string; status: string }>;
  pendentes: Array<{ cobrancaId: string; paymentId: string; competencia: string; valor: number; empresa: string }>;
  semMolde: boolean;
  falhas: string[];
};

export type Molde = {
  molde: ConfigNotaFiscal | null;
  /** Assinatura de onde o molde foi lido, se foi de uma assinatura. */
  vindoDe: string | null;
  /** Texto legível: "assinatura sub_x" ou "nota 4 (inv_y)". */
  origem: string | null;
};

/**
 * Procura o molde: primeiro numa assinatura que já tenha emissão ligada,
 * depois na última nota autorizada pela prefeitura.
 */
export async function moldeDeNotaFiscal(): Promise<Molde> {
  const gw = await getGateway();
  const vazio: Molde = { molde: null, vindoDe: null, origem: null };

  // A nota autorizada vem primeiro: nela o nome do serviço é o texto curto
  // que a prefeitura aceitou. A configuração da assinatura devolve o nome
  // oficial completo, que passa dos 120 caracteres que o Asaas aceita (erro
  // de 21/10). A configuração fica como segunda opção.
  if (gw.ultimaNotaAutorizada) {
    const nota = await gw.ultimaNotaAutorizada().catch(() => null);
    if (nota) {
      const { invoiceId, numero, ...molde } = nota;
      return { molde, vindoDe: null, origem: `nota ${numero ?? "?"} (${invoiceId})` };
    }
  }

  if (gw.lerConfigNotaFiscal) {
    const contas = await prisma.conta.findMany({
      where: { gatewaySubscriptionId: { not: null } },
      select: { gatewaySubscriptionId: true },
    });
    for (const c of contas) {
      const cfg = await gw.lerConfigNotaFiscal(c.gatewaySubscriptionId!).catch(() => null);
      // Molde válido é o que diz QUAL serviço municipal está sendo prestado —
      // sem isso a prefeitura recusa a nota.
      if (cfg && (cfg.municipalServiceId || cfg.municipalServiceCode)) {
        return { molde: cfg, vindoDe: c.gatewaySubscriptionId, origem: `assinatura ${c.gatewaySubscriptionId}` };
      }
    }
  }

  return vazio;
}

/**
 * Garante a emissão automática numa assinatura só.
 *
 * Chamado quando a assinatura nasce. Silencioso de propósito: se não houver
 * molde ainda, a assinatura é criada do mesmo jeito e a varredura diária pega
 * depois. Cliente não pode ficar sem assinar porque a nota não pôde ser
 * configurada.
 */
export async function garantirNotaFiscalAutomatica(
  subscriptionId: string,
  moldePronto?: ConfigNotaFiscal | null,
): Promise<boolean> {
  const gw = await getGateway();
  if (!gw.configurarNotaFiscal || !gw.lerConfigNotaFiscal) return false;

  const jaTem = await gw.lerConfigNotaFiscal(subscriptionId).catch(() => null);
  if (jaTem && (jaTem.municipalServiceId || jaTem.municipalServiceCode)) return true;

  const molde = moldePronto ?? (await moldeDeNotaFiscal()).molde;
  if (!molde) return false;

  await gw.configurarNotaFiscal(subscriptionId, molde);
  return true;
}

/**
 * Passa por todas as assinaturas ativas e liga o que estiver faltando.
 */
export async function ligarNotaFiscalEmTodas(moldePronto?: Molde): Promise<ResumoNotaAutomatica> {
  const r: ResumoNotaAutomatica = {
    assinaturas: 0, jaTinham: 0, configuradas: 0, semMolde: false, falhas: [],
  };

  const gw = await getGateway();
  if (!gw.configurarNotaFiscal || !gw.lerConfigNotaFiscal) return r;

  const { molde, vindoDe } = moldePronto ?? (await moldeDeNotaFiscal());
  if (!molde) {
    r.semMolde = true;
    return r;
  }

  const contas = await prisma.conta.findMany({
    where: { gatewaySubscriptionId: { not: null }, statusAssinatura: { not: "CANCELADA" } },
    select: { id: true, gatewaySubscriptionId: true },
  });
  r.assinaturas = contas.length;

  for (const c of contas) {
    const id = c.gatewaySubscriptionId!;
    if (id === vindoDe) {
      r.jaTinham++;
      continue;
    }
    try {
      const jaTem = await gw.lerConfigNotaFiscal(id);
      if (jaTem && (jaTem.municipalServiceId || jaTem.municipalServiceCode)) {
        r.jaTinham++;
        continue;
      }
      await gw.configurarNotaFiscal(id, molde);
      r.configuradas++;
    } catch (e) {
      r.falhas.push(`${id}: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  return r;
}

/** Descrição do serviço na nota: o texto que a prefeitura já aceitou + o que o cliente precisa achar depois. */
function descricaoDaNota(molde: ConfigNotaFiscal, plano: string, competencia: string): string {
  const base = molde.serviceDescription || molde.municipalServiceName || "Licenciamento de uso de programa de computacao";
  // Sem acento e sem travessão de propósito: é o formato das notas já
  // autorizadas, e nem toda prefeitura aceita caractere fora do ASCII.
  // Plano e competência vêm primeiro: o Asaas limita a descrição a 120
  // caracteres, e o que não pode ser cortado é o que identifica a
  // mensalidade na contabilidade do cliente.
  return `CP System, plano ${plano}, competencia ${competencia} - ${base}`.slice(0, 120);
}

/**
 * Mensalidades pagas que estão sem nota — e, se `aplicar`, emite.
 *
 * Só mexe em cobrança do CP System (tabela `Cobranca`, conta com assinatura no
 * gateway). O Asaas da empresa também recebe PIX avulso de outras origens, e
 * isso aqui não chega perto deles.
 */
export async function emitirNotasPendentes(opts: { aplicar: boolean; moldePronto?: Molde }): Promise<ResumoEmissaoPendentes> {
  const r: ResumoEmissaoPendentes = {
    verificadas: 0, jaTinhamNota: 0, emitidas: [], pendentes: [], semMolde: false, falhas: [],
  };

  const gw = await getGateway();
  if (!gw.notasDoPagamento || !gw.emitirNota) return r;

  // Últimos 120 dias: o que é mais velho que isso já foi tratado à mão ou
  // pertence a um ciclo em que a nota não era exigência — não se emite nota
  // retroativa de surpresa.
  const desde = new Date(Date.now() - 120 * 86400_000);
  const cobrancas = await prisma.cobranca.findMany({
    where: {
      status: "PAGA",
      nfseId: null,
      gatewayChargeId: { not: null },
      pagaEm: { gte: desde },
      conta: { gatewaySubscriptionId: { not: null } },
    },
    select: {
      id: true, gatewayChargeId: true, valor: true, plano: true, competencia: true,
      conta: { select: { empresas: { select: { razaoSocial: true }, take: 1 } } },
    },
    orderBy: { pagaEm: "asc" },
  });
  r.verificadas = cobrancas.length;
  if (!cobrancas.length) return r;

  const { molde } = opts.moldePronto ?? (await moldeDeNotaFiscal());
  if (!molde) r.semMolde = true;

  for (const cb of cobrancas) {
    const paymentId = cb.gatewayChargeId!;
    const empresa = cb.conta.empresas[0]?.razaoSocial ?? "?";
    try {
      const notas = await gw.notasDoPagamento(paymentId);
      // Nota cancelada ou com erro não conta como "já tem": a cobrança segue
      // sem nota válida e precisa de outra.
      const valida = notas.find((n) => !["CANCELED", "ERROR", "CANCELLATION_DENIED"].includes(n.status));
      if (valida) {
        r.jaTinhamNota++;
        continue;
      }
      r.pendentes.push({ cobrancaId: cb.id, paymentId, competencia: cb.competencia, valor: Number(cb.valor), empresa });
      if (!opts.aplicar || !molde) continue;

      const nota = await gw.emitirNota({
        paymentId,
        valor: Number(cb.valor),
        descricao: descricaoDaNota(molde, cb.plano, cb.competencia),
        molde,
      });
      // Registra já o id: o webhook completa número, status e PDF quando a
      // prefeitura autorizar. Sem isso a varredura de amanhã pediria outra.
      await prisma.cobranca.update({
        where: { id: cb.id },
        data: { nfseId: nota.invoiceId, nfseStatus: nota.status },
      });
      r.emitidas.push({ cobrancaId: cb.id, paymentId, invoiceId: nota.invoiceId, status: nota.status });
    } catch (e) {
      r.falhas.push(`${empresa} ${cb.competencia} (${paymentId}): ${(e as Error).message.slice(0, 160)}`);
    }
  }

  return r;
}

export type ResumoSincronizacao = {
  verificadas: number;
  enviadas: Array<{ cobrancaId: string; invoiceId: string; numero: string | null }>;
  aguardando: number;
  comProblema: Array<{ cobrancaId: string; invoiceId: string; status: string }>;
  falhas: string[];
};

/**
 * Fecha o ciclo das notas emitidas cujo PDF nunca chegou ao cliente.
 *
 * O caminho normal é o webhook `INVOICE_AUTHORIZED` → `processarNfseGateway`
 * → PDF por WhatsApp e e-mail. Mas o webhook já foi interrompido pelo Asaas
 * uma vez (julho) e já ficou dois dias sem chegar (queda de outubro). Regina,
 * 21/10: *"garanta que tem que ser automático o envio para os clientes e eu
 * não tenho que lembrar isso toda vez."* Então, todo dia, cada nota nossa
 * sem PDF é consultada no Asaas e, se já estiver autorizada, o envio é feito
 * por aqui — pelo mesmo `processarNfseGateway`, que é idempotente no WhatsApp
 * (chave por nota) e só roda uma vez porque grava o PDF na cobrança.
 *
 * Janela de 20 dias: nota mais velha que isso já foi tratada à mão, e mandar
 * de novo uma nota antiga é confundir o cliente, não ajudar.
 */
export async function sincronizarNotasSemPdf(): Promise<ResumoSincronizacao> {
  const r: ResumoSincronizacao = { verificadas: 0, enviadas: [], aguardando: 0, comProblema: [], falhas: [] };
  const gw = await getGateway();
  if (!gw.consultarNota) return r;

  const desde = new Date(Date.now() - 20 * 86400_000);
  const semPdf = await prisma.cobranca.findMany({
    where: {
      nfseId: { not: null },
      nfsePdfUrl: null,
      gatewayChargeId: { not: null },
      pagaEm: { gte: desde },
    },
    select: { id: true, nfseId: true, gatewayChargeId: true },
  });
  r.verificadas = semPdf.length;
  if (!semPdf.length) return r;

  const { processarNfseGateway } = await import("@/app/actions/assinatura");
  for (const cb of semPdf) {
    try {
      const nota = await gw.consultarNota(cb.nfseId!);
      if (!nota) {
        r.falhas.push(`${cb.id}: nota ${cb.nfseId} não encontrada no Asaas`);
        continue;
      }
      if (nota.status === "AUTHORIZED" && nota.pdfUrl) {
        await processarNfseGateway({
          paymentId: cb.gatewayChargeId!,
          nfseId: nota.id,
          numero: nota.numero ?? undefined,
          status: nota.status,
          pdfUrl: nota.pdfUrl,
          xmlUrl: nota.xmlUrl ?? undefined,
          emitidaEm: nota.emitidaEm ?? undefined,
        });
        r.enviadas.push({ cobrancaId: cb.id, invoiceId: nota.id, numero: nota.numero });
      } else if (["CANCELED", "ERROR", "CANCELLATION_DENIED"].includes(nota.status)) {
        await prisma.cobranca.update({ where: { id: cb.id }, data: { nfseStatus: nota.status } });
        r.comProblema.push({ cobrancaId: cb.id, invoiceId: nota.id, status: nota.status });
      } else {
        // SCHEDULED / SYNCHRONIZED: a prefeitura ainda não respondeu. Amanhã
        // de novo.
        if (nota.status) await prisma.cobranca.update({ where: { id: cb.id }, data: { nfseStatus: nota.status } });
        r.aguardando++;
      }
    } catch (e) {
      r.falhas.push(`${cb.id}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return r;
}

/**
 * O que roda todo dia na régua: liga a emissão em quem não tem, emite o que
 * ficou para trás e entrega o PDF do que já foi autorizado. Devolve um resumo
 * para o cron registrar.
 */
export async function rotinaNotaFiscalDiaria(): Promise<{
  molde: string | null;
  assinaturas: ResumoNotaAutomatica;
  pendentes: ResumoEmissaoPendentes;
  sincronizacao: ResumoSincronizacao;
}> {
  const molde = await moldeDeNotaFiscal();
  const assinaturas = await ligarNotaFiscalEmTodas(molde);
  const pendentes = await emitirNotasPendentes({ aplicar: true, moldePronto: molde });
  const sincronizacao = await sincronizarNotasSemPdf();
  return { molde: molde.origem, assinaturas, pendentes, sincronizacao };
}
