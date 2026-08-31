import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";
import { avisarEquipe } from "@/lib/alertaInterno";

/**
 * Ativação — ir atrás de quem entrou e parou.
 *
 * Regina 31/08, depois de olhar o histórico do Marcos e da conta da MSL:
 * "ele não pode só ter feito um cadastro e simplesmente sair do sistema,
 * significa que ele não vai continuar depois do trial, ou seja, nós temos que
 * ir atrás dele. O trabalho ali tem que ser ativo, não pode ser um trabalho
 * que pare não."
 *
 * O que existia até aqui só falava com quem JÁ estava usando: os crons avisam
 * vencimento de documento cadastrado. Quem cadastrou um contrato e sumiu não
 * gerava vencimento nenhum, então não recebia nada — e ia embora no fim do
 * teste sem que ninguém percebesse. Foi exatamente o caso do Marcos: um
 * contrato lançado na sexta e silêncio total depois.
 *
 * Cada estágio manda UMA mensagem na vida da conta. A trava é a chave de
 * idempotência (usuarioId, tipo, referenciaId) do dispararNotificacao, com
 * referenciaId = "<estagio>-<contaId>". Somando tudo, uma conta que nunca
 * reage recebe no máximo 3 mensagens de ativação no teste inteiro — insistente
 * o bastante pra resgatar, longe do volume que faz o cliente bloquear o número.
 */

const DIA_MS = 86_400_000;

/** Dias parado até a gente considerar que o cadastro travou. */
const DIAS_SEM_CADASTRAR = 3;
/** Dias após a criação até cobrar o primeiro documento. */
const DIAS_SEM_NENHUM_DOCUMENTO = 2;
/** Antecedência do fim do teste pro último empurrão. */
const DIAS_ANTES_DO_FIM_DO_TESTE = 3;

type Estagio =
  | "sem-primeiro-documento"
  | "cadastro-parado"
  | "teste-acabando"
  | "analista-sem-carteira";

const ESTAGIOS: Estagio[] = [
  "sem-primeiro-documento",
  "cadastro-parado",
  "teste-acabando",
  "analista-sem-carteira",
];

export type ResumoAtivacao = {
  contasAvaliadas: number;
  enviadas: Record<Estagio, number>;
  semCanal: number;
};

/**
 * Número de série do dia no fuso de Brasília.
 *
 * A contagem é de dias de CALENDÁRIO, não de blocos de 24 horas. Dividir a
 * diferença em milissegundos anunciava "o teste termina em 1 dia" pra quem
 * ainda tinha dois dias inteiros pela frente — bastava a conta ter sido criada
 * de tarde. Prazo comunicado errado corrói a confiança justamente na mensagem
 * que pede a assinatura.
 */
function diaBRT(d: Date): number {
  const [ano, mes, dia] = d
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .split("-")
    .map(Number);
  return Math.floor(Date.UTC(ano, mes - 1, dia) / DIA_MS);
}

function diasEntre(de: Date, ate: Date): number {
  return diaBRT(ate) - diaBRT(de);
}

function porExtenso(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Percorre as contas de empresa e reengaja quem parou.
 *
 * Roda uma vez por dia. É best-effort de ponta a ponta: erro numa conta não
 * pode impedir o resgate das outras.
 */
export async function reengajarContas(): Promise<ResumoAtivacao> {
  const agora = new Date();
  const resumo: ResumoAtivacao = {
    contasAvaliadas: 0,
    enviadas: Object.fromEntries(ESTAGIOS.map((e) => [e, 0])) as Record<Estagio, number>,
    semCanal: 0,
  };

  const contas = await prisma.conta.findMany({
    where: {
      // Analista entra junto: a regra de ouro vale "pra cliente E analista, pra
      // todo mundo". O que muda é o primeiro passo de cada um — empresa cadastra
      // documento, analista monta carteira.
      tipo: { in: ["EMPRESA", "ANALISTA"] },
      statusAssinatura: { in: ["TRIAL", "ATIVA"] },
      // Conta interna do CP System existe pra operar, não pra ser vendida.
      usuarios: { none: { superAdmin: true } },
    },
    select: {
      id: true,
      tipo: true,
      criadoEm: true,
      statusAssinatura: true,
      trialAteEm: true,
      empresas: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      analista: { select: { id: true } },
      usuarios: {
        select: { id: true, nome: true, telefoneWhatsApp: true, optInWhatsApp: true },
        orderBy: { criadoEm: "asc" },
      },
    },
  });

  for (const conta of contas) {
    try {
      resumo.contasAvaliadas += 1;

      const titular = conta.usuarios[0];
      if (!titular) continue;

      // Nada de boas-vindas retroativas aqui — Regina 31/08: a regra vale "só
      // pra novos cadastros, nunca pra cadastros que já estão um tempo na
      // plataforma". Quem entrou antes da rotina existir segue no padrão normal
      // de mensagem; o acolhimento de quem chega agora é responsabilidade do
      // cadastro, com a rede de segurança dentro do dispararNotificacao.
      if (!titular.telefoneWhatsApp || !titular.optInWhatsApp) {
        resumo.semCanal += 1;
        continue;
      }

      const primeiroNome = titular.nome.split(" ")[0] || titular.nome;

      // ── Analista: o primeiro passo dele é outro ─────────────────────────
      // Cobrar cadastro de ata de quem não tem empresa seria falar do produto
      // errado com a pessoa errada. O que trava um analista é a carteira vazia
      // — sem cliente vinculado, não há comissão nem motivo pra voltar.
      if (conta.tipo === "ANALISTA") {
        const enviou = await reengajarAnalista({
          contaId: conta.id,
          analistaId: conta.analista?.id ?? null,
          usuarioId: titular.id,
          primeiroNome,
          diasDeConta: diasEntre(conta.criadoEm, agora),
        });
        if (enviou) resumo.enviadas["analista-sem-carteira"] += 1;
        continue;
      }

      const empresa = conta.empresas[0];
      const nomeEmpresa = empresa?.nomeFantasia || empresa?.razaoSocial || "sua empresa";

      // ── Quanto da operação está dentro do sistema ───────────────────────
      const empresaIds = conta.empresas.map((e) => e.id);
      const [atas, contratos, empenhos] = empresaIds.length
        ? await Promise.all([
            prisma.ata.count({ where: { empresaId: { in: empresaIds } } }),
            prisma.contrato.count({ where: { empresaId: { in: empresaIds } } }),
            prisma.empenho.count({ where: { empresaId: { in: empresaIds } } }),
          ])
        : [0, 0, 0];
      const totalDocumentos = atas + contratos + empenhos;

      const diasDeConta = diasEntre(conta.criadoEm, agora);
      const diasParaFimDoTeste = conta.trialAteEm ? diasEntre(agora, conta.trialAteEm) : null;

      let estagio: Estagio | null = null;
      let mensagem = "";

      // Prioridade: o teste acabando é o que tem prazo. Depois, quem nunca
      // começou. Por último, quem começou e travou.
      if (
        conta.statusAssinatura === "TRIAL" &&
        diasParaFimDoTeste !== null &&
        diasParaFimDoTeste >= 0 &&
        diasParaFimDoTeste <= DIAS_ANTES_DO_FIM_DO_TESTE
      ) {
        estagio = "teste-acabando";
        const prazo =
          diasParaFimDoTeste === 0
            ? "*termina hoje*"
            : `termina em *${porExtenso(diasParaFimDoTeste, "dia", "dias")}*`;
        mensagem =
          `Olá, ${primeiroNome}!\n\n` +
          `O período de teste de *${nomeEmpresa}* ${prazo}.\n\n` +
          (totalDocumentos === 0
            ? `Notamos que nenhum documento chegou a ser cadastrado. Vale usar o tempo que resta: ` +
              `com uma ata ou contrato lançado, dá pra ver o acompanhamento de prazos funcionando na prática antes de decidir.\n\n`
            : `Sua operação já tem ${porExtenso(totalDocumentos, "documento cadastrado", "documentos cadastrados")} ` +
              `sob acompanhamento. Ao fim do teste, esses prazos deixam de ser monitorados e voltam a depender de controle manual.\n\n`) +
          `Para manter o acesso ativo: cpsystem.app.br/assinatura\n\n` +
          `Se preferir conversar antes de decidir, é só responder esta mensagem.\n\n` +
          `Contato CP System`;
      } else if (totalDocumentos === 0 && diasDeConta >= DIAS_SEM_NENHUM_DOCUMENTO) {
        estagio = "sem-primeiro-documento";
        mensagem =
          `Olá, ${primeiroNome}!\n\n` +
          `A conta de *${nomeEmpresa}* está ativa, mas ainda sem nenhum documento cadastrado — ` +
          `e é o cadastro que liga o acompanhamento automático.\n\n` +
          `*Comece por um só.* Pegue a ata ou o contrato de vigência mais próxima e lance no sistema. ` +
          `Leva cerca de 3 minutos e, a partir daí:\n\n` +
          `▸ o vencimento passa a ser acompanhado e o aviso chega aqui, com antecedência;\n` +
          `▸ o saldo disponível fica visível, sem conferência manual;\n` +
          `▸ entregas, notas e pagamentos ficam na mesma tela.\n\n` +
          `👉 cpsystem.app.br/contratacoes/nova\n\n` +
          `Se preferir, responda aqui dizendo quantos documentos você tem em mãos, ` +
          `que orientamos o caminho mais rápido para lançar tudo de uma vez.\n\n` +
          `Contato CP System`;
      } else if (totalDocumentos > 0) {
        const ultimo = await ultimoDocumentoCadastrado(empresaIds);
        const diasParado = ultimo ? diasEntre(ultimo.criadoEm, agora) : 0;
        if (diasParado >= DIAS_SEM_CADASTRAR) {
          estagio = "cadastro-parado";
          mensagem =
            `Olá, ${primeiroNome}!\n\n` +
            (ultimo
              ? `O último cadastro de *${nomeEmpresa}* foi ${ultimo.rotulo}, há ${porExtenso(diasParado, "dia", "dias")}.\n\n`
              : `O cadastro de *${nomeEmpresa}* está parado há alguns dias.\n\n`) +
            `Vale um ponto de atenção: o sistema só consegue acompanhar aquilo que está dentro dele. ` +
            `Se a sua operação tem outras atas, contratos ou empenhos ainda fora da plataforma, ` +
            `eles seguem dependendo de memória e planilha.\n\n` +
            `Cada documento que fica de fora representa:\n\n` +
            `▸ um prazo de prorrogação que pode passar em branco;\n` +
            `▸ uma entrega que atrasa e se transforma em multa;\n` +
            `▸ uma nota que não é emitida e um pagamento que não entra.\n\n` +
            `*São cerca de 3 minutos por documento* e, depois disso, o acompanhamento é automático.\n\n` +
            `👉 cpsystem.app.br/contratacoes/nova\n\n` +
            `Contato CP System`;
        }
      }

      if (!estagio) continue;

      const r = await dispararNotificacao({
        usuarioId: titular.id,
        tipo: "ATIVACAO",
        referenciaId: `${estagio}-${conta.id}`,
        mensagem,
      });
      if (r.enviado) resumo.enviadas[estagio] += 1;
    } catch (e) {
      console.error(`[ativacao] conta ${conta.id} falhou:`, e);
    }
  }

  // A equipe só é incomodada quando houve movimento — alerta diário que chega
  // sempre vira alerta que ninguém lê.
  const ROTULOS: Record<Estagio, string> = {
    "sem-primeiro-documento": "Sem primeiro documento",
    "cadastro-parado": "Cadastro parado",
    "teste-acabando": "Teste acabando",
    "analista-sem-carteira": "Analista sem carteira",
  };
  const totalEnviadas = ESTAGIOS.reduce((s, e) => s + resumo.enviadas[e], 0);

  if (totalEnviadas > 0) {
    await avisarEquipe(
      `📣 *Ativação do dia*\n\n` +
        `Contas avaliadas: ${resumo.contasAvaliadas}\n` +
        ESTAGIOS.filter((e) => resumo.enviadas[e] > 0)
          .map((e) => `${ROTULOS[e]}: ${resumo.enviadas[e]}\n`)
          .join("") +
        (resumo.semCanal ? `\nSem WhatsApp utilizável: ${resumo.semCanal} — vale contato manual.` : ""),
    ).catch((e) => console.error("[ativacao] aviso à equipe falhou:", e));
  }

  return resumo;
}

/**
 * Resgate do analista que se cadastrou e não montou carteira.
 *
 * Uma mensagem na vida da conta, com o número que interessa a ele: cada cliente
 * vinculado vale R$ 29,90 por mês, vitalício, a partir da 1ª fatura paga.
 */
async function reengajarAnalista(dados: {
  contaId: string;
  analistaId: string | null;
  usuarioId: string;
  primeiroNome: string;
  diasDeConta: number;
}): Promise<boolean> {
  if (!dados.analistaId || dados.diasDeConta < DIAS_SEM_NENHUM_DOCUMENTO) return false;

  const clientes = await prisma.vinculoAnalista.count({
    where: { analistaId: dados.analistaId, status: "ATIVO" },
  });
  if (clientes > 0) return false;

  const r = await dispararNotificacao({
    usuarioId: dados.usuarioId,
    tipo: "ATIVACAO",
    referenciaId: `analista-sem-carteira-${dados.contaId}`,
    mensagem:
      `Olá, ${dados.primeiroNome}!\n\n` +
      `Seu cadastro de analista está ativo, mas a carteira ainda está vazia — ` +
      `e é o vínculo com o cliente que faz a comissão começar a correr.\n\n` +
      `*Como funciona:* cada cliente que assina pelo seu link rende *R$ 29,90 por mês*, ` +
      `de forma recorrente e vitalícia, a partir da primeira fatura paga.\n\n` +
      `*Dois caminhos para começar:*\n\n` +
      `▸ *Já atende empresas hoje?* Importe sua carteira de uma vez no painel do analista.\n` +
      `▸ *Quer começar do zero?* Use seu link de indicação — quem entra por ele já fica vinculado a você.\n\n` +
      `👉 cpsystem.app.br/painel-analista\n\n` +
      `Qualquer dúvida sobre o programa, é só responder esta mensagem.\n\n` +
      `Contato CP System`,
  });
  return r.enviado;
}

/**
 * Documento mais recente da empresa, com um rótulo que o cliente reconhece.
 *
 * Citar "Contrato 06/2026 — Câmara Municipal de Itajubá" em vez de "seu último
 * cadastro" é a diferença entre uma mensagem que parece automática e uma que
 * parece que alguém olhou a conta.
 */
async function ultimoDocumentoCadastrado(
  empresaIds: string[],
): Promise<{ criadoEm: Date; rotulo: string } | null> {
  if (!empresaIds.length) return null;
  const where = { empresaId: { in: empresaIds } };
  const select = { numero: true, orgaoNome: true, criadoEm: true };
  const ordem = { criadoEm: "desc" } as const;

  const [ata, contrato, empenho] = await Promise.all([
    prisma.ata.findFirst({ where, select, orderBy: ordem }),
    prisma.contrato.findFirst({ where, select, orderBy: ordem }),
    prisma.empenho.findFirst({ where, select, orderBy: ordem }),
  ]);

  const candidatos = [
    ata ? { ...ata, especie: "Ata" } : null,
    contrato ? { ...contrato, especie: "Contrato" } : null,
    empenho ? { ...empenho, especie: "Empenho" } : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  if (!candidatos.length) return null;
  const maisRecente = candidatos.reduce((a, b) => (a.criadoEm > b.criadoEm ? a : b));

  return {
    criadoEm: maisRecente.criadoEm,
    rotulo: `o *${maisRecente.especie} ${maisRecente.numero}* (${maisRecente.orgaoNome})`,
  };
}
