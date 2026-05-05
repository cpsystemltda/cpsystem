import { z } from "zod";

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

export const signupSchema = z.object({
  // Usuário
  nome: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "Mínimo 8 caracteres"),

  // Primeira empresa
  razaoSocial: z.string().min(2, "Informe a razão social"),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().regex(cnpjRegex, "CNPJ inválido"),
  porte: z.enum(portes),
  cnaePrincipal: z.string().min(4, "Informe o CNAE principal"),
  naturezaJuridica: z.enum(naturezasJuridicas, { message: "Selecione a natureza jurídica" }),
  endereco: z.string().min(5, "Endereço muito curto"),
  cep: z.string().regex(cepRegex, "CEP inválido"),
  emailEmpresa: z.string().email("E-mail da empresa inválido"),
  telefones: z.string().min(8, "Informe ao menos um telefone"),
  responsavel: z.string().min(2, "Informe o responsável"),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Senha obrigatória"),
});

export const novaEmpresaSchema = z
  .object({
    razaoSocial: z.string().min(2),
    nomeFantasia: z.string().optional(),
    cnpj: z.string().regex(cnpjRegex, "CNPJ inválido"),
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

export const tiposObjeto = ["FORNECIMENTO", "FORNECIMENTO_CONTINUO", "SERVICOS", "SERVICOS_CONTINUOS"] as const;

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
  descricao: z.string().min(2, "Descrição obrigatória"),
  unidade: z.string().min(1, "Unidade obrigatória"),
  quantidade: z.coerce.number().positive("Quantidade > 0"),
  marca: z.string().optional(),
  valorUnitario: z.coerce.number().positive("Valor unitário > 0"),
  ataItemId: z.string().optional(),
});

const contratacaoBase = z.object({
  empresaId: z.string().min(1, "Selecione a empresa"),
  tipo: z.enum(tiposObjeto),
  numero: z.string().min(1, "Número/ano obrigatório"),
  processoAdministrativo: z.string().min(1, "Processo administrativo obrigatório"),
  procedimentoSelecao: z.enum(procedimentosSelecao),
  numeroLicitacao: z.string().optional(),
  orgaoNome: z.string().min(2, "Órgão obrigatório"),
  orgaoCnpj: z.string().regex(cnpjRegex, "CNPJ do órgão inválido"),
  orgaoEndereco: z.string().min(5, "Endereço do órgão obrigatório"),
  orgaoEmail: z.string().email().optional().or(z.literal("")),
  orgaoTelefone: z.string().optional(),
  objeto: z.string().min(2, "Objeto obrigatório"),
  vigenciaInicio: z.coerce.date(),
  vigenciaFim: z.coerce.date(),
  prazoEntregaDias: z.coerce.number().int().nonnegative().optional(),
  prazoPagamentoDias: z.coerce.number().int().nonnegative().optional(),
  marcoOrcamentoEstimado: z.coerce.date().optional(),
});

const enderecoEntregaSchema = z.object({
  rotulo: z.string().optional(),
  endereco: z.string().min(5, "Endereço muito curto"),
});

const pontoFocalSchema = z.object({
  funcao: z.enum(["GESTOR", "FISCAL_TECNICO", "FISCAL_ADMINISTRATIVO", "RESPONSAVEL_SETOR", "CONTATO_GERAL"]),
  nome: z.string().min(2, "Informe o nome"),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional(),
});

export const novaAtaSchema = contratacaoBase.extend({
  numeroAta: z.string().optional(),
  dataAssinatura: z.coerce.date(),
  dataPublicacao: z.coerce.date().optional(),
  aceitaCarona: z.coerce.boolean().optional(),
  idAtaPncp: z.string().optional(),
  enderecosEntrega: z.array(enderecoEntregaSchema).optional(),
  pontosFocais: z.array(pontoFocalSchema).optional(),
  itens: z.array(itemSchema).min(1, "Inclua pelo menos um item"),
});

const parcelaSchema = z.object({
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
    dataPublicacao: z.coerce.date().optional(),
    modalidadeEntrega: z.enum(modalidadesEntrega).default("INTEGRAL"),
    marcoInicialPrazo: z.enum(marcosIniciaisPrazo).optional(),
    marcoInicialDescricao: z.string().optional(),
    parcelas: z.array(parcelaSchema).optional(),
    enderecosEntrega: z.array(enderecoEntregaSchema).optional(),
    pontosFocais: z.array(pontoFocalSchema).optional(),
    itens: z.array(itemSchema).min(1, "Inclua pelo menos um item"),
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

export const novoEmpenhoSchema = contratacaoBase.extend({
  ataId: z.string().optional(),
  contratoId: z.string().optional(),
  numeroOrdemFornecimento: z.string().optional(),
  dataEmissao: z.coerce.date(),
  enderecosEntrega: z.array(enderecoEntregaSchema).optional(),
  pontosFocais: z.array(pontoFocalSchema).optional(),
  itens: z.array(itemSchema).min(1, "Inclua pelo menos um item"),
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

// Tier do programa de embaixadores (Bronze 1-5: 3% / Prata 6-10: 4% / Ouro 11-15: 5% / Diamond 16+: 6%)
export function tierPorAtivos(qtdAtivos: number): { tier: "BRONZE" | "PRATA" | "OURO" | "DIAMOND"; percentual: number } {
  if (qtdAtivos >= 16) return { tier: "DIAMOND", percentual: 6 };
  if (qtdAtivos >= 11) return { tier: "OURO", percentual: 5 };
  if (qtdAtivos >= 6) return { tier: "PRATA", percentual: 4 };
  return { tier: "BRONZE", percentual: 3 };
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

export const ROTULO_TIPO: Record<(typeof tiposObjeto)[number], string> = {
  FORNECIMENTO: "Fornecimento",
  FORNECIMENTO_CONTINUO: "Fornecimento contínuo",
  SERVICOS: "Serviços",
  SERVICOS_CONTINUOS: "Serviços contínuos",
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
