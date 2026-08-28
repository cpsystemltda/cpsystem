import "server-only";
import type { EmitirNfseInput, ProvedorNfse, ResultadoNota } from "./types";

/**
 * Provedor de mentira — usado em desenvolvimento e enquanto não houver contrato
 * com a casa fiscal.
 *
 * Serve pra exercitar o caminho inteiro (botão, tela, gravação, avanço de
 * status na esteira do empenho) sem emitir documento fiscal de verdade. Ele
 * NUNCA deve rodar em produção com ambiente PRODUCAO — a tela deixa isso
 * explícito, porque nota "emitida" que não existe na prefeitura é pior que
 * nota não emitida.
 */
export class ProvedorFiscalDemo implements ProvedorNfse {
  readonly nome = "DEMO" as const;
  private emitidas = new Map<string, ResultadoNota>();

  async emitir(input: EmitirNfseInput): Promise<ResultadoNota> {
    const existente = this.emitidas.get(input.referencia);
    if (existente) return existente;

    const seq = String(this.emitidas.size + 1).padStart(6, "0");
    const r: ResultadoNota = {
      status: "AUTORIZADA",
      numero: seq,
      serie: "DEMO",
      codigoVerificacao: `DEMO-${input.referencia.slice(-8).toUpperCase()}`,
      linkPrefeitura: null,
      pdfUrl: null,
      xmlUrl: null,
      mensagemErro: null,
      bruto: { demo: true, referencia: input.referencia, valor: input.servico.valorServicos },
    };
    this.emitidas.set(input.referencia, r);
    return r;
  }

  async consultar(referencia: string): Promise<ResultadoNota> {
    return (
      this.emitidas.get(referencia) ?? {
        status: "ERRO",
        mensagemErro: "Nota não encontrada no provedor de demonstração.",
        bruto: { demo: true },
      }
    );
  }

  async cancelar(referencia: string, justificativa: string): Promise<ResultadoNota> {
    const atual = this.emitidas.get(referencia);
    const r: ResultadoNota = {
      ...(atual ?? { status: "CANCELADA" }),
      status: "CANCELADA",
      bruto: { demo: true, justificativa },
    };
    this.emitidas.set(referencia, r);
    return r;
  }
}
