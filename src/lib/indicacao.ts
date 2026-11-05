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
 * paga, todo mês) e o repasse por PIX da régua diária, que paga assim que o
 * dinheiro do cliente entra em conta. O indicador é uma linha de `Analista`
 * com `indicador = true` — assim nada disso precisa de segundo caminho.
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

/**
 * Prazo em que a operadora de cartão libera o valor para o CP System. É o
 * mesmo número de `pagamentoAnalista.ts`: a comissão só sai depois que o
 * dinheiro do cliente existe em conta (Regina 10/08 e 24/08). PIX e boleto
 * entram junto com a confirmação; cartão, cerca de 32 dias depois.
 *
 * Regina 05/11/2026: *"É sempre no PIX, cai na hora se a pessoa pagar no
 * PIX. E se ela pagar no cartão, cai 32 dias depois, porque é o prazo que o
 * banco tem."* Até esta data a página pública, o painel e as boas-vindas do
 * indicador diziam "dia 20" — herança do cron antigo, regra que já não
 * existia desde 24/08. Não há data fixa no mês.
 */
export const DIAS_COMPENSACAO_CARTAO = 32;

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

// ─── Quando o dinheiro entra ──────────────────────────────────────────────────

/**
 * Situação de uma comissão ainda não paga, do ponto de vista de quem espera:
 * - LIBERADA: o dinheiro do cliente já está em conta; o PIX sai no próximo
 *   repasse automático (a régua roda todo dia).
 * - PREVISTA: o cliente pagou no cartão; a operadora libera em ~32 dias.
 * - AGUARDANDO_CLIENTE: a empresa ainda não pagou a fatura dessa competência.
 */
export type LiberacaoComissao =
  | { situacao: "LIBERADA"; em: Date }
  | { situacao: "PREVISTA"; em: Date }
  | { situacao: "AGUARDANDO_CLIENTE" };

/**
 * Espelha o critério de caixa de `pagarComissoesDoMesAnterior`: cada
 * competência anda com a SUA mensalidade; bônus (competência com sufixo)
 * vale com qualquer fatura paga da conta.
 */
export function liberacaoDaComissao(
  comissao: { competencia: string },
  cobrancasPagas: { competencia: string; forma: string; pagaEm: Date | null }[],
  hoje: Date = new Date(),
): LiberacaoComissao {
  const ehBonus = !/^\d{4}-\d{2}$/.test(comissao.competencia);
  const pagas = cobrancasPagas.filter((c) => c.pagaEm && (ehBonus || c.competencia === comissao.competencia));
  if (pagas.length === 0) return { situacao: "AGUARDANDO_CLIENTE" };
  let melhor: Date | null = null;
  for (const p of pagas) {
    const pagaEm = p.pagaEm as Date;
    const em = p.forma === "CARTAO_CREDITO" ? new Date(pagaEm.getTime() + DIAS_COMPENSACAO_CARTAO * 86400000) : pagaEm;
    if (!melhor || em < melhor) melhor = em;
  }
  const em = melhor as Date;
  return em <= hoje ? { situacao: "LIBERADA", em } : { situacao: "PREVISTA", em };
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
  /** Só para comissão ainda não paga: quando o repasse pode sair. */
  liberacao: LiberacaoComissao | null;
};

/** O que o painel mostra no cartão "Próximo repasse". */
export type ProximoRepasse =
  | { situacao: "LIBERADA"; valor: number }
  | { situacao: "PREVISTA"; em: Date; valor: number }
  | { situacao: "AGUARDANDO_CLIENTE"; valor: number }
  | { situacao: "NADA" };

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
    proximoRepasse: ProximoRepasse;
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
        conta: {
          select: {
            empresas: { select: { razaoSocial: true, nomeFantasia: true }, take: 1 },
            // Para dizer QUANDO o repasse sai: depende de como e quando a
            // empresa pagou a mensalidade desta competência.
            cobrancas: { where: { status: "PAGA", pagaEm: { not: null } }, select: { competencia: true, forma: true, pagaEm: true } },
          },
        },
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

  const hoje = new Date();
  const comissoes: ComissaoLinha[] = comissoesRaw.map((c) => ({
    id: c.id,
    competencia: c.competencia,
    cliente: c.conta.empresas[0]?.nomeFantasia || c.conta.empresas[0]?.razaoSocial || "—",
    valor: c.valor,
    paga: c.paga,
    pagaEm: c.pagaEm,
    liberacao: c.paga ? null : liberacaoDaComissao(c, c.conta.cobrancas, hoje),
  }));

  const conta = (s: SituacaoIndicada) => empresas.filter((e) => e.situacao === s).length;
  const assinantes = conta("ASSINANTE");
  const soma = (xs: ComissaoLinha[]) => xs.reduce((s, c) => s + c.valor, 0);
  const abertas = comissoes.filter((c) => !c.paga);
  const liberadas = abertas.filter((c) => c.liberacao?.situacao === "LIBERADA");
  const previstas = abertas.filter((c) => c.liberacao?.situacao === "PREVISTA");
  const aguardando = abertas.filter((c) => c.liberacao?.situacao === "AGUARDANDO_CLIENTE");

  let proximoRepasse: ProximoRepasse;
  if (liberadas.length) {
    proximoRepasse = { situacao: "LIBERADA", valor: soma(liberadas) };
  } else if (previstas.length) {
    const datas = previstas
      .map((c) => (c.liberacao as { em: Date }).em.getTime())
      .sort((a, b) => a - b);
    proximoRepasse = { situacao: "PREVISTA", em: new Date(datas[0]), valor: soma(previstas) };
  } else if (aguardando.length) {
    proximoRepasse = { situacao: "AGUARDANDO_CLIENTE", valor: soma(aguardando) };
  } else {
    proximoRepasse = { situacao: "NADA" };
  }

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
      aReceber: soma(abertas),
      recebido: soma(comissoes.filter((c) => c.paga)),
      proximoRepasse,
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
