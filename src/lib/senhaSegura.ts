import "server-only";
import { createHash } from "node:crypto";

// Validacao de senha forte + HIBP check — Regina 21/07/2026 (SEG P0).
//
// Camadas:
//  1) COMPRIMENTO minimo 10 (OWASP 2024/2026 recomenda >=10)
//  2) COMPLEXIDADE ninima (nao pode ser so numeros nem so letras minusculas)
//  3) NAO conter o email nem parte antes do @
//  4) NAO conter nome/primeiro nome do proprio usuario
//  5) NAO estar em base HIBP (Have I Been Pwned) — sabidamente vazada
//
// HIBP usa k-anonymity: enviamos so os primeiros 5 chars do SHA-1 e recebemos
// os suffixos + contagens. Nunca sai a senha nem o hash completo.

const HIBP_URL = "https://api.pwnedpasswords.com/range";
const HIBP_TIMEOUT_MS = 3000;

export type ValidacaoSenhaResult =
  | { ok: true }
  | { ok: false; erro: string };

export type ContextoUsuario = {
  email?: string;
  nome?: string;
};

const SENHAS_TRIVIAIS = new Set([
  "cpsystem",
  "contratospublicos",
  "contratos",
  "1234567890",
  "senha12345",
  "abc12345",
]);

function contemInsensitive(haystack: string, needle: string): boolean {
  if (!needle || needle.length < 4) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

// Validacao sincrona (sem HIBP). Rapida, chamada primeiro pra evitar
// HTTP externo desnecessario quando a senha ja falha nas regras basicas.
export function validarSenhaBasica(senha: string, ctx: ContextoUsuario): ValidacaoSenhaResult {
  if (typeof senha !== "string") return { ok: false, erro: "Senha inválida." };
  if (senha.length < 10) return { ok: false, erro: "A senha precisa ter no mínimo 10 caracteres." };
  if (senha.length > 200) return { ok: false, erro: "Senha excede o tamanho máximo." };

  const soDigitos = /^\d+$/.test(senha);
  if (soDigitos) return { ok: false, erro: "A senha não pode ser só números." };

  const soMinusculas = /^[a-z]+$/.test(senha);
  if (soMinusculas) return { ok: false, erro: "Combine letras maiúsculas, minúsculas ou números." };

  if (SENHAS_TRIVIAIS.has(senha.toLowerCase())) {
    return { ok: false, erro: "Essa senha é muito comum. Escolha uma diferente." };
  }

  if (ctx.email) {
    const localPart = ctx.email.split("@")[0];
    if (localPart && contemInsensitive(senha, localPart)) {
      return { ok: false, erro: "A senha não pode conter o seu e-mail." };
    }
  }

  if (ctx.nome) {
    const primeiro = primeiroNome(ctx.nome);
    if (primeiro.length >= 4 && contemInsensitive(senha, primeiro)) {
      return { ok: false, erro: "A senha não pode conter o seu nome." };
    }
  }

  return { ok: true };
}

// Verifica se a senha esta na base HIBP. Retorna a contagem de vazamentos
// (0 = nao vazou). Usa k-anonymity — envia so os primeiros 5 chars do SHA-1.
// Timeout curto (3s) e fail-open: se a API estiver fora, deixa passar (com log).
// Fail-open eh proposital: nao vamos derrubar signup por API terceira quebrada.
export async function verificarHibp(senha: string): Promise<number> {
  const sha1 = createHash("sha1").update(senha).digest("hex").toUpperCase();
  const prefixo = sha1.slice(0, 5);
  const sufixoAlvo = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
  try {
    const resp = await fetch(`${HIBP_URL}/${prefixo}`, {
      signal: controller.signal,
      headers: { "Add-Padding": "true" }, // HIBP add padding pra dificultar analise de trafego
    });
    if (!resp.ok) return 0;
    const texto = await resp.text();
    for (const linha of texto.split("\n")) {
      const [suf, cnt] = linha.trim().split(":");
      if (suf?.toUpperCase() === sufixoAlvo) return Number(cnt) || 1;
    }
    return 0;
  } catch (err) {
    console.warn("[hibp] falha ao consultar HIBP (fail-open):", err instanceof Error ? err.message : err);
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

// Validacao completa (basica + HIBP). Chame na server action de signup/reset.
export async function validarSenhaSegura(senha: string, ctx: ContextoUsuario): Promise<ValidacaoSenhaResult> {
  const basica = validarSenhaBasica(senha, ctx);
  if (!basica.ok) return basica;

  const cnt = await verificarHibp(senha);
  if (cnt > 0) {
    return {
      ok: false,
      erro: `Essa senha aparece em ${cnt.toLocaleString("pt-BR")} vazamentos conhecidos. Escolha uma senha diferente.`,
    };
  }

  return { ok: true };
}
