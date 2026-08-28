import "server-only";
import type {
  AmbienteFiscalNome,
  EmitirNfseInput,
  ProvedorNfse,
  ResultadoNota,
  StatusNota,
} from "./types";

/**
 * Focus NFe — emissão de NFS-e (serviço).
 *
 * Escolhido pra estrear a Fase 1 por três motivos práticos: tem ambiente de
 * homologação gratuito (dá pra validar o fluxo inteiro antes de qualquer
 * contrato), a autenticação é um token simples por empresa, e o certificado
 * digital A1 fica hospedado LÁ — a gente nunca guarda o certificado do cliente,
 * só um token que pode ser revogado.
 *
 * Autenticação: HTTP Basic com o token no usuário e senha vazia.
 * Docs: https://focusnfe.com.br/doc/
 */

/**
 * Data no formato ISO 8601 com o fuso de Brasília (-03:00).
 *
 * `toISOString()` devolve UTC, e a Focus interpreta o que chega: sem o offset
 * uma nota emitida às 21h de Brasília sairia datada do dia seguinte.
 */
function emBrasilia(d: Date): string {
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${brt.toISOString().slice(0, 19)}-03:00`;
}

const BASE: Record<AmbienteFiscalNome, string> = {
  PRODUCAO: "https://api.focusnfe.com.br",
  HOMOLOGACAO: "https://homologacao.focusnfe.com.br",
};

// Nome do status no Focus -> status interno.
const STATUS: Record<string, StatusNota> = {
  processando_autorizacao: "PROCESSANDO",
  autorizado: "AUTORIZADA",
  cancelado: "CANCELADA",
  erro_autorizacao: "ERRO",
};

type RespostaFocus = {
  status?: string;
  numero?: string | number;
  serie?: string | number;
  codigo_verificacao?: string;
  url?: string;
  caminho_xml_nota_fiscal?: string;
  /** URL absoluta do PDF (DANFSe). Nao confundir com os "caminho_*", que sao relativos. */
  url_danfse?: string;
  erros?: Array<{ mensagem?: string; codigo?: string }>;
  mensagem?: string;
  status_sefaz?: string;
};

export class ProvedorFocusNfe implements ProvedorNfse {
  readonly nome = "FOCUS_NFE" as const;
  private token: string;
  private base: string;

  constructor(opts: { token: string; ambiente: AmbienteFiscalNome }) {
    this.token = opts.token;
    this.base = BASE[opts.ambiente];
  }

  private auth(): string {
    // Basic <base64(token:)> — senha vazia, é assim que o Focus autentica.
    return `Basic ${Buffer.from(`${this.token}:`).toString("base64")}`;
  }

  private async chamar(
    caminho: string,
    init: { method: string; body?: unknown },
  ): Promise<{ http: number; corpo: RespostaFocus }> {
    const r = await fetch(`${this.base}${caminho}`, {
      method: init.method,
      headers: {
        Authorization: this.auth(),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
    const texto = await r.text();
    let corpo: RespostaFocus = {};
    try {
      corpo = texto ? (JSON.parse(texto) as RespostaFocus) : {};
    } catch {
      corpo = { mensagem: texto.slice(0, 500) };
    }
    return { http: r.status, corpo };
  }

  private traduzir(corpo: RespostaFocus, http: number): ResultadoNota {
    const status = STATUS[String(corpo.status ?? "")] ?? (http >= 400 ? "ERRO" : "PROCESSANDO");
    const erro =
      corpo.erros?.map((e) => e.mensagem).filter(Boolean).join(" | ") ||
      corpo.mensagem ||
      (http >= 400 ? `Provedor respondeu HTTP ${http}` : null);

    // O Focus devolve caminho relativo pros arquivos; a URL completa é o base + caminho.
    const abs = (c?: string) => (c ? (c.startsWith("http") ? c : `${this.base}${c}`) : null);

    return {
      status,
      numero: corpo.numero != null ? String(corpo.numero) : null,
      serie: corpo.serie != null ? String(corpo.serie) : null,
      codigoVerificacao: corpo.codigo_verificacao ?? null,
      linkPrefeitura: corpo.url ?? null,
      pdfUrl: corpo.url_danfse ?? null,
      xmlUrl: abs(corpo.caminho_xml_nota_fiscal),
      mensagemErro: status === "ERRO" ? erro || "Erro não detalhado pelo provedor." : null,
      bruto: corpo,
    };
  }

  async emitir(input: EmitirNfseInput): Promise<ResultadoNota> {
    const e = input.tomador.endereco;
    const corpo = {
      // ISO 8601 COM fuso. Sem o offset a nota sai com hora de Londres — e a
      // data/hora de emissão é o que define a competência do imposto.
      data_emissao: emBrasilia(input.dataEmissao),
      // Obrigatório pela API. "1" = tributação no município do prestador, que é
      // o caso da esmagadora maioria; fica configurável porque serviço prestado
      // fora do município muda esse código.
      natureza_operacao: input.naturezaOperacao || "1",
      prestador: {
        cnpj: input.prestador.cnpj,
        inscricao_municipal: input.prestador.inscricaoMunicipal || undefined,
      },
      tomador: {
        cnpj: input.tomador.cnpj,
        razao_social: input.tomador.razaoSocial,
        email: input.tomador.email || undefined,
        ...(e
          ? {
              endereco: {
                logradouro: e.logradouro || undefined,
                numero: e.numero || undefined,
                complemento: e.complemento || undefined,
                bairro: e.bairro || undefined,
                codigo_municipio: e.codigoMunicipio || undefined,
                uf: e.uf || undefined,
                cep: e.cep || undefined,
              },
            }
          : {}),
      },
      servico: {
        // A API espera FRAÇÃO, não porcentagem: 5% vai como 0.05. Mandar "5"
        // aqui emitiria a nota com 500% de ISS.
        aliquota:
          input.servico.aliquotaIss != null ? input.servico.aliquotaIss / 100 : undefined,
        discriminacao: input.servico.discriminacao,
        iss_retido: input.servico.issRetido,
        item_lista_servico: input.servico.itemListaServico || undefined,
        codigo_tributacao_municipio: input.servico.codigoTributarioMunicipio || undefined,
        codigo_cnae: input.servico.cnae || undefined,
        // Código IBGE do município do PRESTADOR — a API espera dentro de
        // `servico`, não em `prestador`.
        codigo_municipio: input.prestador.codigoMunicipio || undefined,
        valor_servicos: input.servico.valorServicos,
      },
      optante_simples_nacional: input.prestador.optanteSimples,
      incentivador_cultural: input.prestador.incentivadorCultural,
    };

    const { http, corpo: resp } = await this.chamar(
      `/v2/nfse?ref=${encodeURIComponent(input.referencia)}`,
      { method: "POST", body: corpo },
    );

    // 422 com "ja existe" não é falha: é a idempotência funcionando. Nesse caso
    // a verdade está na consulta, não na resposta do POST.
    if (http === 422 && JSON.stringify(resp).includes("referencia")) {
      return this.consultar(input.referencia);
    }
    return this.traduzir(resp, http);
  }

  async consultar(referencia: string): Promise<ResultadoNota> {
    const { http, corpo } = await this.chamar(
      `/v2/nfse/${encodeURIComponent(referencia)}`,
      { method: "GET" },
    );
    return this.traduzir(corpo, http);
  }

  async cancelar(referencia: string, justificativa: string): Promise<ResultadoNota> {
    const { http, corpo } = await this.chamar(
      `/v2/nfse/${encodeURIComponent(referencia)}`,
      { method: "DELETE", body: { justificativa } },
    );
    return this.traduzir(corpo, http);
  }
}
