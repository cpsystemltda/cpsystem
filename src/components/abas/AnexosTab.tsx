"use client";

import { useActionState } from "react";
import { adicionarAnexoAction, adicionarAnotacaoAction } from "@/app/actions/contratuais";
import { Paperclip, FileText, StickyNote } from "lucide-react";

type Anexo = {
  id: string;
  nome: string;
  url: string;
  mimeType: string | null;
  tamanhoBytes: number | null;
  categoria: string;
  criadoEm: Date;
};
type Anotacao = { id: string; texto: string; autorNome: string | null; criadoEm: Date };

const CATS: Record<string, string> = {
  CONTRATUAL: "Contratual",
  ADITIVO: "Aditivo",
  APOSTILAMENTO: "Apostilamento",
  GARANTIA: "Garantia",
  NOTIFICACAO: "Notificação",
  PROCEDIMENTO: "Procedimento",
  NF: "Nota Fiscal",
  COMPROVANTE: "Comprovante",
  OUTRO: "Outro",
};

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AnexosTab({
  anexos,
  ataId,
  contratoId,
  empenhoId,
}: {
  anexos: Anexo[];
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
}) {
  const [state, formAction] = useActionState(adicionarAnexoAction, null);

  return (
    <div className="space-y-6">
      {anexos.length > 0 ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid h-9 w-9 place-items-center rounded bg-slate-100">
                <FileText className="h-4 w-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <a href={a.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-blue-700 hover:underline">
                  {a.nome}
                </a>
                <div className="text-[11px] text-slate-500">
                  {CATS[a.categoria]} · {formatarTamanho(a.tamanhoBytes)} · {a.criadoEm.toLocaleDateString("pt-BR")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Nenhum anexo. Use o formulário abaixo para anexar PDFs e imagens.
        </p>
      )}

      <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Anexar arquivo</summary>
        <form action={formAction} className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {ataId && <input type="hidden" name="ataId" value={ataId} />}
          {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
          {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Categoria</span>
            <select name="categoria" className="rounded border border-slate-300 px-2 py-1 text-xs">
              {Object.entries(CATS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Arquivo (PDF/PNG/JPG, máx 25MB)</span>
            <input type="file" name="arquivo" accept="application/pdf,image/png,image/jpeg" required className="text-xs" />
          </label>
          {state?.erro && <div className="col-span-2 text-xs text-red-700">{state.erro}</div>}
          {state?.ok && <div className="col-span-2 text-xs text-emerald-700">Arquivo enviado.</div>}
          <button type="submit" className="col-span-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
            <Paperclip className="mr-1 inline h-3 w-3" /> Enviar
          </button>
        </form>
      </details>
    </div>
  );
}

export function AnotacoesTab({
  anotacoes,
  ataId,
  contratoId,
  empenhoId,
}: {
  anotacoes: Anotacao[];
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
}) {
  const [state, formAction] = useActionState(adicionarAnotacaoAction, null);

  return (
    <div className="space-y-6">
      {anotacoes.length > 0 && (
        <ul className="space-y-2">
          {anotacoes.map((n) => (
            <li key={n.id} className="rounded-lg border border-slate-200 bg-yellow-50 p-3">
              <div className="flex items-start gap-2">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
                <div className="flex-1">
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{n.texto}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {n.autorNome || "—"} · {n.criadoEm.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-3">
        {ataId && <input type="hidden" name="ataId" value={ataId} />}
        {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
        {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
        <textarea
          name="texto"
          required
          placeholder="Adicione uma anotação livre…"
          rows={3}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <div className="mt-2 flex items-center justify-between">
          {state?.erro && <span className="text-xs text-red-700">{state.erro}</span>}
          {state?.ok && <span className="text-xs text-emerald-700">Anotação salva.</span>}
          <button type="submit" className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
            Salvar anotação
          </button>
        </div>
      </form>
    </div>
  );
}
