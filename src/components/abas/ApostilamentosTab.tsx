"use client";

/**
 * ApostilamentosTab — M3 v2 (layout do print Comprasnet)
 *
 * Lei 14.133 art. 136 — Apostilamento é alteração unilateral simples
 * (não exige novo instrumento). Tipicamente: reajuste por índice já
 * contratado, aplicação de penalidade, empenho suplementar, ou outra
 * anotação administrativa.
 *
 * Estrutura espelha AditivosTab mas adiciona `Finalidade` + `Motivo`.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, FileText, Check, AlertCircle } from "lucide-react";
import { brl } from "@/lib/validators";
import {
  criarApostilamentoAction,
  editarApostilamentoAction,
  excluirApostilamentoAction,
} from "@/app/actions/contratuais";
import { extrairApostilamentoPdfAction } from "@/app/actions/iaExtracao";
import { BadgeAuto } from "@/components/forms/glass";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import type { ApostilamentoExtraido } from "@/lib/extrairAta";

type TipoAlteracaoValor = "ACRESCIMO" | "SUPRESSAO" | "REAJUSTE_REPACTUACAO" | "REEQUILIBRIO";
type IndiceReajuste =
  | "IPCA" | "IPCA_E" | "IPCA_15" | "IGPM" | "INCC" | "INPC" | "IST" | "CONTRATUAL" | "OUTRO";
type Unidade = "DIAS" | "MESES";
type Finalidade = "REAJUSTE" | "APLICACAO_PENALIDADE" | "EMPENHO_CREDITO_SUPLEMENTAR" | "OUTROS";

type Apostilamento = {
  id: string;
  numero: string;
  objeto: string;
  dataAssinatura: Date;
  natureza: string;
  finalidade: Finalidade | null;
  motivo: string | null;
  alteraValor: boolean;
  tipoAlteracaoValor: TipoAlteracaoValor | null;
  novoValor: number | null;
  alteraPrazoVigencia: boolean;
  novaVigenciaInicio: Date | null;
  novaVigenciaFim: Date | null;
  novaVigenciaPrazo: number | null;
  novaVigenciaUnidade: Unidade | null;
  alteraPrazoEntrega: boolean;
  novoPrazoEntregaDias: number | null;
  novoPrazoEntregaUnidade: Unidade | null;
  aplicaReajuste: boolean;
  reajusteIndice: IndiceReajuste | null;
  reajusteIndiceOutro: string | null;
  reajustePeriodoInicio: Date | null;
  reajustePeriodoFim: Date | null;
  reajustePercentual: number | null;
  observacoes: string | null;
  arquivoPdfUrl: string | null;
};

const ROTULO_FINALIDADE: Record<Finalidade, string> = {
  REAJUSTE: "Reajuste",
  APLICACAO_PENALIDADE: "Aplicação de Penalidade",
  EMPENHO_CREDITO_SUPLEMENTAR: "Empenho de Crédito Suplementar",
  OUTROS: "Outros",
};

const ROTULO_TIPO_VALOR: Record<TipoAlteracaoValor, string> = {
  ACRESCIMO: "Acréscimo",
  SUPRESSAO: "Supressão",
  REAJUSTE_REPACTUACAO: "Reajuste / Repactuação",
  REEQUILIBRIO: "Reequilíbrio",
};

const ROTULO_INDICE: Record<IndiceReajuste, string> = {
  IPCA: "IPCA",
  IPCA_E: "IPCA-E",
  IPCA_15: "IPCA-15",
  IGPM: "IGP-M",
  INCC: "INCC",
  INPC: "INPC",
  IST: "IST",
  CONTRATUAL: "Contratual",
  OUTRO: "Outro",
};

function toIsoDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function calcularDataFim(inicio: string, prazo: number, unidade: Unidade): string {
  if (!inicio || !prazo) return "";
  const d = new Date(`${inicio}T12:00:00.000Z`);
  if (unidade === "MESES") d.setUTCMonth(d.getUTCMonth() + prazo);
  else d.setUTCDate(d.getUTCDate() + prazo);
  return d.toISOString().slice(0, 10);
}

export function ApostilamentosTab({
  apostilamentos,
  contratoId,
  empenhoId,
  ataId,
  valorInicialContrato,
  valorAtualContrato,
}: {
  apostilamentos: Apostilamento[];
  contratoId?: string;
  empenhoId?: string;
  ataId?: string;
  valorInicialContrato?: number;
  valorAtualContrato?: number;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  return (
    <div className="space-y-6">
      {apostilamentos.length > 0 && (
        <div className="space-y-3">
          {apostilamentos.map((a) => (
            <CardApostilamento
              key={a.id}
              a={a}
              editando={editandoId === a.id}
              onEditar={() => {
                setCriando(false);
                setEditandoId(a.id);
              }}
              onCancelar={() => setEditandoId(null)}
              onSalvo={() => setEditandoId(null)}
              contratoId={contratoId}
              empenhoId={empenhoId}
              ataId={ataId}
              valorInicial={valorInicialContrato}
              valorAtual={valorAtualContrato}
            />
          ))}
        </div>
      )}

      {!criando && !editandoId && (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="btn-primary inline-flex"
        >
          + Cadastrar apostilamento
        </button>
      )}

      {criando && !editandoId && (
        <FormularioApostilamento
          modo="criar"
          contratoId={contratoId}
          empenhoId={empenhoId}
          ataId={ataId}
          valorInicial={valorInicialContrato}
          valorAtual={valorAtualContrato}
          onCancelar={() => setCriando(false)}
          onSalvo={() => setCriando(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// CARD
// ============================================================
function CardApostilamento({
  a,
  editando,
  onEditar,
  onCancelar,
  onSalvo,
  contratoId,
  empenhoId,
  ataId,
  valorInicial,
  valorAtual,
}: {
  a: Apostilamento;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvo: () => void;
  contratoId?: string;
  empenhoId?: string;
  ataId?: string;
  valorInicial?: number;
  valorAtual?: number;
}) {
  const [excluirState, excluirAction] = useActionState(excluirApostilamentoAction, null);

  if (editando) {
    return (
      <FormularioApostilamento
        modo="editar"
        apostilamento={a}
        contratoId={contratoId}
        empenhoId={empenhoId}
        ataId={ataId}
        valorInicial={valorInicial}
        valorAtual={valorAtual}
        onCancelar={onCancelar}
        onSalvo={onSalvo}
      />
    );
  }

  return (
    <article className="glass-tile rounded-[20px] px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h4
              className="text-[15px] font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
            >
              Apostilamento {a.numero}
            </h4>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-mute)" }}
            >
              {a.dataAssinatura.toLocaleDateString("pt-BR")}
            </span>
            {a.finalidade && <Pill cor="primary" texto={ROTULO_FINALIDADE[a.finalidade]} />}
          </div>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
            {a.objeto}
          </p>
          {a.motivo && (
            <p className="mt-1 text-[12px] italic" style={{ color: "var(--text-mute)" }}>
              <strong style={{ color: "var(--text-soft)" }}>Motivo:</strong> {a.motivo}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {a.alteraValor && a.novoValor && (
              <Pill
                cor="primary"
                texto={
                  a.tipoAlteracaoValor
                    ? `${ROTULO_TIPO_VALOR[a.tipoAlteracaoValor]} · ${brl(a.novoValor)}`
                    : `${brl(a.novoValor)}`
                }
              />
            )}
            {a.alteraPrazoVigencia && a.novaVigenciaFim && (
              <Pill cor="mint" texto={`Nova vigência até ${a.novaVigenciaFim.toLocaleDateString("pt-BR")}`} />
            )}
            {a.alteraPrazoEntrega && a.novoPrazoEntregaDias && (
              <Pill
                cor="sky"
                texto={`Entrega: ${a.novoPrazoEntregaDias} ${a.novoPrazoEntregaUnidade === "MESES" ? "meses" : "dias"}`}
              />
            )}
            {a.aplicaReajuste && a.reajustePercentual != null && (
              <Pill
                cor="lavender"
                texto={`Reajuste: ${a.reajusteIndice ? ROTULO_INDICE[a.reajusteIndice] : "?"} · ${a.reajustePercentual.toFixed(4).replace(".", ",")}%`}
              />
            )}
          </div>
          {a.observacoes && (
            <p className="mt-3 text-[12px] italic" style={{ color: "var(--text-mute)" }}>
              {a.observacoes}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {a.arquivoPdfUrl && (
            <a
              href={a.arquivoPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
              style={{
                background: "rgba(63,99,143,0.10)",
                color: "var(--sky-deep, #3F638F)",
                border: "0.5px solid rgba(63,99,143,0.2)",
              }}
            >
              <FileText className="h-3 w-3" /> PDF
            </a>
          )}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
              style={{
                background: "rgba(212,175,55,0.12)",
                color: "var(--primary-deep)",
                border: "0.5px solid rgba(168,137,71,0.3)",
              }}
              title="Editar apostilamento"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <form action={excluirAction}>
              <input type="hidden" name="apostilamentoId" value={a.id} />
              <button
                type="submit"
                onClick={(ev) => {
                  if (
                    !window.confirm(
                      `Excluir apostilamento ${a.numero}?\n\nAs alterações no contrato/ata serão revertidas ao estado anterior.`,
                    )
                  ) {
                    ev.preventDefault();
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
                style={{
                  background: "rgba(232,138,152,0.12)",
                  color: "var(--coral)",
                  border: "0.5px solid rgba(232,138,152,0.3)",
                }}
                title="Excluir apostilamento"
              >
                <Trash2 className="h-3 w-3" /> Excluir
              </button>
            </form>
          </div>
        </div>
      </div>
      {excluirState?.erro && (
        <p
          className="mt-2 rounded-lg px-3 py-2 text-[12px]"
          style={{
            background: "rgba(232,138,152,0.10)",
            border: "0.5px solid rgba(232,138,152,0.3)",
            color: "var(--coral)",
          }}
        >
          {excluirState.erro}
        </p>
      )}
    </article>
  );
}

function Pill({ texto, cor }: { texto: string; cor: "primary" | "mint" | "sky" | "lavender" }) {
  const bg = {
    primary: "rgba(212,175,55,0.18)",
    mint: "rgba(93,216,182,0.18)",
    sky: "rgba(63,99,143,0.14)",
    lavender: "rgba(197,180,255,0.18)",
  }[cor];
  const fg = {
    primary: "var(--primary-deep)",
    mint: "var(--mint)",
    sky: "var(--sky-deep, #3F638F)",
    lavender: "var(--lavender-deep, #6B5BB8)",
  }[cor];
  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold"
      style={{ background: bg, color: fg, border: "0.5px solid transparent" }}
    >
      {texto}
    </span>
  );
}

// ============================================================
// FORMULÁRIO
// ============================================================
function FormularioApostilamento({
  modo,
  apostilamento,
  contratoId,
  empenhoId,
  ataId,
  valorInicial,
  valorAtual,
  onCancelar,
  onSalvo,
}: {
  modo: "criar" | "editar";
  apostilamento?: Apostilamento;
  contratoId?: string;
  empenhoId?: string;
  ataId?: string;
  valorInicial?: number;
  valorAtual?: number;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const action = modo === "editar" ? editarApostilamentoAction : criarApostilamentoAction;
  const [state, formAction] = useActionState(action, null);

  const [numero, setNumero] = useState(apostilamento?.numero ?? "");
  const [objeto, setObjeto] = useState(apostilamento?.objeto ?? "");
  const [dataAssinatura, setDataAssinatura] = useState(toIsoDate(apostilamento?.dataAssinatura));
  const [finalidade, setFinalidade] = useState<Finalidade | "">(apostilamento?.finalidade ?? "");
  const [motivo, setMotivo] = useState(apostilamento?.motivo ?? "");
  const [observacoes, setObservacoes] = useState(apostilamento?.observacoes ?? "");

  const [alteraValor, setAlteraValor] = useState(apostilamento?.alteraValor ?? false);
  const [tipoValor, setTipoValor] = useState<TipoAlteracaoValor | "">(
    apostilamento?.tipoAlteracaoValor ?? "",
  );
  const [novoValor, setNovoValor] = useState<string>(
    apostilamento?.novoValor != null ? String(apostilamento.novoValor) : "",
  );

  const [alteraVig, setAlteraVig] = useState(apostilamento?.alteraPrazoVigencia ?? false);
  const [vigInicio, setVigInicio] = useState(toIsoDate(apostilamento?.novaVigenciaInicio));
  const [vigPrazo, setVigPrazo] = useState<string>(
    apostilamento?.novaVigenciaPrazo != null ? String(apostilamento.novaVigenciaPrazo) : "",
  );
  const [vigUnidade, setVigUnidade] = useState<Unidade>(
    apostilamento?.novaVigenciaUnidade ?? "MESES",
  );

  const [alteraEnt, setAlteraEnt] = useState(apostilamento?.alteraPrazoEntrega ?? false);
  const [entPrazo, setEntPrazo] = useState<string>(
    apostilamento?.novoPrazoEntregaDias != null ? String(apostilamento.novoPrazoEntregaDias) : "",
  );
  const [entUnidade, setEntUnidade] = useState<Unidade>(
    apostilamento?.novoPrazoEntregaUnidade ?? "DIAS",
  );

  const [aplicaReaj, setAplicaReaj] = useState(apostilamento?.aplicaReajuste ?? false);
  const [reajIndice, setReajIndice] = useState<IndiceReajuste | "">(
    apostilamento?.reajusteIndice ?? "",
  );
  const [reajPctStr, setReajPctStr] = useState<string>(
    apostilamento?.reajustePercentual != null ? String(apostilamento.reajustePercentual) : "",
  );

  const [arquivoUrlIa, setArquivoUrlIa] = useState<string | null>(null);
  const [arquivoNomeIa, setArquivoNomeIa] = useState<string | null>(null);
  const [camposAuto, setCamposAuto] = useState<Set<string>>(new Set());

  function aplicarDadosIa(d: {
    numero: string;
    objeto: string;
    dataAssinatura: string;
    finalidade: Finalidade | null;
    motivo: string | null;
    alteraValor: boolean;
    tipoAlteracaoValor: TipoAlteracaoValor | null;
    novoValor: number | null;
    alteraPrazoVigencia: boolean;
    novaVigenciaInicio: string | null;
    novaVigenciaPrazo: number | null;
    novaVigenciaUnidade: Unidade | null;
    alteraPrazoEntrega: boolean;
    novoPrazoEntregaDias: number | null;
    novoPrazoEntregaUnidade: Unidade | null;
    aplicaReajuste: boolean;
    reajusteIndice: IndiceReajuste | null;
    reajustePercentual: number | null;
    observacoes: string | null;
  }) {
    const auto = new Set<string>();
    if (d.numero) { setNumero(d.numero); auto.add("numero"); }
    if (d.objeto) { setObjeto(d.objeto); auto.add("objeto"); }
    if (d.dataAssinatura) { setDataAssinatura(d.dataAssinatura); auto.add("dataAssinatura"); }
    if (d.finalidade) { setFinalidade(d.finalidade); auto.add("finalidade"); }
    if (d.motivo) { setMotivo(d.motivo); auto.add("motivo"); }
    if (d.alteraValor) {
      setAlteraValor(true); auto.add("alteraValor");
      if (d.tipoAlteracaoValor) { setTipoValor(d.tipoAlteracaoValor); auto.add("tipoAlteracaoValor"); }
      if (d.novoValor != null) { setNovoValor(String(d.novoValor)); auto.add("novoValor"); }
    }
    if (d.alteraPrazoVigencia) {
      setAlteraVig(true); auto.add("alteraPrazoVigencia");
      if (d.novaVigenciaInicio) { setVigInicio(d.novaVigenciaInicio); auto.add("novaVigenciaInicio"); }
      if (d.novaVigenciaPrazo != null) { setVigPrazo(String(d.novaVigenciaPrazo)); auto.add("novaVigenciaPrazo"); }
      if (d.novaVigenciaUnidade) setVigUnidade(d.novaVigenciaUnidade);
    }
    if (d.alteraPrazoEntrega) {
      setAlteraEnt(true); auto.add("alteraPrazoEntrega");
      if (d.novoPrazoEntregaDias != null) { setEntPrazo(String(d.novoPrazoEntregaDias)); auto.add("novoPrazoEntregaDias"); }
      if (d.novoPrazoEntregaUnidade) setEntUnidade(d.novoPrazoEntregaUnidade);
    }
    if (d.aplicaReajuste) {
      setAplicaReaj(true); auto.add("aplicaReajuste");
      if (d.reajusteIndice) { setReajIndice(d.reajusteIndice); auto.add("reajusteIndice"); }
      if (d.reajustePercentual != null) { setReajPctStr(String(d.reajustePercentual)); auto.add("reajustePercentual"); }
    }
    if (d.observacoes) { setObservacoes(d.observacoes); auto.add("observacoes"); }
    setCamposAuto(auto);
  }

  const dataVigFim = useMemo(
    () => calcularDataFim(vigInicio, Number(vigPrazo) || 0, vigUnidade),
    [vigInicio, vigPrazo, vigUnidade],
  );

  const valorNumerico = Number(novoValor) || 0;
  const valorBase = valorAtual ?? valorInicial ?? 0;
  const percentualAditivo = valorBase > 0 && valorNumerico > 0
    ? (valorNumerico / valorBase) * 100
    : 0;

  useEffect(() => {
    if (state?.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <div className="space-y-4">
      {modo === "criar" && (
        <PainelIaApostilamento
          onDados={aplicarDadosIa}
          onArquivo={(url, nome) => {
            setArquivoUrlIa(url);
            setArquivoNomeIa(nome);
          }}
        />
      )}

      <form
        action={formAction}
        className="glass rounded-[24px] px-7 py-6 space-y-7"
        style={{ background: "var(--glass-2)" }}
      >
        {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
        {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
        {ataId && <input type="hidden" name="ataId" value={ataId} />}
        {modo === "editar" && apostilamento && (
          <input type="hidden" name="apostilamentoId" value={apostilamento.id} />
        )}
        {arquivoUrlIa && (
          <>
            <input type="hidden" name="arquivoPdfUrl" value={arquivoUrlIa} />
            <input type="hidden" name="arquivoPdfNome" value={arquivoNomeIa ?? ""} />
          </>
        )}

        {/* Identificação */}
        <section>
          <Titulo>Identificação do apostilamento</Titulo>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <CampoLabel label="Nº do Apostilamento" required auto={camposAuto.has("numero")}>
              <input
                name="numero"
                required
                value={numero}
                onChange={(ev) => setNumero(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                placeholder="ex: 01/2026"
              />
            </CampoLabel>
            <CampoLabel label="Data da Formalização" required auto={camposAuto.has("dataAssinatura")}>
              <input
                type="date"
                name="dataAssinatura"
                required
                value={dataAssinatura}
                onChange={(ev) => setDataAssinatura(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <CampoLabel label="Finalidade" required auto={camposAuto.has("finalidade")}>
              <select
                name="finalidade"
                required
                value={finalidade}
                onChange={(ev) => setFinalidade(ev.target.value as Finalidade | "")}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              >
                <option value="">— Selecione —</option>
                {(Object.keys(ROTULO_FINALIDADE) as Finalidade[]).map((f) => (
                  <option key={f} value={f}>
                    {ROTULO_FINALIDADE[f]}
                  </option>
                ))}
              </select>
            </CampoLabel>
            <CampoLabel label="Motivo" required span={3} auto={camposAuto.has("motivo")}>
              <input
                name="motivo"
                required
                value={motivo}
                onChange={(ev) => setMotivo(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                placeholder="ex: Variação acumulada do IPCA — período 12 meses"
              />
            </CampoLabel>
            <CampoLabel label="Objeto do apostilamento" required span={3} auto={camposAuto.has("objeto")}>
              <textarea
                name="objeto"
                required
                value={objeto}
                onChange={(ev) => setObjeto(ev.target.value)}
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                placeholder="Descreva a alteração administrativa"
              />
            </CampoLabel>
          </div>
        </section>

        {/* BLOCO VALOR */}
        <BlocoToggle
          titulo="Valor contratual?"
          ligado={alteraValor}
          onToggle={setAlteraValor}
          nameToggle="alteraValor"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CampoLabel label="Tipo" required={alteraValor} auto={camposAuto.has("tipoAlteracaoValor")}>
                <div className="flex flex-wrap gap-3 pt-2">
                  {(Object.keys(ROTULO_TIPO_VALOR) as TipoAlteracaoValor[]).map((t) => (
                    <label
                      key={t}
                      className="inline-flex items-center gap-2 text-[13px] font-semibold cursor-pointer"
                      style={{ color: "var(--text)" }}
                    >
                      <input
                        type="radio"
                        name="tipoAlteracaoValor"
                        value={t}
                        checked={tipoValor === t}
                        onChange={() => setTipoValor(t)}
                        className="h-4 w-4"
                      />
                      {ROTULO_TIPO_VALOR[t]}
                    </label>
                  ))}
                </div>
              </CampoLabel>
              <CampoLabel label="Valor (R$)" required={alteraValor} auto={camposAuto.has("novoValor")}>
                <input
                  type="number"
                  name="novoValor"
                  step="0.01"
                  min="0"
                  value={novoValor}
                  onChange={(ev) => setNovoValor(ev.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                  placeholder="0,00"
                />
              </CampoLabel>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadonlyValor label="Valor Inicial (R$)" valor={valorInicial} />
              <ReadonlyValor label="Valor Atual (R$)" valor={valorAtual} />
              <ReadonlyValor
                label="Percentual do Apostilamento"
                texto={percentualAditivo > 0 ? `${percentualAditivo.toFixed(4).replace(".", ",")}%` : "—"}
              />
            </div>
          </div>
        </BlocoToggle>

        {/* BLOCO VIGÊNCIA */}
        <BlocoToggle
          titulo="Prazo de vigência?"
          ligado={alteraVig}
          onToggle={setAlteraVig}
          nameToggle="alteraPrazoVigencia"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <CampoLabel label="Data de início" required={alteraVig} auto={camposAuto.has("novaVigenciaInicio")}>
              <input
                type="date"
                name="novaVigenciaInicio"
                value={vigInicio}
                onChange={(ev) => setVigInicio(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <CampoLabel label="Prazo" required={alteraVig} auto={camposAuto.has("novaVigenciaPrazo")}>
              <input
                type="number"
                name="novaVigenciaPrazo"
                min="1"
                value={vigPrazo}
                onChange={(ev) => setVigPrazo(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <CampoLabel label="Unidade" required={alteraVig}>
              <div className="flex gap-3 pt-2">
                {(["DIAS", "MESES"] as Unidade[]).map((u) => (
                  <label
                    key={u}
                    className="inline-flex items-center gap-2 text-[13px] font-semibold cursor-pointer"
                    style={{ color: "var(--text)" }}
                  >
                    <input
                      type="radio"
                      name="novaVigenciaUnidade"
                      value={u}
                      checked={vigUnidade === u}
                      onChange={() => setVigUnidade(u)}
                      className="h-4 w-4"
                    />
                    {u === "DIAS" ? "Dia(s)" : "Mes(es)"}
                  </label>
                ))}
              </div>
            </CampoLabel>
            <CampoLabel label="Data de término">
              <input
                type="date"
                name="novaVigenciaFim"
                value={dataVigFim}
                readOnly
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                style={{ opacity: 0.7 }}
              />
            </CampoLabel>
          </div>
        </BlocoToggle>

        {/* BLOCO ENTREGA */}
        <BlocoToggle
          titulo="Prazo de entrega/execução?"
          ligado={alteraEnt}
          onToggle={setAlteraEnt}
          nameToggle="alteraPrazoEntrega"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CampoLabel label="Novo prazo" required={alteraEnt} auto={camposAuto.has("novoPrazoEntregaDias")}>
              <input
                type="number"
                name="novoPrazoEntregaDias"
                min="1"
                value={entPrazo}
                onChange={(ev) => setEntPrazo(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <CampoLabel label="Unidade" required={alteraEnt}>
              <div className="flex gap-3 pt-2">
                {(["DIAS", "MESES"] as Unidade[]).map((u) => (
                  <label
                    key={u}
                    className="inline-flex items-center gap-2 text-[13px] font-semibold cursor-pointer"
                    style={{ color: "var(--text)" }}
                  >
                    <input
                      type="radio"
                      name="novoPrazoEntregaUnidade"
                      value={u}
                      checked={entUnidade === u}
                      onChange={() => setEntUnidade(u)}
                      className="h-4 w-4"
                    />
                    {u === "DIAS" ? "Dia(s)" : "Mes(es)"}
                  </label>
                ))}
              </div>
            </CampoLabel>
          </div>
        </BlocoToggle>

        {/* BLOCO REAJUSTE */}
        <BlocoToggle
          titulo="Reajuste?"
          ligado={aplicaReaj}
          onToggle={setAplicaReaj}
          nameToggle="aplicaReajuste"
          destaque
          ajuda="Aplica o percentual em TODOS os itens do contrato (novo valor unitário, subtotal e total)."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <CampoLabel label="Índice" required={aplicaReaj} auto={camposAuto.has("reajusteIndice")}>
              <select
                name="reajusteIndice"
                value={reajIndice}
                onChange={(ev) => setReajIndice(ev.target.value as IndiceReajuste | "")}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              >
                <option value="">— Selecione —</option>
                {(Object.keys(ROTULO_INDICE) as IndiceReajuste[]).map((i) => (
                  <option key={i} value={i}>
                    {ROTULO_INDICE[i]}
                  </option>
                ))}
              </select>
            </CampoLabel>
            {reajIndice === "OUTRO" && (
              <CampoLabel label="Qual?" required>
                <input
                  name="reajusteIndiceOutro"
                  defaultValue={apostilamento?.reajusteIndiceOutro ?? ""}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                />
              </CampoLabel>
            )}
            <CampoLabel label="Período (início)" required={aplicaReaj}>
              <input
                type="date"
                name="reajustePeriodoInicio"
                defaultValue={toIsoDate(apostilamento?.reajustePeriodoInicio)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <CampoLabel label="Período (fim)" required={aplicaReaj}>
              <input
                type="date"
                name="reajustePeriodoFim"
                defaultValue={toIsoDate(apostilamento?.reajustePeriodoFim)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <CampoLabel label="Percentual (%)" required={aplicaReaj} auto={camposAuto.has("reajustePercentual")}>
              <input
                type="number"
                name="reajustePercentual"
                step="0.0001"
                min="-100"
                max="100"
                value={reajPctStr}
                onChange={(ev) => setReajPctStr(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
          </div>
        </BlocoToggle>

        {/* OUTRO (observações) */}
        <section>
          <Titulo>Outro (observações)</Titulo>
          <CampoLabel label="Observações" span={3} auto={camposAuto.has("observacoes")}>
            <textarea
              name="observacoes"
              rows={2}
              value={observacoes}
              onChange={(ev) => setObservacoes(ev.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
            />
          </CampoLabel>
        </section>

        {/* PDF manual */}
        {!arquivoUrlIa && (
          <section>
            <Titulo>Anexo do apostilamento (PDF)</Titulo>
            <CampoLabel label="Arquivo" span={3}>
              <input type="file" name="arquivo" accept="application/pdf" className="text-[12px]" />
            </CampoLabel>
            {apostilamento?.arquivoPdfUrl && !arquivoUrlIa && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-mute)" }}>
                Anexo atual:{" "}
                <a href={apostilamento.arquivoPdfUrl} target="_blank" rel="noreferrer" className="underline">
                  ver PDF
                </a>
              </p>
            )}
          </section>
        )}

        {state?.erro && (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{
              background: "rgba(232,138,152,0.10)",
              border: "0.5px solid rgba(232,138,152,0.3)",
              color: "var(--coral)",
            }}
          >
            <AlertCircle className="inline h-4 w-4 mr-1" />
            {state.erro}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary inline-flex">
            <Check className="h-4 w-4" /> {modo === "editar" ? "Salvar alterações" : "Cadastrar apostilamento"}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition hover:opacity-80"
            style={{
              background: "var(--glass-2)",
              border: "0.5px solid var(--border-soft)",
              color: "var(--text-soft)",
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTES (idênticos ao AditivosTab)
// ============================================================
function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mb-3 text-[12px] font-extrabold uppercase"
      style={{ letterSpacing: "0.18em", color: "var(--primary)" }}
    >
      {children}
    </h3>
  );
}

function CampoLabel({
  label,
  required,
  children,
  span = 1,
  auto,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  span?: 1 | 2 | 3 | 4;
  auto?: boolean;
}) {
  const colSpan = { 1: "", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4" }[span];
  return (
    <label className={`block ${colSpan}`}>
      <span
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase"
        style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
      >
        {label}
        {required && <span style={{ color: "var(--primary)" }}>*</span>}
        {auto && <BadgeAuto />}
      </span>
      {children}
    </label>
  );
}

function BlocoToggle({
  titulo,
  ligado,
  onToggle,
  nameToggle,
  children,
  destaque,
  ajuda,
}: {
  titulo: string;
  ligado: boolean;
  onToggle: (v: boolean) => void;
  nameToggle: string;
  children: React.ReactNode;
  destaque?: boolean;
  ajuda?: string;
}) {
  return (
    <section
      className="rounded-2xl px-5 py-4"
      style={{
        background: destaque
          ? "linear-gradient(135deg, rgba(212,175,55,0.06), rgba(197,180,255,0.04))"
          : "var(--glass-1)",
        border: `0.5px solid ${destaque ? "rgba(212,175,55,0.25)" : "var(--border-soft)"}`,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h4
            className="text-[13px] font-extrabold uppercase"
            style={{ letterSpacing: "0.14em", color: destaque ? "var(--primary-deep)" : "var(--text)" }}
          >
            {titulo}
          </h4>
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-2 text-[12px] font-semibold cursor-pointer">
              <input
                type="radio"
                name={`__${nameToggle}_view`}
                checked={!ligado}
                onChange={() => onToggle(false)}
                className="h-4 w-4"
              />
              Não
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] font-semibold cursor-pointer">
              <input
                type="radio"
                name={`__${nameToggle}_view`}
                checked={ligado}
                onChange={() => onToggle(true)}
                className="h-4 w-4"
              />
              Sim
            </label>
          </div>
        </div>
        {ajuda && (
          <p className="max-w-md text-[11px]" style={{ color: "var(--text-mute)" }}>
            {ajuda}
          </p>
        )}
      </div>
      {ligado && <input type="hidden" name={nameToggle} value="on" />}
      {ligado && <div className="mt-4">{children}</div>}
    </section>
  );
}

function ReadonlyValor({
  label,
  valor,
  texto,
}: {
  label: string;
  valor?: number;
  texto?: string;
}) {
  return (
    <div>
      <span
        className="mb-1.5 flex text-[11px] font-bold uppercase"
        style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
      >
        {label}
      </span>
      <div
        className="rounded-xl px-4 py-3 text-sm font-bold tabular-nums"
        style={{
          background: "rgba(15,14,12,0.04)",
          color: "var(--text)",
          border: "0.5px solid var(--border-soft)",
        }}
      >
        {texto ?? (valor != null ? brl(valor) : "—")}
      </div>
    </div>
  );
}

// ============================================================
// PAINEL IA (extrair PDF do apostilamento) — usa UploadPdfPanel padrão
// (mesmo layout + drag-and-drop dos demais instrumentos).
// ============================================================
function PainelIaApostilamento({
  onDados,
  onArquivo,
}: {
  onDados: (dados: ApostilamentoExtraido) => void;
  onArquivo: (url: string, nome: string) => void;
}) {
  return (
    <UploadPdfPanel<ApostilamentoExtraido>
      titulo="Preencher a partir do PDF do apostilamento"
      descricao="Anexe o PDF — a IA identifica finalidade, motivo, alterações de prazo/valor e (quando reajuste) índice + percentual."
      action={extrairApostilamentoPdfAction}
      onSuccess={onDados}
      onArquivoSalvo={(info) => onArquivo(info.url, info.nome)}
      badgeAposExtracao={() => "Campos preenchidos · revisar"}
    />
  );
}
