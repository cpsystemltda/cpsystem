"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Check } from "lucide-react";
import { marcarComissaoPagoPelaEmpresaAction } from "@/app/actions/comissaoExecucao";
import { brl } from "@/lib/validators";

/**
 * Botão da empresa pra declarar que repassou a comissão variável ao analista.
 *
 * Morava dentro de `(app)/vinculos/VinculoForms.tsx` e por isso só existia na
 * aba "Analista vinculado". O Igor reclamou (20/08): o valor pendente aparece
 * em "Honorários do analista" — que é a tela de pagar o analista — mas o botão
 * de pagar não estava lá, só um aviso mandando pedir pro analista. Movido pra
 * cá pra as duas telas usarem o mesmo componente e a mesma server action.
 *
 * Não marca "Pago" direto: grava PAGO_AGUARDANDO_CONFIRMACAO e dispara WhatsApp
 * pro analista, que confirma o recebimento. Quem declara o pagamento é quem
 * paga; quem confirma é quem recebe.
 */
export function MarcarComissaoPagoForm({
  comissaoId,
  empenhoRef,
  valor,
}: {
  comissaoId: string;
  empenhoRef: string;
  valor: number;
}) {
  const [state, formAction] = useActionState(marcarComissaoPagoPelaEmpresaAction, null);
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        Marcar como pago
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
      <input type="hidden" name="id" value={comissaoId} />
      <p className="text-xs text-slate-700">
        Confirmar pagamento de <strong>{brl(valor)}</strong> — comissão do empenho {empenhoRef}?
        O analista recebe WhatsApp e precisa confirmar recebimento.
      </p>
      <input
        type="text"
        name="observacao"
        placeholder="Observação (opcional): PIX, TED, etc."
        className="rounded border border-slate-300 px-2 py-1 text-xs"
        maxLength={200}
      />
      <div className="flex items-center gap-2">
        <SubmitEmerald>Confirmar pagamento</SubmitEmerald>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
      {state?.erro && <p className="text-xs text-rose-600">{state.erro}</p>}
    </form>
  );
}

function SubmitEmerald({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
    >
      {pending ? <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> : <Check className="inline h-3 w-3 mr-1" />}
      {children}
    </button>
  );
}
