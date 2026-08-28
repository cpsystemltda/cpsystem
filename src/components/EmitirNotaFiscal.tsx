"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Receipt,
} from "lucide-react";
import {
  emitirNotaFiscalAction,
  consultarNotaFiscalAction,
  cancelarNotaFiscalAction,
  type ResultadoEmissao,
} from "@/app/actions/notaFiscal";

export type NotaDoEmpenho = {
  id: string;
  status: "PROCESSANDO" | "AUTORIZADA" | "ERRO" | "CANCELADA";
  numero: string | null;
  ambiente: "HOMOLOGACAO" | "PRODUCAO";
  pdfUrl: string | null;
  linkPrefeitura: string | null;
  mensagemErro: string | null;
  valorServicos: number;
  criadoEm: string;
};

/**
 * "Emitir NF" na etapa de nota fiscal do empenho.
 *
 * Fica ao LADO do registro manual, não no lugar dele: quem emite a nota por
 * fora (contabilidade, sistema próprio) continua podendo só anexar o arquivo e
 * marcar a data. Tirar esse caminho seria obrigar todo mundo a contratar casa
 * fiscal pra continuar usando o que já usava.
 */
export function EmitirNotaFiscal({
  empenhoId,
  emissaoLigada,
  valorTotal,
  notas,
  podeCancelar,
}: {
  empenhoId: string;
  emissaoLigada: boolean;
  valorTotal: number;
  notas: NotaDoEmpenho[];
  podeCancelar: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, emitir, emitindo] = useActionState<ResultadoEmissao | null, FormData>(
    emitirNotaFiscalAction,
    null,
  );
  const [estadoConsulta, consultar, consultando] = useActionState<ResultadoEmissao | null, FormData>(
    consultarNotaFiscalAction,
    null,
  );
  const [cancelando, setCancelando] = useState(false);
  const [estadoCancel, cancelar, pendenteCancel] = useActionState<ResultadoEmissao | null, FormData>(
    cancelarNotaFiscalAction,
    null,
  );

  const autorizada = notas.find((n) => n.status === "AUTORIZADA");
  const processando = notas.find((n) => n.status === "PROCESSANDO");
  const ultimoErro = notas.find((n) => n.status === "ERRO");

  // ── Nota autorizada ───────────────────────────────────────────────────────
  if (autorizada) {
    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            NFS-e {autorizada.numero ?? ""} autorizada
          </span>
          {autorizada.ambiente === "HOMOLOGACAO" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              HOMOLOGAÇÃO · sem valor fiscal
            </span>
          )}
          {autorizada.pdfUrl && (
            <a
              href={autorizada.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </a>
          )}
          {autorizada.linkPrefeitura && (
            <a
              href={autorizada.linkPrefeitura}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver na prefeitura
            </a>
          )}
          {podeCancelar && !cancelando && (
            <button
              type="button"
              onClick={() => setCancelando(true)}
              className="ms-auto text-xs text-slate-500 hover:text-red-700"
            >
              Cancelar nota
            </button>
          )}
        </div>

        {cancelando && (
          <form action={cancelar} className="mt-3 space-y-2 border-t border-emerald-200 pt-3">
            <input type="hidden" name="notaId" value={autorizada.id} />
            <label className="block text-xs font-semibold text-slate-700">
              Justificativa do cancelamento
              <textarea
                name="justificativa"
                rows={2}
                minLength={15}
                required
                placeholder="A prefeitura exige ao menos 15 caracteres explicando o motivo."
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </label>
            {estadoCancel?.erro && <p className="text-xs text-red-600">{estadoCancel.erro}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={pendenteCancel}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pendenteCancel && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirmar cancelamento
              </button>
              <button
                type="button"
                onClick={() => setCancelando(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Voltar
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ── Em processamento na prefeitura ────────────────────────────────────────
  if (processando) {
    return (
      <form action={consultar} className="mt-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
        <input type="hidden" name="notaId" value={processando.id} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-900">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Nota enviada — a prefeitura está processando.
          </span>
          <button
            type="submit"
            disabled={consultando}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${consultando ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
        {estadoConsulta?.mensagem && (
          <p className="mt-1.5 text-xs text-blue-900">{estadoConsulta.mensagem}</p>
        )}
        {estadoConsulta?.erro && <p className="mt-1.5 text-xs text-red-600">{estadoConsulta.erro}</p>}
      </form>
    );
  }

  // ── Emissão desligada ─────────────────────────────────────────────────────
  if (!emissaoLigada) {
    return (
      <p className="mt-2 text-xs text-slate-500">
        Quer emitir a nota daqui?{" "}
        <Link href="/conta/fiscal" className="font-semibold text-violet-700 hover:underline">
          Configure os dados fiscais
        </Link>{" "}
        — ou siga anexando a nota emitida por fora, como você já faz.
      </p>
    );
  }

  // ── Pronto pra emitir ─────────────────────────────────────────────────────
  return (
    <div className="mt-2">
      {(ultimoErro || estado?.erro) && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <div className="text-xs text-red-800">
            <p className="font-semibold">A nota não foi autorizada.</p>
            <p className="mt-0.5 whitespace-pre-wrap">
              {estado?.erro || ultimoErro?.mensagemErro}
            </p>
            <p className="mt-1 text-[11px] text-red-700">
              Recusa quase sempre é cadastro: confira item da lista de serviço, inscrição
              municipal e alíquota em{" "}
              <Link href="/conta/fiscal" className="font-semibold underline">
                Dados fiscais
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
        >
          <Receipt className="h-3.5 w-3.5" />
          {ultimoErro ? "Tentar emitir de novo" : "Emitir NF"}
        </button>
      ) : (
        <form action={emitir} className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
          <input type="hidden" name="empenhoId" value={empenhoId} />
          <p className="text-xs text-slate-700">
            Valor da nota:{" "}
            <strong>
              {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong>{" "}
            — somado dos itens do empenho.
          </p>

          <label className="block text-xs font-semibold text-slate-700">
            Descrição do serviço
            <textarea
              name="descricao"
              rows={3}
              placeholder="Deixe em branco pra usar o texto padrão + os itens do empenho."
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-700">
              Alíquota ISS (%)
              <input
                name="aliquotaIss"
                inputMode="decimal"
                placeholder="padrão"
                className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <label className="inline-flex items-center gap-2 pb-1.5 text-xs text-slate-700">
              <input
                type="checkbox"
                name="issRetido"
                className="h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              ISS retido pelo órgão
            </label>
          </div>

          {estado?.ok && estado.mensagem && (
            <p className="text-xs font-medium text-emerald-700">{estado.mensagem}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={emitindo}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {emitindo && <Loader2 className="h-3 w-3 animate-spin" />}
              {emitindo ? "Emitindo…" : "Confirmar e emitir"}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
