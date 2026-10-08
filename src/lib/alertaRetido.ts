import "server-only";
import { prisma } from "@/lib/prisma";
import type { TipoNotificacaoWhatsApp } from "@/generated/prisma/client";
import { TOKEN_SAUDACAO } from "@/lib/saudacao";
import { avaliarBloqueio } from "@/lib/bloqueio";

/**
 * O que o cliente inadimplente recebe no lugar dos avisos.
 *
 * Regina, 07/10/2026: *"todos os inadimplentes, em vez de receber os alertas
 * normais, devem receber uma notificação do tipo: você tem sete alertas
 * pendentes, para saber do que se trata regularize sua assinatura, para não
 * perder prazos. Ele não pode ter o benefício de ser notificado se está
 * inadimplente. Mas também não pode deixar de ser notificado, para que ele
 * tenha motivo para regularizar."*
 *
 * As duas metades do pedido puxam para lados opostos, e o desenho vive disso:
 * **o conteúdo fica retido, a existência não.** O cliente sabe que há prazo
 * correndo e sabe que é o pagamento que destrava — o que ele não sabe é qual
 * prazo, porque essa é a parte que ele deixou de pagar.
 *
 * **O que nunca é retido**, por motivos diferentes:
 *
 * · Cobrança e vencimento de plano — são o caminho de volta. Reter isso seria
 *   trancar a porta e esconder a chave.
 * · Alerta de segurança — login suspeito não espera fatura.
 * · Boas-vindas — ninguém conhece a empresa por uma cobrança.
 *
 * O aviso não repete a cada alerta retido: ele é do tipo que se substitui na
 * fila, então o último, com a contagem atualizada, é o que sai.
 */

/** Avisos que atravessam a inadimplência. */
const SEMPRE_PASSAM: TipoNotificacaoWhatsApp[] = [
  "PLANO_ATRASADO",
  "VENCIMENTO_PLANO",
  "SEGURANCA_LOGIN_NOVO_DEVICE",
  "BOAS_VINDAS",
  "ALERTAS_RETIDOS",
  "ANIVERSARIO",
];

/** Marca no campo `erro`: não foi falha, foi decisão. */
export const MARCA_RETIDO = "retido por inadimplência";

/** Janela de contagem — alerta de dois meses atrás já não é prazo a perder. */
const DIAS_DE_CONTAGEM = 30;

export type ResultadoRetencao = { reteve: boolean; quantidade?: number };

/**
 * Retém o aviso quando a conta está inadimplente, e registra a retenção.
 *
 * Devolve `reteve: true` quando quem chamou deve parar — a notificação já foi
 * gravada aqui, como retida, e o resumo já foi atualizado.
 */
export async function reterSeInadimplente(opts: {
  usuarioId: string;
  tipo: TipoNotificacaoWhatsApp;
  referenciaId: string;
  telefone: string;
  mensagem: string;
}): Promise<ResultadoRetencao> {
  if (SEMPRE_PASSAM.includes(opts.tipo)) return { reteve: false };

  const usuario = await prisma.usuario.findUnique({
    where: { id: opts.usuarioId },
    select: {
      nome: true,
      conta: { select: { id: true, tipo: true, statusAssinatura: true, trialAteEm: true } },
    },
  });
  if (!usuario) return { reteve: false };

  // Quem decide é a MESMA regra que barra o acesso — `avaliarBloqueio`.
  //
  // A primeira versão olhava só `statusAssinatura === "INADIMPLENTE"`, e isso
  // deixava passar o caso mais comum: teste vencido sem forma de pagamento. A
  // conta fica marcada TRIAL para sempre, porque toda a régua de cobrança
  // trabalha em cima de `Cobranca` e quem nunca cadastrou pagamento não tem
  // cobrança nenhuma. No dia em que isso foi visto havia três contas assim,
  // uma com 27 dias de teste vencido — todas trancadas fora do sistema e
  // recebendo os avisos completos, de graça.
  //
  // Usar a regra do bloqueio resolve na origem e garante coerência: ou o
  // cliente entra no sistema e recebe aviso, ou não entra e recebe o resumo.
  // Duas regras separadas para a mesma pergunta divergem — foi o que houve.
  const bloqueio = await avaliarBloqueio({
    id: usuario.conta.id,
    tipo: usuario.conta.tipo,
    statusAssinatura: usuario.conta.statusAssinatura,
    trialAteEm: usuario.conta.trialAteEm,
  });
  if (!bloqueio.bloqueada) return { reteve: false };

  // Grava o que seria enviado, marcado como retido. O texto fica guardado de
  // propósito: quando a conta se regularizar, dá para saber o que o cliente
  // não viu, em vez de ter só um número.
  await prisma.notificacaoWhatsApp.upsert({
    where: {
      usuarioId_tipo_referenciaId: {
        usuarioId: opts.usuarioId,
        tipo: opts.tipo,
        referenciaId: opts.referenciaId,
      },
    },
    create: {
      usuarioId: opts.usuarioId,
      tipo: opts.tipo,
      referenciaId: opts.referenciaId,
      telefone: opts.telefone,
      mensagem: opts.mensagem,
      status: "FALHOU",
      erro: MARCA_RETIDO,
    },
    update: { status: "FALHOU", erro: MARCA_RETIDO, mensagem: opts.mensagem },
  });

  const desde = new Date(Date.now() - DIAS_DE_CONTAGEM * 86400_000);
  const quantidade = await prisma.notificacaoWhatsApp.count({
    where: { usuarioId: opts.usuarioId, erro: MARCA_RETIDO, criadoEm: { gte: desde } },
  });

  await enfileirarResumo({
    usuarioId: opts.usuarioId,
    telefone: opts.telefone,
    primeiroNome: (usuario.nome || "").split(" ")[0] || usuario.nome,
    quantidade,
  });

  return { reteve: true, quantidade };
}

/**
 * Enfileira — ou atualiza — o resumo do que está retido.
 *
 * A contagem muda ao longo do dia, então o que vale é o último. O tipo
 * `ALERTAS_RETIDOS` entra na lista de substituíveis da fila: a versão mais
 * nova descarta a anterior do mesmo cliente, e ele recebe um aviso por dia
 * com o número certo, em vez de sete avisos dizendo números diferentes.
 */
async function enfileirarResumo(o: {
  usuarioId: string;
  telefone: string;
  primeiroNome: string;
  quantidade: number;
}) {
  const um = o.quantidade === 1;
  const texto =
    `${TOKEN_SAUDACAO}, ${o.primeiroNome}.\n\n` +
    `Você tem *${o.quantidade} aviso${um ? "" : "s"} aguardando* sobre ` +
    `notas de empenho, contratos e execuções que o CP System está acompanhando ` +
    `para você.\n\n` +
    `Para voltar a receber e não perder nenhum prazo, regularize o seu cadastro ` +
    `em *Conta → Assinatura*. No PIX a liberação é na hora.\n\n` +
    `Fazemos questão de avisar mesmo assim: prazo de contratação pública não espera, ` +
    `e não queremos que você perca nenhum por falta de aviso.\n\n` +
    `Contato CP System`;

  await prisma.mensagemSaidaWhatsApp.create({
    data: {
      destino: o.telefone,
      texto,
      usuarioId: o.usuarioId,
      tipo: "ALERTAS_RETIDOS",
    },
  });
}

/**
 * O que o cliente deixou de ver — para a tela de assinatura e para o suporte.
 */
export async function alertasRetidosDoUsuario(usuarioId: string) {
  const desde = new Date(Date.now() - DIAS_DE_CONTAGEM * 86400_000);
  return prisma.notificacaoWhatsApp.findMany({
    where: { usuarioId, erro: MARCA_RETIDO, criadoEm: { gte: desde } },
    orderBy: { criadoEm: "desc" },
    select: { id: true, tipo: true, criadoEm: true, mensagem: true },
  });
}
