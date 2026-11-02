import "server-only";
import { prisma } from "@/lib/prisma";
import { COMISSAO_FIXA_POR_VINCULO } from "@/lib/comissaoEmbaixador";

/**
 * Programa de Indicação (Regina, 02/11/2026).
 *
 * *"Para aqueles que não são analistas, mas têm clientes para indicar,
 * criando cupons. Ele cadastra o nome dele e gera o cupom."*
 *
 * O que já existia e é reaproveitado inteiro: `Cupom` (código que a empresa
 * digita no cadastro; `analistaVinculadoId` vira `Conta.embaixadorId`),
 * `calcularComissoesDoMes` (R$ 29,90 por conta indicada ATIVA com fatura
 * paga, todo mês) e o cron do dia 20 que paga por PIX. O indicador é uma
 * linha de `Analista` com `indicador = true` — assim nada disso precisa de
 * segundo caminho.
 *
 * O que é novo: a porta de entrada pública (/indicar), o cupom pessoal
 * gerado sozinho no cadastro, e a página /indicacao com cupom, placar,
 * funil, comissões e mensagens prontas.
 *
 * Decisão registrada: o cupom do indicador dá à empresa o teste PADRÃO
 * (14 dias). Ele serve para a indicação ser da pessoa — não é desconto nem
 * mês grátis, que a Regina nunca aprovou ([[sem-mes-gratis-por-indicacao]]).
 * Se um dia a Regina decidir dar um teste maior a quem vem indicado, é só
 * mudar a constante abaixo; os cupons já emitidos seguem com o valor que
 * têm (o admin edita em /admin/cupons).
 */

export const DIAS_TRIAL_CUPOM_INDICACAO = 14;
export const SITE = "https://cpsystem.app.br";
/** Dia do mês em que o cron paga as comissões do mês anterior. */
export const DIA_PAGAMENTO_COMISSAO = 20;

export function linkDoCupom(codigo: string): string {
  return `${SITE}/signup?cupom=${encodeURIComponent(codigo)}`;
}

function semAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** MARIA-7K2P: primeiro nome + 4 caracteres. Legível ao telefone, fácil de ditar. */
function sugerirCodigo(nome: string): string {
  const primeiro = semAcentos(nome.trim().split(/\s+/)[0] || "CP")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "CP";
  // Sem 0/O e 1/I: ditado por telefone, "O" e "0" viram a mesma coisa.
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let sufixo = "";
  for (let i = 0; i < 4; i++) sufixo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `${primeiro}-${sufixo}`;
}

/**
 * O cupom pessoal: um por pessoa. Se já existe um cupom ativo apontando para
 * ela (inclusive os que o admin criou à mão), é esse — não se cria outro.
 */
export async function garantirCupomDoAnalista(
  analista: { id: string; nomeCompleto: string },
  criadoPorId: string | null,
): Promise<{ id: string; codigo: string; diasTrial: number; usosAtuais: number }> {
  const existente = await prisma.cupom.findFirst({
    where: { analistaVinculadoId: analista.id, ativo: true },
    orderBy: { criadoEm: "asc" },
    select: { id: true, codigo: true, diasTrial: true, usosAtuais: true },
  });
  if (existente) return existente;

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = sugerirCodigo(analista.nomeCompleto);
    const colide = await prisma.cupom.findUnique({ where: { codigo }, select: { id: true } });
    if (colide) continue;
    return prisma.cupom.create({
      data: {
        codigo,
        descricao: `Cupom de indicação de ${analista.nomeCompleto}`,
        diasTrial: DIAS_TRIAL_CUPOM_INDICACAO,
        analistaVinculadoId: analista.id,
        criadoPorId,
      },
      select: { id: true, codigo: true, diasTrial: true, usosAtuais: true },
    });
  }
  throw new Error("Não consegui gerar um código único para o cupom. Tente de novo.");
}

// ─── O painel ─────────────────────────────────────────────────────────────────

export type SituacaoIndicada = "TESTE" | "ASSINANTE" | "AGUARDANDO_PAGAMENTO" | "INADIMPLENTE" | "CANCELADA";

export type EmpresaIndicada = {
  contaId: string;
  nome: string;
  responsavel: string;
  cadastradaEm: Date;
  trialAteEm: Date | null;
  primeiraFaturaPagaEm: Date | null;
  situacao: SituacaoIndicada;
  /** O que esta empresa rende por mês hoje. */
  comissaoMensal: number;
  viaCupom: boolean;
};

export type ComissaoLinha = {
  id: string;
  competencia: string;
  cliente: string;
  valor: number;
  paga: boolean;
  pagaEm: Date | null;
};

export type ResumoIndicacao = {
  analista: { id: string; nomeCompleto: string; indicador: boolean; pix: string | null; telefone: string };
  cupom: { codigo: string; diasTrial: number; usosAtuais: number; link: string };
  empresas: EmpresaIndicada[];
  placar: {
    cadastradas: number;
    emTeste: number;
    assinantes: number;
    aguardandoPagamento: number;
    canceladas: number;
    comissaoMensal: number;
    aReceber: number;
    recebido: number;
    proximoPagamentoEm: Date;
    valorProximoPagamento: number;
  };
  comissoes: ComissaoLinha[];
};

function situacaoDaConta(c: {
  statusAssinatura: string;
  arquivadaEm: Date | null;
  primeiraPaga: Date | null;
}): SituacaoIndicada {
  if (c.arquivadaEm || c.statusAssinatura === "CANCELADA") return "CANCELADA";
  if (c.statusAssinatura === "INADIMPLENTE") return "INADIMPLENTE";
  if (c.statusAssinatura === "TRIAL") return "TESTE";
  // ATIVA
  return c.primeiraPaga ? "ASSINANTE" : "AGUARDANDO_PAGAMENTO";
}

/** Próximo dia 20 a partir de hoje (BRT). */
export function proximoPagamento(hoje: Date = new Date()): Date {
  const [ano, mes, dia] = hoje
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .split("-")
    .map(Number);
  const proximoMes = dia >= DIA_PAGAMENTO_COMISSAO ? mes : mes - 1;
  return new Date(Date.UTC(ano, proximoMes, DIA_PAGAMENTO_COMISSAO, 12));
}

export async function resumoDaIndicacao(contaId: string, usuarioId: string): Promise<ResumoIndicacao | null> {
  const analista = await prisma.analista.findUnique({
    where: { contaId },
    select: { id: true, nomeCompleto: true, indicador: true, pix: true, telefone: true },
  });
  if (!analista) return null;

  const cupom = await garantirCupomDoAnalista(analista, usuarioId);

  const [contas, comissoesRaw] = await Promise.all([
    prisma.conta.findMany({
      where: { embaixadorId: analista.id },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true, statusAssinatura: true, arquivadaEm: true, criadoEm: true, trialAteEm: true, cupomAplicadoId: true,
        empresas: { select: { razaoSocial: true, nomeFantasia: true }, orderBy: { criadoEm: "asc" }, take: 1 },
        usuarios: { select: { nome: true }, orderBy: { criadoEm: "asc" }, take: 1 },
        cobrancas: { where: { status: "PAGA" }, orderBy: { pagaEm: "asc" }, take: 1, select: { pagaEm: true, vencimento: true } },
      },
    }),
    prisma.comissao.findMany({
      where: { analistaId: analista.id },
      orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
      select: {
        id: true, competencia: true, valor: true, paga: true, pagaEm: true,
        conta: { select: { empresas: { select: { razaoSocial: true, nomeFantasia: true }, take: 1 } } },
      },
    }),
  ]);

  const empresas: EmpresaIndicada[] = contas.map((c) => {
    const primeiraPaga = c.cobrancas[0] ? (c.cobrancas[0].pagaEm ?? c.cobrancas[0].vencimento) : null;
    const situacao = situacaoDaConta({ statusAssinatura: c.statusAssinatura, arquivadaEm: c.arquivadaEm, primeiraPaga });
    return {
      contaId: c.id,
      nome: c.empresas[0]?.nomeFantasia || c.empresas[0]?.razaoSocial || c.usuarios[0]?.nome || "Empresa",
      responsavel: c.usuarios[0]?.nome ?? "—",
      cadastradaEm: c.criadoEm,
      trialAteEm: c.trialAteEm,
      primeiraFaturaPagaEm: primeiraPaga,
      situacao,
      comissaoMensal: situacao === "ASSINANTE" ? COMISSAO_FIXA_POR_VINCULO : 0,
      viaCupom: !!c.cupomAplicadoId,
    };
  });

  const comissoes: ComissaoLinha[] = comissoesRaw.map((c) => ({
    id: c.id,
    competencia: c.competencia,
    cliente: c.conta.empresas[0]?.nomeFantasia || c.conta.empresas[0]?.razaoSocial || "—",
    valor: c.valor,
    paga: c.paga,
    pagaEm: c.pagaEm,
  }));

  const conta = (s: SituacaoIndicada) => empresas.filter((e) => e.situacao === s).length;
  const assinantes = conta("ASSINANTE");
  const aReceber = comissoes.filter((c) => !c.paga).reduce((s, c) => s + c.valor, 0);

  return {
    analista,
    cupom: { codigo: cupom.codigo, diasTrial: cupom.diasTrial, usosAtuais: cupom.usosAtuais, link: linkDoCupom(cupom.codigo) },
    empresas,
    placar: {
      cadastradas: empresas.length,
      emTeste: conta("TESTE"),
      assinantes,
      aguardandoPagamento: conta("AGUARDANDO_PAGAMENTO"),
      canceladas: conta("CANCELADA") + conta("INADIMPLENTE"),
      comissaoMensal: assinantes * COMISSAO_FIXA_POR_VINCULO,
      aReceber,
      recebido: comissoes.filter((c) => c.paga).reduce((s, c) => s + c.valor, 0),
      proximoPagamentoEm: proximoPagamento(),
      valorProximoPagamento: aReceber,
    },
    comissoes,
  };
}

// ─── Mensagens prontas ────────────────────────────────────────────────────────

export type MensagemPronta = { canal: "whatsapp" | "email" | "linkedin"; titulo: string; texto: string };

/**
 * O que a pessoa manda para a empresa. Fala do problema da empresa, não do
 * programa — quem recebe não quer saber que o remetente ganha comissão, quer
 * saber que o contrato dele vai deixar de vencer sem aviso.
 */
export function mensagensProntas(nome: string, codigo: string): MensagemPronta[] {
  const primeiro = nome.split(" ")[0] || nome;
  const link = linkDoCupom(codigo);
  return [
    {
      canal: "whatsapp",
      titulo: "WhatsApp — curta, para quem você já conhece",
      texto:
        `Olá! Lembrei de você por causa dos contratos com o governo.\n\n` +
        `Conheço um sistema que acompanha ata, contrato e empenho depois da licitação: avisa no WhatsApp antes de a vigência acabar, aponta entrega sem nota e mostra quanto ainda dá para executar de cada ata.\n\n` +
        `Dá para testar 14 dias sem cartão. Cadastre com o meu código *${codigo}* em ${link}\n\n` +
        `Qualquer dúvida, me chama. — ${primeiro}`,
    },
    {
      canal: "email",
      titulo: "E-mail — um pouco mais formal",
      texto:
        `Assunto: Controle dos contratos com o governo\n\n` +
        `Prezados,\n\n` +
        `Indico o CP System, plataforma de gestão pós-licitação sob a Lei 14.133/2021. Ela acompanha atas de registro de preços, contratos e empenhos; avisa por WhatsApp com antecedência sobre vigências, prazos de entrega e notas sem pagamento; e mostra o saldo disponível de cada ata em tempo real.\n\n` +
        `O teste é de 14 dias, sem cartão. No cadastro, informem o código de indicação ${codigo}: ${link}\n\n` +
        `Fico à disposição para apresentar.\n\n` +
        `${nome}`,
    },
    {
      canal: "linkedin",
      titulo: "LinkedIn — post ou mensagem",
      texto:
        `Empresa que vende para o governo perde dinheiro em cinco lugares: prazo de prorrogação que passa, entrega que atrasa e vira multa, entrega feita sem nota, nota emitida que ninguém encaminha, e saldo de ata que sobra.\n\n` +
        `O CP System cuida exatamente disso, com aviso no WhatsApp antes de virar problema. Quem quiser testar por 14 dias, sem cartão, pode usar o meu código ${codigo} em ${link}`,
    },
  ];
}
