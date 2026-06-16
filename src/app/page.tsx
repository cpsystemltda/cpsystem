import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, DollarSign, FileCheck2, Truck, Users, Brain } from "lucide-react";
import { getUsuarioAtual } from "@/lib/auth";
import { Logo } from "@/components/Logo";

// Pagina inicial publica (Regina 16/06): hero "Plataforma Premium" + 5 cards
// brancos com icone em quadradinho dourado palido. EXATAMENTE como a imagem
// de referencia. Login esta numa rota separada (/login).
export default async function Home() {
  const usuario = await getUsuarioAtual();
  if (usuario) redirect("/dashboard");

  return (
    <div className="relative min-h-screen antialiased">
      {/* Fundo claro com textura geometrica sutil de circunferencias */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23C5A24B' stroke-width='0.5' opacity='0.07'%3E%3Ccircle cx='120' cy='120' r='40'/%3E%3Ccircle cx='120' cy='80' r='40'/%3E%3Ccircle cx='120' cy='160' r='40'/%3E%3Ccircle cx='85.36' cy='100' r='40'/%3E%3Ccircle cx='85.36' cy='140' r='40'/%3E%3Ccircle cx='154.64' cy='100' r='40'/%3E%3Ccircle cx='154.64' cy='140' r='40'/%3E%3C/g%3E%3C/svg%3E\"), linear-gradient(180deg, #FFFFFF 0%, #FAF6EB 60%, #F2E9CF 100%)",
          backgroundSize: "240px 240px, auto",
          backgroundRepeat: "repeat, no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      {/* ============== HEADER ============== */}
      <header className="relative z-[3] w-full">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-8 pt-7 pb-4">
          <Link href="/" className="flex items-center">
            <Logo variant="md" mode="brand" priority />
          </Link>
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
            <Link
              href="/login"
              className="text-[13px] font-semibold text-[#3A3A3A] transition hover:opacity-70"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                color: "#1A1A1F",
                letterSpacing: "0.18em",
                boxShadow:
                  "0 8px 22px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              Assinar
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-[2] mx-auto max-w-[1320px] px-8">
        {/* ============== HERO ============== */}
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
                boxShadow:
                  "0 14px 36px -8px rgba(168,137,71,0.55), inset 0 1px 0 rgba(255,255,255,0.5)",
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

        {/* ============== 5 CARDS BRANCOS COM ICONE EM QUADRADINHO ============== */}
        <section id="sistema" className="pb-20">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <FeatureCard
              icone={DollarSign}
              titulo="Controle financeiro"
              descricao="Valores contratados, executados, a executar, recebidos e a receber."
            />
            <FeatureCard
              icone={FileCheck2}
              titulo="Controle de contratações"
              descricao="Contratos, atas e empenhos vigentes, expirados, a expirar."
            />
            <FeatureCard
              icone={Truck}
              titulo="Controle logístico"
              descricao="Esteira de entrega/execução com agenda, controle de prazos e alertas."
            />
            <FeatureCard
              icone={Users}
              titulo="Controle de clientes"
              descricao="Órgãos atendidos, locais de entrega/execução."
            />
            <FeatureCard
              icone={Brain}
              titulo="Inteligência jurídica nativa"
              descricao="Alimentação de dados, cálculo de reajustes e tira-dúvidas."
            />
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
    </div>
  );
}

// ============================================================
// Card branco com icone em quadradinho dourado palido
// ============================================================
function FeatureCard({
  icone: Icone,
  titulo,
  descricao,
}: {
  icone: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  titulo: string;
  descricao: string;
}) {
  return (
    <div
      className="rounded-[20px] bg-white px-6 py-7"
      style={{
        border: "0.5px solid rgba(168,137,71,0.18)",
        boxShadow: "0 12px 28px -14px rgba(20,16,8,0.12), 0 2px 6px -2px rgba(20,16,8,0.04)",
      }}
    >
      <div
        className="grid h-11 w-11 place-items-center rounded-[12px]"
        style={{ background: "rgba(212,175,55,0.18)" }}
      >
        <Icone
          className="h-5 w-5"
          style={{ color: "#A88947" }}
          strokeWidth={2}
        />
      </div>
      <h3 className="mt-5 text-[16px] font-extrabold leading-tight tracking-tight text-[#1A1A1F]">
        {titulo}
      </h3>
      <p className="mt-3 text-[13.5px] leading-relaxed text-[#5A5A5A]">{descricao}</p>
    </div>
  );
}
