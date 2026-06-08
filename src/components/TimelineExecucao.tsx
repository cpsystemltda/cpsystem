const ETAPAS_BASE = [
  { key: "EMPENHADO", label: "Empenhado" },
  { key: "PEDIDO_RECEBIDO", label: "Pedido recebido" },
  { key: "EM_TRANSITO", label: "Em trânsito/Em execução" },
  { key: "ENTREGUE", label: "Entregue" },
  { key: "NF_EMITIDA", label: "NF emitida" },
  { key: "NF_ENCAMINHADA", label: "NF enviada" },
  { key: "PAGO", label: "Pago" },
] as const;

// Etapas extras quando há reajuste retroativo aplicado nesta execução.
// Aparecem ENCADEADAS após "Pago", estendendo a timeline.
const ETAPAS_REAJUSTE = [
  { key: "REAJUSTE_APLICADO", label: "Reajuste aplicado" },
  { key: "REAJUSTE_NF_EMITIDA", label: "NF complementar emitida" },
  { key: "REAJUSTE_NF_ENCAMINHADA", label: "NF complementar enviada" },
  { key: "REAJUSTE_PAGO", label: "NF complementar paga" },
] as const;

type EtapaKey =
  | (typeof ETAPAS_BASE)[number]["key"]
  | (typeof ETAPAS_REAJUSTE)[number]["key"];

// Mantido pra compat com callsites antigos. Apenas as etapas base.
const ETAPAS = ETAPAS_BASE;
export type MarcosTimeline = Partial<Record<EtapaKey, Date | null>>;

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
  comReajuste,
}: {
  status: string;
  marcos?: MarcosTimeline;
  compacta?: boolean;
  comDatas?: boolean;
  // Quando setado, estende a timeline com os 4 passos do reajuste
  // retroativo (já aplicado). Cada campo é a data do marco respectivo;
  // null pra marcos ainda pendentes.
  comReajuste?: {
    aplicadoEm: Date;
    nfEmitida: Date | null;
    nfEncaminhada: Date | null;
    pagamento: Date | null;
  };
}) {
  // Monta lista de etapas dinâmica: base + reajuste se aplicável
  const etapasUsadas = comReajuste
    ? [...ETAPAS_BASE, ...ETAPAS_REAJUSTE]
    : ETAPAS_BASE;

  // Quando há reajuste, "concluído" é determinado pelas datas (não pelo
  // status do empenho — que fica em PAGO). Pra etapas base, usa o
  // idxAtual do status. Pra etapas de reajuste, usa as datas.
  const idxAtual = ETAPAS_BASE.findIndex((e) => e.key === status);
  const ultimaEtapaBase = ETAPAS_BASE.length - 1;

  // Marcos de reajuste em mapa pra lookup
  const marcosReajuste: Record<string, Date | null> = comReajuste
    ? {
        REAJUSTE_APLICADO: comReajuste.aplicadoEm,
        REAJUSTE_NF_EMITIDA: comReajuste.nfEmitida,
        REAJUSTE_NF_ENCAMINHADA: comReajuste.nfEncaminhada,
        REAJUSTE_PAGO: comReajuste.pagamento,
      }
    : {};

  const tamCirculo = compacta ? "h-7 w-7" : "h-9 w-9";
  const tamLogo = compacta ? "h-3.5 w-3.5" : "h-4 w-4";
  const tamFonte = compacta ? "text-[10px]" : "text-xs";

  function statusEtapa(
    etapaKey: string,
    i: number,
  ): { concluido: boolean; atual: boolean } {
    if (i < ETAPAS_BASE.length) {
      // Etapa base
      const finalizadoBase = idxAtual === ultimaEtapaBase;
      // Quando há reajuste, "PAGO" não é mais o final — apenas concluído
      const concluido = comReajuste
        ? i <= idxAtual
        : finalizadoBase
          ? i <= idxAtual
          : i < idxAtual;
      const atual = !comReajuste && !finalizadoBase && i === idxAtual;
      return { concluido, atual };
    }
    // Etapa de reajuste — concluída se a data correspondente existe
    const dataMarco = marcosReajuste[etapaKey];
    const concluido = !!dataMarco;
    // Atual = primeira etapa de reajuste sem data
    const indicesReajuste = ETAPAS_REAJUSTE.findIndex((e) => e.key === etapaKey);
    const todasAnterioresConcluidas = ETAPAS_REAJUSTE.slice(0, indicesReajuste).every(
      (e) => !!marcosReajuste[e.key],
    );
    const atual = !concluido && todasAnterioresConcluidas;
    return { concluido, atual };
  }

  // Igor (08/06): nomes desalinhados com os simbolos. Causa: a linha do
  // tempo usava `flex flex-1` por etapa contendo circle + linha conectora
  // 'embutida', mas o label era renderizado em um grid SEPARADO. Em N
  // etapas, o grid de labels tinha N colunas, mas o flex dos circles
  // distribuia diferente — circles ficavam encostados a esquerda e linhas
  // ocupavam todo o resto. Resultado: labels nao batiam com circles.
  //
  // Fix: cada etapa agora e UM container flex-col com circle no topo e
  // label embaixo, ambos centralizados na mesma coluna. A linha conectora
  // virou position-absolute saindo do centro do circle atual ate o centro
  // do proximo. Alinha 100%.
  const topLinha = compacta ? "13px" : "17px"; // metade do circulo

  return (
    <div className="flex items-start">
      {etapasUsadas.map((etapa, i) => {
        const { concluido, atual } = statusEtapa(etapa.key, i);
        const proxConcluida =
          i < etapasUsadas.length - 1 &&
          statusEtapa(etapasUsadas[i + 1].key, i + 1).concluido;
        const data =
          i < ETAPAS_BASE.length
            ? (marcos as Record<string, Date | null | undefined> | undefined)?.[etapa.key] ?? null
            : marcosReajuste[etapa.key];

        return (
          <div key={etapa.key} className="relative flex flex-1 flex-col items-center">
            {/* Linha conectora horizontal — sai do centro do circle atual
                ate o centro do proximo (50% pra cada lado). */}
            {i < etapasUsadas.length - 1 && (
              <div
                className={`absolute h-px ${
                  proxConcluida || concluido ? "bg-emerald-600" : "bg-slate-200"
                }`}
                style={{ left: "50%", right: "-50%", top: topLinha }}
              />
            )}

            {/* Circle */}
            <div
              className={`relative z-[1] grid shrink-0 place-items-center rounded-full font-semibold transition ${tamCirculo} ${tamFonte} ${
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

            {/* Label embaixo do circle, centralizado na MESMA coluna */}
            {comDatas && (
              <div className="mt-1.5 px-1 text-center text-[10px] leading-tight">
                <span
                  className={`block font-medium ${
                    atual ? "text-slate-900" : concluido ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {etapa.label}
                </span>
                {data ? (
                  <span className="mt-0.5 block text-[10px] font-semibold text-slate-600">
                    {fmtData(data)}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[10px] text-slate-300">—</span>
                )}
              </div>
            )}
          </div>
        );
      })}
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
