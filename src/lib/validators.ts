import { z } from "zod";
import { validarCnpj } from "@/lib/cnpj";

const cnpjRegex = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;
const cepRegex = /^\d{5}-?\d{3}$/;

export const portes = ["MEI", "ME", "EPP", "MEDIA", "GRANDE"] as const;

// Naturezas jurídicas mais comuns no contexto de licitação pública (Lei 14.133/2021).
// Lista derivada da tabela oficial da Receita Federal — agrupada para uso prático.
export const naturezasJuridicas = [
  "EI",         // Empresário Individual
  "EIRELI",     // Empresa Individual de Responsabilidade Limitada (extinta — mantido p/ legado)
  "LTDA",       // Sociedade Empresária Limitada
  "SLU",        // Sociedade Limitada Unipessoal
  "SA_FECHADA", // Sociedade Anônima Fechada
  "SA_ABERTA",  // Sociedade Anônima Aberta
  "SS",         // Sociedade Simples
  "COOPERATIVA",
  "COOP_SOCIAL",
  "SOC_PROFISSIONAL", // Sociedade entre Profissionais
  "EMPRESA_PUBLICA",
  "SEM_FINS_LUCRATIVOS",
  "OUTRA",
] as const;

export const signupSchema = z
  .object({
    // Usuário
    nome: z.string().min(2, "Nome muito curto"),
    email: z.string().email("E-mail inválido"),
    senha: z.string().min(6, "Mínimo 6 caracteres"),
    confirmacaoSenha: z.string().min(1, "Confirme a senha"),

    // Primeira empresa
    plano: z.enum(["BASICO", "PREMIUM"], { message: "Escolha um plano" }),

    // Cartão (validado em detalhe pela função validarCartao no auth action)
    cartaoNumero: z.string().min(13, "Informe o número do cartão"),
    cartaoNome: z.string().min(4, "Informe o nome impresso no cartão"),
    cartaoValidade: z.string().regex(/^\d{2}\/?\d{2}$/, "Validade no formato MM/AA"),
    cartaoCvv: z.string().regex(/^\d{3,4}$/, "CVV inválido"),

    razaoSocial: z.string().min(2, "Informe a razão social"),
    nomeFantasia: z.string().optional(),
    cnpj: z.string().regex(cnpjRegex, "CNPJ inválido").refine((v) => validarCnpj(v), "CNPJ inválido — verifique os dígitos verificadores"),
    porte: z.enum(portes),
    cnaePrincipal: z.string().optional(), // Igor: opcional, não trava cadastro
    naturezaJuridica: z.enum(naturezasJuridicas, { message: "Selecione a natureza jurídica" }),
    endereco: z.string().min(5, "Endereço muito curto"),
    complemento: z.string().optional(),
    cep: z.string().regex(cepRegex, "CEP inválido"),
    // Múltiplos contatos: aceita string única (compat) OU array (do CampoMultiplo).
    // O array vem como FormData.getAll("emailEmpresa[]") na action — convertemos
    // pra string única (1ª entrada) pra cair aqui, mas guardamos array completo
    // em emailsExtras pra persistir todos.
    emailEmpresa: z.string().email("E-mail da empresa inválido"),
    telefones: z.string().min(8, "Informe ao menos um telefone"),
    responsavel: z.string().min(2, "Informe o responsável"),
  })
  .superRefine((v, ctx) => {
    if (v.senha !== v.confirmacaoSenha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmacaoSenha"],
        message: "Confirmação não confere com a senha",
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Senha obrigatória"),
  // Tipo de conta escolhido no toggle do form. Quando presente, a action
  // valida que bate com o tipo real da conta — evita o caso reportado
  // pela Regina de logar como Empresa quando queria Analista (mesmo
  // e-mail nas duas? Não — emails distintos, mas usuário esquecia de
  // alternar e o sistema deixava entrar sem aviso). SuperAdmin é
  // isento dessa checagem.
  tipo: z.enum(["EMPRESA", "ANALISTA"]).optional(),
});

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

// Cadastro de Analista — campos obrigatórios + bloco PJ opcional.
// Quando o flag "temPj" é "sim", todos os obrigatórios da PJ passam a valer.
export const signupAnalistaSchema = z
  .object({
    // Pessoais (obrigatórios)
    nome: z.string().min(2, "Nome muito curto"),
    cpf: z.string().regex(cpfRegex, "CPF inválido"),
    email: z.string().email("E-mail inválido"),
    senha: z.string().min(6, "Mínimo 6 caracteres"),
    confirmacaoSenha: z.string().min(1, "Confirme a senha"),
    telefone: z.string().min(8, "Telefone obrigatório"),
    endereco: z.string().min(5, "Endereço muito curto"),
    complemento: z.string().optional(),
    cep: z.string().regex(cepRegex, "CEP inválido"),

    // Bancários (opcionais — CNAE também opcional pra não travar)
    banco: z.string().optional(),
    agencia: z.string().optional(),
    contaCorrente: z.string().optional(),
    pix: z.string().optional(),
    pixTipo: z.string().optional(),

    // PJ (controlada por flag temPj)
    temPj: z.string().optional(), // "sim" | "nao" | undefined
    razaoSocial: z.string().optional(),
    nomeFantasia: z.string().optional(),
    cnpj: z.string().optional(),
    porte: z.string().optional(),
    cnaePrincipal: z.string().optional(), // opcional
    cnaesSecundarios: z.string().optional(),
    naturezaJuridica: z.string().optional(),
    enderecoPj: z.string().optional(),
    emailPj: z.string().optional(),
    telefonePj: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.senha !== v.confirmacaoSenha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmacaoSenha"],
        message: "Confirmação não confere com a senha",
      });
    }

    if (v.temPj !== "sim") return;

    if (!v.razaoSocial || v.razaoSocial.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["razaoSocial"], message: "Razão social obrigatória" });
    }
    if (!v.cnpj || !cnpjRegex.test(v.cnpj)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cnpj"], message: "CNPJ inválido" });
    }
    if (!v.porte || !(portes as readonly string[]).includes(v.porte)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["porte"], message: "Selecione o porte" });
    }
    if (!v.naturezaJuridica || !(naturezasJuridicas as readonly string[]).includes(v.naturezaJuridica)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["naturezaJuridica"], message: "Selecione a natureza jurídica" });
    }
    if (!v.enderecoPj || v.enderecoPj.length < 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["enderecoPj"], message: "Endereço da PJ obrigatório" });
    }
  });

export function normalizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export const novaEmpresaSchema = z
  .object({
    razaoSocial: z.string().min(2),
    nomeFantasia: z.string().optional(),
    cnpj: z.string().regex(cnpjRegex, "CNPJ inválido").refine((v) => validarCnpj(v), "CNPJ inválido — verifique os dígitos verificadores"),
    porte: z.enum(portes),
    cnaePrincipal: z.string().min(4),
    cnaesSecundarios: z.string().optional(),
    naturezaJuridica: z.enum(naturezasJuridicas),
    endereco: z.string().min(5),
    cep: z.string().regex(cepRegex, "CEP inválido"),
    email: z.string().email(),
    telefones: z.string().min(8),
    responsavel: z.string().min(2),
    // Senha do "usuário-responsável" desta empresa (opcional). Quando preenchida, o sistema
    // cria um Usuario perfil OPERACIONAL atrelado à conta para este responsável.
    senha: z.string().optional(),
    confirmacaoSenha: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.senha || v.confirmacaoSenha) {
      if (!v.senha || v.senha.length < 8) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["senha"], message: "Senha mínima de 8 caracteres." });
      }
      if (v.senha !== v.confirmacaoSenha) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmacaoSenha"],
          message: "Confirmação não confere com a senha informada.",
        });
      }
    }
  });

export const tiposObjeto = [
  "FORNECIMENTO",
  "FORNECIMENTO_CONTINUO",
  "SERVICOS",
  "SERVICOS_CONTINUOS",
  "SERVICOS_DEDICACAO_EXCLUSIVA",
  "LOCACAO",
  "OBRAS_ENGENHARIA",
] as const;

// Tipos não-continuados (fluxograma do contrato independente: não permitem prorrogação).
export const tiposNaoContinuados = ["FORNECIMENTO", "SERVICOS"] as const;
export function isContratoNaoContinuado(tipo: (typeof tiposObjeto)[number]): boolean {
  return (tiposNaoContinuados as readonly string[]).includes(tipo);
}

export const modalidadesEntrega = ["INTEGRAL", "PARCELADA", "SOB_DEMANDA"] as const;
export const marcosIniciaisPrazo = ["ASSINATURA_CONTRATO", "ORDEM_FORNECIMENTO", "OUTRO"] as const;
export const procedimentosSelecao = [
  "PREGAO_ELETRONICO",
  "PREGAO_ELETRONICO_INTERNACIONAL",
  "PREGAO_PRESENCIAL",
  "CONCORRENCIA",
  "CONCURSO",
  "LEILAO",
  "DIALOGO_COMPETITIVO",
  "DISPENSA",
  "INEXIGIBILIDADE",
] as const;

const itemSchema = z.object({
  id: z.string().optional(), // id do AtaItem existente (apenas no modo edição)
  descricao: z.string().min(2, "Descrição obrigatória"),
  unidade: z.string().min(1, "Unidade obrigatória"),
  quantidade: z.coerce.number().positive("Quantidade > 0"),
  marca: z.string().optional(),
  valorUnitario: z.coerce.number().positive("Valor unitário > 0"),
  ataItemId: z.string().optional(),
  lote: z.string().optional(), // briefing PDF 2.7 — agrupar em lotes
  numero: z.string().optional(), // número do item dentro do lote
});

// Variante usada pelo Empenho: permite quantidade=0 nos itens herdados de
// Ata/Contrato que o usuario nao vai executar nesta NE/OS/AC. A action
// filtra esses itens antes de persistir — em vez de o usuario ter que
// deletar manualmente, basta deixar a quantidade zerada.
const itemEmpenhoSchema = itemSchema.extend({
  quantidade: z.coerce.number().nonnegative("Quantidade nao pode ser negativa"),
});

const contratacaoBase = z.object({
  empresaId: z.string().min(1, "Selecione a empresa"),
  tipo: z.enum(tiposObjeto),
  numero: z.string().min(1, "Número/ano obrigatório"),
  processoAdministrativo: z.string().min(1, "Processo administrativo obrigatório"),
  procedimentoSelecao: z.enum(procedimentosSelecao),
  numeroLicitacao: z.string().optional(),
  orgaoNome: z.string().min(2, "Órgão obrigatório"),
  orgaoCnpj: z
    .string()
    .regex(cnpjRegex, "CNPJ do órgão inválido")
    .refine((v) => validarCnpj(v), "CNPJ inválido — verifique os dígitos verificadores"),
  orgaoEndereco: z.string().min(5, "Endereço do órgão obrigatório"),
  orgaoEmail: z.string().email().optional().or(z.literal("")),
  orgaoTelefone: z.string().optional(),
  objeto: z.string().min(2, "Objeto obrigatório"),
  vigenciaInicio: z.coerce.date(),
  vigenciaFim: z.coerce.date(),
  prazoEntregaDias: z.coerce.number().int().nonnegative().optional(),
  // Unidade do prazo de entrega — DIAS é default por retrocompat
  prazoEntregaUnidade: z.enum(["DIAS", "MESES"]).default("DIAS"),
  prazoPagamentoDias: z.coerce.number().int().nonnegative().optional(),
  marcoOrcamentoEstimado: z.coerce.date().optional(),
});

const enderecoEntregaSchema = z.object({
  id: z.string().optional(),
  rotulo: z.string().optional(),
  endereco: z.string().min(5, "Endereço muito curto"),
});

export const funcoesPontoFocal = [
  "AUTORIDADE_COMPETENTE",
  "GESTOR",
  "FISCAL",
  "FISCAL_TECNICO",
  "FISCAL_ADMINISTRATIVO",
  "RESPONSAVEL_SETOR",
  "CONTATO_GERAL",
  "OUTRO",
] as const;

export const ROTULO_FUNCAO_PONTO_FOCAL: Record<(typeof funcoesPontoFocal)[number], string> = {
  AUTORIDADE_COMPETENTE: "Autoridade competente (signatário)",
  GESTOR: "Gestor",
  FISCAL: "Fiscal",
  FISCAL_TECNICO: "Fiscal técnico",
  FISCAL_ADMINISTRATIVO: "Fiscal administrativo",
  RESPONSAVEL_SETOR: "Responsável de setor",
  CONTATO_GERAL: "Contato geral",
  OUTRO: "Outro (especificar)",
};

export const OPCOES_FUNCAO_PONTO_FOCAL = (
  Object.entries(ROTULO_FUNCAO_PONTO_FOCAL) as [string, string][]
).map(([value, label]) => ({ value, label }));

const pontoFocalSchema = z.object({
  id: z.string().optional(),
  funcao: z.enum(funcoesPontoFocal),
  funcaoDescricao: z.string().optional(), // quando funcao = OUTRO
  nome: z.string().min(2, "Informe o nome"),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional(),
});

// Origem do marco de reajuste (briefing PDF 2.4)
export const marcosReajusteOrigem = ["ORCAMENTO_ESTIMADO", "ASSINATURA", "OMISSA"] as const;
export const ROTULO_MARCO_REAJUSTE: Record<(typeof marcosReajusteOrigem)[number], string> = {
  ORCAMENTO_ESTIMADO: "Data do orçamento estimado",
  ASSINATURA: "Data de assinatura da Ata",
  OMISSA: "Omissa (não definida na Ata)",
};
export const OPCOES_MARCO_REAJUSTE = (
  Object.entries(ROTULO_MARCO_REAJUSTE) as [string, string][]
).map(([value, label]) => ({ value, label }));

// Órgão participante / carona (briefing PDF 2.3)
export const tiposOrgaoNaAta = ["PARTICIPANTE", "CARONA"] as const;
const orgaoNaAtaSchema = z.object({
  id: z.string().optional(),
  tipo: z.enum(tiposOrgaoNaAta).default("PARTICIPANTE"),
  nome: z.string().min(2, "Nome do órgão obrigatório"),
  cnpj: z.string().regex(cnpjRegex, "CNPJ inválido").refine((v) => validarCnpj(v), "CNPJ inválido — verifique os dígitos verificadores"),
  endereco: z.string().min(5, "Endereço obrigatório"),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional(),
});

export const novaAtaSchema = contratacaoBase.extend({
  numeroAta: z.string().optional(),
  dataAssinatura: z.coerce.date(),
  dataPublicacao: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date().optional(),
  ),
  aceitaCarona: z.coerce.boolean().optional(),
  idAtaPncp: z.string().optional(),
  // 2.4 — toggle "não se aplica" no prazo de entrega
  prazoEntregaNaoAplica: z.coerce.boolean().optional(),
  // 2.4 — origem do marco de reajuste
  marcoReajusteOrigem: z.enum(marcosReajusteOrigem).optional(),
  enderecosEntrega: z.array(enderecoEntregaSchema).optional(),
  pontosFocais: z.array(pontoFocalSchema).optional(),
  // 2.3 — órgãos participantes
  orgaosParticipantes: z.array(orgaoNaAtaSchema).optional(),
  itens: z.array(itemSchema).min(1, "Inclua pelo menos um item"),
});

const parcelaSchema = z.object({
  id: z.string().optional(),
  numero: z.coerce.number().int().positive(),
  prazoDias: z.coerce.number().int().nonnegative(),
  descricao: z.string().optional(),
  valorEstimado: z.coerce.number().nonnegative().optional(),
});

export const novoContratoSchema = contratacaoBase
  .extend({
    ataId: z.string().optional(),
    numeroNotaEmpenho: z.string().optional(),
    numeroOrdemFornecimento: z.string().optional(),
    dataAssinatura: z.coerce.date(),
    dataPublicacao: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional(),
    ),
    modalidadeEntrega: z.enum(modalidadesEntrega).default("INTEGRAL"),
    marcoInicialPrazo: z.enum(marcosIniciaisPrazo).optional(),
    marcoInicialDescricao: z.string().optional(),
    parcelas: z.array(parcelaSchema).optional(),
    enderecosEntrega: z.array(enderecoEntregaSchema).optional(),
    pontosFocais: z.array(pontoFocalSchema).optional(),
    itens: z.array(itemSchema).min(1, "Inclua pelo menos um item"),
    // Módulo 3.2 — Prazo de entrega com 3 modos + Marco de reajuste
    // SOB_DEMANDA: data conhecida só depois — prazo/data ficam em branco.
    prazoEntregaModo: z.enum(["RELATIVO", "DATA_CERTA", "SOB_DEMANDA"]).default("RELATIVO"),
    dataEntregaCerta: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional(),
    ),
    marcoReajusteOrigem: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.enum(marcosReajusteOrigem).optional(),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.modalidadeEntrega !== "SOB_DEMANDA" && !v.marcoInicialPrazo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["marcoInicialPrazo"],
        message: "Selecione o marco inicial do prazo de entrega",
      });
    }
    if (v.marcoInicialPrazo === "OUTRO" && !v.marcoInicialDescricao?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["marcoInicialDescricao"],
        message: "Descreva qual o marco inicial",
      });
    }
    if (v.modalidadeEntrega === "PARCELADA" && (!v.parcelas || v.parcelas.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parcelas"],
        message: "Em entrega parcelada, informe ao menos 2 parcelas",
      });
    }
  });

export const instrumentosContratuais = [
  "NOTA_EMPENHO",
  "CARTA_CONTRATO",
  "AUTORIZACAO_COMPRA",
  "AUTORIZACAO_ENTREGA",
  "ORDEM_SERVICO",
] as const;
export type InstrumentoContratualValor = (typeof instrumentosContratuais)[number];

// Empenho/NE/AE/OS não tem vigência própria nem bloco "Detalhes" no form
// (decisão Igor). Vigência é calculada na action a partir da Ata/Contrato
// pai (ou data de emissão + 1 ano quando livre). Campos de "Detalhes" são
// todos opcionais e continuam no schema (mas o form não os exibe).
export const novoEmpenhoSchema = contratacaoBase
  .omit({ vigenciaInicio: true, vigenciaFim: true })
  .extend({
    instrumento: z.enum(instrumentosContratuais).default("NOTA_EMPENHO"),
    ataId: z.string().optional(),
    contratoId: z.string().optional(),
    numeroOrdemFornecimento: z.string().optional(),
    dataEmissao: z.coerce.date(),
    // Procedimento de seleção: opcional pro Empenho (decisão Igor M3.3).
    // Quando há vínculo com Ata/Contrato, o procedimento é herdado.
    procedimentoSelecao: z.enum(procedimentosSelecao).optional(),
    // Prazo de entrega — 3 modos no Empenho:
    //   RELATIVO    → qtd + unidade contada do pedido recebido
    //   DATA_CERTA  → 1 data fixa de execucao
    //   PRAZO_CERTO → janela (dataEntregaInicio -> dataEntregaFim)
    prazoEntregaModo: z.enum(["RELATIVO", "DATA_CERTA", "PRAZO_CERTO"]).default("RELATIVO"),
    dataEntregaCerta: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional(),
    ),
    dataEntregaInicio: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional(),
    ),
    dataEntregaFim: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional(),
    ),
    enderecosEntrega: z.array(enderecoEntregaSchema).optional(),
    pontosFocais: z.array(pontoFocalSchema).optional(),
    itens: z
      .array(itemEmpenhoSchema)
      .min(1, "Inclua pelo menos um item")
      .refine(
        (arr) => arr.some((i) => i.quantidade > 0),
        "Inclua pelo menos um item com quantidade maior que zero",
      ),
    // Campos específicos por instrumento, todos opcionais (bloco "Detalhes"
    // foi removido da UI; persistir como null quando não enviados).
    classificacaoOrcamentaria: z.string().optional(),
    signatario: z.string().optional(),
    dataAssinatura: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional(),
    ),
    departamentoEmissor: z.string().optional(),
    pontoColeta: z.string().optional(),
    contatoRecebedor: z.string().optional(),
    fiscalResponsavel: z.string().optional(),
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type NovaEmpresaInput = z.infer<typeof novaEmpresaSchema>;
export type NovaAtaInput = z.infer<typeof novaAtaSchema>;
export type NovoContratoInput = z.infer<typeof novoContratoSchema>;
export type NovoEmpenhoInput = z.infer<typeof novoEmpenhoSchema>;

export function normalizarCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export const moedas = ["BRL", "USD", "EUR"] as const;
export type Moeda = (typeof moedas)[number];

export const ROTULO_MOEDA: Record<Moeda, { simbolo: string; locale: string }> = {
  BRL: { simbolo: "R$", locale: "pt-BR" },
  USD: { simbolo: "US$", locale: "en-US" },
  EUR: { simbolo: "€", locale: "de-DE" },
};

export function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarMoeda(valor: number, moeda: Moeda = "BRL"): string {
  const { locale } = ROTULO_MOEDA[moeda];
  return valor.toLocaleString(locale, { style: "currency", currency: moeda });
}

// Tier do programa de embaixadores (Regina 08/06 — plano marketing v7).
// Bronze 1-2: 5%   (tier inicial mais atrativo — pega embaixador novo)
// Prata  3-7: 7%   (atingivel em 60 dias com esforco)
// Ouro   8-14: 10% (compensa virar 'indicador profissional')
// Diamante 15+: 15% + bonus R$ 5k/ano (figura aspiracional real)
//
// Alem disso ha bonus FIXO de R$ 500 na 1a Cobranca paga de cada conta
// indicada (resolvido na action de pagamento — nao na funcao de tier).
export function tierPorAtivos(qtdAtivos: number): { tier: "BRONZE" | "PRATA" | "OURO" | "DIAMOND"; percentual: number } {
  if (qtdAtivos >= 15) return { tier: "DIAMOND", percentual: 15 };
  if (qtdAtivos >= 8) return { tier: "OURO", percentual: 10 };
  if (qtdAtivos >= 3) return { tier: "PRATA", percentual: 7 };
  return { tier: "BRONZE", percentual: 5 };
}

// Limites de carona Lei 14.133/2021 art. 86
export const LIMITE_CARONA_POR_ORGAO_PCT = 50; // % do total da Ata
export const LIMITE_CARONA_TOTAL_PCT = 100; // soma de todos os caronas

export function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export const ROTULO_NATUREZA_JURIDICA: Record<(typeof naturezasJuridicas)[number], string> = {
  EI: "Empresário Individual (EI)",
  EIRELI: "EIRELI (legado — extinta em 2021)",
  LTDA: "Sociedade Empresária Limitada (LTDA)",
  SLU: "Sociedade Limitada Unipessoal (SLU)",
  SA_FECHADA: "Sociedade Anônima — Capital Fechado",
  SA_ABERTA: "Sociedade Anônima — Capital Aberto",
  SS: "Sociedade Simples (SS)",
  COOPERATIVA: "Cooperativa",
  COOP_SOCIAL: "Cooperativa Social",
  SOC_PROFISSIONAL: "Sociedade entre Profissionais",
  EMPRESA_PUBLICA: "Empresa Pública / Sociedade de Economia Mista",
  SEM_FINS_LUCRATIVOS: "Associação ou Fundação (sem fins lucrativos)",
  OUTRA: "Outra natureza jurídica",
};

export const OPCOES_NATUREZA_JURIDICA = (
  Object.entries(ROTULO_NATUREZA_JURIDICA) as [string, string][]
).map(([value, label]) => ({ value, label }));

// Ordem segue a Lei 14.133/2021 e a categorização operacional do CP System.
// Mantida exatamente como o cliente pediu.
export const ROTULO_TIPO: Record<(typeof tiposObjeto)[number], string> = {
  FORNECIMENTO: "Fornecimento de bens",
  FORNECIMENTO_CONTINUO: "Fornecimento contínuo de bens",
  SERVICOS: "Serviços",
  SERVICOS_CONTINUOS: "Serviços contínuos",
  SERVICOS_DEDICACAO_EXCLUSIVA: "Serviços contínuos com dedicação exclusiva de mão de obra",
  LOCACAO: "Locação",
  OBRAS_ENGENHARIA: "Obras e serviços de engenharia",
};

export const ROTULO_MODALIDADE_ENTREGA: Record<(typeof modalidadesEntrega)[number], string> = {
  INTEGRAL: "Integral (todo quantitativo de uma vez)",
  PARCELADA: "Parcelada (lotes com prazos distintos)",
  SOB_DEMANDA: "Sob demanda (quantidade estimativa)",
};

export const ROTULO_MARCO_INICIAL: Record<(typeof marcosIniciaisPrazo)[number], string> = {
  ASSINATURA_CONTRATO: "Assinatura do contrato",
  ORDEM_FORNECIMENTO: "Recebimento da ordem de fornecimento",
  OUTRO: "Outro documento hábil (descrever)",
};

export const OPCOES_MODALIDADE_ENTREGA = (Object.entries(ROTULO_MODALIDADE_ENTREGA) as [string, string][]).map(([value, label]) => ({ value, label }));
export const OPCOES_MARCO_INICIAL = (Object.entries(ROTULO_MARCO_INICIAL) as [string, string][]).map(([value, label]) => ({ value, label }));

export const ROTULO_PROCEDIMENTO: Record<(typeof procedimentosSelecao)[number], string> = {
  PREGAO_ELETRONICO: "Pregão Eletrônico",
  PREGAO_ELETRONICO_INTERNACIONAL: "Pregão Eletrônico Internacional",
  PREGAO_PRESENCIAL: "Pregão Presencial",
  CONCORRENCIA: "Concorrência",
  CONCURSO: "Concurso",
  LEILAO: "Leilão",
  DIALOGO_COMPETITIVO: "Diálogo Competitivo",
  DISPENSA: "Dispensa de Licitação",
  INEXIGIBILIDADE: "Inexigibilidade",
};

export const OPCOES_TIPO = (Object.entries(ROTULO_TIPO) as [string, string][]).map(([value, label]) => ({ value, label }));
export const OPCOES_PROCEDIMENTO = (Object.entries(ROTULO_PROCEDIMENTO) as [string, string][]).map(([value, label]) => ({ value, label }));
