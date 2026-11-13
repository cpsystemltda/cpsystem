"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { arquivarContaAction } from "@/app/actions/arquivoClientes";

export function BotaoArquivo({ contaId, nome, arquivada }: { contaId: string; nome: string; arquivada: boolean }) {
  const [pendente, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      title={arquivada ? "Voltar para a carteira" : "Mover para Arquivados"}
      onClick={() =>
        confirm(arquivada ? `Reativar ${nome} na carteira de clientes?` : `Mover ${nome} para Arquivados? Nenhum dado é apagado e o cliente não é avisado.`) &&
        start(async () => {
          const r = await arquivarContaAction(contaId, !arquivada);
          if (r.erro) alert(r.erro);
        })
      }
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      {arquivada ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
      {pendente ? "…" : arquivada ? "Reativar" : "Arquivar"}
    </button>
  );
}
