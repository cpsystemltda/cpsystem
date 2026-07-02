import { exigirUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";

// Layout minimalista do wizard de onboarding — sem sidebar, sem menu.
// So mostra logo + wizard. Super admin nao passa por aqui.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  if (usuario.superAdmin) redirect("/dashboard");

  // Se ja concluiu, nao volta pro wizard
  const perfilUsuario = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { onboardingConcluido: true },
  });
  if (perfilUsuario?.onboardingConcluido) redirect("/dashboard");

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <header className="border-b py-5" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto max-w-3xl px-6">
          <Logo variant="md" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
