import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta, calcularSaldoContrato } from "@/lib/saldo";
import { registrarAuditoria } from "@/lib/auditoria";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.join(",");
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return `${head}\n${body}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const usuario = await exigirUsuario();
  const { tipo } = await params;

  let csv = "";
  let nomeArquivo = "export.csv";

  if (tipo === "atas") {
    const atas = await prisma.ata.findMany({
      where: { empresa: { contaId: usuario.contaId } },
      include: { empresa: true },
      orderBy: { criadoEm: "desc" },
    });
    const linhas: unknown[][] = [];
    for (const a of atas) {
      const s = await calcularSaldoAta(a.id);
      linhas.push([
        a.numero,
        a.empresa.nomeFantasia || a.empresa.razaoSocial,
        a.orgaoNome,
        a.objeto,
        a.tipo,
        a.dataAssinatura.toLocaleDateString("pt-BR"),
        a.vigenciaInicio.toLocaleDateString("pt-BR"),
        a.vigenciaFim.toLocaleDateString("pt-BR"),
        s.valorTotal.toFixed(2),
        s.valorUsado.toFixed(2),
        s.valorDisponivel.toFixed(2),
        s.percentualUsado.toFixed(2),
      ]);
    }
    csv = toCsv(
      ["Número", "Empresa", "Órgão", "Objeto", "Tipo", "Assinatura", "Vigência início", "Vigência fim", "Valor total", "Valor usado", "Valor disponível", "% usado"],
      linhas,
    );
    nomeArquivo = `atas-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (tipo === "contratos") {
    const contratos = await prisma.contrato.findMany({
      where: { empresa: { contaId: usuario.contaId } },
      include: { empresa: true, ata: { select: { numero: true } } },
      orderBy: { criadoEm: "desc" },
    });
    const linhas: unknown[][] = [];
    for (const c of contratos) {
      const s = await calcularSaldoContrato(c.id);
      linhas.push([
        c.numero,
        c.empresa.nomeFantasia || c.empresa.razaoSocial,
        c.orgaoNome,
        c.objeto,
        c.tipo,
        c.ata?.numero || "",
        c.dataAssinatura.toLocaleDateString("pt-BR"),
        c.vigenciaFim.toLocaleDateString("pt-BR"),
        s.valorTotal.toFixed(2),
        s.valorUsado.toFixed(2),
        s.valorDisponivel.toFixed(2),
      ]);
    }
    csv = toCsv(
      ["Número", "Empresa", "Órgão", "Objeto", "Tipo", "Ata vinculada", "Assinatura", "Vigência fim", "Valor total", "Valor executado", "A executar"],
      linhas,
    );
    nomeArquivo = `contratos-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (tipo === "empenhos") {
    const empenhos = await prisma.empenho.findMany({
      where: { empresa: { contaId: usuario.contaId } },
      include: { empresa: true, itens: { select: { valorTotal: true } } },
      orderBy: { criadoEm: "desc" },
    });
    const linhas = empenhos.map((e) => [
      e.numero,
      e.empresa.nomeFantasia || e.empresa.razaoSocial,
      e.orgaoNome,
      e.objeto,
      e.status,
      e.dataEmissao.toLocaleDateString("pt-BR"),
      e.dataPedidoRecebido?.toLocaleDateString("pt-BR") || "",
      e.dataEntrega?.toLocaleDateString("pt-BR") || "",
      e.dataPagamento?.toLocaleDateString("pt-BR") || "",
      e.itens.reduce((s, i) => s + i.valorTotal, 0).toFixed(2),
    ]);
    csv = toCsv(
      ["Número", "Empresa", "Órgão", "Objeto", "Status", "Emissão", "Pedido recebido", "Entrega", "Pagamento", "Valor"],
      linhas,
    );
    nomeArquivo = `empenhos-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    return new NextResponse("Tipo inválido", { status: 400 });
  }

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXPORTAR",
    recurso: tipo,
    resumo: nomeArquivo,
  });

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
