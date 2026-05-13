// Labels e metadados dos 5 instrumentos contratuais (art. 95, Lei 14.133/2021).
// Importado por dashboard, listagens e detalhe — única fonte de verdade pro
// texto exibido. Empenhos legacy ficam em NOTA_EMPENHO por default.

import type { InstrumentoContratual } from "@/generated/prisma/client";

export const INSTRUMENTOS: { value: InstrumentoContratual; label: string; curto: string; slug: string }[] = [
  { value: "NOTA_EMPENHO",        label: "Nota de Empenho",            curto: "Empenho", slug: "nota-empenho" },
  { value: "CARTA_CONTRATO",      label: "Carta-Contrato",             curto: "Carta",   slug: "carta-contrato" },
  { value: "AUTORIZACAO_COMPRA",  label: "Autorização de Compra",      curto: "AC",      slug: "autorizacao-compra" },
  { value: "AUTORIZACAO_ENTREGA", label: "Autorização de Entrega",     curto: "AE",      slug: "autorizacao-entrega" },
  { value: "ORDEM_SERVICO",       label: "Ordem de Execução de Serviço", curto: "OS",    slug: "ordem-servico" },
];

const PORENUM = new Map(INSTRUMENTOS.map((i) => [i.value, i]));
const PORSLUG = new Map(INSTRUMENTOS.map((i) => [i.slug, i]));

export function labelInstrumento(inst: InstrumentoContratual | null | undefined): string {
  if (!inst) return "Nota de Empenho";
  return PORENUM.get(inst)?.label ?? "Nota de Empenho";
}

export function labelCurtoInstrumento(inst: InstrumentoContratual | null | undefined): string {
  if (!inst) return "Empenho";
  return PORENUM.get(inst)?.curto ?? "Empenho";
}

export function slugInstrumento(inst: InstrumentoContratual): string {
  return PORENUM.get(inst)?.slug ?? "nota-empenho";
}

export function instrumentoPorSlug(slug: string): InstrumentoContratual | null {
  return PORSLUG.get(slug)?.value ?? null;
}

// Rótulo do "número do registro" — varia por instrumento (Nº do empenho /
// Nº da AE / Nº da OS / ...). Usado como label do campo no formulário.
export function labelNumeroInstrumento(inst: InstrumentoContratual): string {
  switch (inst) {
    case "NOTA_EMPENHO":        return "Nº do Empenho";
    case "CARTA_CONTRATO":      return "Nº da Carta-Contrato";
    case "AUTORIZACAO_COMPRA":  return "Nº da Autorização de Compra";
    case "AUTORIZACAO_ENTREGA": return "Nº da Autorização de Entrega";
    case "ORDEM_SERVICO":       return "Nº da Ordem de Serviço";
  }
}
