"use client";

import { useState } from "react";
import { LifeBuoy, BookOpen, X, MessageCircle, Mail, Phone } from "lucide-react";

// Versão inline (só ícones) do HelpButtons — pra caber no footer compacto
// do sidebar sem ocupar 2 linhas de cards. Modais continuam idênticos
// ao componente original.
export function HelpButtonsInline() {
  const [aberto, setAberto] = useState<"suporte" | "manual" | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto("suporte")}
        title="Falar com suporte"
        aria-label="Falar com suporte"
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
      >
        <LifeBuoy className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setAberto("manual")}
        title="Manual do usuário"
        aria-label="Manual do usuário"
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
      >
        <BookOpen className="h-4 w-4" />
      </button>

      {aberto && <Modal aberto={aberto} onClose={() => setAberto(null)} />}
    </>
  );
}

function Modal({ aberto, onClose }: { aberto: "suporte" | "manual"; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
        {aberto === "suporte" ? <ContentSuporte /> : <ContentManual />}
      </div>
    </div>
  );
}

function ContentSuporte() {
  return (
    <>
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-7 text-white">
        <LifeBuoy className="h-8 w-8" />
        <h2 className="mt-3 text-2xl font-bold">Como podemos ajudar?</h2>
        <p className="mt-2 text-sm text-emerald-50">
          Equipe de suporte humano em português, segunda a sexta das 8h às 18h.
        </p>
      </div>
      <div className="space-y-3 p-6">
        <CanalSuporte
          icone={MessageCircle}
          cor="bg-green-100 text-green-700"
          titulo="WhatsApp Business"
          texto="Resposta média em 15 min em horário comercial"
          acao="Abrir conversa"
          link="https://wa.me/556139000000"
        />
        <CanalSuporte
          icone={Mail}
          cor="bg-blue-100 text-blue-700"
          titulo="E-mail"
          texto="suporte@contratospublicos.com.br"
          acao="Enviar e-mail"
          link="mailto:suporte@contratospublicos.com.br"
        />
        <CanalSuporte
          icone={Phone}
          cor="bg-violet-100 text-violet-700"
          titulo="Suporte prioritário (Premium)"
          texto="Linha dedicada com SLA · clientes Premium"
          acao="Ligar agora"
          link="tel:+556139000000"
        />
      </div>
    </>
  );
}

function CanalSuporte({
  icone: Icone,
  cor,
  titulo,
  texto,
  acao,
  link,
}: {
  icone: React.ComponentType<{ className?: string }>;
  cor: string;
  titulo: string;
  texto: string;
  acao: string;
  link: string;
}) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${cor}`}>
        <Icone className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900">{titulo}</p>
        <p className="text-xs text-slate-500">{texto}</p>
      </div>
      <span className="text-xs font-medium text-blue-700">{acao} →</span>
    </a>
  );
}

function ContentManual() {
  const secoes = [
    { t: "Primeiros passos", d: "Cadastre sua primeira empresa, vincule analista e configure a equipe." },
    { t: "Cadastrar Ata via PDF", d: "Use a IA pra extrair número, processo, órgão, vigência e itens em segundos." },
    { t: "Derivar contratos e empenhos", d: "Cada novo cadastro abate o saldo da Ata automaticamente." },
    { t: "Acompanhar a execução", d: "Linha do tempo logística — do empenhado ao pagamento." },
    { t: "Painel do analista", d: "Comissão por execução paga, fixo mensal e ranking de empresas." },
    { t: "Notificações e alertas", d: "Prazos fatais, mudança de status e novas execuções." },
  ];
  return (
    <>
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-7 text-white">
        <BookOpen className="h-8 w-8" />
        <h2 className="mt-3 text-2xl font-bold">Manual do usuário</h2>
        <p className="mt-2 text-sm text-blue-100">
          Tudo que você precisa pra extrair o máximo do CP System.
        </p>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-6">
        <div className="space-y-2">
          {secoes.map((s) => (
            <a
              key={s.t}
              href="#"
              className="block rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/30"
            >
              <p className="text-sm font-semibold text-slate-900">{s.t}</p>
              <p className="mt-0.5 text-xs text-slate-600">{s.d}</p>
            </a>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Manual completo em PDF · Disponível em breve com tutoriais em vídeo.
        </p>
      </div>
    </>
  );
}
