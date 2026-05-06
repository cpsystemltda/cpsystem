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
    <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[5fr_6fr]">
      {/* Painel de marca — esquerda (lg+) */}
      <aside className="relative hidden flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1A1206] via-[#0C1019] to-[#1F232B] px-12 py-20 lg:flex">
        {/* Halo dourado sutil */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-[#D4AF37]/15 blur-3xl" />
          <div className="absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-[#B8860B]/10 blur-3xl" />
        </div>
        {/* Pattern muito sutil em diagonal */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #D4AF37 0px, #D4AF37 1px, transparent 1px, transparent 22px)",
          }}
        />

        <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
          <Logo variant="lg" mode="brand" onDark priority />
          <p
            className="mt-12 text-2xl leading-snug text-white/90"
            style={{ fontFamily: "var(--font-brand)" }}
          >
            Da licitação ganha
            <br />
            ao pagamento.
          </p>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/55">
            Plataforma premium para empresas que vendem ao governo, sob a Lei 14.133/2021.
          </p>
          <div className="mt-12 h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />
          <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.4em] text-[#D4AF37]/80">
            Contratos Públicos
          </p>
        </div>
      </aside>

      {/* Painel do formulário — direita / única em mobile */}
      <main className="relative flex flex-col items-center justify-center bg-gradient-to-b from-white via-[#FBF8F0] to-white px-6 py-16 sm:px-10">
        {/* Logo só no mobile (no desktop fica no painel lateral) */}
        <div className="lg:hidden">
          <Link href="/" className="block">
            <Logo variant="md" mode="brand" priority />
          </Link>
        </div>

        <div className="w-full max-w-md">
          <h1
            className="mt-10 text-center text-3xl text-[#2D3340] lg:mt-0"
            style={{ fontFamily: "var(--font-brand)", letterSpacing: "0.02em" }}
          >
            Entrar na sua conta
          </h1>
          <p className="mt-3 text-center text-sm text-slate-500">
            Acesse o painel de gestão dos seus contratos.
          </p>

          <form action={formAction} className="mt-10 grid grid-cols-2 gap-5">
            <Field label="E-mail" name="email" type="email" autoComplete="email" required span={2} />
            <Field label="Senha" name="senha" type="password" autoComplete="current-password" required span={2} />

            {state?.erro && (
              <div className="col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.erro}
              </div>
            )}

            <div className="col-span-2 mt-2 flex flex-col gap-4">
              <SubmitButton>Entrar</SubmitButton>
              <p className="text-center text-sm text-slate-500">
                Não tem conta?{" "}
                <Link href="/signup" className="font-semibold text-[#9C7A2D] hover:text-[#B8860B]">
                  Criar conta
                </Link>
              </p>
            </div>
          </form>

          <div className="mt-12 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.3em] text-slate-400">
            <span className="h-px w-8 bg-slate-200" />
            <span>LGPD · Auditável · BR</span>
            <span className="h-px w-8 bg-slate-200" />
          </div>
        </div>
      </main>
    </div>
  );
}
