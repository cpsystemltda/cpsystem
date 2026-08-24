import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Aviso do último dia de teste (Regina 24/08).
 *
 * "No 14º dia eu já tenho que exigir o cartão." Exigir aqui é isto: um aviso
 * que acompanha o cliente em toda tela, com o caminho pronto — e não uma trava,
 * porque a trava é a regra do 15º dia. Quem cadastra hoje não sente a virada;
 * quem ignora, amanhã só consegue abrir a tela de pagamento.
 */
export function AvisoUltimoDiaTrial() {
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b px-6 py-3 text-sm"
      style={{
        background: "linear-gradient(90deg, rgba(212,175,55,0.16), rgba(212,175,55,0.06))",
        borderColor: "rgba(212,175,55,0.45)",
        color: "#5C4708",
      }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-[240px]">
        <strong>Hoje é o último dia do seu teste gratuito.</strong> Cadastre a forma de pagamento
        para continuar usando o sistema amanhã — PIX, boleto ou cartão, você escolhe.
      </span>
      <Link
        href="/conta/completar-cadastro"
        className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide"
        style={{ background: "linear-gradient(135deg, #E8C875, #D4AF37)", color: "#0A0A0A" }}
      >
        Escolher como pagar
      </Link>
    </div>
  );
}
