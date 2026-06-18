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
    <div className="auth-shell relative min-h-screen overflow-hidden">
      {/* Background atmosferico (Igor 17/06): predominio branco/creme com
          algumas partes escuras como destaque — reverte o dark-premium */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='0.6' opacity='0.08'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3Ccircle cx='120' cy='40' r='40'/%3E%3Ccircle cx='120' cy='200' r='40'/%3E%3Ccircle cx='50.72' cy='80' r='40'/%3E%3Ccircle cx='50.72' cy='160' r='40'/%3E%3Ccircle cx='189.28' cy='80' r='40'/%3E%3Ccircle cx='189.28' cy='160' r='40'/%3E%3C/g%3E%3C/svg%3E\"), radial-gradient(ellipse 1400px 900px at 18% 12%, rgba(212, 175, 55, 0.18), transparent 55%), radial-gradient(ellipse 1100px 800px at 82% 28%, rgba(232, 138, 152, 0.12), transparent 55%), radial-gradient(ellipse 1100px 800px at 28% 78%, rgba(197, 180, 255, 0.12), transparent 55%), radial-gradient(ellipse 950px 750px at 78% 92%, rgba(168, 137, 71, 0.14), transparent 55%), linear-gradient(135deg, #FAF7F0 0%, #FFFEF9 50%, #F5EFDD 100%)",
          backgroundSize: "240px 240px, auto, auto, auto, auto, auto",
          backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat",
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
            </a>
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
        {/* Igor (17/06 00:58): nova versao da secao do analista — 3 beneficios
            + timeline visual "Como funciona na pratica" com emojis 1-4 */}
        <section id="analistas" className="mt-20">
          <div
            className="glass overflow-hidden rounded-[28px] px-10 py-12 lg:px-14"
            style={{ color: "var(--text)" }}
          >
            {/* Header da secao */}
            <div className="mx-auto max-w-[840px] text-center">
              <span
                className="text-[11px] font-bold uppercase"
                style={{ color: "var(--primary-deep)", letterSpacing: "0.34em" }}
              >
                Para o analista de licitação
              </span>
              <h2
                className="mt-3 text-[28px] font-extrabold leading-[1.15] lg:text-[36px]"
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
                para o Analista de Licitação com comissionamento por assinatura
              </h2>
              <p
                className="mt-5 text-[15px] leading-relaxed lg:text-[17px]"
                style={{ color: "var(--text-soft)" }}
              >
                Analista, para cada cliente seu que assinar o CP System, você terá acesso imediato aos seguintes benefícios:
              </p>
            </div>

            {/* 3 beneficios em grid */}
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <BeneficioAnalista
                icone="💼"
                titulo="Módulo Exclusivo e Gratuito"
                descricao="Acompanhe os contratos, atas e a execução de todos os seus clientes em uma única tela, de forma totalmente gratuita, enquanto a empresa for assinante do CP System."
              />
              <BeneficioAnalista
                icone="📊"
                titulo="Controle dos Seus Honorários"
                descricao="O módulo do analista possui uma área dedicada para você controlar o status de pagamento das suas próprias comissões (fixas e variáveis de êxito) sobre a execução de cada contrato."
              />
              <BeneficioAnalista
                icone="💰"
                titulo="Comissionamento Gamificado (Renda Passiva)"
                descricao="Indique o CP System para organizar a operação do seu cliente e seja recompensado por isso. Você recebe uma comissão mensal recorrente, paga diretamente pela nossa plataforma, enquanto o seu cliente for assinante. Quanto mais clientes ativos, maior o seu percentual."
              />
            </div>

            {/* Timeline "Como funciona na pratica" — 4 passos visuais */}
            <div className="mt-12 lg:mt-14">
              <div className="text-center">
                <span
                  className="text-[11px] font-bold uppercase"
                  style={{ color: "var(--primary-deep)", letterSpacing: "0.34em" }}
                >
                  Como funciona na prática?
                </span>
              </div>
              <div className="relative mt-7">
                {/* Linha horizontal conectora (desktop) */}
                <div
                  aria-hidden
                  className="absolute left-[8%] right-[8%] top-[34px] hidden h-px lg:block"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--primary), var(--primary), transparent)",
                    opacity: 0.55,
                  }}
                />
                <div className="relative grid gap-6 lg:grid-cols-4 lg:gap-4">
                  <PassoTimeline
                    numero="1"
                    icone="📝"
                    texto="Cadastre-se na plataforma gratuitamente como Analista de Licitação."
                  />
                  <PassoTimeline
                    numero="2"
                    icone="🗣️"
                    texto="Indique o CP System aos seus clientes."
                  />
                  <PassoTimeline
                    numero="3"
                    icone="🤝"
                    texto="O cliente assina a plataforma e vincula o seu perfil ao cadastro dele."
                  />
                  <PassoTimeline
                    numero="4"
                    icone="💸"
                    texto="Automaticamente, você ganha acesso ao módulo de gestão exclusivo e começa a gerar uma nova fonte de renda passiva."
                  />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
                Saiba mais
              </Link>
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

// ===========================================================
// Card de Beneficio do Analista (3 cards horizontal — Igor 17/06)
// ===========================================================
function BeneficioAnalista({
  icone,
  titulo,
  descricao,
}: {
  icone: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <div
      className="rounded-[22px] px-7 py-7"
      style={{
        background:
          "linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.03))",
        border: "0.5px solid rgba(168,137,71,0.30)",
      }}
    >
      <div className="text-[36px] leading-none">{icone}</div>
      <h4
        className="mt-5 text-[17px] font-extrabold leading-tight"
        style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
      >
        {titulo}
      </h4>
      <p
        className="mt-3 text-[13.5px] leading-relaxed"
        style={{ color: "var(--text-soft)" }}
      >
        {descricao}
      </p>
    </div>
  );
}

// ===========================================================
// Passo da Timeline "Como funciona na pratica" (Igor 17/06)
// ===========================================================
function PassoTimeline({
  numero,
  icone,
  texto,
}: {
  numero: string;
  icone: string;
  texto: string;
}) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <div
        className="relative z-[1] flex h-[68px] w-[68px] items-center justify-center rounded-full text-[26px]"
        style={{
          background:
            "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
          boxShadow:
            "0 10px 24px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        {icone}
      </div>
      <span
        className="mt-3 text-[10px] font-bold uppercase"
        style={{ color: "var(--primary-deep)", letterSpacing: "0.28em" }}
      >
        Passo {numero}
      </span>
      <p
        className="mt-2 max-w-[220px] text-[13px] leading-relaxed"
        style={{ color: "var(--text-soft)" }}
      >
        {texto}
      </p>
    </div>
  );
}
