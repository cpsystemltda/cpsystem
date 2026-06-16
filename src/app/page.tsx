import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, DollarSign, FileCheck2, Truck, Users, Brain } from "lucide-react";
import { getUsuarioAtual } from "@/lib/auth";
import { Logo } from "@/components/Logo";

// Regina 16/06: home = conteudo do /login antigo (Plataforma Premium + H1 +
// 5 cards features) na identidade visual da / original (preto+dourado premium,
// cards coloridos no estilo dashboard interno).
export default async function Home() {
  const usuario = await getUsuarioAtual();
  if (usuario) redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0C1019] text-white antialiased">
      {/* ============== Aura cromatica dourada ============== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-20 -top-20 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-[#D4AF37]/30 via-[#9C7A2D]/20 to-transparent blur-3xl" />
        <div className="absolute -right-20 top-40 h-[620px] w-[620px] rounded-full bg-gradient-to-bl from-[#F4D374]/25 via-[#B8860B]/20 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-t from-[#D4AF37]/15 to-transparent blur-3xl" />
      </div>

      {/* ============== HEADER ============== */}
      <header className="relative z-[3] w-full">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center">
            <Logo variant="md" mode="brand" onDark priority />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#sistema" className="text-sm font-medium text-white/85 transition hover:text-[#F4D374]">
              Por que
            </a>
            <a href="#sistema" className="text-sm font-medium text-white/85 transition hover:text-[#F4D374]">
              Sistema
            </a>
            <Link href="/precos" className="text-sm font-medium text-white/85 transition hover:text-[#F4D374]">
              Planos
            </Link>
            <a href="#faq" className="text-sm font-medium text-white/85 transition hover:text-[#F4D374]">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:inline-block"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#B8860B] to-[#F4D374] px-5 py-2.5 text-sm font-bold text-[#1A1206] shadow-lg shadow-[#D4AF37]/30 transition hover:scale-[1.02] hover:from-[#8B6914] hover:to-[#E8C547]"
            >
              Assinar
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-[2]">
        {/* ============== HERO ============== */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-20 text-center lg:pt-28 lg:pb-24">
          <span
            className="inline-block text-[12px] font-bold uppercase"
            style={{
              background: "linear-gradient(135deg, #F4D374, #D4AF37, #B8860B)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.34em",
            }}
          >
            Plataforma Premium
          </span>
          <h1
            className="mx-auto mt-6 max-w-[1100px] text-[44px] font-extrabold leading-[1.04] tracking-tight text-white lg:text-[72px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Gestão e controle de{" "}
            <span
              className="bg-gradient-to-r from-[#F4D374] via-[#D4AF37] to-[#B8860B] bg-clip-text text-transparent"
            >
              Contratos, Atas (SRP) e Empenhos
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-[720px] text-[17px] leading-relaxed text-slate-300 lg:text-[19px]">
            Assuma o controle total da sua execução pública: elimine gargalos operacionais e proteja
            o lucro de cada Contrato, Ata e Empenho.
          </p>
          <div className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#F4D374] px-9 py-4 text-[13px] font-bold uppercase text-[#1A1206] shadow-2xl shadow-[#D4AF37]/40 transition hover:scale-[1.02] hover:from-[#8B6914] hover:to-[#E8C547]"
              style={{ letterSpacing: "0.22em" }}
            >
              Solicite demonstração
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href="/precos"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-9 py-4 text-[13px] font-bold uppercase text-white backdrop-blur transition hover:bg-white/10"
              style={{ letterSpacing: "0.22em" }}
            >
              Ver planos
            </Link>
          </div>
        </section>

        {/* ============== 5 CARDS GRANDES COLORIDOS ============== */}
        <section id="sistema" className="mx-auto max-w-7xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ShowcaseCard
              cor="from-[#B8860B] via-[#D4AF37] to-[#F4D374]"
              icone={DollarSign}
              titulo="Controle financeiro"
              descricao="Valores contratados, executados, a executar, recebidos e a receber."
            />
            <ShowcaseCard
              cor="from-emerald-500 to-green-700"
              icone={FileCheck2}
              titulo="Controle de contratações"
              descricao="Contratos, atas e empenhos vigentes, expirados, a expirar."
            />
            <ShowcaseCard
              cor="from-[#3D434C] to-[#0C1019]"
              icone={Truck}
              titulo="Controle logístico"
              descricao="Esteira de entrega/execução com agenda, controle de prazos e alertas."
            />
            <ShowcaseCard
              cor="from-[#D4AF37] to-[#9C7A2D]"
              icone={Users}
              titulo="Controle de clientes"
              descricao="Órgãos atendidos, locais de entrega/execução."
            />
            <ShowcaseCard
              cor="from-emerald-600 to-teal-800"
              icone={Brain}
              titulo="Inteligência jurídica nativa"
              descricao="Alimentação de dados, cálculo de reajustes e tira-dúvidas."
            />
          </div>
        </section>
      </main>

      <footer className="relative z-[1] border-t border-[#D4AF37]/15 bg-[#0C1019] py-10 text-white">
        <div
          className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 text-[11px] uppercase sm:flex-row sm:justify-between"
          style={{ letterSpacing: "0.24em", color: "rgba(255,255,255,0.5)" }}
        >
          <span>CP System &middot; Plataforma Premium</span>
          <span>LGPD &middot; Trilha auditável &middot; Conexão segura</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Card grande colorido (estilo Showcase do dashboard interno)
// ============================================================
function ShowcaseCard({
  cor,
  icone: Icone,
  titulo,
  descricao,
}: {
  cor: string;
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  descricao: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${cor} p-10 text-white shadow-xl shadow-black/40`}
    >
      <Icone className="relative z-[1] h-9 w-9 text-white/95" />
      <h3 className="relative z-[1] mt-6 text-2xl font-extrabold tracking-tight sm:text-[26px]">
        {titulo}
      </h3>
      <p className="relative z-[1] mt-3 max-w-md text-[14px] leading-relaxed text-white/85">
        {descricao}
      </p>
      <Icone aria-hidden className="pointer-events-none absolute -right-4 -bottom-4 h-36 w-36 text-white/10" />
    </div>
  );
}
