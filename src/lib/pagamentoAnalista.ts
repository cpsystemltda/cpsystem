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
  // Regina 25/08: o Léo pagou agosto por PIX em 24/08, o dinheiro caiu na hora —
  // e a comissão de agosto do Igor continuou parada. O motivo era este filtro:
  // só entravam competências até o MÊS ANTERIOR, herança de quando o repasse
  // saía sempre no dia 20 do mês seguinte. Com a regra nova ("pago quando cair
  // em conta"), segurar por competência contradiz o combinado — quem decide se
  // há repasse é o caixa, logo abaixo.
  const candidatas = await prisma.comissao.findMany({
    where: { paga: false },
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
            select: { pagaEm: true, forma: true, gatewayChargeId: true, competencia: true },
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
    // Regina 24/08: "a comissão de agosto só vai ser paga quando o Léo pagar e
    // cair na nossa conta". Cada competência anda com a SUA mensalidade — antes
    // bastava qualquer fatura paga da conta ter compensado, o que liberaria a
    // comissão de agosto com o dinheiro de julho, mesmo com agosto em aberto.
    //
    // Exceção: comissão de bônus tem competência com sufixo (ex.:
    // "2026-07-BONUS-INICIO") e não corresponde a uma mensalidade específica.
    // Pra ela vale qualquer fatura paga e creditada da conta — senão ficaria
    // presa pra sempre esperando uma competência que não existe.
    const ehBonus = !/^\d{4}-\d{2}$/.test(c.competencia);
    const todas = c.conta?.cobrancas ?? [];
    const pagamentos = ehBonus ? todas : todas.filter((p) => p.competencia === c.competencia);
    // Competência sem fatura paga correspondente: o cliente não pagou esse mês.
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
      await avisarRepasseAoAnalista(c.id);
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
 * Avisa o analista de que o PIX da comissão saiu (Regina 24/08).
 *
 * Faltava: o repasse era transferido e o analista só descobria olhando o
 * extrato. Quem recebe dinheiro precisa saber que recebeu, e por qual cliente —
 * é isso que permite a ele conferir se está tudo certo.
 *
 * Best-effort: falha de WhatsApp nunca desfaz um pagamento que já saiu.
 */
async function avisarRepasseAoAnalista(comissaoId: string): Promise<void> {
  try {
    const c = await prisma.comissao.findUnique({
      where: { id: comissaoId },
      select: {
        valor: true,
        competencia: true,
        analista: { select: { contaId: true, nomeCompleto: true } },
        conta: { select: { empresas: { select: { nomeFantasia: true, razaoSocial: true }, take: 1 } } },
      },
    });
    if (!c?.analista.contaId) return;

    const cliente =
      c.conta?.empresas[0]?.nomeFantasia ?? c.conta?.empresas[0]?.razaoSocial ?? "seu cliente";
    const [ano, mes] = c.competencia.split("-");
    const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const competenciaBr = `${nomes[Number(mes) - 1] ?? mes}/${ano?.slice(2) ?? ano}`;

    const { dispararNotificacao } = await import("@/lib/whatsapp");
    const usuarios = await prisma.usuario.findMany({
      where: { contaId: c.analista.contaId, optInWhatsApp: true, telefoneWhatsApp: { not: null } },
      select: { id: true, nome: true },
    });
    for (const u of usuarios) {
      await dispararNotificacao({
        usuarioId: u.id,
        tipo: "COMISSAO_LIBERADA",
        referenciaId: `repasse-${comissaoId}`,
        mensagem:
          `💰 *Comissão paga — ${c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}*\n\n` +
          `${u.nome.split(" ")[0]}, o PIX da sua comissão de *${competenciaBr}* acabou de sair para a chave ` +
          `cadastrada no seu perfil.\n\n` +
          `▸ Cliente: ${cliente}\n` +
          `▸ Competência: ${competenciaBr}\n\n` +
          `Costuma cair em segundos. Se não aparecer, confira a chave PIX em *Conta › Meus dados* ` +
          `e fale com a gente.\n\n` +
          `Contato CP System`,
      });
    }
  } catch (e) {
    console.error("[comissao] falha ao avisar repasse:", e);
  }
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
    await avisarRepasseAoAnalista(c.id);
    return { ok: true, transferId: tf.transferId, valor: c.valor };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.comissao.update({
      where: { id: c.id },
      data: { ultimoErroPgto: msg.slice(0, 500) },
    });
    return { ok: false, erro: traduzirErroGateway(msg) };
  }
}

/**
 * Traduz o erro cru do gateway pro que a pessoa precisa FAZER.
 *
 * O primeiro repasse tentado pela Regina em 24/08 devolveu um JSON de 403 na
 * tela. A informação estava lá, mas ninguém deveria precisar ler JSON pra
 * descobrir que falta marcar uma permissão no painel do Asaas.
 */
export function traduzirErroGateway(bruto: string): string {
  const m = bruto.toLowerCase();
  if (m.includes("insufficient_permission") || m.includes("operações de saque")) {
    return (
      "A chave de API do Asaas não tem permissão para transferências (saque via API). " +
      "No Asaas: Integrações → API Key → habilite a permissão de saque/transferência (ou gere uma " +
      "chave nova com ela) e atualize a chave no CP System. Enquanto isso, dá pra pagar o analista " +
      "manualmente pelo app do Asaas."
    );
  }
  if (m.includes("invalid_action") && m.includes("pix")) {
    return "O Asaas recusou a chave PIX do analista. Confira a chave cadastrada no perfil dele.";
  }
  if (m.includes("insufficient_balance") || m.includes("saldo")) {
    return "Saldo insuficiente na conta Asaas para este repasse.";
  }
  if (m.startsWith("asaas 401") || m.includes("unauthorized")) {
    return "A chave de API do Asaas foi recusada (401). Confira se ela é da conta de produção e está válida.";
  }
  return bruto.slice(0, 240);
}
