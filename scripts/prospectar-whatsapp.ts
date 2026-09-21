import "./_env";
import { prisma } from "@/lib/prisma";

/**
 * Prospecção por WhatsApp, em lote pequeno e espaçado (Regina 21/09/2026).
 *
 * O risco aqui não é teórico: em 12/08 o número do CP System foi desconectado
 * **um segundo depois** de uma sequência de mensagens idênticas, e ficamos nove
 * dias sem canal nenhum. Por isso três regras que não se negociam:
 *
 *   1. lote pequeno (padrão 10 por execução);
 *   2. intervalo de 3 a 5 minutos, sorteado — cadência humana, não robô;
 *   3. texto DIFERENTE em cada envio, montado com o contrato real da empresa.
 *      Mensagem igual em série é o padrão que o WhatsApp detecta.
 *
 * Envia pela ponte (mesma do MCP), nunca por Z-API.
 *
 * Uso:
 *   npx tsx scripts/prospectar-whatsapp.ts            → só mostra o que faria
 *   npx tsx scripts/prospectar-whatsapp.ts --enviar   → envia de verdade
 *   ... --quantidade 10
 */
const ENVIAR = process.argv.includes("--enviar");
const QTD = Number(process.argv[process.argv.indexOf("--quantidade") + 1]) || 10;
const PONTE = process.env.WHATSAPP_BRIDGE_URL || "http://localhost:8080";

const MIN_INTERVALO_MS = 3 * 60 * 1000;
const MAX_INTERVALO_MS = 5 * 60 * 1000;

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function dataBr(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
/**
 * Nome curto e apresentável da empresa.
 *
 * "CSL ENGENHARIA E CONSTRUCOES LTDA" → "CSL Engenharia".
 * Tira só o sufixo jurídico; palavra curta continua em caixa alta porque
 * quase sempre é sigla, e "Csl" numa mensagem de venda entrega que veio de
 * robô mal feito.
 */
function nomeCurtoEmpresa(razao: string): string {
  const tokens = razao
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\/A|S\.A\.?|SA|MEI)\b\.?/gi, " ")
    .replace(/[^\wÀ-ÿ\s&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t && !/^(DE|DA|DO|DAS|DOS|E)$/i.test(t));

  const escolhidos = tokens.slice(0, 2).map((t) =>
    t.length <= 3 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(),
  );
  return escolhidos.join(" ") || razao;
}

/** Só celular tem WhatsApp: depois do DDD, 9 dígitos começando em 9. */
function ehCelular(tel: string | null): boolean {
  const d = (tel || "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  return /^9/.test(d.slice(2));
}

/**
 * Monta a mensagem a partir do contrato REAL do lead.
 *
 * Abre pelo dado concreto (órgão, valor, data) porque é o que faz um
 * desconhecido parar e ler — genérico vira propaganda e é ignorado. Fecha com
 * saída fácil: quem não quer diz que não quer, e isso protege o número tanto
 * quanto o intervalo entre envios.
 */
function montarMensagem(l: {
  empresa: string; orgao: string | null; valorTotal: number; venceEm: Date; qtdContratos: number;
}): string {
  const nome = nomeCurtoEmpresa(l.empresa);
  const dias = Math.ceil((l.venceEm.getTime() - Date.now()) / 86400000);
  const orgao = l.orgao ?? "o órgão";
  const vencido = dias < 0;

  const carteira =
    l.qtdContratos > 1
      ? `Somando os ${l.qtdContratos} contratos que aparecem no portal, são ${brl(l.valorTotal)}.`
      : `São ${brl(l.valorTotal)} em contrato.`;

  const abertura = vencido
    ? `o contrato de vocês com ${orgao} encerrou em ${dataBr(l.venceEm)}. ${carteira}`
    : dias <= 60
      ? `o contrato de vocês com ${orgao} vence em ${dataBr(l.venceEm)} — daqui a ${dias} dias. ${carteira}`
      : `vocês têm contrato com ${orgao} vigente até ${dataBr(l.venceEm)}. ${carteira}`;

  // Contrato encerrado tem outra dor, e a mais cara delas: o Atestado de
  // Capacidade Técnica. Quem não pede na hora descobre que precisa dele no
  // meio da próxima licitação, com o processo já arquivado.
  const miolo = vencido
    ? `Uma pergunta direta: vocês já pediram ao órgão o *Atestado de Capacidade Técnica* dessa contratação?\n\n` +
      `É o documento que comprova qualificação técnica na próxima licitação. Quem não pede logo depois do encerramento costuma descobrir que precisa dele no meio de um certame — e aí o servidor que acompanhou a execução já saiu do setor e o processo está arquivado.\n\n` +
      `Além disso, é comum sobrar nota emitida sem pagamento mesmo depois de o contrato acabar.\n\n` +
      `O CP System avisa quando a contratação encerra e é hora de pedir o atestado, guarda todos eles num lugar só, e aponta cada nota que já deveria ter sido paga, com valor e dias de atraso.`
    : `Três coisas costumam custar caro a quem vende para o governo:\n\n` +
      `▸ prazo de entrega que vence sem ninguém lembrar, e vira multa;\n` +
      `▸ nota fiscal emitida que passa meses sem pagamento, sem ninguém cobrar o órgão;\n` +
      `▸ contrato que encerra sem pedir o Atestado de Capacidade Técnica — e depois falta comprovação na próxima licitação.\n\n` +
      `O CP System acompanha isso sozinho: avisa o prazo antes de vencer, mostra o saldo de cada ata e aponta toda nota que já deveria ter sido paga, com valor e dias de atraso.`;

  return (
    `Olá! Aqui é do CP System.\n\n` +
    `${nome}, ${abertura}\n\n` +
    `${miolo}\n\n` +
    `Faz sentido uma conversa de 15 minutos para eu mostrar com os contratos de vocês?\n\n` +
    `Se não for do seu interesse, é só me dizer que não insisto.\n\n` +
    `Contato CP System`
  );
}

async function enviarPelaPonte(telefone: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const numero = "55" + telefone.replace(/\D/g, "");
  try {
    const r = await fetch(`${PONTE}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: numero, message: texto }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok || corpo?.success === false) {
      return { ok: false, erro: corpo?.message || `HTTP ${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const candidatos = await prisma.leadProspeccao.findMany({
    where: { alvoIdeal: true, situacao: "NAO_CONTATADO", telefone: { not: null } },
    orderBy: [{ venceEm: "asc" }],
    select: {
      id: true, empresa: true, telefone: true, orgao: true,
      valorTotal: true, venceEm: true, qtdContratos: true, uf: true, anotacoes: true,
    },
  });

  const fila = candidatos.filter((l) => ehCelular(l.telefone)).slice(0, QTD);

  console.log(`Alvos ideais não contatados: ${candidatos.length}`);
  console.log(`Destes, com celular: ${candidatos.filter((l) => ehCelular(l.telefone)).length}`);
  console.log(`Lote de hoje: ${fila.length}\n`);

  if (!ENVIAR) {
    console.log("=== PRÉVIA (nada foi enviado) ===\n");
    for (const l of fila.slice(0, 2)) {
      console.log(`--- ${l.empresa} · ${l.telefone} · ${l.uf} ---`);
      console.log(montarMensagem(l));
      console.log("");
    }
    console.log(`(mais ${Math.max(0, fila.length - 2)} na fila, cada uma com texto próprio)`);
    console.log(`\nPara enviar: npx tsx scripts/prospectar-whatsapp.ts --enviar`);
    await prisma.$disconnect();
    return;
  }

  let enviados = 0, falhas = 0;
  for (const [i, l] of fila.entries()) {
    const texto = montarMensagem(l);
    const r = await enviarPelaPonte(l.telefone!, texto);

    if (r.ok) {
      enviados++;
      const nota = `[${new Date().toLocaleDateString("pt-BR")}] Mensagem de prospecção enviada pelo WhatsApp do CP System (11 97061-9434).`;
      await prisma.leadProspeccao.update({
        where: { id: l.id },
        data: {
          situacao: "TENTOU_NAO_FALOU",
          dataPrimeiroContato: new Date(),
          dataUltimoContato: new Date(),
          anotacoes: l.anotacoes ? `${l.anotacoes}\n${nota}` : nota,
          atualizadoPorNome: "CP System (WhatsApp automático)",
        },
      });
      console.log(`  ✓ ${String(i + 1).padStart(2)}/${fila.length}  ${l.empresa.slice(0, 32).padEnd(32)} ${l.telefone}`);
    } else {
      falhas++;
      console.log(`  ✗ ${String(i + 1).padStart(2)}/${fila.length}  ${l.empresa.slice(0, 32).padEnd(32)} ${l.telefone}  — ${r.erro}`);
    }

    if (i < fila.length - 1) {
      const espera = MIN_INTERVALO_MS + Math.random() * (MAX_INTERVALO_MS - MIN_INTERVALO_MS);
      console.log(`     aguardando ${Math.round(espera / 60000)} min…`);
      await dormir(espera);
    }
  }

  console.log(`\nEnviados: ${enviados}   Falhas: ${falhas}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
