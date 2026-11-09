import { NextResponse } from "next/server";
import { asaasDisponivel, pagamentosAsaas, resumoPorConta } from "@/lib/asaasFinanceiro";
import { montarDre } from "@/lib/dre";

// Conferência do que o DRE e a lista de Clientes leem do Asaas (Regina
// 09/11/2026). Somente leitura. GET ?secret=CRON_SECRET
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await pagamentosAsaas("2026-01-01", true);
  if (!p.ok) return NextResponse.json({ ok: false, erro: p.erro });
  const resumo = resumoPorConta(p.dados);
  const dre = await montarDre();
  // Quem é o pagador das cobranças sem conta no CP System (receita avulsa? depósito?)
  const g = await asaasDisponivel();
  const semConta = Array.from(new Set(p.dados.filter((x) => !x.contaId).map((x) => x.customer)));
  const pagadores = g ? await Promise.all(semConta.map(async (c) => ({ customer: c, ...(await g.nomeDoCliente(c)), cobrancas: p.dados.filter((x) => x.customer === c).map((x) => ({ valor: x.valor, vencimento: x.vencimento, descricao: x.descricao, assinatura: !!x.subscription })) }))) : [];
  return NextResponse.json({
    ok: true,
    pagadores,
    pagamentos: p.dados.map((x) => ({ id: x.id, conta: x.contaNome, interna: x.contaInterna, status: x.status, valor: x.valor, liquido: x.liquido, vencimento: x.vencimento, pagamento: x.pagamento, forma: x.forma })),
    porConta: Array.from(resumo.entries()).map(([contaId, r]) => ({ contaId, nome: p.dados.find((x) => x.contaId === contaId)?.contaNome, ...r })),
    dre: { fonte: dre.fonte, meses: dre.meses.map((m) => ({ c: m.competencia, bruta: m.receitaBruta, taxas: m.taxasGateway, estornos: m.estornos, liquida: m.receitaLiquida, recebido: m.recebidoNoMes, aberto: m.aReceber, pagantes: m.clientesPagantes })), semCliente: dre.semCliente },
  });
}
