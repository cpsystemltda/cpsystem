import "server-only";
import * as XLSX from "xlsx";

/**
 * Planilha de custos em Excel (ESP-003, RN01): a API da IA lê PDF, não
 * .xlsx — então cada aba vira CSV e vai como texto. Mantém o nome da aba
 * porque muitas propostas trazem uma função por aba.
 */
export function excelParaTexto(bytes: ArrayBuffer | Buffer): string {
  const wb = XLSX.read(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes), { type: "buffer", cellDates: false });
  const partes: string[] = [];
  for (const nome of wb.SheetNames) {
    const sheet = wb.Sheets[nome];
    if (!sheet || !sheet["!ref"]) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false, FS: ";" }).trim();
    if (!csv) continue;
    partes.push(`### Aba: ${nome}\n${csv}`);
  }
  return partes.join("\n\n");
}

export function ehArquivoExcel(f: { name: string; type: string }): boolean {
  const n = f.name.toLowerCase();
  return (
    n.endsWith(".xlsx") ||
    n.endsWith(".xls") ||
    f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    f.type === "application/vnd.ms-excel"
  );
}

export function ehArquivoPdf(f: { name: string; type: string }): boolean {
  return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
}
