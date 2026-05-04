import { CheckCircle2, FileText, Calendar, Truck, Building2, Receipt, Send, Wallet } from "lucide-react";

const ETAPAS = [
  { key: "EMPENHADO", label: "Empenhado", icon: FileText },
  { key: "PEDIDO_RECEBIDO", label: "Pedido recebido", icon: Calendar },
  { key: "EM_TRANSITO", label: "Em trânsito", icon: Truck },
  { key: "ENTREGUE", label: "Entregue", icon: Building2 },
  { key: "NF_EMITIDA", label: "NF emitida", icon: Receipt },
  { key: "NF_ENCAMINHADA", label: "NF enviada", icon: Send },
  { key: "PAGO", label: "Pago", icon: Wallet },
] as const;

export function TimelineExecucao({ status, compacta = false }: { status: string; compacta?: boolean }) {
  const idxAtual = ETAPAS.findIndex((e) => e.key === status);
  return (
    <div className={`flex items-center ${compacta ? "gap-1" : "gap-1.5"}`}>
      {ETAPAS.map((etapa, i) => {
        const passou = i <= idxAtual;
        const atual = i === idxAtual;
        return (
          <div key={etapa.key} className="flex flex-1 items-center gap-1">
            <div
              className={`grid shrink-0 place-items-center rounded-full text-[10px] font-bold transition ${
                compacta ? "h-7 w-7" : "h-9 w-9"
              } ${
                atual
                  ? "bg-blue-600 text-white ring-4 ring-blue-100"
                  : passou
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
              title={etapa.label}
            >
              {passou && !atual ? (
                <CheckCircle2 className={compacta ? "h-3.5 w-3.5" : "h-4 w-4"} />
              ) : (
                i + 1
              )}
            </div>
            {i < ETAPAS.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded-full ${
                  i < idxAtual ? "bg-emerald-500" : "bg-slate-200"
                }`}
              />
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
  return (
    <ol className="relative space-y-5">
      {ETAPAS.map((etapa, i) => {
        const passou = i <= idxAtual;
        const atual = i === idxAtual;
        const data = marcos?.[etapa.key];
        const Icon = etapa.icon;
        return (
          <li key={etapa.key} className="flex items-start gap-4">
            <div className="relative flex flex-col items-center">
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
                  atual
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : passou
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              {i < ETAPAS.length - 1 && (
                <div
                  className={`mt-1 h-8 w-0.5 ${
                    i < idxAtual ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
            <div className="flex-1 pb-5">
              <p
                className={`text-sm font-semibold ${
                  atual ? "text-blue-900" : passou ? "text-slate-900" : "text-slate-400"
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
