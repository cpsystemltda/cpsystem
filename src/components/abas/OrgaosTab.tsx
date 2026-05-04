"use client";

import { useActionState, useState } from "react";
import { brl, formatarCnpj, LIMITE_CARONA_POR_ORGAO_PCT, LIMITE_CARONA_TOTAL_PCT } from "@/lib/validators";
import {
  adicionarOrgaoNaAtaAction,
  adicionarEnderecoEntregaAction,
  adicionarPontoFocalAction,
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
            <li key={o.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
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
                {o.tipo === "CARONA" && o.limitePct !== null && (
                  <div className="text-right text-xs">
                    <div className="text-slate-500">Limite</div>
                    <div className="font-medium text-slate-900">{o.limitePct}% · {brl(o.limiteValor || 0)}</div>
                  </div>
                )}
              </div>
            </li>
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
              <li key={e.id} className="rounded border border-slate-200 bg-white p-2">
                <strong>{e.rotulo || "Endereço"}</strong> — {e.endereco}
              </li>
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
              <li key={p.id} className="rounded border border-slate-200 bg-white p-2">
                <strong>{p.funcao.replace(/_/g, " ")}</strong>: {p.nome}
                {p.email && <> · {p.email}</>}
                {p.telefone && <> · {p.telefone}</>}
              </li>
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
