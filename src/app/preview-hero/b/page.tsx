import Link from "next/link";
import { ArrowRight, Building2, UserCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

/**
 * PREVIEW B + Opção 3 (público duplo: empresa + analista)
 * Hero preto profundo, copy persuasiva endereçando os 2 públicos,
 * 2 CTAs paralelos pra capturar ambos os funis no signup.
 */
export default function PreviewB() {
  return (
    <div className="bg-[#050608] text-white antialiased min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#050608]/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <Link href="/" className="flex items-center">
            <Logo variant="md" mode="brand" priority />
          </Link>
          <nav className="hidden items-center gap-9 md:flex">
            <a href="#" className="text-sm font-medium text-white/60 transition hover:text-white">Por que</a>
            <a href="#" className="text-sm font-medium text-white/60 transition hover:text-white">Sistema</a>
            <a href="#" className="text-sm font-medium text-white/60 transition hover:text-white">Planos</a>
            <a href="#" className="text-sm font-medium text-white/60 transition hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-white/80 transition hover:text-white sm:inline-block"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#050608] transition hover:bg-white/90"
            >
              Assinar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Grid sutil (estilo Linear/Vercel) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glow sutil dourado, único */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-32 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#D4AF37]/[0.08] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-8 pb-32 pt-32 text-center">
          {/* Eyebrow minimalista — linha pontuada */}
          <div className="mb-10 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
            <span className="text-[11px] font-medium tracking-wide text-white/70">
              Lei 14.133/2021 · IA jurídica nativa
            </span>
          </div>

          {/* Título sans moderno, peso 600 (não bold gritante) */}
          <h1 className="text-[3.2rem] font-semibold leading-[1] tracking-[-0.035em] text-white sm:text-7xl md:text-[5.5rem]">
            O fim do <span className="text-[#D4AF37]">Excel</span>
            <br />
            no B2G<span className="text-[#D4AF37]">.</span>
          </h1>

          {/* Subtítulo — público duplo (Opção 3) */}
          <p className="mx-auto mt-8 max-w-3xl text-base leading-relaxed text-white/60 text-balance sm:text-lg">
            Para a <span className="font-semibold text-white">empresa</span> que vende ao governo:
            do empenho ao pagamento, em uma só tela, sob a Lei 14.133.
            <br className="hidden sm:block" />
            Para o <span className="font-semibold text-white">analista de licitação</span>:
            gestão consolidada de todos os clientes <span className="text-[#D4AF37]">+ comissão recorrente</span>.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/40">
            A inteligência da Contratos Públicos por trás dos dois.
          </p>

          {/* 2 CTAs paralelos — empresa (primário) e analista (secundário dourado) */}
          <div className="mt-12 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup?tipo=EMPRESA"
              className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-7 py-3.5 text-sm font-semibold text-[#050608] transition hover:bg-white/90"
            >
              <Building2 className="h-4 w-4" />
              Sou empresa fornecedora
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href="/signup?tipo=ANALISTA"
              className="group inline-flex items-center justify-center gap-2 rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/[0.06] px-7 py-3.5 text-sm font-semibold text-[#F4D374] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/[0.12]"
            >
              <UserCheck className="h-4 w-4" />
              Sou analista de licitação
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>

          <p className="mt-6 text-xs text-white/40">
            Empresa: 14 dias grátis · cobrança só após o trial · cancele quando quiser <span className="mx-1.5 text-white/20">|</span> Analista: cadastro gratuito
          </p>

          {/* Linha dourada fina como assinatura */}
          <div className="mx-auto mt-20 h-px w-32 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
        </div>
      </section>
    </div>
  );
}
