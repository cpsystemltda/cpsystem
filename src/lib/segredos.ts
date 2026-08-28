import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * Cifra segredos de terceiros guardados no banco (hoje: token da API fiscal).
 *
 * Por que cifrar: o token fiscal EMITE NOTA EM NOME DA EMPRESA do cliente. Um
 * vazamento do banco com o token em texto puro permite emitir nota no CNPJ
 * dele — dano fiscal, não só constrangimento. Cifrado, quem tiver o dump ainda
 * precisa da chave, que vive só na variável de ambiente.
 *
 * AES-256-GCM: além de cifrar, autentica. Se alguém alterar um byte do valor
 * guardado, a decifragem falha em vez de devolver lixo silencioso.
 *
 * A chave vem de SEGREDO_CHAVE. Sem ela, `cifrar` FALHA em vez de guardar em
 * texto puro: guardar sem cifra "só por enquanto" é como esses buracos duram
 * meses.
 */

const PREFIXO = "v1";

function chave(): Buffer {
  const bruta = process.env.SEGREDO_CHAVE || "";
  if (!bruta || bruta.length < 16) {
    throw new Error(
      "SEGREDO_CHAVE não configurada (mínimo 16 caracteres). " +
        "Sem ela o sistema se recusa a guardar segredo de terceiro no banco.",
    );
  }
  // Deriva 32 bytes de qualquer string suficientemente longa — evita exigir
  // que a chave seja base64 de tamanho exato pra funcionar.
  return createHash("sha256").update(bruta).digest();
}

export function segredoConfigurado(): boolean {
  return (process.env.SEGREDO_CHAVE || "").length >= 16;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [PREFIXO, iv.toString("base64"), tag.toString("base64"), dados.toString("base64")].join(":");
}

export function decifrar(blob: string): string {
  const partes = blob.split(":");
  if (partes.length !== 4 || partes[0] !== PREFIXO) {
    throw new Error("Segredo em formato desconhecido.");
  }
  const [, ivB64, tagB64, dadosB64] = partes;
  const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(ivB64, "base64"));
  d.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([d.update(Buffer.from(dadosB64, "base64")), d.final()]).toString("utf8");
}

/** Mostra só o fim do segredo, pra tela confirmar "é este" sem revelar o valor. */
export function mascarar(texto: string): string {
  if (texto.length <= 4) return "••••";
  return `••••${texto.slice(-4)}`;
}
