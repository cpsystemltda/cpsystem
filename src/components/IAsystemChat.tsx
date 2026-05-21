"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, Sparkles, User, Loader2, Trash2, AlertCircle } from "lucide-react";
import { enviarMensagemIAsystemAction } from "@/app/actions/iasystem";
import type { MensagemIAsystem } from "@/lib/iasystem";

const SUGESTOES_INICIAIS = [
  "Posso aderir a uma Ata de outro órgão sem ter participado? Quais os limites?",
  "Quando posso pedir reajuste por IPCA do meu contrato?",
  "Qual a diferença entre apostilamento e termo aditivo?",
  "Que tipo de garantia devo oferecer e em qual valor?",
];

// Histórico persistido no localStorage do navegador — sobrevive recargas
// sem precisar de migration. Caso a Regina queira histórico server-side
// no futuro, basta plugar uma tabela MensagemIAsystem + contaId.
const STORAGE_KEY = "iasystem_historico_v1";

function carregar(): MensagemIAsystem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is MensagemIAsystem =>
        typeof m === "object" &&
        m !== null &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

function salvar(mensagens: MensagemIAsystem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mensagens));
  } catch {
    // localStorage cheio ou desabilitado — silencioso
  }
}

export function IAsystemChat() {
  const [mensagens, setMensagens] = useState<MensagemIAsystem[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMensagens(carregar());
  }, []);

  useEffect(() => {
    salvar(mensagens);
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || enviando) return;
    setErro(null);
    const proximoHistorico: MensagemIAsystem[] = [
      ...mensagens,
      { role: "user", content: pergunta },
    ];
    setMensagens(proximoHistorico);
    setRascunho("");
    startTransition(async () => {
      const res = await enviarMensagemIAsystemAction(mensagens, pergunta);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setMensagens((prev) => [...prev, { role: "assistant", content: res.resposta }]);
    });
  }

  function limparHistorico() {
    if (!window.confirm("Apagar todo o histórico de conversa com o IAsystem?")) return;
    setMensagens([]);
    setErro(null);
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* Header */}
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p
            className="inline-flex items-center gap-2 text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Assistente jurídico
          </p>
          <h1
            className="mt-1 text-3xl font-bold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            IAsystem
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>
            Especialista em Lei 14.133/2021, Atas, Contratos, Empenhos, Garantias, Reajustes.
            Tire dúvidas em linguagem natural.
          </p>
        </div>
        {mensagens.length > 0 && (
          <button
            type="button"
            onClick={limparHistorico}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" /> Limpar histórico
          </button>
        )}
      </header>

      {/* Conversa */}
      <div
        className="glass flex-1 overflow-y-auto rounded-[20px] px-5 py-5"
        style={{ minHeight: 0 }}
      >
        {mensagens.length === 0 ? (
          <BoasVindas onEscolher={enviar} />
        ) : (
          <div className="space-y-4">
            {mensagens.map((m, i) => (
              <Bolha key={i} mensagem={m} />
            ))}
            {enviando && <BolhaPensando />}
            <div ref={fimRef} />
          </div>
        )}
      </div>

      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Input */}
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          enviar(rascunho);
        }}
      >
        <textarea
          ref={inputRef}
          value={rascunho}
          onChange={(ev) => setRascunho(ev.currentTarget.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
              ev.preventDefault();
              enviar(rascunho);
            }
          }}
          placeholder="Pergunte algo sobre Lei 14.133, Atas, Contratos, Garantias, Reajustes…"
          rows={2}
          className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          disabled={enviando}
        />
        <button
          type="submit"
          disabled={!rascunho.trim() || enviando}
          className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
        >
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar
        </button>
      </form>
    </div>
  );
}

function Bolha({ mensagem }: { mensagem: MensagemIAsystem }) {
  const ehUsuario = mensagem.role === "user";
  return (
    <div className={`flex gap-3 ${ehUsuario ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          ehUsuario
            ? "bg-gradient-to-br from-slate-700 to-slate-900 text-white"
            : "bg-gradient-to-br from-violet-500 to-violet-700 text-white"
        }`}
      >
        {ehUsuario ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[78%] rounded-[16px] px-4 py-3 text-sm leading-relaxed ${
          ehUsuario
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-800"
        }`}
        style={
          !ehUsuario
            ? { border: "0.5px solid var(--hairline)", boxShadow: "0 1px 3px rgba(15,14,12,0.04)" }
            : undefined
        }
      >
        <p className="whitespace-pre-wrap">{mensagem.content}</p>
      </div>
    </div>
  );
}

function BolhaPensando() {
  return (
    <div className="flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-[16px] bg-white px-4 py-3 text-sm" style={{ border: "0.5px solid var(--hairline)" }}>
        <p className="inline-flex items-center gap-2 text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
        </p>
      </div>
    </div>
  );
}

function BoasVindas({ onEscolher }: { onEscolher: (s: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2
        className="mt-4 text-2xl font-bold"
        style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
      >
        Olá! Sou o IAsystem.
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
        Pergunte qualquer coisa sobre Lei 14.133/2021, Atas de Registro de Preços, Contratos
        Administrativos, Empenhos, Garantias, Reajustes ou processos sancionatórios.
      </p>
      <div className="mt-6 grid gap-2 text-left">
        {SUGESTOES_INICIAIS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onEscolher(s)}
            className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
          >
            {s}
          </button>
        ))}
      </div>
      <p className="mt-6 text-[11px]" style={{ color: "var(--text-mute)" }}>
        Respostas geradas por IA. Decisões críticas devem ser confirmadas com seu advogado.
      </p>
    </div>
  );
}
