"use client";

import { useActionState, useState } from "react";
import { MessageCircle, CheckCircle2, XCircle, Send } from "lucide-react";
import { responderChamadoAction } from "@/app/actions/suporte";

type Chamado = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  status: string;
  respostaIA: string | null;
  iaAcaoResumo: string | null;
  criadoEm: string;
  cliente: {
    nome: string;
    email: string;
    telefone: string;
    tipoConta: string;
    empresa?: string;
  };
  mensagens: { autor: string; conteudo: string; criadoEm: string }[];
};

export function ChamadoCard({ chamado }: { chamado: Chamado }) {
  const [state, formAction, pending] = useActionState(responderChamadoAction, null);
  const [rascunho, setRascunho] = useState(chamado.respostaIA ?? "");

  const badge = (() => {
    if (chamado.status === "AGUARDANDO_ADMIN")
      return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-800">Aguardando você</span>;
    if (chamado.status === "IA_ANALISANDO" || chamado.status === "ABERTO")
      return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">IA processando</span>;
    if (chamado.status === "EM_IMPLEMENTACAO")
      return <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800">Em implementação</span>;
    return null;
  })();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {badge}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{chamado.categoria}</span>
            <span className="text-xs text-slate-400">{new Date(chamado.criadoEm).toLocaleString("pt-BR")}</span>
          </div>
          <h3 className="mt-2 text-base font-bold text-slate-900">{chamado.titulo}</h3>
          <p className="mt-1 text-xs text-slate-600">
            <strong>{chamado.cliente.nome}</strong>{" "}
            ({chamado.cliente.tipoConta}
            {chamado.cliente.empresa ? ` · ${chamado.cliente.empresa}` : ""}) · {chamado.cliente.telefone || "sem WA"} · {chamado.cliente.email}
          </p>
        </div>
      </div>

      {chamado.iaAcaoResumo && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          <strong>Nota IA:</strong> {chamado.iaAcaoResumo}
        </div>
      )}

      {/* Histórico da conversa */}
      <div className="mt-4 space-y-2">
        {chamado.mensagens.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.autor === "CLIENTE"
                ? "bg-slate-50 border border-slate-200"
                : m.autor === "IA"
                  ? "bg-violet-50 border border-violet-200 ml-8"
                  : "bg-green-50 border border-green-200 ml-8"
            }`}
          >
            <p className="text-[10px] font-bold uppercase text-slate-500">{m.autor}</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.conteudo}</p>
          </div>
        ))}
      </div>

      {/* Ações */}
      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="chamadoId" value={chamado.id} />
        <textarea
          name="resposta"
          value={rascunho}
          onChange={(ev) => setRascunho(ev.target.value)}
          rows={3}
          placeholder="Escreva a resposta que vai pro WhatsApp do cliente..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
        />
        {state?.erro && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-800">{state.erro}</div>}
        {state?.ok && <div className="rounded bg-green-50 px-3 py-2 text-xs text-green-800">✓ Resposta enviada.</div>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="acao"
            value="responder"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Send size={14} /> {pending ? "Enviando..." : "Responder"}
          </button>
          <button
            type="submit"
            name="acao"
            value="resolver"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 size={14} /> Responder e marcar RESOLVIDO
          </button>
          <button
            type="submit"
            name="acao"
            value="recusar"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-300 disabled:opacity-50"
            onClick={(ev) => {
              if (!window.confirm("Marcar chamado como RECUSADO? Cliente não recebe mensagem automática.")) ev.preventDefault();
            }}
          >
            <XCircle size={14} /> Recusar
          </button>
        </div>
      </form>
    </div>
  );
}
