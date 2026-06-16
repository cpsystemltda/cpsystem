"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Building2,
  UserCheck,
  Brain,
  FileCheck2,
  ArrowRight,
  DollarSign,
  Truck,
  Users,
} from "lucide-react";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

// Paleta clara (Regina 16/06): fundo creme/branco, dourado nas marcas e CTAs,
// cards grandes coloridos espelhando o estilo do dashboard interno
// (Mapa/Posicao/Vencimentos/Proximos). Sem seção institucional ou video.
const CARD_PALETTE = {
  dourado: {
    bg: "linear-gradient(135deg, #D4AF37 0%, #C5A24B 50%, #A88947 100%)",
    text: "#FFFFFF",
    textSoft: "rgba(255,255,255,0.85)",
  },
  verde: {
    bg: "linear-gradient(135deg, #4CAF6C 0%, #3FA85F 50%, #2F8F4C 100%)",
    text: "#FFFFFF",
    textSoft: "rgba(255,255,255,0.85)",
  },
  escuro: {
    bg: "linear-gradient(135deg, #2A2A33 0%, #1A1A1F 100%)",
    text: "#FFFFFF",
    textSoft: "rgba(255,255,255,0.78)",
  },
} as const;

type Cor = keyof typeof CARD_PALETTE;

const FEATURES: Array<{ icone: typeof DollarSign; titulo: string; descricao: string; cor: Cor }> = [
  {
    icone: DollarSign,
    titulo: "Controle financeiro",
    descricao: "Valores contratados, executados, a executar, recebidos e a receber.",
    cor: "dourado",
  },
  {
    icone: FileCheck2,
    titulo: "Controle de contratações",
    descricao: "Contratos, atas e empenhos vigentes, expirados, a expirar.",
    cor: "verde",
  },
  {
    icone: Truck,
    titulo: "Controle logístico",
    descricao: "Esteira de entrega/execução com agenda, controle de prazos e alertas.",
    cor: "escuro",
  },
  {
    icone: Users,
    titulo: "Controle de clientes",
    descricao: "Órgãos atendidos, locais de entrega/execução.",
    cor: "dourado",
  },
  {
    icone: Brain,
    titulo: "Inteligência jurídica nativa",
    descricao: "Alimentação de dados, cálculo de reajustes e tira-dúvidas.",
    cor: "verde",
  },
];

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);
  const [tipoEscolhido, setTipoEscolhido] = useState<"EMPRESA" | "ANALISTA" | null>(null);

  return (
    <div className="auth-shell relative min-h-screen">
      {/* Fundo claro com gradient sutil + textura geométrica de circunferências */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23C5A24B' stroke-width='0.5' opacity='0.06'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3C/g%3E%3C/svg%3E\"), linear-gradient(180deg, #FFFFFF 0%, #FAF6EB 60%, #F2E9CF 100%)",
          backgroundSize: "240px 240px, auto",
          backgroundRepeat: "repeat, no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      {/* ======================= HEADER ======================= */}
      <header className="relative z-[3] w-full">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-8 pt-7 pb-4">
          <div className="flex flex-col items-start">
            <Logo variant="md" mode="brand" priority />
          </div>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#por-que" className="text-[13px] font-semibold text-[#3A3A3A] transition hover:opacity-70">
              Por que
            </a>
            <a href="#sistema" className="text-[13px] font-semibold text-[#3A3A3A] transition hover:opacity-70">
              Sistema
            </a>
            <Link href="/precos" className="text-[13px] font-semibold text-[#3A3A3A] transition hover:opacity-70">
              Planos
            </Link>
            <a href="#faq" className="text-[13px] font-semibold text-[#3A3A3A] transition hover:opacity-70">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="#login"
              className="text-[13px] font-semibold text-[#3A3A3A] transition hover:opacity-70"
            >
              Entrar
            </a>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                color: "#1A1A1F",
                letterSpacing: "0.18em",
                boxShadow: "0 8px 22px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              Assinar
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-[2] mx-auto max-w-[1320px] px-8">
        {/* ======================= HERO ======================= */}
        <section className="pt-10 pb-16 text-center lg:pt-16 lg:pb-20">
          <span
            className="text-[12px] font-bold uppercase"
            style={{
              background: "linear-gradient(135deg, #A88947, #D4AF37)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.34em",
            }}
          >
            Plataforma Premium
          </span>
          <h1
            className="mx-auto mt-5 max-w-[1100px] text-[44px] font-extrabold leading-[1.05] tracking-tight text-[#1A1A1F] lg:text-[68px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            Gestão e controle de{" "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Contratos, Atas (SRP) e Empenhos
            </em>
          </h1>
          <p className="mx-auto mt-6 max-w-[680px] text-[16px] leading-relaxed text-[#5A5A5A] lg:text-[17px]">
            Assuma o controle total da sua execução pública: elimine gargalos operacionais e proteja
            o lucro de cada Contrato, Ata e Empenho.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[13px] font-bold uppercase transition hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                color: "#1A1A1F",
                letterSpacing: "0.22em",
                boxShadow: "0 14px 36px -8px rgba(168,137,71,0.55), inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              Solicite demonstração
              <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
            </Link>
            <Link
              href="/precos"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-[13px] font-bold uppercase text-[#1A1A1F] transition hover:scale-[1.02]"
              style={{
                border: "0.5px solid rgba(168,137,71,0.35)",
                letterSpacing: "0.22em",
                boxShadow: "0 8px 22px -8px rgba(20,16,8,0.12)",
              }}
            >
              Ver planos
            </Link>
          </div>
        </section>

        {/* ======================= FEATURES (5 cards grandes coloridos) ======================= */}
        <section id="sistema" className="pb-16">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.titulo} feature={f} />
            ))}
          </div>
        </section>

        {/* ======================= LOGIN ======================= */}
        <section id="login" className="pb-16">
          <div className="text-center">
            <span
              className="text-[11px] font-bold uppercase"
              style={{ color: "#A88947", letterSpacing: "0.32em" }}
            >
              Acessar plataforma
            </span>
            <h2
              className="mx-auto mt-3 max-w-[600px] text-[26px] font-extrabold leading-tight text-[#1A1A1F] lg:text-[32px]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Já é cliente? Entre na sua{" "}
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
            </h2>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-[520px]">
              <div
                className="overflow-hidden rounded-[24px] bg-white px-9 py-9"
                style={{
                  border: "0.5px solid rgba(168,137,71,0.25)",
                  boxShadow: "0 24px 60px -20px rgba(20,16,8,0.18), 0 6px 20px -10px rgba(20,16,8,0.08)",
                }}
              >
                <div
                  className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase"
                  style={{ letterSpacing: "0.22em" }}
                >
                  <span style={{ color: tipoEscolhido === null ? "#C66770" : "#9A9A9A" }}>
                    Você é:
                  </span>
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
                        contratos &middot; <strong className="text-[#3A3A3A]">Analista</strong>{" "}
                        indica clientes e ganha comissão.
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
          </div>
        </section>
      </main>

      <footer
        className="relative z-[1] border-t pb-9 pt-7"
        style={{ borderColor: "rgba(168,137,71,0.18)" }}
      >
        <div
          className="mx-auto flex max-w-[1320px] flex-col items-center gap-3 px-8 text-[11px] uppercase sm:flex-row sm:justify-between"
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

// ===========================================================
// CARD GRANDE colorido (estilo dashboard interno)
// ===========================================================
function FeatureCard({
  feature,
}: {
  feature: { icone: typeof DollarSign; titulo: string; descricao: string; cor: Cor };
}) {
  const { icone: Icone, titulo, descricao, cor } = feature;
  const palette = CARD_PALETTE[cor];
  return (
    <div
      className="group relative overflow-hidden rounded-[20px] px-7 py-8 transition-transform hover:scale-[1.015]"
      style={{
        background: palette.bg,
        boxShadow: "0 18px 40px -12px rgba(20,16,8,0.22), 0 4px 12px -6px rgba(20,16,8,0.10)",
        minHeight: "220px",
      }}
    >
      {/* ícone gigante decorativo no canto */}
      <Icone
        aria-hidden
        className="pointer-events-none absolute -bottom-4 -right-4 h-[140px] w-[140px] opacity-15"
        style={{ color: palette.text }}
        strokeWidth={1.6}
      />
      <Icone
        className="relative z-[1] h-7 w-7"
        style={{ color: palette.text }}
        strokeWidth={2}
      />
      <h3
        className="relative z-[1] mt-6 text-[22px] font-extrabold leading-tight lg:text-[24px]"
        style={{ color: palette.text, letterSpacing: "-0.02em" }}
      >
        {titulo}
      </h3>
      <p
        className="relative z-[1] mt-3 text-[14px] leading-relaxed lg:text-[14.5px]"
        style={{ color: palette.textSoft }}
      >
        {descricao}
      </p>
    </div>
  );
}

// ===========================================================
// TAB Empresa/Analista (paleta clara)
// ===========================================================
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
      <Icone
        className="h-5 w-5"
        style={{ color: ativo ? "#1A1A1F" : "#A88947" }}
        strokeWidth={2}
      />
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
