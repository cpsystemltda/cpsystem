import "server-only";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";
import { dispararNotificacao } from "@/lib/whatsapp";
import { avisarEquipe } from "@/lib/alertaInterno";

/**
 * O cartão da assinatura — quando falha e quando some.
 *
 * O caso que ensinou isto: em agosto o banco recusou o cartão do primeiro
 * cliente quatro vezes; o Asaas avisou as quatro (`PAYMENT_CREDIT_CARD_
 * CAPTURE_REFUSED`) e o sistema guardou os avisos sem fazer nada com eles.
 * Depois o cartão sumiu da assinatura, as cobranças seguintes nasceram sem
 * cartão, e ninguém — nem o cliente, nem a equipe — ficou sabendo até a fatura
 * vencer. Regina, 21/10: *"eu não tenho que lembrar isso toda vez, nem as
 * cobranças."*
 *
 * Duas respostas, uma para cada momento:
 * - `avisarCartaoRecusado`: no instante da recusa, o cliente recebe o caminho
 *   (PIX ou atualizar o cartão) e a equipe recebe o aviso. Uma vez por
 *   cobrança, por mais que o Asaas tente de novo.
 * - `conferirCartoesDasAssinaturas`: todo dia, cada assinatura de cartão é
 *   consultada no Asaas; sem cartão preso, o cliente é orientado (uma vez por
 *   mês, e nunca em cima de outro aviso de cobrança recente) e a equipe fica
 *   sabendo sempre.
 */

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const primeiroNome = (nome: string) => nome.split(" ")[0] || nome;

async function destinatarios(contaId: string) {
  return prisma.usuario.findMany({
    where: { contaId, acessoRestrito: false },
    select: { id: true, nome: true },
  });
}

async function nomeDaConta(contaId: string): Promise<string> {
  const e = await prisma.empresa.findFirst({ where: { contaId }, select: { nomeFantasia: true, razaoSocial: true } });
  return e?.nomeFantasia ?? e?.razaoSocial ?? contaId;
}

export async function avisarCartaoRecusado(opts: {
  chargeId: string;
  customerId?: string;
  subscriptionId?: string;
  valor?: number;
  vencimento?: Date;
}): Promise<{ clienteAvisado: boolean }> {
  const cobranca = await prisma.cobranca.findFirst({
    where: { gatewayChargeId: opts.chargeId },
    select: { contaId: true, valor: true, vencimento: true },
  });
  const conta =
    cobranca
      ? { id: cobranca.contaId }
      : await prisma.conta.findFirst({
          where: {
            OR: [
              ...(opts.subscriptionId ? [{ gatewaySubscriptionId: opts.subscriptionId }] : []),
              ...(opts.customerId ? [{ gatewayCustomerId: opts.customerId }] : []),
            ],
          },
          select: { id: true },
        });
  if (!conta) return { clienteAvisado: false };

  const valor = Number(cobranca?.valor ?? opts.valor ?? 0);
  const venc = cobranca?.vencimento ?? opts.vencimento ?? null;
  const vencBr = venc ? venc.toLocaleDateString("pt-BR") : "o vencimento";
  const empresa = await nomeDaConta(conta.id);

  let clienteAvisado = false;
  for (const u of await destinatarios(conta.id)) {
    const r = await dispararNotificacao({
      usuarioId: u.id,
      tipo: "VENCIMENTO_PLANO",
      referenciaId: `cartao-recusado-${opts.chargeId}`,
      mensagem:
        `💳 *Não foi possível debitar a mensalidade no cartão*\n\n` +
        `${primeiroNome(u.nome)}, a operadora não autorizou o débito da mensalidade do CP System` +
        `${valor ? ` de *${brl(valor)}*` : ""}, com vencimento em ${vencBr}.\n\n` +
        `Para manter o acesso sem interrupção, há dois caminhos:\n` +
        `• Pagar por PIX, com confirmação automática, em Conta › Assinatura;\n` +
        `• Ou atualizar o cartão na mesma tela, para que o débito automático volte a funcionar.\n\n` +
        `https://cpsystem.app.br/conta/assinatura\n\n` +
        `Em caso de dúvida, responda a esta mensagem.`,
    });
    if (r.enviado) clienteAvisado = true;
  }

  await avisarEquipe(
    `💳 *Cartão recusado — ${empresa}*\n\n` +
      `A operadora recusou o débito da mensalidade${valor ? ` de ${brl(valor)}` : ""} (vencimento ${vencBr}).\n` +
      (clienteAvisado
        ? `O cliente recebeu a orientação de pagar por PIX ou atualizar o cartão.`
        : `O cliente NÃO pôde ser avisado por WhatsApp (sem telefone ou sem opt-in) — precisa de contato manual.`),
  ).catch(() => {});

  return { clienteAvisado };
}

export type ResumoCartoes = {
  verificadas: number;
  semCartao: Array<{ empresa: string; assinatura: string; clienteAvisado: boolean }>;
  falhas: string[];
};

export async function conferirCartoesDasAssinaturas(): Promise<ResumoCartoes> {
  const r: ResumoCartoes = { verificadas: 0, semCartao: [], falhas: [] };
  const gw = await getGateway();
  if (!gw.consultarAssinatura) return r;

  const contas = await prisma.conta.findMany({
    where: { gatewaySubscriptionId: { not: null }, statusAssinatura: { not: "CANCELADA" } },
    select: { id: true, gatewaySubscriptionId: true },
  });

  const mes = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);
  const ha7dias = new Date(Date.now() - 7 * 86400_000);

  for (const c of contas) {
    const subId = c.gatewaySubscriptionId!;
    try {
      const sub = await gw.consultarAssinatura(subId);
      if (!sub) {
        r.falhas.push(`${subId}: assinatura não encontrada no gateway`);
        continue;
      }
      r.verificadas++;
      if (sub.billingType !== "CREDIT_CARD" || sub.temCartao || sub.status !== "ACTIVE") continue;

      const empresa = await nomeDaConta(c.id);
      let clienteAvisado = false;
      for (const u of await destinatarios(c.id)) {
        // Quem acabou de receber um aviso de cobrança não recebe outro em cima:
        // a orientação do cartão já está lá, ou vai amanhã.
        const recente = await prisma.notificacaoWhatsApp.count({
          where: {
            usuarioId: u.id,
            tipo: { in: ["VENCIMENTO_PLANO", "PLANO_ATRASADO", "CARTAO_EXPIRANDO"] },
            criadoEm: { gte: ha7dias },
          },
        });
        if (recente > 0) continue;
        const res = await dispararNotificacao({
          usuarioId: u.id,
          tipo: "CARTAO_EXPIRANDO",
          referenciaId: `sem-cartao-${subId}-${mes}`,
          mensagem:
            `💳 *Sua assinatura está sem cartão cadastrado*\n\n` +
            `${primeiroNome(u.nome)}, a assinatura do CP System está configurada para débito automático, ` +
            `mas não há cartão vinculado a ela no momento. Sem o cartão, a mensalidade não é debitada ` +
            `e a fatura fica aguardando pagamento.\n\n` +
            `Para regularizar, basta cadastrar o cartão em Conta › Assinatura:\n` +
            `https://cpsystem.app.br/conta/assinatura\n\n` +
            `Se preferir pagar por PIX a cada mês, a mesma tela oferece essa opção.`,
        });
        if (res.enviado) clienteAvisado = true;
      }
      r.semCartao.push({ empresa, assinatura: subId, clienteAvisado });
    } catch (e) {
      r.falhas.push(`${subId}: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  return r;
}
