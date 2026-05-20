import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { BotaoGerarMinuta } from "./MinutaIaPainel";

/**
 * Banner de alerta de reajuste de preços.
 * Aparece automaticamente quando a janela de reajuste (marcoOrcamentoEstimado + 1 ano)
 * está a ≤ 90 dias do hoje, ou já venceu.
 *
 * Renderiza nada quando o marco não foi cadastrado ou está distante.
 */
export function AlertaReajuste({
  marcoOrcamentoEstimado,
  hrefReajustes = "/reajustes",
  contratoId,
}: {
  marcoOrcamentoEstimado: Date | null;
  hrefReajustes?: string;
  /** Quando fornecido, exibe botão "Gerar pedido de reajuste com IA". */
  contratoId?: string;
}) {
  if (!marcoOrcamentoEstimado) return null;

  const hoje = new Date();
  const janela = new Date(marcoOrcamentoEstimado.getTime() + 365 * 86400000);
  const diasParaJanela = Math.ceil((janela.getTime() - hoje.getTime()) / 86400000);

  // Só exibe quando faltam ≤ 90 dias OU já passou.
  if (diasParaJanela > 90) return null;

  const cabivel = diasParaJanela <= 0;

  return (
    <div
      className={`mt-4 flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
        cabivel ? "border-amber-300 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"
      }`}
    >
      <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">
          {cabivel ? "Reajuste de preços já cabível" : `Janela de reajuste em ${diasParaJanela} dia(s)`}
        </p>
        <p className="text-xs">
          Marco do orçamento estimado: {marcoOrcamentoEstimado.toLocaleDateString("pt-BR")} — janela de
          reajuste em {janela.toLocaleDateString("pt-BR")}
          {cabivel && ` (há ${Math.abs(diasParaJanela)} dia(s))`}.{" "}
          <Link href={hrefReajustes} className="underline">
            Abrir tela de Reajustes
          </Link>
        </p>
        {contratoId && cabivel && (
          <div className="mt-2">
            <BotaoGerarMinuta
              tipo="PEDIDO_REAJUSTE"
              recursoId={contratoId}
              rotulo="Gerar pedido de reajuste com IA"
              variante="ghost"
            />
          </div>
        )}
      </div>
    </div>
  );
}
