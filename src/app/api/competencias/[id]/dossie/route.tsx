import { bloqueioModulo } from "@/lib/faixasTerceirizacaoServer";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { zipSync, strToU8 } from "fflate";
import { getUsuarioAtual } from "@/lib/auth";
import { lerBytesDoAnexo } from "@/lib/anexoBytes";
import { podeVerDadosColaboradores } from "@/lib/lgpd";
import { registrarAcessoDadosPessoais } from "@/lib/lgpdServer";
import { registrarAuditoria } from "@/lib/auditoria";
import { montarDossie, nomeBaseDossie, registrarGeracao, xlsxQuadro } from "@/lib/dossieServer";
import { DossiePdfDoc } from "@/lib/pdf/dossiePdf";

// ESP-010: dossiê da competência — ?formato=pdf (padrão) | zip | xlsx.
// O ZIP traz o PDF, o quadro em Excel e todos os anexos da competência.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await getUsuarioAtual();
  if (!usuario) return new NextResponse("Não autorizado", { status: 401 });
  const bloqueio = await bloqueioModulo(usuario.contaId, "leitura"); // ESP-011 RN07: exportar vale nos 90 dias
  if (bloqueio) return new NextResponse(bloqueio, { status: 403 });
  const podeVer = podeVerDadosColaboradores(usuario);
  const d = await montarDossie(id, usuario.contaId, podeVer);
  if (!d) return new NextResponse("Competência não encontrada", { status: 404 });
  const formato = (new URL(req.url).searchParams.get("formato") || "pdf").toLowerCase();
  const base = nomeBaseDossie(d);

  if (podeVer && d.alocacoes.length) {
    await registrarAcessoDadosPessoais({ contaId: usuario.contaId, usuarioId: usuario.id, recurso: "ColaboradoresLista", recursoId: d.competencia.id, resumo: `Gerou o dossiê de ${d.rotulo} (contrato ${d.contrato.numero}) com ${d.alocacoes.length} alocação(ões)` });
  }
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "EXPORTAR", recurso: "Competencia", recursoId: d.competencia.id, resumo: `Dossiê ${d.rotulo} v${d.versao} (${formato.toUpperCase()})${d.incompleto ? " — INCOMPLETO" : ""}` });

  if (formato === "xlsx") {
    await registrarGeracao(d, "XLSX", usuario.id);
    return new NextResponse(new Uint8Array(xlsxQuadro(d)), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}-quadro-colaboradores.xlsx"`, "Cache-Control": "private, no-store" },
    });
  }

  const pdf = await renderToBuffer(<DossiePdfDoc d={d} />);
  if (formato !== "zip") {
    await registrarGeracao(d, "PDF", usuario.id);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${base}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }

  const arquivos: Record<string, Uint8Array> = {
    [`${base}.pdf`]: new Uint8Array(pdf),
    [`${base}-quadro-colaboradores.xlsx`]: new Uint8Array(xlsxQuadro(d)),
  };
  const faltaram: string[] = [];
  for (const a of d.anexos) {
    const lido = await lerBytesDoAnexo(a.url, usuario.contaId, !!usuario.superAdmin);
    if (lido) arquivos[`anexos/${a.nomeZip}`] = lido.bytes;
    else faltaram.push(`${a.nomeZip} (${a.origem})`);
  }
  if (faltaram.length) arquivos["LEIA-ME.txt"] = strToU8(`Arquivos que não puderam ser incluídos (estão só no endereço antigo):\n\n${faltaram.join("\n")}\n`);
  const zip = zipSync(arquivos, { level: 0 });
  await registrarGeracao(d, "ZIP", usuario.id);
  return new NextResponse(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"`, "Cache-Control": "private, no-store" },
  });
}
