"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { getGateway, type FormaPagamento, type Plano } from "@/lib/gateway";
import { calcularValorMensal } from "@/lib/precos";
import { normalizarCnpj } from "@/lib/validators";

type Result = { erro?: string; ok?: boolean; cobrancaId?: string };

// Garante customerId no gateway pra esta conta
export async function garantirCustomer(contaId: string) {
  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    include: {
      empresas: { take: 1 },
      usuarios: { take: 1 },
    },
  });
  if (!conta) throw new Error("Conta não encontrada.");

  if (conta.gatewayCustomerId) return { conta, customerId: conta.gatewayCustomerId };

  const empresa = conta.empresas[0];
  const usuario = conta.usuarios[0];
  if (!empresa || !usuario) throw new Error("Cadastre uma empresa antes de assinar.");

  const gateway = await getGateway();
  const { customerId } = await gateway.criarCliente({
    contaId,
    nome: empresa.razaoSocial,
    email: usuario.email,
    cpfCnpj: normalizarCnpj(empresa.cnpj),
    telefone: empresa.telefones,
    endereco: empresa.endereco,
  });

  const atualizada = await prisma.conta.update({
    where: { id: contaId },
    data: { gatewayCustomerId: customerId, gatewayProvider: gateway.nome },
  });

  return { conta: atualizada, customerId };
}

export async function iniciarCheckoutAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins podem alterar a assinatura." };

  const plano = String(formData.get("plano") || "BASICO") as Plano;
  const forma = String(formData.get("forma") || "PIX") as FormaPagamento;
  if (!["BASICO", "PREMIUM"].includes(plano)) return { erro: "Plano inválido." };
  if (!["PIX", "BOLETO", "CARTAO_CREDITO"].includes(forma)) return { erro: "Forma de pagamento inválida." };

  // Calcula valor dinamico: BASICO = R$ 397 + R$ 39,90 por CNPJ acima de 1.
  // PREMIUM ja tem CNPJs ilimitados, sem adicional. Regina 23/06.
  const breakdown = await calcularValorMensal(usuario.contaId, plano);
  const valor = breakdown.valorTotal;
  const competencia = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const vencimento = new Date(Date.now() + 3 * 86400000); // 3 dias

  try {
    const { customerId } = await garantirCustomer(usuario.contaId);

    const cobrancaInterna = await prisma.cobranca.create({
      data: {
        contaId: usuario.contaId,
        competencia,
        plano,
        forma,
        valor,
        vencimento,
        status: "PENDENTE",
      },
    });

    const gateway = await getGateway();
    const cartao =
      forma === "CARTAO_CREDITO"
        ? {
            numero: String(formData.get("cartaoNumero") || "").replace(/\s/g, ""),
            nome: String(formData.get("cartaoNome") || ""),
            validadeMes: Number(formData.get("cartaoValidadeMes") || 0),
            validadeAno: Number(formData.get("cartaoValidadeAno") || 0),
            cvv: String(formData.get("cartaoCvv") || ""),
          }
        : undefined;

    const descricao =
      breakdown.cnpjsAdicionais > 0
        ? `CP System — Plano ${plano} (${competencia}) · ${breakdown.numCnpjs} CNPJs (${breakdown.cnpjsAdicionais} adicional)`
        : `CP System — Plano ${plano} (${competencia})`;

    let result: import("@/lib/gateway").CriarCobrancaResultado;
    let subscriptionId: string | null = null;

    if (forma === "CARTAO_CREDITO" && cartao && gateway.criarAssinatura) {
      // Cartão: cria Subscription Asaas pra cobrança recorrente automática.
      // Asaas tokeniza o cartão e cobra todo mês. Regina 23/06.
      const conta = await prisma.conta.findUnique({
        where: { id: usuario.contaId },
        include: { empresas: { take: 1 } },
      });
      const empresa = conta?.empresas[0];
      if (!empresa) return { erro: "Cadastre uma empresa antes de assinar com cartão." };

      const sub = await gateway.criarAssinatura({
        customerId,
        cobrancaIdInterno: cobrancaInterna.id,
        valor,
        proximoVencimento: vencimento,
        descricao,
        cartao,
        titular: {
          nome: empresa.razaoSocial,
          email: usuario.email,
          cpfCnpj: empresa.cnpj,
          telefone: empresa.telefones || undefined,
          cep: empresa.cep || undefined,
          // Asaas exige número do endereço — extrai do campo endereco ou usa S/N
          numeroEndereco:
            empresa.endereco.match(/,\s*(\d+[A-Za-z]?)\b/)?.[1] || "S/N",
        },
      });

      subscriptionId = sub.subscriptionId;
      result = sub.primeiraCobranca;
    } else {
      // PIX/Boleto: cobrança única (renovação automática gera próximas via régua).
      result = await gateway.criarCobranca({
        customerId,
        cobrancaIdInterno: cobrancaInterna.id,
        valor,
        vencimento,
        forma,
        descricao,
        cartao,
      });
    }

    const cobrancaAtualizada = await prisma.cobranca.update({
      where: { id: cobrancaInterna.id },
      data: {
        gatewayChargeId: result.chargeId,
        gatewayInvoiceUrl: result.invoiceUrl || null,
        pixQrCode: result.pixQrCode || null,
        pixCopiaCola: result.pixCopiaCola || null,
        boletoUrl: result.boletoUrl || null,
        status: result.status,
      },
    });

    // Salva subscription ID na conta (Asaas vai cuidar das próximas cobranças)
    if (subscriptionId) {
      await prisma.conta.update({
        where: { id: usuario.contaId },
        data: { gatewaySubscriptionId: subscriptionId },
      });
    }

    // Salva últimos dígitos do cartão (PCI-DSS: nunca o PAN inteiro)
    if (cartao) {
      const ultimos = cartao.numero.slice(-4);
      const bandeira = detectarBandeira(cartao.numero);
      await prisma.metodoPagamento.create({
        data: {
          contaId: usuario.contaId,
          forma: "CARTAO_CREDITO",
          apelido: `${bandeira} final ${ultimos}`,
          bandeira,
          ultimosDigitos: ultimos,
          validadeMes: cartao.validadeMes,
          validadeAno: cartao.validadeAno,
          padrao: true,
        },
      });
    }

    // Se já foi paga (cartão aprovado), atualiza status da conta
    if (cobrancaAtualizada.status === "PAGA") {
      await ativarPlano(usuario.contaId, plano);
    }

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Cobranca",
      recursoId: cobrancaAtualizada.id,
      resumo: `${forma} R$ ${valor} ${plano} → ${cobrancaAtualizada.status}`,
    });

    revalidatePath("/conta/assinatura");
    return { ok: true, cobrancaId: cobrancaAtualizada.id };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro no checkout." };
  }
}

export async function cancelarAssinaturaAction(_p: Result | null, _formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins." };

  // Busca subscription antes de zerar
  const contaAtual = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    select: { gatewaySubscriptionId: true },
  });

  await prisma.conta.update({
    where: { id: usuario.contaId },
    data: {
      statusAssinatura: "CANCELADA",
      proximoVencimento: null,
      bloqueadoEm: new Date(),
      gatewaySubscriptionId: null,
    },
  });

  const gateway = await getGateway();

  // Cancela Subscription no Asaas (se houver) — pra não cobrar próximas mensalidades
  if (contaAtual?.gatewaySubscriptionId && gateway.cancelarAssinatura) {
    try {
      await gateway.cancelarAssinatura(contaAtual.gatewaySubscriptionId);
    } catch (e) {
      console.error("Erro cancelando subscription Asaas:", e);
      // segue — a conta já foi marcada CANCELADA no nosso lado
    }
  }

  // Cancela cobranças pendentes no gateway
  const pendentes = await prisma.cobranca.findMany({
    where: { contaId: usuario.contaId, status: "PENDENTE" },
  });
  for (const c of pendentes) {
    if (c.gatewayChargeId) {
      try {
        await gateway.cancelarCobranca(c.gatewayChargeId);
      } catch {
        // segue
      }
      await prisma.cobranca.update({ where: { id: c.id }, data: { status: "CANCELADA" } });
    }
  }

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Assinatura",
    resumo: "Cancelada pelo cliente",
  });

  revalidatePath("/conta/assinatura");
  redirect("/conta/assinatura");
}

// Marcar plano como ativo após confirmação de pagamento
export async function ativarPlano(contaId: string, plano: Plano) {
  await bloquearEspionagem();
  const proximo = new Date();
  proximo.setMonth(proximo.getMonth() + 1);
  await prisma.conta.update({
    where: { id: contaId },
    data: {
      plano,
      statusAssinatura: "ATIVA",
      proximoVencimento: proximo,
      bloqueadoEm: null,
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/conta/assinatura");
}

// Régua de cobrança — disparo manual pelo admin (também roda automaticamente via Vercel Cron).
// A lógica fica em `@/lib/regua` para ser reutilizada pelo endpoint /api/cron/regua-cobranca.
export async function executarReguaCobrancaAction(_p: Result | null, _formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  // Régua de cobrança roda em TODAS as contas da plataforma — só super
  // admin (Regina/Igor). Antes era `perfil === "ADMIN"` (perfil interno
  // da empresa-cliente), que vazava o gatilho para qualquer ADMIN.
  if (!usuario.superAdmin) return { erro: "Apenas administradores da plataforma." };
  const { executarRegua } = await import("@/lib/regua");
  await executarRegua();
  return { ok: true };
}

// Webhook → confirmar pagamento
export async function processarEventoGateway(opts: {
  chargeId: string;
  status: "PAGA" | "ATRASADA" | "CANCELADA" | "ESTORNADA";
  pagaEm?: Date;
}) {
  const cobranca = await prisma.cobranca.findFirst({ where: { gatewayChargeId: opts.chargeId } });
  if (!cobranca) return;

  await prisma.cobranca.update({
    where: { id: cobranca.id },
    data: {
      status: opts.status === "ESTORNADA" ? "ESTORNADA" : opts.status,
      pagaEm: opts.pagaEm ?? (opts.status === "PAGA" ? new Date() : null),
    },
  });

  if (opts.status === "PAGA") {
    await ativarPlano(cobranca.contaId, cobranca.plano);
  } else if (opts.status === "ATRASADA") {
    await prisma.conta.update({
      where: { id: cobranca.contaId },
      data: { statusAssinatura: "INADIMPLENTE" },
    });
  }
}

// Webhook → NFSe emitida pelo Asaas (Regina 03/07). Grava dados da nota
// na cobranca correspondente + dispara WhatsApp pro cliente com link do PDF.
// Best-effort — falha no envio nao bloqueia gravacao.
export async function processarNfseGateway(opts: {
  paymentId: string;
  nfseId: string;
  numero?: string;
  status?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  emitidaEm?: Date;
}) {
  const cobranca = await prisma.cobranca.findFirst({
    where: { gatewayChargeId: opts.paymentId },
    select: { id: true, contaId: true, valor: true, competencia: true },
  });
  if (!cobranca) return;

  await prisma.cobranca.update({
    where: { id: cobranca.id },
    data: {
      nfseId: opts.nfseId,
      nfseNumero: opts.numero || null,
      nfseStatus: opts.status || null,
      nfsePdfUrl: opts.pdfUrl || null,
      nfseXmlUrl: opts.xmlUrl || null,
      nfseEmitidaEm: opts.emitidaEm || new Date(),
    },
  });

  // So dispara WhatsApp se a NF ja foi emitida com PDF disponivel
  if (!opts.pdfUrl || opts.status === "SCHEDULED" || opts.status === "SYNCHRONIZED") {
    // SYNCHRONIZED = ainda em processo com a prefeitura. Espera o
    // ISSUED (proximo webhook) pra notificar o cliente.
    if (opts.status !== "AUTHORIZED" && !opts.pdfUrl) return;
  }

  try {
    const { dispararNotificacao } = await import("@/lib/whatsapp");
    const usuarios = await prisma.usuario.findMany({
      where: { contaId: cobranca.contaId, optInWhatsApp: true, telefoneWhatsApp: { not: null } },
      select: { id: true, nome: true },
    });
    const valor = cobranca.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
    for (const u of usuarios) {
      const primeiroNome = u.nome.split(" ")[0] || u.nome;
      const linkPdf = opts.pdfUrl!;
      const mensagem =
        `📄 *Nota Fiscal emitida — CP System*\n\n` +
        `${primeiroNome}, sua NF referente à mensalidade *${cobranca.competencia}* (${valor}) foi emitida e está disponível pra download.\n\n` +
        (opts.numero ? `Nº da NF: *${opts.numero}*\n` : "") +
        `\n🧾 Baixar PDF: ${linkPdf}\n\n` +
        `Você também recebe uma cópia por email. Guarde pra sua contabilidade.`;
      await dispararNotificacao({
        usuarioId: u.id,
        tipo: "NF_EMITIDA_CLIENTE",
        referenciaId: `nfse-${opts.nfseId}`,
        mensagem,
      });
    }
  } catch (e) {
    console.error("[processarNfseGateway] erro ao notificar WhatsApp:", e);
  }
}

function detectarBandeira(numero: string): string {
  const n = numero.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6/.test(n)) return "Elo/Discover";
  return "Outros";
}
