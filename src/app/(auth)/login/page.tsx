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
  ArrowRight,
} from "lucide-react";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);
  const [tipoEscolhido, setTipoEscolhido] = useState<"EMPRESA" | "ANALISTA" | null>(null);
  const [videoAberto, setVideoAberto] = useState(false);

  return (
    <div className="auth-shell relative min-h-screen overflow-hidden">
      {/* Background atmosférico — mesma família do app interno */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='0.6' opacity='0.10'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3Ccircle cx='120' cy='40' r='40'/%3E%3Ccircle cx='120' cy='200' r='40'/%3E%3Ccircle cx='50.72' cy='80' r='40'/%3E%3Ccircle cx='50.72' cy='160' r='40'/%3E%3Ccircle cx='189.28' cy='80' r='40'/%3E%3Ccircle cx='189.28' cy='160' r='40'/%3E%3C/g%3E%3C/svg%3E\"), radial-gradient(ellipse 1400px 900px at 18% 12%, rgba(212, 175, 55, 0.18), transparent 55%), radial-gradient(ellipse 1100px 800px at 82% 28%, rgba(232, 138, 152, 0.12), transparent 55%), radial-gradient(ellipse 1100px 800px at 28% 78%, rgba(197, 180, 255, 0.12), transparent 55%), radial-gradient(ellipse 950px 750px at 78% 92%, rgba(168, 137, 71, 0.14), transparent 55%), linear-gradient(135deg, #FAF7F0 0%, #FFFEF9 50%, #F5EFDD 100%)",
          backgroundSize: "240px 240px, auto, auto, auto, auto, auto",
          backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      {/* ======================= HEADER ======================= */}
      <header className="relative z-[2] w-full">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-8 py-6">
          <Logo variant="md" mode="brand" priority />
          <nav className="hidden items-center gap-7 md:flex">
            <Link
              href="/"
              className="text-[13px] font-semibold transition hover:opacity-80"
              style={{ color: "var(--text-soft)" }}
            >
              O sistema
            </Link>
            <Link
              href="/precos"
              className="text-[13px] font-semibold transition hover:opacity-80"
              style={{ color: "var(--text-soft)" }}
            >
              Planos
            </Link>
            <Link
              href="/seja-embaixador"
              className="text-[13px] font-semibold transition hover:opacity-80"
              style={{ color: "var(--text-soft)" }}
            >
              Embaixadores
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                color: "#0A0A0A",
                letterSpacing: "0.18em",
                boxShadow:
                  "0 8px 22px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      {/* ======================= HERO INSTITUCIONAL ======================= */}
      <main className="relative z-[1] mx-auto w-full max-w-[1320px] px-8 pb-14 pt-6 lg:pt-10">
        {/* Eyebrow centralizado */}
        <div className="mb-10 text-center">
          <span
            className="text-[11px] font-bold uppercase"
            style={{ color: "var(--primary-deep)", letterSpacing: "0.34em" }}
          >
            Plataforma premium
          </span>
          <h1
            className="mx-auto mt-4 max-w-[820px] text-[34px] font-extrabold leading-[1.05] lg:text-[44px]"
            style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
          >
            Entenda como o{" "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              CP System
            </em>{" "}
            ajuda na gestão dos seus contratos
          </h1>
          <p
            className="mx-auto mt-5 max-w-[700px] text-[16px] leading-relaxed lg:text-[17px]"
            style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
          >
            Atas, contratos, empenhos, reajustes e fiscalização num só lugar. IA jurídica nativa que se adapta a qualquer legislação — federal, estadual ou municipal.
          </p>
        </div>

        {/* Grid principal — texto + login à esquerda · vídeo à direita */}
        <div className="grid items-stretch gap-10 lg:grid-cols-2 lg:gap-12">

          {/* ====== Coluna 1 — TEXTO + LOGIN ====== */}
          <section className="flex flex-col">
            {/* Bloco institucional */}
            <div>
              <span
                className="text-[11px] font-bold uppercase"
                style={{ color: "var(--primary-deep)", letterSpacing: "0.3em" }}
              >
                O sistema
              </span>
              <h2
                className="mt-3 text-[24px] font-extrabold leading-tight lg:text-[28px]"
                style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
              >
                Conecta de forma inteligente toda a execução contratual
              </h2>
              <p
                className="mt-3 text-[14.5px] leading-relaxed"
                style={{ color: "var(--text-soft)" }}
              >
                Disponibiliza informações fundamentais e melhora as condições operacionais da gestão e da fiscalização. Permite gerir diversos contratos, das mais diferentes complexidades, com a periodicidade pretendida — organizando atribuições dos envolvidos e registrando cada ato praticado em trilha auditável.
              </p>
              <Link
                href="/precos"
                className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "0.5px solid var(--hairline)",
                  color: "var(--text)",
                  letterSpacing: "0.2em",
                }}
              >
                Mais sobre o sistema
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              </Link>
            </div>

            {/* ====== CARD DE LOGIN ====== */}
            <div
              className="glass mt-9 overflow-hidden rounded-[24px] px-8 py-8"
              style={{ color: "var(--text-soft)" }}
            >
              <div className="relative z-[1]">
                <div className="flex items-end justify-between">
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color: "var(--primary-deep)", letterSpacing: "0.32em" }}
                    >
                      Acessar plataforma
                    </span>
                    <h3
                      className="mt-2 text-[24px] font-extrabold leading-tight"
                      style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
                    >
                      Entrar na sua conta
                    </h3>
                  </div>
                  {tipoEscolhido !== null && (
                    <button
                      type="button"
                      onClick={() => setTipoEscolhido(null)}
                      className="text-[10px] font-bold uppercase transition hover:opacity-80"
                      style={{ color: "var(--text-mute)", letterSpacing: "0.18em" }}
                    >
                      Trocar
                    </button>
                  )}
                </div>

                {/* Tabs Empresa/Analista */}
                <p
                  className="mt-5 text-[11px] font-bold uppercase"
                  style={{
                    color:
                      tipoEscolhido === null ? "var(--coral-deep)" : "var(--text-mute)",
                    letterSpacing: "0.22em",
                  }}
                >
                  Você é:
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
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

                {/* Form ou aviso — mesma posição visual */}
                <div className="mt-6">
                  {tipoEscolhido === null ? (
                    <div
                      className="rounded-2xl px-5 py-5 text-center"
                      style={{
                        background: "rgba(255,255,255,0.4)",
                        border: "1px dashed var(--hairline)",
                      }}
                    >
                      <p
                        className="text-[13px] font-semibold"
                        style={{ color: "var(--text-soft)" }}
                      >
                        Escolha acima o tipo de conta pra continuar.
                      </p>
                      <p
                        className="mt-2 text-[11.5px] leading-relaxed"
                        style={{ color: "var(--text-mute)" }}
                      >
                        <strong style={{ color: "var(--text-soft)" }}>Empresa</strong> usa o sistema pra gerir contratos · <strong style={{ color: "var(--text-soft)" }}>Analista</strong> indica clientes e ganha comissão.
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
                            color: "var(--coral-deep)",
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

                {/* Footer do card */}
                <div className="mt-7">
                  <p
                    className="text-center text-[13px]"
                    style={{ color: "var(--text-mute)" }}
                  >
                    Não tem conta?{" "}
                    <Link
                      href={`/signup${tipoEscolhido ? `?tipo=${tipoEscolhido}` : ""}`}
                      className="font-bold transition hover:opacity-80"
                      style={{ color: "var(--primary-deep)" }}
                    >
                      Criar conta {tipoEscolhido === "EMPRESA" ? "de empresa" : tipoEscolhido === "ANALISTA" ? "de analista" : "agora"}
                    </Link>
                  </p>
                  <div
                    className="mt-5 flex items-center justify-center gap-3 text-[10px] uppercase"
                    style={{ letterSpacing: "0.3em", color: "var(--text-faint)" }}
                  >
                    <span className="h-px w-8" style={{ background: "var(--hairline)" }} />
                    <span>Conexão segura · LGPD</span>
                    <span className="h-px w-8" style={{ background: "var(--hairline)" }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ====== Coluna 2 — VÍDEO ====== */}
          <section className="flex h-full">
            <VideoPlayerInstitucional
              aberto={videoAberto}
              onAbrir={() => setVideoAberto(true)}
            />
          </section>
        </div>

        {/* ============ FEATURES — 4 cards estilo Tela 1 da referência ============ */}
        <section className="mt-16">
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
            <FeatureCard
              icon={BellRing}
              titulo="Controle de prazos"
              descricao="Alerta antes de cada vencimento: entrega, NF, pagamento, reajuste, fim de vigência."
            />
            <FeatureCard
              icon={FileCheck2}
              titulo="Controle financeiro"
              descricao="Pago, a receber e saldos por vigência em tempo real."
            />
            <FeatureCard
              icon={ShieldCheck}
              titulo="Fiscalização completa"
              descricao="Garantias, aditivos, apostilamentos e procedimentos com trilha auditável."
            />
            <FeatureCard
              icon={Brain}
              titulo="IA jurídica nativa"
              descricao="Lê PDFs, calcula reajustes, responde dúvidas em qualquer legislação."
            />
          </div>
        </section>
      </main>

      {/* ======================= FOOTER ======================= */}
      <footer
        className="relative z-[1] border-t pb-9 pt-7"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div
          className="mx-auto flex max-w-[1320px] flex-col items-center gap-3 px-8 text-[11px] uppercase sm:flex-row sm:justify-between"
          style={{ letterSpacing: "0.24em", color: "var(--text-faint)" }}
        >
          <span>CP System · Plataforma Premium</span>
          <span>LGPD · Trilha auditável · Conexão segura</span>
        </div>
      </footer>

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

// ===========================================================
// TAB Empresa/Analista
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
      } hover:scale-[1.02]`}
      style={
        ativo
          ? {
              background:
                "linear-gradient(135deg, rgba(212,175,55,0.34) 0%, rgba(212,175,55,0.10) 100%), rgba(255,255,255,0.55)",
              border: "1.5px solid rgba(168,137,71,0.7)",
              boxShadow:
                "0 0 24px rgba(212,175,55,0.30), inset 0 1px 0 rgba(255,255,255,0.65)",
              color: "var(--text)",
            }
          : {
              background: "rgba(255,255,255,0.65)",
              border: "1.5px solid var(--hairline)",
              color: "var(--text-soft)",
            }
      }
    >
      <Icone
        className="h-7 w-7 shrink-0"
        style={{
          color: ativo ? "var(--primary-deep)" : "var(--text-mute)",
          strokeWidth: 1.6,
        }}
      />
      <span className="text-[14px] font-extrabold leading-none">{label}</span>
      <span
        className="text-[10px] uppercase leading-tight"
        style={{
          color: ativo ? "var(--primary-deep)" : "var(--text-faint)",
          letterSpacing: "0.16em",
        }}
      >
        {hint}
      </span>
    </button>
  );
}

// ===========================================================
// VÍDEO INSTITUCIONAL — moldura em L (espelho da Tela 2 da referência)
// Container ocupa toda a altura da coluna (h-full), mantendo aspect 16:9
// dentro de um wrapper que respira nas bordas da moldura.
// ===========================================================
function VideoPlayerInstitucional({
  aberto,
  onAbrir,
}: {
  aberto: boolean;
  onAbrir: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-[420px] w-full items-center">
      {/* Moldura em L externa — cantos decorativos teal/dourado */}
      <span aria-hidden className="absolute left-0 top-2 h-20 w-20 rounded-tl-3xl"
        style={{ borderTop: "2px solid var(--primary)", borderLeft: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute right-0 top-2 h-20 w-20 rounded-tr-3xl"
        style={{ borderTop: "2px solid var(--primary)", borderRight: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute bottom-2 left-0 h-20 w-20 rounded-bl-3xl"
        style={{ borderBottom: "2px solid var(--primary)", borderLeft: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute bottom-2 right-0 h-20 w-20 rounded-br-3xl"
        style={{ borderBottom: "2px solid var(--primary)", borderRight: "2px solid var(--primary)" }} />

      {/* Player com aspect 16:9, recuado pra dentro da moldura */}
      <div className="relative mx-6 my-8 w-full">
        <div
          className="glass relative w-full overflow-hidden rounded-[20px]"
          style={{ aspectRatio: "16 / 9" }}
        >
          {/* Background do mock */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 520px 360px at 28% 32%, rgba(212,175,55,0.22), transparent 60%), radial-gradient(ellipse 420px 280px at 78% 72%, rgba(197,180,255,0.18), transparent 60%), linear-gradient(135deg, rgba(255,254,249,0.82), rgba(245,239,221,0.95))",
            }}
          />
          <div aria-hidden className="absolute inset-0 flex items-center justify-center opacity-45">
            <svg width="86%" height="64%" viewBox="0 0 400 220" fill="none">
              <rect x="0" y="0" width="120" height="80" rx="10" fill="rgba(212,175,55,0.24)" />
              <rect x="140" y="0" width="120" height="80" rx="10" fill="rgba(94,168,159,0.22)" />
              <rect x="280" y="0" width="120" height="80" rx="10" fill="rgba(197,180,255,0.26)" />
              <rect x="0" y="100" width="260" height="120" rx="12" fill="rgba(255,255,255,0.7)" />
              <rect x="280" y="100" width="120" height="120" rx="12" fill="rgba(212,175,55,0.2)" />
              <path d="M14 200 Q 60 150 100 170 T 180 160 T 250 130" stroke="rgba(168,137,71,0.7)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          {!aberto && (
            <button
              type="button"
              onClick={onAbrir}
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-4 transition-transform hover:scale-[1.01]"
              aria-label="Assistir vídeo institucional"
            >
              <span
                aria-hidden
                className="absolute h-[160px] w-[160px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(212,175,55,0.42) 0%, rgba(212,175,55,0) 70%)" }}
              />
              <span
                className="relative flex h-[96px] w-[96px] items-center justify-center rounded-full"
                style={{
                  background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                  boxShadow: "0 16px 38px -6px rgba(168,137,71,0.6), inset 0 1px 0 rgba(255,255,255,0.55)",
                }}
              >
                <Play
                  className="h-12 w-12 translate-x-[3px]"
                  style={{ color: "#FFFEF9", fill: "#FFFEF9" }}
                  strokeWidth={2.2}
                />
              </span>
              <span
                className="relative text-[11px] font-bold uppercase"
                style={{ color: "var(--primary-deep)", letterSpacing: "0.32em" }}
              >
                Tour guiado · 2:22 min
              </span>
            </button>
          )}

          {aberto && (
            <div
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(15,14,12,0.94)" }}
            >
              <span
                className="text-[11px] font-bold uppercase"
                style={{ color: "var(--primary)", letterSpacing: "0.3em" }}
              >
                Em produção
              </span>
              <span
                className="max-w-[360px] text-center text-[13px]"
                style={{ color: "rgba(255,254,249,0.78)" }}
              >
                O vídeo institucional está sendo finalizado. Assim que estiver pronto, ele toca direto aqui.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// CARD DE FEATURE
// ===========================================================
function FeatureCard({
  icon: Icone,
  titulo,
  descricao,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  titulo: string;
  descricao: string;
}) {
  return (
    <div
      className="glass-tile flex flex-col rounded-[18px] px-5 py-5 transition-transform hover:translate-y-[-2px]"
      style={{ color: "var(--text)" }}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.30), rgba(212,175,55,0.08))",
          border: "0.5px solid rgba(168,137,71,0.32)",
        }}
      >
        <Icone className="h-5 w-5" style={{ color: "var(--primary-deep)" }} strokeWidth={1.7} />
      </span>
      <h4
        className="mt-3.5 text-[14px] font-bold leading-tight"
        style={{ letterSpacing: "-0.015em" }}
      >
        {titulo}
      </h4>
      <p
        className="mt-1.5 text-[12px] leading-relaxed"
        style={{ color: "var(--text-soft)" }}
      >
        {descricao}
      </p>
    </div>
  );
}
