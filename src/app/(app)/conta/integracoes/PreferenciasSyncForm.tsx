"use client";

import { useActionState, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { salvarPreferenciasGoogleAction } from "@/app/actions/googleCalendar";

// O cliente escolhe o que o CP System manda pra agenda dele (Leo 30/07).
// Nao e escolha de "qual agenda do Google" — o sistema nem enxerga as outras
// agendas dele; e escolha do que sai daqui pra agenda dedicada.
const TIPOS = [
  {
    campo: "syncEmpenhos",
    titulo: "Prazos de entrega",
    descricao: "Data limite de cada empenho, carta-contrato e ordem de serviço",
  },
  {
    campo: "syncContratos",
    titulo: "Vigência de contratos",
    descricao: "Quando cada contrato chega ao fim",
  },
  {
    campo: "syncAtas",
    titulo: "Vigência de atas",
    descricao: "Quando cada ata de registro de preços expira",
  },
  {
    campo: "syncGarantias",
    titulo: "Garantias",
    descricao: "Vencimento de seguro-garantia e caução",
  },
  {
    campo: "syncCobrancas",
    titulo: "Faturas do CP System",
    descricao: "Vencimento da sua mensalidade",
  },
] as const;

export function PreferenciasSyncForm({
  valores,
}: {
  valores: Record<string, boolean>;
}) {
  const [state, formAction, isPending] = useActionState(salvarPreferenciasGoogleAction, null);
  const [tocado, setTocado] = useState(false);

  return (
    <form action={formAction} onChange={() => setTocado(true)}>
      <div className="flex flex-col gap-2.5">
        {TIPOS.map((t) => (
          <label
            key={t.campo}
            className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/60"
            style={{ border: "0.5px solid var(--hairline)" }}
          >
            <input
              type="checkbox"
              name={t.campo}
              defaultChecked={valores[t.campo] ?? true}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#A88947]"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold" style={{ color: "var(--text)" }}>
                {t.titulo}
              </span>
              <span className="block text-[12px]" style={{ color: "var(--text-mute)" }}>
                {t.descricao}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
            color: "#1A1A1F",
          }}
        >
          {isPending ? "Salvando…" : "Salvar preferências"}
        </button>

        {state?.ok && !tocado && (
          <span
            className="flex items-center gap-1.5 text-[12px] font-bold"
            style={{ color: "#2F8F4C" }}
          >
            <CalendarCheck size={13} />
            Preferências salvas
          </span>
        )}
        {state?.erro && (
          <span className="text-[12px] font-bold" style={{ color: "#BE123C" }}>
            {state.erro}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[11.5px]" style={{ color: "var(--text-mute)" }}>
        Desmarcar um item para de criar eventos novos daquele tipo. Os que já estão na
        agenda continuam lá — apague pelo Google se quiser removê-los.
      </p>
    </form>
  );
}
