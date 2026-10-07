import "server-only";
import { prisma } from "@/lib/prisma";
import type { TipoNotificacaoWhatsApp } from "@/generated/prisma/client";
import { TOKEN_SAUDACAO } from "@/lib/saudacao";

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
    select: { nome: true, conta: { select: { id: true, statusAssinatura: true } } },
  });
  if (usuario?.conta.statusAssinatura !== "INADIMPLENTE") return { reteve: false };

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
  const plural = o.quantidade === 1;
  const texto =
    `${TOKEN_SAUDACAO}, ${o.primeiroNome}.\n\n` +
    `Você tem *${o.quantidade} alerta${plural ? "" : "s"} do seu acompanhamento ` +
    `aguardando${plural ? "" : ""}* — prazo de entrega, nota a emitir ou pagamento de órgão ` +
    `que o CP System identificou e está segurando.\n\n` +
    `Eles voltam a chegar assim que a assinatura for regularizada. ` +
    `É em *Conta → Assinatura*, no sistema, e no PIX a liberação é na hora.\n\n` +
    `Fazemos questão de avisar mesmo assim: prazo de contrato público não espera, ` +
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
