"use client";

import { useState } from "react";
import { Copy, Check, MessageCircle, Mail, Globe } from "lucide-react";

export type MensagemNaTela = { canal: "whatsapp" | "email" | "linkedin"; titulo: string; texto: string };

const ICONE = { whatsapp: MessageCircle, email: Mail, linkedin: Globe };

/** Textos prontos com o cupom já dentro: a pessoa copia e cola, sem inventar frase. */
export function MensagensProntas({ mensagens }: { mensagens: MensagemNaTela[] }) {
  const [copiada, setCopiada] = useState<string | null>(null);

  async function copiar(m: MensagemNaTela) {
    try {
      await navigator.clipboard.writeText(m.texto);
      setCopiada(m.canal);
      setTimeout(() => setCopiada(null), 2000);
    } catch {
      /* sem clipboard */
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {mensagens.map((m) => {
        const Icone = ICONE[m.canal];
        return (
          <div key={m.canal} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 text-[12.5px] font-bold text-slate-800">
              <Icone className="h-4 w-4 text-slate-500" /> {m.titulo}
            </p>
            <pre className="mt-2 flex-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[12.5px] leading-relaxed text-slate-700">{m.texto}</pre>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => copiar(m)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                {copiada === m.canal ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
              </button>
              {m.canal === "whatsapp" && (
                <a href={`https://wa.me/?text=${encodeURIComponent(m.texto)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100">
                  <MessageCircle className="h-3.5 w-3.5" /> Abrir no WhatsApp
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
