import { brl, formatarCnpj } from "@/lib/validators";
import { parsearResumo, type Mudanca } from "@/lib/diff";

const ROTULO_ACAO: Record<string, string> = {
  CRIAR: "Criou",
  ATUALIZAR: "Editou",
  EXCLUIR: "Removeu",
};

const ROTULO_RECURSO: Record<string, string> = {
  Ata: "a Ata",
  AtaItem: "item",
  Contrato: "o Contrato",
  ContratoItem: "item do contrato",
  ParcelaContrato: "parcela",
  Empenho: "o Empenho",
  EmpenhoItem: "item do empenho",
  OrgaoNaAta: "órgão",
  EnderecoEntrega: "endereço",
  PontoFocal: "ponto focal",
  ComissaoExecucao: "comissão da execução",
};

// Campos cujo valor deve ser formatado como moeda
const CAMPOS_MOEDA = new Set([
  "valorUnitario",
  "valorTotal",
  "valor",
  "valorAnterior",
  "valorNovo",
  "valorEstimado",
  "limiteValor",
]);
// Campos formatados como data
const CAMPOS_DATA = new Set([
  "dataAssinatura",
  "dataPublicacao",
  "vigenciaInicio",
  "vigenciaFim",
  "dataEmissao",
  "marcoOrcamentoEstimado",
  "dataPagamento",
]);
// Campos com CNPJ
const CAMPOS_CNPJ = new Set(["orgaoCnpj", "cnpj"]);
// Campos de data adicionais para a comissão
// Enums com rótulo amigável
const ENUM_LABEL: Record<string, Record<string, string>> = {
  status: {
    AGUARDANDO_ORGAO: "Aguardando órgão",
    A_RECEBER: "A receber",
    ATRASADO: "Atrasado",
    PAGO: "Pago",
    PAGO_PARCIAL: "Pago parcial",
  },
  procedimentoSelecao: {
    PREGAO_ELETRONICO: "Pregão Eletrônico",
    PREGAO_ELETRONICO_INTERNACIONAL: "Pregão Eletrônico Internacional",
    PREGAO_PRESENCIAL: "Pregão Presencial",
    CONCORRENCIA: "Concorrência",
    CONCURSO: "Concurso",
    LEILAO: "Leilão",
    DIALOGO_COMPETITIVO: "Diálogo Competitivo",
    DISPENSA: "Dispensa",
    INEXIGIBILIDADE: "Inexigibilidade",
  },
  tipo: {
    FORNECIMENTO: "Fornecimento",
    FORNECIMENTO_CONTINUO: "Fornecimento contínuo",
    SERVICOS: "Serviços",
    SERVICOS_CONTINUOS: "Serviços contínuos",
    SERVICOS_DEDICACAO_EXCLUSIVA: "Serviços (dedicação exclusiva)",
    LOCACAO: "Locação",
    OBRAS_ENGENHARIA: "Obras de engenharia",
  },
  modalidadeEntrega: {
    INTEGRAL: "Integral",
    PARCELADA: "Parcelada",
    SOB_DEMANDA: "Sob demanda",
  },
  marcoInicialPrazo: {
    ASSINATURA_CONTRATO: "Assinatura do contrato",
    ORDEM_FORNECIMENTO: "Ordem de Fornecimento",
    OUTRO: "Outro documento",
  },
  marcoReajusteOrigem: {
    ORCAMENTO_ESTIMADO: "Orçamento estimado",
    ASSINATURA: "Assinatura",
    OMISSA: "Omissa",
  },
  instrumento: {
    NOTA_EMPENHO: "Nota de Empenho",
    CARTA_CONTRATO: "Carta-Contrato",
    AUTORIZACAO_COMPRA: "Autorização de Compra",
    AUTORIZACAO_ENTREGA: "Autorização de Entrega",
    ORDEM_SERVICO: "Ordem de Execução de Serviço",
  },
  funcao: {
    AUTORIDADE_COMPETENTE: "Autoridade competente",
    GESTOR: "Gestor",
    FISCAL: "Fiscal",
    FISCAL_TECNICO: "Fiscal técnico",
    FISCAL_ADMINISTRATIVO: "Fiscal administrativo",
    RESPONSAVEL_SETOR: "Responsável de setor",
    CONTATO_GERAL: "Contato geral",
    OUTRO: "Outro",
  },
};

function formatarValor(campo: string, valor: unknown): string {
  if (valor == null || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (CAMPOS_MOEDA.has(campo) && typeof valor === "number") return brl(valor);
  if (CAMPOS_CNPJ.has(campo) && typeof valor === "string") return formatarCnpj(valor);
  if (CAMPOS_DATA.has(campo) && typeof valor === "string") {
    const d = new Date(valor);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  if (ENUM_LABEL[campo] && typeof valor === "string") {
    return ENUM_LABEL[campo][valor] ?? String(valor);
  }
  if (typeof valor === "number") {
    // Inteiros sem casas decimais, decimais com 2 casas
    return Number.isInteger(valor)
      ? valor.toString()
      : valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  const s = String(valor);
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

export function HistoricoLista({
  entradas,
}: {
  entradas: {
    id: string;
    acao: string;
    recurso: string;
    recursoId: string | null;
    resumo: string | null;
    criadoEm: Date;
    usuario: { nome: string; email: string } | null;
  }[];
}) {
  if (entradas.length === 0) {
    return (
      <div
        className="glass-tile rounded-[20px] p-12 text-center"
        style={{ border: "0.5px dashed var(--hairline)" }}
      >
        <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
          Sem alterações registradas ainda.
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
          Toda edição feita aqui (no botão Editar ou nos ícones de lápis das listas) entra neste histórico — campo por campo, valor antigo → valor novo.
        </p>
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {entradas.map((h) => {
        const acao = ROTULO_ACAO[h.acao] ?? h.acao;
        const recurso = ROTULO_RECURSO[h.recurso] ?? h.recurso;
        const quem = h.usuario?.nome || h.usuario?.email || "Usuário desconhecido";
        const estruturado = parsearResumo(h.resumo);
        return (
          <li
            key={h.id}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-slate-900">
                {quem}{" "}
                <span className="font-normal text-slate-500">
                  {acao.toLowerCase()} {recurso}
                  {estruturado?.titulo && ` — ${estruturado.titulo}`}
                </span>
              </span>
              <span className="text-xs text-slate-500">
                {h.criadoEm.toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {estruturado ? (
              <ul className="mt-2 space-y-1">
                {estruturado.mudancas.map((m: Mudanca, i) => (
                  <li key={i} className="rounded bg-slate-50 px-2 py-1 text-xs">
                    <span className="font-semibold text-slate-700">{m.rotulo}:</span>{" "}
                    <span className="text-red-700 line-through">
                      {formatarValor(m.campo, m.antes)}
                    </span>{" "}
                    <span className="text-slate-400">→</span>{" "}
                    <span className="font-medium text-emerald-700">
                      {formatarValor(m.campo, m.depois)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              h.resumo && <p className="mt-1 text-xs text-slate-600">{h.resumo}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
