"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil, UserMinus, EyeOff, Check } from "lucide-react";
import { ROTULO_MOTIVO_FIM, ROTULO_SITUACAO, ROTULO_TIPO_ALOCACAO, type SituacaoColaborador, type TipoAlocacao } from "@/lib/colaboradores";
import { AVISO_SEM_DADOS_DE_SAUDE, formatarCpf } from "@/lib/lgpd";
import { dataBrDia } from "@/lib/competencias";
import type { ColaboradorDto } from "@/lib/colaboradoresServer";
import { anonimizarColaboradorAction, atualizarColaboradorAction, desligarColaboradorAction, encerrarAlocacaoAction, type ResultadoColab } from "@/app/actions/colaboradores";

export function ColaboradorDetalhe({ c, podeEditar, ehAdmin, hojeIso }: { c: ColaboradorDto; podeEditar: boolean; ehAdmin: boolean; hojeIso: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<"ver" | "editar" | "desligar">("ver");
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const [contratosRescisao, setContratosRescisao] = useState<{ id: string; numero: string }[]>([]);
  const [edState, edAction, edPending] = useActionState<ResultadoColab, FormData>(
    async (p, fd) => {
      const r = await atualizarColaboradorAction(p, fd);
      if (r?.ok) {
        setModo("ver");
        setAviso(r.mensagem ?? null);
        router.refresh();
      }
      return r;
    },
    null,
  );
  const [dsState, dsAction, dsPending] = useActionState<ResultadoColab, FormData>(
    async (p, fd) => {
      const r = await desligarColaboradorAction(p, fd);
      if (r?.ok) {
        setModo("ver");
        setAviso(r.mensagem ?? null);
        setContratosRescisao(r.contratos ?? []);
        router.refresh();
      }
      return r;
    },
    null,
  );
  const abertas = c.alocacoes.filter((a) => !a.dataFim);
  const historico = c.alocacoes.filter((a) => a.dataFim);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link href="/colaboradores" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Colaboradores
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{c.nome}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {c.funcao}
            {c.cbo ? ` · CBO ${c.cbo}` : ""}
            {c.jornada ? ` · ${c.jornada}` : ""} · admitido(a) em {dataBrDia(c.dataAdmissao)}
          </p>
          <p className="mt-1 text-sm">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{ROTULO_SITUACAO[c.situacao as SituacaoColaborador]}</span>
            {c.dataDesligamento && <span className="ml-2 text-xs text-slate-500">desligado(a) em {dataBrDia(c.dataDesligamento)}</span>}
            {c.anonimizadoEm && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">anonimizado em {dataBrDia(c.anonimizadoEm)}</span>}
          </p>
        </div>
        {podeEditar && !c.anonimizadoEm && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary inline-flex" onClick={() => setModo(modo === "editar" ? "ver" : "editar")}>
              <Pencil className="h-4 w-4" /> Editar
            </button>
            {c.situacao !== "DESLIGADO" && (
              <button type="button" className="btn-secondary inline-flex" onClick={() => setModo(modo === "desligar" ? "ver" : "desligar")}>
                <UserMinus className="h-4 w-4" /> Desligar
              </button>
            )}
            {ehAdmin && c.situacao === "DESLIGADO" && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                disabled={pendente}
                onClick={() =>
                  confirm("Anonimizar os dados pessoais deste colaborador? Nome, CPF e telefone são apagados; o histórico de alocações fica sem identificação. Não dá para desfazer.") &&
                  start(async () => {
                    const r = await anonimizarColaboradorAction(c.id);
                    if (r?.erro) setErro(r.erro);
                    else {
                      setAviso(r?.mensagem ?? null);
                      router.refresh();
                    }
                  })
                }
              >
                <EyeOff className="h-4 w-4" /> Anonimizar
              </button>
            )}
          </div>
        )}
      </div>

      {aviso && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <Check className="h-4 w-4" /> {aviso}
        </p>
      )}
      {contratosRescisao.length > 0 && (
        <p className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-950">
          Pedido de liberação de rescisão (conta vinculada):{" "}
          {contratosRescisao.map((k) => (
            <Link key={k.id} href={`/contratos/${k.id}?aba=conta-vinculada`} className="mr-2 font-semibold underline">
              contrato {k.numero}
            </Link>
          ))}
        </p>
      )}
      {erro && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{erro}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {modo === "editar" && (
            <form action={edAction} className="rounded-2xl border border-violet-200 bg-white p-4">
              <input type="hidden" name="id" value={c.id} />
              <p className="text-sm font-semibold text-slate-900">Editar ficha</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block text-xs sm:col-span-2">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">Nome</span>
                  <input name="nome" required className="mt-1 w-full" defaultValue={c.nome} />
                </label>
                <label className="block text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">Admissão</span>
                  <input name="dataAdmissao" type="date" required className="mt-1 w-full" defaultValue={c.dataAdmissao.slice(0, 10)} />
                </label>
                <label className="block text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">Função</span>
                  <input name="funcao" required className="mt-1 w-full" defaultValue={c.funcao} />
                </label>
                <label className="block text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">CBO</span>
                  <input name="cbo" className="mt-1 w-full" defaultValue={c.cbo ?? ""} />
                </label>
                <label className="block text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">Jornada / escala</span>
                  <input name="jornada" className="mt-1 w-full" defaultValue={c.jornada ?? ""} />
                </label>
                <label className="block text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">Telefone</span>
                  <input name="telefone" className="mt-1 w-full" defaultValue={c.telefone ?? ""} />
                </label>
                {c.situacao !== "DESLIGADO" && (
                  <label className="block text-xs">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">Situação</span>
                    <select name="situacao" className="mt-1 w-full" defaultValue={c.situacao}>
                      <option value="ATIVO">Ativo</option>
                      <option value="AFASTADO">Afastado (só a situação; sem motivo de saúde)</option>
                    </select>
                  </label>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{AVISO_SEM_DADOS_DE_SAUDE}</p>
              {edState?.erro && <p className="mt-2 text-xs text-red-700">{edState.erro}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setModo("ver")}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={edPending}>
                  {edPending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          )}
          {modo === "desligar" && (
            <form action={dsAction} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <input type="hidden" name="id" value={c.id} />
              <p className="text-sm font-semibold text-slate-900">Registrar desligamento</p>
              <p className="text-xs text-slate-600">As alocações abertas são encerradas na data informada. Se o contrato tem conta vinculada, o sistema sugere abrir o pedido de liberação da rescisão.</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="block text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">Data do desligamento</span>
                  <input name="data" type="date" required className="mt-1" defaultValue={hojeIso} />
                </label>
                <button type="submit" className="btn-primary" disabled={dsPending}>
                  {dsPending ? "Registrando…" : "Confirmar desligamento"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setModo("ver")}>
                  Cancelar
                </button>
              </div>
              {dsState?.erro && <p className="mt-2 text-xs text-red-700">{dsState.erro}</p>}
            </form>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Alocações abertas</h2>
            </header>
            {abertas.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Nenhuma alocação aberta. A alocação é feita no contrato, na aba “Equipe alocada”.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {abertas.map((a) => (
                  <AlocacaoItem key={a.id} a={a} podeEditar={podeEditar} hojeIso={hojeIso} onOk={(m) => { setAviso(m); router.refresh(); }} />
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Histórico de alocações</h2>
              <p className="text-[11px] text-slate-500">Nunca apagado: responde “quem estava neste posto nesta data”.</p>
            </header>
            {historico.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Sem alocações encerradas.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {historico.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-4 py-1.5">
                        <Link href={`/contratos/${a.contratoId}?aba=equipe`} className="font-medium text-slate-900 hover:underline">
                          {a.contratoNumero}
                        </Link>
                        {a.itemDescricao ? <span className="text-slate-600"> · {a.itemDescricao}</span> : ""}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-slate-600">{ROTULO_TIPO_ALOCACAO[a.tipo as TipoAlocacao]}</td>
                      <td className="px-4 py-1.5 text-xs text-slate-600">
                        {dataBrDia(a.dataInicio)} → {a.dataFim ? dataBrDia(a.dataFim) : "aberta"}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-slate-500">{a.motivoFim ? ROTULO_MOTIVO_FIM[a.motivoFim as keyof typeof ROTULO_MOTIVO_FIM] ?? a.motivoFim : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Dados pessoais</h2>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">CPF</dt>
                <dd className="font-mono text-slate-900">{c.cpf ? formatarCpf(c.cpf) : c.cpfMascarado}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Telefone</dt>
                <dd className="text-slate-900">{c.telefone ?? "—"}</dd>
              </div>
              {c.vinculoAnteriorId && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600">Readmissão</dt>
                  <dd>
                    <Link href={`/colaboradores/${c.vinculoAnteriorId}`} className="text-blue-700 hover:underline">
                      vínculo anterior
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-[11px] text-slate-500">CPF guardado cifrado; esta consulta ficou registrada na auditoria (LGPD). Nada de dado de saúde é armazenado.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AlocacaoItem({ a, podeEditar, hojeIso, onOk }: { a: ColaboradorDto["alocacoes"][number]; podeEditar: boolean; hojeIso: string; onOk: (m: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ResultadoColab, FormData>(
    async (p, fd) => {
      const r = await encerrarAlocacaoAction(p, fd);
      if (r?.ok) onOk(r.mensagem ?? "Alocação encerrada.");
      return r;
    },
    null,
  );
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <Link href={`/contratos/${a.contratoId}?aba=equipe`} className="font-semibold text-slate-900 hover:underline">
            {a.contratoNumero}
          </Link>
          {a.itemDescricao ? <span className="text-slate-600"> · {a.itemDescricao}</span> : ""}
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{ROTULO_TIPO_ALOCACAO[a.tipo as TipoAlocacao]}</span>
          <span className="ml-2 text-xs text-slate-500">desde {dataBrDia(a.dataInicio)}</span>
        </span>
        {podeEditar && (
          <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setAberto((v) => !v)}>
            encerrar
          </button>
        )}
      </div>
      {aberto && (
        <form action={action} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="contratoId" value={a.contratoId} />
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Fim</span>
            <input name="dataFim" type="date" required className="mt-1" defaultValue={hojeIso} />
          </label>
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Motivo</span>
            <select name="motivo" className="mt-1" defaultValue="TROCA">
              {Object.entries(ROTULO_MOTIVO_FIM).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-secondary" disabled={pending}>
            Encerrar
          </button>
          {state?.erro && <span className="text-red-700">{state.erro}</span>}
        </form>
      )}
    </li>
  );
}
