// Helpers de Vigência — compartilhados entre NovaAtaForm e NovoContratoForm
// (Módulo 3.1 e 3.2). Bloco de Vigência tem 3 campos: Início (usuário),
// Prazo (qtd + DIAS|MESES|ANOS), Fim (calculado).

export type UnidadeVigencia = "DIAS" | "MESES" | "ANOS";

// Soma um prazo (qtd + unidade) à data de início e devolve "YYYY-MM-DD" da
// data fim. JS preserva o dia ao somar meses/anos quando possível (15/10 +
// 1 ano → 15/10 do ano seguinte; 31/01 + 1 mês → 02/03, por overflow).
export function calcularVigenciaFim(
  inicio: string,
  qtd: number,
  unidade: UnidadeVigencia,
): string {
  if (!inicio || !qtd || qtd <= 0) return "";
  const [a, m, d] = inicio.split("-").map(Number);
  if (!a || !m || !d) return "";
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (unidade === "DIAS") dt.setUTCDate(dt.getUTCDate() + qtd);
  else if (unidade === "MESES") dt.setUTCMonth(dt.getUTCMonth() + qtd);
  else dt.setUTCFullYear(dt.getUTCFullYear() + qtd);
  return dt.toISOString().slice(0, 10);
}

// Em modo editar, descobre qual qtd/unidade gera o vigenciaFim cadastrado.
// Tenta ANOS, MESES, DIAS nessa ordem (Atas/Contratos costumam ser em anos).
// Se nada bater exatamente, devolve dias direto.
export function detectarPrazoVigencia(
  inicio: string,
  fim: string,
): { qtd: number; unidade: UnidadeVigencia } | null {
  if (!inicio || !fim) return null;
  for (let anos = 1; anos <= 20; anos++) {
    if (calcularVigenciaFim(inicio, anos, "ANOS") === fim) return { qtd: anos, unidade: "ANOS" };
  }
  for (let meses = 1; meses <= 240; meses++) {
    if (calcularVigenciaFim(inicio, meses, "MESES") === fim) return { qtd: meses, unidade: "MESES" };
  }
  const [ai, mi, di] = inicio.split("-").map(Number);
  const [af, mf, df] = fim.split("-").map(Number);
  if (!ai || !af) return null;
  const di1 = Date.UTC(ai, mi - 1, di);
  const di2 = Date.UTC(af, mf - 1, df);
  return { qtd: Math.round((di2 - di1) / 86400000), unidade: "DIAS" };
}

export function formatarCnpjInput(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatarCepInput(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// Re-export pra manter API estável em quem importava deste arquivo
export { validarCnpj } from "@/lib/cnpj";
