"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 block w-fit">
        <Logo variant="md" priority />
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Entrar na sua conta</h1>
      <p className="mt-2 text-sm text-slate-600">Acesse o painel de gestão dos seus contratos públicos.</p>

      <form action={formAction} className="mt-8 grid grid-cols-2 gap-4">
        <Field label="E-mail" name="email" type="email" autoComplete="email" required span={2} />
        <Field label="Senha" name="senha" type="password" autoComplete="current-password" required span={2} />

        {state?.erro && (
          <div className="col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.erro}
          </div>
        )}

        <div className="col-span-2 mt-2 flex items-center justify-between">
          <SubmitButton>Entrar</SubmitButton>
          <Link href="/signup" className="text-sm text-blue-600 hover:underline">
            Criar nova conta →
          </Link>
        </div>
      </form>
    </div>
  );
}
