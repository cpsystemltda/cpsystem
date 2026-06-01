"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Sparkles,
  MessageSquare,
  Send,
  User,
  Loader2,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";
import {
  enviarMensagemIAsystemAction,
  limparHistoricoIAsystemAction,
  carregarHistoricoIAsystem,
} from "@/app/actions/iasystem";
import type { MensagemIAsystem } from "@/lib/iasystem";
import { MarkdownInline } from "@/lib/markdownInline";

const SUGESTOES_INICIAIS = [
  "Posso aderir a uma Ata de outro órgão sem ter participado? Quais os limites?",
  "Quando posso pedir reajuste por IPCA do meu contrato?",
  "Qual a diferença entre apostilamento e termo aditivo?",
  "Que tipo de garantia devo oferecer e em qual valor?",
];

// Botão flutuante (FAB) + drawer com o chat IAsystem embutido.
// Toda conversa acontece no drawer — não navega pra outra rota.
// Histórico vem do banco (isolado por usuarioId), não localStorage.
// Plano Básico: 2 perguntas grátis vitalícias; 3ª dispara modal de
// upgrade pro Premium (Regina 01/06). Premium e super admin: ilimitado.
const LIMITE_PERGUNTAS_BASICO = 2;

export function FlutuanteIAsystem({ plano }: { plano: string }) {
  const [aberto, setAberto] = useState(false);
  const isPremium = plano === "PREMIUM";

  return (
    <>
      {!aberto && <BotaoFAB onAbrir={() => setAberto(true)} />}
      {aberto && <Drawer onFechar={() => setAberto(false)} isPremium={isPremium} />}
    </>
  );
}

function BotaoFAB({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label="Abrir IAsystem — assistente jurídico"
      className="group fixed bottom-6 right-6 z-[60] inline-flex items-center gap-3 rounded-full pl-3 pr-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-2xl hover:scale-105"
      style={{
        background: "linear-gradient(135deg, #8E73E0 0%, #6B4FC9 100%)",
        boxShadow:
          "0 8px 24px -4px rgba(110, 78, 209, 0.45), 0 2px 8px rgba(110, 78, 209, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
      }}
    >
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20">
        <Sparkles className="h-4 w-4" />
        <span className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-60" />
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">
          IAsystem
        </span>
        <span className="text-[13px] font-extrabold whitespace-nowrap">
          Tire suas dúvidas
        </span>
      </span>
      <span className="ml-1 hidden items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap group-hover:inline-flex">
        <MessageSquare className="h-3 w-3" />
        Lei 14.133 em segundos
      </span>
    </button>
  );
}

function Drawer({ onFechar, isPremium }: { onFechar: () => void; isPremium: boolean }) {
  const [mensagens, setMensagens] = useState<MensagemIAsystem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [paywallAberto, setPaywallAberto] = useState(false);
  const [enviando, startTransition] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Contador de perguntas gratuitas usadas (so importa pra Bsico). Vem
  // do historico carregado + atualiza a cada envio bem-sucedido.
  const perguntasUsadas = mensagens.filter((m) => m.role === "user").length;
  const cota = LIMITE_PERGUNTAS_BASICO - perguntasUsadas;
  const semCota = !isPremium && cota <= 0;

  // Carrega histórico do banco quando o drawer abre — isolado por usuarioId.
  useEffect(() => {
    let ativo = true;
    carregarHistoricoIAsystem()
      .then((m) => {
        if (ativo) {
          setMensagens(m);
          setCarregando(false);
        }
      })
      .catch(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC fecha o drawer
  useEffect(() => {
    function handler(ev: KeyboardEvent) {
      if (ev.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onFechar]);

  function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || enviando) return;
    // Plano Básico: 2 perguntas gratuitas. Na 3a o servidor retorna
    // `paywall: true` e abrimos o modal de upgrade. Pre-bloqueio
    // client-side somente quando ja sabemos que zerou (defesa contra
    // race condition de duplo clique).
    if (semCota) {
      setPaywallAberto(true);
      return;
    }
    setErro(null);
    setMensagens((prev) => [...prev, { role: "user", content: pergunta }]);
    setRascunho("");
    startTransition(async () => {
      const res = await enviarMensagemIAsystemAction(pergunta);
      if (!res.ok) {
        if (res.paywall) {
          // Server confirma que estourou a cota — abre paywall e tira a
          // pergunta otimista que adicionamos antes.
          setMensagens((prev) => prev.slice(0, -1));
          setPaywallAberto(true);
        } else {
          setErro(res.erro);
        }
        return;
      }
      setMensagens((prev) => [...prev, { role: "assistant", content: res.resposta }]);
    });
  }

  function limparHistorico() {
    if (!window.confirm("Apagar todo o histórico de conversa com o IAsystem?")) return;
    startTransition(async () => {
      await limparHistoricoIAsystemAction();
      setMensagens([]);
      setErro(null);
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-sm"
        onClick={onFechar}
        aria-hidden
      />
      <div
        className="fixed bottom-6 right-6 z-[60] flex flex-col rounded-2xl bg-white shadow-2xl"
        style={{
          width: "min(440px, calc(100vw - 48px))",
          height: "min(640px, calc(100vh - 80px))",
          boxShadow:
            "0 24px 48px -8px rgba(15, 14, 12, 0.25), 0 8px 16px -4px rgba(15, 14, 12, 0.1)",
        }}
        role="dialog"
        aria-label="Chat IAsystem"
      >
        {/* Header */}
        <header
          className="flex items-center justify-between gap-3 rounded-t-2xl px-4 py-3 text-white"
          style={{ background: "linear-gradient(135deg, #8E73E0 0%, #6B4FC9 100%)" }}
        >
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">
                IAsystem
              </p>
              <p className="text-[13px] font-extrabold">Assistente jurídico</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {mensagens.length > 0 && (
              <button
                type="button"
                onClick={limparHistorico}
                disabled={enviando}
                title="Limpar histórico"
                className="rounded p-1.5 hover:bg-white/15 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onFechar}
              title="Fechar"
              className="rounded p-1.5 hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Mensagens */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ minHeight: 0, background: "rgba(248, 247, 245, 0.6)" }}
        >
          {carregando ? (
            <p className="grid h-full place-items-center text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
            </p>
          ) : mensagens.length === 0 ? (
            <BoasVindas onEscolher={enviar} />
          ) : (
            <div className="space-y-3">
              {mensagens.map((m, i) => (
                <Bolha key={i} mensagem={m} />
              ))}
              {enviando && <BolhaPensando />}
              <div ref={fimRef} />
            </div>
          )}
        </div>

        {erro && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Contador de perguntas gratuitas (plano Básico) */}
        {!isPremium && (
          <div
            className="mx-3 mb-2 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
            style={{
              background: semCota
                ? "linear-gradient(135deg, rgba(232,138,152,0.12), rgba(232,138,152,0.04))"
                : "linear-gradient(135deg, rgba(142,115,224,0.10), rgba(107,79,201,0.05))",
              border: semCota
                ? "0.5px solid rgba(232,138,152,0.3)"
                : "0.5px solid rgba(107,79,201,0.25)",
              color: semCota ? "var(--coral)" : "#6B4FC9",
            }}
          >
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {semCota ? (
                <>
                  <strong>Cota grátis esgotada.</strong> Você já usou suas{" "}
                  {LIMITE_PERGUNTAS_BASICO} perguntas gratuitas. Faça o upgrade
                  pro Premium pra continuar consultando o IAsystem.
                </>
              ) : (
                <>
                  <strong>{cota} pergunta{cota !== 1 ? "s" : ""} grátis</strong>{" "}
                  restante{cota !== 1 ? "s" : ""} ({perguntasUsadas} de{" "}
                  {LIMITE_PERGUNTAS_BASICO} usada
                  {perguntasUsadas !== 1 ? "s" : ""}). Upgrade pro Premium
                  desbloqueia chat ilimitado.
                </>
              )}
            </span>
          </div>
        )}

        {/* Input */}
        <form
          className="flex items-end gap-2 border-t border-slate-100 px-3 py-3"
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
            placeholder={
              semCota
                ? "Cota grátis esgotada — faça upgrade pro Premium…"
                : "Sua dúvida em Lei 14.133…"
            }
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            disabled={enviando}
          />
          <button
            type="submit"
            disabled={!rascunho.trim() || enviando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
            title={semCota ? "Cota grátis esgotada — clique pra fazer upgrade" : "Enviar (Enter)"}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {/* Modal paywall — aparece quando usuário Básico tenta enviar */}
      {paywallAberto && <PaywallModal onFechar={() => setPaywallAberto(false)} />}
    </>
  );
}

function PaywallModal({ onFechar }: { onFechar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onFechar}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <button
          type="button"
          onClick={onFechar}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        <div
          className="grid h-14 w-14 place-items-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, #8E73E0 0%, #6B4FC9 100%)" }}
        >
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-extrabold text-slate-900">
          Suas {LIMITE_PERGUNTAS_BASICO} perguntas grátis acabaram
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Pra continuar conversando com o <strong>IAsystem</strong> — assistente
          jurídico especializado em Lei 14.133/2021 — faça o upgrade pro plano{" "}
          <strong>Premium</strong>: chat ilimitado + análise de Atas, Contratos
          e Empenhos + parecer estruturado.
        </p>
        <ul className="mt-4 space-y-2 text-xs text-slate-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-violet-600">✓</span>
            <span>Chat ilimitado com IAsystem</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-violet-600">✓</span>
            <span>Análise de Ata, Contrato e Empenho com parecer estruturado</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-violet-600">✓</span>
            <span>12 consultas humanas/ano com especialistas do Grupo Contratos Públicos</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-violet-600">✓</span>
            <span>Canal VIP de atendimento</span>
          </li>
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a
            href="/conta/assinatura"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
          >
            <Sparkles className="h-4 w-4" /> Fazer upgrade pro Premium
          </a>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

function Bolha({ mensagem }: { mensagem: MensagemIAsystem }) {
  const ehUsuario = mensagem.role === "user";
  return (
    <div className={`flex gap-2 ${ehUsuario ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          ehUsuario
            ? "bg-gradient-to-br from-slate-700 to-slate-900 text-white"
            : "bg-gradient-to-br from-violet-500 to-violet-700 text-white"
        }`}
      >
        {ehUsuario ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
          ehUsuario ? "bg-slate-900 text-white" : "bg-white text-slate-800"
        }`}
        style={
          !ehUsuario
            ? { border: "0.5px solid var(--hairline)", boxShadow: "0 1px 2px rgba(15,14,12,0.04)" }
            : undefined
        }
      >
        {ehUsuario ? (
          <p className="whitespace-pre-wrap break-words">{mensagem.content}</p>
        ) : (
          <div className="break-words">
            <MarkdownInline texto={mensagem.content} />
          </div>
        )}
      </div>
    </div>
  );
}

function BolhaPensando() {
  return (
    <div className="flex gap-2">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div
        className="rounded-2xl bg-white px-3 py-2 text-[13px]"
        style={{ border: "0.5px solid var(--hairline)" }}
      >
        <p className="inline-flex items-center gap-2 text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
        </p>
      </div>
    </div>
  );
}

function BoasVindas({ onEscolher }: { onEscolher: (s: string) => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-3 text-lg font-bold text-slate-900">Olá! Sou o IAsystem.</h2>
      <p className="mt-1 text-xs text-slate-600">
        Pergunte sobre Lei 14.133, Atas, Contratos, Garantias, Reajustes.
      </p>
      <div className="mt-4 grid gap-1.5 text-left">
        {SUGESTOES_INICIAIS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onEscolher(s)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 transition hover:border-violet-300 hover:bg-violet-50"
          >
            {s}
          </button>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-slate-500">
        Histórico salvo na sua conta · isolado por usuário · Respostas geradas por IA.
      </p>
    </div>
  );
}
