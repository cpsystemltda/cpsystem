"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Upload, Check, AlertCircle, Loader2, Beaker, UploadCloud, FileText, X } from "lucide-react";

export type ArquivoSalvoInfo = { url: string; nome: string; tamanhoBytes?: number };

type Resultado<T> =
  | {
      ok: true;
      dados: T;
      demo?: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
      /** Todos os arquivos persistidos nesta leitura (modo `multiplos`). */
      arquivos?: ArquivoSalvoInfo[];
    }
  | { ok: false; erro: string };

// Limite por arquivo — bate com salvarArquivo (25MB). Rejeitamos antes de
// bater no servidor.
const MAX_BYTES_PDF = 25 * 1024 * 1024;
// Limite do LOTE: a server action aceita 25MB de corpo (next.config) e a API
// da IA aceita 32MB por requisição já em base64 (+33%). 20MB de PDFs cabem
// nos dois com folga.
const MAX_BYTES_LOTE = 20 * 1024 * 1024;
const MAX_ARQUIVOS = 8;

function aceito(file: File, extensoes: string[]): boolean {
  const nome = file.name.toLowerCase();
  if (extensoes.some((e) => nome.endsWith(e))) return true;
  return extensoes.includes(".pdf") && file.type === "application/pdf";
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Painel "preencher com IA".
 *
 * Em modo `multiplos` (Regina 07/11/2026: cadastro de ata, contrato e
 * execução) a pessoa junta vários PDFs — o instrumento e o que ajuda a
 * preencher (edital, termo de referência, ETP, proposta) — e manda tudo numa
 * leitura só. A lista fica visível antes de enviar, com o tamanho de cada
 * um, e todos os arquivos voltam persistidos para virar Anexo no save.
 *
 * Sem `multiplos` o comportamento é o de sempre: escolheu o PDF, a leitura
 * começa na hora (garantia, aditivo, apostilamento, procedimento).
 */
export function UploadPdfPanel<T>({
  titulo,
  descricao,
  action,
  onSuccess,
  onArquivoSalvo,
  onArquivosSalvos,
  badgeAposExtracao,
  multiplos = false,
  extensoes = [".pdf"],
  rotuloLista,
}: {
  titulo: string;
  descricao: string;
  action: (formData: FormData) => Promise<Resultado<T>>;
  onSuccess: (dados: T) => void;
  /** Primeiro arquivo persistido (compatibilidade com os formulários de um PDF só). */
  onArquivoSalvo?: (info: { url: string; nome: string }) => void;
  /** Todos os arquivos persistidos na leitura — use com `multiplos`. */
  onArquivosSalvos?: (arquivos: ArquivoSalvoInfo[]) => void;
  /** ex: (dados) => `${dados.itens.length} item(ns) preenchido(s)` */
  badgeAposExtracao?: (dados: T) => string;
  multiplos?: boolean;
  /** Extensões aceitas (ESP-003: planilha de custos vem em PDF ou Excel). */
  extensoes?: string[];
  /** Frase de rodapé da fila; sem ela vale a do cadastro ("o primeiro é o principal"). */
  rotuloLista?: string;
}) {
  const soPdf = extensoes.length === 1 && extensoes[0] === ".pdf";
  const rotuloArq = soPdf ? "PDF" : "arquivo";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** Arquivos escolhidos e ainda não enviados (só em `multiplos`). */
  const [fila, setFila] = useState<File[]>([]);
  /** Nomes dos arquivos já lidos pela IA. */
  const [lidos, setLidos] = useState<string[]>([]);
  const [badge, setBadge] = useState<string | null>(null);
  const [modoDemo, setModoDemo] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Bloqueio global do navegador: se o usuario arrastar o PDF e soltar
  // FORA da zona, o browser abriria o arquivo (e o usuario perderia o
  // contexto). Aqui prevenimos isso enquanto o componente esta montado —
  // o drop ainda funciona normal dentro da nossa zona porque <section>
  // tem onDrop proprio que executa primeiro (capture/bubble).
  useEffect(() => {
    const prevent = (ev: DragEvent) => ev.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  function onDragOver(ev: React.DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!extraindo) setDragOver(true);
  }
  function onDragLeave(ev: React.DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setDragOver(false);
  }
  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setDragOver(false);
    if (extraindo) return;
    receber(ev.dataTransfer.files);
  }

  /** Validação no navegador: rejeita ANTES de bater no servidor, pra não gastar IA à toa. */
  function validar(file: File): string | null {
    if (!aceito(file, extensoes)) {
      return soPdf
        ? `"${file.name}" não é PDF (${file.type || "tipo desconhecido"}).`
        : `"${file.name}" não é um tipo aceito (${extensoes.join(", ")}).`;
    }
    if (file.size === 0) return `"${file.name}" está vazio (0 bytes).`;
    if (file.size > MAX_BYTES_PDF) {
      return `"${file.name}" tem ${formatarTamanho(file.size)} — o limite por arquivo é ${formatarTamanho(MAX_BYTES_PDF)}.`;
    }
    return null;
  }

  function receber(lista: FileList | null) {
    const files = Array.from(lista ?? []);
    if (files.length === 0) return;
    if (!multiplos) {
      const file = files[0];
      const problema = validar(file);
      if (problema) {
        setErro(problema);
        return;
      }
      void enviar([file]);
      return;
    }

    const problemas: string[] = [];
    const novos: File[] = [];
    for (const f of files) {
      const problema = validar(f);
      if (problema) {
        problemas.push(problema);
        continue;
      }
      const repetido = [...fila, ...novos].some((x) => x.name === f.name && x.size === f.size);
      if (!repetido) novos.push(f);
    }
    const total = [...fila, ...novos];
    const bytes = total.reduce((s, f) => s + f.size, 0);
    if (total.length > MAX_ARQUIVOS) {
      problemas.push(`São no máximo ${MAX_ARQUIVOS} arquivos por leitura. Leia os principais agora e anexe os demais depois, na aba Anexos.`);
    } else if (bytes > MAX_BYTES_LOTE) {
      problemas.push(
        `Juntos, os arquivos somam ${formatarTamanho(bytes)} — a leitura conjunta aceita até ${formatarTamanho(MAX_BYTES_LOTE)}. ` +
          `Leia o documento principal agora e anexe os demais depois, na aba Anexos.`,
      );
    } else {
      setFila(total);
    }
    setErro(problemas.length ? problemas.join(" ") : null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function remover(idx: number) {
    setFila((f) => f.filter((_, i) => i !== idx));
  }

  async function enviar(files: File[]) {
    if (files.length === 0 || extraindo) return;
    setExtraindo(true);
    setErro(null);
    setBadge(null);
    setModoDemo(false);

    try {
      const fd = new FormData();
      for (const f of files) fd.append("pdf", f);
      const res = await action(fd);

      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      onSuccess(res.dados);
      const salvos: ArquivoSalvoInfo[] =
        res.arquivos ??
        (res.arquivoUrl
          ? [{ url: res.arquivoUrl, nome: res.nomeArquivo ?? files[0].name, tamanhoBytes: res.tamanhoBytes }]
          : []);
      if (salvos.length > 0) {
        onArquivosSalvos?.(salvos);
        onArquivoSalvo?.({ url: salvos[0].url, nome: salvos[0].nome });
      }
      setLidos((prev) => [...prev, ...files.map((f) => f.name)]);
      setFila([]);
      if (res.demo) setModoDemo(true);
      if (badgeAposExtracao) setBadge(badgeAposExtracao(res.dados));
      else setBadge("Dados preenchidos");
    } catch (e) {
      // Erros de rede / runtime que escapam do try-catch da server action
      // (timeout, JSON corrompido, etc.). Antes silenciava.
      setErro(
        e instanceof Error
          ? `Falha de comunicação: ${e.message}`
          : `Falha ao enviar o ${rotuloArq}. Verifique sua conexão e tente novamente.`,
      );
    } finally {
      setExtraindo(false);
      // Reset do input pra permitir reselecionar o MESMO arquivo (sem
      // isso, o onChange nao dispara se o usuario escolher o mesmo PDF).
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const bytesFila = fila.reduce((s, f) => s + f.size, 0);
  const textoSoltar = multiplos ? `Solte os ${rotuloArq}s aqui` : `Solte o ${rotuloArq} aqui`;

  return (
    <section
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`glass-tile relative overflow-hidden rounded-[20px] px-7 py-6 transition`}
      style={{
        background: dragOver
          ? "linear-gradient(135deg, rgba(197,180,255,0.40), rgba(184,197,214,0.20)), var(--glass-2)"
          : "linear-gradient(135deg, rgba(197,180,255,0.12), rgba(184,197,214,0.04)), var(--glass-2)",
        outline: dragOver ? "3px dashed var(--lavender)" : undefined,
        outlineOffset: dragOver ? "-8px" : undefined,
        minHeight: dragOver ? "180px" : undefined,
      }}
    >
      {/* Overlay grande enquanto arrasta. Cobre o card inteiro pra
          eliminar duvida sobre onde soltar. */}
      {dragOver && !extraindo && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center"
          style={{
            background: "rgba(197,180,255,0.18)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <UploadCloud className="h-12 w-12" style={{ color: "var(--lavender-deep, #6B4FC9)" }} />
            <p
              className="text-[18px] font-extrabold"
              style={{ color: "#0A0A0A", letterSpacing: "-0.02em" }}
            >
              {textoSoltar}
            </p>
          </div>
        </div>
      )}
      <div className="relative z-[1] flex items-start gap-4">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, var(--lavender), var(--sky))",
            boxShadow: "0 4px 16px rgba(197,180,255,0.4)",
          }}
        >
          <Sparkles className="h-5 w-5" style={{ color: "#0A0A0A" }} />
        </div>
        <div className="flex-1">
          <h2
            className="text-[18px] font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
          >
            {titulo}
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
            {descricao}
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-mute)" }}>
            {dragOver
              ? `${textoSoltar}…`
              : multiplos
              ? `Arraste um ou mais ${rotuloArq}s aqui, ou clique em Escolher arquivos. Todos vão para a aba Anexos.`
              : `Arraste o ${rotuloArq} aqui ou clique no botão abaixo.`}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={soPdf ? "application/pdf" : extensoes.join(",")}
            multiple={multiplos}
            className="hidden"
            onChange={(ev) => receber(ev.target.files)}
          />

          {multiplos && fila.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {fila.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]"
                  style={{ background: "rgba(255,255,255,0.55)", border: "0.5px solid rgba(15,14,12,0.08)" }}
                >
                  <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--lavender-deep, #6B4FC9)" }} />
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text)" }}>
                    {f.name}
                    {i === 0 && !rotuloLista && (
                      <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(197,180,255,0.35)", color: "#4B3A9E" }}>
                        principal
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--text-mute)" }}>{formatarTamanho(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => remover(i)}
                    disabled={extraindo}
                    className="shrink-0 rounded p-0.5 hover:bg-black/5 disabled:opacity-50"
                    aria-label={`Remover ${f.name}`}
                  >
                    <X className="h-3.5 w-3.5" style={{ color: "var(--text-mute)" }} />
                  </button>
                </li>
              ))}
              <li className="px-1 text-[11px]" style={{ color: "var(--text-mute)" }}>
                {fila.length} arquivo{fila.length === 1 ? "" : "s"} · {formatarTamanho(bytesFila)} de {formatarTamanho(MAX_BYTES_LOTE)}.
                {" "}
                {rotuloLista ?? "O primeiro da lista é tratado como o documento principal; os outros completam itens, prazos e dados do órgão."}
                {lidos.length > 0 && !rotuloLista && " Uma nova leitura substitui os campos já preenchidos."}
              </li>
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {multiplos ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extraindo}
                  className="btn-secondary inline-flex disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {fila.length > 0 || lidos.length > 0 ? "Adicionar arquivos" : "Escolher arquivos"}
                </button>
                <button
                  type="button"
                  onClick={() => void enviar(fila)}
                  disabled={extraindo || fila.length === 0}
                  className="btn-primary inline-flex disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {extraindo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Lendo {fila.length} arquivo{fila.length === 1 ? "" : "s"}…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Ler com IA e preencher{fila.length > 0 ? ` (${fila.length})` : ""}
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={extraindo}
                className="btn-primary inline-flex disabled:cursor-not-allowed disabled:opacity-60"
              >
                {extraindo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extraindo dados…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {lidos.length > 0 ? `Outro ${rotuloArq}` : `Anexar ${rotuloArq}`}
                  </>
                )}
              </button>
            )}
            {lidos.length > 0 && !extraindo && (
              <span
                className="max-w-md truncate text-xs"
                style={{ color: "var(--text-mute)" }}
                title={lidos.join(", ")}
              >
                {multiplos && lidos.length > 1 ? `${lidos.length} arquivos lidos: ` : ""}
                {lidos.join(", ")}
              </span>
            )}
            {badge && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: "rgba(93,216,182,0.18)",
                  color: "var(--mint)",
                  border: "0.5px solid rgba(93,216,182,0.3)",
                }}
              >
                <Check className="h-3 w-3" /> {badge}
              </span>
            )}
          </div>

          {erro && (
            <div
              className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "rgba(232,138,152,0.10)",
                border: "0.5px solid rgba(232,138,152,0.3)",
                color: "var(--coral)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {modoDemo && (
            <div
              className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
              style={{
                background: "rgba(212,175,55,0.10)",
                border: "0.5px solid rgba(212,175,55,0.3)",
                color: "var(--primary-deep)",
              }}
            >
              <Beaker className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Modo demonstração ativo</strong> — dados de exemplo pra você testar
                o fluxo sem a IA real. Configure{" "}
                <code
                  className="rounded px-1 py-0.5 font-mono"
                  style={{ background: "rgba(15,14,12,0.06)", color: "var(--primary-deep)" }}
                >
                  ANTHROPIC_API_KEY
                </code>{" "}
                no <code
                  className="rounded px-1 py-0.5 font-mono"
                  style={{ background: "rgba(15,14,12,0.06)", color: "var(--primary-deep)" }}
                >
                  .env
                </code>{" "}
                pra ativar a extração via IA.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
