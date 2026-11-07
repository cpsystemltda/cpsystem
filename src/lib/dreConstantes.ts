/**
 * Constantes e helpers do DRE que o cliente (formulário) também usa.
 * Sem `server-only`: o que acessa o banco fica em `dre.ts`.
 */

export const CATEGORIAS_DESPESA = [
  "INFRAESTRUTURA",
  "IA",
  "FERRAMENTAS",
  "MARKETING",
  "CONTABILIDADE",
  "IMPOSTOS",
  "PESSOAL",
  "OUTROS",
] as const;
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

export const ROTULO_CATEGORIA: Record<CategoriaDespesa, string> = {
  INFRAESTRUTURA: "Infraestrutura (Vercel, Neon, domínio)",
  IA: "IA (Anthropic)",
  FERRAMENTAS: "Ferramentas (Z-API, Google, Asaas)",
  MARKETING: "Marketing (Google Ads, materiais)",
  CONTABILIDADE: "Contabilidade",
  IMPOSTOS: "Impostos e taxas",
  PESSOAL: "Pessoal e serviços",
  OUTROS: "Outros",
};

export function ehCategoria(s: string): s is CategoriaDespesa {
  return (CATEGORIAS_DESPESA as readonly string[]).includes(s);
}

/** YYYY-MM do mês em Brasília. */
export function competenciaAtualBrt(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

/** Lista de competências de `de` até `ate`, inclusive, em ordem crescente. */
export function competenciasEntre(de: string, ate: string): string[] {
  const [a0, m0] = de.split("-").map(Number);
  const [a1, m1] = ate.split("-").map(Number);
  const lista: string[] = [];
  for (let a = a0, m = m0; a < a1 || (a === a1 && m <= m1); ) {
    lista.push(`${a}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
  }
  return lista;
}

export function somarMeses(competencia: string, n: number): string {
  const [a, m] = competencia.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function rotuloMes(competencia: string): string {
  const [a, m] = competencia.split("-").map(Number);
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[m - 1]}/${String(a).slice(2)}`;
}
