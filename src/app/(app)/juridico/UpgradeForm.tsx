import Link from "next/link";
import { Sparkles } from "lucide-react";

// Mantém os mesmos componentes mas agora mandam pro fluxo real de checkout.
// O downgrade vira um link pra trocar de plano também.
export function UpgradeForm() {
  return (
    <Link
      href="/conta/checkout?plano=PREMIUM"
      className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-700 hover:to-blue-700"
    >
      <Sparkles className="h-4 w-4" /> Fazer upgrade para Premium
    </Link>
  );
}

export function DowngradeForm() {
  return (
    <Link
      href="/conta/checkout?plano=BASICO"
      className="mt-4 inline-block text-xs text-slate-500 underline-offset-2 hover:underline"
    >
      Voltar para o plano Básico
    </Link>
  );
}
