// Validador de CNPJ — função pura, sem dependências. Importável de
// server (zod refine) e client (CnpjInput onBlur).
//
// Algoritmo oficial da Receita Federal:
// - 14 dígitos, todos iguais é inválido (111...1, 000...0, etc.)
// - Calcula 2 dígitos verificadores via pesos 5..2 e 6..2

export function validarCnpj(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  function calcularDigito(base: string, pesos: number[]): number {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calcularDigito(d.slice(0, 12), pesos1);
  if (dv1 !== Number(d[12])) return false;
  const dv2 = calcularDigito(d.slice(0, 13), pesos2);
  return dv2 === Number(d[13]);
}
