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

    const result = await gateway.criarCobranca({
      customerId,
      cobrancaIdInterno: cobrancaInterna.id,
      valor,
      vencimento,
      forma,
      descricao:
        breakdown.cnpjsAdicionais > 0
          ? `CP System — Plano ${plano} (${competencia}) · ${breakdown.numCnpjs} CNPJs (${breakdown.cnpjsAdicionais} adicional)`
          : `CP System — Plano ${plano} (${competencia})`,
      cartao,
    });

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

  await prisma.conta.update({
    where: { id: usuario.contaId },
    data: {
      statusAssinatura: "CANCELADA",
      proximoVencimento: null,
      bloqueadoEm: new Date(),
    },
  });

  // Cancela cobranças pendentes no gateway
  const pendentes = await prisma.cobranca.findMany({
    where: { contaId: usuario.contaId, status: "PENDENTE" },
  });
  const gateway = await getGateway();
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

function detectarBandeira(numero: string): string {
  const n = numero.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6/.test(n)) return "Elo/Discover";
  return "Outros";
}
