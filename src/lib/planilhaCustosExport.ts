import "server-only";
import * as XLSX from "xlsx";
import {
  MODULOS,
  ROTULO_ORIGEM,
  derivadosDaPlanilha,
  slugFuncao,
  subtotalPorModulo,
  type DadosExportPlanilha,
} from "@/lib/planilhaCustos";

/**
 * Exportação da planilha de custos em Excel (ESP-003). Regina 07/11/2026:
 * arquivo sempre com título dentro da planilha e nome descritivo.
 */
export function gerarXlsxPlanilha(d: DadosExportPlanilha): Buffer {
  const aoa: (string | number | null)[][] = [];
  aoa.push([`Planilha de custos e formação de preços — ${d.funcao}`]);
  aoa.push([`Contrato ${d.contratoNumero} · ${d.orgao} · ${d.empresa}`]);
  aoa.push([
    `Versão ${d.versao} · efeito a partir de ${d.dataEfeito} · origem: ${ROTULO_ORIGEM[d.origem] ?? d.origem}${d.origemRef ? ` (${d.origemRef})` : ""}`,
  ]);
  if (d.cct) aoa.push([`Convenção coletiva: ${d.cct}`]);
  if (d.itemDescricao) aoa.push([`Item do contrato: ${d.itemDescricao}`]);
  aoa.push([]);
  aoa.push(["Módulo", "Descrição", "Percentual (%)", "Valor (R$)"]);
  const inicioDados = aoa.length;

  const sub = subtotalPorModulo(d.linhas);
  for (const m of MODULOS) {
    const ls = d.linhas.filter((l) => l.modulo === m.codigo);
    if (ls.length === 0) continue;
    aoa.push([m.titulo, null, null, null]);
    for (const l of ls) aoa.push([m.codigo, l.descricao + (l.aRevisar ? " (a revisar)" : ""), l.percentual, l.valor]);
    aoa.push([null, `Subtotal — ${m.titulo}`, null, sub[m.codigo] ?? 0]);
  }
  aoa.push([null, "TOTAL MENSAL POR POSTO", null, d.totalMensal]);
  if (d.valorMensalItem != null) {
    aoa.push([null, "Valor mensal unitário do item no contrato", null, d.valorMensalItem]);
    aoa.push([null, "Diferença (planilha - contrato)", null, Math.round((d.totalMensal - d.valorMensalItem) * 100) / 100]);
  }
  if (d.justificativaDivergencia) aoa.push([null, `Justificativa da divergência: ${d.justificativaDivergencia}`]);
  if (d.mapeamentoARevisar) aoa.push([null, "Atenção: há linhas classificadas por aproximação (mapeamento a revisar)."]);
  aoa.push([]);
  aoa.push([`Gerado pelo CP System em ${d.geradoEm}`]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 10 }, { wch: 64 }, { wch: 15 }, { wch: 18 }];
  ws["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: 3 } }));
  // Formato numérico nas colunas de percentual e valor.
  for (let r = inicioDados; r < aoa.length; r++) {
    const pct = ws[XLSX.utils.encode_cell({ r, c: 2 })];
    if (pct && typeof pct.v === "number") pct.z = "0.00";
    const val = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (val && typeof val.v === "number") val.z = "#,##0.00";
  }

  const der = derivadosDaPlanilha(d.linhas);
  const pct = (v: number | null) => (v == null ? "não identificado" : v);
  const aoa2: (string | number | null)[][] = [
    [`Dados derivados — ${d.funcao} (versão ${d.versao})`],
    ["Usados pela conta vinculada, pela repactuação e pelos relatórios."],
    [],
    ["Dado", "Valor"],
    ["Salário-base (R$)", der.salarioBase ?? "não identificado"],
    ["Remuneração — módulo 1 (R$)", der.remuneracao],
    ["13º salário (%)", pct(der.pct13)],
    ["Férias e 1/3 (%)", pct(der.pctFerias)],
    ["Multa do FGTS (%)", pct(der.pctMultaFgts)],
    ["Incidência do submódulo 2.2 (%)", pct(der.pctIncidencia22)],
    ["Insumos — módulo 5 (R$)", der.insumos],
    ["Custos indiretos (%)", pct(der.pctCustosIndiretos)],
    ["Lucro (%)", pct(der.pctLucro)],
    ["Tributos (%)", pct(der.pctTributos)],
    ["Mão de obra — módulos 1 a 4 (R$)", der.totalMaoDeObra],
    ["Módulo 6 (R$)", der.totalModulo6],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
  ws2["!cols"] = [{ wch: 40 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Planilha de custos");
  XLSX.utils.book_append_sheet(wb, ws2, "Dados derivados");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function nomeArquivoPlanilha(d: DadosExportPlanilha, ext: "xlsx" | "pdf"): string {
  const contrato = d.contratoNumero.replace(/[^\w.-]+/g, "-");
  return `planilha-custos-${slugFuncao(d.funcao) || "funcao"}-v${d.versao}-contrato-${contrato}.${ext}`;
}
