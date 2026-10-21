import { NextRequest, NextResponse } from "next/server";
import {
  moldeDeNotaFiscal,
  ligarNotaFiscalEmTodas,
  emitirNotasPendentes,
} from "@/lib/notaFiscalAutomatica";
import { getGateway } from "@/lib/gateway";
import { prisma } from "@/lib/prisma";

/**
 * Emissão automática de NFS-e — simulação e aplicação.
 *
 * GET  ?secret=  → só lê: qual molde seria usado, quais assinaturas já têm
 *                  emissão ligada e quais mensalidades pagas estão sem nota.
 *                  Não escreve nada em lugar nenhum.
 * POST ?secret=  → aplica: liga a emissão nas assinaturas que faltam e emite
 *                  as notas das mensalidades pendentes.
 *
 * Existe porque o Asaas só responde a quem tem a chave, e a chave só existe
 * em produção. Testar "de fora" não dá; testar por aqui, primeiro olhando e
 * depois aplicando, dá.
 */
function autorizado(req: NextRequest): boolean {
  const secret = new URL(req.url).searchParams.get("secret");
  return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });

  const gw = await getGateway();
  const molde = await moldeDeNotaFiscal();

  const contas = await prisma.conta.findMany({
    where: { gatewaySubscriptionId: { not: null }, statusAssinatura: { not: "CANCELADA" } },
    select: {
      gatewaySubscriptionId: true, plano: true, statusAssinatura: true,
      empresas: { select: { razaoSocial: true }, take: 1 },
    },
  });
  const assinaturas: Array<Record<string, unknown>> = [];
  for (const c of contas) {
    const cfg = gw.lerConfigNotaFiscal
      ? await gw.lerConfigNotaFiscal(c.gatewaySubscriptionId!).catch(() => null)
      : null;
    assinaturas.push({
      assinatura: c.gatewaySubscriptionId,
      empresa: c.empresas[0]?.razaoSocial ?? "?",
      plano: c.plano,
      status: c.statusAssinatura,
      emissaoLigada: !!(cfg && (cfg.municipalServiceId || cfg.municipalServiceCode)),
      config: cfg,
    });
  }

  const pendentes = await emitirNotasPendentes({ aplicar: false, moldePronto: molde });

  return NextResponse.json({
    gateway: gw.nome,
    molde: { origem: molde.origem, dados: molde.molde },
    assinaturas,
    mensalidadesSemNota: pendentes,
  });
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });

  const molde = await moldeDeNotaFiscal();
  if (!molde.molde) {
    return NextResponse.json({ ok: false, erro: "Sem molde: nenhuma assinatura configurada e nenhuma nota autorizada." }, { status: 409 });
  }
  const assinaturas = await ligarNotaFiscalEmTodas(molde);
  const pendentes = await emitirNotasPendentes({ aplicar: true, moldePronto: molde });

  return NextResponse.json({
    ok: true,
    molde: molde.origem,
    assinaturas,
    emissao: pendentes,
    executadoEm: new Date().toISOString(),
  });
}
