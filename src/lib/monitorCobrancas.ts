import "server-only";
import { prisma } from "@/lib/prisma";
import { asaasDisponivel, pagamentosAsaas, STATUS_EM_ABERTO, STATUS_RECEBIDO } from "@/lib/asaasFinanceiro";
import { adicionaisALancar } from "@/lib/faixasTerceirizacaoServer";

/**
 * Monitor diário das cobranças (Regina 10/11/2026: "monitore para que a
 * cobrança seja feita na data correta"). Lê o ASAAS — nunca conclui pagamento
 * pelo banco local — e aponta, por cliente pagante:
 *  - sem cobrança agendada (assinatura sem próximo vencimento e nada em aberto);
 *  - vencimento diferente do dia escolhido pelo cliente;
 *  - duas cobranças da assinatura com o mesmo vencimento (cobrança em dobro);
 *  - cobrança vencida e não paga;
 *  - adicional da faixa de colaboradores de mês fechado ainda não lançado.
 * Só aponta: nenhuma cobrança é criada, alterada ou cancelada aqui.
 */

export type ProblemaCobranca = { conta: string; tipo: "SEM_COBRANCA" | "DIA_ERRADO" | "DUPLICADA" | "ATRASADA" | "ADICIONAL_PENDENTE"; texto: string };

const dBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function monitorarCobrancas(hoje = new Date()): Promise<{ ok: boolean; erro?: string; problemas: ProblemaCobranca[]; conferidas: number }> {
  const asaas = await pagamentosAsaas("2026-01-01", true);
  if (!asaas.ok) return { ok: false, erro: asaas.erro, problemas: [], conferidas: 0 };
  const hojeIso = hoje.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const contas = await prisma.conta.findMany({
    where: { statusAssinatura: { in: ["ATIVA", "INADIMPLENTE"] }, contaTeste: false, arquivadaEm: null, gatewayCustomerId: { not: null }, usuarios: { none: { superAdmin: true } } },
    select: { id: true, diaVencimento: true, gatewaySubscriptionId: true, empresas: { select: { nomeFantasia: true, razaoSocial: true }, take: 1, orderBy: { criadoEm: "asc" } } },
  });
  const gw = await asaasDisponivel();
  const problemas: ProblemaCobranca[] = [];

  for (const c of contas) {
    const nome = c.empresas[0]?.nomeFantasia || c.empresas[0]?.razaoSocial || c.id;
    const dela = asaas.dados.filter((p) => p.contaId === c.id);
    const abertas = dela.filter((p) => STATUS_EM_ABERTO.includes(p.status));

    // Cobrança em dobro: mesma assinatura, mesmo vencimento, duas cobranças vivas.
    const porVenc = new Map<string, typeof dela>();
    for (const p of dela.filter((x) => x.subscription && (STATUS_EM_ABERTO.includes(x.status) || STATUS_RECEBIDO.includes(x.status)))) {
      const k = `${p.subscription}|${p.vencimento}`;
      porVenc.set(k, [...(porVenc.get(k) ?? []), p]);
    }
    for (const [k, ps] of porVenc) {
      if (ps.length < 2) continue;
      const venc = k.split("|")[1];
      problemas.push({ conta: nome, tipo: "DUPLICADA", texto: `${ps.length} cobranças da assinatura com vencimento ${dBr(venc)}: ${ps.map((p) => `${brl(p.valor)} ${STATUS_RECEBIDO.includes(p.status) ? `paga em ${dBr(p.pagamento ?? p.vencimento)}` : "em aberto"} (${p.id})`).join(" · ")}` });
    }

    // Vencida e não paga.
    for (const p of abertas.filter((x) => x.vencimento < hojeIso)) {
      const dias = Math.round((Date.parse(hojeIso) - Date.parse(p.vencimento)) / 86_400_000);
      problemas.push({ conta: nome, tipo: "ATRASADA", texto: `${brl(p.valor)} venceu em ${dBr(p.vencimento)} (${dias} dia${dias === 1 ? "" : "s"}) e não foi paga` });
    }

    // Próxima cobrança: existe e cai no dia escolhido?
    const futuras = abertas.filter((x) => x.vencimento >= hojeIso && x.subscription).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    let proxima = futuras[0]?.vencimento ?? null;
    if (!proxima && c.gatewaySubscriptionId && gw) {
      const sub = await gw.consultarAssinatura(c.gatewaySubscriptionId).catch(() => null);
      if (sub?.status === "ACTIVE" && sub.proximoVencimento) proxima = sub.proximoVencimento.toISOString().slice(0, 10);
    }
    if (!proxima) {
      problemas.push({ conta: nome, tipo: "SEM_COBRANCA", texto: c.gatewaySubscriptionId ? "assinatura no Asaas sem próximo vencimento ativo" : "cliente pagante sem assinatura no Asaas" });
    } else if (c.diaVencimento) {
      const dia = Number(proxima.slice(8, 10));
      const ultimoDia = new Date(Number(proxima.slice(0, 4)), Number(proxima.slice(5, 7)), 0).getDate();
      if (dia !== Math.min(c.diaVencimento, ultimoDia)) problemas.push({ conta: nome, tipo: "DIA_ERRADO", texto: `próxima cobrança em ${dBr(proxima)}, mas o cliente escolheu o dia ${c.diaVencimento}` });
    }
  }

  for (const a of await adicionaisALancar(hoje)) {
    problemas.push({ conta: a.nome, tipo: "ADICIONAL_PENDENTE", texto: `adicional da faixa de colaboradores de ${a.competencia.split("-").reverse().join("/")} (pico ${a.pico}, faixa ${a.faixa}, ${brl(a.valor)}) ainda não lançado — Admin › Terceirização · faixas` });
  }

  return { ok: true, problemas, conferidas: contas.length };
}

const ROTULO: Record<ProblemaCobranca["tipo"], string> = {
  DUPLICADA: "⚠️ Cobrança em dobro",
  ATRASADA: "⏰ Em atraso",
  SEM_COBRANCA: "❓ Sem próxima cobrança",
  DIA_ERRADO: "📅 Vencimento fora do dia escolhido",
  ADICIONAL_PENDENTE: "➕ Adicional de faixa a lançar",
};

export function textoDoMonitor(r: Awaited<ReturnType<typeof monitorarCobrancas>>): string | null {
  if (!r.ok) return `💳 *Monitor de cobranças*\n\nNão consegui ler o Asaas hoje (${r.erro}). Conferir manualmente.`;
  if (r.problemas.length === 0) return null;
  const linhas = r.problemas.map((p) => `${ROTULO[p.tipo]} — *${p.conta}*: ${p.texto}`);
  return `💳 *Monitor de cobranças* (${r.conferidas} clientes pagantes conferidos no Asaas)\n\n${linhas.join("\n\n")}\n\nNada foi alterado automaticamente.`;
}
