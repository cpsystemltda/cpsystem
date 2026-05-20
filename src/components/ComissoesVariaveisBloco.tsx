"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, Upload, AlertCircle, X, Bell } from "lucide-react";
import { brl } from "@/lib/validators";
import { labelInstrumento } from "@/lib/instrumentoLabel";
import type { InstrumentoContratual } from "@/generated/prisma/client";
import {
  marcarComissaoExecucaoAction,
  overridePercentualComissaoAction,
} from "@/app/actions/comissaoExecucao";

type StatusComissao =
  | "AGUARDANDO_ORGAO"
  | "A_RECEBER"
  | "ATRASADO"
  | "PAGO"
  | "PAGO_PARCIAL";

type ComissaoLinha = {
  id: string;
  status: StatusComissao;
  percentual: number;
  percentualOverride: boolean;
  observacaoOverride: string | null;
  valorBaseEmpenho: number;
  valorBasePago: number;
  valorCalculado: number;
  valorRecebido: number;
  dataPagamento: Date | null;
  comprovanteUrl: string | null;
  observacao: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  empenho: {
    id: string;
    numero: string;
    objeto: string;
    orgaoNome: string;
    status: string;
    instrumento: InstrumentoContratual;
    dataPagamento: Date | null;
    empresa: {
      id: string;
      razaoSocial: string;
      nomeFantasia: string | null;
    };
    ata: { id: string; numero: string } | null;
    contrato: { id: string; numero: string } | null;
  };
};

type EmpresaOption = { id: string; label: string };

const ROTULO_STATUS: Record<StatusComissao, string> = {
  AGUARDANDO_ORGAO: "Aguardando órgão",
  A_RECEBER: "A receber",
  ATRASADO: "Atrasado",
  PAGO: "Pago",
  PAGO_PARCIAL: "Pago parcial",
};

const COR_STATUS: Record<StatusComissao, { bg: string; fg: string }> = {
  AGUARDANDO_ORGAO: { bg: "rgba(184,197,214,0.18)", fg: "#365175" },
  A_RECEBER: { bg: "rgba(212,175,55,0.20)", fg: "#7a5c1a" },
  ATRASADO: { bg: "rgba(232,138,152,0.20)", fg: "#9b2c3a" },
  PAGO: { bg: "rgba(93,216,182,0.20)", fg: "#1f6f55" },
  PAGO_PARCIAL: { bg: "rgba(197,180,255,0.22)", fg: "#5a4795" },
};

// Simplificação pedida pela Regina: filtro com apenas 2 grupos (cobre os 5
// status reais). "A receber" = qualquer pendente; "Recebido" = qualquer pago.
type FiltroSimples = "" | "a_receber" | "recebido";

function statusEmGrupoARecebido(s: StatusComissao): "a_receber" | "recebido" {
  return s === "PAGO" || s === "PAGO_PARCIAL" ? "recebido" : "a_receber";
}

export function ComissoesVariaveisBloco({
  comissoes,
  empresas,
}: {
  comissoes: ComissaoLinha[];
  empresas: EmpresaOption[];
}) {
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroSimples>("");
  const [filtroMes, setFiltroMes] = useState(""); // YYYY-MM
  // Origem: "" (todos), "direto", "ata:<id>", "contrato:<id>"
  const [filtroOrigem, setFiltroOrigem] = useState("");

  // Lista única de documentos de origem presentes nas comissões — popula o
  // dropdown sem repetir Atas/Contratos quando vários empenhos derivam do mesmo.
  const opcoesOrigem = useMemo(() => {
    const atas = new Map<string, string>();
    const contratos = new Map<string, string>();
    let temDireto = false;
    for (const c of comissoes) {
      if (c.empenho.ata) atas.set(c.empenho.ata.id, c.empenho.ata.numero);
      else if (c.empenho.contrato) contratos.set(c.empenho.contrato.id, c.empenho.contrato.numero);
      else temDireto = true;
    }
    const out: { value: string; label: string }[] = [];
    if (temDireto) out.push({ value: "direto", label: "Empenho direto (sem Ata/Contrato)" });
    for (const [id, numero] of atas) out.push({ value: `ata:${id}`, label: `Ata ${numero}` });
    for (const [id, numero] of contratos) out.push({ value: `contrato:${id}`, label: `Contrato ${numero}` });
    return out;
  }, [comissoes]);

  const filtradas = useMemo(() => {
    return comissoes.filter((c) => {
      if (filtroEmpresa && c.empenho.empresa.id !== filtroEmpresa) return false;
      if (filtroStatus && statusEmGrupoARecebido(c.status) !== filtroStatus) return false;
      if (filtroMes && c.dataPagamento) {
        const mes = c.dataPagamento.toISOString().slice(0, 7);
        if (mes !== filtroMes) return false;
      } else if (filtroMes && !c.dataPagamento) {
        return false;
      }
      if (filtroOrigem) {
        if (filtroOrigem === "direto") {
          if (c.empenho.ata || c.empenho.contrato) return false;
        } else if (filtroOrigem.startsWith("ata:")) {
          const ataId = filtroOrigem.slice(4);
          if (!c.empenho.ata || c.empenho.ata.id !== ataId) return false;
        } else if (filtroOrigem.startsWith("contrato:")) {
          const contratoId = filtroOrigem.slice(9);
          if (!c.empenho.contrato || c.empenho.contrato.id !== contratoId) return false;
        }
      }
      return true;
    });
  }, [comissoes, filtroEmpresa, filtroStatus, filtroMes, filtroOrigem]);

  // Comissões liberadas nos últimos 7 dias e ainda não cobradas pelo analista —
  // motor do banner destacado no topo. Aparece independente dos filtros, mas
  // só conta linhas que respeitam o filtro de empresa (analista pode estar
  // focando em uma empresa específica).
  const recentes = useMemo(() => {
    const seteDiasAtras = Date.now() - 7 * 86400000;
    return comissoes.filter((c) => {
      if (filtroEmpresa && c.empenho.empresa.id !== filtroEmpresa) return false;
      if (c.status !== "A_RECEBER" && c.status !== "ATRASADO") return false;
      return c.atualizadoEm.getTime() >= seteDiasAtras;
    });
  }, [comissoes, filtroEmpresa]);
  const recentesValor = recentes.reduce((s, c) => s + c.valorCalculado, 0);

  // Cards agregados sobre o filtro corrente (sem o filtro de mês — esses
  // cards mostram o total atual)
  const baseParaCards = useMemo(() => {
    return comissoes.filter((c) => {
      if (filtroEmpresa && c.empenho.empresa.id !== filtroEmpresa) return false;
      return true;
    });
  }, [comissoes, filtroEmpresa]);

  const cards = useMemo(() => {
    let aguardandoOrgao = 0;
    let aReceber = 0;
    let recebido = 0;
    for (const c of baseParaCards) {
      if (c.status === "AGUARDANDO_ORGAO") {
        aguardandoOrgao += c.valorBaseEmpenho * (c.percentual / 100);
      } else if (c.status === "A_RECEBER" || c.status === "ATRASADO") {
        aReceber += c.valorCalculado;
      } else if (c.status === "PAGO_PARCIAL") {
        aReceber += Math.max(0, c.valorCalculado - c.valorRecebido);
        recebido += c.valorRecebido;
      } else if (c.status === "PAGO") {
        recebido += c.valorRecebido || c.valorCalculado;
      }
    }
    return { aguardandoOrgao, aReceber, recebido };
  }, [baseParaCards]);

  return (
    <section className="mt-10">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Comissões variáveis (por execução)
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
            Cada execução pagar pelo órgão libera sua comissão. Marque como recebido quando a empresa repassar.
          </p>
        </div>
      </header>

      {recentes.length > 0 && (
        <div
          className="mb-4 flex items-start gap-3 rounded-[14px] px-4 py-3"
          style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.20), rgba(212,175,55,0.08))",
            border: "0.5px solid rgba(168,137,71,0.55)",
            color: "var(--text-soft)",
          }}
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--primary-deep)" }} />
          <div className="flex-1">
            <p className="text-sm font-extrabold" style={{ color: "var(--primary-deep)" }}>
              {recentes.length} execução{recentes.length !== 1 ? "ões" : ""} liberada{recentes.length !== 1 ? "s" : ""} nos últimos 7 dias
              {" · "}
              {brl(recentesValor)} pendente{recentes.length !== 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-xs">
              Cliente recebeu do órgão e sua comissão está disponível para cobrança. Marque cada uma como recebida quando a empresa repassar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFiltroStatus("a_receber");
              setFiltroMes("");
              setFiltroOrigem("");
            }}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
          >
            Ver pendentes
          </button>
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MiniCard
          tone="sky"
          label="Aguardando órgão"
          valor={cards.aguardandoOrgao}
          dica="Potencial. Liberado quando órgão pagar a empresa."
        />
        <MiniCard
          tone="primary"
          label="A receber"
          valor={cards.aReceber}
          dica="Empresa já recebeu; comissão pendente de repasse."
        />
        <MiniCard
          tone="mint"
          label="Recebido"
          valor={cards.recebido}
          dica="Todos os repasses já confirmados pela empresa, sem filtro de tempo."
        />
      </div>

      <div className="glass-tile mb-3 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
        <select
          value={filtroEmpresa}
          onChange={(ev) => setFiltroEmpresa(ev.target.value)}
          className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5 text-xs"
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
          onChange={(ev) => setFiltroStatus(ev.target.value as FiltroSimples)}
          className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5 text-xs"
        >
          <option value="">Todos status</option>
          <option value="a_receber">A receber</option>
          <option value="recebido">Recebido</option>
        </select>
        <input
          type="month"
          value={filtroMes}
          onChange={(ev) => setFiltroMes(ev.target.value)}
          className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5 text-xs"
          title="Filtrar por mês do pagamento da comissão"
        />
        {opcoesOrigem.length > 1 && (
          <select
            value={filtroOrigem}
            onChange={(ev) => setFiltroOrigem(ev.target.value)}
            className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5 text-xs"
            title="Filtrar por documento de origem do empenho"
          >
            <option value="">Toda origem</option>
            {opcoesOrigem.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {(filtroEmpresa || filtroStatus || filtroMes || filtroOrigem) && (
          <button
            type="button"
            onClick={() => {
              setFiltroEmpresa("");
              setFiltroStatus("");
              setFiltroMes("");
              setFiltroOrigem("");
            }}
            className="text-xs text-slate-600 underline hover:text-slate-900"
          >
            Limpar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {filtradas.length} de {comissoes.length}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <div
          className="glass-tile rounded-[20px] p-12 text-center"
          style={{ border: "0.5px dashed var(--hairline)" }}
        >
          <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
            Nenhuma comissão neste filtro.
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
            Quando uma empresa cadastrar um empenho com você como analista, a linha aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtradas.map((c) => (
            <ItemComissao key={c.id} comissao={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MiniCard({
  tone,
  label,
  valor,
  dica,
}: {
  tone: "mint" | "primary" | "sky";
  label: string;
  valor: number;
  dica: string;
}) {
  const fg =
    tone === "mint"
      ? "var(--mint-deep)"
      : tone === "primary"
        ? "var(--primary-deep)"
        : "#365175";
  return (
    <div className="glass-tile rounded-xl px-5 py-4">
      <p
        className="text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-[22px] font-extrabold tabular" style={{ color: fg }}>
        {brl(valor)}
      </p>
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-mute)" }}>
        {dica}
      </p>
    </div>
  );
}

function ItemComissao({ comissao: c }: { comissao: ComissaoLinha }) {
  const [expandido, setExpandido] = useState(false);
  const [overrideAberto, setOverrideAberto] = useState(false);
  // Linha A "paga" para fins desse painel = empenho.status PAGO (ou já além)
  const orgaoPagou = c.empenho.status === "PAGO";
  const empresa = c.empenho.empresa;
  const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial;

  const cor = COR_STATUS[c.status];

  return (
    <li className="glass-tile rounded-xl px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/execucao/${c.empenho.id}`}
              className="text-sm font-extrabold text-slate-900 hover:underline"
            >
              {labelInstrumento(c.empenho.instrumento)} {c.empenho.numero}
            </Link>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{
                background: cor.bg,
                color: cor.fg,
                letterSpacing: "0.08em",
              }}
            >
              {ROTULO_STATUS[c.status]}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-600">
            {nomeEmpresa} · {c.empenho.orgaoNome}
            {c.empenho.ata && (
              <>
                {" · "}
                <Link
                  href={`/atas/${c.empenho.ata.id}`}
                  className="underline hover:text-slate-900"
                >
                  Ata {c.empenho.ata.numero}
                </Link>
              </>
            )}
            {c.empenho.contrato && (
              <>
                {" · "}
                <Link
                  href={`/contratos/${c.empenho.contrato.id}`}
                  className="underline hover:text-slate-900"
                >
                  Contrato {c.empenho.contrato.numero}
                </Link>
              </>
            )}
          </p>

          {/* Resumo do pagamento do órgão à empresa — discreto, só pra contexto */}
          <p className="mt-2 text-[11px] text-slate-500">
            {orgaoPagou ? (
              <>
                <Check className="mr-0.5 inline-block h-3 w-3 text-emerald-600" />
                Órgão pagou {brl(c.valorBasePago)} à empresa
                {c.empenho.dataPagamento &&
                  ` em ${c.empenho.dataPagamento.toLocaleDateString("pt-BR")}`}
              </>
            ) : (
              <>
                <Clock className="mr-0.5 inline-block h-3 w-3 text-slate-400" />
                Órgão ainda não pagou — empenho de {brl(c.valorBaseEmpenho)}
              </>
            )}
          </p>

          {/* Sua comissão — bloco destacado */}
          <div
            className="mt-3 rounded-[12px] border-2 px-4 py-3"
            style={{
              borderColor: cor.fg,
              background: cor.bg,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className="text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.14em", color: cor.fg }}
                >
                  Sua comissão · {c.percentual}%
                  {c.percentualOverride && (
                    <span
                      className="ml-1 rounded-full bg-white/40 px-1.5 py-0.5 text-[9px] font-extrabold"
                      title={c.observacaoOverride ?? "Override aplicado"}
                    >
                      Override
                    </span>
                  )}
                </p>
                <p
                  className="mt-0.5 text-[20px] font-extrabold tabular leading-tight"
                  style={{ color: cor.fg }}
                >
                  {brl(c.valorCalculado)}
                </p>
                {c.status === "PAGO" || c.status === "PAGO_PARCIAL" ? (
                  <p className="mt-0.5 text-[11px]" style={{ color: cor.fg }}>
                    Recebido {brl(c.valorRecebido)} em{" "}
                    {c.dataPagamento?.toLocaleDateString("pt-BR") ?? "—"}
                    {c.comprovanteUrl && (
                      <>
                        {" · "}
                        <a
                          href={c.comprovanteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          ver comprovante
                        </a>
                      </>
                    )}
                  </p>
                ) : c.status === "AGUARDANDO_ORGAO" ? (
                  <p className="mt-0.5 text-[11px]" style={{ color: cor.fg }}>
                    Liberado quando o órgão pagar a empresa.
                  </p>
                ) : null}
                {c.observacao && (
                  <p className="mt-1 text-[11px] italic" style={{ color: cor.fg }}>
                    &ldquo;{c.observacao}&rdquo;
                  </p>
                )}
              </div>
              {!expandido && c.status !== "AGUARDANDO_ORGAO" && (
                <button
                  type="button"
                  onClick={() => {
                    setExpandido(true);
                    setOverrideAberto(false);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-bold text-white transition ${
                    c.status === "PAGO" || c.status === "PAGO_PARCIAL"
                      ? "bg-slate-600 hover:bg-slate-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {c.status === "PAGO" || c.status === "PAGO_PARCIAL"
                    ? "Editar / desfazer"
                    : "Marcar como recebido"}
                </button>
              )}
              {expandido && (
                <button
                  type="button"
                  onClick={() => setExpandido(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <X className="h-3 w-3" /> Fechar
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {c.status !== "PAGO" && (
              <button
                type="button"
                onClick={() => {
                  setOverrideAberto(!overrideAberto);
                  if (!overrideAberto) setExpandido(false);
                }}
                className="text-slate-700 underline hover:text-slate-900"
                title="Alterar o percentual desta execução com justificativa"
              >
                {overrideAberto ? "Fechar % " : "Ajustar %"}
              </button>
            )}
          </div>

          {expandido && (
            <FormMarcar
              comissao={c}
              orgaoPagou={orgaoPagou}
              onFechar={() => setExpandido(false)}
            />
          )}
          {overrideAberto && (
            <FormOverride
              comissao={c}
              onFechar={() => setOverrideAberto(false)}
            />
          )}
        </div>
      </div>
    </li>
  );
}

function FormMarcar({
  comissao: c,
  orgaoPagou,
  onFechar,
}: {
  comissao: ComissaoLinha;
  orgaoPagou: boolean;
  onFechar: () => void;
}) {
  const [state, formAction] = useActionState(marcarComissaoExecucaoAction, null);
  const [statusEscolhido, setStatusEscolhido] = useState<StatusComissao>(c.status);
  useEffect(() => {
    if (state?.ok) onFechar();
  }, [state, onFechar]);

  const podeMarcarPago = orgaoPagou; // só libera se Linha A está paga
  const exigeValor = statusEscolhido === "PAGO_PARCIAL";
  const exigeData = statusEscolhido === "PAGO" || statusEscolhido === "PAGO_PARCIAL";

  return (
    <form
      action={formAction}
      className="glass-tile mt-3 rounded-[14px] p-4 text-xs"
      style={{
        background: "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06)), rgba(255,255,255,0.6)",
      }}
    >
      <input type="hidden" name="id" value={c.id} />
      <div className="mb-3 flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.16em", color: "var(--primary-deep)" }}
        >
          Atualizar status da sua comissão
        </span>
        <button
          type="button"
          onClick={onFechar}
          className="rounded p-1 transition hover:opacity-70"
          style={{ color: "var(--primary-deep)" }}
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
            onChange={(ev) => setStatusEscolhido(ev.target.value as StatusComissao)}
            className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5"
          >
            <option value="A_RECEBER">A receber</option>
            <option value="ATRASADO">Atrasado</option>
            <option value="PAGO" disabled={!podeMarcarPago}>
              Pago {!podeMarcarPago && "(órgão ainda não pagou)"}
            </option>
            <option value="PAGO_PARCIAL" disabled={!podeMarcarPago}>
              Pago parcial {!podeMarcarPago && "(órgão ainda não pagou)"}
            </option>
          </select>
        </label>
        {exigeValor && (
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-slate-700">Valor recebido (R$)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={c.valorCalculado}
              name="valorRecebido"
              defaultValue={c.valorRecebido || ""}
              required
              className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5"
            />
            <span className="text-[10px] text-slate-500">
              Comissão devida: {brl(c.valorCalculado)}
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
                c.dataPagamento?.toISOString().slice(0, 10) ??
                new Date().toISOString().slice(0, 10)
              }
              required
              className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5"
            />
          </label>
        )}
        <label className="col-span-2 flex flex-col gap-1">
          <span className="font-semibold text-slate-700">Observação</span>
          <textarea
            name="observacao"
            defaultValue={c.observacao ?? ""}
            rows={2}
            className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5"
          />
        </label>
        {exigeData && (
          <label className="col-span-2 flex flex-col gap-1">
            <span className="font-semibold text-slate-700">Comprovante (PDF ou imagem)</span>
            <input
              type="file"
              name="comprovante"
              accept="application/pdf,image/*"
              className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5"
            />
            {c.comprovanteUrl && (
              <span className="text-[10px] text-slate-500">
                Comprovante atual:{" "}
                <a
                  href={c.comprovanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  ver
                </a>
                . Anexar outro arquivo substitui.
              </span>
            )}
          </label>
        )}
      </div>

      {state?.erro && (
        <div className="mt-2 flex items-start gap-2 rounded-[10px] px-3 py-1.5 text-[color:var(--coral-deep)] bg-[rgba(232,138,152,0.10)] border-[0.5px] border-[rgba(232,138,152,0.30)]">
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
                "Confirma o pagamento da comissão? A ação será registrada no histórico.",
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
          className="rounded-[10px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-3 py-1.5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormOverride({
  comissao: c,
  onFechar,
}: {
  comissao: ComissaoLinha;
  onFechar: () => void;
}) {
  const [state, formAction] = useActionState(overridePercentualComissaoAction, null);
  const [novoPct, setNovoPct] = useState<number>(c.percentual);
  useEffect(() => {
    if (state?.ok) onFechar();
  }, [state, onFechar]);

  const valorNovo = c.valorBasePago * (novoPct / 100);
  // Base do override é o valorBasePago (valor que o órgão pagou). Antes
  // disso, mostramos o que SERIA quando o órgão pagar — só pra dar contexto.
  const valorReferencia =
    c.valorBasePago > 0 ? c.valorBasePago : c.valorBaseEmpenho;
  const valorPreviewQuandoPago =
    c.valorBasePago === 0 ? valorReferencia * (novoPct / 100) : null;

  return (
    <form
      action={formAction}
      className="glass-tile mt-3 rounded-[14px] p-4 text-xs"
    >
      <input type="hidden" name="id" value={c.id} />
      <div className="mb-3 flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.16em", color: "var(--primary-deep)" }}
        >
          Ajustar percentual desta execução
        </span>
        <button
          type="button"
          onClick={onFechar}
          className="rounded p-1 transition hover:opacity-70"
          style={{ color: "var(--text-soft)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mb-2 text-[11px] text-slate-600">
        Override afeta só esta execução; não altera o percentual padrão do vínculo.
        A justificativa fica no histórico.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-slate-700">Novo percentual (%)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            name="percentual"
            value={novoPct}
            onChange={(ev) => setNovoPct(Number(ev.target.value) || 0)}
            required
            className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-slate-700">Valor calculado</span>
          <div className="rounded bg-white px-2 py-1 text-slate-700">
            {c.valorBasePago > 0 ? (
              <span className="font-bold tabular">{brl(valorNovo)}</span>
            ) : (
              <span className="text-slate-500">
                Quando órgão pagar: {brl(valorPreviewQuandoPago ?? 0)}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            Atual: {c.percentual}% · {brl(c.valorCalculado)}
          </span>
        </div>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="font-semibold text-slate-700">Justificativa (obrigatória)</span>
          <textarea
            name="observacaoOverride"
            defaultValue={c.observacaoOverride ?? ""}
            rows={2}
            required
            placeholder="Ex: cliente negociou redução temporária; acordo verbal por e-mail em 12/05."
            className="rounded-[8px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-2.5 py-1.5"
          />
        </label>
      </div>

      {state?.erro && (
        <div className="mt-2 flex items-start gap-2 rounded-[10px] px-3 py-1.5 text-[color:var(--coral-deep)] bg-[rgba(232,138,152,0.10)] border-[0.5px] border-[rgba(232,138,152,0.30)]">
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
                "Confirma o ajuste? A mudança fica registrada no histórico.",
              )
            ) {
              ev.preventDefault();
            }
          }}
        >
          Salvar ajuste
        </button>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-[10px] border-[0.5px] border-[color:var(--hairline)] bg-white/70 px-3 py-1.5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
