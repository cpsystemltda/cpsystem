const ETAPAS = [
  { key: "EMPENHADO", label: "Empenhado" },
  { key: "PEDIDO_RECEBIDO", label: "Pedido recebido" },
  { key: "EM_TRANSITO", label: "Em trânsito/Em execução" },
  { key: "ENTREGUE", label: "Entregue" },
  { key: "NF_EMITIDA", label: "NF emitida" },
  { key: "NF_ENCAMINHADA", label: "NF enviada" },
  { key: "PAGO", label: "Pago" },
] as const;

export type MarcosTimeline = Partial<Record<(typeof ETAPAS)[number]["key"], Date | null>>;

const fmtData = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * Logo CP "C" simplificada inline pra usar dentro dos círculos verdes
 * (etapas concluídas). Cor herdada do `currentColor`.
 */
function LogoCpInline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* "C" — meio círculo aberto à direita */}
      <path
        d="M16 5.5a7 7 0 1 0 0 13"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* "P" — haste vertical + miolo */}
      <path
        d="M14 5.5v13"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M14 9.2h2.5a2.4 2.4 0 0 1 0 4.8H14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Linha do tempo de execução — visual minimalista inspirado em e-commerce
 * (Nike, Amazon). Etapas concluídas: círculo verde com a logo CP em branco.
 * Etapa atual: círculo preto com número branco.
 * Etapas pendentes: círculo branco com borda cinza e número cinza.
 */
export function TimelineExecucao({
  status,
  marcos,
  compacta = false,
  comDatas = false,
}: {
  status: string;
  marcos?: MarcosTimeline;
  compacta?: boolean;
  comDatas?: boolean;
}) {
  const idxAtual = ETAPAS.findIndex((e) => e.key === status);
  const ultimaEtapa = ETAPAS.length - 1;
  // Quando o pedido chegou na etapa final (PAGO), todas as etapas (inclusive a última)
  // ficam como concluídas — não há mais "atual em andamento".
  const finalizado = idxAtual === ultimaEtapa;
  const tamCirculo = compacta ? "h-7 w-7" : "h-9 w-9";
  const tamLogo = compacta ? "h-3.5 w-3.5" : "h-4 w-4";
  const tamFonte = compacta ? "text-[10px]" : "text-xs";

  return (
    <div className={comDatas ? "space-y-2" : ""}>
      <div className="flex items-center">
        {ETAPAS.map((etapa, i) => {
          const concluido = finalizado ? i <= idxAtual : i < idxAtual;
          const atual = !finalizado && i === idxAtual;
          // Pendente: i > idxAtual

          return (
            <div key={etapa.key} className="flex flex-1 items-center">
              <div
                className={`grid shrink-0 place-items-center rounded-full font-semibold transition ${tamCirculo} ${tamFonte} ${
                  concluido
                    ? "bg-emerald-600 text-white"
                    : atual
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-400"
                }`}
                title={etapa.label}
              >
                {concluido ? (
                  <LogoCpInline className={tamLogo} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              {i < ETAPAS.length - 1 && (
                <div
                  className={`h-px flex-1 ${
                    concluido ? "bg-emerald-600" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {comDatas && (
        <div className="grid grid-cols-7 gap-1 pt-1 text-center text-[10px] leading-tight">
          {ETAPAS.map((etapa, i) => {
            const data = marcos?.[etapa.key];
            const concluido = finalizado ? i <= idxAtual : i < idxAtual;
            const atual = !finalizado && i === idxAtual;
            return (
              <div key={etapa.key} className="flex flex-col items-center">
                <span
                  className={`font-medium ${
                    atual ? "text-slate-900" : concluido ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {etapa.label}
                </span>
                {data ? (
                  <span className="mt-0.5 text-[10px] font-semibold text-slate-600">
                    {fmtData(data)}
                  </span>
                ) : (
                  <span className="mt-0.5 text-[10px] text-slate-300">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TimelineExecucaoVertical({
  status,
  marcos,
}: {
  status: string;
  marcos?: Partial<Record<(typeof ETAPAS)[number]["key"], Date | null>>;
}) {
  const idxAtual = ETAPAS.findIndex((e) => e.key === status);
  const finalizado = idxAtual === ETAPAS.length - 1;
  return (
    <ol className="relative space-y-5">
      {ETAPAS.map((etapa, i) => {
        const concluido = finalizado ? i <= idxAtual : i < idxAtual;
        const atual = !finalizado && i === idxAtual;
        const data = marcos?.[etapa.key];
        return (
          <li key={etapa.key} className="flex items-start gap-4">
            <div className="relative flex flex-col items-center">
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-semibold transition ${
                  concluido
                    ? "bg-emerald-600 text-white"
                    : atual
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-400"
                }`}
              >
                {concluido ? <LogoCpInline className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
              </div>
              {i < ETAPAS.length - 1 && (
                <div
                  className={`mt-1 h-8 w-px ${
                    concluido ? "bg-emerald-600" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
            <div className="flex-1 pb-5">
              <p
                className={`text-sm font-semibold ${
                  atual ? "text-slate-900" : concluido ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {etapa.label}
              </p>
              {data ? (
                <p className="mt-0.5 text-xs text-slate-500">{data.toLocaleDateString("pt-BR")}</p>
              ) : (
                <p className="mt-0.5 text-xs text-slate-400">{atual ? "Em andamento" : "Aguardando"}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
