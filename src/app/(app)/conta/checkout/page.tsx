import { exigirUsuario } from "@/lib/auth";
import { calcularValorMensal } from "@/lib/precos";
import { CheckoutClient } from "./CheckoutClient";

export default async function Page({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const plano = sp.plano === "PREMIUM" ? "PREMIUM" : "BASICO";

  // Breakdown pros dois planos pra UI mostrar o valor real (BASICO inclui CNPJ adicional).
  const breakdownBasico = await calcularValorMensal(usuario.contaId, "BASICO");
  const breakdownPremium = await calcularValorMensal(usuario.contaId, "PREMIUM");

  return (
    <CheckoutClient
      planoInicial={plano}
      breakdownBasico={breakdownBasico}
      breakdownPremium={breakdownPremium}
    />
  );
}
