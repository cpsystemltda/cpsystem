"use client";

/**
 * NotificacoesTab — M3
 *
 * - Cadastro de notificação (botão +).
 * - Edição dos campos lançados (corrige assunto, prazo, troca PDF).
 * - Linha do tempo de andamentos (recebida → em tratativa → respondida → finalizada).
 * - Upload de arquivo OPCIONAL em cada andamento (comprovante, resposta enviada, etc.).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, FileText, Plus, AlertCircle, Check, Upload, Clock, Trash2, X, Paperclip } from "lucide-react";
import {
  criarNotificacaoAction,
  editarNotificacaoAction,
  avancarNotificacaoAction,
  editarAndamentoNotificacaoAction,
  excluirAndamentoNotificacaoAction,
} from "@/app/actions/contratuais";

type Andamento = {
  id: string;
  status: string;
  descricao: string;
  dataEvento: Date;
  arquivoPdfUrl: string | null;
};

type Notificacao = {
  id: string;
  numero: string | null;
  assunto: string;
  descricao: string;
  dataRecebimento: Date;
  prazoResposta: number | null;
  status: string;
  arquivoPdfUrl: string | null;
  andamentos: Andamento[];
};

const COR_STATUS: Record<string, { bg: string; fg: string }> = {
  RECEBIDA: { bg: "rgba(212,175,55,0.18)", fg: "var(--primary-deep)" },
  EM_TRATATIVA: { bg: "rgba(63,99,143,0.18)", fg: "var(--sky-deep, #3F638F)" },
  RESPONDIDA: { bg: "rgba(197,180,255,0.18)", fg: "var(--lavender-deep, #6B5BB8)" },
  FINALIZADA: { bg: "rgba(93,216,182,0.18)", fg: "var(--mint)" },
};

const ROTULO_STATUS: Record<string, string> = {
  RECEBIDA: "Recebida",
  EM_TRATATIVA: "Em tratativa",
  RESPONDIDA: "Respondida",
  FINALIZADA: "Finalizada",
};

function toIsoDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function NotificacoesTab({
  notificacoes,
  ataId,
  contratoId,
  empenhoId,
}: {
  notificacoes: Notificacao[];
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
}) {
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {notificacoes.length > 0 && (
        <ul className="space-y-3">
          {notificacoes.map((n) => (
            <CardNotificacao
              key={n.id}
              n={n}
              editando={editandoId === n.id}
              onEditar={() => {
                setCriando(false);
                setEditandoId(n.id);
              }}
              onCancelar={() => setEditandoId(null)}
              onSalvo={() => setEditandoId(null)}
            />
          ))}
        </ul>
      )}

      {!criando && !editandoId && (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="btn-primary inline-flex"
        >
          <Plus className="h-4 w-4" /> Cadastrar notificação
        </button>
      )}

      {criando && !editandoId && (
        <FormularioCriarNotificacao
          ataId={ataId}
          contratoId={contratoId}
          empenhoId={empenhoId}
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
function CardNotificacao({
  n,
  editando,
  onEditar,
  onCancelar,
  onSalvo,
}: {
  n: Notificacao;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const prazoFinal = n.prazoResposta
    ? new Date(n.dataRecebimento.getTime() + n.prazoResposta * 86400000)
    : null;
  const diasRestantes = prazoFinal ? Math.ceil((prazoFinal.getTime() - Date.now()) / 86400000) : null;
  const cor = COR_STATUS[n.status] ?? COR_STATUS.RECEBIDA;
  const prazoCritico = diasRestantes !== null && diasRestantes < 3;

  if (editando) {
    return (
      <li>
        <FormularioEditarNotificacao
          notificacao={n}
          onCancelar={onCancelar}
          onSalvo={onSalvo}
        />
      </li>
    );
  }

  return (
    <li className="glass-tile rounded-[20px] px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              className="text-[15px] font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
            >
              {n.assunto}
            </h4>
            <span
              className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ background: cor.bg, color: cor.fg }}
            >
              {ROTULO_STATUS[n.status] ?? n.status}
            </span>
          </div>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
            {n.descricao}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-mute)" }}>
            {n.numero && <span><strong>Nº</strong> {n.numero}</span>}
            <span>Recebida em {n.dataRecebimento.toLocaleDateString("pt-BR")}</span>
            {prazoFinal && (
              <span
                className="inline-flex items-center gap-1 font-semibold"
                style={{ color: prazoCritico ? "var(--coral)" : "var(--text-soft)" }}
              >
                <Clock className="h-3 w-3" /> Prazo: {prazoFinal.toLocaleDateString("pt-BR")}
                {diasRestantes !== null &&
                  (diasRestantes >= 0
                    ? ` · ${diasRestantes} dia(s) restantes`
                    : ` · ${-diasRestantes} dia(s) em atraso`)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {n.arquivoPdfUrl && (
            <a
              href={n.arquivoPdfUrl}
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
          <button
            type="button"
            onClick={onEditar}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
            style={{
              background: "rgba(212,175,55,0.12)",
              color: "var(--primary-deep)",
              border: "0.5px solid rgba(168,137,71,0.3)",
            }}
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        </div>
      </div>

      {/* Timeline de andamentos — cada um editável/excluível (Regina:
          "cada etapa de lançamento da notificação deve permitir a edição") */}
      {n.andamentos.length > 0 && (
        <ol
          className="mt-4 space-y-2 border-l-2 pl-4"
          style={{ borderColor: "var(--border-soft)" }}
        >
          {n.andamentos.map((a) => (
            <AndamentoItem key={a.id} a={a} />
          ))}
        </ol>
      )}

      {/* Formulário avançar (só se não estiver FINALIZADA) */}
      {n.status !== "FINALIZADA" && <FormularioAvancar notificacaoId={n.id} />}
    </li>
  );
}

// ============================================================
// FORM: avançar status (adicionar andamento)
// ============================================================
function FormularioAvancar({ notificacaoId }: { notificacaoId: string }) {
  const [aberto, setAberto] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
        style={{
          background: "var(--glass-1)",
          color: "var(--text-soft)",
          border: "0.5px solid var(--border-soft)",
        }}
      >
        <Plus className="h-3 w-3" /> Avançar status
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={avancarNotificacaoAction}
      className="mt-3 rounded-xl px-4 py-3"
      style={{ background: "var(--glass-1)", border: "0.5px solid var(--border-soft)" }}
    >
      <input type="hidden" name="notificacaoId" value={notificacaoId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Status
          </span>
          <select
            name="status"
            required
            className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
          >
            <option value="EM_TRATATIVA">Em tratativa</option>
            <option value="RESPONDIDA">Respondida</option>
            <option value="FINALIZADA">Finalizada</option>
          </select>
        </label>
        <label className="block">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Data
          </span>
          <input
            type="date"
            name="dataEvento"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
          />
        </label>
        <label className="block">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Anexo (PDF, opcional)
          </span>
          <input
            type="file"
            name="arquivo"
            accept="application/pdf"
            className="w-full text-[11px]"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span
          className="mb-1 flex text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
        >
          Descrição
        </span>
        <input
          name="descricao"
          required
          placeholder="ex.: Resposta enviada ao órgão via ofício 42/2026"
          className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
        />
      </label>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" className="btn-primary inline-flex">
          <Check className="h-4 w-4" /> Adicionar andamento
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:opacity-80"
          style={{
            background: "var(--glass-2)",
            color: "var(--text-soft)",
            border: "0.5px solid var(--border-soft)",
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ============================================================
// FORM: criar notificação
// ============================================================
function FormularioCriarNotificacao({
  ataId,
  contratoId,
  empenhoId,
  onCancelar,
  onSalvo,
}: {
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const [state, formAction] = useActionState(criarNotificacaoAction, null);

  useEffect(() => {
    if (state?.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form
      action={formAction}
      className="glass rounded-[24px] px-6 py-5 space-y-4"
      style={{ background: "var(--glass-2)" }}
    >
      {ataId && <input type="hidden" name="ataId" value={ataId} />}
      {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
      {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
      <h3
        className="text-[12px] font-extrabold uppercase"
        style={{ letterSpacing: "0.18em", color: "var(--primary)" }}
      >
        Nova notificação
      </h3>
      <CamposNotificacao />
      <BotoesForm
        labelSalvar="Cadastrar notificação"
        onCancelar={onCancelar}
        erro={state?.erro}
      />
    </form>
  );
}

// ============================================================
// FORM: editar notificação
// ============================================================
function FormularioEditarNotificacao({
  notificacao,
  onCancelar,
  onSalvo,
}: {
  notificacao: Notificacao;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const [state, formAction] = useActionState(editarNotificacaoAction, null);

  useEffect(() => {
    if (state?.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form
      action={formAction}
      className="glass rounded-[24px] px-6 py-5 space-y-4"
      style={{ background: "var(--glass-2)" }}
    >
      <input type="hidden" name="notificacaoId" value={notificacao.id} />
      <h3
        className="text-[12px] font-extrabold uppercase"
        style={{ letterSpacing: "0.18em", color: "var(--primary)" }}
      >
        Editar notificação
      </h3>
      <CamposNotificacao defaults={notificacao} />
      {notificacao.arquivoPdfUrl && (
        <p className="text-[11px]" style={{ color: "var(--text-mute)" }}>
          Anexo atual:{" "}
          <a
            href={notificacao.arquivoPdfUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            ver PDF
          </a>
          . Anexar novo arquivo substitui.
        </p>
      )}
      <BotoesForm
        labelSalvar="Salvar alterações"
        onCancelar={onCancelar}
        erro={state?.erro}
      />
    </form>
  );
}

function CamposNotificacao({ defaults }: { defaults?: Notificacao }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <CampoTexto label="Número" name="numero" defaultValue={defaults?.numero ?? ""} />
      <CampoTexto
        label="Data de recebimento"
        name="dataRecebimento"
        type="date"
        required
        defaultValue={toIsoDate(defaults?.dataRecebimento) || new Date().toISOString().slice(0, 10)}
      />
      <CampoTexto
        label="Assunto"
        name="assunto"
        required
        span={2}
        defaultValue={defaults?.assunto ?? ""}
      />
      <label className="block md:col-span-2">
        <span
          className="mb-1.5 flex text-[11px] font-bold uppercase"
          style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
        >
          Descrição *
        </span>
        <textarea
          name="descricao"
          required
          rows={3}
          defaultValue={defaults?.descricao ?? ""}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium"
        />
      </label>
      <CampoTexto
        label="Prazo de resposta (dias)"
        name="prazoResposta"
        type="number"
        defaultValue={defaults?.prazoResposta != null ? String(defaults.prazoResposta) : ""}
      />
      <label className="block">
        <span
          className="mb-1.5 flex text-[11px] font-bold uppercase"
          style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
        >
          Arquivo (PDF)
        </span>
        <input type="file" name="arquivo" accept="application/pdf" className="text-[12px]" />
      </label>
    </div>
  );
}

function CampoTexto({
  label,
  name,
  type = "text",
  required,
  span = 1,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  span?: 1 | 2;
  defaultValue?: string;
}) {
  const cls = span === 2 ? "md:col-span-2" : "";
  return (
    <label className={`block ${cls}`}>
      <span
        className="mb-1.5 flex text-[11px] font-bold uppercase"
        style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
      >
        {label}
        {required && <span style={{ color: "var(--primary)" }}> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium"
      />
    </label>
  );
}

function BotoesForm({
  labelSalvar,
  onCancelar,
  erro,
}: {
  labelSalvar: string;
  onCancelar: () => void;
  erro?: string;
}) {
  return (
    <>
      {erro && (
        <div
          className="rounded-xl px-4 py-3 text-[13px]"
          style={{
            background: "rgba(232,138,152,0.10)",
            border: "0.5px solid rgba(232,138,152,0.3)",
            color: "var(--coral)",
          }}
        >
          <AlertCircle className="inline h-4 w-4 mr-1" />
          {erro}
        </div>
      )}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="btn-primary inline-flex">
          <Check className="h-4 w-4" /> {labelSalvar}
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
    </>
  );
}


// ============================================================
// Andamento — item da timeline com edição inline e exclusão
// ============================================================
function AndamentoItem({ a }: { a: Andamento }) {
  const [editando, setEditando] = useState(false);
  const corA = COR_STATUS[a.status] ?? COR_STATUS.RECEBIDA;
  const [stateEditar, formEditar] = useActionState(editarAndamentoNotificacaoAction, null);

  useEffect(() => {
    if (stateEditar?.ok) setEditando(false);
  }, [stateEditar]);

  function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  return (
    <li className="relative group">
      <span
        className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full"
        style={{ background: corA.fg, boxShadow: "0 0 0 3px var(--bg)" }}
      />

      {editando ? (
        <form action={formEditar} className="rounded-xl p-3 space-y-2" style={{ background: "rgba(212,175,55,0.08)", border: "0.5px solid var(--border-soft)" }}>
          <input type="hidden" name="andamentoId" value={a.id} />
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[11px] font-bold" style={{ color: corA.fg, letterSpacing: "0.06em" }}>
              {ROTULO_STATUS[a.status] ?? a.status}
            </span>
            <label className="text-[11px]" style={{ color: "var(--text-mute)" }}>Data do evento</label>
            <input
              type="date"
              name="dataEvento"
              defaultValue={isoDate(a.dataEvento)}
              required
              className="rounded-md px-2 py-1 text-[11px] outline-none focus:ring-2 focus:ring-blue-100"
              style={{ background: "white", border: "0.5px solid var(--border-soft)" }}
            />
          </div>
          <textarea
            name="descricao"
            defaultValue={a.descricao}
            rows={2}
            required
            className="w-full rounded-md px-2 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-blue-100"
            style={{ background: "white", border: "0.5px solid var(--border-soft)" }}
          />
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]" style={{ color: "var(--text-soft)" }}>
            <Paperclip className="h-3 w-3" />
            <span>{a.arquivoPdfUrl ? "Substituir arquivo (opcional)" : "Anexar arquivo (opcional)"}</span>
            <input
              type="file"
              name="arquivo"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const label = e.target.parentElement?.querySelector("span");
                if (label) label.textContent = e.target.files?.[0]?.name ?? (a.arquivoPdfUrl ? "Substituir arquivo (opcional)" : "Anexar arquivo (opcional)");
              }}
            />
          </label>
          {stateEditar?.erro && (
            <p className="text-[11px] font-semibold text-red-700">{stateEditar.erro}</p>
          )}
          <div className="flex items-center gap-2">
            <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700">
              <Check className="h-3 w-3" /> Salvar
            </button>
            <button type="button" onClick={() => setEditando(false)} className="text-[11px] text-slate-400 hover:text-slate-600">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-bold"
              style={{ color: corA.fg, letterSpacing: "0.06em" }}
            >
              {ROTULO_STATUS[a.status] ?? a.status}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-mute)" }}>
              {a.dataEvento.toLocaleDateString("pt-BR")}
            </span>
            {a.arquivoPdfUrl && (
              <a
                href={a.arquivoPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-semibold underline"
                style={{ color: "var(--sky-deep, #3F638F)" }}
              >
                <FileText className="h-2.5 w-2.5" /> PDF
              </a>
            )}
            <div className="ml-auto inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition hover:opacity-80"
                style={{ background: "var(--glass-1)", color: "var(--text-soft)", border: "0.5px solid var(--border-soft)" }}
                title="Editar este andamento"
              >
                <Pencil className="h-2.5 w-2.5" /> Editar
              </button>
              <form action={excluirAndamentoNotificacaoAction}>
                <input type="hidden" name="andamentoId" value={a.id} />
                <button
                  type="submit"
                  onClick={(ev) => {
                    if (!window.confirm(`Excluir o andamento \"${ROTULO_STATUS[a.status] ?? a.status}\" de ${a.dataEvento.toLocaleDateString("pt-BR")}? Esta ação será registrada no histórico.`)) {
                      ev.preventDefault();
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition hover:opacity-80 hover:text-red-700"
                  style={{ background: "var(--glass-1)", color: "var(--text-soft)", border: "0.5px solid var(--border-soft)" }}
                  title="Excluir este andamento"
                >
                  <Trash2 className="h-2.5 w-2.5" /> Excluir
                </button>
              </form>
            </div>
          </div>
          <p className="text-[12px]" style={{ color: "var(--text-soft)" }}>
            {a.descricao}
          </p>
        </>
      )}
    </li>
  );
}

