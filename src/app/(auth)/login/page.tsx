"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Building2, UserCheck } from "lucide-react";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

// /login (Regina 16/06): SO o formulario de login. A landing publica fica em /.
export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);
  const [tipoEscolhido, setTipoEscolhido] = useState<"EMPRESA" | "ANALISTA" | null>(null);

  return (
    <div className="auth-shell relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23C5A24B' stroke-width='0.5' opacity='0.07'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3C/g%3E%3C/svg%3E\"), linear-gradient(180deg, #FFFFFF 0%, #FAF6EB 60%, #F2E9CF 100%)",
          backgroundSize: "240px 240px, auto",
          backgroundRepeat: "repeat, no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      <header className="relative z-[3] w-full">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-8 pt-7 pb-4">
          <Link href="/" className="flex items-center">
            <Logo variant="md" mode="brand" priority />
          </Link>
          <Link
            href="/"
            className="text-[13px] font-semibold text-[#3A3A3A] transition hover:opacity-70"
          >
            &larr; Voltar para a página inicial
          </Link>
        </div>
      </header>

      <main className="relative z-[2] flex flex-1 items-center justify-center px-8 py-14">
        <div className="w-full max-w-[480px]">
          <div className="text-center">
            <span
              className="text-[11px] font-bold uppercase"
              style={{ color: "#A88947", letterSpacing: "0.32em" }}
            >
              Acessar plataforma
            </span>
            <h1
              className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-[#1A1A1F] lg:text-[30px]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Entre na sua{" "}
              <em
                style={{
                  fontStyle: "normal",
                  background: "linear-gradient(135deg, #A88947, #D4AF37)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                conta
              </em>
            </h1>
          </div>

          <div
            className="mt-7 overflow-hidden rounded-[24px] bg-white px-8 py-8"
            style={{
              border: "0.5px solid rgba(168,137,71,0.25)",
              boxShadow:
                "0 24px 60px -20px rgba(20,16,8,0.18), 0 6px 20px -10px rgba(20,16,8,0.08)",
            }}
          >
            <div
              className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase"
              style={{ letterSpacing: "0.22em" }}
            >
              <span style={{ color: tipoEscolhido === null ? "#C66770" : "#9A9A9A" }}>Você é:</span>
              {tipoEscolhido !== null && (
                <button
                  type="button"
                  onClick={() => setTipoEscolhido(null)}
                  className="text-[10px] font-bold uppercase transition hover:opacity-80"
                  style={{ color: "#9A9A9A", letterSpacing: "0.18em" }}
                >
                  Trocar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <TabTipo
                icone={Building2}
                label="Empresa"
                hint="Vendo ao governo"
                ativo={tipoEscolhido === "EMPRESA"}
                destacarVazio={tipoEscolhido === null}
                onClick={() => setTipoEscolhido("EMPRESA")}
              />
              <TabTipo
                icone={UserCheck}
                label="Analista"
                hint="Indico clientes"
                ativo={tipoEscolhido === "ANALISTA"}
                destacarVazio={tipoEscolhido === null}
                onClick={() => setTipoEscolhido("ANALISTA")}
              />
            </div>

            <div className="mt-6">
              {tipoEscolhido === null ? (
                <div
                  className="rounded-2xl px-5 py-5 text-center"
                  style={{
                    background: "#FAF6EB",
                    border: "1px dashed rgba(168,137,71,0.35)",
                  }}
                >
                  <p className="text-[13px] font-semibold text-[#3A3A3A]">
                    Escolha acima o tipo de conta pra continuar.
                  </p>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-[#6B6B6B]">
                    <strong className="text-[#3A3A3A]">Empresa</strong> usa o sistema pra gerir
                    contratos &middot; <strong className="text-[#3A3A3A]">Analista</strong> indica
                    clientes e ganha comissão.
                  </p>
                </div>
              ) : (
                <form action={formAction} className="grid grid-cols-1 gap-5">
                  <input type="hidden" name="tipo" value={tipoEscolhido} />
                  <Field
                    label="E-mail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    span={4}
                  />
                  <Field
                    label="Senha"
                    name="senha"
                    type="password"
                    autoComplete="current-password"
                    required
                    span={4}
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
                    <SubmitButton>
                      Entrar como {tipoEscolhido === "EMPRESA" ? "Empresa" : "Analista"}
                    </SubmitButton>
                  </div>
                </form>
              )}
            </div>

            <div className="mt-7">
              <p className="text-center text-[13px] text-[#6B6B6B]">
                Não tem conta?{" "}
                <Link
                  href={`/signup${tipoEscolhido ? `?tipo=${tipoEscolhido}` : ""}`}
                  className="font-bold text-[#A88947] transition hover:opacity-80"
                >
                  Criar conta{" "}
                  {tipoEscolhido === "EMPRESA"
                    ? "de empresa"
                    : tipoEscolhido === "ANALISTA"
                      ? "de analista"
                      : "agora"}
                </Link>
              </p>
              <div
                className="mt-5 flex items-center justify-center gap-3 text-[10px] uppercase text-[#9A9A9A]"
                style={{ letterSpacing: "0.3em" }}
              >
                <span className="h-px w-8 bg-[#E8DCB8]" />
                <span>Conexão segura &middot; LGPD</span>
                <span className="h-px w-8 bg-[#E8DCB8]" />
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer
        className="relative z-[1] border-t pb-7 pt-5"
        style={{ borderColor: "rgba(168,137,71,0.18)" }}
      >
        <div
          className="mx-auto flex max-w-[1320px] flex-col items-center gap-2 px-8 text-[11px] uppercase sm:flex-row sm:justify-between"
          style={{ letterSpacing: "0.24em", color: "#9A9A9A" }}
        >
          <span>CP System &middot; Plataforma Premium</span>
          <span>LGPD &middot; Trilha auditável &middot; Conexão segura</span>
        </div>
      </footer>

      <style jsx>{`
        .auth-shell :global(input[type="email"]),
        .auth-shell :global(input[type="password"]),
        .auth-shell :global(input[type="text"]) {
          background: #ffffff;
          color: #1a1a1f;
          border: 0.5px solid rgba(168, 137, 71, 0.25);
        }
        .auth-shell :global(input::placeholder) {
          color: #9a9a9a;
        }
        .auth-shell :global(input:focus) {
          outline: none;
          border-color: #d4af37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.18);
        }
      `}</style>
    </div>
  );
}

function TabTipo({
  icone: Icone,
  label,
  hint,
  ativo,
  destacarVazio,
  onClick,
}: {
  icone: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  label: string;
  hint: string;
  ativo: boolean;
  destacarVazio: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-4 transition-all duration-200 ${
        destacarVazio ? "animate-pulse" : ""
      }`}
      style={{
        background: ativo
          ? "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)"
          : "#FAF6EB",
        border: ativo
          ? "0.5px solid rgba(168,137,71,0.6)"
          : destacarVazio
            ? "1.5px solid rgba(212,175,55,0.55)"
            : "0.5px solid rgba(168,137,71,0.25)",
        boxShadow: ativo
          ? "0 8px 22px -8px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.45)"
          : "none",
      }}
    >
      <Icone className="h-5 w-5" style={{ color: ativo ? "#1A1A1F" : "#A88947" }} strokeWidth={2} />
      <span
        className="text-[12px] font-extrabold uppercase"
        style={{ color: ativo ? "#1A1A1F" : "#3A3A3A", letterSpacing: "0.16em" }}
      >
        {label}
      </span>
      <span
        className="text-[10px] uppercase"
        style={{ color: ativo ? "rgba(26,26,31,0.7)" : "#6B6B6B", letterSpacing: "0.14em" }}
      >
        {hint}
      </span>
    </button>
  );
}
