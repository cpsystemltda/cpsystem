"use client";

import { useState, useOptimistic, useTransition, useRef } from "react";
import { Check, FileText, Pencil, Undo2, UploadCloud, X } from "lucide-react";
import { registrarMarcoAction, desfazerMarcoAction } from "@/app/actions/contratacoes";

type Props = {
  empenhoId: string;
  marco: string;
  ja?: Date | null;
  jaArquivo?: string | null;
  bloqueado?: boolean;
};

const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 25 * 1024 * 1024;

// Converte Date pra "YYYY-MM-DD" em UTC pra pré-preencher <input type="date">.
// Usamos UTC porque marcos são salvos como meio-dia UTC (parseDataInputBr).
function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AvancarStatus({ empenhoId, marco, ja, jaArquivo, bloqueado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [optimisticData, setOptimisticData] = useOptimistic<Date | null>(ja ?? null);

  async function handleSubmit(formData: FormData) {
    const dataStr = formData.get("data") as string;
    const dataOtimista = dataStr ? new Date(dataStr + "T12:00:00") : new Date();

    setAberto(false);
    setErro(null);

    startTransition(async () => {
      setOptimisticData(dataOtimista);
      const result = await registrarMarcoAction(null, formData);
      if (result?.erro) {
        setErro(result.erro);
        // Reabre o form caso ele tenha fechado (pra usuario tentar de novo)
        setAberto(true);
      }
    });
  }

  // Marcha-re: zera o marco (data+arquivo) e recua o status pro ultimo
  // marco anterior preenchido. Pedido Igor (02/06): "se eu marquei errado
  // a etapa, eu nao consigo voltar — so editar a data".
  async function handleDesfazer() {
    if (
      !window.confirm(
        "Desfazer este andamento? A data e o arquivo serao apagados e o status volta pra etapa anterior.",
      )
    )
      return;
    setErro(null);
    const fd = new FormData();
    fd.set("empenhoId", empenhoId);
    fd.set("marco", marco);
    startTransition(async () => {
      setOptimisticData(null);
      const result = await desfazerMarcoAction(null, fd);
      if (result?.erro) setErro(result.erro);
    });
  }

  // ── Concluído (real ou otimista) ────────────────────────────────────────────
  if (optimisticData) {
    if (aberto) {
      // Modo edição — mesmo form, pré-preenchido com a data atual do marco.
      return (
        <form action={handleSubmit} className="space-y-2">
          <input type="hidden" name="empenhoId" value={empenhoId} />
          <input type="hidden" name="marco" value={marco} />
          <div className="flex items-center gap-2">
            <input
              type="date"
              name="data"
              defaultValue={isoDateUtc(optimisticData)}
              required
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Check className="h-3 w-3" /> Salvar
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>
          <DropZoneArquivo jaTem={!!jaArquivo} onErro={setErro} />
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </form>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isPending ? "text-emerald-400" : "text-emerald-700"}`}>
          <Check className="h-3.5 w-3.5" />
          {optimisticData.toLocaleDateString("pt-BR")}
          {isPending && <span className="ml-1 text-[10px] text-slate-400">salvando…</span>}
        </span>
        {jaArquivo && (
          <a
            href={jaArquivo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <FileText className="h-3.5 w-3.5" /> Arquivo
          </a>
        )}
        <button
          type="button"
          onClick={() => { setErro(null); setAberto(true); }}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          title="Editar data ou arquivo desta etapa"
        >
          <Pencil className="h-3 w-3" /> Editar
        </button>
        <button
          type="button"
          onClick={handleDesfazer}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"
          title="Desfazer este andamento (volta etapa pro estado pendente)"
        >
          <Undo2 className="h-3 w-3" /> Desfazer
        </button>
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </div>
    );
  }

  // ── Bloqueado ───────────────────────────────────────────────────────────────
  if (bloqueado) {
    return <span className="text-xs text-slate-400">Aguardando etapa anterior</span>;
  }

  // ── Disponível ──────────────────────────────────────────────────────────────
  return (
    <div>
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition"
        >
          <div className="h-4 w-4 rounded border-2 border-slate-400" />
          Registrar data
        </button>
      ) : (
        <form action={handleSubmit} className="space-y-2">
          <input type="hidden" name="empenhoId" value={empenhoId} />
          <input type="hidden" name="marco" value={marco} />

          <div className="flex items-center gap-2">
            <input
              type="date"
              name="data"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Check className="h-3 w-3" /> Confirmar
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>

          <DropZoneArquivo jaTem={false} onErro={setErro} />

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </form>
      )}
    </div>
  );
}

// DropZone com drag-and-drop + validacao client-side. Regina (03/06):
// upload nao funcionava ao arrastar nem ao selecionar — agora ambos
// funcionam, com erro visivel se tipo/tamanho invalido.
function DropZoneArquivo({
  jaTem,
  onErro,
}: {
  jaTem: boolean;
  onErro: (msg: string | null) => void;
}) {
  const [arq, setArq] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function aceitar(f: File | undefined | null) {
    if (!f) return;
    if (!TIPOS_PERMITIDOS.includes(f.type)) {
      onErro(`Tipo "${f.type || "desconhecido"}" não permitido. Use PDF, JPG ou PNG.`);
      return;
    }
    if (f.size > MAX_BYTES) {
      onErro(`Arquivo "${f.name}" tem ${formatarTamanho(f.size)} — excede o limite de 25 MB.`);
      return;
    }
    // Pra que o FormData do form pai pegue o arquivo arrastado, jogamos
    // ele no input via DataTransfer (drag-and-drop nao alimenta input automaticamente).
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
    setArq(f);
    onErro(null);
  }

  function limpar() {
    setArq(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        aceitar(e.dataTransfer.files?.[0]);
      }}
      onClick={() => {
        if (!arq) inputRef.current?.click();
      }}
      className={`rounded-md border border-dashed px-3 py-3 transition ${
        arrastando
          ? "border-blue-500 bg-blue-50"
          : arq
            ? "border-emerald-300 bg-emerald-50/50 cursor-default"
            : "border-slate-300 bg-slate-50/40 cursor-pointer hover:border-slate-400 hover:bg-slate-100/60"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        name="arquivo"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => aceitar(e.target.files?.[0])}
      />
      {arq ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-800">{arq.name}</p>
              <p className="text-[10px] text-slate-500">{formatarTamanho(arq.size)} · pronto pra enviar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              limpar();
            }}
            className="rounded p-1 text-slate-500 hover:bg-white hover:text-red-600"
            title="Remover arquivo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <UploadCloud className={`h-4 w-4 shrink-0 ${arrastando ? "text-blue-600" : "text-slate-400"}`} />
          <p className="text-[11px] text-slate-600">
            {arrastando ? (
              <span className="font-medium text-blue-700">Solte o arquivo aqui</span>
            ) : (
              <>
                {jaTem ? "Substituir arquivo" : "Arraste o arquivo"}{" "}
                <span className="text-slate-400">ou</span>{" "}
                <span className="font-medium text-blue-700">clique pra selecionar</span>
                <span className="ml-1 text-slate-400">· PDF, JPG ou PNG · até 25 MB</span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
