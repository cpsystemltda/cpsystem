/**
 * Validação de CPF pelos dígitos verificadores.
 *
 * Regina 21/09/2026, depois do cadastro falso de analista: *"temos que ter uma
 * proteção rigorosa para cadastro falso. Pessoas com cadastro falso não podem
 * acessar nosso sistema."*
 *
 * O cadastro de analista só conferia o FORMATO (`\d{3}.\d{3}.\d{3}-\d{2}`), que
 * qualquer sequência inventada satisfaz. Os dois CPFs que já entraram são
 * válidos por sorte, não por controle.
 *
 * Isto pesa mais no analista do que no cliente: ele enxerga carteira de empresa
 * e recebe comissão nossa em conta bancária. Cadastro sem identificação real
 * nesse perfil é dinheiro saindo para alguém que não sabemos quem é.
 */
export function validarCpf(bruto: string): boolean {
  const cpf = (bruto || "").replace(/\D/g, "");
  if (cpf.length !== 11) return false;

  // 000.000.000-00, 111.111.111-11 etc. passam na conta dos dígitos, mas não
  // são CPF de ninguém — é o preenchimento preguiçoso mais comum.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Só os dígitos — para gravar e comparar sem depender da máscara. */
export function normalizarCpf(bruto: string): string {
  return (bruto || "").replace(/\D/g, "");
}
