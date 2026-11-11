"use client";

import { useState, useTransition } from "react";
import { lancarAdicionalAction } from "@/app/actions/faixasTerceirizacao";

export function BotaoLancarAdicional({ apuracaoId, rotulo }: { apuracaoId: string; rotulo: string }) {
  const [pendente, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  if (msg?.ok) return <span className="text-xs text-emerald-800">{msg.texto}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-primary text-xs"
        disabled={pendente}
        onClick={() =>
          confirm(`Lançar no Asaas: ${rotulo}?\n\nA cobrança vence junto com a próxima mensalidade do cliente.`) &&
          start(async () => {
            const r = await lancarAdicionalAction(apuracaoId);
            setMsg(r?.ok ? { ok: true, texto: r.mensagem ?? "Lançado." } : { ok: false, texto: r?.erro ?? "Falhou." });
          })
        }
      >
        {pendente ? "Lançando…" : "Lançar no Asaas"}
      </button>
      {msg && !msg.ok && <span className="text-xs text-red-700">{msg.texto}</span>}
    </span>
  );
}
