"use client";

import { useActionState, useState, useTransition } from "react";
import { Ticket, Plus, Copy, Check, Power, PowerOff, Pencil, X } from "lucide-react";
import { criarCupomAction, editarCupomAction, toggleCupomAtivoAction } from "@/app/actions/cupom";

type CupomItem = {
  id: string;
  codigo: string;
  descricao: string | null;
  diasTrial: number;
  analistaVinculado: string | null;
  validoAte: string | null;
  usosMaximos: number | null;
  usosAtuais: number;
  ativo: boolean;
  criadoEm: string;
  criadoPor: string | null;
  contasAplicadas: number;
};

export function CuponsClient({
  cupons,
  analistas,
}: {
  cupons: CupomItem[];
  analistas: { id: string; nomeCompleto: string }[];
}) {
  const [showForm, setShowForm] = useState(cupons.length === 0);
  const [state, formAction] = useActionState(criarCupomAction, null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [togglando, startToggle] = useTransition();
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Botão criar novo */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          <strong>{cupons.length}</strong> cupom(ns) cadastrado(s) —{" "}
          <strong>{cupons.filter((c) => c.ativo).length}</strong> ativo(s)
        </p>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> {showForm ? "Fechar" : "Criar cupom"}
        </button>
      </div>

      {/* Form criação */}
      {showForm && (
        <form
          action={formAction}
          className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6 space-y-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-violet-900">
            <Ticket className="h-4 w-4" /> Novo cupom
          </h3>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Código (opcional — se vazio, gera aleatório)
              <input
                name="codigo"
                type="text"
                placeholder="IGOR60"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-violet-400"
                maxLength={32}
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Prefixo pra geração automática (opcional)
              <input
                name="prefixo"
                type="text"
                placeholder="Ex: IGOR"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-violet-400"
                maxLength={8}
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Descrição (interno)
            <input
              name="descricao"
              type="text"
              placeholder="Ex: Cliente novo do Igor — fornecedor de produtos"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">
              Dias de trial (1-365)
              <input
                name="diasTrial"
                type="number"
                min={1}
                max={365}
                defaultValue={60}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Válido até (opcional)
              <input
                name="validoAte"
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Usos máximos (vazio = ilimitado)
              <input
                name="usosMaximos"
                type="number"
                min={1}
                placeholder="Ex: 1"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Analista vinculado (opcional — se setado, cliente que usar o cupom fica vinculado a esse analista)
            <select
              name="analistaVinculadoId"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="">— Nenhum —</option>
              {analistas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nomeCompleto}
                </option>
              ))}
            </select>
          </label>

          {state?.erro && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">{state.erro}</div>
          )}
          {state?.ok && (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              ✓ Cupom criado. Copie o código da lista abaixo e passe pro cliente.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700"
            >
              Criar cupom
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {cupons.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Nenhum cupom criado ainda. Clica em <strong>Criar cupom</strong> pra gerar o primeiro.
          </div>
        )}
        {cupons.map((c) => {
          const linkSignup = `https://cpsystem.app.br/signup?cupom=${c.codigo}`;
          const emEdicao = editandoId === c.id;
          return (
            <div
              key={c.id}
              className={`rounded-xl border ${
                c.ativo ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
              } p-4`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className={`rounded bg-violet-100 px-2 py-0.5 text-sm font-bold ${c.ativo ? "text-violet-800" : "text-slate-500 line-through"}`}>
                      {c.codigo}
                    </code>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                      {c.diasTrial}d trial
                    </span>
                    {c.analistaVinculado && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                        Analista: {c.analistaVinculado}
                      </span>
                    )}
                    {!c.ativo && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        Desativado
                      </span>
                    )}
                  </div>
                  {c.descricao && <p className="mt-1 text-xs text-slate-600">{c.descricao}</p>}
                  <p className="mt-1 text-[11px] text-slate-500">
                    Usos: <strong>{c.usosAtuais}</strong>
                    {c.usosMaximos ? ` / ${c.usosMaximos}` : ""} · Contas: {c.contasAplicadas}
                    {c.validoAte && ` · Válido até ${new Date(c.validoAte).toLocaleDateString("pt-BR")}`}
                    {c.criadoPor && ` · Criado por ${c.criadoPor}`}
                  </p>
                  <div className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-mono text-slate-600 break-all">
                    {linkSignup}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => copiar(linkSignup)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                    title="Copiar link do signup"
                  >
                    {copiado === linkSignup ? (
                      <>
                        <Check className="h-3 w-3" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => copiar(c.codigo)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                    title="Copiar só o código"
                  >
                    {copiado === c.codigo ? (
                      <>
                        <Check className="h-3 w-3" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Código
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(emEdicao ? null : c.id)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-white ${
                      emEdicao ? "bg-slate-600 hover:bg-slate-700" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                    title="Editar cupom"
                  >
                    {emEdicao ? (
                      <>
                        <X className="h-3 w-3" /> Fechar
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3 w-3" /> Editar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={togglando}
                    onClick={() =>
                      startToggle(async () => {
                        await toggleCupomAtivoAction(c.id);
                      })
                    }
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-white ${
                      c.ativo ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {c.ativo ? (
                      <>
                        <PowerOff className="h-3 w-3" /> Desativar
                      </>
                    ) : (
                      <>
                        <Power className="h-3 w-3" /> Ativar
                      </>
                    )}
                  </button>
                </div>
              </div>
              {emEdicao && (
                <FormEditarCupom
                  cupom={c}
                  analistas={analistas}
                  onDone={() => setEditandoId(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Form inline pra editar 1 cupom. Reusa estilos do form de criação.
// Não permite editar o CÓDIGO (evita quebrar links já compartilhados).
function FormEditarCupom({
  cupom,
  analistas,
  onDone,
}: {
  cupom: CupomItem;
  analistas: { id: string; nomeCompleto: string }[];
  onDone: () => void;
}) {
  const acao = editarCupomAction.bind(null, cupom.id);
  const [state, formAction] = useActionState(acao, null);
  const [salvando, startSalvar] = useTransition();

  // Data de valido ate em formato YYYY-MM-DD (input date)
  const validoAteDate = cupom.validoAte ? cupom.validoAte.slice(0, 10) : "";

  return (
    <form
      action={(fd) => startSalvar(() => formAction(fd))}
      className="mt-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3"
    >
      <p className="text-xs font-bold text-blue-900">Editar cupom {cupom.codigo}</p>

      <label className="block text-xs font-semibold text-slate-700">
        Descrição (interno)
        <input
          name="descricao"
          type="text"
          defaultValue={cupom.descricao ?? ""}
          placeholder="Ex: Cliente novo do Igor — fornecedor de produtos"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-700">
          Dias de trial (1-365)
          <input
            name="diasTrial"
            type="number"
            min={1}
            max={365}
            defaultValue={cupom.diasTrial}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Válido até (opcional)
          <input
            name="validoAte"
            type="date"
            defaultValue={validoAteDate}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Usos máximos (vazio = ilimitado)
          <input
            name="usosMaximos"
            type="number"
            min={cupom.usosAtuais || 1}
            defaultValue={cupom.usosMaximos ?? ""}
            placeholder="Ex: 1"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </label>
      </div>

      <label className="block text-xs font-semibold text-slate-700">
        Analista vinculado (Igor não vai ser sempre — pode trocar aqui)
        <select
          name="analistaVinculadoId"
          defaultValue={
            analistas.find((a) => a.nomeCompleto === cupom.analistaVinculado)?.id ?? ""
          }
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
        >
          <option value="">— Nenhum (sem analista vinculado) —</option>
          {analistas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nomeCompleto}
            </option>
          ))}
        </select>
      </label>

      {state?.erro && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">{state.erro}</div>
      )}
      {state?.ok && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          ✓ Cupom atualizado.
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
