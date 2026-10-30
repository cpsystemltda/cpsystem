import "server-only";
import { prisma } from "@/lib/prisma";
import { whereAtestadoPendente } from "@/lib/atestados";
import type { CanalFollowUp, ResultadoFollowUp } from "@/generated/prisma/client";

/**
 * Follow-up proativo de clientes.
 *
 * Igor, 30/10/2026: *"A ideia básica desse follow-up proativo dos clientes é:
 * mantermos um contato com base de clientes, para evitar churn; vermos onde o
 * cliente está falhando no uso da plataforma (alimentando errado, deixando de
 * alimentar, funcionalidades ociosas); orientarmos ele para melhorar o uso;
 * colher os feedbacks para melhoria do sistema. Aí ter uma rotina de prazo em
 * cima disso... 30/60/90/180... Para pelo menos a cada trimestre conversamos
 * com todos."*
 *
 * Divisão de trabalho com o que já existia: `ativacao.ts` empurra quem está
 * no TESTE e parou; `cicloDeVida.ts` manda um WhatsApp automático para o
 * pagante parado há 15 dias. Este módulo é diferente dos dois: aqui a conversa
 * é de GENTE, não de robô. O sistema prepara o terreno — diz quem está na vez,
 * o que o cliente está deixando de usar e o que orientar — e a equipe liga.
 *
 * Duas decisões não óbvias:
 *
 * 1. A cadência não vive no banco. "Cliente desde" + contatos já realizados
 *    bastam para saber o marco atual, e assim ninguém precisa gerar tarefa
 *    nem corrigir fila quando um cliente entra, sai ou volta.
 * 2. O marco registrado é o marco DA IDADE do cliente, não o "próximo da
 *    lista". Quem virou cliente há 100 dias e nunca foi contatado está no
 *    marco de 90 — cumprir 90 leva direto para 180. Se fosse pelo próximo da
 *    lista (30), o contato seguinte (60) nasceria vencido, e a tela cobraria
 *    três conversas seguidas com a mesma empresa.
 */

export const MARCOS_INICIAIS: readonly number[] = [30, 60, 90, 180];
/** Depois do 180, a cada trimestre — "pelo menos a cada trimestre conversamos com todos". */
export const INTERVALO_TRIMESTRAL = 90;
/** Dias depois do previsto em que o contato passa a contar como atrasado. */
export const TOLERANCIA_DIAS = 7;
/** Antecedência com que o contato aparece como "na janela". */
export const ANTECEDENCIA_DIAS = 7;

const DIA_MS = 86_400_000;

export function marcoSeguinte(marco: number): number {
  const i = MARCOS_INICIAIS.indexOf(marco);
  if (i >= 0 && i < MARCOS_INICIAIS.length - 1) return MARCOS_INICIAIS[i + 1];
  return marco + INTERVALO_TRIMESTRAL;
}

/**
 * Marco que está na vez, dado quantos dias a empresa é cliente e o último
 * marco cumprido. Anda a sequência até o maior marco já alcançado pela idade;
 * se nenhum foi alcançado ainda, devolve o primeiro que vem.
 */
export function marcoAtual(diasComoCliente: number, ultimoMarcoCumprido: number | null): number {
  let m = ultimoMarcoCumprido === null ? MARCOS_INICIAIS[0] : marcoSeguinte(ultimoMarcoCumprido);
  while (marcoSeguinte(m) <= diasComoCliente) m = marcoSeguinte(m);
  return m;
}

export function rotuloDoMarco(marco: number): string {
  return MARCOS_INICIAIS.includes(marco) ? `${marco} dias de cliente` : `trimestral · ${marco} dias`;
}

export type SituacaoFollowUp = "ATRASADO" | "NA_JANELA" | "EM_DIA" | "RETORNO_PEDIDO";

export type Cadencia = {
  clienteDesde: Date;
  diasComoCliente: number;
  marco: number;
  previstoPara: Date;
  situacao: SituacaoFollowUp;
  /** Positivo = dias de atraso; negativo = dias que faltam. */
  diasDeDesvio: number;
  retornarEm: Date | null;
};

/** Número de série do dia no fuso de Brasília — o mesmo critério da ativação. */
function diaBRT(d: Date): number {
  const [ano, mes, dia] = d
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .split("-")
    .map(Number);
  return Math.floor(Date.UTC(ano, mes - 1, dia) / DIA_MS);
}

/**
 * Dias de CALENDÁRIO entre duas datas. "Cliente há 100 dias" é conta de
 * calendário, não de blocos de 24 horas: quem pagou às 18h de um dia e é
 * consultado às 9h do outro já está no dia seguinte.
 */
export function diasEntre(de: Date, ate: Date): number {
  return diaBRT(ate) - diaBRT(de);
}

export function calcularCadencia(input: {
  clienteDesde: Date;
  ultimoMarcoCumprido: number | null;
  retornarEm: Date | null;
  hoje?: Date;
}): Cadencia {
  const hoje = input.hoje ?? new Date();
  const diasComoCliente = Math.max(0, diasEntre(input.clienteDesde, hoje));
  const marco = marcoAtual(diasComoCliente, input.ultimoMarcoCumprido);
  const previstoPara = new Date(input.clienteDesde.getTime() + marco * DIA_MS);
  const diasDeDesvio = diasComoCliente - marco;

  let situacao: SituacaoFollowUp;
  if (input.retornarEm && input.retornarEm.getTime() <= hoje.getTime()) situacao = "RETORNO_PEDIDO";
  else if (diasDeDesvio > TOLERANCIA_DIAS) situacao = "ATRASADO";
  else if (diasDeDesvio >= -ANTECEDENCIA_DIAS) situacao = "NA_JANELA";
  else situacao = "EM_DIA";

  return {
    clienteDesde: input.clienteDesde,
    diasComoCliente,
    marco,
    previstoPara,
    situacao,
    diasDeDesvio,
    retornarEm: input.retornarEm,
  };
}

// ─── Diagnóstico de uso ───────────────────────────────────────────────────────

export type Gravidade = "alta" | "media" | "baixa";

export type PontoDeAtencao = {
  chave: string;
  gravidade: Gravidade;
  /** "uso" = alimentando errado ou deixando de alimentar; "ocioso" = funcionalidade do plano que ele não usa. */
  tipo: "uso" | "ocioso";
  titulo: string;
  detalhe: string;
  /** O passo a passo da tela — conduzir o cliente a fazer, não fazer por ele. */
  orientacao: string;
};

export type DiagnosticoDeUso = {
  documentos: { atas: number; contratos: number; empenhos: number };
  ultimaMovimentacaoEm: Date | null;
  ultimoAcessoEm: Date | null;
  usuarios: number;
  pontos: PontoDeAtencao[];
};

const PESO: Record<Gravidade, number> = { alta: 0, media: 1, baixa: 2 };

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * O que o cliente está fazendo — e deixando de fazer — dentro do sistema.
 *
 * Cada ponto sai com a orientação pronta porque a pessoa que liga não é quem
 * conhece cada tela de cor. E a orientação é sempre "onde clicar", nunca "me
 * manda que eu cadastro" ([[feedback-conduzir-cliente-nao-fazer-por-ele]]).
 */
export async function diagnosticarUso(contaId: string, hoje: Date = new Date()): Promise<DiagnosticoDeUso> {
  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    select: {
      plano: true,
      conciliacaoCortesiaAte: true,
      empresas: { select: { id: true } },
      usuarios: {
        orderBy: { criadoEm: "asc" },
        select: { id: true, telefoneWhatsApp: true, optInWhatsApp: true },
      },
    },
  });
  if (!conta) throw new Error("Conta não encontrada.");

  const empresaIds = conta.empresas.map((e) => e.id);
  const usuarioIds = conta.usuarios.map((u) => u.id);
  const porEmpresa = { empresaId: { in: empresaIds } };
  const ha = (dias: number) => new Date(hoje.getTime() - dias * DIA_MS);

  const semEmpresa = empresaIds.length === 0;
  const [
    atas, contratos, empenhos,
    ultimaAta, ultimoContrato, ultimoEmpenho,
    ultimaSessao, ultimaAuditoria,
    entregueSemNota, nfSemEncaminhar, aguardandoPagamento, vencidoSemEntrega,
    atestadosAta, atestadosContrato,
    contratosSemItens, atasSemItens, contratosSemPdf, atasSemPdf, garantiaDeclaradaSemCadastro,
    contasGoogle, extratos, pareceres, mensagensIA,
  ] = await Promise.all([
    semEmpresa ? 0 : prisma.ata.count({ where: porEmpresa }),
    semEmpresa ? 0 : prisma.contrato.count({ where: porEmpresa }),
    semEmpresa ? 0 : prisma.empenho.count({ where: porEmpresa }),
    semEmpresa ? null : prisma.ata.findFirst({ where: porEmpresa, orderBy: { atualizadoEm: "desc" }, select: { atualizadoEm: true } }),
    semEmpresa ? null : prisma.contrato.findFirst({ where: porEmpresa, orderBy: { atualizadoEm: "desc" }, select: { atualizadoEm: true } }),
    semEmpresa ? null : prisma.empenho.findFirst({ where: porEmpresa, orderBy: { atualizadoEm: "desc" }, select: { atualizadoEm: true } }),
    prisma.sessao.findFirst({ where: { usuarioId: { in: usuarioIds } }, orderBy: { criadoEm: "desc" }, select: { criadoEm: true } }),
    prisma.logAuditoria.findFirst({ where: { contaId }, orderBy: { criadoEm: "desc" }, select: { criadoEm: true } }),
    semEmpresa ? 0 : prisma.empenho.count({ where: { ...porEmpresa, status: "ENTREGUE", OR: [{ dataEntrega: { lt: ha(15) } }, { dataEntrega: null, atualizadoEm: { lt: ha(15) } }] } }),
    semEmpresa ? 0 : prisma.empenho.count({ where: { ...porEmpresa, status: "NF_EMITIDA", OR: [{ dataNfEmitida: { lt: ha(7) } }, { dataNfEmitida: null, atualizadoEm: { lt: ha(7) } }] } }),
    semEmpresa ? 0 : prisma.empenho.count({ where: { ...porEmpresa, status: "NF_ENCAMINHADA", OR: [{ dataNfEncaminhada: { lt: ha(30) } }, { dataNfEncaminhada: null, atualizadoEm: { lt: ha(30) } }] } }),
    semEmpresa ? 0 : prisma.empenho.count({ where: { ...porEmpresa, status: { in: ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO"] }, vigenciaFim: { lt: ha(7) } } }),
    semEmpresa ? 0 : prisma.ata.count({ where: { ...porEmpresa, ...whereAtestadoPendente(hoje) } }),
    semEmpresa ? 0 : prisma.contrato.count({ where: { ...porEmpresa, ...whereAtestadoPendente(hoje) } }),
    semEmpresa ? 0 : prisma.contrato.count({ where: { ...porEmpresa, itens: { none: {} } } }),
    semEmpresa ? 0 : prisma.ata.count({ where: { ...porEmpresa, itens: { none: {} } } }),
    semEmpresa ? 0 : prisma.contrato.count({ where: { ...porEmpresa, arquivoPdfUrl: null, anexos: { none: {} } } }),
    semEmpresa ? 0 : prisma.ata.count({ where: { ...porEmpresa, arquivoPdfUrl: null, anexos: { none: {} } } }),
    semEmpresa ? 0 : prisma.contrato.count({ where: { ...porEmpresa, temGarantia: true, garantias: { none: {} } } }),
    prisma.googleAccount.count({ where: { usuarioId: { in: usuarioIds } } }),
    prisma.extrato.count({ where: { contaId } }),
    prisma.parecerJuridico.count({ where: { criadoPorId: { in: usuarioIds } } }),
    prisma.mensagemIAsystem.count({ where: { usuarioId: { in: usuarioIds }, role: "user" } }),
  ]);

  const movimentos = [ultimaAta?.atualizadoEm, ultimoContrato?.atualizadoEm, ultimoEmpenho?.atualizadoEm]
    .filter((d): d is Date => !!d);
  const ultimaMovimentacaoEm = movimentos.length ? new Date(Math.max(...movimentos.map((d) => d.getTime()))) : null;
  const acessos = [ultimaSessao?.criadoEm, ultimaAuditoria?.criadoEm].filter((d): d is Date => !!d);
  const ultimoAcessoEm = acessos.length ? new Date(Math.max(...acessos.map((d) => d.getTime()))) : null;

  const totalDocs = atas + contratos + empenhos;
  const pontos: PontoDeAtencao[] = [];

  // ── Deixando de alimentar ──────────────────────────────────────────────
  if (totalDocs === 0) {
    pontos.push({
      chave: "sem-documentos", gravidade: "alta", tipo: "uso",
      titulo: "Nenhuma contratação cadastrada",
      detalhe: "Paga a assinatura e o sistema ainda não acompanha nada: nenhum prazo, nenhum saldo, nenhum aviso.",
      orientacao: "Peça para ele pegar a ata ou o contrato de vigência mais próxima e abrir Contratos › Nova contratação (ou Atas › Nova ata). Anexando o PDF, o sistema lê número, datas e itens; ele só confere e salva.",
    });
  } else if (ultimaMovimentacaoEm) {
    const dias = diasEntre(ultimaMovimentacaoEm, hoje);
    if (dias >= 30) {
      pontos.push({
        chave: "parado", gravidade: dias >= 60 ? "alta" : "media", tipo: "uso",
        titulo: `Sem movimentação há ${dias} dias`,
        detalhe: "Nenhuma ata, contrato ou empenho criado ou atualizado nesse período. Ou a operação parou, ou está sendo controlada fora do sistema.",
        orientacao: "Pergunte o que entrou de novo nesse período. Cada contratação fora do sistema é um prazo sem aviso. O caminho é Fornecimento/Execução › Novo empenho para o que já está em execução, e Contratos ou Atas para o instrumento novo.",
      });
    }
  }
  if (ultimoAcessoEm) {
    const dias = diasEntre(ultimoAcessoEm, hoje);
    if (dias >= 21) {
      pontos.push({
        chave: "sem-acesso", gravidade: "media", tipo: "uso",
        titulo: `Ninguém da empresa entra há ${dias} dias`,
        detalhe: "Os avisos de WhatsApp continuam saindo, mas sem alguém olhando a tela nada é atualizado — e aviso de coisa já resolvida vira ruído.",
        orientacao: "Descubra quem deveria estar operando. Se for outra pessoa, o titular cadastra em Equipe › Adicionar colaborador e marca só os módulos que ela precisa.",
      });
    }
  } else if (totalDocs > 0) {
    pontos.push({
      chave: "sem-acesso", gravidade: "media", tipo: "uso",
      titulo: "Sem registro de acesso recente",
      detalhe: "Há documentos cadastrados, mas nenhum acesso ou alteração registrada nos últimos 30 dias.",
      orientacao: "Pergunte quem opera o sistema hoje e se a pessoa ainda está na empresa. Se mudou, o titular ajusta em Equipe.",
    });
  }

  // ── Alimentando errado / esteira parada ────────────────────────────────
  if (vencidoSemEntrega > 0) {
    pontos.push({
      chave: "empenho-vencido", gravidade: "alta", tipo: "uso",
      titulo: `${plural(vencidoSemEntrega, "empenho", "empenhos")} com vigência encerrada e sem entrega registrada`,
      detalhe: "Ou a entrega aconteceu e não foi lançada (o sistema acha que está atrasado), ou não aconteceu e há risco de penalidade.",
      orientacao: "Em Fornecimento/Execução, abrir cada um e registrar o que houve: Registrar entrega (total ou parcial, com a data real) ou Registrar inexecução. Com isso o painel para de acusar atraso falso.",
    });
  }
  if (entregueSemNota > 0) {
    pontos.push({
      chave: "entregue-sem-nota", gravidade: "alta", tipo: "uso",
      titulo: `${plural(entregueSemNota, "entrega concluída", "entregas concluídas")} há mais de 15 dias sem nota fiscal`,
      detalhe: "É dinheiro entregue que ainda não pode ser cobrado do órgão — ou a nota saiu e não foi registrada.",
      orientacao: "Em Fornecimento/Execução › filtro Entregue, abrir o empenho e usar Registrar nota emitida, anexando o PDF da nota. Se a nota ainda não saiu, é hora de emitir.",
    });
  }
  if (nfSemEncaminhar > 0) {
    pontos.push({
      chave: "nf-sem-encaminhar", gravidade: "media", tipo: "uso",
      titulo: `${plural(nfSemEncaminhar, "nota emitida", "notas emitidas")} há mais de 7 dias sem encaminhamento ao órgão`,
      detalhe: "O prazo de pagamento do órgão só começa a contar depois do encaminhamento. Enquanto não registra, o sistema não cobra o atraso certo.",
      orientacao: "No empenho, Registrar nota encaminhada com a data do protocolo. A partir daí o sistema conta o prazo de pagamento e avisa quando o órgão atrasar.",
    });
  }
  if (aguardandoPagamento > 0) {
    pontos.push({
      chave: "aguardando-pagamento", gravidade: "media", tipo: "uso",
      titulo: `${plural(aguardandoPagamento, "nota encaminhada", "notas encaminhadas")} há mais de 30 dias sem baixa de pagamento`,
      detalhe: "Ou o órgão está atrasado — e vale cobrar — ou o pagamento entrou e ninguém deu baixa.",
      orientacao: "Confirmar com o financeiro se já recebeu. Se sim, Registrar pagamento no empenho (ou mandar o extrato em PDF para a Conciliação bancária, que dá baixa sozinha). Se não, o sistema tem o modelo de cobrança ao órgão.",
    });
  }
  if (atestadosAta + atestadosContrato > 0) {
    const n = atestadosAta + atestadosContrato;
    pontos.push({
      chave: "atestado-pendente", gravidade: "media", tipo: "uso",
      titulo: `${plural(n, "contratação encerrada", "contratações encerradas")} sem atestado de capacidade técnica`,
      detalhe: "Atestado é o que habilita a empresa nas próximas licitações. Encerrou e ninguém pediu ao órgão.",
      orientacao: "Em Atestados aparece a lista do que encerrou. Para cada um: Solicitar ao órgão (o sistema acompanha a espera) ou Dispensar, se não valer a pena pedir.",
    });
  }
  if (contratosSemItens + atasSemItens > 0) {
    const n = contratosSemItens + atasSemItens;
    pontos.push({
      chave: "sem-itens", gravidade: "media", tipo: "uso",
      titulo: `${plural(n, "contratação", "contratações")} sem itens cadastrados`,
      detalhe: "Sem itens o sistema não calcula saldo nem quanto falta executar — a ata vira só uma data de vencimento.",
      orientacao: "Abrir a ata ou o contrato › aba Itens › Adicionar itens. Anexando o PDF, a IA extrai a tabela de itens; ele confere e confirma.",
    });
  }
  if (garantiaDeclaradaSemCadastro > 0) {
    pontos.push({
      chave: "garantia-sem-cadastro", gravidade: "baixa", tipo: "uso",
      titulo: `${plural(garantiaDeclaradaSemCadastro, "contrato declara", "contratos declaram")} garantia, mas nenhuma está cadastrada`,
      detalhe: "Garantia vencida antes do contrato é motivo de notificação pelo órgão. Sem o cadastro, o sistema não avisa.",
      orientacao: "No contrato › aba Garantias › Nova garantia: modalidade, valor, início e fim. O vencimento passa a ser acompanhado.",
    });
  }
  if (contratosSemPdf + atasSemPdf > 0) {
    const n = contratosSemPdf + atasSemPdf;
    pontos.push({
      chave: "sem-pdf", gravidade: "baixa", tipo: "uso",
      titulo: `${plural(n, "contratação", "contratações")} sem o PDF anexado`,
      detalhe: "O documento continua no e-mail de alguém. Anexado, qualquer pessoa da equipe acha na hora, e a IA jurídica consegue analisar.",
      orientacao: "Abrir o documento › Anexos › Enviar arquivo, categoria Contratual.",
    });
  }

  // ── Funcionalidades ociosas ────────────────────────────────────────────
  const titular = conta.usuarios[0];
  const alguemComWhatsApp = conta.usuarios.some((u) => u.telefoneWhatsApp && u.optInWhatsApp);
  if (!alguemComWhatsApp) {
    pontos.push({
      chave: "whatsapp-desligado", gravidade: "alta", tipo: "ocioso",
      titulo: "Ninguém recebe os avisos por WhatsApp",
      detalhe: titular?.telefoneWhatsApp
        ? "Há telefone cadastrado, mas o recebimento está desligado. É o principal valor do sistema ficando na gaveta."
        : "Nenhum usuário da conta tem telefone cadastrado para avisos. Vencimento, entrega atrasada e nota sem pagar só aparecem se alguém entrar na tela.",
      orientacao: "Conta › Notificações WhatsApp: informar o número, marcar Quero receber e escolher os tipos de aviso. Vale fazer com ele na linha, leva um minuto.",
    });
  }
  if (contasGoogle === 0 && totalDocs > 0) {
    pontos.push({
      chave: "google-agenda", gravidade: "baixa", tipo: "ocioso",
      titulo: "Google Agenda não conectado",
      detalhe: "Vencimentos de contrato, entregas e garantias poderiam aparecer na agenda que a equipe já olha todo dia.",
      orientacao: "Conta › Integrações › Conectar Google Agenda. O sistema cria uma agenda própria, 'CP System — Contratos e Vencimentos', e não mexe na agenda pessoal.",
    });
  }
  const temConciliacao = conta.plano !== "BASICO" || (conta.conciliacaoCortesiaAte ? conta.conciliacaoCortesiaAte > hoje : false);
  if (temConciliacao && extratos === 0) {
    pontos.push({
      chave: "conciliacao-ociosa", gravidade: "media", tipo: "ocioso",
      titulo: "Conciliação bancária nunca usada",
      detalhe: "Está no plano e nunca recebeu um extrato. É ela que responde 'quais notas o órgão já pagou' sem conferência manual.",
      orientacao: "Conciliação bancária › Enviar extrato (PDF do banco) — ou mandar o PDF pelo WhatsApp da CP System. O sistema cruza com as notas encaminhadas e dá baixa no que bateu.",
    });
  }
  if (conta.plano !== "BASICO" && pareceres + mensagensIA === 0) {
    pontos.push({
      chave: "juridico-ocioso", gravidade: "baixa", tipo: "ocioso",
      titulo: "Consultoria jurídica nunca usada",
      detalhe: "O plano inclui análise de documentos e dúvidas sobre a Lei 14.133 com o contexto dos contratos dele.",
      orientacao: "Consultoria jurídica › Analisar documento (escolhe a ata ou contrato) ou perguntar direto no chat. Sugira começar pelo contrato que vence primeiro.",
    });
  }
  if (conta.usuarios.length === 1 && totalDocs >= 3) {
    pontos.push({
      chave: "equipe-sozinho", gravidade: "baixa", tipo: "ocioso",
      titulo: "Só uma pessoa tem acesso",
      detalhe: "Dois colaboradores estão inclusos no plano. Quem cuida da entrega e da nota no dia a dia poderia registrar direto, sem passar pelo dono.",
      orientacao: "Equipe › Adicionar colaborador, marcando os módulos que ele pode ver — o financeiro pode ficar só com o titular.",
    });
  }

  pontos.sort((a, b) => PESO[a.gravidade] - PESO[b.gravidade]);

  return {
    documentos: { atas, contratos, empenhos },
    ultimaMovimentacaoEm,
    ultimoAcessoEm,
    usuarios: conta.usuarios.length,
    pontos,
  };
}

// ─── A carteira ───────────────────────────────────────────────────────────────

export type FollowUpRegistrado = {
  id: string;
  marcoDias: number;
  resultado: ResultadoFollowUp;
  canal: CanalFollowUp;
  contatoNome: string | null;
  resumo: string;
  orientacoes: string | null;
  feedback: string | null;
  retornarEm: Date | null;
  realizadoEm: Date;
  realizadoPorNome: string | null;
};

export type ClienteFollowUp = {
  contaId: string;
  nome: string;
  plano: string;
  statusAssinatura: string;
  titular: { nome: string; email: string; telefoneWhatsApp: string | null } | null;
  cadencia: Cadencia;
  diagnostico: DiagnosticoDeUso;
  /** Tentativas sem sucesso desde o último contato realizado. */
  tentativasDesdeUltimo: number;
  historico: FollowUpRegistrado[];
};

/**
 * Quem entra na cadência: quem PAGA. Trial é assunto da ativação.
 *
 * Inadimplente só entra se já pagou alguma vez: em 30/10 havia duas contas
 * INADIMPLENTE em produção que nunca tiveram fatura paga — trial que acabou e
 * ficou com documento dentro. Isso é lead perdido, não cliente, e apareceria
 * como "atrasado" na primeira segunda-feira da rotina.
 */
function whereClientes() {
  return {
    tipo: "EMPRESA" as const,
    arquivadaEm: null,
    OR: [
      { statusAssinatura: "ATIVA" as const },
      { statusAssinatura: "INADIMPLENTE" as const, cobrancas: { some: { status: "PAGA" as const } } },
    ],
    usuarios: {
      none: { OR: [{ superAdmin: true }, { email: "demonstracao@cpsystem.app.br" }] },
    },
  };
}

/**
 * Desde quando a conta é cliente: a primeira fatura paga. Conta ativa sem
 * fatura (cortesia, migração) conta a partir do fim do teste, ou da criação.
 */
async function clienteDesde(conta: { id: string; criadoEm: Date; trialAteEm: Date | null }, hoje: Date): Promise<Date> {
  const primeiraPaga = await prisma.cobranca.findFirst({
    where: { contaId: conta.id, status: "PAGA" },
    orderBy: [{ pagaEm: "asc" }, { vencimento: "asc" }],
    select: { pagaEm: true, vencimento: true },
  });
  if (primeiraPaga) return primeiraPaga.pagaEm ?? primeiraPaga.vencimento;
  if (conta.trialAteEm && conta.trialAteEm < hoje) return conta.trialAteEm;
  return conta.criadoEm;
}

async function cadenciaDaConta(
  conta: { id: string; criadoEm: Date; trialAteEm: Date | null },
  followUps: { marcoDias: number; resultado: ResultadoFollowUp; retornarEm: Date | null; realizadoEm: Date }[],
  hoje: Date,
): Promise<{ cadencia: Cadencia; tentativasDesdeUltimo: number }> {
  const desde = await clienteDesde(conta, hoje);
  const realizados = followUps.filter((f) => f.resultado === "REALIZADO");
  const ultimoMarco = realizados.length ? Math.max(...realizados.map((f) => f.marcoDias)) : null;
  const ultimoRealizadoEm = realizados.length ? new Date(Math.max(...realizados.map((f) => f.realizadoEm.getTime()))) : null;
  const tentativasDesdeUltimo = followUps.filter(
    (f) => f.resultado === "TENTATIVA" && (!ultimoRealizadoEm || f.realizadoEm > ultimoRealizadoEm),
  ).length;

  // Pedido de retorno vale só o mais recente, e só até o próximo contato realizado.
  const maisRecente = followUps.reduce<typeof followUps[number] | null>(
    (a, b) => (!a || b.realizadoEm > a.realizadoEm ? b : a), null,
  );
  const retornarEm = maisRecente?.retornarEm ?? null;

  return {
    cadencia: calcularCadencia({ clienteDesde: desde, ultimoMarcoCumprido: ultimoMarco, retornarEm, hoje }),
    tentativasDesdeUltimo,
  };
}

const ORDEM_SITUACAO: Record<SituacaoFollowUp, number> = { ATRASADO: 0, RETORNO_PEDIDO: 0, NA_JANELA: 1, EM_DIA: 2 };

export async function listarClientesParaFollowUp(hoje: Date = new Date()): Promise<ClienteFollowUp[]> {
  const contas = await prisma.conta.findMany({
    where: whereClientes(),
    select: {
      id: true, plano: true, statusAssinatura: true, criadoEm: true, trialAteEm: true,
      empresas: { select: { razaoSocial: true, nomeFantasia: true }, orderBy: { criadoEm: "asc" }, take: 1 },
      usuarios: {
        orderBy: { criadoEm: "asc" }, take: 1,
        select: { nome: true, email: true, telefoneWhatsApp: true },
      },
      followUps: {
        orderBy: { realizadoEm: "desc" },
        select: {
          id: true, marcoDias: true, resultado: true, canal: true, contatoNome: true, resumo: true,
          orientacoes: true, feedback: true, retornarEm: true, realizadoEm: true, realizadoPorNome: true,
        },
      },
    },
  });

  const clientes: ClienteFollowUp[] = [];
  for (const c of contas) {
    const [{ cadencia, tentativasDesdeUltimo }, diagnostico] = await Promise.all([
      cadenciaDaConta(c, c.followUps, hoje),
      diagnosticarUso(c.id, hoje),
    ]);
    const empresa = c.empresas[0];
    clientes.push({
      contaId: c.id,
      nome: empresa?.nomeFantasia || empresa?.razaoSocial || c.usuarios[0]?.nome || "Conta sem empresa",
      plano: c.plano,
      statusAssinatura: c.statusAssinatura,
      titular: c.usuarios[0] ?? null,
      cadencia,
      diagnostico,
      tentativasDesdeUltimo,
      historico: c.followUps,
    });
  }

  clientes.sort((a, b) => {
    const s = ORDEM_SITUACAO[a.cadencia.situacao] - ORDEM_SITUACAO[b.cadencia.situacao];
    if (s !== 0) return s;
    return b.cadencia.diasDeDesvio - a.cadencia.diasDeDesvio;
  });
  return clientes;
}

export type FeedbackColhido = {
  id: string;
  cliente: string;
  feedback: string;
  realizadoEm: Date;
  realizadoPorNome: string | null;
};

/** O que os clientes pediram — matéria-prima da melhoria do sistema. */
export async function listarFeedbacks(limite = 50): Promise<FeedbackColhido[]> {
  const linhas = await prisma.followUpCliente.findMany({
    where: { feedback: { not: null } },
    orderBy: { realizadoEm: "desc" },
    take: limite,
    select: {
      id: true, feedback: true, realizadoEm: true, realizadoPorNome: true,
      conta: { select: { empresas: { select: { razaoSocial: true, nomeFantasia: true }, take: 1 } } },
    },
  });
  return linhas
    .filter((l) => !!l.feedback?.trim())
    .map((l) => ({
      id: l.id,
      cliente: l.conta.empresas[0]?.nomeFantasia || l.conta.empresas[0]?.razaoSocial || "—",
      feedback: l.feedback!.trim(),
      realizadoEm: l.realizadoEm,
      realizadoPorNome: l.realizadoPorNome,
    }));
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export const CANAIS: readonly CanalFollowUp[] = ["WHATSAPP", "TELEFONE", "VIDEOCHAMADA", "EMAIL", "PRESENCIAL"];
export const RESULTADOS: readonly ResultadoFollowUp[] = ["REALIZADO", "TENTATIVA"];

export type NovoFollowUp = {
  contaId: string;
  resultado: ResultadoFollowUp;
  canal: CanalFollowUp;
  contatoNome?: string | null;
  resumo: string;
  orientacoes?: string | null;
  feedback?: string | null;
  retornarEm?: Date | null;
};

/**
 * Grava um contato. O marco é decidido aqui, pela idade do cliente — quem
 * registra não escolhe, para a cadência não depender de ninguém lembrar em
 * que marco a empresa estava.
 */
export async function registrarFollowUp(
  dados: NovoFollowUp,
  quem: { id: string; nome: string },
  hoje: Date = new Date(),
): Promise<{ id: string; marcoDias: number }> {
  const conta = await prisma.conta.findFirst({
    where: { id: dados.contaId, ...whereClientes() },
    select: {
      id: true, criadoEm: true, trialAteEm: true,
      followUps: { select: { marcoDias: true, resultado: true, retornarEm: true, realizadoEm: true } },
    },
  });
  if (!conta) throw new Error("Esta conta não está na carteira de follow-up.");
  if (!RESULTADOS.includes(dados.resultado)) throw new Error("Resultado inválido.");
  if (!CANAIS.includes(dados.canal)) throw new Error("Canal inválido.");

  const resumo = dados.resumo.trim();
  if (dados.resultado === "REALIZADO" && resumo.length < 10) {
    throw new Error("Conte em uma frase o que o cliente disse — é o que vale para o próximo contato.");
  }

  const { cadencia } = await cadenciaDaConta(conta, conta.followUps, hoje);
  const diagnostico = await diagnosticarUso(conta.id, hoje);

  const criado = await prisma.followUpCliente.create({
    data: {
      contaId: conta.id,
      marcoDias: cadencia.marco,
      resultado: dados.resultado,
      canal: dados.canal,
      contatoNome: dados.contatoNome?.trim().slice(0, 120) || null,
      resumo: (resumo || (dados.resultado === "TENTATIVA" ? "Tentativa de contato sem sucesso." : "")).slice(0, 4000),
      orientacoes: dados.orientacoes?.trim().slice(0, 4000) || null,
      feedback: dados.feedback?.trim().slice(0, 4000) || null,
      retornarEm: dados.retornarEm ?? null,
      diagnostico: diagnostico.pontos.map((p) => ({ chave: p.chave, gravidade: p.gravidade, titulo: p.titulo })),
      realizadoEm: hoje,
      realizadoPorId: quem.id,
      realizadoPorNome: quem.nome,
    },
    select: { id: true, marcoDias: true },
  });
  return criado;
}

// ─── Lembrete à equipe ────────────────────────────────────────────────────────

function dataBr(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Texto do lembrete semanal para o grupo da equipe. `null` quando ninguém
 * está na vez — lembrete que chega sempre é lembrete que ninguém lê.
 */
export async function montarLembreteFollowUp(hoje: Date = new Date()): Promise<string | null> {
  const clientes = await listarClientesParaFollowUp(hoje);
  const naVez = clientes.filter((c) => c.cadencia.situacao !== "EM_DIA");
  if (naVez.length === 0) return null;

  const linha = (c: ClienteFollowUp) => {
    const cad = c.cadencia;
    const quando =
      cad.situacao === "RETORNO_PEDIDO" && cad.retornarEm
        ? `retorno pedido para ${dataBr(cad.retornarEm)}`
        : cad.situacao === "ATRASADO"
          ? `atrasado ${cad.diasDeDesvio} dias (marco de ${cad.marco})`
          : `marco de ${cad.marco} dias, previsto ${dataBr(cad.previstoPara)}`;
    const alta = c.diagnostico.pontos.filter((p) => p.gravidade === "alta").length;
    return `▫ *${c.nome}* — ${quando}${alta ? ` · ${plural(alta, "ponto grave", "pontos graves")} no uso` : ""}`;
  };

  const emDia = clientes.length - naVez.length;
  return (
    `🤝 *Follow-up de clientes — semana*\n\n` +
    `${plural(naVez.length, "cliente na vez", "clientes na vez")} de conversar` +
    (emDia ? `, ${emDia} em dia` : "") +
    `.\n\n` +
    naVez.map(linha).join("\n") +
    `\n\nDiagnóstico de uso, roteiro e registro: cpsystem.app.br/follow-up`
  );
}
