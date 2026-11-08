import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getUsuarioAtual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { dataBr, ehModulo, type DadosExportPlanilha } from "@/lib/planilhaCustos";
import { gerarXlsxPlanilha, nomeArquivoPlanilha } from "@/lib/planilhaCustosExport";
import { PlanilhaCustosPdfDoc } from "@/lib/pdf/planilhaCustosPdf";

// ESP-003: exporta uma versão da planilha de custos em XLSX (padrão) ou PDF
// (?formato=pdf). Exige sessão e a planilha tem de ser da conta.
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await getUsuarioAtual();
  if (!usuario) return new NextResponse("Não autorizado", { status: 401 });

  const p = await prisma.planilhaCustos.findFirst({
    where: { id, contrato: { empresa: { contaId: usuario.contaId } } },
    include: {
      linhas: { orderBy: { ordem: "asc" } },
      contratoItem: { select: { descricao: true, valorUnitario: true } },
      contrato: {
        select: { numero: true, orgaoNome: true, empresa: { select: { razaoSocial: true, nomeFantasia: true } } },
      },
    },
  });
  if (!p) return new NextResponse("Planilha não encontrada", { status: 404 });

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const d: DadosExportPlanilha = {
    contratoNumero: p.contrato.numero,
    orgao: p.contrato.orgaoNome,
    empresa: p.contrato.empresa.nomeFantasia || p.contrato.empresa.razaoSocial,
    funcao: p.funcao,
    itemDescricao: p.contratoItem?.descricao ?? null,
    valorMensalItem: p.contratoItem?.valorUnitario ?? null,
    versao: p.versao,
    dataEfeito: dataBr(p.dataEfeito.toISOString()),
    origem: p.origem,
    origemRef: p.origemRef,
    cct: p.cct,
    totalMensal: p.totalMensal,
    justificativaDivergencia: p.justificativaDivergencia,
    mapeamentoARevisar: p.mapeamentoARevisar,
    linhas: p.linhas.map((l) => ({
      modulo: ehModulo(l.modulo) ? l.modulo : "OUTROS",
      descricao: l.descricao,
      percentual: l.percentual,
      valor: l.valor,
      aRevisar: l.aRevisar,
    })),
    geradoEm: hoje,
  };

  const formato = new URL(req.url).searchParams.get("formato") === "pdf" ? "pdf" : "xlsx";
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXPORTAR",
    recurso: "PlanilhaCustos",
    recursoId: p.id,
    resumo: `Planilha de custos "${p.funcao}" versão ${p.versao} exportada em ${formato.toUpperCase()}`,
  });

  if (formato === "xlsx") {
    const buf = gerarXlsxPlanilha(d);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivoPlanilha(d, "xlsx")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await renderToBuffer(<PlanilhaCustosPdfDoc d={d} />);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivoPlanilha(d, "pdf")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
