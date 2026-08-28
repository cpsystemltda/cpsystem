// Tipos compartilhados entre os provedores fiscais.
// Mantém o resto do app desacoplado de Focus/NFE.io/PlugNotas específicos —
// mesma escolha que já foi feita pro gateway de pagamento, pelo mesmo motivo:
// trocar de fornecedor não pode significar reescrever a emissão.

export type ProvedorFiscalNome = "FOCUS_NFE" | "DEMO";
export type AmbienteFiscalNome = "HOMOLOGACAO" | "PRODUCAO";

export type DadosPrestador = {
  cnpj: string;
  inscricaoMunicipal?: string | null;
  /** Código IBGE do município — a prefeitura identifica a cidade por ele. */
  codigoMunicipio?: string | null;
  optanteSimples: boolean;
  incentivadorCultural: boolean;
};

export type EnderecoFiscal = {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  codigoMunicipio?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
};

export type DadosTomador = {
  cnpj: string;
  razaoSocial: string;
  email?: string | null;
  endereco?: EnderecoFiscal | null;
};

export type DadosServico = {
  valorServicos: number;
  /** O texto que sai na nota descrevendo o que foi prestado. */
  discriminacao: string;
  itemListaServico?: string | null;
  codigoTributarioMunicipio?: string | null;
  cnae?: string | null;
  /** Em % — ex.: 2 para 2%. */
  aliquotaIss?: number | null;
  issRetido: boolean;
};

export type EmitirNfseInput = {
  /** Chave de idempotência: reenviar a mesma referência consulta, não duplica. */
  referencia: string;
  dataEmissao: Date;
  prestador: DadosPrestador;
  tomador: DadosTomador;
  servico: DadosServico;
};

export type StatusNota = "PROCESSANDO" | "AUTORIZADA" | "ERRO" | "CANCELADA";

export type ResultadoNota = {
  status: StatusNota;
  numero?: string | null;
  serie?: string | null;
  codigoVerificacao?: string | null;
  /** Link da nota no site da prefeitura. */
  linkPrefeitura?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  mensagemErro?: string | null;
  /** Resposta crua do provedor — guardada pra auditoria e pra suporte. */
  bruto?: unknown;
};

export interface ProvedorNfse {
  readonly nome: ProvedorFiscalNome;
  emitir(input: EmitirNfseInput): Promise<ResultadoNota>;
  consultar(referencia: string): Promise<ResultadoNota>;
  cancelar(referencia: string, justificativa: string): Promise<ResultadoNota>;
}
