import { exigirUsuario } from "@/lib/auth";
import { CheckoutClient } from "./CheckoutClient";

export default async function Page({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  await exigirUsuario();
  const sp = await searchParams;
  const plano = sp.plano === "PREMIUM" ? "PREMIUM" : "BASICO";
  return <CheckoutClient planoInicial={plano} />;
}
