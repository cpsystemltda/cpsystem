"use client";

/**
 * AditivosTab — M3 v2 (layout do print Comprasnet)
 *
 * Estrutura:
 *  1) IA panel (extrai PDF do termo aditivo → preenche campos)
 *  2) Lista de aditivos cadastrados (cards com Editar / Excluir)
 *  3) Formulário em blocos toggle Não/Sim:
 *     - Valor Contratual (tipo + valor + cálculo de percentual)
 *     - Prazo de Vigência (data início + prazo + DIAS/MESES)
 *     - Prazo de Entrega/Execução (prazo + DIAS/MESES)
 *     - Reajuste (índice + período + percentual — aplica em todos os itens)
 *     - Outro (observações)
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, FileText, Check, AlertCircle } from "lucide-react";
import { brl, isContratoNaoContinuado, ROTULO_TIPO } from "@/lib/validators";
import {
  criarTermoAditivoAction,
  editarTermoAditivoAction,
  excluirTermoAditivoAction,
} from "@/app/actions/contratuais";
import { extrairAditivoPdfAction } from "@/app/actions/iaExtracao";
import { BadgeAuto } from "@/components/forms/glass";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import type { AditivoExtraido } from "@/lib/extrairAta";

type TipoAlteracaoValor = "ACRESCIMO" | "SUPRESSAO" | "REAJUSTE_REPACTUACAO" | "REEQUILIBRIO";
type IndiceReajuste =
  | "IPCA" | "IPCA_E" | "IPCA_15" | "IGPM" | "INCC" | "INPC" | "IST" | "CONTRATUAL" | "OUTRO";
type Unidade = "DIAS" | "MESES" | "ANOS";

const ROTULO_UNIDADE: Record<Unidade, string> = {
  DIAS: "Dia(s)",
  MESES: "Mes(es)",
  ANOS: "Ano(s)",
};

type Aditivo = {
  id: string;
  numero: string;
  objeto: string;
  dataAssinatura: Date;
  natureza: string;
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
  reajusteEfeitosFinanceiros: Date | null;
  observacoes: string | null;
  arquivoPdfUrl: string | null;
};

const ROTULO_TIPO_VALOR: Record<TipoAlteracaoValor, string> = {
  ACRESCIMO: "Acréscimo",
  SUPRESSAO: "Supressão",
  // Mantido no map por compat com dados legacy (renderiza certo no card),
  // mas removido das opções do form (Igor: reajuste fica no bloco próprio).
  REAJUSTE_REPACTUACAO: "Reajuste / Repactuação (legado)",
  REEQUILIBRIO: "Reequilíbrio",
};
// Tipos selecionáveis no bloco "Valor contratual". Reajuste mora no bloco
// dedicado "Reajuste?", então sai daqui (decisão Igor M3.3).
const TIPOS_VALOR_SELECIONAVEIS: TipoAlteracaoValor[] = ["ACRESCIMO", "SUPRESSAO", "REEQUILIBRIO"];

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
  // Usa UTC pra evitar D-1 no input type=date
  return d.toISOString().slice(0, 10);
}

function calcularDataFim(inicio: string, prazo: number, unidade: Unidade): string {
  if (!inicio || !prazo) return "";
  const d = new Date(`${inicio}T12:00:00.000Z`);
  if (unidade === "ANOS") d.setUTCFullYear(d.getUTCFullYear() + prazo);
  else if (unidade === "MESES") d.setUTCMonth(d.getUTCMonth() + prazo);
  else d.setUTCDate(d.getUTCDate() + prazo);
  return d.toISOString().slice(0, 10);
}

export function AditivosTab({
  aditivos,
  contratoId,
  empenhoId,
  ataId,
  contratoTipo,
  valorInicialContrato,
  valorAtualContrato,
}: {
  aditivos: Aditivo[];
  contratoId?: string;
  empenhoId?: string;
  ataId?: string;
  contratoTipo?: keyof typeof ROTULO_TIPO;
  valorInicialContrato?: number;
  valorAtualContrato?: number;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const editando = editandoId ? aditivos.find((a) => a.id === editandoId) : null;
  const naoContinuado = !!contratoTipo && isContratoNaoContinuado(contratoTipo);

  return (
    <div className="space-y-6">
      {naoContinuado && (
        <p
          className="glass-tile rounded-2xl px-4 py-3 text-[12px]"
          style={{ color: "var(--text-soft)" }}
        >
          <strong style={{ color: "var(--primary-deep)" }}>Atenção:</strong> contrato do tipo{" "}
          <em>{ROTULO_TIPO[contratoTipo!]}</em> não admite prorrogação de vigência (Lei 14.133 —
          fluxograma do contrato independente). Outros aditivos (valor, entrega, reajuste)
          seguem permitidos.
        </p>
      )}

      {/* Lista de aditivos cadastrados */}
      {aditivos.length > 0 && (
        <div className="space-y-3">
          {aditivos.map((a) => (
            <CardAditivo
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
              naoContinuado={naoContinuado}
              valorInicial={valorInicialContrato}
              valorAtual={valorAtualContrato}
            />
          ))}
        </div>
      )}

      {/* Botão pra criar novo */}
      {!criando && !editandoId && (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="btn-primary inline-flex"
        >
          + Cadastrar termo aditivo
        </button>
      )}

      {/* Formulário de cadastro */}
      {criando && !editandoId && (
        <FormularioAditivo
          modo="criar"
          contratoId={contratoId}
          empenhoId={empenhoId}
          ataId={ataId}
          naoContinuado={naoContinuado}
          valorInicial={valorInicialContrato}
          valorAtual={valorAtualContrato}
          onCancelar={() => setCriando(false)}
          onSalvo={() => setCriando(false)}
        />
      )}

      {/* Inline edit (renderizado dentro do CardAditivo via prop editando) */}
      {editando && null}
    </div>
  );
}

// ============================================================
// CARD DE ADITIVO CADASTRADO
// ============================================================
function CardAditivo({
  a,
  editando,
  onEditar,
  onCancelar,
  onSalvo,
  contratoId,
  empenhoId,
  ataId,
  naoContinuado,
  valorInicial,
  valorAtual,
}: {
  a: Aditivo;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvo: () => void;
  contratoId?: string;
  empenhoId?: string;
  ataId?: string;
  naoContinuado: boolean;
  valorInicial?: number;
  valorAtual?: number;
}) {
  const [excluirState, excluirAction] = useActionState(excluirTermoAditivoAction, null);

  if (editando) {
    return (
      <FormularioAditivo
        modo="editar"
        aditivo={a}
        contratoId={contratoId}
        empenhoId={empenhoId}
        ataId={ataId}
        naoContinuado={naoContinuado}
        valorInicial={valorInicial}
        valorAtual={valorAtual}
        onCancelar={onCancelar}
        onSalvo={onSalvo}
      />
    );
  }

  return (
    <article
      className="glass-tile rounded-[20px] px-5 py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h4
              className="text-[15px] font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
            >
              Aditivo {a.numero}
            </h4>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-mute)" }}
            >
              {a.dataAssinatura.toLocaleDateString("pt-BR")}
            </span>
          </div>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
            {a.objeto}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.alteraValor && (
              <Pill
                cor="primary"
                texto={
                  a.tipoAlteracaoValor
                    ? `${ROTULO_TIPO_VALOR[a.tipoAlteracaoValor]}${a.novoValor ? ` · ${brl(a.novoValor)}` : ""}`
                    : `Altera valor${a.novoValor ? ` · ${brl(a.novoValor)}` : ""}`
                }
              />
            )}
            {a.alteraPrazoVigencia && a.novaVigenciaFim && (
              <Pill
                cor="mint"
                texto={`Nova vigência até ${a.novaVigenciaFim.toLocaleDateString("pt-BR")}`}
              />
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
              title="Editar aditivo"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <form action={excluirAction}>
              <input type="hidden" name="aditivoId" value={a.id} />
              <button
                type="submit"
                onClick={(ev) => {
                  if (
                    !window.confirm(
                      `Excluir aditivo ${a.numero}?\n\nAs alterações no contrato/ata (valor, vigência, prazo de entrega e itens) serão revertidas ao estado anterior a este aditivo.`,
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
                title="Excluir aditivo"
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
      style={{ background: bg, color: fg, border: "0.5px solid currentColor", borderColor: "transparent" }}
    >
      {texto}
    </span>
  );
}

// ============================================================
// FORMULÁRIO (criar ou editar)
// ============================================================
function FormularioAditivo({
  modo,
  aditivo,
  contratoId,
  empenhoId,
  ataId,
  naoContinuado,
  valorInicial,
  valorAtual,
  onCancelar,
  onSalvo,
}: {
  modo: "criar" | "editar";
  aditivo?: Aditivo;
  contratoId?: string;
  empenhoId?: string;
  ataId?: string;
  naoContinuado: boolean;
  valorInicial?: number;
  valorAtual?: number;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const action = modo === "editar" ? editarTermoAditivoAction : criarTermoAditivoAction;
  const [state, formAction] = useActionState(action, null);

  // ----- Estados controlados (necessários pra UI condicional dos toggles) -----
  const [alteraValor, setAlteraValor] = useState(aditivo?.alteraValor ?? false);
  const [tipoValor, setTipoValor] = useState<TipoAlteracaoValor | "">(
    aditivo?.tipoAlteracaoValor ?? "",
  );
  const [novoValor, setNovoValor] = useState<string>(
    aditivo?.novoValor != null ? String(aditivo.novoValor) : "",
  );

  const [alteraVig, setAlteraVig] = useState(aditivo?.alteraPrazoVigencia ?? false);
  const [vigInicio, setVigInicio] = useState(toIsoDate(aditivo?.novaVigenciaInicio));
  const [vigPrazo, setVigPrazo] = useState<string>(
    aditivo?.novaVigenciaPrazo != null ? String(aditivo.novaVigenciaPrazo) : "",
  );
  const [vigUnidade, setVigUnidade] = useState<Unidade>(
    aditivo?.novaVigenciaUnidade ?? "MESES",
  );

  const [alteraEnt, setAlteraEnt] = useState(aditivo?.alteraPrazoEntrega ?? false);
  const [entPrazo, setEntPrazo] = useState<string>(
    aditivo?.novoPrazoEntregaDias != null ? String(aditivo.novoPrazoEntregaDias) : "",
  );
  const [entUnidade, setEntUnidade] = useState<Unidade>(
    aditivo?.novoPrazoEntregaUnidade ?? "DIAS",
  );

  const [aplicaReaj, setAplicaReaj] = useState(aditivo?.aplicaReajuste ?? false);
  const [reajIndice, setReajIndice] = useState<IndiceReajuste | "">(
    aditivo?.reajusteIndice ?? "",
  );
  const [reajPctStr, setReajPctStr] = useState<string>(
    aditivo?.reajustePercentual != null ? String(aditivo.reajustePercentual) : "",
  );

  // ----- IA (apenas modo criar) -----
  const [arquivoUrlIa, setArquivoUrlIa] = useState<string | null>(null);
  const [arquivoNomeIa, setArquivoNomeIa] = useState<string | null>(null);
  const [camposAuto, setCamposAuto] = useState<Set<string>>(new Set());
  // Itens da nova vigência extraídos pela IA do PDF do aditivo (quando o
  // aditivo prorroga vigência E traz tabela explícita de itens novos).
  // Quando preenchido, será enviado via hidden input pra criar a nova
  // Vigência com esses itens (em vez de copiar os da vigência anterior).
  const [itensNovaVigenciaIa, setItensNovaVigenciaIa] = useState<
    AditivoExtraido["itensNovaVigencia"]
  >(null);

  const [numero, setNumero] = useState(aditivo?.numero ?? "");
  const [objeto, setObjeto] = useState(aditivo?.objeto ?? "");
  const [dataAssinatura, setDataAssinatura] = useState(toIsoDate(aditivo?.dataAssinatura));
  const [observacoes, setObservacoes] = useState(aditivo?.observacoes ?? "");

  function aplicarDadosIa(d: AditivoExtraido) {
    const auto = new Set<string>();
    // Quando a IA detecta um reajuste, ele cai no bloco dedicado "Reajuste?".
    // Não duplica como "tipo=REAJUSTE_REPACTUACAO" no bloco Valor Contratual
    // (que agora só aceita Acréscimo/Supressão/Reequilíbrio — Igor: "retirar
    // o nome Reajuste da parte Valor Contratual").
    const ehReajustePuro = !!d.aplicaReajuste;

    if (d.numero) {
      setNumero(d.numero);
      auto.add("numero");
    }
    if (d.objeto) {
      setObjeto(d.objeto);
      auto.add("objeto");
    }
    if (d.dataAssinatura) {
      setDataAssinatura(d.dataAssinatura);
      auto.add("dataAssinatura");
    }
    // Bloco Valor — só ativa se NÃO for reajuste puro. Se a IA marcou
    // alteraValor=true junto com aplicaReajuste=true, prioriza o reajuste.
    if (d.alteraValor && !ehReajustePuro) {
      setAlteraValor(true);
      auto.add("alteraValor");
      // REAJUSTE_REPACTUACAO não é mais uma opção do form — mapeia pra
      // reajuste no bloco dedicado (caso de aditivo legado/IA sem flag).
      if (d.tipoAlteracaoValor === "REAJUSTE_REPACTUACAO") {
        setAplicaReaj(true);
        auto.add("aplicaReajuste");
        if (d.novoValor != null) {
          setNovoValor(String(d.novoValor));
          auto.add("novoValor");
        }
      } else if (d.tipoAlteracaoValor) {
        setTipoValor(d.tipoAlteracaoValor);
        auto.add("tipoAlteracaoValor");
        if (d.novoValor != null) {
          setNovoValor(String(d.novoValor));
          auto.add("novoValor");
        }
      }
    }
    if (d.alteraPrazoVigencia) {
      setAlteraVig(true);
      auto.add("alteraPrazoVigencia");
      if (d.novaVigenciaInicio) {
        setVigInicio(d.novaVigenciaInicio);
        auto.add("novaVigenciaInicio");
      }
      if (d.novaVigenciaPrazo != null) {
        setVigPrazo(String(d.novaVigenciaPrazo));
        auto.add("novaVigenciaPrazo");
      }
      if (d.novaVigenciaUnidade) {
        setVigUnidade(d.novaVigenciaUnidade);
      }
    }
    if (d.alteraPrazoEntrega) {
      setAlteraEnt(true);
      auto.add("alteraPrazoEntrega");
      if (d.novoPrazoEntregaDias != null) {
        setEntPrazo(String(d.novoPrazoEntregaDias));
        auto.add("novoPrazoEntregaDias");
      }
      if (d.novoPrazoEntregaUnidade) setEntUnidade(d.novoPrazoEntregaUnidade);
    }
    if (d.aplicaReajuste) {
      setAplicaReaj(true);
      auto.add("aplicaReajuste");
      if (d.reajusteIndice) {
        setReajIndice(d.reajusteIndice);
        auto.add("reajusteIndice");
      }
      if (d.reajustePercentual != null) {
        setReajPctStr(String(d.reajustePercentual));
        auto.add("reajustePercentual");
      }
    }
    if (d.observacoes) {
      setObservacoes(d.observacoes);
      auto.add("observacoes");
    }
    // Itens da nova vigência (quando aditivo prorroga + lista explícita).
    if (d.itensNovaVigencia && d.itensNovaVigencia.length > 0) {
      setItensNovaVigenciaIa(d.itensNovaVigencia);
      auto.add("itensNovaVigencia");
    } else {
      setItensNovaVigenciaIa(null);
    }
    setCamposAuto(auto);
  }

  // ----- Cálculos derivados -----
  const dataVigFim = useMemo(
    () => calcularDataFim(vigInicio, Number(vigPrazo) || 0, vigUnidade),
    [vigInicio, vigPrazo, vigUnidade],
  );

  const valorNumerico = Number(novoValor) || 0;
  const valorBase = valorAtual ?? valorInicial ?? 0;
  const percentualAditivo = valorBase > 0 && valorNumerico > 0
    ? (valorNumerico / valorBase) * 100
    : 0;

  // ----- Submit -----
  useEffect(() => {
    if (state?.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <div className="space-y-4">
      {modo === "criar" && <PainelIaAditivo onDados={aplicarDadosIa} onArquivo={(url, nome) => {
        setArquivoUrlIa(url);
        setArquivoNomeIa(nome);
      }} />}

      <form
        action={formAction}
        className="glass rounded-[24px] px-7 py-6 space-y-7"
        style={{ background: "var(--glass-2)" }}
      >
        {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
        {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
        {ataId && <input type="hidden" name="ataId" value={ataId} />}
        {modo === "editar" && aditivo && (
          <input type="hidden" name="aditivoId" value={aditivo.id} />
        )}
        {arquivoUrlIa && (
          <>
            <input type="hidden" name="arquivoPdfUrl" value={arquivoUrlIa} />
            <input type="hidden" name="arquivoPdfNome" value={arquivoNomeIa ?? ""} />
          </>
        )}
        {itensNovaVigenciaIa && itensNovaVigenciaIa.length > 0 && (
          <input
            type="hidden"
            name="itensNovaVigenciaJson"
            value={JSON.stringify(itensNovaVigenciaIa)}
          />
        )}

        {/* Identificação */}
        <section>
          <Titulo>Identificação do aditivo</Titulo>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <CampoLabel label="Número do termo aditivo" required auto={camposAuto.has("numero")}>
              <input
                name="numero"
                required
                value={numero}
                onChange={(ev) => setNumero(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                placeholder="ex: 01/2026"
              />
            </CampoLabel>
            <CampoLabel
              label="Data de assinatura"
              required
              auto={camposAuto.has("dataAssinatura")}
            >
              <input
                type="date"
                name="dataAssinatura"
                required
                value={dataAssinatura}
                onChange={(ev) => setDataAssinatura(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <div /> {/* placeholder pra alinhar grid */}
            <CampoLabel label="Objeto do aditivo" required span={3} auto={camposAuto.has("objeto")}>
              <textarea
                name="objeto"
                required
                value={objeto}
                onChange={(ev) => setObjeto(ev.target.value)}
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                placeholder="Descreva a alteração realizada"
              />
            </CampoLabel>
          </div>
        </section>

        {/* BLOCO 1: VALOR CONTRATUAL */}
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
                  {TIPOS_VALOR_SELECIONAVEIS.map((t) => (
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
                <p className="mt-2 text-[11px]" style={{ color: "var(--text-mute)" }}>
                  Reajuste/repactuação por índice? Use o bloco{" "}
                  <strong>Reajuste?</strong> abaixo — aplica em todos os itens do contrato.
                </p>
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
                label="Percentual do Aditivo"
                texto={percentualAditivo > 0 ? `${percentualAditivo.toFixed(4).replace(".", ",")}%` : "—"}
              />
            </div>
          </div>
        </BlocoToggle>

        {/* BLOCO 2: PRAZO DE VIGÊNCIA */}
        <BlocoToggle
          titulo="Prazo de vigência?"
          ligado={alteraVig}
          onToggle={setAlteraVig}
          nameToggle="alteraPrazoVigencia"
          desabilitado={naoContinuado}
          aviso={
            naoContinuado
              ? "Contrato não-continuado não admite prorrogação de vigência (Lei 14.133)."
              : undefined
          }
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
                placeholder="ex: 12"
              />
            </CampoLabel>
            <CampoLabel label="Unidade" required={alteraVig}>
              <div className="flex flex-wrap gap-3 pt-2">
                {(["DIAS", "MESES", "ANOS"] as Unidade[]).map((u) => (
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
                    {ROTULO_UNIDADE[u]}
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
                title="Calculado automaticamente a partir da data de início + prazo"
              />
            </CampoLabel>
          </div>
        </BlocoToggle>

        {/* BLOCO 3: PRAZO DE ENTREGA/EXECUÇÃO */}
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
                placeholder="ex: 30"
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

        {/* BLOCO 4: REAJUSTE */}
        <BlocoToggle
          titulo="Reajuste?"
          ligado={aplicaReaj}
          onToggle={setAplicaReaj}
          nameToggle="aplicaReajuste"
          destaque
          ajuda="Aplica o percentual em TODOS os itens do contrato (novo valor unitário, subtotal e total). A alteração é refletida imediatamente na tela principal."
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
                  defaultValue={aditivo?.reajusteIndiceOutro ?? ""}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                  placeholder="ex: ICV-DF"
                />
              </CampoLabel>
            )}
            <CampoLabel label="Período (início)" required={aplicaReaj}>
              <input
                type="date"
                name="reajustePeriodoInicio"
                defaultValue={toIsoDate(aditivo?.reajustePeriodoInicio)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <CampoLabel label="Período (fim)" required={aplicaReaj}>
              <input
                type="date"
                name="reajustePeriodoFim"
                defaultValue={toIsoDate(aditivo?.reajustePeriodoFim)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
            </CampoLabel>
            <CampoLabel label="Percentual de reajuste (%)" required={aplicaReaj} auto={camposAuto.has("reajustePercentual")}>
              <input
                type="number"
                name="reajustePercentual"
                step="0.0001"
                min="-100"
                max="100"
                value={reajPctStr}
                onChange={(ev) => setReajPctStr(ev.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                placeholder="ex: 4,85"
              />
            </CampoLabel>
            <CampoLabel
              label="Efeitos financeiros (a partir de)"
              required={aplicaReaj}
              span={2}
            >
              <input
                type="date"
                name="reajusteEfeitosFinanceiros"
                defaultValue={toIsoDate(aditivo?.reajusteEfeitosFinanceiros)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              />
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-mute)" }}>
                Empenhos emitidos a partir desta data usam o valor reajustado.
                Anteriores ficam com o valor original.
              </p>
            </CampoLabel>
          </div>
        </BlocoToggle>

        {/* Itens da nova vigência (extraídos pela IA) — só aparece quando
            o aditivo prorroga vigência E o PDF trazia tabela explícita. */}
        {itensNovaVigenciaIa && itensNovaVigenciaIa.length > 0 && (
          <section>
            <Titulo>
              Itens da nova vigência
              <span
                className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(124,58,237,0.14)",
                  color: "#6d28d9",
                  border: "0.5px solid rgba(124,58,237,0.24)",
                }}
              >
                IA extraiu
              </span>
            </Titulo>
            <p className="mb-2 text-[12px]" style={{ color: "var(--text-soft)" }}>
              Estes itens serão criados na nova vigência (Vigência N+1) ao salvar.
              Se a tabela estiver errada, ignore esta seção — você pode editar
              os itens depois na aba Saldo do contrato.
            </p>
            <div
              className="overflow-x-auto rounded-xl"
              style={{ border: "0.5px solid var(--hairline)" }}
            >
              <table className="w-full text-[12px]">
                <thead style={{ background: "rgba(15,14,12,0.03)" }}>
                  <tr>
                    <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
                      Descrição
                    </th>
                    <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
                      Un.
                    </th>
                    <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
                      Qtd.
                    </th>
                    <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
                      Marca
                    </th>
                    <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
                      Valor unit.
                    </th>
                    <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itensNovaVigenciaIa.map((it, i) => (
                    <tr key={i} style={{ borderTop: "0.5px solid var(--hairline)" }}>
                      <td className="px-3 py-1.5">{it.descricao}</td>
                      <td className="px-3 py-1.5">{it.unidade}</td>
                      <td className="px-3 py-1.5 text-right">{it.quantidade}</td>
                      <td className="px-3 py-1.5">{it.marca ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right">{brl(it.valorUnitario)}</td>
                      <td className="px-3 py-1.5 text-right font-bold">
                        {brl(it.quantidade * it.valorUnitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setItensNovaVigenciaIa(null)}
              className="mt-2 text-[11px] font-semibold underline"
              style={{ color: "var(--text-mute)" }}
              title="Remove os itens da IA. A nova vigência vai copiar itens da vigência anterior automaticamente."
            >
              Descartar itens da IA (usar cópia da vigência anterior)
            </button>
          </section>
        )}

        {/* BLOCO 5: OUTRO (observações) */}
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

        {/* PDF manual (fallback caso IA não tenha sido usada). Usa input file
            nativo dentro do form — vai junto no FormData pra
            criar/editarTermoAditivoAction. Mesmo padrao do ApostilamentosTab
            (que funciona). Antes usava UploadArquivoSimples + server action
            intermediaria, que falhava silenciosamente. */}
        {!arquivoUrlIa && (
          <section>
            <Titulo>Anexo do termo aditivo (PDF)</Titulo>
            <CampoLabel label="Arquivo" span={3}>
              <input type="file" name="arquivo" accept="application/pdf" className="text-[12px]" />
            </CampoLabel>
            {aditivo?.arquivoPdfUrl && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-mute)" }}>
                Anexo atual:{" "}
                <a
                  href={aditivo.arquivoPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  ver PDF
                </a>
                . Anexar novo arquivo substitui.
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
            <Check className="h-4 w-4" /> {modo === "editar" ? "Salvar alterações" : "Cadastrar aditivo"}
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
// SUBCOMPONENTES
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
  desabilitado,
  aviso,
  destaque,
  ajuda,
}: {
  titulo: string;
  ligado: boolean;
  onToggle: (v: boolean) => void;
  nameToggle: string;
  children: React.ReactNode;
  desabilitado?: boolean;
  aviso?: string;
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
                disabled={desabilitado}
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
                disabled={desabilitado}
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
      {/* hidden input pro form (alteraValor=on quando ligado) */}
      {ligado && <input type="hidden" name={nameToggle} value="on" />}
      {aviso && (
        <p
          className="mt-2 text-[11px]"
          style={{ color: "var(--coral)" }}
        >
          {aviso}
        </p>
      )}
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
// PAINEL IA (extrair PDF do aditivo) — usa UploadPdfPanel padrão
// (mesmo layout + drag-and-drop usados em Ata/Contrato/Empenho/Garantia).
// ============================================================
function PainelIaAditivo({
  onDados,
  onArquivo,
}: {
  onDados: (dados: AditivoExtraido) => void;
  onArquivo: (url: string, nome: string) => void;
}) {
  return (
    <UploadPdfPanel<AditivoExtraido>
      titulo="Preencher a partir do PDF do termo aditivo"
      descricao="Anexe o PDF — a IA extrai número, objeto, data, tipo de alteração, prazo e (quando houver) índice de reajuste com percentual. Você confere antes de salvar."
      action={extrairAditivoPdfAction}
      onSuccess={onDados}
      onArquivoSalvo={(info) => onArquivo(info.url, info.nome)}
      badgeAposExtracao={() => "Campos preenchidos · revisar"}
    />
  );
}
