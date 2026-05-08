"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Building2, UserCheck } from "lucide-react";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);
  const [tipoEscolhido, setTipoEscolhido] = useState<"EMPRESA" | "ANALISTA">("EMPRESA");

  return (
    <div className="auth-shell relative min-h-screen overflow-hidden">
      {/* Background atmosférico (mesma estética do app interno) */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='0.4' opacity='0.10'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3Ccircle cx='120' cy='40' r='40'/%3E%3Ccircle cx='120' cy='200' r='40'/%3E%3Ccircle cx='50.72' cy='80' r='40'/%3E%3Ccircle cx='50.72' cy='160' r='40'/%3E%3Ccircle cx='189.28' cy='80' r='40'/%3E%3Ccircle cx='189.28' cy='160' r='40'/%3E%3C/g%3E%3C/svg%3E\"), radial-gradient(ellipse 1400px 900px at 18% 12%, rgba(212, 175, 55, 0.18), transparent 55%), radial-gradient(ellipse 1100px 800px at 82% 28%, rgba(232, 138, 152, 0.12), transparent 55%), radial-gradient(ellipse 1100px 800px at 28% 78%, rgba(197, 180, 255, 0.12), transparent 55%), radial-gradient(ellipse 950px 750px at 78% 92%, rgba(168, 137, 71, 0.16), transparent 55%), linear-gradient(135deg, #08070C 0%, #0F0D14 35%, #14110D 75%, #0A0908 100%)",
          backgroundSize: "240px 240px, auto, auto, auto, auto, auto",
          backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      {/* Conteúdo — desktop 2 colunas (brand statement + card), mobile stack */}
      <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-[1200px] flex-col items-center justify-center gap-12 px-6 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-10">
        {/* Coluna esquerda — brand statement (desktop) */}
        <aside className="hidden flex-col text-center lg:flex lg:flex-1 lg:max-w-[480px] lg:text-left">
          <div
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 500,
              fontSize: "120px",
              lineHeight: 0.92,
              letterSpacing: "-0.07em",
              background: "linear-gradient(180deg, #FFF 0%, var(--primary-bright) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CP
          </div>
          <div
            className="mt-3"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.5em",
              color: "var(--primary)",
              textTransform: "uppercase",
            }}
          >
            CP&nbsp;System
          </div>

          <p
            className="mt-12 max-w-[400px] text-[18px] leading-relaxed"
            style={{ color: "var(--text-soft)", letterSpacing: "-0.005em", fontWeight: 400 }}
          >
            Plataforma{" "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
              }}
            >
              premium
            </em>{" "}
            de gestão de contratos para empresas que vendem ao governo.
          </p>

          <div
            className="mt-10 h-px max-w-[120px]"
            style={{ background: "linear-gradient(90deg, var(--primary), transparent)" }}
          />

          <p
            className="mt-5 text-[11px] font-bold uppercase"
            style={{ color: "var(--primary)", letterSpacing: "0.4em", opacity: 0.8 }}
          >
            Contratos Públicos
          </p>
        </aside>

        {/* Coluna direita — card de login (mantém o que foi aprovado) */}
        <div
          className="glass w-full max-w-[460px] overflow-hidden rounded-[28px] px-9 py-10 lg:flex-shrink-0"
          style={{ color: "var(--text-soft)" }}
        >
          <div className="relative z-[1]">
            {/* Logo — só no mobile (no desktop fica na coluna esquerda) */}
            <div className="text-center lg:hidden">
              <div
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontWeight: 500,
                  fontSize: "44px",
                  lineHeight: 1,
                  letterSpacing: "-0.06em",
                  background: "linear-gradient(180deg, #FFF 0%, var(--primary-bright) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                CP
              </div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.5em",
                  color: "var(--primary)",
                  marginTop: "6px",
                  textTransform: "uppercase",
                }}
              >
                CP&nbsp;System
              </div>
              <div
                className="mx-auto mt-5 h-px max-w-[120px]"
                style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
              />
            </div>

            {/* Título */}
            <h1
              className="mt-6 text-center text-[28px] font-extrabold leading-tight lg:mt-0 lg:text-left lg:text-[32px]"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              Entrar na sua{" "}
              <em
                style={{
                  fontStyle: "normal",
                  background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                conta
              </em>
            </h1>
            <p
              className="mt-2 text-center text-[13px] lg:text-left"
              style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
            >
              Acesse o painel de gestão dos seus contratos.
            </p>

            {/* Toggle Empresa / Analista */}
            <div className="mt-7 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTipoEscolhido("EMPRESA")}
                className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 transition"
                style={
                  tipoEscolhido === "EMPRESA"
                    ? {
                        background:
                          "linear-gradient(135deg, rgba(212,175,55,0.22), rgba(212,175,55,0.06)), rgba(255,255,255,0.03)",
                        border: "0.5px solid rgba(212,175,55,0.45)",
                        boxShadow: "0 0 24px rgba(212,175,55,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
                        color: "var(--text)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        border: "0.5px solid var(--hairline)",
                        color: "var(--text-mute)",
                      }
                }
              >
                <Building2
                  className="h-[18px] w-[18px] shrink-0"
                  style={{
                    color:
                      tipoEscolhido === "EMPRESA" ? "var(--primary-bright)" : "var(--text-mute)",
                    strokeWidth: 1.7,
                  }}
                />
                <span className="text-[13px] font-bold">Empresa</span>
              </button>
              <button
                type="button"
                onClick={() => setTipoEscolhido("ANALISTA")}
                className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 transition"
                style={
                  tipoEscolhido === "ANALISTA"
                    ? {
                        background:
                          "linear-gradient(135deg, rgba(212,175,55,0.22), rgba(212,175,55,0.06)), rgba(255,255,255,0.03)",
                        border: "0.5px solid rgba(212,175,55,0.45)",
                        boxShadow: "0 0 24px rgba(212,175,55,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
                        color: "var(--text)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        border: "0.5px solid var(--hairline)",
                        color: "var(--text-mute)",
                      }
                }
              >
                <UserCheck
                  className="h-[18px] w-[18px] shrink-0"
                  style={{
                    color:
                      tipoEscolhido === "ANALISTA" ? "var(--primary-bright)" : "var(--text-mute)",
                    strokeWidth: 1.7,
                  }}
                />
                <span className="text-[13px] font-bold">Analista</span>
              </button>
            </div>

            {/* Form */}
            <form action={formAction} className="mt-6 grid grid-cols-1 gap-5">
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
                    background: "rgba(232,138,152,0.10)",
                    border: "0.5px solid rgba(232,138,152,0.3)",
                    color: "var(--coral)",
                  }}
                >
                  {state.erro}
                </div>
              )}

              <div className="mt-2">
                <SubmitButton>Entrar</SubmitButton>
              </div>
            </form>

            <p
              className="mt-6 text-center text-[13px]"
              style={{ color: "var(--text-mute)" }}
            >
              Não tem conta?{" "}
              <Link
                href={`/signup?tipo=${tipoEscolhido}`}
                className="font-bold transition"
                style={{ color: "var(--primary-bright)" }}
              >
                Criar conta {tipoEscolhido === "EMPRESA" ? "de empresa" : "de analista"}
              </Link>
            </p>

            {/* Footer */}
            <div
              className="mt-8 flex items-center justify-center gap-3 text-[10px] uppercase"
              style={{
                letterSpacing: "0.3em",
                color: "var(--text-faint)",
              }}
            >
              <span className="h-px w-8" style={{ background: "var(--hairline)" }} />
              <span>LGPD · Auditável · BR</span>
              <span className="h-px w-8" style={{ background: "var(--hairline)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Inputs e botões precisam herdar paleta dark mesmo fora de .app-shell */}
      <style jsx>{`
        .auth-shell :global(input[type="email"]),
        .auth-shell :global(input[type="password"]),
        .auth-shell :global(input[type="text"]) {
          background: rgba(255, 255, 255, 0.95);
          color: #1d1d1f;
          border: 0.5px solid rgba(0, 0, 0, 0.12);
        }
        .auth-shell :global(input::placeholder) {
          color: #8e8e93;
        }
        .auth-shell :global(input:focus) {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-glow);
        }
      `}</style>
    </div>
  );
}
