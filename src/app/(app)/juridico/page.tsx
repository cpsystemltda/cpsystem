import { Scale, Sparkles, Check, MessageSquare, FileSignature, Lock } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { UpgradeForm, DowngradeForm } from "./UpgradeForm";

export default async function JuridicoPage() {
  const usuario = await exigirUsuario();
  const plano = usuario.conta.plano;

  if (plano !== "PREMIUM") {
    return (
      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-50">
            <Scale className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Suporte jurídico (Premium)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Inteligência jurídica nativa do Grupo Contratos Públicos diretamente no sistema.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-8">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-violet-700" />
            <span className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Recurso exclusivo do Plano Premium
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            Tenha um time jurídico de licitações ao seu lado
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Vai além do software: você passa a contar com a equipe especialista do Grupo Contratos Públicos para
            sustentar suas operações. Defesas, reajustes, recursos administrativos — tudo dentro de uma franquia anual
            previsível.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Beneficio icone={MessageSquare} titulo="12 consultas escritas/ano" texto="Tire dúvidas sobre execução contratual com SLA de 4h úteis." />
            <Beneficio icone={FileSignature} titulo="2 peças administrativas/ano" texto="Pedidos de reajuste, defesas prévias e respostas a notificações." />
            <Beneficio icone={Check} titulo="Canal VIP no WhatsApp" texto="Atendimento prioritário triado por IA + escalação humana." />
            <Beneficio icone={Sparkles} titulo="Desconto em peças avulsas" texto="Demandas extras (ex.: mandados de segurança) com preço especial." />
          </div>

          <div className="mt-8 flex items-center justify-between rounded-xl bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Investimento mensal</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">R$ 997<span className="text-base font-normal text-slate-500">/mês</span></p>
              <p className="text-xs text-slate-500">vs R$ 397/mês do Básico (+R$ 600/mês)</p>
            </div>
            <UpgradeForm />
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          * No MVP a alteração de plano é instantânea e não envolve cobrança real (gateway de pagamento será integrado em seguida).
        </p>
      </div>
    );
  }

  // PREMIUM
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-50">
          <Scale className="h-5 w-5 text-violet-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Painel Jurídico Premium</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sua franquia anual de consultoria com o Grupo Contratos Públicos.
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
          <Sparkles className="h-3 w-3" /> Premium ativo
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Franquia titulo="Consultas escritas" usado={0} total={12} />
        <Franquia titulo="Peças administrativas" usado={0} total={2} />
        <Franquia titulo="SLA primeiro atendimento" usado={"4h"} total={"úteis"} percentual={null} />
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Solicitar atendimento</h2>
        <p className="mt-2 text-sm text-slate-600">
          Em breve você poderá abrir solicitações jurídicas diretamente daqui. Hoje, contate a equipe pelo WhatsApp comercial:
        </p>
        <a
          href="https://wa.me/5561999999999"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <MessageSquare className="h-4 w-4" /> Abrir WhatsApp Premium
        </a>
      </section>

      <DowngradeForm />
    </div>
  );
}

function Beneficio({
  icone: Icone,
  titulo,
  texto,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-white/70 p-3">
      <Icone className="mt-0.5 h-5 w-5 text-violet-600" />
      <div>
        <p className="text-sm font-semibold text-slate-900">{titulo}</p>
        <p className="mt-0.5 text-xs text-slate-600">{texto}</p>
      </div>
    </div>
  );
}

function Franquia({
  titulo,
  usado,
  total,
  percentual,
}: {
  titulo: string;
  usado: number | string;
  total: number | string;
  percentual?: number | null;
}) {
  const pct = percentual !== undefined ? percentual : typeof usado === "number" && typeof total === "number" ? (usado / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {usado}{" "}
        <span className="text-base font-normal text-slate-400">/ {total}</span>
      </p>
      {pct !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
