"use client";
import { ROTULO_STATUS, type StatusCompetencia } from "@/lib/competencias";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, FileText, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { brl } from "@/lib/validators";
import { dataBrDia, rotuloCompetencia } from "@/lib/competencias";
import {
  FATOS_GERADORES,
  GARANTIAS_VERBAS,
  ROTULO_FATO_GERADOR,
  ROTULO_GARANTIA_VERBAS,
  ROTULO_STATUS_PEDIDO,
  STATUS_PEDIDO,
  rubricasDe,
  totalPct,
  type Rat,
  type StatusPedido,
} from "@/lib/contaVinculada";
import type { ResumoContaVinculada } from "@/lib/contaVinculadaServer";
import {
  definirGarantiaVerbasAction,
  excluirExtratoAction,
  excluirPedidoLiberacaoAction,
  gerarMinutaLiberacaoAction,
  mudarStatusPedidoAction,
  recalcularRetencoesAction,
  registrarExtratoAction,
  salvarMinutaLiberacaoAction,
  salvarPedidoLiberacaoAction,
  salvarPercentuaisContratoAction,
} from "@/app/actions/contaVinculada";

/**
 * Aba "Conta vinculada" do contrato de mão de obra (ESP-006). Dinheiro da
 * empresa parado no órgão: quanto foi retido, quanto já foi liberado, o que
 * o banco diz, e os pedidos de liberação no tempo certo.
 */

type Msg = { ok?: boolean; erro?: string; mensagem?: string; texto?: string } | null;

const COR_PEDIDO: Record<StatusPedido, string> = {
  RASCUNHO: "bg-slate-100 text-slate-700",
  PROTOCOLADO: "bg-sky-100 text-sky-800",
  EM_ANALISE: "bg-amber-100 text-amber-900",
  DEFERIDO_PARCIAL: "bg-emerald-100 text-emerald-800",
  DEFERIDO: "bg-emerald-600 text-white",
  INDEFERIDO: "bg-red-100 text-red-800",
};

export function ContaVinculadaTab({ contratoId, resumo, podeEditar, hojeIso }: { contratoId: string; resumo: ResumoContaVinculada; podeEditar: boolean; hojeIso: string }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const [form, setForm] = useState<"pedido" | "extrato" | "percentuais" | "garantia" | null>(null);
  const [pedidoEdit, setPedidoEdit] = useState<ResumoContaVinculada["pedidos"][number] | null>(null);
  const semGarantia = !resumo.garantia;
  const ativo = resumo.garantia === "CONTA_VINCULADA" || resumo.garantia === "FATO_GERADOR";
  const rotuloSaldo = resumo.fatoGerador ? "Provisionado não pago pelo órgão" : "Saldo estimado da conta";

  function rodar(fn: () => Promise<Msg>) {
    setErro(null);
    start(async () => {
      const r = await fn();
      if (r?.erro) setErro(r.erro);
      else {
        if (r?.mensagem) setAviso(r.mensagem);
        router.refresh();
      }
    });
  }
  const ok = (m: string) => {
    setForm(null);
    setPedidoEdit(null);
    setAviso(m);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {aviso && (
        <p className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" /> {aviso}
          </span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}
      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{erro}</p>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Conta vinculada e verbas trabalhistas</h3>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-600">
            {resumo.garantia ? (
              <>
                Garantia: <strong>{ROTULO_GARANTIA_VERBAS[resumo.garantia as keyof typeof ROTULO_GARANTIA_VERBAS] ?? resumo.garantia}</strong>
                {resumo.garantiaOutra ? ` (${resumo.garantiaOutra})` : ""} · RAT {resumo.rat}% · percentuais {resumo.fontePercentuais === "CONTRATO" ? "próprios do contrato" : "da tabela-padrão (Anexo XII, IN 5/2017)"} · total {resumo.totalPct}%
              </>
            ) : (
              "Informe como o órgão garante as verbas trabalhistas deste contrato: conta-depósito vinculada, pagamento pelo fato gerador, nenhuma ou outra."
            )}
          </p>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary inline-flex" onClick={() => setForm(form === "garantia" ? null : "garantia")}>
              {semGarantia ? "Definir garantia" : "Garantia / RAT"}
            </button>
            {ativo && (
              <>
                <button type="button" className="btn-secondary inline-flex" onClick={() => setForm(form === "percentuais" ? null : "percentuais")}>
                  Percentuais
                </button>
                <button type="button" className="btn-secondary inline-flex" disabled={pendente} onClick={() => rodar(() => recalcularRetencoesAction(contratoId))} title="Recalcula a estimativa das competências não pagas pelas planilhas de custos">
                  <RefreshCw className="h-4 w-4" /> Recalcular
                </button>
                <button type="button" className="btn-secondary inline-flex" onClick={() => setForm(form === "extrato" ? null : "extrato")}>
                  <Plus className="h-4 w-4" /> Extrato
                </button>
                <button type="button" className="btn-primary inline-flex" onClick={() => { setPedidoEdit(null); setForm(form === "pedido" ? null : "pedido"); }}>
                  <Plus className="h-4 w-4" /> Pedido de liberação
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {form === "garantia" && <FormGarantia contratoId={contratoId} resumo={resumo} onFechar={() => setForm(null)} onOk={ok} />}
      {form === "percentuais" && ativo && <FormPercentuais contratoId={contratoId} resumo={resumo} onFechar={() => setForm(null)} onOk={ok} />}
      {form === "extrato" && ativo && <FormExtrato contratoId={contratoId} hojeIso={hojeIso} onFechar={() => setForm(null)} onOk={ok} />}
      {form === "pedido" && ativo && <FormPedido contratoId={contratoId} hojeIso={hojeIso} inicial={pedidoEdit} onFechar={() => { setForm(null); setPedidoEdit(null); }} onOk={ok} />}

      {!ativo ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-600">
          {semGarantia ? "Sem garantia definida, nada é estimado aqui." : "Este contrato não tem conta vinculada nem pagamento pelo fato gerador: nada a acompanhar nesta aba."}
        </div>
      ) : (
        <>
          {resumo.alertas.length > 0 && (
            <ul className="space-y-1.5">
              {resumo.alertas.map((a, i) => (
                <li key={i} className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm ${a.grave ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {a.texto}
                </li>
              ))}
            </ul>
          )}

          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <Card rotulo={resumo.fatoGerador ? "Provisionado (meses pagos)" : "Retido (meses pagos)"} valor={brl(resumo.saldo.retido)} />
            <Card rotulo="A reter (faturado, não pago)" valor={brl(resumo.saldo.aReter)} />
            <Card rotulo="Liberado (deferidos)" valor={brl(resumo.saldo.liberado)} />
            <Card rotulo="Rendimentos informados" valor={brl(resumo.saldo.rendimentos)} />
            <Card rotulo={rotuloSaldo} valor={brl(resumo.saldo.saldo)} forte />
            <Card
              rotulo={resumo.ultimoExtrato ? `Saldo do banco (${dataBrDia(resumo.ultimoExtrato.dataSaldo)})` : "Saldo do banco"}
              valor={resumo.ultimoExtrato ? brl(resumo.ultimoExtrato.saldoBanco) : "—"}
              sub={resumo.diferenca != null ? `diferença ${resumo.diferenca >= 0 ? "+" : "−"}${brl(Math.abs(resumo.diferenca))}` : "registre um extrato"}
              destaque={resumo.diferenca != null && Math.abs(resumo.diferenca) > 0.05}
            />
          </dl>

          {resumo.encerramento.ativo && (
            <div className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800">
              <p className="font-semibold">Encerramento da vigência {resumo.encerramento.diasParaFim <= 0 ? "(já encerrada)" : `em ${resumo.encerramento.diasParaFim} dias`} — pendências</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {resumo.encerramento.pendencias.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Percentuais */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Rubricas e percentuais {resumo.fontePercentuais === "CONTRATO" ? "(próprios do contrato)" : "(tabela-padrão)"}</h4>
            </header>
            <table className="w-full text-sm">
              <tbody>
                {rubricasDe(resumo.percentuais, resumo.rat).map((r) => (
                  <tr key={r.codigo} className="border-t border-slate-100">
                    <td className="px-4 py-1.5 text-slate-700">{r.rotulo}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{r.pct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-4 py-1.5">Total sobre a remuneração</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{resumo.totalPct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Retenções por competência */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Retenção por competência</h4>
              <p className="text-[11px] text-slate-500">Estimada pelas planilhas de custos (salário-base × colaboradores × percentuais). O valor do comprovante, quando informado na competência, prevalece.</p>
            </header>
            {resumo.retencoes.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Nenhuma competência ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Competência</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                    <th className="px-4 py-2 text-right font-semibold">Estimada</th>
                    <th className="px-4 py-2 text-right font-semibold">Informada</th>
                    <th className="px-4 py-2 text-right font-semibold">Conta</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.retencoes.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-1.5">
                        <Link href={`/competencias/${r.id}`} className="font-medium text-slate-900 hover:underline">
                          {rotuloCompetencia(r.competencia)}
                        </Link>
                        {r.semPlanilha.length > 0 && (
                          <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900" title={`Sem planilha de custos: ${r.semPlanilha.join(", ")}`}>
                            {r.semPlanilha.length} função(ões) sem planilha
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-slate-600">{ROTULO_STATUS[r.status as StatusCompetencia] ?? r.status}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{r.estimada != null ? brl(r.estimada) : <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{r.informada != null ? brl(r.informada) : <span className="text-slate-400">—</span>}</td>
                      <td className={`px-4 py-1.5 text-right tabular-nums ${r.status === "PAGA" ? "font-semibold text-slate-900" : "text-slate-400"}`}>{r.status === "PAGA" ? brl(r.efetiva) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Pedidos */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Pedidos de liberação</h4>
            </header>
            {resumo.pedidos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Nenhum pedido ainda. Férias, 13º e rescisões são liberados mediante pedido com os comprovantes.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {resumo.pedidos.map((p) => (
                  <PedidoItem key={p.id} p={p} podeEditar={podeEditar} pendente={pendente} onEditar={() => { setPedidoEdit(p); setForm("pedido"); }} onRodar={rodar} onAviso={(m) => { setAviso(m); router.refresh(); }} />
                ))}
              </ul>
            )}
          </section>

          {/* Extratos */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Extratos da conta vinculada</h4>
            </header>
            {resumo.extratos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Registre o saldo do extrato bancário para comparar com a estimativa.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {resumo.extratos.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <span>
                      {dataBrDia(e.dataSaldo)} · saldo <strong>{brl(e.saldoBanco)}</strong>
                      {e.rendimentos != null ? ` · rendimentos ${brl(e.rendimentos)}` : ""}
                      {e.observacao ? ` · ${e.observacao}` : ""}
                      {e.arquivoUrl && (
                        <a href={e.arquivoUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-700 hover:underline">
                          <FileText className="h-3 w-3" /> extrato
                        </a>
                      )}
                    </span>
                    {podeEditar && (
                      <button type="button" className="text-xs text-red-700 hover:underline" disabled={pendente} onClick={() => confirm("Excluir este extrato?") && rodar(() => excluirExtratoAction(e.id))}>
                        excluir
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Card({ rotulo, valor, sub, forte, destaque }: { rotulo: string; valor: string; sub?: string; forte?: boolean; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${destaque ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className={`mt-0.5 tabular-nums ${forte ? "text-base font-bold text-slate-900" : "font-semibold text-slate-900"}`}>{valor}</dd>
      {sub && <dd className={`text-[11px] ${destaque ? "font-semibold text-amber-900" : "text-slate-500"}`}>{sub}</dd>}
    </div>
  );
}

function useAction<T extends (prev: Msg, fd: FormData) => Promise<Msg>>(action: T, onOk: (m: string) => void) {
  return useActionState(
    async (prev: Msg, fd: FormData) => {
      const r = await action(prev, fd);
      if (r?.ok && r.mensagem) onOk(r.mensagem);
      return r;
    },
    null as Msg,
  );
}

function FormGarantia({ contratoId, resumo, onFechar, onOk }: { contratoId: string; resumo: ResumoContaVinculada; onFechar: () => void; onOk: (m: string) => void }) {
  const [state, action, pending] = useAction(definirGarantiaVerbasAction, onOk);
  const [garantia, setGarantia] = useState(resumo.garantia ?? "CONTA_VINCULADA");
  return (
    <form action={action} className="rounded-xl border border-violet-200 bg-white p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Garantia de verbas trabalhistas</span>
          <select name="garantiaVerbas" className="mt-1 w-full" value={garantia} onChange={(e) => setGarantia(e.target.value)}>
            {GARANTIAS_VERBAS.map((g) => (
              <option key={g} value={g}>
                {ROTULO_GARANTIA_VERBAS[g]}
              </option>
            ))}
          </select>
        </label>
        {garantia === "OUTRA" && (
          <label className="block text-xs sm:col-span-2">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Qual?</span>
            <input name="garantiaVerbasOutra" className="mt-1 w-full" defaultValue={resumo.garantiaOutra ?? ""} />
          </label>
        )}
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">RAT da empresa</span>
          <select name="ratPct" className="mt-1 w-full" defaultValue={String(resumo.rat)}>
            <option value="1">1% (incidência 7,39%)</option>
            <option value="2">2% (7,60%)</option>
            <option value="3">3% (7,82%)</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Alerta de pedido parado (dias)</span>
          <input name="prazoAlertaLiberacaoDias" className="mt-1 w-full" inputMode="numeric" defaultValue={String(resumo.prazoAlertaDias)} />
        </label>
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function FormPercentuais({ contratoId, resumo, onFechar, onOk }: { contratoId: string; resumo: ResumoContaVinculada; onFechar: () => void; onOk: (m: string) => void }) {
  const [state, action, pending] = useAction(salvarPercentuaisContratoAction, onOk);
  const p = resumo.percentuais;
  const [vals, setVals] = useState({ decimoTerceiro: String(p.decimoTerceiro), feriasTerco: String(p.feriasTerco), multaFgts: String(p.multaFgts), incidencia1: String(p.incidencia22["1"]), incidencia2: String(p.incidencia22["2"]), incidencia3: String(p.incidencia22["3"]) });
  const n = (s: string) => Number(s.replace(",", ".")) || 0;
  const total = (rat: Rat) => totalPct({ decimoTerceiro: n(vals.decimoTerceiro), feriasTerco: n(vals.feriasTerco), multaFgts: n(vals.multaFgts), incidencia22: { "1": n(vals.incidencia1), "2": n(vals.incidencia2), "3": n(vals.incidencia3) } }, rat);
  const campos: [keyof typeof vals, string][] = [
    ["decimoTerceiro", "13º salário (%)"],
    ["feriasTerco", "Férias e 1/3 (%)"],
    ["multaFgts", "Multa do FGTS (%)"],
    ["incidencia1", "Incidência 2.2 — RAT 1% (%)"],
    ["incidencia2", "Incidência 2.2 — RAT 2% (%)"],
    ["incidencia3", "Incidência 2.2 — RAT 3% (%)"],
  ];
  return (
    <form action={action} className="rounded-xl border border-violet-200 bg-white p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      <p className="text-sm font-semibold text-slate-900">Percentuais próprios do contrato</p>
      <p className="text-xs text-slate-600">Use quando o edital, o contrato ou a norma do ente fixar percentuais diferentes do Anexo XII da IN 5/2017. Total com RAT {resumo.rat}%: <strong>{total(resumo.rat).toFixed(2)}%</strong>.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {campos.map(([k, rotulo]) => (
          <label key={k} className="block text-xs">
            <span className="font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
            <input name={k} className="mt-1 w-full" inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {resumo.fontePercentuais === "CONTRATO" && (
          <button type="submit" name="voltarPadrao" value="1" className="btn-secondary" disabled={pending}>
            Voltar à tabela-padrão
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar percentuais"}
        </button>
      </div>
    </form>
  );
}

function FormExtrato({ contratoId, hojeIso, onFechar, onOk }: { contratoId: string; hojeIso: string; onFechar: () => void; onOk: (m: string) => void }) {
  const [state, action, pending] = useAction(registrarExtratoAction, onOk);
  return (
    <form action={action} className="rounded-xl border border-violet-200 bg-white p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      <p className="text-sm font-semibold text-slate-900">Extrato da conta vinculada</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Data do saldo</span>
          <input name="dataSaldo" type="date" required className="mt-1 w-full" defaultValue={hojeIso} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Saldo (R$)</span>
          <input name="saldoBanco" required inputMode="decimal" className="mt-1 w-full" placeholder="0,00" />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Rendimentos no período (R$)</span>
          <input name="rendimentos" inputMode="decimal" className="mt-1 w-full" placeholder="0,00" />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Arquivo do extrato</span>
          <input name="arquivo" type="file" accept="application/pdf,image/png,image/jpeg" className="mt-1 w-full text-xs" />
        </label>
        <label className="block text-xs sm:col-span-4">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Observação</span>
          <input name="observacao" className="mt-1 w-full" />
        </label>
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Registrar extrato"}
        </button>
      </div>
    </form>
  );
}

function FormPedido({ contratoId, hojeIso, inicial, onFechar, onOk }: { contratoId: string; hojeIso: string; inicial: ResumoContaVinculada["pedidos"][number] | null; onFechar: () => void; onOk: (m: string) => void }) {
  const [state, action, pending] = useAction(salvarPedidoLiberacaoAction, onOk);
  const [fato, setFato] = useState(inicial?.fatoGerador ?? "FERIAS");
  return (
    <form action={action} className="rounded-xl border border-violet-200 bg-white p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <p className="text-sm font-semibold text-slate-900">{inicial ? "Editar pedido de liberação" : "Novo pedido de liberação"}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Fato gerador</span>
          <select name="fatoGerador" className="mt-1 w-full" value={fato} onChange={(e) => setFato(e.target.value)}>
            {FATOS_GERADORES.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FATO_GERADOR[f]}
              </option>
            ))}
          </select>
        </label>
        {fato === "OUTRO" && (
          <label className="block text-xs">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Qual?</span>
            <input name="fatoGeradorOutro" className="mt-1 w-full" defaultValue={inicial?.fatoGeradorOutro ?? ""} />
          </label>
        )}
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Competência de referência</span>
          <input name="competenciaRef" type="month" className="mt-1 w-full" defaultValue={inicial?.competenciaRef ?? hojeIso.slice(0, 7)} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Valor solicitado (R$)</span>
          <input name="valorSolicitado" required inputMode="decimal" className="mt-1 w-full" defaultValue={inicial ? inicial.valorSolicitado.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Data do pedido</span>
          <input name="dataPedido" type="date" className="mt-1 w-full" defaultValue={inicial ? inicial.dataPedido.slice(0, 10) : hojeIso} />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Colaboradores envolvidos</span>
          <input name="colaboradores" className="mt-1 w-full" defaultValue={inicial?.colaboradores ?? ""} placeholder="Nomes ou quantidade (o cadastro estruturado entra depois)" />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Protocolo</span>
          <input name="protocolo" className="mt-1 w-full" defaultValue={inicial?.protocolo ?? ""} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Situação</span>
          <select name="status" className="mt-1 w-full" defaultValue={inicial?.status ?? "RASCUNHO"}>
            {STATUS_PEDIDO.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS_PEDIDO[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Documentos (vários)</span>
          <input name="arquivos" type="file" multiple accept="application/pdf,image/png,image/jpeg" className="mt-1 w-full text-xs" />
        </label>
        <label className="block text-xs sm:col-span-4">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Observações</span>
          <textarea name="observacoes" rows={2} className="mt-1 w-full" defaultValue={inicial?.observacoes ?? ""} />
        </label>
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : inicial ? "Salvar" : "Registrar pedido"}
        </button>
      </div>
    </form>
  );
}

function PedidoItem({
  p,
  podeEditar,
  pendente,
  onEditar,
  onRodar,
  onAviso,
}: {
  p: ResumoContaVinculada["pedidos"][number];
  podeEditar: boolean;
  pendente: boolean;
  onEditar: () => void;
  onRodar: (fn: () => Promise<Msg>) => void;
  onAviso: (m: string) => void;
}) {
  const [abrirStatus, setAbrirStatus] = useState(false);
  const [abrirMinuta, setAbrirMinuta] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [minuta, setMinuta] = useState(p.minuta ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [stState, stAction, stPending] = useAction(mudarStatusPedidoAction, (m) => { setAbrirStatus(false); onAviso(m); });
  const [, minAction, minPending] = useAction(salvarMinutaLiberacaoAction, onAviso);
  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const r = await gerarMinutaLiberacaoAction(p.id);
      if (r?.erro) setErro(r.erro);
      else if (r?.texto) {
        setMinuta(r.texto);
        onAviso("Minuta gerada. Revise antes de protocolar.");
      }
    } finally {
      setGerando(false);
    }
  }
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {ROTULO_FATO_GERADOR[p.fatoGerador as keyof typeof ROTULO_FATO_GERADOR] ?? p.fatoGerador}
            {p.fatoGeradorOutro ? ` · ${p.fatoGeradorOutro}` : ""}
            {p.competenciaRef ? <span className="font-normal text-slate-600"> · {rotuloCompetencia(p.competenciaRef)}</span> : ""}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR_PEDIDO[p.status as StatusPedido]}`}>{ROTULO_STATUS_PEDIDO[p.status as StatusPedido]}</span>
          </p>
          <p className="text-xs text-slate-600">
            Pedido em {dataBrDia(p.dataPedido)}
            {p.protocolo ? ` · protocolo ${p.protocolo}` : ""}
            {p.colaboradores ? ` · ${p.colaboradores}` : ""}
            {p.valorLiberado != null && p.valorLiberado > 0 ? ` · liberado ${brl(p.valorLiberado)}${p.dataLiberacao ? ` em ${dataBrDia(p.dataLiberacao)}` : ""}` : ""}
          </p>
          {p.documentos.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-2 text-xs">
              {p.documentos.map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                  <FileText className="h-3 w-3" /> {d.nome}
                </a>
              ))}
            </p>
          )}
        </div>
        <p className="text-right text-sm font-bold tabular-nums text-slate-900">{brl(p.valorSolicitado)}</p>
      </div>
      {podeEditar && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button type="button" className="rounded-md border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50" onClick={onEditar}>
            Editar
          </button>
          <button type="button" className="rounded-md border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50" onClick={() => setAbrirStatus((v) => !v)}>
            Situação
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white px-2 py-1 text-violet-800 hover:bg-violet-50" onClick={() => setAbrirMinuta((v) => !v)}>
            <Sparkles className="h-3.5 w-3.5" /> Minuta
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-red-700 hover:bg-red-50" disabled={pendente} onClick={() => confirm("Excluir este pedido?") && onRodar(() => excluirPedidoLiberacaoAction(p.id))}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
      {abrirStatus && (
        <form action={stAction} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
          <input type="hidden" name="id" value={p.id} />
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Situação</span>
            <select name="status" className="mt-1" defaultValue={p.status}>
              {STATUS_PEDIDO.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS_PEDIDO[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Protocolo</span>
            <input name="protocolo" className="mt-1 w-32" defaultValue={p.protocolo ?? ""} />
          </label>
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Valor liberado</span>
            <input name="valorLiberado" className="mt-1 w-32" inputMode="decimal" defaultValue={p.valorLiberado != null ? p.valorLiberado.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""} />
          </label>
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Data da liberação</span>
            <input name="dataLiberacao" type="date" className="mt-1" defaultValue={p.dataLiberacao?.slice(0, 10) ?? ""} />
          </label>
          <button type="submit" className="btn-secondary" disabled={stPending}>
            Salvar
          </button>
          {stState?.erro && <span className="text-red-700">{stState.erro}</span>}
        </form>
      )}
      {abrirMinuta && (
        <form action={minAction} className="mt-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-xs">
          <input type="hidden" name="id" value={p.id} />
          <div className="flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wide text-violet-900">Minuta do pedido</span>
            <button type="button" className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 font-semibold text-white hover:bg-violet-700 disabled:opacity-60" disabled={gerando} onClick={gerar}>
              <Sparkles className="h-3.5 w-3.5" /> {gerando ? "Gerando…" : minuta ? "Gerar outra com IA" : "Gerar com IA"}
            </button>
          </div>
          <textarea name="minuta" rows={minuta ? 14 : 4} className="mt-2 w-full font-mono" value={minuta} onChange={(e) => setMinuta(e.target.value)} placeholder="Texto do requerimento (ou gere com a IA: fundamentação do regime e lista de documentos)" />
          {erro && <p className="mt-1 text-red-700">{erro}</p>}
          <div className="mt-2 flex justify-end">
            <button type="submit" className="btn-secondary" disabled={minPending}>
              Salvar minuta
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
