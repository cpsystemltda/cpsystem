"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, FileText, Link2, Trash2, Undo2, X } from "lucide-react";
import { brl } from "@/lib/validators";
import {
  ETAPAS,
  RETENCOES_PADRAO,
  aplicarRetencoes,
  calcularFaturado,
  dataBrDia,
  indiceStatus,
  rotuloCompetencia,
  type EtapaKey,
} from "@/lib/competencias";
import type { EmpenhoResumo, ResumoCompetencia } from "@/lib/competenciasServer";
import {
  atualizarCompetenciaAction,
  confirmarCompetenciaAction,
  desfazerEtapaAction,
  desvincularEmpenhoAction,
  excluirCompetenciaAction,
  registrarEtapaAction,
  vincularEmpenhoAction,
} from "@/app/actions/competencias";
import { ChipStatusCompetencia } from "@/components/abas/CompetenciasTab";
import { GlosasBloco, type IndicadorImrDto } from "@/components/GlosasBloco";
import { RetencaoCvBloco } from "@/components/RetencaoCvBloco";
import { labelInstrumento } from "@/lib/instrumentoLabel";
import type { InstrumentoContratual } from "@/generated/prisma/client";

type RetencaoForm = { codigo: string; rotulo: string; pct: string; valor: string };

function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s|R\$|%/g, "");
  if (!t) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
}
const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CompetenciaDetalhe({
  c,
  empenhosDoContrato,
  retencoesSugeridas,
  podeEditar,
  ehAdmin,
  hojeIso,
  nomeUsuario,
  itens,
  indicadores,
}: {
  c: ResumoCompetencia;
  empenhosDoContrato: EmpenhoResumo[];
  retencoesSugeridas: { codigo: string; rotulo: string; pct: number | null }[];
  podeEditar: boolean;
  ehAdmin: boolean;
  hojeIso: string;
  nomeUsuario: string;
  /** ESP-005: postos do contrato (para a glosa) e indicadores do IMR. */
  itens: { id: string; descricao: string }[];
  indicadores: IndicadorImrDto[];
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const proximaEtapa = ETAPAS.find((e) => !c.datas[e.key]);
  const [etapaAberta, setEtapaAberta] = useState<EtapaKey | null>(proximaEtapa?.key ?? null);

  function rodar(fn: () => Promise<{ ok?: boolean; erro?: string; mensagem?: string } | null>) {
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

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <Link href={`/contratos/${c.contratoId}?aba=competencias`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Contrato {c.contratoNumero} · Competências
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Competência {rotuloCompetencia(c.competencia)}
            {c.tipo === "COMPLEMENTAR" && <span className="ml-3 align-middle rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold uppercase text-violet-800">complementar</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {c.orgaoNome} · período {dataBrDia(c.periodoInicio)} a {dataBrDia(c.periodoFim)}
            {c.tipo === "REGULAR" ? ` · ${c.diasPeriodo}/${c.diasBase} dias` : c.complementarRef ? ` · ${c.complementarRef}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ChipStatusCompetencia status={c.status} atraso={c.atrasoDias} />
            {c.criadaAutomaticamente && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">criada automaticamente</span>}
          </div>
        </div>
        {ehAdmin && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            onClick={() => {
              const j = prompt("Excluir esta competência? Informe a justificativa (fica no histórico):");
              if (j == null) return;
              rodar(async () => {
                const r = await excluirCompetenciaAction(c.id, j);
                if (r?.ok) router.push(`/contratos/${c.contratoId}?aba=competencias`);
                return r;
              });
            }}
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        )}
      </div>

      {aviso && (
        <p className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" /> {aviso}
          </span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}
      {erro && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{erro}</p>}

      {c.status === "A_CONFIRMAR" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span>
            Gerada retroativamente com o valor previsto do mês. Confira o valor e registre as etapas que já aconteceram; ao confirmar, ela passa a <strong>Em execução</strong>.
          </span>
          {podeEditar && (
            <button type="button" className="btn-primary" disabled={pendente} onClick={() => rodar(() => confirmarCompetenciaAction(c.id))}>
              Confirmar competência
            </button>
          )}
        </div>
      )}
      {c.empenhoInsuficiente && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Empenho insuficiente para a competência.</strong> O saldo dos empenhos vinculados não cobre {brl(c.valorFaturado)}. Peça reforço de empenho ao órgão ou vincule outro empenho abaixo.
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Etapas */}
          <section className="rounded-2xl border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Etapas</h2>
              {podeEditar && indiceStatus(c.status) >= indiceStatus("MEDICAO") && (
                <button type="button" className="inline-flex items-center gap-1 text-xs text-slate-600 hover:underline" disabled={pendente} onClick={() => confirm("Desfazer a última etapa registrada?") && rodar(() => desfazerEtapaAction(c.id))}>
                  <Undo2 className="h-3.5 w-3.5" /> Desfazer última etapa
                </button>
              )}
            </header>
            <ol className="divide-y divide-slate-100">
              {ETAPAS.map((e, i) => {
                const data = c.datas[e.key];
                const feita = !!data;
                const aberta = etapaAberta === e.key;
                return (
                  <li key={e.key} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${feita ? "bg-emerald-600 text-white" : proximaEtapa?.key === e.key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-400"}`}>
                        {feita ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className={`text-sm font-semibold ${feita ? "text-slate-900" : "text-slate-700"}`}>{e.rotulo}</p>
                          {feita ? (
                            <p className="text-xs text-slate-600">
                              {dataBrDia(data!)}
                              {c.responsaveis[e.key] ? ` · ${c.responsaveis[e.key]}` : ""}
                              {c.arquivos[e.key] && (
                                <a href={c.arquivos[e.key]!} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-700 hover:underline">
                                  <FileText className="h-3 w-3" /> anexo
                                </a>
                              )}
                              {e.key === "NF_EMITIDA" && c.numeroNf ? ` · NF ${c.numeroNf}` : ""}
                            </p>
                          ) : podeEditar ? (
                            <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setEtapaAberta(aberta ? null : e.key)}>
                              {aberta ? "fechar" : "registrar"}
                            </button>
                          ) : null}
                        </div>
                        {!feita && <p className="text-xs text-slate-500">{e.ajuda}</p>}
                        {!feita && aberta && podeEditar && (
                          <FormEtapa
                            c={c}
                            etapa={e.key}
                            hojeIso={hojeIso}
                            nomeUsuario={nomeUsuario}
                            retencoesSugeridas={retencoesSugeridas}
                            onOk={(m) => {
                              setAviso(m);
                              // Abre a etapa seguinte, que é a próxima coisa a fazer.
                              setEtapaAberta(ETAPAS[i + 1]?.key ?? null);
                              router.refresh();
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Medição e glosas (ESP-005) */}
          <GlosasBloco c={c} itens={itens} indicadores={indicadores} podeEditar={podeEditar} hojeIso={hojeIso} onAviso={(m) => setAviso(m)} />

          {/* Empenhos */}
          <section className="rounded-2xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Empenhos vinculados</h2>
              <p className="text-xs text-slate-500">A competência consome o saldo do empenho (estimativo ou global). Rateio entre empenhos: informe o valor coberto por cada um.</p>
            </header>
            <div className="px-4 py-3">
              {c.empenhos.length === 0 ? <p className="text-sm text-slate-500">Nenhum empenho vinculado.</p> : (
                <ul className="space-y-2">
                  {c.empenhos.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span>
                        <Link href={`/execucao/${e.id}`} className="font-semibold text-slate-900 hover:underline">
                          {labelInstrumento(e.instrumento as InstrumentoContratual)} {e.numero}
                        </Link>
                        <span className="ml-2 text-xs text-slate-500">
                          valor {brl(e.valorTotal)} · saldo após as competências {brl(e.saldo)}
                          {e.valor != null ? ` · cobre ${brl(e.valor)} desta` : ""}
                        </span>
                      </span>
                      {podeEditar && (
                        <button type="button" className="text-xs text-red-700 hover:underline" disabled={pendente} onClick={() => rodar(() => desvincularEmpenhoAction(c.id, e.id))}>
                          desvincular
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {podeEditar && <FormVincular competenciaId={c.id} jaVinculados={c.empenhos.map((e) => e.id)} empenhos={empenhosDoContrato} onRodar={rodar} pendente={pendente} />}
            </div>
          </section>
        </div>

        {/* Valores */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Valores</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Linha rotulo="Valor mensal vigente" valor={brl(c.valorMensalBase)} sub={c.tipo === "REGULAR" && c.diasPeriodo < c.diasBase ? `pro rata ${c.diasPeriodo}/${c.diasBase} dias` : undefined} />
              <Linha rotulo="Previsto" valor={brl(c.valorPrevisto)} forte />
              <Linha rotulo="Glosas" valor={c.valorGlosas ? `− ${brl(c.valorGlosas)}` : "—"} sub={c.glosas.length ? `${c.glosas.length} registrada(s) em Medição e glosas` : "nenhuma registrada"} />
              <Linha rotulo="Ajustes" valor={c.ajustes ? `${c.ajustes > 0 ? "+" : "−"} ${brl(Math.abs(c.ajustes))}` : "—"} sub={c.ajustesJustificativa ?? undefined} />
              <Linha rotulo={c.faturadoFixado ? "Faturado (NF)" : "Faturado previsto"} valor={brl(c.valorFaturado)} forte />
              {c.retencoes.filter((r) => r.valor).map((r) => (
                <Linha key={r.codigo} rotulo={`Retenção ${r.rotulo.split(" (")[0]}${r.pct ? ` ${fmt(r.pct)}%` : ""}`} valor={`− ${brl(r.valor)}`} />
              ))}
              {c.faturadoFixado && <Linha rotulo="Líquido esperado" valor={brl(c.valorLiquidoEsperado)} forte />}
              {c.valorRecebido != null && <Linha rotulo="Recebido" valor={brl(c.valorRecebido)} forte cor={Math.abs(c.valorRecebido - c.valorLiquidoEsperado) > 0.05 ? "text-amber-700" : "text-emerald-700"} />}
              <Linha
                rotulo="Prazo de pagamento"
                valor={c.prazoPagamento ? dataBrDia(c.prazoPagamento) : "—"}
                sub={c.status === "PAGA" ? (c.pagaComAtraso ? `paga com ${c.atrasoDias} dias de atraso` : "paga no prazo") : c.atrasoDias > 0 ? `vencido há ${c.atrasoDias} dias` : c.prazoPagamento ? undefined : "conta a partir do ateste/recebimento da NF"}
                cor={c.atrasoDias > 0 && c.status !== "PAGA" ? "text-red-700" : undefined}
              />
            </dl>
          </section>

          {(c.garantiaVerbas === "CONTA_VINCULADA" || c.garantiaVerbas === "FATO_GERADOR") && c.tipo === "REGULAR" && (
            <RetencaoCvBloco
              competenciaId={c.id}
              fatoGerador={c.garantiaVerbas === "FATO_GERADOR"}
              estimada={c.retencaoCv.estimada}
              informada={c.retencaoCv.informada}
              detalhe={(c.retencaoCv.detalhe as { porRubrica?: { codigo: string; rotulo: string; pct: number; valor: number }[]; semPlanilha?: string[]; totalPct?: number } | null) ?? null}
              podeEditar={podeEditar}
              onOk={(m) => {
                setAviso(m);
                router.refresh();
              }}
            />
          )}

          {podeEditar && <FormEdicao c={c} onOk={(m) => { setAviso(m); router.refresh(); }} />}

          {c.complementarDetalhe != null && Array.isArray(c.complementarDetalhe) && c.complementarDetalhe.length > 0 && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm">
              <h2 className="text-xs font-bold uppercase tracking-wide text-violet-800">Detalhamento mês a mês</h2>
              <ul className="mt-2 space-y-1 text-violet-950">
                {(c.complementarDetalhe as string[]).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, sub, forte, cor }: { rotulo: string; valor: string; sub?: string; forte?: boolean; cor?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-600">
        {rotulo}
        {sub && <span className="block text-[11px] text-slate-400">{sub}</span>}
      </dt>
      <dd className={`text-right tabular-nums ${forte ? "font-bold" : ""} ${cor ?? "text-slate-900"}`}>{valor}</dd>
    </div>
  );
}

function FormEtapa({
  c,
  etapa,
  hojeIso,
  nomeUsuario,
  retencoesSugeridas,
  onOk,
}: {
  c: ResumoCompetencia;
  etapa: EtapaKey;
  hojeIso: string;
  nomeUsuario: string;
  retencoesSugeridas: { codigo: string; rotulo: string; pct: number | null }[];
  onOk: (m: string) => void;
}) {
  // O aviso ao pai vai dentro da própria action: a revalidação do servidor
  // desmonta este formulário assim que a etapa fica feita, e um efeito
  // daqui nem chegaria a rodar.
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof registrarEtapaAction>>, fd: FormData) => {
      const r = await registrarEtapaAction(prev, fd);
      if (r?.ok && r.mensagem) onOk(r.mensagem);
      return r;
    },
    null,
  );
  const [ajustes, setAjustes] = useState<string>(c.ajustes ? fmt(c.ajustes) : "");
  const base = retencoesSugeridas.length ? retencoesSugeridas : RETENCOES_PADRAO;
  const [ret, setRet] = useState<RetencaoForm[]>(base.map((r) => ({ codigo: r.codigo, rotulo: r.rotulo, pct: r.pct != null ? fmt(r.pct) : "", valor: "" })));

  const faturado = calcularFaturado(c.valorPrevisto, c.valorGlosas, parseNum(ajustes) ?? 0);
  const calc = aplicarRetencoes(
    faturado,
    ret.map((r) => ({ codigo: r.codigo, rotulo: r.rotulo, pct: parseNum(r.pct), valor: parseNum(r.valor) })),
  );

  return (
    <form action={action} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="competenciaId" value={c.id} />
      <input type="hidden" name="etapa" value={etapa} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Data</span>
          <input name="data" type="date" required className="mt-1 w-full" defaultValue={hojeIso} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Responsável</span>
          <input name="responsavel" className="mt-1 w-full" defaultValue={nomeUsuario} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Anexo (PDF/imagem)</span>
          <input name="arquivo" type="file" accept="application/pdf,image/png,image/jpeg" className="mt-1 w-full text-xs" />
        </label>
      </div>

      {etapa === "NF_EMITIDA" && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Número da NF</span>
              <input name="numeroNf" className="mt-1 w-full" placeholder="Ex.: 1234" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Ajustes (±R$)</span>
              <input name="ajustes" className="mt-1 w-full" inputMode="decimal" value={ajustes} onChange={(e) => setAjustes(e.target.value)} placeholder="0,00" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Justificativa do ajuste</span>
              <input name="ajustesJustificativa" className="mt-1 w-full" defaultValue={c.ajustesJustificativa ?? ""} placeholder="obrigatória se houver ajuste" />
            </label>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800">
                Faturado = previsto {brl(c.valorPrevisto)} − glosas {brl(c.valorGlosas)} ± ajustes = <strong>{brl(faturado)}</strong>
              </p>
            </div>
            <p className="mt-2 font-semibold uppercase tracking-wide text-slate-500">Retenções (percentual ou valor informado no comprovante)</p>
            <table className="mt-1 w-full">
              <tbody>
                {ret.map((r, i) => (
                  <tr key={r.codigo} className="border-t border-slate-100">
                    <td className="py-1 pr-2 text-slate-700">{r.rotulo}</td>
                    <td className="w-24 py-1">
                      <input className="w-full !py-1 text-right" inputMode="decimal" placeholder="%" value={r.pct} onChange={(e) => setRet((x) => x.map((y, j) => (j === i ? { ...y, pct: e.target.value } : y)))} />
                    </td>
                    <td className="w-32 py-1 pl-2">
                      <input className="w-full !py-1 text-right" inputMode="decimal" placeholder={fmt(calc.retencoes[i]?.valor ?? 0)} value={r.valor} onChange={(e) => setRet((x) => x.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)))} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-1.5 text-slate-800">Total de retenções</td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums">{brl(calc.total)}</td>
                </tr>
                <tr className="font-bold">
                  <td className="py-1.5 text-slate-900">Líquido esperado</td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums text-emerald-700">{brl(calc.liquido)}</td>
                </tr>
              </tbody>
            </table>
            <input type="hidden" name="retencoes" value={JSON.stringify(ret.map((r) => ({ codigo: r.codigo, rotulo: r.rotulo, pct: parseNum(r.pct), valor: parseNum(r.valor) })))} />
            <p className="mt-1 text-[11px] text-slate-500">Os percentuais ficam guardados no contrato e vêm sugeridos no mês seguinte. O sistema não calcula tributos: registre o que a NF e o comprovante mostrarem.</p>
          </div>
        </div>
      )}

      {etapa === "PAGA" && (
        <label className="mt-3 block text-xs sm:w-60">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Valor recebido (R$)</span>
          <input name="valorRecebido" className="mt-1 w-full" inputMode="decimal" defaultValue={fmt(c.valorLiquidoEsperado)} />
        </label>
      )}

      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : `Registrar: ${ETAPAS.find((e) => e.key === etapa)?.rotulo}`}
        </button>
      </div>
    </form>
  );
}

function FormVincular({ competenciaId, jaVinculados, empenhos, onRodar, pendente }: { competenciaId: string; jaVinculados: string[]; empenhos: EmpenhoResumo[]; onRodar: (fn: () => Promise<{ ok?: boolean; erro?: string } | null>) => void; pendente: boolean }) {
  const [empenhoId, setEmpenhoId] = useState("");
  const [valor, setValor] = useState("");
  const disponiveis = empenhos.filter((e) => !jaVinculados.includes(e.id));
  if (disponiveis.length === 0) return <p className="mt-3 text-xs text-slate-500">{empenhos.length === 0 ? "Cadastre o empenho deste contrato em Fornecimento/Execução para vinculá-lo." : "Todos os empenhos do contrato já estão vinculados."}</p>;
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="block text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Vincular empenho</span>
        <select className="mt-1 min-w-[260px]" value={empenhoId} onChange={(e) => setEmpenhoId(e.target.value)}>
          <option value="">Escolha…</option>
          {disponiveis.map((e) => (
            <option key={e.id} value={e.id}>
              {labelInstrumento(e.instrumento as InstrumentoContratual)} {e.numero} · saldo {brl(e.saldo)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Valor coberto (opcional)</span>
        <input className="mt-1 w-36" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="tudo" />
      </label>
      <button type="button" className="btn-secondary inline-flex" disabled={!empenhoId || pendente} onClick={() => onRodar(() => vincularEmpenhoAction(competenciaId, empenhoId, parseNum(valor)))}>
        <Link2 className="h-4 w-4" /> Vincular
      </button>
    </div>
  );
}

function FormEdicao({ c, onOk }: { c: ResumoCompetencia; onOk: (m: string) => void }) {
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof atualizarCompetenciaAction>>, fd: FormData) => {
      const r = await atualizarCompetenciaAction(prev, fd);
      if (r?.ok && r.mensagem && r.mensagem !== "Nada mudou.") onOk(r.mensagem);
      return r;
    },
    null,
  );
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-slate-700">Editar à mão</summary>
      <p className="mt-1 text-xs text-slate-500">Toda edição fica no histórico do contrato (RN12). Depois da NF o previsto não muda; use uma competência complementar.</p>
      <form action={action} className="mt-3 space-y-3 text-xs">
        <input type="hidden" name="competenciaId" value={c.id} />
        <label className="block">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Valor previsto (R$)</span>
          <input name="valorPrevisto" className="mt-1 w-full" inputMode="decimal" defaultValue={fmt(c.valorPrevisto)} disabled={c.faturadoFixado} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Ajustes (±R$)</span>
            <input name="ajustes" className="mt-1 w-full" inputMode="decimal" defaultValue={c.ajustes ? fmt(c.ajustes) : ""} disabled={c.faturadoFixado} />
          </label>
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Justificativa</span>
            <input name="ajustesJustificativa" className="mt-1 w-full" defaultValue={c.ajustesJustificativa ?? ""} />
          </label>
        </div>
        <label className="block">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Observações</span>
          <textarea name="observacoes" rows={2} className="mt-1 w-full" defaultValue={c.observacoes ?? ""} />
        </label>
        {state?.erro && <p className="text-red-700">{state.erro}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-secondary" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </details>
  );
}
