"use client";

import { useActionState, useEffect, useState } from "react";
import { FileText, Trash2, Award, Check, AlertCircle } from "lucide-react";
import { criarAtestadoAction, excluirAtestadoAction } from "@/app/actions/atestados";

type Atestado = {
  id: string;
  numero: string | null;
  dataEmissao: Date;
  orgaoEmissor: string;
  objeto: string | null;
  observacoes: string | null;
  arquivoPdfUrl: string;
  arquivoPdfNome: string | null;
  criadoEm: Date;
};

// Aba "Atestado de Capacidade Técnica" — usado no detalhe da Ata e do
// Contrato. Empresa lista os atestados emitidos pelos órgãos no fim de
// cada contratação e anexa o PDF pra ter catalogado (Regina 31/05).
export function AtestadoCapacidadeTab({
  atestados,
  ataId,
  contratoId,
}: {
  atestados: Atestado[];
  ataId?: string;
  contratoId?: string;
}) {
  const [criando, setCriando] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-extrabold" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
            Atestados emitidos
          </h3>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-soft)" }}>
            Comprovam que a empresa executou a contratação. Use em licitações futuras.
          </p>
        </div>
        {!criando && (
          <button type="button" onClick={() => setCriando(true)} className="btn-primary inline-flex">
            + Anexar atestado
          </button>
        )}
      </header>

      {criando && (
        <FormularioAtestado
          ataId={ataId}
          contratoId={contratoId}
          onCancelar={() => setCriando(false)}
          onSalvo={() => setCriando(false)}
        />
      )}

      {atestados.length === 0 ? (
        <div
          className="glass-tile rounded-[20px] p-12 text-center"
          style={{ border: "0.5px dashed var(--hairline)" }}
        >
          <Award className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
          <p className="mt-3 text-sm font-extrabold" style={{ color: "var(--text)" }}>
            Nenhum atestado cadastrado.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
            Ao final da contratação, solicite o atestado ao órgão e anexe o PDF aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {atestados.map((a) => (
            <CardAtestado key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardAtestado({ a }: { a: Atestado }) {
  const [excluirState, excluirAction] = useActionState(excluirAtestadoAction, null);
  return (
    <article className="glass-tile rounded-[16px] px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h4 className="text-[14px] font-extrabold" style={{ color: "var(--text)" }}>
              {a.numero ? `Atestado ${a.numero}` : "Atestado"}
            </h4>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
              {a.dataEmissao.toLocaleDateString("pt-BR")}
            </span>
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-soft)" }}>
            <strong>Órgão:</strong> {a.orgaoEmissor}
            {a.objeto && <> · {a.objeto}</>}
          </p>
          {a.observacoes && (
            <p className="mt-2 text-[12px] italic" style={{ color: "var(--text-mute)" }}>
              {a.observacoes}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
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
            <FileText className="h-3 w-3" /> Abrir PDF
          </a>
          <form action={excluirAction}>
            <input type="hidden" name="atestadoId" value={a.id} />
            <button
              type="submit"
              onClick={(ev) => {
                if (!window.confirm("Excluir este atestado? Esta ação não pode ser desfeita.")) {
                  ev.preventDefault();
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
              style={{
                background: "rgba(232,138,152,0.12)",
                color: "var(--coral)",
                border: "0.5px solid rgba(232,138,152,0.3)",
              }}
              title="Excluir atestado"
            >
              <Trash2 className="h-3 w-3" /> Excluir
            </button>
          </form>
        </div>
      </div>
      {excluirState && !excluirState.ok && (
        <p className="mt-2 text-[11px] font-semibold text-red-700">{excluirState.erro}</p>
      )}
    </article>
  );
}

function FormularioAtestado({
  ataId,
  contratoId,
  onCancelar,
  onSalvo,
}: {
  ataId?: string;
  contratoId?: string;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const [state, formAction] = useActionState(criarAtestadoAction, null);
  useEffect(() => {
    if (state?.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form
      action={formAction}
      className="glass rounded-[20px] px-6 py-5"
      style={{ background: "var(--glass-2)" }}
      encType="multipart/form-data"
    >
      {ataId && <input type="hidden" name="ataId" value={ataId} />}
      {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
            Nº do atestado
          </span>
          <input
            name="numero"
            placeholder="ex: 042/2026"
            className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
            Data de emissão *
          </span>
          <input
            type="date"
            name="dataEmissao"
            required
            className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
            Órgão emissor *
          </span>
          <input
            name="orgaoEmissor"
            required
            placeholder="ex: Universidade de Brasília (UnB)"
            className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
            Objeto atestado
          </span>
          <textarea
            name="objeto"
            rows={2}
            placeholder="Descrição curta do que o atestado comprova"
            className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
            Observações
          </span>
          <textarea
            name="observacoes"
            rows={2}
            className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
            Arquivo PDF *
          </span>
          <input
            type="file"
            name="arquivo"
            accept="application/pdf"
            required
            className="mt-1.5 block text-[12px]"
          />
        </label>
      </div>

      {state && !state.ok && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-[13px]"
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

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" className="btn-primary inline-flex">
          <Check className="h-4 w-4" /> Salvar atestado
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
  );
}
