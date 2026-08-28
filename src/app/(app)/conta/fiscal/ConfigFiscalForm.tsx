"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { salvarConfigFiscalAction, type ResultadoConfigFiscal } from "@/app/actions/configFiscal";

type Config = {
  provedor: string;
  ambiente: string;
  habilitado: boolean;
  temToken: boolean;
  inscricaoMunicipal: string | null;
  inscricaoEstadual: string | null;
  codigoMunicipio: string | null;
  regime: string;
  optanteSimples: boolean;
  incentivadorCultural: boolean;
  itemListaServico: string | null;
  codigoTributarioMunicipio: string | null;
  cnaeServico: string | null;
  aliquotaIss: number | null;
  issRetidoPadrao: boolean;
  descricaoPadrao: string | null;
};

export function ConfigFiscalForm({
  empresaId,
  config,
  podeEditar,
}: {
  empresaId: string;
  config: Config | null;
  podeEditar: boolean;
}) {
  const [estado, acao, pendente] = useActionState<ResultadoConfigFiscal | null, FormData>(
    salvarConfigFiscalAction,
    null,
  );
  const [ambiente, setAmbiente] = useState(config?.ambiente ?? "HOMOLOGACAO");
  const [provedor, setProvedor] = useState(config?.provedor ?? "DEMO");

  const e = estado?.campos ?? {};

  return (
    <form action={acao} className="mt-5 space-y-5">
      <input type="hidden" name="empresaId" value={empresaId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Casa fiscal">
          <select
            name="provedor"
            defaultValue={config?.provedor ?? "DEMO"}
            onChange={(ev) => setProvedor(ev.target.value)}
            disabled={!podeEditar}
            className={entrada}
          >
            <option value="DEMO">Nenhuma (modo demonstração)</option>
            <option value="FOCUS_NFE">Focus NFe</option>
          </select>
        </Campo>

        <Campo label="Ambiente">
          <select
            name="ambiente"
            defaultValue={config?.ambiente ?? "HOMOLOGACAO"}
            onChange={(ev) => setAmbiente(ev.target.value)}
            disabled={!podeEditar}
            className={entrada}
          >
            <option value="HOMOLOGACAO">Homologação (teste, sem valor fiscal)</option>
            <option value="PRODUCAO">Produção (nota válida de verdade)</option>
          </select>
        </Campo>
      </div>

      {provedor === "DEMO" && (
        <Aviso cor="amber">
          No modo demonstração o sistema simula a emissão pra você conferir a tela e o
          fluxo. <strong>Nenhuma nota chega à prefeitura.</strong> Escolha a casa fiscal
          quando a contratação estiver feita.
        </Aviso>
      )}
      {provedor === "FOCUS_NFE" && ambiente === "PRODUCAO" && (
        <Aviso cor="red">
          Ambiente de produção: cada emissão gera <strong>nota fiscal válida</strong>, com
          efeito tributário. Teste antes em homologação.
        </Aviso>
      )}

      {provedor === "FOCUS_NFE" && (
        <Campo
          label="Token da Focus NFe"
          ajuda={
            config?.temToken
              ? "Já existe um token salvo. Preencha só se quiser trocar."
              : "O token aparece no painel da Focus NFe, na empresa cadastrada."
          }
          erro={e.token}
        >
          <input
            type="password"
            name="token"
            autoComplete="off"
            placeholder={config?.temToken ? "•••••••• (mantém o atual)" : "Cole o token aqui"}
            disabled={!podeEditar}
            className={entrada}
          />
        </Campo>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Inscrição municipal">
          <input name="inscricaoMunicipal" defaultValue={config?.inscricaoMunicipal ?? ""} disabled={!podeEditar} className={entrada} />
        </Campo>
        <Campo label="Inscrição estadual" ajuda="Opcional pra serviço.">
          <input name="inscricaoEstadual" defaultValue={config?.inscricaoEstadual ?? ""} disabled={!podeEditar} className={entrada} />
        </Campo>
        <Campo label="Código IBGE do município" ajuda="Deixe em branco: preenchemos pelo seu CNPJ.">
          <input name="codigoMunicipio" defaultValue={config?.codigoMunicipio ?? ""} disabled={!podeEditar} className={entrada} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Regime tributário">
          <select name="regime" defaultValue={config?.regime ?? "SIMPLES_NACIONAL"} disabled={!podeEditar} className={entrada}>
            <option value="SIMPLES_NACIONAL">Simples Nacional</option>
            <option value="LUCRO_PRESUMIDO">Lucro presumido</option>
            <option value="LUCRO_REAL">Lucro real</option>
            <option value="MEI">MEI</option>
          </select>
        </Campo>
        <Campo label="Item da lista de serviço" ajuda='Ex.: "14.01". Sua contabilidade sabe qual é.' erro={e.itemListaServico}>
          <input name="itemListaServico" defaultValue={config?.itemListaServico ?? ""} placeholder="14.01" disabled={!podeEditar} className={entrada} />
        </Campo>
        <Campo label="Alíquota de ISS (%)" erro={e.aliquotaIss}>
          <input name="aliquotaIss" defaultValue={config?.aliquotaIss ?? ""} placeholder="2" inputMode="decimal" disabled={!podeEditar} className={entrada} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Código tributário do município" ajuda="Alguns municípios exigem; outros ignoram.">
          <input name="codigoTributarioMunicipio" defaultValue={config?.codigoTributarioMunicipio ?? ""} disabled={!podeEditar} className={entrada} />
        </Campo>
        <Campo label="CNAE do serviço">
          <input name="cnaeServico" defaultValue={config?.cnaeServico ?? ""} disabled={!podeEditar} className={entrada} />
        </Campo>
      </div>

      <Campo
        label="Texto padrão da nota"
        ajuda="Entra antes da lista de itens. Dá pra ajustar na hora de emitir."
      >
        <textarea
          name="descricaoPadrao"
          rows={2}
          defaultValue={config?.descricaoPadrao ?? ""}
          placeholder="Ex.: Prestação de serviços conforme contrato administrativo."
          disabled={!podeEditar}
          className={entrada}
        />
      </Campo>

      <div className="flex flex-wrap gap-5">
        <Marcar nome="optanteSimples" label="Optante pelo Simples Nacional" marcado={config?.optanteSimples ?? true} disabled={!podeEditar} />
        <Marcar nome="incentivadorCultural" label="Incentivador cultural" marcado={config?.incentivadorCultural ?? false} disabled={!podeEditar} />
        <Marcar nome="issRetidoPadrao" label="ISS retido pelo tomador" marcado={config?.issRetidoPadrao ?? false} disabled={!podeEditar} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <Marcar
          nome="habilitado"
          label="Ligar a emissão de nota para esta empresa"
          marcado={config?.habilitado ?? false}
          disabled={!podeEditar}
        />
        <p className="mt-1.5 ps-6 text-xs text-slate-500">
          Com isso ligado, o botão “Emitir NF” aparece na execução dos empenhos desta empresa.
        </p>
      </div>

      {estado?.erro && (
        <Aviso cor="red">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          {estado.erro}
        </Aviso>
      )}
      {estado?.ok && estado.mensagem && (
        <Aviso cor="emerald">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
          {estado.mensagem}
        </Aviso>
      )}

      {podeEditar && (
        <button
          type="submit"
          disabled={pendente}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
          {pendente ? "Salvando…" : "Salvar dados fiscais"}
        </button>
      )}
    </form>
  );
}

const entrada =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-500";

function Campo({
  label,
  ajuda,
  erro,
  children,
}: {
  label: string;
  ajuda?: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>
      {children}
      {erro ? (
        <span className="mt-1 block text-xs text-red-600">{erro}</span>
      ) : ajuda ? (
        <span className="mt-1 block text-[11px] text-slate-500">{ajuda}</span>
      ) : null}
    </label>
  );
}

function Marcar({
  nome,
  label,
  marcado,
  disabled,
}: {
  nome: string;
  label: string;
  marcado: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name={nome}
        defaultChecked={marcado}
        disabled={disabled}
        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
      />
      {label}
    </label>
  );
}

function Aviso({ cor, children }: { cor: "amber" | "red" | "emerald"; children: React.ReactNode }) {
  const mapa = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return <div className={`rounded-xl border p-3 text-xs leading-relaxed ${mapa[cor]}`}>{children}</div>;
}
