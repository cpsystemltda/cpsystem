/**
 * Checklist mensal de comprovação trabalhista e previdenciária (ESP-009,
 * Igor 07/11/2026). Funções puras.
 */

export type StatusItemChecklist = "PENDENTE" | "ANEXADO" | "ENVIADO" | "ACEITO" | "DEVOLVIDO";
export const STATUS_ITEM: StatusItemChecklist[] = ["PENDENTE", "ANEXADO", "ENVIADO", "ACEITO", "DEVOLVIDO"];
export const ROTULO_STATUS_ITEM: Record<StatusItemChecklist, string> = {
  PENDENTE: "Pendente",
  ANEXADO: "Anexado",
  ENVIADO: "Enviado ao órgão",
  ACEITO: "Aceito",
  DEVOLVIDO: "Devolvido",
};

export type ItemModelo = { codigo: string; nome: string; descricao?: string; obrigatorio: boolean; temValidade?: boolean; prazoDiaMesSeguinte?: number | null };

/** Lei 14.133, art. 50, I a VI — obrigatórios no regime novo. */
export const ITENS_ART_50: ItemModelo[] = [
  { codigo: "PONTO", nome: "Registro de ponto dos empregados", descricao: "Art. 50, I", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "FOLHA", nome: "Recibos de salários, adicionais, horas extras, repouso remunerado e 13º", descricao: "Art. 50, II", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "FGTS", nome: "Comprovante de depósito do FGTS", descricao: "Art. 50, III", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "FERIAS", nome: "Recibos de férias e adicional de 1/3 (quando houver)", descricao: "Art. 50, IV", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "RESCISOES", nome: "Comprovantes de quitação de rescisões (quando houver)", descricao: "Art. 50, V", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "BENEFICIOS", nome: "Comprovantes de vale-transporte e vale-alimentação", descricao: "Art. 50, VI", obrigatorio: true, prazoDiaMesSeguinte: 10 },
];

/** Lei 8.666 (DF/União: IN SEGES/MP 5/2017, Anexo VIII-B). */
export const ITENS_IN_5_2017: ItemModelo[] = [
  { codigo: "FOLHA", nome: "Folha de pagamento analítica e comprovantes de pagamento dos salários", descricao: "IN 5/2017, Anexo VIII-B", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "PONTO", nome: "Registro de ponto dos empregados", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "BENEFICIOS", nome: "Comprovantes de vale-transporte e auxílio-alimentação", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "FGTS", nome: "Guia e comprovante de recolhimento do FGTS (FGTS Digital)", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "INSS", nome: "Guia e comprovante de recolhimento do INSS (DCTFWeb/DARF)", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "FERIAS", nome: "Recibos de férias e 1/3 (quando houver)", obrigatorio: true, prazoDiaMesSeguinte: 10 },
  { codigo: "RESCISOES", nome: "Comprovantes de quitação de rescisões (quando houver)", obrigatorio: true, prazoDiaMesSeguinte: 10 },
];

/** Itens adicionais comuns (RN01) — entram desmarcados; o contrato liga o que o órgão exige. */
export const ITENS_ADICIONAIS: ItemModelo[] = [
  { codigo: "CND_FEDERAL", nome: "Certidão negativa de débitos federais (CND/RFB-PGFN)", obrigatorio: false, temValidade: true },
  { codigo: "CRF_FGTS", nome: "Certificado de regularidade do FGTS (CRF)", obrigatorio: false, temValidade: true },
  { codigo: "CNDT", nome: "Certidão negativa de débitos trabalhistas (CNDT)", obrigatorio: false, temValidade: true },
  { codigo: "CND_ESTADUAL", nome: "Certidão negativa estadual", obrigatorio: false, temValidade: true },
  { codigo: "CND_MUNICIPAL", nome: "Certidão negativa municipal", obrigatorio: false, temValidade: true },
  { codigo: "INSS", nome: "Guia e comprovante do INSS (DCTFWeb/DARF)", obrigatorio: false },
  { codigo: "FGTS_DIGITAL", nome: "Guia do FGTS Digital", obrigatorio: false },
  { codigo: "RELACAO_COLABORADORES", nome: "Relação de colaboradores do mês (postos e alocação)", obrigatorio: false },
];

/** Modelo inicial do contrato pelo regime (RN01); sem repetir código. */
export function modeloPorRegime(regime: string | null | undefined): ItemModelo[] {
  const base = regime === "LEI_14133" ? ITENS_ART_50 : ITENS_IN_5_2017;
  const vistos = new Set(base.map((i) => i.codigo));
  const extras = ITENS_ADICIONAIS.filter((i) => !vistos.has(i.codigo));
  return [...base, ...extras].map((i, k) => ({ ...i, ordem: k } as ItemModelo & { ordem: number }));
}

export function itemCompleto(status: StatusItemChecklist): boolean {
  return status === "ENVIADO" || status === "ACEITO";
}

/** RN05: todos os obrigatórios enviados/aceitos; RN05 inverso: algum obrigatório devolvido. */
export function situacaoChecklist(itens: { obrigatorio: boolean; status: StatusItemChecklist }[]): { completo: boolean; devolvido: boolean; pendentes: number; obrigatorios: number } {
  const obr = itens.filter((i) => i.obrigatorio);
  const pendentes = obr.filter((i) => !itemCompleto(i.status)).length;
  return { completo: obr.length > 0 && pendentes === 0, devolvido: obr.some((i) => i.status === "DEVOLVIDO"), pendentes, obrigatorios: obr.length };
}

const DIA_MS = 86_400_000;
function diaUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** RN03: prazo = dia N do mês seguinte ao fim da competência (limitado ao último dia do mês). */
export function prazoDoItem(periodoFim: Date, diaMesSeguinte: number | null | undefined): Date | null {
  if (!diaMesSeguinte) return null;
  const f = diaUtc(periodoFim);
  const ano = f.getUTCFullYear();
  const mes0 = f.getUTCMonth() + 1;
  const ultimo = new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes0, Math.min(diaMesSeguinte, ultimo), 12));
}

/** RN04: certidão vale para a competência se a validade alcança o fim do período. */
export function certidaoCobre(validade: Date | null | undefined, periodoFim: Date): boolean {
  return !!validade && diaUtc(validade).getTime() >= diaUtc(periodoFim).getTime();
}

/** RN04: alerta 15 dias antes do vencimento (ou já vencida). */
export function alertaValidade(validade: Date | null | undefined, hoje: Date): { tipo: "VENCE_EM_BREVE" | "VENCIDA"; dias: number } | null {
  if (!validade) return null;
  const dias = Math.ceil((diaUtc(validade).getTime() - diaUtc(hoje).getTime()) / DIA_MS);
  if (dias < 0) return { tipo: "VENCIDA", dias: -dias };
  if (dias <= 15) return { tipo: "VENCE_EM_BREVE", dias };
  return null;
}

/** RN06: competências com documentação completa/incompleta e dias médios do fim da competência ao envio. */
export function indicadorChecklist(competencias: { periodoFim: Date; itens: { obrigatorio: boolean; status: StatusItemChecklist; dataEnvio: Date | null }[] }[]): { completas: number; incompletas: number; semChecklist: number; diasMediosEnvio: number | null } {
  let completas = 0;
  let incompletas = 0;
  let semChecklist = 0;
  const dias: number[] = [];
  for (const c of competencias) {
    if (c.itens.length === 0) {
      semChecklist++;
      continue;
    }
    const s = situacaoChecklist(c.itens);
    if (s.completo) {
      completas++;
      const envios = c.itens.filter((i) => i.obrigatorio && i.dataEnvio).map((i) => diaUtc(i.dataEnvio as Date).getTime());
      if (envios.length) dias.push(Math.max(0, Math.round((Math.max(...envios) - diaUtc(c.periodoFim).getTime()) / DIA_MS)));
    } else incompletas++;
  }
  return { completas, incompletas, semChecklist, diasMediosEnvio: dias.length ? Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10 : null };
}

/** Nome de arquivo no padrão "AAAA-MM_item_documento" (ESP-010 RN02). */
export function nomeArquivoDossie(competencia: string, codigo: string, nomeOriginal: string): string {
  const ext = (nomeOriginal.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? "").toLowerCase();
  const base = nomeOriginal
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${competencia}_${codigo}_${base || "documento"}${ext}`;
}
