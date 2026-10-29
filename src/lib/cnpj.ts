// CNPJ — formato, validação, normalização e máscara em um lugar só.
// Função pura, sem dependências: importável de server (zod refine) e de
// client (campo com máscara).
//
// Desde 31/07/2026 a Receita Federal emite CNPJ ALFANUMÉRICO (IN RFB
// 2.229/2024): as 12 primeiras posições (raiz + ordem) aceitam letras A-Z e
// dígitos; os 2 dígitos verificadores continuam numéricos. Todo CNPJ numérico
// já emitido segue válido e não muda. Igor, 26/10/2026: *"os CNPJs das
// empresas novas serão em formato alfanumérico. O CP SYSTEM ainda não está
// adaptado para isso."*
//
// A regra que mudou no sistema inteiro: limpar CNPJ NÃO é "tirar o que não é
// dígito". Isso apagava as letras e transformava 00.000.000/E08G-12 em doze
// dígitos inválidos — a consulta à Receita falhava, o cadastro barrava e a
// comparação com o CNPJ do órgão nunca batia. Limpar é manter [A-Z0-9], em
// maiúsculas, e TODA comparação, consulta externa e gravação passa por
// `normalizarCnpj`. BrasilAPI e ReceitaWS já respondem ao formato novo
// (conferido em 26/10/2026 com o primeiro CNPJ alfanumérico emitido).
//
// Dígito verificador: os mesmos pesos de sempre (5..2 e 6..2, módulo 11),
// mas cada caractere entra pelo valor ASCII menos 48 — dígito vale ele mesmo,
// A vale 17, B 18 … Z 42. Vetores: 12.ABC.345/01DE-35 (exemplo da
// especificação) e 00.000.000/E08G-12 (primeiro emitido, Banco do Brasil).

/** Com ou sem pontuação; letras nas 12 primeiras posições, DV sempre numérico. */
export const cnpjRegex = /^[A-Z0-9]{2}\.?[A-Z0-9]{3}\.?[A-Z0-9]{3}\/?[A-Z0-9]{4}-?\d{2}$/i;

/**
 * Mantém só letras e dígitos, em maiúsculas. Não corta em 14: quem precisa
 * conferir tamanho confere — assim CNPJ incompleto continua detectável.
 */
export function normalizarCnpj(cnpj: string | null | undefined): string {
  return String(cnpj ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Tem letra em alguma das 12 primeiras posições. */
export function ehCnpjAlfanumerico(cnpj: string): boolean {
  return /[A-Z]/.test(normalizarCnpj(cnpj));
}

function valorDoCaractere(c: string): number {
  return c.charCodeAt(0) - 48;
}

function calcularDigito(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) soma += valorDoCaractere(base[i]) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function validarCnpj(cnpj: string): boolean {
  const d = normalizarCnpj(cnpj);
  if (d.length !== 14) return false;
  if (!/^[A-Z0-9]{12}\d{2}$/.test(d)) return false;
  // Todos iguais (000…0, 111…1, AAA…A) passam no módulo 11 e não existem.
  if (/^(.)\1{13}$/.test(d)) return false;
  if (calcularDigito(d.slice(0, 12), PESOS_1) !== Number(d[12])) return false;
  return calcularDigito(d.slice(0, 13), PESOS_2) === Number(d[13]);
}

/** 12ABC34501DE35 → 12.ABC.345/01DE-35. Fora do tamanho, devolve como veio. */
export function formatarCnpj(cnpj: string): string {
  const d = normalizarCnpj(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Máscara progressiva do campo, enquanto a pessoa digita. */
export function mascararCnpj(raw: string): string {
  const d = normalizarCnpj(raw).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
