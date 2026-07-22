import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// TOTP RFC 6238 / HOTP RFC 4226 — implementacao pura, sem dependencia
// externa. Compativel com Google Authenticator, Authy, 1Password, Microsoft
// Authenticator, todos que suportam TOTP-SHA1 6-digitos com step de 30s.
//
// Regina 22/07 (SEG P1). Escolhas explicitas:
//   - Algoritmo SHA-1 (padrao dos apps — SHA-256 quebra Google Authenticator)
//   - 6 digitos (padrao — 8 quebra alguns apps antigos)
//   - Step de 30s (padrao)
//   - Janela de tolerancia: aceita codigo anterior/atual/proximo (±30s)
//     — permite clock drift + latencia de digitacao sem irritar cliente

const DIGITS = 6;
const STEP_SECONDS = 30;
const WINDOW = 1; // aceita codigo anterior + atual + proximo (=3 codigos)
const ALG = "sha1";

// Alfabeto BASE32 padrao RFC 4648
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function gerarSecretBase32(bytes = 20): string {
  // 20 bytes = 160 bits = padrao RFC 4226. Convertemos direto pra base32.
  const buf = randomBytes(bytes);
  let bits = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += B32_ALPHABET[parseInt(chunk, 2)];
  }
  return out;
}

// Converte BASE32 -> Buffer.
function base32DecodeToBuffer(b32: string): Buffer {
  const clean = b32.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = "";
  for (const c of clean) {
    const idx = B32_ALPHABET.indexOf(c);
    if (idx < 0) throw new Error(`Base32 invalido: char '${c}'`);
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// HOTP RFC 4226 — HMAC-based One Time Password.
function hotp(secretB32: string, counter: bigint): string {
  const key = base32DecodeToBuffer(secretB32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);
  const hmac = createHmac(ALG, key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = bin % 10 ** DIGITS;
  return otp.toString().padStart(DIGITS, "0");
}

// TOTP: counter = floor(unix_time / step)
export function gerarCodigoTotp(secretB32: string, timestampMs = Date.now()): string {
  const counter = BigInt(Math.floor(timestampMs / 1000 / STEP_SECONDS));
  return hotp(secretB32, counter);
}

// Verifica codigo com janela de tolerancia (±WINDOW steps).
// timing-safe comparison pra evitar leak por side-channel.
export function verificarCodigoTotp(secretB32: string, codigo: string, timestampMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(codigo)) return false;
  const counter = BigInt(Math.floor(timestampMs / 1000 / STEP_SECONDS));
  for (let delta = -WINDOW; delta <= WINDOW; delta++) {
    const candidato = hotp(secretB32, counter + BigInt(delta));
    if (candidato.length === codigo.length) {
      const a = Buffer.from(candidato, "utf8");
      const b = Buffer.from(codigo, "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}

// URI otpauth:// pra o QR code — padrao dos apps authenticator.
// https://github.com/google/google-authenticator/wiki/Key-Uri-Format
export function otpauthUri(input: {
  secretBase32: string;
  contaEmail: string;
  issuer?: string;
}): string {
  const issuer = input.issuer ?? "CP System";
  const label = `${issuer}:${input.contaEmail}`;
  const params = new URLSearchParams({
    secret: input.secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

// Recovery codes: 8 codigos alfanumericos de 10 chars, agrupados em
// 2 blocos de 5 pra facilitar copia manual (ex: "H4K9M-QR3XZ").
// Retorna os codigos em CLARO — caller precisa hashear com bcrypt antes
// de gravar e mostrar 1 unica vez pro cliente.
export function gerarRecoveryCodes(qtd = 8): string[] {
  const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I/L pra evitar confusao
  const codes: string[] = [];
  for (let i = 0; i < qtd; i++) {
    const buf = randomBytes(10);
    let raw = "";
    for (const b of buf) raw += alfabeto[b % alfabeto.length];
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}
