import "./_env";
import { prisma } from "@/lib/prisma";

/**
 * Manda o caminho pra quem foi abordado sem ele.
 *
 * Regina, 22/09/2026: *"você nem sequer pensou em enviar o link do site, para
 * a pessoa conhecer, para a pessoa talvez já cadastrar"*. Os disparos de 21 e
 * 22/09 saíram sem endereço nenhum — dezesseis empresas ouviram o problema
 * delas e não tinham para onde ir.
 *
 * A ordem veio junto: *"você não vai mandar mensagem duplicidade. Para
 * aqueles que você já mandou, só o link."* Então aqui não se repete uma linha
 * do que já foi dito: vai o endereço, o teste gratuito e nada mais.
 *
 * Duas travas que existem por motivo:
 *
 *   1. **Idempotência por anotação.** Quem já recebeu o complemento fica
 *      marcado e nunca recebe de novo. Rodar duas vezes não gera duplicidade.
 *   2. **Texto diferente em cada envio e 3 a 5 minutos entre eles.** Mensagem
 *      idêntica em série foi o que derrubou o número em 12/08.
 *
 * Uso:
 *   npx tsx scripts/prospeccao-complemento-link.ts             → prévia
 *   npx tsx scripts/prospeccao-complemento-link.ts --enviar
 */
const ENVIAR = process.argv.includes("--enviar");
const PONTE = process.env.WHATSAPP_BRIDGE_URL || "http://localhost:8080";
const MIN_MS = 3 * 60 * 1000;
const MAX_MS = 5 * 60 * 1000;

/** Marca na anotação do lead. É o que impede mandar duas vezes. */
const MARCA = "Complemento com o link do site enviado";

const VARIACOES: ((nome: string) => string)[] = [
  () =>
    `Complementando a mensagem anterior com o caminho: *cpsystem.app.br*\n\n` +
    `Dá para conhecer o sistema por lá e testar grátis por 14 dias, sem precisar cadastrar cartão.\n\n` +
    `Contato CP System`,
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
  (nome) =>
    `Deixo o endereço, caso queira dar uma olhada por conta: *cpsystem.app.br*\n\n` +
    `Em 14 dias de teste gratuito dá para ver os contratos da ${nome} dentro do sistema.\n\n` +
    `Contato CP System`,
  () =>
    `Complementando: o sistema está em *cpsystem.app.br*\n\n` +
    `Dá para testar grátis por 14 dias e ver na prática, sem compromisso nenhum.\n\n` +
    `Contato CP System`,
  () =>
    `O endereço para conhecer é *cpsystem.app.br*\n\n` +
    `São 14 dias gratuitos, e o cadastro leva dois minutos — sem cartão.\n\n` +
    `Contato CP System`,
  (nome) =>
    `Segue o link, para a ${nome} conhecer sem pressa: *cpsystem.app.br*\n\n` +
    `O teste gratuito dura 14 dias e mostra o sistema inteiro.\n\n` +
    `Contato CP System`,
];

/** Nome curto e apresentável, para as variações que citam a empresa. */
function nomeCurto(razao: string): string {
  const t = razao
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\/A|S\.A\.?|SA|MEI)\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((x) => x && !/^(DE|DA|DO|DAS|DOS|E)$/i.test(x))
    .slice(0, 2)
    .map((x) => (x.length <= 3 ? x.toUpperCase() : x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()));
  return t.join(" ") || razao;
}

function soDigitos(t: string | null): string {
  return (t || "").replace(/\D/g, "");
}

async function enviarPelaPonte(telefone: string, texto: string) {
  try {
    const r = await fetch(`${PONTE}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: "55" + telefone, message: texto, automatico: true }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok || corpo?.success === false) return { ok: false, erro: corpo?.message || `HTTP ${r.status}` };
    return { ok: true as const };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const abordados = await prisma.leadProspeccao.findMany({
    where: {
      situacao: { in: ["TENTOU_NAO_FALOU", "FALOU_COM_DECISOR"] },
      dataPrimeiroContato: { not: null },
      telefone: { not: null },
      NOT: { anotacoes: { contains: MARCA } },
    },
    orderBy: { dataPrimeiroContato: "asc" },
    select: { id: true, empresa: true, telefone: true, anotacoes: true, dataPrimeiroContato: true },
  });

  console.log(`Abordados sem o link: ${abordados.length}\n`);
  if (abordados.length === 0) return;

  if (!ENVIAR) {
    abordados.forEach((l, i) => {
      console.log(`--- ${l.empresa} · ${l.telefone} ---`);
      console.log(VARIACOES[i % VARIACOES.length](nomeCurto(l.empresa)));
      console.log("");
    });
    console.log("Para enviar: npx tsx scripts/prospeccao-complemento-link.ts --enviar");
    return;
  }

  for (const [i, l] of abordados.entries()) {
    const texto = VARIACOES[i % VARIACOES.length](nomeCurto(l.empresa));
    const r = await enviarPelaPonte(soDigitos(l.telefone), texto);

    if (r.ok) {
      const nota = `[${new Date().toLocaleDateString("pt-BR")}] ${MARCA}.`;
      await prisma.leadProspeccao.update({
        where: { id: l.id },
        data: {
          anotacoes: l.anotacoes ? `${l.anotacoes}\n${nota}` : nota,
          dataUltimoContato: new Date(),
          atualizadoPorNome: "CP System (WhatsApp automático)",
        },
      });
    }
    console.log(`  ${r.ok ? "✓" : "✗"} ${String(i + 1).padStart(2)}/${abordados.length}  ${l.empresa.slice(0, 30).padEnd(30)} ${l.telefone}${r.ok ? "" : "  — " + r.erro}`);

    if (i < abordados.length - 1) {
      const espera = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
      console.log(`     aguardando ${Math.round(espera / 60000)} min…`);
      await dormir(espera);
    }
  }

  await prisma.$disconnect();
}

main();
