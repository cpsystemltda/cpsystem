import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";
import { calcularValorMensal } from "@/lib/precos";
import { garantirCustomer } from "@/app/actions/assinatura";

/**
 * Gera a cobrança de um mês que ficou sem cobrança, com vencimento escolhido.
 *
 * POST ?secret=&contaId=&competencia=AAAA-MM&vencimento=AAAA-MM-DD[&forma=PIX]
 *
 * Irmã de `gerarFaturaEmFaltaAction` (tela do admin), com duas diferenças:
 * roda sem sessão (chave do cron) e aceita a data de vencimento, em vez de
 * "daqui a 3 dias". Caso que a criou, 21/10/2026: a troca de cartão de um
 * cliente apagou a fatura de outubro no Asaas, ele pagou por PIX a cobrança
 * que sobrou (a de novembro), e a assinatura nova ficou com próxima cobrança
 * em dezembro. O Asaas não deixa mudar o vencimento de assinatura de cartão
 * com fatura paga, então novembro volta por aqui, como cobrança avulsa com
 * vencimento no dia 20 — e o ciclo do cartão segue de dezembro em diante.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (!process.env.CRON_SECRET || url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }
  const contaId = url.searchParams.get("contaId") || "";
  const competencia = url.searchParams.get("competencia") || "";
  const vencimentoStr = url.searchParams.get("vencimento") || "";
  const forma = (url.searchParams.get("forma") || "PIX") as "PIX" | "BOLETO";
  if (!contaId || !/^\d{4}-\d{2}$/.test(competencia) || !/^\d{4}-\d{2}-\d{2}$/.test(vencimentoStr)) {
    return NextResponse.json({ erro: "informe contaId, competencia=AAAA-MM e vencimento=AAAA-MM-DD" }, { status: 400 });
  }

  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    select: {
      id: true, plano: true, diaVencimento: true,
      empresas: { select: { razaoSocial: true }, take: 1 },
      usuarios: { select: { superAdmin: true } },
    },
  });
  if (!conta) return NextResponse.json({ erro: "conta não encontrada" }, { status: 404 });
  if (conta.usuarios.some((u) => u.superAdmin)) {
    return NextResponse.json({ erro: "conta interna do CP System não é cobrada" }, { status: 400 });
  }

  const jaExiste = await prisma.cobranca.findFirst({
    where: { contaId, competencia, status: { in: ["PENDENTE", "PROCESSANDO", "ATRASADA", "PAGA"] } },
    select: { id: true, status: true, gatewayChargeId: true },
  });
  if (jaExiste) {
    return NextResponse.json({ erro: `já existe cobrança ${jaExiste.status} para ${competencia}`, cobranca: jaExiste }, { status: 409 });
  }

  // Meio-dia em Brasília: a data não escorrega de dia ao virar UTC.
  const vencimento = new Date(`${vencimentoStr}T15:00:00.000Z`);

  try {
    const breakdown = await calcularValorMensal(conta.id, conta.plano);
    const { customerId } = await garantirCustomer(conta.id);
    const gateway = await getGateway();

    const cobranca = await prisma.cobranca.create({
      data: {
        contaId: conta.id,
        competencia,
        plano: conta.plano,
        forma,
        valor: breakdown.valorTotal,
        vencimento,
        status: "PENDENTE",
        observacoes: `Fatura de ${competencia} gerada pela administração — mês ficou sem cobrança no gateway`,
      },
    });

    const r = await gateway.criarCobranca({
      customerId,
      cobrancaIdInterno: cobranca.id,
      valor: breakdown.valorTotal,
      vencimento,
      forma,
      descricao: `CP System — Plano ${conta.plano} (${competencia})`,
    });

    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        gatewayChargeId: r.chargeId,
        gatewayInvoiceUrl: r.invoiceUrl ?? null,
        pixQrCode: r.pixQrCode ?? null,
        pixCopiaCola: r.pixCopiaCola ?? null,
        boletoUrl: r.boletoUrl ?? null,
        status: r.status,
      },
    });

    return NextResponse.json({
      ok: true,
      empresa: conta.empresas[0]?.razaoSocial ?? conta.id,
      cobrancaId: cobranca.id,
      chargeId: r.chargeId,
      valor: breakdown.valorTotal,
      competencia,
      vencimento: vencimentoStr,
      forma,
      temPix: !!r.pixCopiaCola,
      invoiceUrl: r.invoiceUrl ?? null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message.slice(0, 400) }, { status: 502 });
  }
}
