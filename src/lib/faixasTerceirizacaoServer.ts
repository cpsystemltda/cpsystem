import "server-only";
import { prisma } from "@/lib/prisma";
import { contarAtivosAlocados } from "@/lib/colaboradoresServer";
import { competenciaAtualBrt } from "@/lib/dreConstantes";
import {
  acessoModulo,
  atingiu90,
  CHAVE_FAIXAS,
  CHAVE_NOME_PACOTE,
  faixaDe,
  faixasDe,
  NOME_PACOTE_PADRAO,
  rotuloFaixa,
  type AcessoModulo,
  type Faixa,
} from "@/lib/faixasTerceirizacao";

/**
 * ESP-011 — liberação do Módulo Terceirização por plano e apuração da faixa
 * de colaboradores (lado do servidor).
 *
 * ⚠️ Cobrança real DESLIGADA: as faixas do Anexo B.1 aguardam aprovação do
 * Igor e a forma de cobrar (item variável na assinatura × cobrança avulsa)
 * aguarda a Regina. Enquanto `terceirizacao.cobrancaAtiva` for false, o
 * cliente não vê preço de faixa nem recebe aviso de faixa; só o admin vê a
 * apuração. Nenhuma cobrança é criada no Asaas por este arquivo.
 */

export const CHAVE_COBRANCA_ATIVA = "terceirizacao.cobrancaAtiva";

export async function faixasVigentes(): Promise<Faixa[]> {
  const p = await prisma.parametroPlataforma.findUnique({ where: { chave: CHAVE_FAIXAS } });
  return faixasDe(p?.valor ?? null);
}

export async function configFaixas(): Promise<{ faixas: Faixa[]; nomePacote: string; cobrancaAtiva: boolean }> {
  const ps = await prisma.parametroPlataforma.findMany({ where: { chave: { in: [CHAVE_FAIXAS, CHAVE_NOME_PACOTE, CHAVE_COBRANCA_ATIVA] } } });
  const v = (k: string) => ps.find((p) => p.chave === k)?.valor;
  const nome = v(CHAVE_NOME_PACOTE);
  return {
    faixas: faixasDe(v(CHAVE_FAIXAS) ?? null),
    nomePacote: typeof nome === "string" && nome.trim() ? nome.trim() : NOME_PACOTE_PADRAO,
    cobrancaAtiva: v(CHAVE_COBRANCA_ATIVA) === true,
  };
}

type ContaAcesso = { id: string; plano: string; statusAssinatura: string; trialAteEm: Date | null; terceirizacaoPerdidaEm: Date | null };

async function temDadosDoModulo(contaId: string): Promise<boolean> {
  const [colab, comp] = await Promise.all([
    prisma.colaborador.count({ where: { contaId }, take: 1 }),
    prisma.competencia.count({ where: { contrato: { empresa: { contaId } } }, take: 1 }),
  ]);
  return colab + comp > 0;
}

/**
 * RN01/RN07. Ao perder o plano, marca `terceirizacaoPerdidaEm` na primeira
 * vez que alguém olha (ou no cron) — os 90 dias de somente leitura contam a
 * partir daí. Voltando ao Premium/trial, a marca é limpa.
 */
export async function acessoDaConta(conta: ContaAcesso, hoje = new Date()): Promise<AcessoModulo> {
  const acesso = acessoModulo(conta, hoje);
  if (acesso === "LIBERADO" && conta.terceirizacaoPerdidaEm) {
    await prisma.conta.update({ where: { id: conta.id }, data: { terceirizacaoPerdidaEm: null } }).catch(() => {});
    return acesso;
  }
  if (acesso === "BLOQUEADO" && !conta.terceirizacaoPerdidaEm && (await temDadosDoModulo(conta.id))) {
    await prisma.conta.update({ where: { id: conta.id }, data: { terceirizacaoPerdidaEm: hoje } }).catch(() => {});
    return "SOMENTE_LEITURA";
  }
  return acesso;
}

export async function acessoDaContaId(contaId: string): Promise<AcessoModulo> {
  const c = await prisma.conta.findUnique({ where: { id: contaId }, select: { id: true, plano: true, statusAssinatura: true, trialAteEm: true, terceirizacaoPerdidaEm: true } });
  return c ? acessoDaConta(c) : "BLOQUEADO";
}

/**
 * Guarda das server actions do módulo. "escrita": precisa estar LIBERADO;
 * "leitura": basta não estar BLOQUEADO (exportar dossiê no período de 90 dias).
 * Devolve a mensagem de erro, ou null.
 */
export async function bloqueioModulo(contaId: string, modo: "escrita" | "leitura" = "escrita"): Promise<string | null> {
  const a = await acessoDaContaId(contaId);
  if (a === "LIBERADO") return null;
  if (a === "SOMENTE_LEITURA") return modo === "leitura" ? null : "O Módulo Terceirização está em somente leitura porque a conta saiu do plano Premium. Os dados ficam disponíveis para consulta e exportação por 90 dias; para voltar a editar, reative o Premium em Conta › Assinatura.";
  return "O Módulo Terceirização faz parte do plano Premium. Conheça em Conta › Assinatura.";
}

/**
 * RN03: grava a contagem do dia na apuração do mês e atualiza o pico e a
 * faixa. Chamado pelo cron diário e depois de alocar/encerrar/desligar.
 * RN04: avisos ao Admin só com a cobrança ativa (decisão pendente).
 */
export async function registrarContagem(contaId: string, hoje = new Date()): Promise<{ n: number; pico: number; faixa: string; avisos: string[] }> {
  const competencia = competenciaAtualBrt(hoje);
  const [n, cfg, atual, anterior] = await Promise.all([
    contarAtivosAlocados(contaId),
    configFaixas(),
    prisma.apuracaoColaboradoresMes.findUnique({ where: { contaId_competencia: { contaId, competencia } } }),
    prisma.apuracaoColaboradoresMes.findFirst({ where: { contaId, competencia: { lt: competencia } }, orderBy: { competencia: "desc" }, select: { faixaIndice: true } }),
  ]);
  const pico = Math.max(n, atual?.pico ?? 0);
  const f = faixaDe(pico, cfg.faixas);
  const subiuPico = !atual || n > atual.pico;
  const reg = await prisma.apuracaoColaboradoresMes.upsert({
    where: { contaId_competencia: { contaId, competencia } },
    create: { contaId, competencia, pico, picoEm: hoje, ultimoValor: n, faixaIndice: f.indice, faixaValor: f.valor },
    update: { ultimoValor: n, pico, faixaIndice: f.indice, faixaValor: f.valor, ...(subiuPico ? { picoEm: hoje } : {}) },
  });

  const avisos: string[] = [];
  if (!cfg.cobrancaAtiva || pico === 0) return { n, pico, faixa: rotuloFaixa(f), avisos };
  const conta = await prisma.conta.findUnique({ where: { id: contaId }, select: { id: true, plano: true, statusAssinatura: true, trialAteEm: true, terceirizacaoPerdidaEm: true } });
  if (!conta || conta.statusAssinatura === "TRIAL" || (await acessoDaConta(conta, hoje)) !== "LIBERADO") return { n, pico, faixa: rotuloFaixa(f), avisos };

  const referencia = anterior?.faixaIndice ?? 0;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (f.indice > referencia && reg.mudancaFaixaAvisadaIndice !== f.indice) {
    avisos.push(
      `📈 *${cfg.nomePacote}: mudança de faixa*\n\nO pico de colaboradores ativos deste mês chegou a ${pico}, faixa de ${rotuloFaixa(f)} colaboradores. ` +
        (f.valor > 0 ? `O adicional desta faixa é de ${brl(f.valor)} por mês, lançado na fatura do mês seguinte.` : `Esta faixa está incluída no plano, sem adicional.`) +
        `\n\nA contagem considera cada colaborador uma única vez, mesmo alocado em mais de um contrato.\n\n— Contato CP System`,
    );
    await prisma.apuracaoColaboradoresMes.update({ where: { id: reg.id }, data: { mudancaFaixaAvisadaIndice: f.indice } });
  } else if (atingiu90(pico, f) && !reg.aviso90Em) {
    const prox = cfg.faixas[f.indice + 1];
    avisos.push(
      `📊 *${cfg.nomePacote}: perto do limite da faixa*\n\nA conta está com ${pico} colaboradores ativos, perto do limite de ${f.ate} da faixa atual. ` +
        (prox ? `Acima disso, a faixa seguinte tem adicional de ${brl(prox.valor)} por mês.` : `Acima disso, o valor é combinado com a nossa equipe.`) +
        `\n\n— Contato CP System`,
    );
    await prisma.apuracaoColaboradoresMes.update({ where: { id: reg.id }, data: { aviso90Em: hoje } });
  }
  if (avisos.length) {
    const admin = await prisma.usuario.findFirst({ where: { contaId, perfil: "ADMIN", telefoneWhatsApp: { not: null } }, orderBy: { criadoEm: "asc" }, select: { id: true } });
    if (admin) {
      const { dispararNotificacao } = await import("@/lib/whatsapp");
      for (const mensagem of avisos) {
        await dispararNotificacao({ usuarioId: admin.id, tipo: "TERCEIRIZACAO_FAIXA", referenciaId: `${contaId}-${competencia}-${f.indice}-${mensagem.slice(2, 12)}`, mensagem }).catch(() => {});
      }
    }
  }
  return { n, pico, faixa: rotuloFaixa(f), avisos };
}

/** Cron diário: apura todas as contas que têm colaborador cadastrado. */
export async function apurarColaboradoresDoDia(hoje = new Date()): Promise<{ contas: number; avisos: number; detalhes: string[] }> {
  const contas = await prisma.conta.findMany({ where: { colaboradores: { some: {} } }, select: { id: true, empresas: { select: { razaoSocial: true }, take: 1 } } });
  let avisos = 0;
  const detalhes: string[] = [];
  for (const c of contas) {
    const r = await registrarContagem(c.id, hoje);
    avisos += r.avisos.length;
    detalhes.push(`${c.empresas[0]?.razaoSocial ?? c.id}: ${r.n} hoje, pico ${r.pico} (faixa ${r.faixa})`);
  }
  return { contas: contas.length, avisos, detalhes };
}

/** RN06/RN08: situação atual de uma conta (para trial, admin e assinatura). */
export async function situacaoFaixa(contaId: string, hoje = new Date()) {
  const competencia = competenciaAtualBrt(hoje);
  const [cfg, ap, agora] = await Promise.all([
    configFaixas(),
    prisma.apuracaoColaboradoresMes.findUnique({ where: { contaId_competencia: { contaId, competencia } } }),
    contarAtivosAlocados(contaId),
  ]);
  const pico = Math.max(ap?.pico ?? 0, agora);
  const f = faixaDe(pico, cfg.faixas);
  return { competencia, agora, pico, faixa: f, rotulo: rotuloFaixa(f), nomePacote: cfg.nomePacote, cobrancaAtiva: cfg.cobrancaAtiva };
}

/** RN08: colaboradores ativos e faixa de várias contas de uma vez (tela Clientes). */
export async function faixasDasContas(contaIds: string[], hoje = new Date()): Promise<Map<string, { pico: number; faixa: string; valor: number; usaModulo: boolean }>> {
  const competencia = competenciaAtualBrt(hoje);
  const [cfg, aps, comCmo] = await Promise.all([
    configFaixas(),
    prisma.apuracaoColaboradoresMes.findMany({ where: { contaId: { in: contaIds }, competencia }, select: { contaId: true, pico: true } }),
    prisma.empresa.findMany({
      where: { contaId: { in: contaIds }, contratos: { some: { tipo: { in: ["SERVICOS_DEDICACAO_EXCLUSIVA", "SERVICOS_PREDOMINANCIA_MAO_DE_OBRA"] } } } },
      select: { contaId: true },
      distinct: ["contaId"],
    }),
  ]);
  const usa = new Set(comCmo.map((e) => e.contaId));
  const out = new Map<string, { pico: number; faixa: string; valor: number; usaModulo: boolean }>();
  for (const id of contaIds) {
    const pico = aps.find((a) => a.contaId === id)?.pico ?? 0;
    const f = faixaDe(pico, cfg.faixas);
    out.set(id, { pico, faixa: rotuloFaixa(f), valor: f.valor, usaModulo: usa.has(id) });
  }
  return out;
}

/** O que a página mostra: acesso + estimativa de trial (RN06, últimos 3 dias e só com a cobrança ativa). */
export async function avisoModuloDaConta(conta: ContaAcesso, hoje = new Date()) {
  const acesso = await acessoDaConta(conta, hoje);
  let estimativaTrial: { dias: number; pico: number; rotulo: string; valor: number; nomePacote: string } | null = null;
  if (acesso === "LIBERADO" && conta.statusAssinatura === "TRIAL" && conta.trialAteEm) {
    const dias = Math.ceil((conta.trialAteEm.getTime() - hoje.getTime()) / 86_400_000);
    if (dias <= 3) {
      const s = await situacaoFaixa(conta.id, hoje);
      if (s.cobrancaAtiva && s.pico > 0) estimativaTrial = { dias, pico: s.pico, rotulo: s.rotulo, valor: s.faixa.valor, nomePacote: s.nomePacote };
    }
  }
  return { acesso, perdidaEm: acesso === "SOMENTE_LEITURA" ? (conta.terceirizacaoPerdidaEm ?? hoje) : null, estimativaTrial };
}

// ─────────────────────────────────────────────
// Lançamento do adicional (RN05). Regina 10/11/2026: "monitore para que a
// cobrança seja feita na data correta". Cobrança avulsa no Asaas com o
// MESMO vencimento da próxima mensalidade, competência "AAAA-MM-TERCEIRIZACAO"
// (o webhook não mexe no ciclo da assinatura quando ela é paga). O lançamento
// é feito por um gestor no admin, com um clique; o monitor diário avisa a
// equipe enquanto houver adicional sem lançar.
// ─────────────────────────────────────────────

export type AdicionalALancar = { apuracaoId: string; contaId: string; nome: string; competencia: string; pico: number; faixa: string; valor: number };

/** Meses FECHADOS com adicional > 0 ainda não lançado, de contas pagantes. */
export async function adicionaisALancar(hoje = new Date()): Promise<AdicionalALancar[]> {
  const atual = competenciaAtualBrt(hoje);
  const cfg = await configFaixas();
  if (!cfg.cobrancaAtiva) return [];
  const aps = await prisma.apuracaoColaboradoresMes.findMany({
    where: { competencia: { lt: atual }, faixaValor: { gt: 0 }, cobrancaRef: null, conta: { contaTeste: false, plano: "PREMIUM", statusAssinatura: { in: ["ATIVA", "INADIMPLENTE"] }, usuarios: { none: { superAdmin: true } } } },
    select: { id: true, contaId: true, competencia: true, pico: true, conta: { select: { empresas: { select: { nomeFantasia: true, razaoSocial: true }, take: 1, orderBy: { criadoEm: "asc" } } } } },
    orderBy: { competencia: "asc" },
  });
  return aps.map((a) => {
    const f = faixaDe(a.pico, cfg.faixas);
    return { apuracaoId: a.id, contaId: a.contaId, nome: a.conta.empresas[0]?.nomeFantasia || a.conta.empresas[0]?.razaoSocial || a.contaId, competencia: a.competencia, pico: a.pico, faixa: rotuloFaixa(f), valor: f.valor };
  });
}

/** Cria a cobrança do adicional no Asaas (vence junto com a próxima mensalidade). */
export async function lancarAdicional(apuracaoId: string): Promise<{ ok: true; mensagem: string; cobrancaId: string } | { erro: string }> {
  const ap = await prisma.apuracaoColaboradoresMes.findUnique({
    where: { id: apuracaoId },
    select: { id: true, contaId: true, competencia: true, pico: true, cobrancaRef: true, conta: { select: { plano: true, gatewaySubscriptionId: true, proximoVencimento: true, statusAssinatura: true } } },
  });
  if (!ap) return { erro: "Apuração não encontrada." };
  if (ap.cobrancaRef) return { erro: "O adicional deste mês já foi lançado." };
  if (ap.competencia >= competenciaAtualBrt()) return { erro: "O mês ainda não fechou: a faixa é a do pico do mês inteiro." };
  const cfg = await configFaixas();
  const f = faixaDe(ap.pico, cfg.faixas);
  if (f.acimaDaUltima) return { erro: `Conta acima de ${f.ate} colaboradores: valor sob consulta, combine com o cliente e lance manualmente.` };
  if (f.valor <= 0) return { erro: "Faixa sem adicional." };
  const competenciaAdicional = `${ap.competencia}-TERCEIRIZACAO`;
  const ja = await prisma.cobranca.findFirst({ where: { contaId: ap.contaId, competencia: competenciaAdicional, status: { not: "CANCELADA" } }, select: { id: true } });
  if (ja) {
    await prisma.apuracaoColaboradoresMes.update({ where: { id: ap.id }, data: { cobrancaRef: ja.id, cobradoEm: new Date() } });
    return { erro: "Já existia cobrança deste adicional; apenas vinculei à apuração." };
  }

  const { getGateway } = await import("@/lib/gateway");
  const { garantirCustomer } = await import("@/app/actions/assinatura");
  const gateway = await getGateway();
  // Mesmo vencimento da próxima mensalidade (data que o cliente já espera).
  let vencimento: Date | null = null;
  const g = gateway as unknown as { consultarAssinatura?: (id: string) => Promise<{ proximoVencimento: Date | null } | null> };
  if (ap.conta.gatewaySubscriptionId && g.consultarAssinatura) vencimento = (await g.consultarAssinatura(ap.conta.gatewaySubscriptionId).catch(() => null))?.proximoVencimento ?? null;
  vencimento ??= ap.conta.proximoVencimento;
  const minimo = new Date(Date.now() + 3 * 86_400_000);
  if (!vencimento || vencimento < minimo) vencimento = minimo;

  const [ano, mes] = ap.competencia.split("-");
  const descricao = `${cfg.nomePacote} — adicional da faixa de ${rotuloFaixa(f)} colaboradores (pico de ${ap.pico} em ${mes}/${ano})`;
  const { customerId } = await garantirCustomer(ap.contaId);
  const cobranca = await prisma.cobranca.create({
    data: { contaId: ap.contaId, competencia: competenciaAdicional, plano: ap.conta.plano, forma: "PIX", valor: f.valor, vencimento, status: "PENDENTE", observacoes: descricao },
  });
  try {
    const r = await gateway.criarCobranca({ customerId, cobrancaIdInterno: cobranca.id, valor: f.valor, vencimento, forma: "PIX", descricao });
    await prisma.cobranca.update({ where: { id: cobranca.id }, data: { gatewayChargeId: r.chargeId, gatewayInvoiceUrl: r.invoiceUrl ?? null, pixQrCode: r.pixQrCode ?? null, pixCopiaCola: r.pixCopiaCola ?? null, status: r.status } });
  } catch (e) {
    await prisma.cobranca.update({ where: { id: cobranca.id }, data: { status: "CANCELADA", observacoes: `${descricao} — falhou no Asaas: ${e instanceof Error ? e.message : String(e)}` } });
    return { erro: `O Asaas recusou a cobrança: ${e instanceof Error ? e.message : String(e)}` };
  }
  await prisma.apuracaoColaboradoresMes.update({ where: { id: ap.id }, data: { cobrancaRef: cobranca.id, cobradoEm: new Date() } });
  return { ok: true, cobrancaId: cobranca.id, mensagem: `Adicional de ${f.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} lançado no Asaas, vence em ${vencimento.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` };
}
