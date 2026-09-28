/**
 * Saudação pelo relógio de Brasília — e resolvida na HORA DA ENTREGA.
 *
 * Regina cobrou isso em 15/07 e de novo em 24/09/2026: *"se você está mandando
 * uma mensagem de dia, é bom dia. A partir de meio-dia, boa tarde. A partir de
 * 18, boa noite. E você tem errado isso. É uma coisinha básica."*
 *
 * É básica e é a primeira palavra que o cliente lê — errar ali entrega que do
 * outro lado não tem ninguém prestando atenção.
 *
 * A armadilha que fazia errar mesmo com a conta certa: a mensagem é ESCRITA
 * num momento e ENTREGUE em outro. O resumo é montado às 14h e pode sair às
 * 19h se a fila tiver segurado; aí "Boa tarde" chega de noite. Por isso existe
 * o `TOKEN_SAUDACAO`: quem monta o texto escreve o marcador, e quem entrega
 * troca pelo cumprimento certo naquele minuto.
 *
 * Os cortes são os que ela ditou: até 11h59 bom dia, de 12h a 17h59 boa tarde,
 * das 18h em diante boa noite.
 */
export const TOKEN_SAUDACAO = "{{SAUDACAO}}";

/** Hora do dia em Brasília, independente do fuso de quem roda o código. */
export function horaBrt(quando: Date = new Date()): number {
  const s = quando.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  });
  return Number(s);
}

/**
 * Meia-noite em Brasília, como instante.
 *
 * `setHours(0,0,0,0)` devolve a meia-noite do fuso de QUEM RODA o código, e na
 * Vercel isso é UTC — o "hoje" virava às 21h de Brasília. Quem conta o que
 * aconteceu no dia precisa do dia daqui.
 */
export function inicioDoDiaBrt(quando: Date = new Date()): Date {
  const [dia, mes, ano] = quando
    .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    .split("/");
  // -03:00 o ano todo: o horário de verão brasileiro acabou em 2019.
  return new Date(`${ano}-${mes}-${dia}T00:00:00-03:00`);
}

/** Segunda a sexta pelo calendário de Brasília. */
export function ehDiaUtilBrt(quando: Date = new Date()): boolean {
  const d = new Date(quando.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
  return d >= 1 && d <= 5;
}

export function saudacaoBrt(quando: Date = new Date()): string {
  const h = horaBrt(quando);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Troca o marcador pelo cumprimento do momento.
 *
 * Aceita a forma minúscula também, para o texto que usa a saudação no meio da
 * frase. Texto sem marcador passa intacto.
 */
export function resolverSaudacao(texto: string, quando: Date = new Date()): string {
  if (!texto.includes(TOKEN_SAUDACAO) && !texto.includes(TOKEN_SAUDACAO.toLowerCase())) {
    return texto;
  }
  const s = saudacaoBrt(quando);
  return texto
    .split(TOKEN_SAUDACAO)
    .join(s)
    .split(TOKEN_SAUDACAO.toLowerCase())
    .join(s.toLowerCase());
}
