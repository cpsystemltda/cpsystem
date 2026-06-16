"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Building2,
  UserCheck,
  Play,
  Brain,
  FileCheck2,
  ArrowRight,
  DollarSign,
  Truck,
  Users,
  Briefcase,
} from "lucide-react";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

export default function HomeLandingClient() {
  const [state, formAction] = useActionState(loginAction, null);
  const [tipoEscolhido, setTipoEscolhido] = useState<"EMPRESA" | "ANALISTA" | null>(null);
  const [videoAberto, setVideoAberto] = useState(false);

  return (
    <div className="auth-shell theme-dark-premium relative min-h-screen overflow-hidden">
      {/* Background atmosfericamente DARK premium (Regina 16/06): preto profundo
          com aura dourada — mantem identidade preto+dourado da pagina inicial */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23F4D374' stroke-width='0.6' opacity='0.10'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3Ccircle cx='120' cy='40' r='40'/%3E%3Ccircle cx='120' cy='200' r='40'/%3E%3Ccircle cx='50.72' cy='80' r='40'/%3E%3Ccircle cx='50.72' cy='160' r='40'/%3E%3Ccircle cx='189.28' cy='80' r='40'/%3E%3Ccircle cx='189.28' cy='160' r='40'/%3E%3C/g%3E%3C/svg%3E\"), radial-gradient(ellipse 1400px 900px at 18% 12%, rgba(212, 175, 55, 0.30), transparent 55%), radial-gradient(ellipse 1100px 800px at 82% 28%, rgba(244, 211, 116, 0.18), transparent 55%), radial-gradient(ellipse 950px 750px at 78% 92%, rgba(168, 137, 71, 0.22), transparent 55%), linear-gradient(135deg, #0C1019 0%, #1A1F2E 50%, #0C1019 100%)",
          backgroundSize: "240px 240px, auto, auto, auto, auto",
          backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      {/* ======================= HEADER ======================= */}
      {/* Logo dentro de uma "pilula" glass branca pra ganhar contraste sobre
          o fundo dourado/creme atmosferico (Igor 14/06: marca sumia no canto). */}
      <header className="relative z-[3] w-full">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-8 py-5">
          <div
            className="inline-flex items-center rounded-2xl px-4 py-2"
            style={{
              background: "rgba(255,255,255,0.78)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "0.5px solid rgba(168,137,71,0.30)",
              boxShadow:
                "0 6px 20px -4px rgba(20,16,8,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            <Logo variant="lg" mode="brand" priority />
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/" className="text-[13px] font-semibold transition hover:opacity-80" style={{ color: "var(--text-soft)" }}>
              Home
            </Link>
            <a href="#sistema" className="text-[13px] font-semibold transition hover:opacity-80" style={{ color: "var(--text-soft)" }}>
              O sistema
            </a>
            <Link href="/precos" className="text-[13px] font-semibold transition hover:opacity-80" style={{ color: "var(--text-soft)" }}>
              Planos
            </Link>
            <a href="#analistas" className="text-[13px] font-semibold transition hover:opacity-80" style={{ color: "var(--text-soft)" }}>
              Para analistas
            </Link>
            <a
              href="#login"
              className="ml-2 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold uppercase transition hover:opacity-90"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: "0.5px solid var(--hairline)",
                color: "var(--text)",
                letterSpacing: "0.18em",
              }}
            >
              Login
            </a>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                color: "#0A0A0A",
                letterSpacing: "0.18em",
                boxShadow: "0 8px 22px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
            >
              Cadastrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-[1] mx-auto w-full max-w-[1320px] px-8 pb-16">

        {/* ============== SEÇÃO 1 — HERO ============== */}
        <section className="pt-10 pb-14 text-center lg:pt-14 lg:pb-16">
          <span className="text-[11px] font-bold uppercase" style={{ color: "var(--primary-deep)", letterSpacing: "0.34em" }}>
            Plataforma Premium
          </span>
          <h1
            className="mx-auto mt-4 max-w-[1000px] text-[36px] font-extrabold leading-[1.05] lg:text-[52px]"
            style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
          >
            Gestão e controle de{" "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Contratos, Atas (SRP) e Empenhos
            </em>
          </h1>
          <p
            className="mx-auto mt-5 max-w-[760px] text-[16px] leading-relaxed lg:text-[18px]"
            style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
          >
            Assuma o controle total da sua execução pública: elimine gargalos operacionais e proteja o lucro de cada Contrato, Ata e Empenho.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                color: "#0A0A0A",
                letterSpacing: "0.2em",
                boxShadow: "0 12px 32px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              Solicite demonstração
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/precos"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: "0.5px solid var(--hairline)",
                color: "var(--text)",
                letterSpacing: "0.2em",
              }}
            >
              Ver planos
            </Link>
          </div>
        </section>

        {/* ============== SEÇÃO 2 — 5 CARDS DE FEATURES ============== */}
        <section>
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-5">
            <FeatureCard
              icon={DollarSign}
              titulo="Controle financeiro"
              descricao="Valores contratados, executados, a executar, recebidos e a receber."
            />
            <FeatureCard
              icon={FileCheck2}
              titulo="Controle de contratações"
              descricao="Contratos, atas e empenhos vigentes, expirados, a expirar."
            />
            <FeatureCard
              icon={Truck}
              titulo="Controle logístico"
              descricao="Esteira de entrega/execução com agenda, controle de prazos e alertas."
            />
            <FeatureCard
              icon={Users}
              titulo="Controle de clientes"
              descricao="Órgãos atendidos, locais de entrega/execução."
            />
            <FeatureCard
              icon={Brain}
              titulo="Inteligência jurídica nativa"
              descricao="Alimentação de dados, cálculo de reajustes e tira-dúvidas."
            />
          </div>
        </section>

        {/* ============== SEÇÃO 3 — INSTITUCIONAL SPLIT (TEXTO + STATS / VÍDEO) ============== */}
        <section id="sistema" className="mt-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
            {/* Coluna esquerda — texto + stats */}
            <div>
              <span className="text-[11px] font-bold uppercase" style={{ color: "var(--primary-deep)", letterSpacing: "0.3em" }}>
                O sistema
              </span>
              <h2
                className="mt-3 text-[30px] font-extrabold leading-[1.1] lg:text-[36px]"
                style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
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
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed lg:text-[16px]" style={{ color: "var(--text-soft)" }}>
                Vencer a licitação é apenas o primeiro passo; o seu verdadeiro lucro é garantido na execução. O CP System substitui planilhas amadoras por um painel inteligente que centraliza toda a sua operação governamental. Acompanhe a linha do tempo de empenhos, controle o saldo das suas Atas (SRP) e contratos em tempo real e elimine a desorganização que gera atrasos e multas.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed lg:text-[16px]" style={{ color: "var(--text-soft)" }}>
                Mais do que gestão logística, nossa plataforma oferece inteligência jurídica nativa. O sistema audita automaticamente os limites legais de aditivos e adesões, avisa o momento exato para solicitar reajustes de preços e emite alertas de prazos parametrizados. Pare de perder dinheiro com falhas operacionais: assuma o controle com o CP System e foque apenas em expandir as suas vendas.
              </p>

              {/* Mini-stats horizontais (substituem números factuais ainda inexistentes) */}
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBlock numero="12+" label="Tipos de instrumentos" />
                <StatBlock numero="100%" label="Auditável" />
                <StatBlock numero="IA" label="Jurídica nativa" />
                <StatBlock numero="∞" label="Multi-empresa" />
              </div>

              <div className="mt-7">
                <Link
                  href="/precos"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
                  style={{
                    background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                    color: "#0A0A0A",
                    letterSpacing: "0.2em",
                    boxShadow: "0 10px 26px -6px rgba(168,137,71,0.4), inset 0 1px 0 rgba(255,255,255,0.45)",
                  }}
                >
                  Mais sobre o sistema
                  <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                </Link>
              </div>
            </div>

            {/* Coluna direita — vídeo */}
            <div className="flex items-center justify-center">
              <VideoPlayerInstitucional aberto={videoAberto} onAbrir={() => setVideoAberto(true)} />
            </div>
          </div>
        </section>

        {/* ============== SEÇÃO 3.5 — PARA O ANALISTA DE LICITAÇÃO ============== */}
        {/* Lean Canvas item 5 (Canais): "Indicação e parcerias com ecossistemas
            de analistas de licitação". Analista NAO eh cliente — eh canal de
            aquisicao. Empresa contrata, analista indica, ganha comissao. */}
        <section id="analistas" className="mt-20">
          <div
            className="glass overflow-hidden rounded-[28px] px-10 py-12 lg:px-14"
            style={{ color: "var(--text)" }}
          >
            <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
              <div>
                <span
                  className="text-[11px] font-bold uppercase"
                  style={{ color: "var(--primary-deep)", letterSpacing: "0.34em" }}
                >
                  Para o analista de licitação
                </span>
                <h2
                  className="mt-3 text-[28px] font-extrabold leading-[1.1] lg:text-[36px]"
                  style={{ letterSpacing: "-0.025em" }}
                >
                  Módulo{" "}
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
                    exclusivo
                  </em>{" "}
                  para quem indica clientes
                </h2>
                <p
                  className="mt-4 text-[15px] leading-relaxed lg:text-[16px]"
                  style={{ color: "var(--text-soft)" }}
                >
                  Controle as execuções dos seus clientes e receba{" "}
                  <strong style={{ color: "var(--text)" }}>comissões fixas e variáveis</strong>{" "}
                  enquanto a empresa que você indicou for assinante do CP System. Você acompanha tudo num painel próprio, sem misturar com a operação interna do cliente.
                </p>
                <ul
                  className="mt-5 space-y-2 text-[14px] leading-relaxed"
                  style={{ color: "var(--text-soft)" }}
                >
                  <li className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                    Cadastre seus clientes empresariais e gere link de indicação único.
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                    Acompanhe as execuções de cada empresa cliente em painel separado.
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                    Receba comissões recorrentes enquanto o cliente for ativo.
                  </li>
                </ul>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/signup?tipo=ANALISTA"
                    className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition hover:scale-[1.02]"
                    style={{
                      background:
                        "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                      color: "#0A0A0A",
                      letterSpacing: "0.2em",
                      boxShadow:
                        "0 12px 32px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
                    }}
                  >
                    Cadastrar como analista
                    <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                  </Link>
                  <Link
                    href="/seja-embaixador"
                    className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition"
                    style={{
                      background: "rgba(255,255,255,0.7)",
                      border: "0.5px solid var(--hairline)",
                      color: "var(--text)",
                      letterSpacing: "0.2em",
                    }}
                  >
                    Como funciona
                  </Link>
                </div>
              </div>

              {/* Mini "card de comissão" decorativo */}
              <div
                className="rounded-[22px] px-7 py-7 lg:px-9 lg:py-9"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.04))",
                  border: "0.5px solid rgba(168,137,71,0.40)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                      boxShadow:
                        "0 8px 20px -4px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
                    }}
                  >
                    <Briefcase
                      className="h-5 w-5"
                      style={{ color: "#FFFEF9" }}
                      strokeWidth={2}
                    />
                  </span>
                  <span
                    className="text-[11px] font-bold uppercase"
                    style={{ color: "var(--primary-deep)", letterSpacing: "0.28em" }}
                  >
                    Programa de Analistas
                  </span>
                </div>
                <p
                  className="mt-5 text-[13px] leading-relaxed"
                  style={{ color: "var(--text-soft)" }}
                >
                  Indique uma empresa que vende ao governo. Quando ela assinar e te apontar como analista, você passa a receber comissão recorrente sobre a mensalidade dela, enquanto seguir ativa.
                </p>
                <div
                  className="mt-5 grid grid-cols-2 gap-3 text-center"
                >
                  <div
                    className="rounded-2xl px-3 py-3"
                    style={{
                      background: "rgba(255,255,255,0.65)",
                      border: "0.5px solid var(--hairline)",
                    }}
                  >
                    <div
                      className="text-[20px] font-extrabold leading-none"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Fixa
                    </div>
                    <div
                      className="mt-1.5 text-[10px] font-bold uppercase"
                      style={{ color: "var(--text-mute)", letterSpacing: "0.16em" }}
                    >
                      Por indicação ativa
                    </div>
                  </div>
                  <div
                    className="rounded-2xl px-3 py-3"
                    style={{
                      background: "rgba(255,255,255,0.65)",
                      border: "0.5px solid var(--hairline)",
                    }}
                  >
                    <div
                      className="text-[20px] font-extrabold leading-none"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Variável
                    </div>
                    <div
                      className="mt-1.5 text-[10px] font-bold uppercase"
                      style={{ color: "var(--text-mute)", letterSpacing: "0.16em" }}
                    >
                      % sobre o MRR
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============== SEÇÃO 4 — LOGIN ============== */}
        <section id="login" className="mt-24">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase" style={{ color: "var(--primary-deep)", letterSpacing: "0.32em" }}>
              Acessar plataforma
            </span>
            <h2
              className="mx-auto mt-3 max-w-[600px] text-[26px] font-extrabold leading-tight lg:text-[32px]"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              Já é cliente? Entre na sua{" "}
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
            </h2>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-[520px]">
              <div
                className="glass overflow-hidden rounded-[24px] px-9 py-9"
                style={{ color: "var(--text-soft)" }}
              >
                <div className="relative z-[1]">
                  {/* Tabs Empresa/Analista */}
                  <div
                    className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase"
                    style={{ letterSpacing: "0.22em" }}
                  >
                    <span style={{ color: tipoEscolhido === null ? "var(--coral-deep)" : "var(--text-mute)" }}>
                      Você é:
                    </span>
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
                          background: "rgba(255,255,255,0.4)",
                          border: "1px dashed var(--hairline)",
                        }}
                      >
                        <p className="text-[13px] font-semibold" style={{ color: "var(--text-soft)" }}>
                          Escolha acima o tipo de conta pra continuar.
                        </p>
                        <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: "var(--text-mute)" }}>
                          <strong style={{ color: "var(--text-soft)" }}>Empresa</strong> usa o sistema pra gerir contratos · <strong style={{ color: "var(--text-soft)" }}>Analista</strong> indica clientes e ganha comissão.
                        </p>
                      </div>
                    ) : (
                      <form action={formAction} className="grid grid-cols-1 gap-5">
                        <input type="hidden" name="tipo" value={tipoEscolhido} />
                        <Field label="E-mail" name="email" type="email" autoComplete="email" required span={4} />
                        <Field label="Senha" name="senha" type="password" autoComplete="current-password" required span={4} />

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

                  <div className="mt-7">
                    <p className="text-center text-[13px]" style={{ color: "var(--text-mute)" }}>
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
            </div>
          </div>
        </section>

        {/* ============== SEÇÃO 5 — "SE INTERESSOU" CTA FINAL ============== */}
        <section className="mt-24">
          <div
            className="glass overflow-hidden rounded-[28px] px-10 py-12 text-center lg:px-14 lg:py-14"
            style={{ color: "var(--text)" }}
          >
            <span className="text-[11px] font-bold uppercase" style={{ color: "var(--primary-deep)", letterSpacing: "0.34em" }}>
              Pronto pra começar?
            </span>
            <h2
              className="mx-auto mt-4 max-w-[760px] text-[28px] font-extrabold leading-tight lg:text-[36px]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Se interessou e quer ter o{" "}
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
              na sua empresa?
            </h2>
            <p
              className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed lg:text-[16px]"
              style={{ color: "var(--text-soft)" }}
            >
              Teste 14 dias grátis, sem cartão de crédito. Configuração assistida e suporte humano via WhatsApp.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                  color: "#0A0A0A",
                  letterSpacing: "0.2em",
                  boxShadow: "0 12px 32px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                Solicite demonstração
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </Link>
              <Link
                href="/precos"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: "0.5px solid var(--hairline)",
                  color: "var(--text)",
                  letterSpacing: "0.2em",
                }}
              >
                Ver planos
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-[1] border-t pb-9 pt-7" style={{ borderColor: "var(--hairline)" }}>
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
// MINI-STAT (4 blocos compactos abaixo do texto institucional)
// ===========================================================
function StatBlock({ numero, label }: { numero: string; label: string }) {
  return (
    <div
      className="rounded-2xl px-3 py-3.5 text-center"
      style={{
        background: "rgba(255,255,255,0.7)",
        border: "0.5px solid var(--hairline)",
      }}
    >
      <div
        className="text-[24px] font-extrabold leading-none"
        style={{
          background: "linear-gradient(135deg, var(--primary-deep), var(--primary))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.03em",
        }}
      >
        {numero}
      </div>
      <div
        className="mt-1.5 text-[10px] font-bold uppercase leading-tight"
        style={{ color: "var(--text-mute)", letterSpacing: "0.16em" }}
      >
        {label}
      </div>
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
              boxShadow: "0 0 24px rgba(212,175,55,0.30), inset 0 1px 0 rgba(255,255,255,0.65)",
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
// VÍDEO INSTITUCIONAL
// ===========================================================
function VideoPlayerInstitucional({
  aberto,
  onAbrir,
}: {
  aberto: boolean;
  onAbrir: () => void;
}) {
  return (
    <div className="relative w-full">
      {/* Moldura em L envolvendo o vídeo */}
      <span aria-hidden className="absolute -left-3 -top-3 h-14 w-14 rounded-tl-2xl"
        style={{ borderTop: "2px solid var(--primary)", borderLeft: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -right-3 -top-3 h-14 w-14 rounded-tr-2xl"
        style={{ borderTop: "2px solid var(--primary)", borderRight: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -bottom-3 -left-3 h-14 w-14 rounded-bl-2xl"
        style={{ borderBottom: "2px solid var(--primary)", borderLeft: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -bottom-3 -right-3 h-14 w-14 rounded-br-2xl"
        style={{ borderBottom: "2px solid var(--primary)", borderRight: "2px solid var(--primary)" }} />

      <div
        className="glass relative w-full overflow-hidden rounded-[20px]"
        style={{ aspectRatio: "16 / 10" }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 520px 360px at 28% 32%, rgba(212,175,55,0.22), transparent 60%), radial-gradient(ellipse 420px 280px at 78% 72%, rgba(197,180,255,0.18), transparent 60%), linear-gradient(135deg, rgba(255,254,249,0.82), rgba(245,239,221,0.95))",
          }}
        />
        <div aria-hidden className="absolute inset-0 flex items-center justify-center opacity-40">
          <svg width="84%" height="62%" viewBox="0 0 400 220" fill="none">
            <rect x="0" y="0" width="120" height="80" rx="10" fill="rgba(212,175,55,0.22)" />
            <rect x="140" y="0" width="120" height="80" rx="10" fill="rgba(94,168,159,0.20)" />
            <rect x="280" y="0" width="120" height="80" rx="10" fill="rgba(197,180,255,0.24)" />
            <rect x="0" y="100" width="260" height="120" rx="12" fill="rgba(255,255,255,0.65)" />
            <rect x="280" y="100" width="120" height="120" rx="12" fill="rgba(212,175,55,0.18)" />
            <path d="M14 200 Q 60 150 100 170 T 180 160 T 250 130" stroke="rgba(168,137,71,0.65)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
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
      className="glass-tile flex flex-col rounded-[20px] px-6 py-7 transition-transform hover:translate-y-[-2px]"
      style={{ color: "var(--text)" }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.30), rgba(212,175,55,0.08))",
          border: "0.5px solid rgba(168,137,71,0.32)",
        }}
      >
        <Icone className="h-6 w-6" style={{ color: "var(--primary-deep)" }} strokeWidth={1.7} />
      </span>
      <h4 className="mt-4 text-[16px] font-bold leading-tight" style={{ letterSpacing: "-0.015em" }}>
        {titulo}
      </h4>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
        {descricao}
      </p>
    </div>
  );
}
