"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Building2,
  UserCheck,
  Play,
  ShieldCheck,
  BellRing,
  Brain,
  FileCheck2,
} from "lucide-react";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);
  const [tipoEscolhido, setTipoEscolhido] = useState<"EMPRESA" | "ANALISTA">("EMPRESA");
  const [videoAberto, setVideoAberto] = useState(false);

  return (
    <div className="auth-shell relative min-h-screen overflow-hidden">
      {/* Background atmosférico — mesma família do app interno (creme/dourado/glass) */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='0.6' opacity='0.12'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3Ccircle cx='120' cy='40' r='40'/%3E%3Ccircle cx='120' cy='200' r='40'/%3E%3Ccircle cx='50.72' cy='80' r='40'/%3E%3Ccircle cx='50.72' cy='160' r='40'/%3E%3Ccircle cx='189.28' cy='80' r='40'/%3E%3Ccircle cx='189.28' cy='160' r='40'/%3E%3C/g%3E%3C/svg%3E\"), radial-gradient(ellipse 1400px 900px at 18% 12%, rgba(212, 175, 55, 0.20), transparent 55%), radial-gradient(ellipse 1100px 800px at 82% 28%, rgba(232, 138, 152, 0.14), transparent 55%), radial-gradient(ellipse 1100px 800px at 28% 78%, rgba(197, 180, 255, 0.14), transparent 55%), radial-gradient(ellipse 950px 750px at 78% 92%, rgba(168, 137, 71, 0.16), transparent 55%), linear-gradient(135deg, #FAF7F0 0%, #FFFEF9 50%, #F5EFDD 100%)",
          backgroundSize: "240px 240px, auto, auto, auto, auto, auto",
          backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      {/* Conteúdo */}
      <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-[1280px] flex-col items-center justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-14 lg:px-10">
        {/* Coluna esquerda — brand + vídeo + features */}
        <section className="flex w-full flex-col items-center text-center lg:flex-1 lg:max-w-[600px] lg:items-start lg:text-left">
          {/* Logo */}
          <Logo variant="xl" mode="brand" priority />

          {/* Brand statement curto */}
          <p
            className="mt-7 max-w-[520px] text-[18px] leading-relaxed lg:text-[20px]"
            style={{ color: "var(--text-soft)", letterSpacing: "-0.005em", fontWeight: 400 }}
          >
            Plataforma{" "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
              }}
            >
              premium
            </em>{" "}
            de gestão pós-licitação para empresas que vendem ao governo — Lei 14.133, fiscalização auditável e IA jurídica embutida.
          </p>

          {/* PLAYER DE VÍDEO TUTORIAL — glass card com aspect 16:9 */}
          <div className="mt-9 w-full max-w-[560px]">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--primary)" }}
              />
              <span
                className="text-[11px] font-bold uppercase"
                style={{ color: "var(--primary-deep)", letterSpacing: "0.32em" }}
              >
                Conheça em 2 minutos
              </span>
            </div>
            <VideoPlayerTutorial aberto={videoAberto} onAbrir={() => setVideoAberto(true)} />
          </div>

          {/* Features inline — 4 mini-cards glass */}
          <div className="mt-8 grid w-full max-w-[560px] grid-cols-2 gap-2.5 sm:grid-cols-4">
            <FeatureMini icon={ShieldCheck} titulo="LGPD" sub="Auditável" />
            <FeatureMini icon={BellRing} titulo="Prazos" sub="Alerta antes" />
            <FeatureMini icon={Brain} titulo="IA jurídica" sub="14.133 nativo" />
            <FeatureMini icon={FileCheck2} titulo="Trilha" sub="Histórico total" />
          </div>
        </section>

        {/* Coluna direita — card de login glass (mantém funcional) */}
        <aside
          className="glass w-full max-w-[460px] overflow-hidden rounded-[28px] px-9 py-10 lg:flex-shrink-0"
          style={{ color: "var(--text-soft)" }}
        >
          <div className="relative z-[1]">
            {/* Logo só no mobile */}
            <div className="flex justify-center lg:hidden">
              <Logo variant="md" mode="brand" priority />
            </div>

            {/* Título */}
            <h1
              className="mt-6 text-center text-[28px] font-extrabold leading-tight lg:mt-0 lg:text-[32px]"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              Entrar na sua{" "}
              <em
                style={{
                  fontStyle: "normal",
                  background: "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                conta
              </em>
            </h1>
            <p
              className="mt-2 text-center text-[13px]"
              style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
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
                          "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(212,175,55,0.10)), rgba(255,255,255,0.5)",
                        border: "0.5px solid rgba(168,137,71,0.5)",
                        boxShadow:
                          "0 0 18px rgba(212,175,55,0.20), inset 0 1px 0 rgba(255,255,255,0.6)",
                        color: "var(--text)",
                      }
                    : {
                        background: "rgba(255,255,255,0.55)",
                        border: "0.5px solid var(--hairline)",
                        color: "var(--text-soft)",
                      }
                }
              >
                <Building2
                  className="h-[18px] w-[18px] shrink-0"
                  style={{
                    color:
                      tipoEscolhido === "EMPRESA" ? "var(--primary-deep)" : "var(--text-mute)",
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
                          "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(212,175,55,0.10)), rgba(255,255,255,0.5)",
                        border: "0.5px solid rgba(168,137,71,0.5)",
                        boxShadow:
                          "0 0 18px rgba(212,175,55,0.20), inset 0 1px 0 rgba(255,255,255,0.6)",
                        color: "var(--text)",
                      }
                    : {
                        background: "rgba(255,255,255,0.55)",
                        border: "0.5px solid var(--hairline)",
                        color: "var(--text-soft)",
                      }
                }
              >
                <UserCheck
                  className="h-[18px] w-[18px] shrink-0"
                  style={{
                    color:
                      tipoEscolhido === "ANALISTA" ? "var(--primary-deep)" : "var(--text-mute)",
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
                    background: "rgba(232,138,152,0.14)",
                    border: "0.5px solid rgba(198,103,112,0.5)",
                    color: "var(--coral-deep)",
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
                style={{ color: "var(--primary-deep)" }}
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
        </aside>
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

// -----------------------------------------------------------
// Player de vídeo tutorial — placeholder elegante até a Regina
// gravar o MP4 oficial. Quando o arquivo existir, basta trocar
// o conteúdo do bloco `aberto` por uma tag <video> apontando pra
// /videos/tutorial-login.mp4 (ou iframe do YouTube).
// -----------------------------------------------------------
function VideoPlayerTutorial({
  aberto,
  onAbrir,
}: {
  aberto: boolean;
  onAbrir: () => void;
}) {
  return (
    <div
      className="glass-tile relative overflow-hidden rounded-[24px]"
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* Fundo decorativo — gradiente dourado + pattern sutil mesmo do auth-shell */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 480px 320px at 30% 35%, rgba(212,175,55,0.22), transparent 60%), radial-gradient(ellipse 380px 260px at 75% 70%, rgba(197,180,255,0.18), transparent 60%), linear-gradient(135deg, rgba(255,254,249,0.7), rgba(245,239,221,0.85))",
        }}
      />

      {/* Mock do dashboard atrás do play — só pra dar densidade visual */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center opacity-40"
      >
        <svg width="80%" height="60%" viewBox="0 0 400 200" fill="none">
          <rect x="0" y="0" width="120" height="80" rx="10" fill="rgba(212,175,55,0.18)" />
          <rect x="140" y="0" width="120" height="80" rx="10" fill="rgba(94,168,159,0.18)" />
          <rect x="280" y="0" width="120" height="80" rx="10" fill="rgba(197,180,255,0.20)" />
          <rect x="0" y="100" width="400" height="100" rx="12" fill="rgba(255,255,255,0.5)" />
          <path
            d="M10 180 Q 60 130 100 150 T 200 140 T 300 110 T 390 130"
            stroke="rgba(168,137,71,0.55)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Estado fechado: botão de play + label */}
      {!aberto && (
        <button
          type="button"
          onClick={onAbrir}
          className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-4 transition hover:scale-[1.01]"
          aria-label="Assistir vídeo tutorial"
        >
          {/* Anel dourado pulsante atrás do play */}
          <span
            aria-hidden
            className="absolute h-[110px] w-[110px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(212,175,55,0.32) 0%, rgba(212,175,55,0) 70%)",
            }}
          />
          <span
            className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full"
            style={{
              background:
                "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
              boxShadow:
                "0 12px 32px -6px rgba(168,137,71,0.55), inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            <Play
              className="h-9 w-9 translate-x-[2px]"
              style={{ color: "#FFFEF9", fill: "#FFFEF9" }}
              strokeWidth={2.2}
            />
          </span>
          <span
            className="relative text-[14px] font-bold"
            style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
          >
            Tour guiado pelo sistema
          </span>
          <span
            className="relative text-[11px] uppercase"
            style={{ color: "var(--text-mute)", letterSpacing: "0.24em" }}
          >
            Vídeo de 2 min · sem cadastro
          </span>
        </button>
      )}

      {/* Estado aberto: placeholder do player. Substituir por <video> ou iframe quando o MP4 estiver pronto. */}
      {aberto && (
        <div
          className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-3"
          style={{ background: "rgba(15,14,12,0.92)" }}
        >
          <span
            className="text-[12px] font-bold uppercase"
            style={{ color: "var(--primary)", letterSpacing: "0.28em" }}
          >
            Em produção
          </span>
          <span
            className="max-w-[320px] text-center text-[13px]"
            style={{ color: "rgba(255,254,249,0.78)" }}
          >
            O vídeo tutorial está sendo finalizado. Assim que ficar pronto, ele toca direto aqui.
          </span>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------
// Mini-card de feature (4 abaixo do player)
// -----------------------------------------------------------
function FeatureMini({
  icon: Icone,
  titulo,
  sub,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  titulo: string;
  sub: string;
}) {
  return (
    <div
      className="glass-tile rounded-[14px] px-3 py-3"
      style={{ color: "var(--text)" }}
    >
      <div className="flex items-center gap-2">
        <Icone
          className="h-[18px] w-[18px] shrink-0"
          style={{ color: "var(--primary-deep)" }}
          strokeWidth={1.8}
        />
        <span className="text-[12px] font-bold leading-tight" style={{ letterSpacing: "-0.01em" }}>
          {titulo}
        </span>
      </div>
      <p
        className="mt-1 text-[10.5px] leading-tight"
        style={{ color: "var(--text-mute)" }}
      >
        {sub}
      </p>
    </div>
  );
}
