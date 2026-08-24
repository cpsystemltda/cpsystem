import "server-only";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";

// Pagamento automático de comissão do analista via PIX (Regina 13/07).
// Regra:
// - Roda dia 20 de cada mês (cron)
// - Referência: MÊS ANTERIOR fechado
// - Só paga comissões com paga=false do mês anterior
// - Se analista sem PIX ou PIX inválido: marca ultimoErroPgto, não bloqueia outras
// - Idempotente por (analistaId, contaId, competencia)

const tiposPix = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"] as const;
export type TipoChavePix = (typeof tiposPix)[number];

// Detecta o tipo de chave PIX (CPF/CNPJ/EMAIL/PHONE/EVP=aleatoria).
export function detectarTipoPix(chave: string): TipoChavePix | null {
  const c = chave.trim();
  const digitos = c.replace(/\D/g, "");
  if (c.includes("@")) return "EMAIL";
  if (digitos.length === 11 && !digitos.startsWith("55")) return "CPF";
  if (digitos.length === 14) return "CNPJ";
  if (digitos.length >= 10 && digitos.length <= 13) return "PHONE";
  // Chave aleatória (EVP) = UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return "EVP";
  return null;
}

// Formata a chave conforme o tipo (Asaas exige formato específico).
function normalizarChavePix(chave: string, tipo: TipoChavePix): string {
  if (tipo === "CPF" || tipo === "CNPJ") return chave.replace(/\D/g, "");
  if (tipo === "PHONE") {
    const d = chave.replace(/\D/g, "");
    return d.startsWith("55") ? `+${d}` : `+55${d}`;
  }
  return chave.trim();
}

// YYYY-MM do mês anterior
function competenciaMesAnterior(hoje: Date): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function pagarComissoesDoMesAnterior(hoje: Date = new Date()): Promise<{
  competenciaPaga: string;
  tentativas: number;
  sucessos: number;
  falhas: number;
  totalPagoBRL: number;
}> {
  const competencia = competenciaMesAnterior(hoje);
  const gateway = await getGateway();
  if (!gateway.transferirPix) {
    return { competenciaPaga: competencia, tentativas: 0, sucessos: 0, falhas: 0, totalPagoBRL: 0 };
  }

  // Busca comissões não pagas do mês anterior + comissões de bônus/pendências antigas
  // Filtro amplo: qualquer competencia <= mês anterior e paga=false.
  const candidatas = await prisma.comissao.findMany({
    where: {
      paga: false,
      competencia: { lte: competencia }, // inclui bonus com sufixo (ex: 2026-07-BONUS-INICIO) — compara alfabeticamente
    },
    include: {
      analista: {
        select: { id: true, nomeCompleto: true, pix: true, ativo: true },
      },
      conta: {
        select: {
          id: true,
          // Precisamos das faturas pagas da conta pra saber se o dinheiro do
          // cliente ja caiu de fato na conta do CP System.
          cobrancas: {
            where: { status: "PAGA", pagaEm: { not: null } },
            select: { pagaEm: true, forma: true, gatewayChargeId: true },
            orderBy: { pagaEm: "desc" },
          },
        },
      },
    },
  });

  // REGRA DE CAIXA (Regina 10/08): o CP System so recebe do gateway D+32 do
  // pagamento do cliente (cartao de credito). Antes disso o dinheiro nao
  // existe em conta — pagar o analista aqui seria adiantar capital proprio.
  //
  // Caso real que motivou: o Leo pagou em 20/07, compensacao em 21/08, e o
  // PIX de comissao estava agendado pro dia 20/08 — sairia UM DIA antes de a
  // receita entrar.
  //
  // Regra: so paga comissao cujo pagamento do cliente ja compensou. O que
  // ainda nao compensou fica para o proximo dia 20, sem perder nada (a
  // comissao continua com paga=false).
  // Regina 24/08: "eu quero que seja pago quando for em conta". Antes o filtro
  // usava um prazo fixo de 32 dias pra TODA forma de pagamento — o pior dos dois
  // mundos: segurava PIX que ja tinha caído e podia liberar cartao antecipado
  // que ainda nao caiu. Agora a pergunta é feita ao gateway: quando o dinheiro
  // desta fatura ficou disponível?
  //
  // PIX cai na hora; boleto em 1 dia util; cartao ~32 dias, menos se a conta
  // tiver antecipacao ligada. O prazo fixo continua como rede de seguranca pra
  // quando o gateway nao souber responder.
  const DIAS_COMPENSACAO_CARTAO = 32;
  const comissoes: typeof candidatas = [];
  for (const c of candidatas) {
    const pagamentos = c.conta?.cobrancas ?? [];
    // Sem fatura paga registrada: nao ha receita correspondente, nao paga.
    if (pagamentos.length === 0) continue;

    let temCaixa = false;
    for (const p of pagamentos) {
      if (!p.pagaEm) continue;
      // PIX e boleto: o dinheiro entra junto com a confirmacao.
      if (p.forma !== "CARTAO_CREDITO") {
        if (p.pagaEm <= hoje) temCaixa = true;
      } else if (p.gatewayChargeId && gateway.consultarCredito) {
        try {
          const credito = await gateway.consultarCredito(p.gatewayChargeId);
          const quando = credito.creditadoEm ?? credito.previsaoCredito;
          if (quando && quando <= hoje) temCaixa = true;
        } catch {
          // Gateway mudo: cai no prazo fixo do cartao.
          const limite = new Date(hoje.getTime() - DIAS_COMPENSACAO_CARTAO * 86400000);
          if (p.pagaEm <= limite) temCaixa = true;
        }
      } else {
        const limite = new Date(hoje.getTime() - DIAS_COMPENSACAO_CARTAO * 86400000);
        if (p.pagaEm <= limite) temCaixa = true;
      }
      if (temCaixa) break;
    }
    if (temCaixa) comissoes.push(c);
  }

  let sucessos = 0;
  let falhas = 0;
  let totalPagoBRL = 0;

  for (const c of comissoes) {
    if (!c.analista.ativo) continue;

    // Sem PIX cadastrado — marca erro e segue
    if (!c.analista.pix || c.analista.pix.trim().length < 4) {
      await prisma.comissao.update({
        where: { id: c.id },
        data: { ultimoErroPgto: "Analista sem chave PIX cadastrada" },
      });
      falhas++;
      continue;
    }

    const tipo = detectarTipoPix(c.analista.pix);
    if (!tipo) {
      await prisma.comissao.update({
        where: { id: c.id },
        data: { ultimoErroPgto: `Chave PIX em formato desconhecido: ${c.analista.pix.slice(0, 30)}` },
      });
      falhas++;
      continue;
    }

    try {
      const chave = normalizarChavePix(c.analista.pix, tipo);
      const tf = await gateway.transferirPix({
        valor: c.valor,
        chavePix: chave,
        tipoChave: tipo,
        descricao: `Comissão ${c.competencia} — CP System`,
        referenciaExterna: `comissao-${c.id}`,
      });
      await prisma.comissao.update({
        where: { id: c.id },
        data: {
          paga: true,
          pagaEm: new Date(),
          transferenciaId: tf.transferId,
          ultimoErroPgto: null,
        },
      });
      sucessos++;
      totalPagoBRL += c.valor;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.comissao.update({
        where: { id: c.id },
        data: { ultimoErroPgto: msg.slice(0, 500) },
      });
      falhas++;
    }
  }

  return {
    competenciaPaga: competencia,
    tentativas: comissoes.length,
    sucessos,
    falhas,
    totalPagoBRL,
  };
}

/**
 * Paga UMA comissão agora, por decisão manual do super admin (Regina 24/08:
 * "eu preciso que o Igor receba a comissão dele que já é devida").
 *
 * Diferente do fluxo automático, aqui não se pergunta se o dinheiro do cliente
 * já caiu: quem clica está assumindo antecipar o repasse. Por isso a ação é
 * exclusiva de super admin e fica registrada na auditoria.
 */
export async function pagarComissaoAvulsa(comissaoId: string): Promise<
  { ok: true; transferId: string; valor: number } | { ok: false; erro: string }
> {
  const c = await prisma.comissao.findUnique({
    where: { id: comissaoId },
    include: { analista: { select: { nomeCompleto: true, pix: true, ativo: true } } },
  });
  if (!c) return { ok: false, erro: "Comissão não encontrada." };
  if (c.paga) return { ok: false, erro: "Esta comissão já foi paga." };
  if (!c.analista.ativo) return { ok: false, erro: "Analista inativo." };
  if (!c.analista.pix || c.analista.pix.trim().length < 4) {
    return { ok: false, erro: "Analista sem chave PIX cadastrada." };
  }
  const tipo = detectarTipoPix(c.analista.pix);
  if (!tipo) return { ok: false, erro: "Chave PIX do analista em formato desconhecido." };

  const gateway = await getGateway();
  if (!gateway.transferirPix) return { ok: false, erro: "Gateway sem suporte a PIX out." };

  try {
    const tf = await gateway.transferirPix({
      valor: c.valor,
      chavePix: normalizarChavePix(c.analista.pix, tipo),
      tipoChave: tipo,
      descricao: `Comissão ${c.competencia} — CP System`,
      referenciaExterna: `comissao-${c.id}`,
    });
    await prisma.comissao.update({
      where: { id: c.id },
      data: { paga: true, pagaEm: new Date(), transferenciaId: tf.transferId, ultimoErroPgto: null },
    });
    return { ok: true, transferId: tf.transferId, valor: c.valor };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.comissao.update({
      where: { id: c.id },
      data: { ultimoErroPgto: msg.slice(0, 500) },
    });
    return { ok: false, erro: msg.slice(0, 200) };
  }
}
