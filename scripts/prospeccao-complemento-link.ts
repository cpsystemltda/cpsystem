import "./_env";

/**
 * Complemento de um disparo que saiu sem o caminho.
 *
 * Regina, 22/09/2026: *"você nem sequer pensou em enviar o link do site, para
 * a pessoa conhecer, para a pessoa talvez já cadastrar"*. Estava certa — seis
 * empresas receberam a abordagem sem ter para onde ir, e a mesma ordem veio
 * junto: *"você não vai mandar mensagem duplicidade. Para aqueles que você já
 * mandou, só o link."*
 *
 * Então aqui não se repete nada do que já foi dito: vai uma linha com o
 * endereço e o teste gratuito, e só. Texto diferente em cada envio e intervalo
 * de 3 a 5 minutos, pelas mesmas razões do disparo original — mensagem
 * idêntica em série foi o que derrubou o número em 12/08.
 *
 * Uso: npx tsx scripts/prospeccao-complemento-link.ts --enviar
 */
const ENVIAR = process.argv.includes("--enviar");
const PONTE = process.env.WHATSAPP_BRIDGE_URL || "http://localhost:8080";
const MIN_MS = 3 * 60 * 1000;
const MAX_MS = 5 * 60 * 1000;

/** Quem recebeu a abordagem sem link no lote de 22/09. */
const DESTINOS = [
  { empresa: "Quatro I Construções", telefone: "85999729206" },
  { empresa: "Pacheco Engenharia", telefone: "62986446864" },
  { empresa: "Casa Nova Comércio", telefone: "83987808843" },
  { empresa: "Donatto M.P. Bueno", telefone: "35988825364" },
  { empresa: "Petromax Conveniência", telefone: "94984090301" },
  { empresa: "Valle Verde Agropecuária", telefone: "85999113895" },
];

const VARIACOES = [
  () =>
    `Complementando a mensagem anterior com o caminho: *cpsystem.app.br*\n\n` +
    `Dá para conhecer o sistema por lá e testar grátis por 14 dias, sem compromisso.\n\n` +
    `Contato CP System`,
  // Nada de "esqueci" ou "desculpe": complemento é complemento, não confissão.
  () =>
    `Aproveito para deixar o endereço: *cpsystem.app.br*\n\n` +
    `Lá dá para ver como funciona e criar a conta de teste, gratuita por 14 dias.\n\n` +
    `Contato CP System`,
  () =>
    `Segue o caminho para conhecer: *cpsystem.app.br*\n\n` +
    `O teste é gratuito por 14 dias e não pede cartão para começar.\n\n` +
    `Contato CP System`,
  () =>
    `Para entender melhor antes de qualquer conversa: *cpsystem.app.br*\n\n` +
    `São 14 dias de teste gratuito, com o sistema todo liberado.\n\n` +
    `Contato CP System`,
  () =>
    `Deixo aqui o endereço, caso queira dar uma olhada por conta: *cpsystem.app.br*\n\n` +
    `O teste gratuito de 14 dias já mostra os contratos de vocês dentro do sistema.\n\n` +
    `Contato CP System`,
  () =>
    `Complementando: o sistema está em *cpsystem.app.br*\n\n` +
    `Dá para testar grátis por 14 dias e ver na prática, sem compromisso nenhum.\n\n` +
    `Contato CP System`,
];

async function enviarPelaPonte(telefone: string, texto: string) {
  try {
    const r = await fetch(`${PONTE}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: "55" + telefone, message: texto, automatico: true }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok || corpo?.success === false) return { ok: false, erro: corpo?.message || `HTTP ${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!ENVIAR) {
    DESTINOS.forEach((d, i) => {
      console.log(`--- ${d.empresa} · ${d.telefone} ---\n${VARIACOES[i % VARIACOES.length]()}\n`);
    });
    console.log("Para enviar: npx tsx scripts/prospeccao-complemento-link.ts --enviar");
    return;
  }

  for (const [i, d] of DESTINOS.entries()) {
    const r = await enviarPelaPonte(d.telefone, VARIACOES[i % VARIACOES.length]());
    console.log(`  ${r.ok ? "✓" : "✗"} ${String(i + 1).padStart(2)}/${DESTINOS.length}  ${d.empresa.padEnd(26)} ${d.telefone}${r.ok ? "" : "  — " + r.erro}`);
    if (i < DESTINOS.length - 1) {
      const espera = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
      console.log(`     aguardando ${Math.round(espera / 60000)} min…`);
      await dormir(espera);
    }
  }
}

main();
