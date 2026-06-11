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
  // Default null pra obrigar a usuária a escolher o tipo antes de logar
  // (Regina 10/06: caso real de tentar logar no lado errado). Form fica
  // bloqueado e os campos ficam atrás do toggle até a escolha sair.
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
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='0.6' opacity='0.12'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3Ccircle cx='120' cy='40' r='40'/%3E%3Ccircle cx='120' cy='200' r='40'/%3E%3Ccircle cx='50.72' cy='80' r='40'/%3E%3Ccircle cx='50.72' cy='160' r='40'/%3E%3Ccircle cx='189.28' cy='80' r='40'/%3E%3Ccircle cx='189.28' cy='160' r='40'/%3E%3C/g%3E%3C/svg%3E\"), radial-gradient(ellipse 1400px 900px at 18% 12%, rgba(212, 175, 55, 0.20), transparent 55%), radial-gradient(ellipse 1100px 800px at 82% 28%, rgba(232, 138, 152, 0.14), transparent 55%), radial-gradient(ellipse 1100px 800px at 28% 78%, rgba(197, 180, 255, 0.14), transparent 55%), radial-gradient(ellipse 950px 750px at 78% 92%, rgba(168, 137, 71, 0.16), transparent 55%), linear-gradient(135deg, #FAF7F0 0%, #FFFEF9 50%, #F5EFDD 100%)",
          backgroundSize: "240px 240px, auto, auto, auto, auto, auto",
          backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      {/* ============ HEADER ============ */}
      <header className="relative z-[2] w-full pt-9">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center px-6">
          <Logo variant="xl" mode="brand" priority />
          <div className="mt-4 flex items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06))",
                border: "0.5px solid rgba(168,137,71,0.45)",
                color: "var(--primary-deep)",
                letterSpacing: "0.28em",
              }}
            >
              Lei 14.133/2021
            </span>
            <span
              className="text-[11px] font-bold uppercase"
              style={{ color: "var(--text-faint)", letterSpacing: "0.28em" }}
            >
              Plataforma Premium
            </span>
          </div>
        </div>
      </header>

      {/* ============ HERO (split: vídeo + card login) ============ */}
      <main className="relative z-[1] mx-auto w-full max-w-[1280px] px-6 pt-12 pb-16 lg:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_minmax(420px,460px)] lg:gap-14 lg:items-start">
          {/* === VÍDEO INSTITUCIONAL (estilo ContratosGOV, mas com paleta CP) === */}
          <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <h1
              className="text-[34px] font-extrabold leading-[1.05] lg:text-[44px]"
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
              ajuda na gestão dos contratos
            </h1>

            <p
              className="mt-5 max-w-[560px] text-[16px] leading-relaxed lg:text-[17px]"
              style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
            >
              Conectamos de forma inteligente atas, contratos, empenhos, prazos e
              fiscalização — disponibilizando as informações fundamentais e
              melhorando as condições operacionais do dia a dia de quem vende ao governo.
            </p>

            <p
              className="mt-3 max-w-[560px] text-[15px] leading-relaxed"
              style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
            >
              IA jurídica nativa lê seus documentos, identifica vigências,
              calcula reajustes pela Lei 14.133 e te avisa antes do prazo
              vencer. Tudo auditável, com trilha de quem mudou o quê e quando.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/precos"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                  color: "#0A0A0A",
                  letterSpacing: "0.18em",
                  boxShadow:
                    "0 12px 32px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                Mais sobre o sistema
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </Link>
              <Link
                href="/signup?tipo=EMPRESA"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "0.5px solid var(--hairline)",
                  color: "var(--text)",
                  letterSpacing: "0.18em",
                }}
              >
                Solicite demonstração
              </Link>
            </div>

            {/* PLAYER DE VÍDEO — grande, com bordas decorativas em L */}
            <div className="mt-12 w-full max-w-[640px]">
              <VideoPlayerInstitucional
                aberto={videoAberto}
                onAbrir={() => setVideoAberto(true)}
              />
            </div>
          </section>

          {/* === CARD DE LOGIN === */}
          <aside
            className="glass w-full self-start overflow-hidden rounded-[28px] px-9 py-10"
            style={{ color: "var(--text-soft)" }}
          >
            <div className="relative z-[1]">
              <div className="text-center">
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ color: "var(--primary-deep)", letterSpacing: "0.32em" }}
                >
                  Já é cliente?
                </span>
                <h2
                  className="mt-3 text-[28px] font-extrabold leading-tight lg:text-[30px]"
                  style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
                >
                  Entrar na sua{" "}
                  <em
                    style={{
                      fontStyle: "normal",
                      background:
                        "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    conta
                  </em>
                </h2>
                <p
                  className="mt-2 text-[13px]"
                  style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
                >
                  Acesse o painel de gestão dos seus contratos.
                </p>
              </div>

              {/* Headline pro toggle — forçar atenção pra escolha do tipo */}
              <div className="mt-7 text-center">
                <p
                  className="text-[12px] font-bold uppercase"
                  style={{
                    color: tipoEscolhido === null ? "var(--coral-deep)" : "var(--primary-deep)",
                    letterSpacing: "0.24em",
                  }}
                >
                  1. Primeiro, qual é o seu tipo de conta?
                </p>
              </div>

              {/* Toggle Empresa / Analista — cards grandes, pulsando quando sem escolha */}
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTipoEscolhido("EMPRESA")}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-5 transition ${
                    tipoEscolhido === null ? "animate-pulse" : ""
                  }`}
                  style={
                    tipoEscolhido === "EMPRESA"
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(212,175,55,0.10)), rgba(255,255,255,0.5)",
                          border: "1.5px solid rgba(168,137,71,0.7)",
                          boxShadow:
                            "0 0 22px rgba(212,175,55,0.28), inset 0 1px 0 rgba(255,255,255,0.6)",
                          color: "var(--text)",
                        }
                      : {
                          background: "rgba(255,255,255,0.65)",
                          border: "1.5px solid var(--hairline)",
                          color: "var(--text-soft)",
                        }
                  }
                >
                  <Building2
                    className="h-7 w-7 shrink-0"
                    style={{
                      color:
                        tipoEscolhido === "EMPRESA" ? "var(--primary-deep)" : "var(--text-mute)",
                      strokeWidth: 1.6,
                    }}
                  />
                  <span className="text-[14px] font-extrabold">Empresa</span>
                  <span
                    className="text-[10px] uppercase"
                    style={{
                      color: tipoEscolhido === "EMPRESA" ? "var(--primary-deep)" : "var(--text-faint)",
                      letterSpacing: "0.18em",
                    }}
                  >
                    Vende ao governo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoEscolhido("ANALISTA")}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-5 transition ${
                    tipoEscolhido === null ? "animate-pulse" : ""
                  }`}
                  style={
                    tipoEscolhido === "ANALISTA"
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(212,175,55,0.10)), rgba(255,255,255,0.5)",
                          border: "1.5px solid rgba(168,137,71,0.7)",
                          boxShadow:
                            "0 0 22px rgba(212,175,55,0.28), inset 0 1px 0 rgba(255,255,255,0.6)",
                          color: "var(--text)",
                        }
                      : {
                          background: "rgba(255,255,255,0.65)",
                          border: "1.5px solid var(--hairline)",
                          color: "var(--text-soft)",
                        }
                  }
                >
                  <UserCheck
                    className="h-7 w-7 shrink-0"
                    style={{
                      color:
                        tipoEscolhido === "ANALISTA"
                          ? "var(--primary-deep)"
                          : "var(--text-mute)",
                      strokeWidth: 1.6,
                    }}
                  />
                  <span className="text-[14px] font-extrabold">Analista</span>
                  <span
                    className="text-[10px] uppercase"
                    style={{
                      color:
                        tipoEscolhido === "ANALISTA" ? "var(--primary-deep)" : "var(--text-faint)",
                      letterSpacing: "0.18em",
                    }}
                  >
                    Indica clientes
                  </span>
                </button>
              </div>

              {/* Form — só aparece depois que escolheu o tipo */}
              {tipoEscolhido === null ? (
                <div
                  className="mt-6 rounded-2xl px-5 py-6 text-center"
                  style={{
                    background: "rgba(232,138,152,0.10)",
                    border: "1px dashed rgba(198,103,112,0.4)",
                  }}
                >
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--coral-deep)" }}
                  >
                    Escolha acima o tipo de conta pra continuar.
                  </p>
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--text-mute)" }}
                  >
                    Em caso de dúvida: <strong>Empresa</strong> usa o sistema pra gerir contratos.{" "}
                    <strong>Analista</strong> indica clientes e ganha comissão.
                  </p>
                </div>
              ) : (
                <p
                  className="mt-6 text-center text-[11px] font-bold uppercase"
                  style={{ color: "var(--primary-deep)", letterSpacing: "0.24em" }}
                >
                  2. Agora informe e-mail e senha de {tipoEscolhido === "EMPRESA" ? "Empresa" : "Analista"}
                </p>
              )}

              {/* Form — campos só ficam disponíveis após escolher o tipo */}
              {tipoEscolhido && (
                <form action={formAction} className="mt-4 grid grid-cols-1 gap-5">
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

                  <div className="mt-2">
                    <SubmitButton>
                      Entrar como {tipoEscolhido === "EMPRESA" ? "Empresa" : "Analista"}
                    </SubmitButton>
                  </div>
                </form>
              )}

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

        {/* ============ FAIXA DE FEATURES (estilo Tela 1 do ContratosGOV) ============ */}
        <section className="mt-20">
          <div className="text-center">
            <span
              className="text-[11px] font-bold uppercase"
              style={{ color: "var(--primary-deep)", letterSpacing: "0.32em" }}
            >
              Por que o CP System
            </span>
            <h3
              className="mx-auto mt-3 max-w-[680px] text-[26px] font-extrabold leading-tight lg:text-[30px]"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              Quatro pilares pra você não perder nem prazo, nem dinheiro
            </h3>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CardFeature
              icon={BellRing}
              titulo="Controle de prazos"
              descricao="Seja alertado sobre cada etapa antes do vencimento — entrega, NF, pagamento, reajuste, fim de vigência."
            />
            <CardFeature
              icon={FileCheck2}
              titulo="Controle financeiro"
              descricao="Pagamentos efetuados, débitos em aberto e saldos por vigência num só lugar, atualizados em tempo real."
            />
            <CardFeature
              icon={ShieldCheck}
              titulo="Fiscalização completa"
              descricao="Acompanhe o cumprimento das obrigações contratuais, garantias, apostilamentos e aditivos com trilha auditável."
            />
            <CardFeature
              icon={Brain}
              titulo="IA jurídica nativa"
              descricao="Lê PDFs, extrai itens, calcula reajustes pela Lei 14.133 e responde dúvidas no padrão TCU."
            />
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="relative z-[1] border-t pb-10 pt-8" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-3 px-6 text-[11px] uppercase sm:flex-row sm:justify-between"
          style={{ letterSpacing: "0.24em", color: "var(--text-faint)" }}>
          <span>CP System · Plataforma Premium</span>
          <span>LGPD · Lei 14.133/2021 · Trilha auditável</span>
        </div>
      </footer>

      {/* Inputs herdam paleta clara fora de .app-shell */}
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

// ============================================================
// VÍDEO INSTITUCIONAL — container com bordas decorativas em L
// (espelho do estilo "Entenda como ajuda" do ContratosGOV)
// ============================================================
function VideoPlayerInstitucional({
  aberto,
  onAbrir,
}: {
  aberto: boolean;
  onAbrir: () => void;
}) {
  return (
    <div className="relative">
      {/* Bordas decorativas em L (4 cantos) — efeito "moldura premium" */}
      <span aria-hidden className="absolute -left-3 -top-3 h-12 w-12 rounded-tl-2xl"
        style={{ borderTop: "2px solid var(--primary)", borderLeft: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -right-3 -top-3 h-12 w-12 rounded-tr-2xl"
        style={{ borderTop: "2px solid var(--primary)", borderRight: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -bottom-3 -left-3 h-12 w-12 rounded-bl-2xl"
        style={{ borderBottom: "2px solid var(--primary)", borderLeft: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -bottom-3 -right-3 h-12 w-12 rounded-br-2xl"
        style={{ borderBottom: "2px solid var(--primary)", borderRight: "2px solid var(--primary)" }} />

      {/* Player */}
      <div
        className="glass relative overflow-hidden rounded-[20px]"
        style={{ aspectRatio: "16 / 10" }}
      >
        {/* Mock de dashboard atrás do play */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 520px 360px at 28% 32%, rgba(212,175,55,0.26), transparent 60%), radial-gradient(ellipse 420px 280px at 78% 72%, rgba(197,180,255,0.20), transparent 60%), linear-gradient(135deg, rgba(255,254,249,0.85), rgba(245,239,221,0.95))",
          }}
        />
        <div aria-hidden className="absolute inset-0 flex items-center justify-center opacity-50">
          <svg width="86%" height="62%" viewBox="0 0 400 220" fill="none">
            <rect x="0" y="0" width="120" height="80" rx="10" fill="rgba(212,175,55,0.22)" />
            <rect x="140" y="0" width="120" height="80" rx="10" fill="rgba(94,168,159,0.20)" />
            <rect x="280" y="0" width="120" height="80" rx="10" fill="rgba(197,180,255,0.24)" />
            <rect x="0" y="100" width="260" height="120" rx="12" fill="rgba(255,255,255,0.65)" />
            <rect x="280" y="100" width="120" height="120" rx="12" fill="rgba(212,175,55,0.18)" />
            <path
              d="M14 200 Q 60 150 100 170 T 180 160 T 250 130"
              stroke="rgba(168,137,71,0.7)"
              strokeWidth="2.6"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Estado fechado: play */}
        {!aberto && (
          <button
            type="button"
            onClick={onAbrir}
            className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-4 transition hover:scale-[1.01]"
            aria-label="Assistir vídeo institucional"
          >
            <span
              aria-hidden
              className="absolute h-[140px] w-[140px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(212,175,55,0.42) 0%, rgba(212,175,55,0) 70%)",
              }}
            />
            <span
              className="relative flex h-[92px] w-[92px] items-center justify-center rounded-full"
              style={{
                background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                boxShadow:
                  "0 16px 38px -6px rgba(168,137,71,0.6), inset 0 1px 0 rgba(255,255,255,0.55)",
              }}
            >
              <Play
                className="h-11 w-11 translate-x-[3px]"
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

        {/* Estado aberto: placeholder. Substituir por <video> quando MP4 estiver pronto. */}
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
  );
}

// ============================================================
// Card de feature (4 abaixo do hero)
// ============================================================
function CardFeature({
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
      className="glass-tile flex flex-col rounded-[20px] px-6 py-7 transition hover:translate-y-[-2px]"
      style={{ color: "var(--text)" }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(212,175,55,0.28), rgba(212,175,55,0.08))",
          border: "0.5px solid rgba(168,137,71,0.35)",
        }}
      >
        <Icone className="h-6 w-6" style={{ color: "var(--primary-deep)" }} strokeWidth={1.7} />
      </span>
      <h4
        className="mt-4 text-[16px] font-bold leading-tight"
        style={{ letterSpacing: "-0.015em" }}
      >
        {titulo}
      </h4>
      <p
        className="mt-2 text-[13px] leading-relaxed"
        style={{ color: "var(--text-soft)" }}
      >
        {descricao}
      </p>
    </div>
  );
}
