"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, X, Upload, AlertCircle, Check } from "lucide-react";
import { brl } from "@/lib/validators";
import {
  marcarPagamentoFixoAction,
  atualizarValorVencimentoFixoAction,
  excluirPagamentoFixoAction,
} from "@/app/actions/comissaoFixa";

type StatusFixo = "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL";

type Linha = {
  id: string;
  vinculoId: string;
  competencia: string;
  valor: number;
  vencimento: Date | null;
  status: StatusFixo;
  valorRecebido: number;
  pagaEm: Date | null;
  comprovanteUrl: string | null;
  observacoes: string | null;
  vinculo: {
    id: string;
    percentualComissao: number;
    fixoMensal: number;
    diaVencimentoFixo: number;
    status: string;
    conta: {
      empresas: { id: string; razaoSocial: string; nomeFantasia: string | null }[];
    };
  };
};

const ROTULO_STATUS: Record<StatusFixo, string> = {
  A_RECEBER: "A receber",
  ATRASADO: "Atrasado",
  PAGO: "Pago",
  PAGO_PARCIAL: "Pago parcial",
};

const COR_STATUS: Record<StatusFixo, { bg: string; fg: string; border: string }> = {
  A_RECEBER: { bg: "rgba(212,175,55,0.20)", fg: "#7a5c1a", border: "rgba(168,137,71,0.5)" },
  ATRASADO: { bg: "rgba(232,138,152,0.20)", fg: "#9b2c3a", border: "rgba(198,103,112,0.5)" },
  PAGO: { bg: "rgba(93,216,182,0.20)", fg: "#1f6f55", border: "rgba(93,216,182,0.4)" },
  PAGO_PARCIAL: { bg: "rgba(197,180,255,0.22)", fg: "#5a4795", border: "rgba(155,135,225,0.5)" },
};

function nomeEmpresa(linha: Linha): string {
  const e = linha.vinculo.conta.empresas[0];
  return e ? e.nomeFantasia || e.razaoSocial : "—";
}

function competenciaLabel(c: string): string {
  const [ano, mes] = c.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

export function ComissoesFixasBloco({
  linhas,
  empresas,
}: {
  linhas: Linha[];
  empresas: { id: string; label: string }[];
}) {
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFixo | "">("");
  const [filtroMes, setFiltroMes] = useState(""); // YYYY-MM

  const filtradas = useMemo(() => {
    return linhas.filter((l) => {
      const e = l.vinculo.conta.empresas[0];
      if (filtroEmpresa && e?.id !== filtroEmpresa) return false;
      if (filtroStatus && l.status !== filtroStatus) return false;
      if (filtroMes && l.competencia !== filtroMes) return false;
      return true;
    });
  }, [linhas, filtroEmpresa, filtroStatus, filtroMes]);

  const mesCorrente = new Date().toISOString().slice(0, 7);
  const anoCorrente = mesCorrente.slice(0, 4);

  const totais = useMemo(() => {
    const base = filtroMes
      ? linhas.filter((l) => l.competencia === filtroMes)
      : linhas.filter((l) => l.competencia === mesCorrente);
    let aReceberMes = 0;
    let atrasadoMes = 0;
    let recebidoMes = 0;
    let saldoAno = 0;
    for (const l of base) {
      if (l.status === "A_RECEBER") aReceberMes += l.valor;
      else if (l.status === "ATRASADO") atrasadoMes += l.valor;
      else if (l.status === "PAGO") recebidoMes += l.valorRecebido || l.valor;
      else if (l.status === "PAGO_PARCIAL") {
        recebidoMes += l.valorRecebido;
        aReceberMes += Math.max(0, l.valor - l.valorRecebido);
      }
    }
    for (const l of linhas.filter((l) => l.competencia.startsWith(anoCorrente))) {
      if (l.status === "PAGO") saldoAno += l.valorRecebido || l.valor;
      else if (l.status === "PAGO_PARCIAL") saldoAno += l.valorRecebido;
    }
    return { aReceberMes, atrasadoMes, recebidoMes, saldoAno };
  }, [linhas, filtroMes, mesCorrente, anoCorrente]);

  return (
    <section className="mt-10">
      <header className="mb-3">
        <h2
          className="text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          Comissão fixa mensal
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
          Gerada automaticamente na virada do mês. Marque o pagamento conforme cada empresa quitar.
        </p>
      </header>

      <div className="mb-3 grid gap-3 md:grid-cols-4">
        <MiniCard
          tone="primary"
          label={filtroMes ? `A receber em ${competenciaLabel(filtroMes)}` : "A receber no mês"}
          valor={totais.aReceberMes}
        />
        <MiniCard tone="coral" label="Atrasado" valor={totais.atrasadoMes} />
        <MiniCard tone="mint" label="Recebido no mês" valor={totais.recebidoMes} />
        <MiniCard tone="lavender" label={`Saldo de ${anoCorrente}`} valor={totais.saldoAno} />
      </div>

      <div className="glass-tile mb-3 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
        <select
          value={filtroEmpresa}
          onChange={(ev) => setFiltroEmpresa(ev.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
        >
          <option value="">Todas empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(ev) => setFiltroStatus(ev.target.value as StatusFixo | "")}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
        >
          <option value="">Todos status</option>
          {(Object.keys(ROTULO_STATUS) as StatusFixo[]).map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
        <input
          type="month"
          value={filtroMes}
          onChange={(ev) => setFiltroMes(ev.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          title="Filtrar por competência (YYYY-MM)"
        />
        {(filtroEmpresa || filtroStatus || filtroMes) && (
          <button
            type="button"
            onClick={() => {
              setFiltroEmpresa("");
              setFiltroStatus("");
              setFiltroMes("");
            }}
            className="text-xs text-slate-600 underline hover:text-slate-900"
          >
            Limpar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {filtradas.length} de {linhas.length}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <div
          className="glass-tile rounded-[20px] p-12 text-center"
          style={{ border: "0.5px dashed var(--hairline)" }}
        >
          <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
            Nenhuma comissão fixa neste filtro.
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
            As linhas do mês são geradas pelo cron diário (06:00 BRT) na primeira passagem depois da virada.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Competência</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Vencimento</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Pagamento</th>
                <th className="px-3 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => (
                <LinhaTabela key={l.id} linha={l} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MiniCard({
  tone,
  label,
  valor,
}: {
  tone: "primary" | "coral" | "mint" | "lavender";
  label: string;
  valor: number;
}) {
  const fg =
    tone === "primary"
      ? "var(--primary-deep)"
      : tone === "coral"
        ? "var(--coral-deep)"
        : tone === "mint"
          ? "var(--mint-deep)"
          : "#5a4795";
  return (
    <div className="glass-tile rounded-xl px-5 py-4">
      <p
        className="text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-[20px] font-extrabold tabular" style={{ color: fg }}>
        {brl(valor)}
      </p>
    </div>
  );
}

function LinhaTabela({ linha: l }: { linha: Linha }) {
  const [modo, setModo] = useState<"view" | "marcar" | "editar">("view");
  const cor = COR_STATUS[l.status];

  const mesAtual = new Date().toISOString().slice(0, 7);
  const ehFuturo = l.competencia > mesAtual;

  if (modo === "marcar") {
    return (
      <tr style={{ background: "rgba(255,205,80,0.10)" }}>
        <td colSpan={7} className="p-3">
          <FormMarcar linha={l} onFechar={() => setModo("view")} />
        </td>
      </tr>
    );
  }
  if (modo === "editar") {
    return (
      <tr style={{ background: "rgba(184,197,214,0.12)" }}>
        <td colSpan={7} className="p-3">
          <FormEditar linha={l} onFechar={() => setModo("view")} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2 text-xs">{nomeEmpresa(l)}</td>
      <td className="px-3 py-2 text-xs text-slate-700">{competenciaLabel(l.competencia)}</td>
      <td className="px-3 py-2 text-right text-xs tabular">
        {brl(l.valor)}
        {l.status === "PAGO_PARCIAL" && (
          <span className="ml-1 text-[10px] text-slate-500">
            (recebido {brl(l.valorRecebido)})
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600">
        {l.vencimento ? l.vencimento.toLocaleDateString("pt-BR") : "—"}
      </td>
      <td className="px-3 py-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            background: cor.bg,
            color: cor.fg,
            border: `0.5px solid ${cor.border}`,
            letterSpacing: "0.06em",
          }}
        >
          {l.status === "PAGO" && <Check className="h-3 w-3" />}
          {ROTULO_STATUS[l.status]}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-slate-600">
        {l.pagaEm ? (
          <>
            {l.pagaEm.toLocaleDateString("pt-BR")}
            {l.comprovanteUrl && (
              <>
                {" · "}
                <a
                  href={l.comprovanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  ver
                </a>
              </>
            )}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setModo("marcar")}
            className="rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-700"
            title="Marcar status (Pago / Pago parcial / A receber / Atrasado)"
          >
            Marcar
          </button>
          <button
            type="button"
            onClick={() => setModo("editar")}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Editar valor / vencimento"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {ehFuturo && (
            <form action={excluirPagamentoFixoAction}>
              <input type="hidden" name="id" value={l.id} />
              <button
                type="submit"
                className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                title="Remover (mês futuro)"
                onClick={(ev) => {
                  if (
                    !window.confirm(
                      `Remover a comissão fixa de ${competenciaLabel(l.competencia)}? A ação será registrada no histórico.`,
                    )
                  ) {
                    ev.preventDefault();
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

function FormMarcar({ linha: l, onFechar }: { linha: Linha; onFechar: () => void }) {
  const [state, formAction] = useActionState(marcarPagamentoFixoAction, null);
  const [statusEscolhido, setStatusEscolhido] = useState<StatusFixo>(l.status);
  useEffect(() => {
    if (state?.ok) onFechar();
  }, [state, onFechar]);

  const exigeValor = statusEscolhido === "PAGO_PARCIAL";
  const exigeData = statusEscolhido === "PAGO" || statusEscolhido === "PAGO_PARCIAL";

  return (
    <form action={formAction} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
      <input type="hidden" name="id" value={l.id} />
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold uppercase tracking-wide text-amber-900">
          Marcar pagamento · {competenciaLabel(l.competencia)} · {nomeEmpresa(l)}
        </span>
        <button
          type="button"
          onClick={onFechar}
          className="rounded p-1 text-amber-900 hover:bg-amber-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-slate-700">Status</span>
          <select
            name="status"
            value={statusEscolhido}
            onChange={(ev) => setStatusEscolhido(ev.target.value as StatusFixo)}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="A_RECEBER">A receber</option>
            <option value="ATRASADO">Atrasado</option>
            <option value="PAGO">Pago</option>
            <option value="PAGO_PARCIAL">Pago parcial</option>
          </select>
        </label>
        {exigeValor && (
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-slate-700">Valor recebido (R$)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={l.valor}
              name="valorRecebido"
              defaultValue={l.valorRecebido || ""}
              required
              className="rounded border border-slate-300 px-2 py-1"
            />
            <span className="text-[10px] text-slate-500">
              Valor combinado: {brl(l.valor)}
            </span>
          </label>
        )}
        {exigeData && (
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-slate-700">Data do pagamento</span>
            <input
              type="date"
              name="dataPagamento"
              defaultValue={
                l.pagaEm?.toISOString().slice(0, 10) ??
                new Date().toISOString().slice(0, 10)
              }
              required
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
        )}
        <label className="col-span-2 flex flex-col gap-1">
          <span className="font-semibold text-slate-700">Observação</span>
          <textarea
            name="observacoes"
            defaultValue={l.observacoes ?? ""}
            rows={2}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        {exigeData && (
          <label className="col-span-2 flex flex-col gap-1">
            <span className="font-semibold text-slate-700">Comprovante (PDF/imagem)</span>
            <input
              type="file"
              name="comprovante"
              accept="application/pdf,image/*"
              className="rounded border border-slate-300 bg-white px-2 py-1"
            />
            {l.comprovanteUrl && (
              <span className="text-[10px] text-slate-500">
                Comprovante atual:{" "}
                <a
                  href={l.comprovanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  ver
                </a>
                . Anexar outro substitui.
              </span>
            )}
          </label>
        )}
      </div>
      {state?.erro && (
        <div className="mt-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{state.erro}</span>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700"
          onClick={(ev) => {
            if (
              (statusEscolhido === "PAGO" || statusEscolhido === "PAGO_PARCIAL") &&
              !window.confirm(
                "Confirma o pagamento? A ação será registrada no histórico.",
              )
            ) {
              ev.preventDefault();
            }
          }}
        >
          <Upload className="h-3 w-3" /> Salvar
        </button>
        <button
          type="button"
          onClick={onFechar}
          className="rounded border border-slate-300 px-3 py-1.5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormEditar({ linha: l, onFechar }: { linha: Linha; onFechar: () => void }) {
  const [state, formAction] = useActionState(atualizarValorVencimentoFixoAction, null);
  useEffect(() => {
    if (state?.ok) onFechar();
  }, [state, onFechar]);

  return (
    <form action={formAction} className="rounded-md border border-slate-300 bg-slate-50 p-3 text-xs">
      <input type="hidden" name="id" value={l.id} />
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold uppercase tracking-wide text-slate-700">
          Editar valor/vencimento · {competenciaLabel(l.competencia)} · {nomeEmpresa(l)}
        </span>
        <button
          type="button"
          onClick={onFechar}
          className="rounded p-1 text-slate-700 hover:bg-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-slate-700">Valor (R$)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="valor"
            defaultValue={l.valor}
            required
            className="rounded border border-slate-300 px-2 py-1"
          />
          <span className="text-[10px] text-slate-500">
            Acordo padrão: {brl(l.vinculo.fixoMensal)}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-slate-700">Vencimento</span>
          <input
            type="date"
            name="vencimento"
            defaultValue={l.vencimento?.toISOString().slice(0, 10) ?? ""}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>
      {state?.erro && (
        <div className="mt-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{state.erro}</span>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="rounded bg-slate-700 px-3 py-1.5 font-bold text-white hover:bg-slate-800"
          onClick={(ev) => {
            if (
              !window.confirm(
                "Alterar valor/vencimento será registrado no histórico. Confirma?",
              )
            ) {
              ev.preventDefault();
            }
          }}
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={onFechar}
          className="rounded border border-slate-300 px-3 py-1.5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
