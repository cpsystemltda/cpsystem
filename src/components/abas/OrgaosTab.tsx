"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { brl, formatarCnpj, LIMITE_CARONA_POR_ORGAO_PCT, LIMITE_CARONA_TOTAL_PCT } from "@/lib/validators";
import {
  adicionarOrgaoNaAtaAction,
  adicionarEnderecoEntregaAction,
  adicionarPontoFocalAction,
  atualizarOrgaoNaAtaAction,
  removerOrgaoNaAtaAction,
  atualizarEnderecoEntregaAction,
  removerEnderecoEntregaAction,
  atualizarPontoFocalAction,
  removerPontoFocalAction,
} from "@/app/actions/orgaos";

type OrgaoNaAta = {
  id: string;
  tipo: string;
  nome: string;
  cnpj: string;
  endereco: string;
  email: string | null;
  telefone: string | null;
  limiteValor: number | null;
  limitePct: number | null;
};

const ROTULO_TIPO: Record<string, string> = {
  GERENCIADOR: "Gerenciador",
  PARTICIPANTE: "Participante",
  CARONA: "Carona",
};
const COR_TIPO: Record<string, string> = {
  GERENCIADOR: "bg-blue-100 text-blue-800",
  PARTICIPANTE: "bg-violet-100 text-violet-800",
  CARONA: "bg-amber-100 text-amber-800",
};

export function OrgaosTab({ ataId, orgaos, valorTotalAta, aceitaCarona }: { ataId: string; orgaos: OrgaoNaAta[]; valorTotalAta: number; aceitaCarona: boolean }) {
  const [state, formAction] = useActionState(adicionarOrgaoNaAtaAction, null);

  const caronas = orgaos.filter((o) => o.tipo === "CARONA");
  const somaCaronaPct = caronas.reduce((s, c) => s + (c.limitePct || 0), 0);
  const somaCaronaValor = caronas.reduce((s, c) => s + (c.limiteValor || 0), 0);

  return (
    <div className="space-y-6">
      {orgaos.length > 0 && (
        <ul className="space-y-2">
          {orgaos.map((o) => (
            <OrgaoItem key={o.id} orgao={o} valorTotalAta={valorTotalAta} />
          ))}
        </ul>
      )}

      {aceitaCarona && caronas.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-sm font-semibold text-amber-900">
            Monitoramento de adesão (carona) — Lei 14.133/2021 art. 86
          </h4>
          <div className="mt-3 space-y-2 text-xs text-amber-800">
            <div>
              Soma dos limites: <strong>{somaCaronaPct.toFixed(0)}%</strong> de {LIMITE_CARONA_TOTAL_PCT}% permitidos · {brl(somaCaronaValor)}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200/60">
              <div
                className={`h-full ${somaCaronaPct >= LIMITE_CARONA_TOTAL_PCT ? "bg-red-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, somaCaronaPct)}%` }}
              />
            </div>
            <div className="text-[11px]">Limite por carona: {LIMITE_CARONA_POR_ORGAO_PCT}% · Limite total: {LIMITE_CARONA_TOTAL_PCT}%.</div>
          </div>
        </div>
      )}

      <FormOrgao ataId={ataId} aceitaCarona={aceitaCarona} state={state} formAction={formAction} valorTotalAta={valorTotalAta} />
    </div>
  );
}

function OrgaoItem({ orgao: o, valorTotalAta }: { orgao: OrgaoNaAta; valorTotalAta: number }) {
  const [editando, setEditando] = useState(false);
  const [state, formAction] = useActionState(atualizarOrgaoNaAtaAction, null);
  const [pct, setPct] = useState(o.limitePct ?? LIMITE_CARONA_POR_ORGAO_PCT);
  const valorEstimado = (valorTotalAta * pct) / 100;

  // Quando salva com sucesso, fecha o modo edição
  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (editando) {
    return (
      <li className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <form action={formAction} className="grid grid-cols-2 gap-3 text-sm">
          <input type="hidden" name="id" value={o.id} />
          <div className="col-span-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Editando órgão {ROTULO_TIPO[o.tipo].toLowerCase()}
            </span>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded p-1 text-amber-900 hover:bg-amber-100"
              title="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Campo label="Nome" name="nome" defaultValue={o.nome} required />
          <Campo
            label="CNPJ"
            name="cnpj"
            defaultValue={formatarCnpj(o.cnpj)}
            required
          />
          <Campo label="Endereço" name="endereco" defaultValue={o.endereco} required colSpan={2} />
          <Campo label="E-mail" name="email" type="email" defaultValue={o.email ?? ""} />
          <Campo label="Telefone" name="telefone" defaultValue={o.telefone ?? ""} />
          {o.tipo === "CARONA" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Limite (% do total da Ata)</span>
                <input
                  type="number"
                  name="limitePct"
                  value={pct}
                  onChange={(e) => setPct(Number(e.target.value))}
                  max={LIMITE_CARONA_POR_ORGAO_PCT}
                  min={1}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Valor calculado</span>
                <span className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium">
                  {brl(valorEstimado)}
                </span>
              </div>
            </>
          )}
          {state?.erro && <div className="col-span-2 text-xs text-red-700">{state.erro}</div>}
          <div className="col-span-2 flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              onClick={(ev) => {
                if (!window.confirm("Tem certeza? Esta ação será registrada no histórico.")) {
                  ev.preventDefault();
                }
              }}
            >
              Salvar alterações
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  const podeEditar = o.tipo !== "GERENCIADOR";

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-900">{o.nome}</h4>
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR_TIPO[o.tipo]}`}>
              {ROTULO_TIPO[o.tipo]}
            </span>
          </div>
          <div className="mt-1 grid gap-x-4 text-xs text-slate-600 md:grid-cols-2">
            <span>CNPJ: {formatarCnpj(o.cnpj)}</span>
            <span>{o.endereco}</span>
            {o.email && <span>{o.email}</span>}
            {o.telefone && <span>{o.telefone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {o.tipo === "CARONA" && o.limitePct !== null && (
            <div className="text-right text-xs">
              <div className="text-slate-500">Limite</div>
              <div className="font-medium text-slate-900">{o.limitePct}% · {brl(o.limiteValor || 0)}</div>
            </div>
          )}
          {podeEditar && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Editar órgão"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <form action={removerOrgaoNaAtaAction}>
                <input type="hidden" name="id" value={o.id} />
                <button
                  type="submit"
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                  title="Remover órgão"
                  onClick={(ev) => {
                    if (
                      !window.confirm(
                        `Remover o órgão "${o.nome}"? Esta ação será registrada no histórico.`,
                      )
                    ) {
                      ev.preventDefault();
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function FormOrgao({
  ataId,
  aceitaCarona,
  state,
  formAction,
  valorTotalAta,
}: {
  ataId: string;
  aceitaCarona: boolean;
  state: { erro?: string; ok?: boolean } | null;
  formAction: (formData: FormData) => void;
  valorTotalAta: number;
}) {
  const [tipo, setTipo] = useState("PARTICIPANTE");
  const [pct, setPct] = useState(LIMITE_CARONA_POR_ORGAO_PCT);
  const valorEstimado = (valorTotalAta * pct) / 100;

  return (
    <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Adicionar órgão (participante/carona)</summary>
      <form action={formAction} className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <input type="hidden" name="ataId" value={ataId} />
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Tipo</span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="PARTICIPANTE">Órgão participante</option>
            {aceitaCarona && <option value="CARONA">Órgão carona (adesão)</option>}
          </select>
        </label>
        <Campo label="Nome" name="nome" required />
        <Campo label="CNPJ" name="cnpj" required />
        <Campo label="Endereço" name="endereco" required colSpan={2} />
        <Campo label="E-mail" name="email" type="email" />
        <Campo label="Telefone" name="telefone" />
        {tipo === "CARONA" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Limite (% do total da Ata)</span>
              <input
                type="number"
                name="limitePct"
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                max={LIMITE_CARONA_POR_ORGAO_PCT}
                min={1}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Valor calculado</span>
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium">{brl(valorEstimado)}</span>
            </div>
          </>
        )}
        {state?.erro && <div className="col-span-2 text-xs text-red-700">{state.erro}</div>}
        {state?.ok && <div className="col-span-2 text-xs text-emerald-700">Órgão adicionado.</div>}
        <button type="submit" className="col-span-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
          Adicionar
        </button>
      </form>
    </details>
  );
}

function Campo({
  label,
  colSpan = 1,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; colSpan?: 1 | 2 }) {
  return (
    <label className={`flex flex-col gap-1 ${colSpan === 2 ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input {...props} className="rounded border border-slate-300 px-2 py-1 text-xs" />
    </label>
  );
}

export function EnderecosPontosFocaisTab({
  enderecos,
  pontosFocais,
  ataId,
  contratoId,
  empenhoId,
}: {
  enderecos: { id: string; rotulo: string | null; endereco: string }[];
  pontosFocais: { id: string; funcao: string; nome: string; email: string | null; telefone: string | null }[];
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
}) {
  const [endState, endAction] = useActionState(adicionarEnderecoEntregaAction, null);
  const [pfState, pfAction] = useActionState(adicionarPontoFocalAction, null);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h4 className="mb-2 text-sm font-semibold text-slate-700">Endereços de entrega</h4>
        {enderecos.length > 0 ? (
          <ul className="mb-3 space-y-1 text-xs text-slate-600">
            {enderecos.map((e) => (
              <EnderecoEditavel key={e.id} endereco={e} />
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-slate-500">Nenhum endereço cadastrado.</p>
        )}
        <form action={endAction} className="grid grid-cols-2 gap-2 text-sm">
          {ataId && <input type="hidden" name="ataId" value={ataId} />}
          {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
          {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
          <input name="rotulo" placeholder="Rótulo (ex: CD-Norte)" className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <input name="endereco" placeholder="Endereço completo" required className="rounded border border-slate-300 px-2 py-1 text-xs" />
          {endState?.erro && <span className="col-span-2 text-xs text-red-700">{endState.erro}</span>}
          <button type="submit" className="col-span-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
            + Adicionar endereço
          </button>
        </form>
      </section>

      <section>
        <h4 className="mb-2 text-sm font-semibold text-slate-700">Pontos focais</h4>
        {pontosFocais.length > 0 ? (
          <ul className="mb-3 space-y-1 text-xs text-slate-600">
            {pontosFocais.map((p) => (
              <PontoFocalEditavel key={p.id} pontoFocal={p} />
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-slate-500">Nenhum ponto focal cadastrado.</p>
        )}
        <form action={pfAction} className="grid grid-cols-2 gap-2 text-sm">
          {ataId && <input type="hidden" name="ataId" value={ataId} />}
          {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
          {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
          <select name="funcao" required className="rounded border border-slate-300 px-2 py-1 text-xs">
            <option value="GESTOR">Gestor</option>
            <option value="FISCAL_TECNICO">Fiscal técnico</option>
            <option value="FISCAL_ADMINISTRATIVO">Fiscal administrativo</option>
            <option value="RESPONSAVEL_SETOR">Responsável setor</option>
            <option value="CONTATO_GERAL">Contato geral</option>
          </select>
          <input name="nome" placeholder="Nome" required className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <input name="email" placeholder="E-mail" type="email" className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <input name="telefone" placeholder="Telefone" className="rounded border border-slate-300 px-2 py-1 text-xs" />
          {pfState?.erro && <span className="col-span-2 text-xs text-red-700">{pfState.erro}</span>}
          <button type="submit" className="col-span-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
            + Adicionar ponto focal
          </button>
        </form>
      </section>
    </div>
  );
}

function EnderecoEditavel({
  endereco: e,
}: {
  endereco: { id: string; rotulo: string | null; endereco: string };
}) {
  const [editando, setEditando] = useState(false);
  const [state, formAction] = useActionState(atualizarEnderecoEntregaAction, null);
  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (editando) {
    return (
      <li className="rounded border border-amber-300 bg-amber-50 p-2">
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={e.id} />
          <input
            name="rotulo"
            defaultValue={e.rotulo ?? ""}
            placeholder="Rótulo"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <input
            name="endereco"
            defaultValue={e.endereco}
            required
            placeholder="Endereço completo"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          {state?.erro && <span className="text-xs text-red-700">{state.erro}</span>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2">
      <span className="flex-1">
        <strong>{e.rotulo || "Endereço"}</strong> — {e.endereco}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          title="Editar"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <form action={removerEnderecoEntregaAction}>
          <input type="hidden" name="id" value={e.id} />
          <button
            type="submit"
            className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
            title="Remover"
            onClick={(ev) => {
              if (!window.confirm("Remover este endereço? A ação será registrada no histórico.")) {
                ev.preventDefault();
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </form>
      </div>
    </li>
  );
}

function PontoFocalEditavel({
  pontoFocal: p,
}: {
  pontoFocal: { id: string; funcao: string; nome: string; email: string | null; telefone: string | null };
}) {
  const [editando, setEditando] = useState(false);
  const [state, formAction] = useActionState(atualizarPontoFocalAction, null);
  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (editando) {
    return (
      <li className="rounded border border-amber-300 bg-amber-50 p-2">
        <form action={formAction} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="id" value={p.id} />
          <select
            name="funcao"
            defaultValue={p.funcao}
            required
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="GESTOR">Gestor</option>
            <option value="FISCAL">Fiscal</option>
            <option value="FISCAL_TECNICO">Fiscal técnico</option>
            <option value="FISCAL_ADMINISTRATIVO">Fiscal administrativo</option>
            <option value="RESPONSAVEL_SETOR">Responsável setor</option>
            <option value="CONTATO_GERAL">Contato geral</option>
            <option value="AUTORIDADE_COMPETENTE">Autoridade competente</option>
            <option value="OUTRO">Outro</option>
          </select>
          <input
            name="nome"
            defaultValue={p.nome}
            required
            placeholder="Nome"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <input
            name="email"
            defaultValue={p.email ?? ""}
            placeholder="E-mail"
            type="email"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <input
            name="telefone"
            defaultValue={p.telefone ?? ""}
            placeholder="Telefone"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          {state?.erro && (
            <span className="col-span-2 text-xs text-red-700">{state.erro}</span>
          )}
          <div className="col-span-2 flex gap-2">
            <button
              type="submit"
              className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2">
      <span className="flex-1">
        <strong>{p.funcao.replace(/_/g, " ")}</strong>: {p.nome}
        {p.email && <> · {p.email}</>}
        {p.telefone && <> · {p.telefone}</>}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          title="Editar"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <form action={removerPontoFocalAction}>
          <input type="hidden" name="id" value={p.id} />
          <button
            type="submit"
            className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
            title="Remover"
            onClick={(ev) => {
              if (
                !window.confirm("Remover este ponto focal? A ação será registrada no histórico.")
              ) {
                ev.preventDefault();
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </form>
      </div>
    </li>
  );
}
