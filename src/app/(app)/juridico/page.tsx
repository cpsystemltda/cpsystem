import { Scale, Sparkles, Check, MessageSquare, FileSignature, Lock } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { UpgradeForm, DowngradeForm } from "./UpgradeForm";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { AnaliseJuridicaPanel } from "@/components/AnaliseJuridicaPanel";
import { listarDocumentosParaAnalise } from "@/app/actions/iaJuridica";

export default async function JuridicoPage() {
  const usuario = await exigirUsuario();
  const plano = usuario.conta.plano;

  if (plano !== "PREMIUM") {
    return (
      <div className="mx-auto max-w-4xl px-8 py-8">
        <PageHeader
          eyebrow="Módulo · Premium"
          titulo="Consultoria"
          destaque="Jurídica"
          subtitulo="Análise de documentos via IA + franquia de consultoria humana com o Grupo Contratos Públicos."
        />

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
            Análise de documentos via IA com parecer estruturado + equipe especialista do Grupo
            Contratos Públicos para defesas, reajustes e recursos administrativos.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Beneficio
              icone={Sparkles}
              titulo="Parecer IA de cada documento"
              texto="Atas, Contratos e Empenhos analisados em segundos — pontos críticos, checklist, janelas de prazo."
            />
            <Beneficio
              icone={MessageSquare}
              titulo="12 consultas escritas/ano"
              texto="Tire dúvidas sobre execução contratual com SLA de 4h úteis."
            />
            <Beneficio
              icone={FileSignature}
              titulo="2 peças administrativas/ano"
              texto="Pedidos de reajuste, defesas prévias e respostas a notificações."
            />
            <Beneficio
              icone={Check}
              titulo="Canal VIP no WhatsApp"
              texto="Atendimento prioritário triado por IA + escalação humana."
            />
          </div>

          <div className="glass-tile mt-6 flex items-center justify-between rounded-[18px] px-5 py-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Investimento mensal</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                R$ 997<span className="text-base font-normal text-slate-500">/mês</span>
              </p>
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

  // PREMIUM — painel rico de análise jurídica
  const { atas, contratos, empenhos, avulsos } = await listarDocumentosParaAnalise();

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        eyebrow="Módulo · Premium ativo"
        titulo="Consultoria"
        destaque="Jurídica"
        subtitulo="Análise de documentos via IA + franquia de consultoria humana."
        cta={
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase"
            style={{
              background: "rgba(212,175,55,0.18)",
              color: "var(--primary-deep)",
              border: "0.5px solid rgba(168,137,71,0.4)",
              letterSpacing: "0.08em",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Premium ativo
          </span>
        }
      />

      {/* Análise jurídica por IA */}
      <div className="mt-8">
        <AnaliseJuridicaPanel atas={atas} contratos={contratos} empenhos={empenhos} avulsos={avulsos} />
      </div>

      {/* Franquia humana */}
      <section className="mt-10">
        <h2
          className="mb-3 text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          <Scale className="mr-1 inline-block h-3.5 w-3.5" /> Consultoria humana — franquia anual
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Franquia titulo="Consultas escritas" usado={0} total={12} />
          <Franquia titulo="Peças administrativas" usado={0} total={2} />
          <Franquia titulo="SLA primeiro atendimento" usado={"4h"} total={"úteis"} percentual={null} />
        </div>

        <div className="glass mt-4 rounded-[20px] px-6 py-5">
          <p className="text-sm text-slate-600">
            Para abrir uma consulta humana com o Grupo Contratos Públicos, use o canal VIP:
          </p>
          <a
            href="https://wa.me/5561999999999"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <MessageSquare className="h-4 w-4" /> Abrir WhatsApp Premium
          </a>
        </div>
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
    <div className="glass-tile flex gap-3 rounded-[14px] px-4 py-3">
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
  const pct =
    percentual !== undefined
      ? percentual
      : typeof usado === "number" && typeof total === "number"
        ? (usado / total) * 100
        : 0;
  return (
    <div className="glass-tile rounded-[18px] px-5 py-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {usado} <span className="text-base font-normal text-slate-400">/ {total}</span>
      </p>
      {pct !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
