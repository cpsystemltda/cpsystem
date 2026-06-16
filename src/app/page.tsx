import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import HomeLandingClient from "@/components/HomeLandingClient";

export default async function Home() {
  const usuario = await getUsuarioAtual();
  if (usuario) redirect("/dashboard");
  return <HomeLandingClient />;
}
