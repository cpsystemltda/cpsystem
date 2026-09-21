/**
 * Detecta e-mail digitado errado ANTES de ele entrar no sistema.
 *
 * Igor 18/09/2026, ao receber o aviso de que a HMD tinha se cadastrado como
 * `hmdcomercial01@gmial.com`: "não tem como a gente já corrigir isso? E não
 * permita que a pessoa avance com cadastro em caso de dados errados."
 *
 * O `z.string().email()` não pega nada disso: `gmial.com` é estruturalmente um
 * e-mail perfeito. O domínio existe, inclusive — é typosquatting, gente que
 * registra erro de digitação famoso. Ou seja: a mensagem sai, o servidor
 * aceita, e ninguém nunca recebe. **A falha é silenciosa**, que é a pior de
 * todas: a HMD passou três dias sem receber um único e-mail nosso e só
 * descobrimos por acaso.
 *
 * Mesmo raciocínio do telefone da Michelly (ver `signupSchema`): formato certo
 * e valor inexistente na prática. Aqui o campo barra no cadastro.
 */

/** Provedores que concentram os cadastros — a régua para medir distância. */
const PROVEDORES_CONHECIDOS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "ig.com.br",
  "r7.com",
  "yahoo.com.br",
  "hotmail.com.br",
  "outlook.com.br",
] as const;

/**
 * Domínios válidos que ficam a 1 caractere de um provedor e NÃO podem ser
 * barrados. Sem esta lista, o cliente com e-mail legítimo aqui não consegue se
 * cadastrar — e um falso positivo no cadastro custa mais que um e-mail errado.
 */
const DOMINIOS_VALIDOS = new Set<string>([
  ...PROVEDORES_CONHECIDOS,
  "gmail.com.br", // existe e redireciona; não é typo a ponto de barrar
  "live.com.br",
  "aol.com.br",
  "mail.com",
  "email.com",
  "globomail.com",
  "oi.com.br",
  "zipmail.com.br",
]);

/**
 * Erros que já vimos ou que são clássicos. Vale ter a lista explícita além da
 * distância: aqui a correção sugerida é certa, não é palpite.
 */
const TYPOS_CONHECIDOS: Record<string, string> = {
  // gmail
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmaill.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.om": "gmail.com",
  "hmail.com": "gmail.com",
  // hotmail
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cm": "hotmail.com",
  "hotnail.com": "hotmail.com",
  "hotamail.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmail.com.b": "hotmail.com.br",
  // outlook
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outook.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "outlok.com.br": "outlook.com.br",
  // yahoo
  "yaho.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  // icloud
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  "icloud.co": "icloud.com",
  "iclould.com": "icloud.com",
  // brasileiros
  "uol.com": "uol.com.br",
  "bol.com": "bol.com.br",
  "terra.com": "terra.com.br",
  "ig.com": "ig.com.br",
};

/**
 * E-mail descartável — caixa temporária que se autodestrói.
 *
 * Regina 21/09/2026, ao ver um cadastro de analista em `@ghostinbox.store`:
 * *"me parece um robô. Fique atento a ataques de robô na nossa plataforma.
 * Não permita que isso aconteça."*
 *
 * Quem usa esse tipo de endereço não pretende ser encontrado. Num SaaS de
 * contrato público isso é duas coisas ruins ao mesmo tempo: cadastro falso
 * enchendo a base de analista fantasma, e alguém entrando sem rastro. Perfil
 * de analista é mais sensível que o de empresa, porque analista vê carteira de
 * cliente e recebe comissão.
 *
 * Lista curada de propósito, com os provedores conhecidos. Não uso heurística
 * de "nome aleatório" nem de TLD incomum: barraria cliente legítimo, e barrar
 * cliente de verdade custa mais que deixar passar um cadastro falso.
 */
const DOMINIOS_DESCARTAVEIS = new Set<string>([
  "ghostinbox.store",
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "sharklasers.com",
  "grr.la",
  "spam4.me",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "tempmailo.com",
  "yopmail.com",
  "yopmail.fr",
  "throwawaymail.com",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "trashmail.com",
  "trashmail.de",
  "fakeinbox.com",
  "mohmal.com",
  "inboxkitten.com",
  "emailondeck.com",
  "mailnesia.com",
  "mytemp.email",
  "burnermail.io",
  "moakt.com",
  "tmpmail.org",
  "minuteinbox.com",
  "harakirimail.com",
  "spambog.com",
  "mailcatch.com",
  "discard.email",
  "anonbox.net",
  "tempr.email",
  "mail-temporaire.fr",
  "correotemporal.org",
  "emailtemporario.com.br",
  "gerador-email.com",
]);

/**
 * Distância de Damerau-Levenshtein: edições simples MAIS troca de duas letras
 * vizinhas.
 *
 * A transposição é o ponto todo. `gmial` ↔ `gmail` é justamente isso — duas
 * letras trocadas de lugar — e a distância de Levenshtein comum cobra 2 por
 * ela. Com limiar 1 (o único seguro), Levenshtein deixaria passar exatamente o
 * erro que originou esta função.
 */
function distancia(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 1) return 2; // já passa do limiar; não vale calcular

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

export type ProblemaEmail = {
  /** Mensagem pronta para o usuário — já explica e já sugere. */
  mensagem: string;
  /** E-mail corrigido, quando dá pra afirmar qual é. */
  sugestao?: string;
};

/**
 * Devolve `null` quando o e-mail passa. Caso contrário, o que está errado e,
 * quando possível, o endereço corrigido.
 *
 * Conservador de propósito: só barra quando a correção é praticamente certa.
 * Domínio corporativo desconhecido passa — não cabe a nós adivinhar o domínio
 * de ninguém, e barrar cliente legítimo é pior que deixar passar um typo.
 */
export function checarEmail(bruto: string): ProblemaEmail | null {
  const email = (bruto || "").trim().toLowerCase();
  if (!email) return null; // campo vazio é assunto do `.email()`/`optional()`

  const partes = email.split("@");
  if (partes.length !== 2) return null; // formato é assunto do zod

  const [local, dominio] = partes;
  if (!local || !dominio) return null;

  // Estrutura do domínio — coisas que nenhum domínio real tem.
  if (dominio.includes("..") || local.includes("..")) {
    return { mensagem: "E-mail com ponto duplicado. Confira o endereço." };
  }
  if (dominio.startsWith(".") || dominio.endsWith(".") || dominio.startsWith("-")) {
    return { mensagem: "Domínio do e-mail está incompleto. Confira o endereço." };
  }
  if (!dominio.includes(".")) {
    return { mensagem: "Falta o final do e-mail (.com, .com.br…). Confira o endereço." };
  }
  const tld = dominio.slice(dominio.lastIndexOf(".") + 1);
  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { mensagem: `"${dominio}" não termina em um domínio válido. Confira o endereço.` };
  }

  const corrigir = (certo: string): ProblemaEmail => ({
    mensagem: `O e-mail parece ter um erro de digitação. Você quis dizer ${local}@${certo}?`,
    sugestao: `${local}@${certo}`,
  });

  // 0. Caixa temporária: barra antes de qualquer outra checagem, e sem sugerir
  // correção — não há o que corrigir, o endereço é descartável por natureza.
  if (DOMINIOS_DESCARTAVEIS.has(dominio)) {
    return {
      mensagem:
        "Este é um endereço de e-mail temporário. Informe um e-mail permanente — " +
        "é por ele que enviamos acesso, cobrança e avisos da sua conta.",
    };
  }

  // 1. Erro conhecido: a correção é certa.
  const conhecido = TYPOS_CONHECIDOS[dominio];
  if (conhecido) return corrigir(conhecido);

  // 2. Domínio válido declarado: passa sem mais perguntas.
  if (DOMINIOS_VALIDOS.has(dominio)) return null;

  // 3. A uma única edição de um provedor grande — inclusive letras trocadas.
  for (const provedor of PROVEDORES_CONHECIDOS) {
    if (distancia(dominio, provedor) <= 1) return corrigir(provedor);
  }

  return null;
}

/** Aplica a correção sugerida, quando existe. Usado na limpeza da base. */
export function emailCorrigido(bruto: string): string | null {
  return checarEmail(bruto)?.sugestao ?? null;
}
