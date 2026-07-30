"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Check, X, ArrowRight } from "lucide-react";
import {
  confirmarConciliacaoAction,
  rejeitarConciliacaoAction,
  confirmarConciliacaoDebitoAction,
  rejeitarConciliacaoDebitoAction,
} from "@/app/actions/conciliacao";

type Sugestao = {
  id: string;
  score: number;
  transacao: {
    data: Date;
    valor: number;
    descricao: string;
    nomeContraparte: string | null;
  };
  empenho: {
    id: string;
    numero: string;
    orgaoNome: string;
    valorEmpenho: number;
  };
};

export type SugestaoDebito = {
  id: string;
  score: number;
  transacao: {
    data: Date;
    valor: number;
    descricao: string;
    nomeContraparte: string | null;
  };
  contrapartida: {
    tipo: "COBRANCA_CP" | "FIXO_ANALISTA" | "COMISSAO_ANALISTA";
    titulo: string;
    detalhe: string;
    valorEsperado: number;
  };
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dt(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR");
}

export function SugestoesPendentes({
  sugestoes,
  sugestoesDebito,
}: {
  sugestoes: Sugestao[];
  sugestoesDebito: SugestaoDebito[];
}) {
  const total = sugestoes.length + sugestoesDebito.length;
  if (total === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-900">
        Sugestões pendentes de revisão ({total})
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Casos onde a gente encontrou uma contrapartida compatível mas não teve
        certeza pra conciliar automaticamente. Revise e aprove/rejeite.
      </p>
      <div className="mt-4 space-y-3">
        {sugestoes.map((s) => (
          <ItemSugestao key={s.id} sugestao={s} />
        ))}
        {sugestoesDebito.map((s) => (
          <ItemSugestaoDebito key={s.id} sugestao={s} />
        ))}
      </div>
    </section>
  );
}

function ItemSugestao({ sugestao }: { sugestao: Sugestao }) {
  const [confState, confAction] = useActionState(confirmarConciliacaoAction, null);
  const [rejState, rejAction] = useActionState(rejeitarConciliacaoAction, null);
  const err = confState?.erro || rejState?.erro;
  const scoreCor =
    sugestao.score >= 75
      ? "bg-emerald-100 text-emerald-700"
      : sugestao.score >= 60
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${scoreCor}`}>
              {Math.round(sugestao.score)}% de match
            </span>
          </div>
          <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Transação no extrato</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{brl(sugestao.transacao.valor)}</p>
              <p className="text-xs text-slate-600">{dt(sugestao.transacao.data)}</p>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                {sugestao.transacao.nomeContraparte ?? sugestao.transacao.descricao}
              </p>
            </div>
            <ArrowRight className="mx-auto h-5 w-5 text-slate-400 hidden md:block" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Empenho candidato</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Empenho {sugestao.empenho.numero} — {brl(sugestao.empenho.valorEmpenho)}
              </p>
              <p className="text-xs text-slate-600 line-clamp-2">{sugestao.empenho.orgaoNome}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <form action={confAction}>
            <input type="hidden" name="conciliacaoId" value={sugestao.id} />
            <BotaoConfirmar />
          </form>
          <form action={rejAction}>
            <input type="hidden" name="conciliacaoId" value={sugestao.id} />
            <BotaoRejeitar />
          </form>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  );
}

function ItemSugestaoDebito({ sugestao }: { sugestao: SugestaoDebito }) {
  const [confState, confAction] = useActionState(confirmarConciliacaoDebitoAction, null);
  const [rejState, rejAction] = useActionState(rejeitarConciliacaoDebitoAction, null);
  const err = confState?.erro || rejState?.erro;
  const scoreCor =
    sugestao.score >= 75
      ? "bg-emerald-100 text-emerald-700"
      : sugestao.score >= 60
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";
  const tipoLabel =
    sugestao.contrapartida.tipo === "COBRANCA_CP"
      ? "Mensalidade CP System"
      : sugestao.contrapartida.tipo === "FIXO_ANALISTA"
        ? "Fixo mensal do analista"
        : "Comissão variável do analista";
  return (
    <div className="rounded-xl border border-rose-200 bg-white p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${scoreCor}`}>
              {Math.round(sugestao.score)}% de match
            </span>
            <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              DÉBITO
            </span>
            <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">
              {tipoLabel}
            </span>
          </div>
          <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Débito no extrato</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">−{brl(sugestao.transacao.valor)}</p>
              <p className="text-xs text-slate-600">{dt(sugestao.transacao.data)}</p>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                {sugestao.transacao.nomeContraparte ?? sugestao.transacao.descricao}
              </p>
            </div>
            <ArrowRight className="mx-auto h-5 w-5 text-slate-400 hidden md:block" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Contrapartida</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {sugestao.contrapartida.titulo} — {brl(sugestao.contrapartida.valorEsperado)}
              </p>
              <p className="text-xs text-slate-600 line-clamp-2">{sugestao.contrapartida.detalhe}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <form action={confAction}>
            <input type="hidden" name="conciliacaoId" value={sugestao.id} />
            <BotaoConfirmar />
          </form>
          <form action={rejAction}>
            <input type="hidden" name="conciliacaoId" value={sugestao.id} />
            <BotaoRejeitar />
          </form>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  );
}

function BotaoConfirmar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      Conciliar
    </button>
  );
}

function BotaoRejeitar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      Rejeitar
    </button>
  );
}
