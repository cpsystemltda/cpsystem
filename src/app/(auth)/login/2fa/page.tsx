import { redirect } from "next/navigation";
import { lerPending2FA } from "@/lib/pending2FA";
import { TwoFactorLoginForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function Login2FAPage() {
  const usuarioId = await lerPending2FA();
  if (!usuarioId) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Verificação em 2 fatores</h1>
        <p className="mt-1 text-sm text-slate-600">
          Digite o código de 6 dígitos do seu app authenticator pra continuar.
        </p>
        <TwoFactorLoginForm />
      </div>
    </div>
  );
}
