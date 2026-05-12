import { brl } from "@/lib/validators";

type StatusComissao =
  | "AGUARDANDO_ORGAO"
  | "A_RECEBER"
  | "ATRASADO"
  | "PAGO"
  | "PAGO_PARCIAL";

const ROTULO_STATUS: Record<StatusComissao, string> = {
  AGUARDANDO_ORGAO: "Aguardando órgão",
  A_RECEBER: "A receber",
  ATRASADO: "Atrasado",
  PAGO: "Pago",
  PAGO_PARCIAL: "Pago parcial",
};

const COR_STATUS: Record<StatusComissao, { bg: string; fg: string; border: string }> = {
  AGUARDANDO_ORGAO: { bg: "rgba(184,197,214,0.18)", fg: "#365175", border: "rgba(120,140,170,0.4)" },
  A_RECEBER: { bg: "rgba(212,175,55,0.20)", fg: "#7a5c1a", border: "rgba(168,137,71,0.5)" },
  ATRASADO: { bg: "rgba(232,138,152,0.20)", fg: "#9b2c3a", border: "rgba(198,103,112,0.5)" },
  PAGO: { bg: "rgba(93,216,182,0.20)", fg: "#1f6f55", border: "rgba(93,216,182,0.4)" },
  PAGO_PARCIAL: { bg: "rgba(197,180,255,0.22)", fg: "#5a4795", border: "rgba(155,135,225,0.5)" },
};

type ComissaoNoEmpenho = {
  id: string;
  status: StatusComissao;
  percentual: number;
  percentualOverride: boolean;
  observacaoOverride: string | null;
  valorBaseEmpenho: number;
  valorBasePago: number;
  valorCalculado: number;
  valorRecebido: number;
  dataPagamento: Date | null;
  comprovanteUrl: string | null;
  observacao: string | null;
  analista: { nomeCompleto: string; email: string };
};

/**
 * Tab read-only de Comissões da Execução — mostrada na página do empenho.
 * Quem vê: a empresa fornecedora (que cadastrou o empenho).
 * Por quê: a empresa precisa saber o que o analista já marcou como recebido
 * para fins de quitação contábil. Só leitura — analista marca no painel dele.
 */
export function ComissoesNoEmpenhoTab({
  comissoes,
}: {
  comissoes: ComissaoNoEmpenho[];
}) {
  if (comissoes.length === 0) {
    return (
      <div
        className="glass-tile rounded-[20px] p-12 text-center"
        style={{ border: "0.5px dashed var(--hairline)" }}
      >
        <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
          Sem analista vinculado a esta execução.
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
          Vincule um analista à sua conta para que ele apareça aqui e possa cobrar a comissão devida.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-600">
        A comissão de cada analista vinculado é controlada manualmente por ele no painel dele.
        Esta tela é somente leitura — mostra o status atual da Linha B para sua referência contábil.
      </p>
      <ul className="space-y-3">
        {comissoes.map((c) => {
          const cor = COR_STATUS[c.status];
          return (
            <li
              key={c.id}
              className="rounded-lg border bg-white p-4 text-sm"
              style={{ borderColor: cor.border }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{c.analista.nomeCompleto}</p>
                  <p className="text-[11px] text-slate-500">{c.analista.email}</p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    background: cor.bg,
                    color: cor.fg,
                    letterSpacing: "0.06em",
                  }}
                >
                  {ROTULO_STATUS[c.status]}
                </span>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-1.5 text-xs md:grid-cols-2">
                <div>
                  <span className="text-slate-500">Percentual: </span>
                  <span className="font-bold">{c.percentual}%</span>
                  {c.percentualOverride && (
                    <span
                      className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold"
                      title={c.observacaoOverride ?? "Override aplicado"}
                    >
                      Override
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Comissão devida: </span>
                  <span className="font-bold tabular">{brl(c.valorCalculado)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Valor pago pelo órgão: </span>
                  <span className="tabular">{brl(c.valorBasePago)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Valor recebido pelo analista: </span>
                  <span className="tabular">{brl(c.valorRecebido)}</span>
                </div>
                {c.dataPagamento && (
                  <div>
                    <span className="text-slate-500">Data do pagamento: </span>
                    <span>{c.dataPagamento.toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
                {c.comprovanteUrl && (
                  <div>
                    <span className="text-slate-500">Comprovante: </span>
                    <a
                      href={c.comprovanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      ver arquivo
                    </a>
                  </div>
                )}
              </div>
              {c.observacao && (
                <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] italic text-slate-600">
                  &ldquo;{c.observacao}&rdquo;
                </p>
              )}
              {c.percentualOverride && c.observacaoOverride && (
                <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                  <strong>Justificativa do override:</strong> {c.observacaoOverride}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
