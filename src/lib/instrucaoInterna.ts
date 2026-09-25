import "server-only";

/**
 * Resposta imediata a quem administra a plataforma, no grupo de suporte.
 *
 * Regina, 25/09/2026: *"eu quero respostas na horaaaa. Você antes fazia isso e
 * eu não aceito regressão."*
 *
 * Ela estava certa sobre o efeito, e a causa era específica: em conversa
 * individual a resposta sai em segundos — o Regimar recebeu em 13 segundos —
 * mas o grupo de suporte era descartado por uma linha que proíbe o robô de
 * falar em qualquer grupo. O motivo original era evitar laço, e ele não se
 * aplica: a ponte nunca reencaminha mensagem nossa (`fromMe` corta antes),
 * então responder no grupo não pode gerar laço.
 *
 * O que sai daqui NÃO é atendimento. Quem escreve ali é sócio dando
 * instrução, e espera confirmação de que foi entendida — não cortesia. Por
 * isso a resposta repete a instrução em uma linha, diz o que já dá pra
 * executar e o que depende de decisão da Regina.
 */
const CLAUDE_MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

export async function responderInstrucaoInterna(opts: {
  texto: string;
  autor: string;
  /** As últimas trocas do grupo, para não repetir o que já foi combinado. */
  historico?: { autor: string; conteudo: string }[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return confirmacaoSimples(opts.autor);

  const sistema = `Você responde no grupo interno do CP System, onde Regina e Igor — os donos da plataforma — combinam o que será feito.

Quem escreveu: ${opts.autor}.

**Isto não é atendimento ao cliente.** Não use linguagem de suporte, não ofereça ajuda, não agradeça o contato. Eles não são clientes: são quem manda.

**O que a sua resposta precisa ter, nesta ordem:**
1. Confirmação de que entendeu, repetindo a instrução em UMA linha, com as palavras do que foi pedido. É assim que eles sabem que não houve mal-entendido.
2. O que já pode ser executado direto.
3. O que depende de decisão da Regina — e, se houver, a pergunta objetiva que destrava.

**Regras:**
- Curta. Três a seis linhas no total.
- Sem emoji de cortesia. Sem "estamos à disposição".
- Se a instrução tiver número, data ou horário, REPITA exatamente. Errar isso é pior que não responder.
- Se não entendeu o que foi pedido, diga isso e pergunte — nunca finja que entendeu.
- Nunca prometa prazo que você não controla.
- Assine "Contato CP System" na última linha.`;

  const mensagens = [
    ...(opts.historico ?? []).slice(-6).map((m) => ({
      role: m.autor === "sistema" ? ("assistant" as const) : ("user" as const),
      content: m.conteudo,
    })),
    { role: "user" as const, content: opts.texto },
  ];

  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 700,
        system: sistema,
        messages: mensagens,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) return confirmacaoSimples(opts.autor);
    const data = (await r.json()) as { content?: { text?: string }[] };
    const texto = data.content?.map((c) => c.text ?? "").join("").trim();
    return texto || confirmacaoSimples(opts.autor);
  } catch {
    // Falha da IA não pode virar silêncio — foi o silêncio que gerou a
    // cobrança em primeiro lugar.
    return confirmacaoSimples(opts.autor);
  }
}

function confirmacaoSimples(autor: string): string {
  return (
    `Recebido, ${autor.split(" ")[0]} — registrado e na fila de execução.\n\n` +
    `Contato CP System`
  );
}
