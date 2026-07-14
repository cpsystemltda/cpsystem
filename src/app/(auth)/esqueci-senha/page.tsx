"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { solicitarResetSenhaAction } from "@/app/actions/senhaReset";
import { Logo } from "@/components/Logo";

export default function EsqueciSenhaPage() {
  const [state, formAction] = useActionState(solicitarResetSenhaAction, null);

  return (
    <div className="relative flex min-h-screen flex-col" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FAF6EB 60%, #F2E9CF 100%)" }}>
      <header className="w-full">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-8 pt-7 pb-4">
          <Link href="/" className="flex items-center">
            <Logo variant="md" mode="brand" priority />
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-semibold text-[#3A3A3A] transition hover:opacity-70"
          >
            &larr; Voltar para login
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-8 py-14">
        <div className="w-full max-w-[440px]">
          <div className="text-center">
            <span
              className="text-[11px] font-bold uppercase"
              style={{ color: "#A88947", letterSpacing: "0.32em" }}
            >
              Recuperar acesso
            </span>
            <h1
              className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-[#1A1A1F]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Esqueci minha{" "}
              <em
                style={{
                  fontStyle: "normal",
                  background: "linear-gradient(135deg, #A88947, #D4AF37)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                senha
              </em>
            </h1>
            <p className="mt-3 text-[13px] text-[#6B6B6B]">
              Digite o e-mail cadastrado. Se estiver na base, enviamos um link de redefinição por WhatsApp.
            </p>
          </div>

          <div
            className="mt-6 overflow-hidden rounded-[24px] bg-white px-8 py-8"
            style={{
              border: "0.5px solid rgba(168,137,71,0.25)",
              boxShadow: "0 24px 60px -20px rgba(20,16,8,0.18), 0 6px 20px -10px rgba(20,16,8,0.08)",
            }}
          >
            {state?.ok ? (
              <div
                className="rounded-2xl px-5 py-5"
                style={{
                  background: "rgba(63,168,95,0.08)",
                  border: "0.5px solid rgba(63,168,95,0.35)",
                  color: "#2F8F4C",
                }}
              >
                <p className="text-sm font-semibold">✓ Solicitação recebida</p>
                <p className="mt-2 text-[13px]">{state.detalhe}</p>
                <p className="mt-3 text-[11px] text-slate-500">
                  Não recebeu em alguns minutos? Verifique se seu WhatsApp está cadastrado no sistema
                  ou entre em contato com <code>contato@cpsystem.app.br</code>.
                </p>
              </div>
            ) : (
              <form action={formAction} className="grid grid-cols-1 gap-5">
                <Field
                  label="E-mail cadastrado"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  span={4}
                  erro={state?.campos?.email}
                />

                {state?.erro && (
                  <div
                    className="rounded-2xl px-4 py-3 text-sm"
                    style={{
                      background: "rgba(232,138,152,0.14)",
                      border: "0.5px solid rgba(198,103,112,0.5)",
                      color: "#A04550",
                    }}
                  >
                    {state.erro}
                  </div>
                )}

                <div className="mt-1">
                  <SubmitButton>Enviar link por WhatsApp</SubmitButton>
                </div>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-[12px] text-[#6B6B6B]">
            Sem WhatsApp cadastrado? Fale com{" "}
            <a href="mailto:contato@cpsystem.app.br" className="font-bold text-[#A88947] hover:opacity-80">
              contato@cpsystem.app.br
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
