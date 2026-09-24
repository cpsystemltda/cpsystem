import "server-only";
import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";
import { TOKEN_SAUDACAO } from "@/lib/saudacao";

/**
 * Ciclo de vida da conta — o fim da régua, onde há consequência.
 *
 * Regina, 24/09/2026: *"se a pessoa ficar dias sem usar o sistema, ela tem que
 * ser avisada. No trial, se ela não usou, a gente deleta o perfil. Mas de
 * forma muito profissional, muito coerente (...) e também para a gente tentar
 * fazer que sejam usuários de verdade. Usar a persuasão para isso."*
 *
 * As duas metades do pedido puxam para lados opostos — limpar a base e não
 * perder cliente — e por isso a régua é longa antes de ser dura: **três
 * avisos antes de arquivar, e um mês inteiro entre arquivar e apagar.**
 *
 * Divisão de trabalho com `ativacao.ts`, para ninguém receber dois avisos
 * dizendo a mesma coisa: lá ficam os empurrões do começo (primeiro documento,
 * cadastro parado, teste acabando, analista sem carteira). Aqui fica só o que
 * vem DEPOIS de o trial vencer sem uso — e o reengajamento de quem paga.
 *
 * Prazos definidos pela Regina em 24/09:
 *   · trial sem uso  → avisa em 21d, arquiva em 30d, apaga em 60d
 *   · analista sem vínculo → cobra em 21d, sai em 45d
 *   · pagante parado → reengaja em 15d, **sem ameaça nenhuma**
 */

const TRIAL_AVISO_DIAS = 21;
const TRIAL_ARQUIVA_DIAS = 30;
const TRIAL_APAGA_DIAS = 60;
const ANALISTA_COBRA_DIAS = 21;
const ANALISTA_SAI_DIAS = 45;
const PAGANTE_PARADO_DIAS = 15;

/** Dias de calendário — o mesmo critério do resto do sistema. */
function diasEntre(de: Date, ate: Date): number {
  return Math.floor((ate.getTime() - de.getTime()) / 86400000);
}

function primeiroNome(nome: string): string {
  return nome.split(" ")[0] || nome;
}

export type ResumoCiclo = {
  avaliadas: number;
  avisadas: number;
  arquivadas: number;
  apagadas: number;
  reengajadas: number;
  analistasCobrados: number;
  detalhes: string[];
};

export async function rodarCicloDeVida(): Promise<ResumoCiclo> {
  const agora = new Date();
  const r: ResumoCiclo = {
    avaliadas: 0, avisadas: 0, arquivadas: 0, apagadas: 0,
    reengajadas: 0, analistasCobrados: 0, detalhes: [],
  };

  const contas = await prisma.conta.findMany({
    where: {
      // Conta interna opera o sistema, não é vendida — nunca entra na régua.
      usuarios: { none: { superAdmin: true } },
    },
    select: {
      id: true, tipo: true, plano: true, statusAssinatura: true, criadoEm: true,
      arquivadaEm: true, gatewayCustomerId: true,
      empresas: { select: { id: true, razaoSocial: true } },
      analista: { select: { id: true, nomeCompleto: true } },
      usuarios: {
        orderBy: { criadoEm: "asc" },
        select: { id: true, nome: true, telefoneWhatsApp: true, optInWhatsApp: true },
      },
    },
  });

  for (const c of contas) {
    r.avaliadas++;
    const titular = c.usuarios[0];
    if (!titular) continue;

    const idade = diasEntre(c.criadoEm, agora);
    const empresaIds = c.empresas.map((e) => e.id);
    const nomeConta = c.empresas[0]?.razaoSocial ?? c.analista?.nomeCompleto ?? titular.nome;

    const [atas, contratos, empenhos, vinculos] = await Promise.all([
      empresaIds.length ? prisma.ata.count({ where: { empresaId: { in: empresaIds } } }) : 0,
      empresaIds.length ? prisma.contrato.count({ where: { empresaId: { in: empresaIds } } }) : 0,
      empresaIds.length ? prisma.empenho.count({ where: { empresaId: { in: empresaIds } } }) : 0,
      c.analista ? prisma.vinculoAnalista.count({ where: { analistaId: c.analista.id } }) : 0,
    ]);
    const documentos = atas + contratos + empenhos;
    const paga = !!c.gatewayCustomerId && c.statusAssinatura === "ATIVA";

    // ── Conta que paga: nunca leva aviso de corte, só oferta de ajuda ───────
    if (paga) {
      const ultimoDoc = empresaIds.length
        ? await prisma.empenho.findFirst({
            where: { empresaId: { in: empresaIds } },
            orderBy: { criadoEm: "desc" },
            select: { criadoEm: true },
          })
        : null;
      const paradoHa = ultimoDoc ? diasEntre(ultimoDoc.criadoEm, agora) : idade;
      if (paradoHa >= PAGANTE_PARADO_DIAS && documentos > 0) {
        const enviou = await avisar(titular, "ATIVACAO", `reengajar-${c.id}-${quinzena(agora)}`,
          `${TOKEN_SAUDACAO}, ${primeiroNome(titular.nome)}!\n\n` +
          `Notei que o último lançamento de *${nomeConta}* foi há ${paradoHa} dias. Nada de errado nisso — ` +
          `só quero garantir que não é o sistema que está atrapalhando.\n\n` +
          `Se tiver contratação nova para entrar, eu lanço junto com você em 15 minutos, por chamada. ` +
          `E se estiver faltando algo no sistema para caber no seu dia a dia, me diga que eu levo para a equipe.\n\n` +
          `Contato CP System`);
        if (enviou) { r.reengajadas++; r.detalhes.push(`reengajado: ${nomeConta} (${paradoHa}d parado)`); }
      }
      continue;
    }

    // ── Analista sem carteira ───────────────────────────────────────────────
    if (c.tipo === "ANALISTA" && vinculos === 0 && !c.arquivadaEm) {
      if (idade >= ANALISTA_SAI_DIAS) {
        await prisma.conta.update({ where: { id: c.id }, data: { arquivadaEm: agora, statusAssinatura: "CANCELADA" } });
        r.arquivadas++;
        r.detalhes.push(`analista arquivado: ${nomeConta} (${idade}d, zero vínculos)`);
      } else if (idade >= ANALISTA_COBRA_DIAS) {
        const enviou = await avisar(titular, "ATIVACAO", `analista-cobranca-${c.id}`,
          `${TOKEN_SAUDACAO}, ${primeiroNome(titular.nome)}!\n\n` +
          `Seu cadastro de analista parceiro está há ${idade} dias sem nenhum cliente vinculado — ` +
          `e é o vínculo que faz a comissão existir.\n\n` +
          `O caminho é curto: a empresa se cadastra em *cpsystem.app.br* e informa o seu nome no campo de analista. ` +
          `A partir da primeira fatura paga por ela, são *R$ 29,90 por mês, por cliente*, enquanto ela for cliente — ` +
          `cumulativo e vitalício.\n\n` +
          `Se quiser, eu te ajudo a abordar o primeiro. Me chama aqui que a gente monta a conversa junto.\n\n` +
          `Contato CP System`);
        if (enviou) { r.analistasCobrados++; r.detalhes.push(`analista cobrado: ${nomeConta} (${idade}d)`); }
      }
      continue;
    }

    // ── Trial que nunca virou uso ───────────────────────────────────────────
    const trialMorto = c.tipo === "EMPRESA" && !paga && documentos === 0;
    if (!trialMorto) continue;

    if (idade >= TRIAL_APAGA_DIAS && c.arquivadaEm) {
      // Apaga só quem JÁ foi arquivado — ou seja, quem passou por aviso,
      // arquivamento e mais um mês de silêncio. Nunca é a primeira ação.
      await prisma.conta.delete({ where: { id: c.id } });
      r.apagadas++;
      r.detalhes.push(`APAGADA: ${nomeConta} (${idade}d, nunca usou, arquivada em ${c.arquivadaEm.toISOString().slice(0, 10)})`);
      continue;
    }

    if (idade >= TRIAL_ARQUIVA_DIAS && !c.arquivadaEm) {
      await prisma.conta.update({ where: { id: c.id }, data: { arquivadaEm: agora, statusAssinatura: "CANCELADA" } });
      r.arquivadas++;
      r.detalhes.push(`arquivada: ${nomeConta} (${idade}d sem nenhum lançamento)`);
      await avisar(titular, "ATIVACAO", `arquivamento-${c.id}`,
        `${TOKEN_SAUDACAO}, ${primeiroNome(titular.nome)}.\n\n` +
        `Como o cadastro de *${nomeConta}* completou ${idade} dias sem nenhum lançamento, suspendemos o acesso por ora — ` +
        `é o procedimento padrão para manter a base organizada.\n\n` +
        `*Nada foi perdido.* Seus dados continuam guardados, e reativar leva um minuto: é só responder esta mensagem.\n\n` +
        `E se o que travou foi a primeira contratação ser trabalhosa de lançar, essa parte a gente faz por você — ` +
        `me mande o PDF da ata ou do contrato aqui mesmo que eu devolvo tudo cadastrado.\n\n` +
        `Contato CP System`);
      continue;
    }

    if (idade >= TRIAL_AVISO_DIAS && !c.arquivadaEm) {
      const enviou = await avisar(titular, "ATIVACAO", `trial-ultimo-aviso-${c.id}`,
        `${TOKEN_SAUDACAO}, ${primeiroNome(titular.nome)}!\n\n` +
        `O cadastro de *${nomeConta}* está com ${idade} dias e ainda sem nenhuma contratação lançada — ` +
        `o que quer dizer que o sistema ainda não teve chance de trabalhar para vocês.\n\n` +
        `É justamente com a base alimentada que ele começa a avisar prazo de entrega antes de virar multa, ` +
        `apontar nota que o órgão não pagou e mostrar o saldo de cada ata.\n\n` +
        `*Proposta:* me mande aqui o PDF de uma ata ou contrato de vocês. Eu cadastro e te devolvo pronto, ` +
        `para você ver funcionando com o seu próprio contrato — sem custo e sem compromisso.\n\n` +
        `Se preferir que a gente encerre o cadastro, também é só dizer.\n\n` +
        `Contato CP System`);
      if (enviou) { r.avisadas++; r.detalhes.push(`avisado: ${nomeConta} (${idade}d sem uso)`); }
    }
  }

  return r;
}

/** Quinzena do ano — chave de idempotência do reengajamento de quem paga. */
function quinzena(d: Date): string {
  const inicio = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-q${Math.floor(diasEntre(inicio, d) / 15)}`;
}

async function avisar(
  titular: { id: string; nome: string; telefoneWhatsApp: string | null; optInWhatsApp: boolean },
  tipo: "ATIVACAO",
  referenciaId: string,
  mensagem: string,
): Promise<boolean> {
  if (!titular.telefoneWhatsApp || !titular.optInWhatsApp) return false;
  const r = await dispararNotificacao({ usuarioId: titular.id, tipo, referenciaId, mensagem })
    .catch(() => ({ enviado: false }));
  return !!r.enviado;
}
