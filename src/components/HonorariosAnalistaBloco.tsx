"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { UserCheck, Wallet, AlertCircle, Check, CalendarClock } from "lucide-react";
import { brl } from "@/lib/validators";
import { marcarPagamentoFixoAction } from "@/app/actions/comissaoFixa";

type LinhaFixo = {
  id: string;
  competencia: string; // YYYY-MM
  valor: number;
  valorRecebido: number;
  status: "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL";
  vencimento: Date | null;
  pagaEm: Date | null;
  analistaNome: string;
};

type LinhaVariavel = {
  id: string;
  empenhoNumero: string;
  orgaoNome: string;
  valorBaseEmpenho: number;
  valorCalculado: number;
  valorRecebido: number;
  percentual: number;
  status: "AGUARDANDO_ORGAO" | "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL";
  analistaNome: string;
};

function competenciaLabel(c: string): string {
  const [ano, mes] = c.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

export function HonorariosAnalistaBloco({
  fixosPendentes,
  variaveisPendentes,
  totalPagoMes,
  totalAtrasado,
  totalAPagar,
}: {
  fixosPendentes: LinhaFixo[];
  variaveisPendentes: LinhaVariavel[];
  totalPagoMes: number;
  totalAtrasado: number;
  totalAPagar: number;
}) {
  return (
    <section className="mt-8">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2
            className="inline-flex items-center gap-2 text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            <UserCheck className="h-3.5 w-3.5" /> Honorários do analista
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
            Comissões devidas ao seu analista de licitações. Marque como pago quando efetuar o repasse.
          </p>
        </div>
      </header>

      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <MiniCard tone="primary" label="A pagar (este mês)" valor={totalAPagar} icone={Wallet} />
        <MiniCard tone="coral" label="Atrasado" valor={totalAtrasado} icone={AlertCircle} />
        <MiniCard tone="mint" label="Pago no mês" valor={totalPagoMes} icone={Check} />
      </div>

      {/* Honorário fixo */}
      <div className="glass overflow-hidden rounded-[18px] mb-3">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Honorário fixo mensal
          </h3>
        </div>
        {fixosPendentes.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            Nenhum honorário fixo pendente neste momento.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {fixosPendentes.map((l) => (
              <LinhaFixoCard key={l.id} linha={l} />
            ))}
          </ul>
        )}
      </div>

      {/* Honorário variável */}
      {variaveisPendentes.length > 0 && (
        <div className="glass overflow-hidden rounded-[18px]">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Honorário variável (por execução)
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Comissões liberadas — o órgão já pagou o empenho e sua empresa precisa repassar a comissão.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {variaveisPendentes.map((l) => (
              <li key={l.id} className="px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">
                      {l.empenhoNumero} · {l.orgaoNome}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Analista: {l.analistaNome} · {l.percentual}% sobre {brl(l.valorBaseEmpenho)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold tabular text-slate-900">
                      {brl(l.valorCalculado)}
                    </p>
                    <span
                      className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        l.status === "ATRASADO"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {l.status === "ATRASADO" ? "Atrasado" : "A pagar"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
            Para marcar comissões variáveis como pagas, peça ao seu analista — ele controla isso pelo painel dele.
          </div>
        </div>
      )}
    </section>
  );
}

function MiniCard({
  tone,
  label,
  valor,
  icone: Icone,
}: {
  tone: "primary" | "coral" | "mint";
  label: string;
  valor: number;
  icone: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  const fg =
    tone === "primary"
      ? "var(--primary-deep)"
      : tone === "coral"
        ? "var(--coral-deep)"
        : "var(--mint-deep)";
  return (
    <div className="glass-tile flex items-center gap-3 rounded-xl px-4 py-3">
      <Icone className="h-5 w-5 shrink-0" style={{ color: fg }} />
      <div className="flex-1">
        <p
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
        >
          {label}
        </p>
        <p className="mt-0.5 text-[18px] font-extrabold tabular" style={{ color: fg }}>
          {brl(valor)}
        </p>
      </div>
    </div>
  );
}

function LinhaFixoCard({ linha }: { linha: LinhaFixo }) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction] = useActionState(marcarPagamentoFixoAction, null);
  const venceu = linha.vencimento && linha.vencimento < new Date() && linha.status !== "PAGO";

  return (
    <li className="px-4 py-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">
            {linha.analistaNome} · {competenciaLabel(linha.competencia)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {linha.vencimento ? (
              <>
                <CalendarClock className="mr-0.5 inline-block h-3 w-3" />
                Vence {linha.vencimento.toLocaleDateString("pt-BR")}
                {venceu && (
                  <span className="ml-1 font-semibold text-red-700">(atrasado)</span>
                )}
              </>
            ) : (
              "Sem vencimento definido"
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-extrabold tabular text-slate-900">{brl(linha.valor)}</p>
          {linha.status === "PAGO" ? (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <Check className="h-2.5 w-2.5" />
              Pago em {linha.pagaEm?.toLocaleDateString("pt-BR")}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-700"
            >
              {aberto ? "Cancelar" : "Marcar como pago"}
            </button>
          )}
        </div>
      </div>

      {aberto && linha.status !== "PAGO" && (
        <form
          action={formAction}
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
        >
          <input type="hidden" name="id" value={linha.id} />
          <input type="hidden" name="status" value="PAGO" />
          <input type="hidden" name="valorRecebido" value={linha.valor} />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-slate-700">Data do pagamento</span>
              <input
                type="date"
                name="dataPagamento"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-slate-700">Observação (opcional)</span>
              <input
                type="text"
                name="observacoes"
                placeholder="Ex: PIX, transferência..."
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          {state?.erro && (
            <p className="mt-2 text-xs text-red-700">{state.erro}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              className="rounded bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
              onClick={(ev) => {
                if (!window.confirm("Confirma que você pagou o analista? A ação será registrada no histórico.")) {
                  ev.preventDefault();
                }
              }}
            >
              Confirmar pagamento
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
