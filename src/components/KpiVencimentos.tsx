import Link from "next/link";
import { CheckCircle2, Archive, AlertTriangle, AlertOctagon, Clock, Bell } from "lucide-react";

/**
 * Bloco de KPIs reutilizável para os painéis de Atas e Contratos.
 *
 * Exibe:
 *  - Quantidade de itens vigentes (vigenciaFim >= hoje)
 *  - Quantidade de itens finalizados (vigenciaFim < hoje)
 *  - 4 janelas de alerta de vencimento: 30, 60, 90 e 120 dias
 *
 * Cada janela é clicável e navega para a lista filtrada.
 */
type Props = {
  rotuloPlural: string; // "Atas" | "Contratos"
  rotuloSingularDe: string; // "ata" | "contrato"
  /** Concordância de gênero: "f" para Atas (vigentes/finalizadas), "m" para Contratos. */
  genero: "f" | "m";
  totalVigentes: number;
  totalFinalizados: number;
  vencendoEm30: number;
  vencendoEm60: number;
  vencendoEm90: number;
  vencendoEm120: number;
  hrefVigentes: string;
  hrefFinalizados: string;
  hrefBaseAlerta: string; // ex: "/atas?status=vigentes&alerta="
};

export function KpiVencimentos({
  rotuloPlural,
  rotuloSingularDe,
  genero,
  totalVigentes,
  totalFinalizados,
  vencendoEm30,
  vencendoEm60,
  vencendoEm90,
  vencendoEm120,
  hrefVigentes,
  hrefFinalizados,
  hrefBaseAlerta,
}: Props) {
  const sufixoF = genero === "f" ? "as" : "os"; // "vigentes" não concorda; mas "finalizadas/finalizados" sim
  const vigentesSufixo = genero === "f" ? "Vigentes" : "Vigentes"; // mesma forma nos dois gêneros
  const finalizadasSufixo = `Finalizad${sufixoF}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={hrefVigentes}
          className="group flex items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 transition hover:shadow-sm"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              {rotuloPlural} {vigentesSufixo.toLowerCase()}
            </p>
            <p className="mt-0.5 text-3xl font-bold tracking-tight text-slate-900">{totalVigentes}</p>
            <p className="text-xs text-slate-500">Em execução nesta data</p>
          </div>
        </Link>

        <Link
          href={hrefFinalizados}
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 transition hover:shadow-sm"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-700 text-white shadow-sm">
            <Archive className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
              {rotuloPlural} {finalizadasSufixo.toLowerCase()}
            </p>
            <p className="mt-0.5 text-3xl font-bold tracking-tight text-slate-900">{totalFinalizados}</p>
            <p className="text-xs text-slate-500">Vigência expirada</p>
          </div>
        </Link>
      </div>

      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
          <Bell className="h-3 w-3" /> Alertas de vencimento — clique para abrir a lista filtrada
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CardAlerta
            href={`${hrefBaseAlerta}30`}
            qtd={vencendoEm30}
            janela="30 dias"
            severidade="alta"
            sub={`${rotuloPlural} vencendo no próximo mês`}
            singular={rotuloSingularDe}
          />
          <CardAlerta
            href={`${hrefBaseAlerta}60`}
            qtd={vencendoEm60}
            janela="60 dias"
            severidade="media"
            sub={`Renove ou prepare nova licitação`}
            singular={rotuloSingularDe}
          />
          <CardAlerta
            href={`${hrefBaseAlerta}90`}
            qtd={vencendoEm90}
            janela="90 dias"
            severidade="media"
            sub={`Janela de planejamento`}
            singular={rotuloSingularDe}
          />
          <CardAlerta
            href={`${hrefBaseAlerta}120`}
            qtd={vencendoEm120}
            janela="120 dias"
            severidade="baixa"
            sub={`Horizonte estratégico`}
            singular={rotuloSingularDe}
          />
        </div>
      </div>
    </div>
  );
}

function CardAlerta({
  href,
  qtd,
  janela,
  severidade,
  sub,
  singular,
}: {
  href: string;
  qtd: number;
  janela: string;
  severidade: "alta" | "media" | "baixa";
  sub: string;
  singular: string;
}) {
  const cores =
    severidade === "alta"
      ? { borda: "border-red-200", bg: "bg-red-50", iconBg: "bg-red-600", titulo: "text-red-700" }
      : severidade === "media"
        ? { borda: "border-amber-200", bg: "bg-amber-50", iconBg: "bg-amber-600", titulo: "text-amber-700" }
        : { borda: "border-blue-200", bg: "bg-blue-50", iconBg: "bg-blue-600", titulo: "text-blue-700" };

  const Icon = severidade === "alta" ? AlertOctagon : severidade === "media" ? AlertTriangle : Clock;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border ${cores.borda} ${cores.bg} p-4 transition hover:shadow-sm ${
        qtd === 0 ? "opacity-60" : ""
      }`}
    >
      <div className={`grid h-10 w-10 place-items-center rounded-lg ${cores.iconBg} text-white shadow-sm`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${cores.titulo}`}>{janela}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{qtd}</p>
        <p className="text-[10px] text-slate-600">
          {qtd === 0 ? `Nenhum ${singular} nesta janela` : sub}
        </p>
      </div>
    </Link>
  );
}
