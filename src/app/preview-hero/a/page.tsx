import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

/**
 * PREVIEW A — Editorial de luxo
 * Inspiração: Hermès, Aesop, joalheria.
 * Hero claro/creme, tipografia serifada (Cinzel), dourado em detalhes finos,
 * muita respiração, ornamentos discretos.
 */
export default function PreviewA() {
  return (
    <div className="bg-[#FAF6EC] text-[#1A1206] antialiased min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#FAF6EC]/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#9C7A2D]/40 to-transparent" />
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
          <Link href="/" className="flex items-center">
            <Logo variant="md" mode="brand" priority />
          </Link>
          <nav className="hidden items-center gap-10 md:flex">
            <a href="#" className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#3D2F12] transition hover:text-[#9C7A2D]">Por que</a>
            <a href="#" className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#3D2F12] transition hover:text-[#9C7A2D]">Sistema</a>
            <a href="#" className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#3D2F12] transition hover:text-[#9C7A2D]">Planos</a>
            <a href="#" className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#3D2F12] transition hover:text-[#9C7A2D]">FAQ</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-[#1A1206] transition hover:text-[#9C7A2D] sm:inline-block"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full border border-[#9C7A2D] bg-transparent px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9C7A2D] transition hover:bg-[#9C7A2D] hover:text-[#FAF6EC]"
            >
              Assinar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Aura dourada bem sutil */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#D4AF37]/8 via-transparent to-transparent blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-8 pb-32 pt-32 text-center">
          {/* Eyebrow editorial — linha + texto pequeno */}
          <div className="mb-12 inline-flex items-center gap-4">
            <span className="h-px w-10 bg-[#9C7A2D]" />
            <span
              className="text-[10px] font-medium uppercase tracking-[0.32em] text-[#9C7A2D]"
              style={{ fontFamily: "var(--font-brand)" }}
            >
              Lei 14.133 · IA jurídica nativa
            </span>
            <span className="h-px w-10 bg-[#9C7A2D]" />
          </div>

          {/* Título serif elegante */}
          <h1
            className="text-[3rem] font-normal leading-[1.05] tracking-[-0.01em] text-[#1A1206] sm:text-6xl md:text-[5rem]"
            style={{ fontFamily: "var(--font-brand)" }}
          >
            O fim do <em className="not-italic text-[#9C7A2D]">Excel</em>
            <br />
            no B2G.
          </h1>

          {/* Subtítulo curto */}
          <p className="mx-auto mt-12 max-w-xl text-base leading-relaxed text-[#3D2F12]/70 sm:text-lg">
            A plataforma premium para empresas que vendem ao governo.
            Atas, contratos, empenhos e IA jurídica — em um só lugar.
          </p>

          {/* CTAs minimalistas */}
          <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 rounded-full bg-[#1A1206] px-10 py-4 text-sm font-medium uppercase tracking-[0.16em] text-[#FAF6EC] transition hover:bg-[#9C7A2D]"
            >
              Assinar
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a
              href="#"
              className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-[#1A1206] transition hover:text-[#9C7A2D]"
            >
              Ver o sistema →
            </a>
          </div>

          {/* Nota fineline */}
          <p className="mt-12 text-[11px] uppercase tracking-[0.22em] text-[#9C7A2D]/70">
            14 dias grátis · sem cartão · cancele quando quiser
          </p>

          {/* Ornamento divisor */}
          <div className="mx-auto mt-24 flex max-w-xs items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#9C7A2D]/30" />
            <span className="h-1.5 w-1.5 rotate-45 bg-[#9C7A2D]" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#9C7A2D]/30" />
          </div>
        </div>
      </section>
    </div>
  );
}
