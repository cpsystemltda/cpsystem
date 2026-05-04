"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  ClipboardList,
  Search,
  Filter,
  LayoutGrid,
  List,
  Printer,
  Pencil,
  Trash2,
  ChevronRight,
  ArrowUpRight,
  X,
} from "lucide-react";
import { excluirContratoAction } from "@/app/actions/contratacoes";

export type ContratoCard = {
  id: string;
  numero: string;
  tipo: string;
  objeto: string;
  orgaoNome: string;
  empresaNome: string;
  ataNumero: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  diasParaVencer: number;
  valorTotal: number;
  valorExecutado: number;
  pctExecutado: number;
  status: "vigentes" | "vencimento_proximo" | "vencidos" | "finalizados";
};

const ROTULOS_TIPO: Record<string, string> = {
  COMPRAS: "Compras",
  SERVICOS: "Serviços",
  OBRA: "Obra",
  FORNECIMENTO: "Fornecimento",
  SERVICO_CONTINUADO: "Serviço Continuado",
  AQUISICAO: "Aquisição",
  ALUGUEL: "Aluguel",
  CONVENIO: "Convênio",
  OUTRO: "Outro",
};

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function brlExato(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function ContratosBrowser({
  contratos,
  contadores,
  orgaos,
}: {
  contratos: ContratoCard[];
  contadores: Record<string, number>;
  orgaos: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const aba = (sp.get("aba") as ContratoCard["status"]) || "vigentes";
  const q = sp.get("q") || "";
  const orgao = sp.get("orgao") || "";
  const visao = sp.get("v") || "grid";
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  function navega(patches: Record<string, string | null>) {
    const novo = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patches)) {
      if (v === null || v === "") novo.delete(k);
      else novo.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${novo.toString()}`));
  }

  return (
    <div>
      {/* Abas */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        <Aba ativa={aba === "vigentes"} onClick={() => navega({ aba: "vigentes" })} label="Vigentes" qtd={contadores.vigentes} cor="emerald" />
        <Aba ativa={aba === "vencimento_proximo"} onClick={() => navega({ aba: "vencimento_proximo" })} label="Vencimento próximo" qtd={contadores.vencimento_proximo} cor="amber" />
        <Aba ativa={aba === "vencidos"} onClick={() => navega({ aba: "vencidos" })} label="Vencidos" qtd={contadores.vencidos} cor="red" />
        <Aba ativa={aba === "finalizados"} onClick={() => navega({ aba: "finalizados" })} label="Finalizados" qtd={contadores.finalizados} cor="slate" />
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            defaultValue={q}
            placeholder="Buscar por número, objeto, processo, órgão…"
            onKeyDown={(e) => {
              if (e.key === "Enter") navega({ q: e.currentTarget.value || null });
            }}
            className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {q && (
            <button
              type="button"
              onClick={() => navega({ q: null })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFiltroAberto((f) => !f)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
            orgao || filtroAberto
              ? "border-blue-300 bg-blue-50 text-blue-800"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {orgao && (
            <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">1</span>
          )}
        </button>

        <div className="ml-auto inline-flex items-center rounded-full border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => navega({ v: "grid" })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              visao === "grid" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Visualização em cards"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => navega({ v: "lista" })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              visao === "lista" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Visualização em lista"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Painel de filtros expandido */}
      {filtroAberto && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <label className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Órgão:</span>
            <select
              value={orgao}
              onChange={(e) => navega({ orgao: e.target.value || null })}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <option value="">Todos</option>
              {orgaos.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          {(orgao || q) && (
            <button
              type="button"
              onClick={() => navega({ orgao: null, q: null })}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              <X className="h-3 w-3" /> Limpar tudo
            </button>
          )}
        </div>
      )}

      {/* Resultado */}
      {pending && (
        <div className="mt-4 text-xs text-slate-400">Carregando…</div>
      )}

      {contratos.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 text-base font-semibold text-slate-900">Nenhum contrato nesta categoria</p>
          <p className="mt-1 text-sm text-slate-500">
            {q || orgao ? "Ajuste os filtros ou limpe a busca." : "Cadastre um novo contrato pra começar."}
          </p>
          <Link
            href="/contratacoes/nova/contrato"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Cadastrar contrato
          </Link>
        </div>
      ) : visao === "grid" ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {contratos.map((c) => (
            <Card
              key={c.id}
              c={c}
              confirmando={confirmando === c.id}
              onConfirmar={() => setConfirmando(c.id)}
              onCancelar={() => setConfirmando(null)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Contrato</th>
                <th className="px-4 py-3 font-semibold">Órgão</th>
                <th className="px-4 py-3 text-right font-semibold">Valor</th>
                <th className="px-4 py-3 text-center font-semibold">Execução</th>
                <th className="px-4 py-3 font-semibold">Vigência</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <Linha
                  key={c.id}
                  c={c}
                  confirmando={confirmando === c.id}
                  onConfirmar={() => setConfirmando(c.id)}
                  onCancelar={() => setConfirmando(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Aba({
  ativa,
  onClick,
  label,
  qtd,
  cor,
}: {
  ativa: boolean;
  onClick: () => void;
  label: string;
  qtd: number;
  cor: "emerald" | "amber" | "red" | "slate";
}) {
  const map = {
    emerald: "border-emerald-600 text-emerald-700",
    amber: "border-amber-600 text-amber-700",
    red: "border-red-600 text-red-700",
    slate: "border-slate-700 text-slate-900",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
        ativa ? `${map[cor]} font-semibold` : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          ativa ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {qtd}
      </span>
      {ativa && <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${map[cor].split(" ")[0]}`} />}
    </button>
  );
}

function Card({
  c,
  confirmando,
  onConfirmar,
  onCancelar,
}: {
  c: ContratoCard;
  confirmando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const corVencimento =
    c.diasParaVencer < 0
      ? "text-red-700"
      : c.diasParaVencer <= 30
      ? "text-amber-700"
      : c.diasParaVencer <= 90
      ? "text-yellow-700"
      : "text-slate-500";
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-bold text-slate-900">Contrato {c.numero}</h3>
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {ROTULOS_TIPO[c.tipo] || c.tipo}
              </span>
              {c.ataNumero && (
                <span className="shrink-0 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  Ata {c.ataNumero}
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">{c.objeto}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {c.orgaoNome} · {c.empresaNome}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Valor</p>
          <p className="mt-0.5 text-base font-bold text-slate-900">{brl(c.valorTotal)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Executado</p>
          <p className={`mt-0.5 text-base font-bold ${c.pctExecutado > 80 ? "text-emerald-700" : "text-slate-900"}`}>
            {c.pctExecutado.toFixed(0)}%
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
              style={{ width: `${Math.min(100, c.pctExecutado)}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Vigência</p>
          <p className={`mt-0.5 text-sm font-semibold ${corVencimento}`}>
            {c.diasParaVencer > 0 ? `${c.diasParaVencer}d restantes` : `Venceu há ${-c.diasParaVencer}d`}
          </p>
          <p className="text-[11px] text-slate-500">até {new Date(c.vigenciaFim).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>

      {confirmando ? (
        <div className="border-t border-red-200 bg-red-50/60 px-5 py-3">
          <p className="text-xs text-red-800">
            <strong>Confirma a exclusão?</strong> Essa ação não pode ser desfeita. Empenhos vinculados impedem a exclusão.
          </p>
          <div className="mt-2 flex gap-2">
            <form action={excluirContratoAction}>
              <input type="hidden" name="id" value={c.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                <Trash2 className="h-3 w-3" /> Excluir definitivamente
              </button>
            </form>
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/30 px-5 py-3">
          <Link
            href={`/contratos/${c.id}/imprimir`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Link>
          <Link
            href={`/contratos/${c.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Alterar
          </Link>
          <button
            type="button"
            onClick={onConfirmar}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
          <Link
            href={`/contratos/${c.id}`}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            Abrir <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function Linha({
  c,
  confirmando,
  onConfirmar,
  onCancelar,
}: {
  c: ContratoCard;
  confirmando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900">{c.numero}</p>
          {c.ataNumero && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
              Ata {c.ataNumero}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{c.objeto}</p>
      </td>
      <td className="px-4 py-3 text-xs">
        <p className="font-medium text-slate-700">{c.orgaoNome}</p>
        <p className="text-[11px] text-slate-500">{c.empresaNome}</p>
      </td>
      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{brlExato(c.valorTotal)}</td>
      <td className="px-4 py-3 text-center">
        <div className="mx-auto inline-flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-slate-700">{c.pctExecutado.toFixed(0)}%</span>
          <div className="h-1 w-20 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600"
              style={{ width: `${Math.min(100, c.pctExecutado)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs">
        <p className={c.diasParaVencer < 0 ? "font-semibold text-red-700" : c.diasParaVencer <= 30 ? "font-semibold text-amber-700" : "text-slate-700"}>
          {c.diasParaVencer > 0 ? `${c.diasParaVencer}d` : `−${-c.diasParaVencer}d`}
        </p>
        <p className="text-[11px] text-slate-500">{new Date(c.vigenciaFim).toLocaleDateString("pt-BR")}</p>
      </td>
      <td className="px-4 py-3">
        {confirmando ? (
          <div className="flex items-center justify-end gap-1.5">
            <form action={excluirContratoAction}>
              <input type="hidden" name="id" value={c.id} />
              <button
                type="submit"
                className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
              >
                Confirmar exclusão
              </button>
            </form>
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/contratos/${c.id}/imprimir`}
              target="_blank"
              className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Imprimir extrato"
            >
              <Printer className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/contratos/${c.id}`}
              className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Alterar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onConfirmar}
              className="grid h-7 w-7 place-items-center rounded-md border border-red-200 text-red-700 hover:bg-red-50"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <Link
              href={`/contratos/${c.id}`}
              className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-blue-700 hover:bg-blue-50"
              title="Abrir"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </td>
    </tr>
  );
}
