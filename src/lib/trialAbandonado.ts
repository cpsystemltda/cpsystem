import "server-only";
import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";
import { avisarEquipe } from "@/lib/alertaInterno";

/**
 * Fim de linha do teste que não virou cliente.
 *
 * Regina 09/09: "vamos apenas bloquear de utilizar a plataforma, mas ele
 * continua tendo acesso para poder cadastrar o pagamento e continuar usando a
 * plataforma. Caso não faça isso em 30 dias, aí sim os dados são apagados do
 * sistema e ele é avisado antes."
 *
 * Três degraus, nesta ordem:
 *
 *   1. Trial vence  → conta bloqueada (isso já acontece em lib/bloqueio.ts). O
 *      cliente ainda entra, mas só chega na tela de assinatura.
 *   2. 23 dias depois → aviso de que os dados serão apagados em 7 dias. É a
 *      última chance, e é a mensagem que mais recupera cliente.
 *   3. 30 dias depois → exclusão da conta e de tudo que ela tem.
 *
 * Apagar dado de cliente não tem desfazer. Por isso a seleção é conservadora e
 * o padrão é SIMULAR: só apaga de verdade quando chamada com `simular: false`.
 */

const DIAS_ATE_AVISAR = 23;
const DIAS_ATE_EXCLUIR = 30;

type ContaCandidata = {
  id: string;
  trialAteEm: Date | null;
  empresas: { razaoSocial: string }[];
  usuarios: { id: string; nome: string; email: string }[];
};

/**
 * Contas que se qualificam para o fim de linha.
 *
 * Regina 09/09, e esta é A regra: "isso é apenas para clientes inativos E SEM
 * PAGAMENTO REGISTRADO. Caso a pessoa faça o pagamento e não utilize a
 * plataforma, ela em hipótese alguma pode ser bloqueada. Enquanto ela pagar,
 * ela pode usar a plataforma."
 *
 * Ou seja: o gatilho é AUSÊNCIA DE PAGAMENTO, nunca falta de uso. Cliente que
 * paga e some por seis meses continua com tudo no lugar — o dinheiro dele
 * comprou o direito de usar quando quiser.
 *
 * As travas importam mais que a consulta:
 *   · só EMPRESA — analista não paga assinatura;
 *   · só quem continua em TRIAL: quem virou ATIVA está pagando e sai daqui;
 *     quem está INADIMPLENTE segue a régua de cobrança, que é outra história;
 *   · nunca conta interna do CP System;
 *   · nunca quem já pagou qualquer fatura, mesmo que uma só, mesmo que há
 *     muito tempo;
 *   · nunca quem tem forma de pagamento cadastrada — mesmo sem fatura paga
 *     ainda, cadastrou é sinal de intenção e o caso vira cobrança, não exclusão.
 *
 * Nenhuma dessas condições olha para uso. De propósito.
 */
async function candidatas(diasMin: number, diasMax?: number): Promise<ContaCandidata[]> {
  const agora = Date.now();
  const limiteInicio = new Date(agora - (diasMax ?? 3650) * 86400000);
  const limiteFim = new Date(agora - diasMin * 86400000);

  return prisma.conta.findMany({
    where: {
      tipo: "EMPRESA",
      statusAssinatura: "TRIAL",
      trialAteEm: { gte: limiteInicio, lt: limiteFim },
      usuarios: { none: { superAdmin: true } },
      // Nunca pagou nada. Uma fatura paga, ainda que antiga, tira a conta daqui
      // para sempre.
      cobrancas: { none: { status: "PAGA" } },
      // E não deixou forma de pagamento cadastrada.
      gatewaySubscriptionId: null,
    },
    select: {
      id: true,
      trialAteEm: true,
      empresas: { select: { razaoSocial: true }, take: 1 },
      usuarios: { select: { id: true, nome: true, email: true } },
    },
  });
}

/** Degrau 2: avisa que os dados serão apagados em 7 dias. */
export async function avisarExclusaoProxima(): Promise<{ avisadas: number }> {
  const contas = await candidatas(DIAS_ATE_AVISAR, DIAS_ATE_EXCLUIR);
  let avisadas = 0;

  for (const conta of contas) {
    const empresa = conta.empresas[0]?.razaoSocial ?? "sua empresa";
    const diasRestantes = DIAS_ATE_EXCLUIR - DIAS_ATE_AVISAR;

    for (const u of conta.usuarios) {
      const primeiro = u.nome.split(" ")[0] || u.nome;
      const texto =
        `⚠️ *Seus dados no CP System serão apagados em ${diasRestantes} dias*\n\n` +
        `${primeiro}, o teste de *${empresa}* encerrou e a assinatura não foi ativada.\n\n` +
        `Tudo que você cadastrou — atas, contratos, empenhos e notas — ainda está guardado, ` +
        `mas será *apagado definitivamente em ${diasRestantes} dias*.\n\n` +
        `Para manter, é só cadastrar a forma de pagamento:\n` +
        `https://cpsystem.app.br/conta/assinatura\n\n` +
        `Se preferir não continuar, não precisa fazer nada — e agradecemos o teste.\n\n` +
        `Contato CP System`;

      await dispararNotificacao({
        usuarioId: u.id,
        tipo: "VENCIMENTO_PLANO",
        referenciaId: `exclusao-aviso-${conta.id}`,
        mensagem: texto,
      }).catch((e) => console.error("[trial-abandonado] WhatsApp falhou:", e));

      await enviarEmail({
        para: u.email,
        assunto: `Seus dados no CP System serão apagados em ${diasRestantes} dias`,
        html:
          `<p>${primeiro},</p><p>O teste de <strong>${empresa}</strong> encerrou e a assinatura ` +
          `não foi ativada. Tudo que você cadastrou ainda está guardado, mas será apagado ` +
          `definitivamente em ${diasRestantes} dias.</p>` +
          `<p><a href="https://cpsystem.app.br/conta/assinatura">Cadastrar forma de pagamento e manter meus dados</a></p>` +
          `<p>Se preferir não continuar, não precisa fazer nada — e agradecemos o teste.</p>`,
        texto:
          `${primeiro}, o teste de ${empresa} encerrou e a assinatura não foi ativada. ` +
          `Seus dados serão apagados em ${diasRestantes} dias. Para manter, cadastre a forma de ` +
          `pagamento: https://cpsystem.app.br/conta/assinatura`,
      }).catch((e) => console.error("[trial-abandonado] e-mail falhou:", e));
    }
    avisadas++;
  }

  if (avisadas > 0) {
    await avisarEquipe(
      `⏳ *Aviso de exclusão enviado*\n\n${avisadas} conta(s) de teste abandonado receberam o aviso ` +
        `de que os dados serão apagados em ${DIAS_ATE_EXCLUIR - DIAS_ATE_AVISAR} dias.\n\n` +
        `É a última janela de recuperação — vale uma ligação.`,
    ).catch(() => {});
  }

  return { avisadas };
}

/**
 * Degrau 3: exclusão.
 *
 * `simular: true` (padrão) apenas lista o que seria apagado. A exclusão real
 * exige a chamada explícita — não quero que um deploy distraído apague conta de
 * cliente.
 */
export async function excluirTrialsAbandonados(
  { simular = true }: { simular?: boolean } = {},
): Promise<{ excluidas: number; simulado: boolean; empresas: string[] }> {
  const contas = await candidatas(DIAS_ATE_EXCLUIR);
  const nomes = contas.map(
    (c) => c.empresas[0]?.razaoSocial ?? c.usuarios[0]?.email ?? c.id,
  );

  if (simular) {
    return { excluidas: 0, simulado: true, empresas: nomes };
  }

  for (const conta of contas) {
    // A exclusão em cascata do schema leva empresas, atas, contratos, empenhos,
    // notas e usuários junto. É o "sai do nosso radar" que a Regina pediu.
    await prisma.conta.delete({ where: { id: conta.id } });
  }

  if (contas.length > 0) {
    await avisarEquipe(
      `🗑️ *Contas de teste abandonado excluídas*\n\n` +
        `${contas.length} conta(s) apagadas após ${DIAS_ATE_EXCLUIR} dias sem ativar a assinatura:\n` +
        nomes.map((n) => `• ${n}`).join("\n") +
        `\n\nTodas foram avisadas 7 dias antes.`,
    ).catch(() => {});
  }

  return { excluidas: contas.length, simulado: false, empresas: nomes };
}
