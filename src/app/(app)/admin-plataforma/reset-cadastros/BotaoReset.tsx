"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Resultado = Awaited<ReturnType<NonNullable<typeof window>["fetch"]>> extends infer _ ? unknown : never;

type AcaoReset = () => Promise<{
  ok: boolean;
  apagados?: { contas: number; usuarios: number; empresas: number; analistas: number };
  erro?: string;
}>;

export function BotaoReset({ acao }: { acao: AcaoReset }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{
    ok: boolean;
    apagados?: { contas: number; usuarios: number; empresas: number; analistas: number };
    erro?: string;
  } | null>(null);

  function executar() {
    startTransition(async () => {
      const r = await acao();
      setResultado(r);
      setConfirmando(false);
    });
  }

  if (resultado?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-semibold">Reset concluído</h3>
            <ul className="mt-2 space-y-0.5 text-sm">
              <li>{resultado.apagados?.contas ?? 0} contas removidas</li>
              <li>{resultado.apagados?.usuarios ?? 0} usuários removidos</li>
              <li>{resultado.apagados?.empresas ?? 0} empresas removidas</li>
              <li>{resultado.apagados?.analistas ?? 0} analistas removidos</li>
            </ul>
            <p className="mt-3 text-xs">
              Recarregue a página pra ver as contagens zeradas. Os super admins precisarão fazer login novamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (resultado?.erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{resultado.erro}</p>
        </div>
      </div>
    );
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
      >
        Apagar cadastros de teste
      </button>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5">
      <p className="text-sm font-semibold text-red-900">
        Tem certeza? Essa ação não pode ser desfeita.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={pendente}
          onClick={executar}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
        >
          {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
          {pendente ? "Apagando…" : "Sim, apagar tudo"}
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => setConfirmando(false)}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
