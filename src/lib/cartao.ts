/**
 * Validação e parsing de cartão de crédito.
 * Usado tanto no client (máscara/feedback) quanto no server (validação final).
 *
 * IMPORTANTE: nunca persistimos o PAN (Primary Account Number) — só últimos 4
 * dígitos + bandeira. O PAN é usado apenas pra validar e (idealmente) tokenizar
 * via gateway antes de descartar.
 */

export type Bandeira = "VISA" | "MASTERCARD" | "AMEX" | "ELO" | "HIPERCARD" | "DINERS" | "DISCOVER" | "JCB" | "DESCONHECIDA";

const REGRAS_BANDEIRA: { bandeira: Bandeira; regex: RegExp; tamanho: number[]; cvvLen: number }[] = [
  { bandeira: "VISA", regex: /^4/, tamanho: [13, 16, 19], cvvLen: 3 },
  // Mastercard 51-55 + 2221-2720
  { bandeira: "MASTERCARD", regex: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/, tamanho: [16], cvvLen: 3 },
  { bandeira: "AMEX", regex: /^3[47]/, tamanho: [15], cvvLen: 4 },
  // Elo (operadora brasileira) — BINs comuns
  {
    bandeira: "ELO",
    regex: /^(401178|401179|438935|457631|457632|431274|451416|457393|504175|627780|636297|636368|(506699|5067[0-6]\d|50677[0-8])|(50900[0-9]|5090[1-9]\d|509[1-9]\d{2})|65003[1-3]|(65003[5-9]|65004\d|65005[0-1])|(65040[5-9]|6504[1-3]\d)|(65048[5-9]|65049\d|6505[0-2]\d|65053[0-8])|(65054[1-9]|6505[5-8]\d|65059[0-8])|(65070\d|65071[0-8])|65072[0-7]|(65090[1-9]|65091\d|650920)|(65165[2-9]|6516[6-7]\d)|(65500\d|65501\d)|(65502[1-9]|6550[3-4]\d|65505[0-8]))/,
    tamanho: [16],
    cvvLen: 3,
  },
  { bandeira: "HIPERCARD", regex: /^(606282|3841)/, tamanho: [16, 19], cvvLen: 3 },
  { bandeira: "DINERS", regex: /^3(0[0-5]|[68])/, tamanho: [14], cvvLen: 3 },
  { bandeira: "DISCOVER", regex: /^(6011|65|64[4-9])/, tamanho: [16], cvvLen: 3 },
  { bandeira: "JCB", regex: /^35(2[89]|[3-8])/, tamanho: [16], cvvLen: 3 },
];

export function detectarBandeira(numero: string): Bandeira {
  const limpo = numero.replace(/\D/g, "");
  for (const r of REGRAS_BANDEIRA) {
    if (r.regex.test(limpo)) return r.bandeira;
  }
  return "DESCONHECIDA";
}

export function tamanhoEsperado(bandeira: Bandeira): number[] {
  return REGRAS_BANDEIRA.find((r) => r.bandeira === bandeira)?.tamanho ?? [13, 14, 15, 16, 19];
}

export function tamanhoCvv(bandeira: Bandeira): number {
  return REGRAS_BANDEIRA.find((r) => r.bandeira === bandeira)?.cvvLen ?? 3;
}

/** Algoritmo de Luhn (mod 10) — valida matematicamente o número do cartão. */
export function passaLuhn(numero: string): boolean {
  const d = numero.replace(/\D/g, "");
  if (d.length < 12 || d.length > 19) return false;
  let soma = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
    alt = !alt;
  }
  return soma % 10 === 0;
}

/** Máscara visual: "1234 5678 9012 3456" (Visa/MC) ou "1234 567890 12345" (Amex). */
export function mascararNumero(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 19);
  const b = detectarBandeira(d);
  if (b === "AMEX") {
    return d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
  }
  if (b === "DINERS") {
    return d.replace(/^(\d{0,4})(\d{0,6})(\d{0,4}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
  }
  // Default: 4-4-4-4
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/** Máscara MM/AA */
export function mascararValidade(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export type ValidacaoCartao =
  | { ok: true; bandeira: Bandeira; ultimos4: string; validadeMes: number; validadeAno: number }
  | { ok: false; campo: "numero" | "validade" | "cvv" | "nome"; mensagem: string };

/**
 * Valida cartão completo (server-side, antes de tokenizar/persistir).
 * - Número: 12-19 dígitos + Luhn + bandeira reconhecida + tamanho compatível
 * - Validade: MM/AA, mês 01-12, ano >= ano atual (e mês >= mês atual se ano = atual)
 * - CVV: comprimento compatível com a bandeira
 * - Nome: pelo menos 2 palavras
 */
export function validarCartao(input: {
  numero: string;
  validade: string;
  cvv: string;
  nome: string;
}): ValidacaoCartao {
  const num = input.numero.replace(/\D/g, "");
  if (num.length < 12) return { ok: false, campo: "numero", mensagem: "Número do cartão muito curto" };

  const bandeira = detectarBandeira(num);
  if (bandeira === "DESCONHECIDA") {
    return { ok: false, campo: "numero", mensagem: "Bandeira não reconhecida" };
  }
  if (!tamanhoEsperado(bandeira).includes(num.length)) {
    return { ok: false, campo: "numero", mensagem: `Cartão ${bandeira} deve ter ${tamanhoEsperado(bandeira).join(" ou ")} dígitos` };
  }
  if (!passaLuhn(num)) {
    return { ok: false, campo: "numero", mensagem: "Número do cartão inválido (não passa na verificação)" };
  }

  // Validade
  const validade = input.validade.replace(/\D/g, "");
  if (validade.length !== 4) {
    return { ok: false, campo: "validade", mensagem: "Validade no formato MM/AA" };
  }
  const mes = parseInt(validade.slice(0, 2), 10);
  const ano = 2000 + parseInt(validade.slice(2, 4), 10);
  if (mes < 1 || mes > 12) return { ok: false, campo: "validade", mensagem: "Mês inválido" };
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  if (ano < anoAtual || (ano === anoAtual && mes < mesAtual)) {
    return { ok: false, campo: "validade", mensagem: "Cartão vencido" };
  }
  if (ano > anoAtual + 20) {
    return { ok: false, campo: "validade", mensagem: "Validade implausível" };
  }

  // CVV
  const cvv = input.cvv.replace(/\D/g, "");
  if (cvv.length !== tamanhoCvv(bandeira)) {
    return { ok: false, campo: "cvv", mensagem: `CVV deve ter ${tamanhoCvv(bandeira)} dígitos` };
  }

  // Nome (pelo menos 2 palavras, só letras + espaço)
  const nome = input.nome.trim();
  if (nome.length < 4 || !nome.includes(" ")) {
    return { ok: false, campo: "nome", mensagem: "Nome impresso no cartão (como aparece)" };
  }
  if (!/^[A-Za-zÀ-ÿ\s'.-]+$/.test(nome)) {
    return { ok: false, campo: "nome", mensagem: "Nome com caracteres inválidos" };
  }

  return { ok: true, bandeira, ultimos4: num.slice(-4), validadeMes: mes, validadeAno: ano };
}
