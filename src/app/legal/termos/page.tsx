import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ContratoTermosUso } from "@/components/legal/ContratoTermosUso";

// Rota PUBLICA dos termos (sem auth). Usada no fluxo de signup e no
// footer da landing. A rota interna /(app)/termos usa o mesmo
// componente <ContratoTermosUso> pra manter fonte unica.
export default function LegalTermosPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <header className="border-b py-5" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6">
          <Logo variant="md" />
          <Link
            href="/"
            className="text-xs font-semibold transition hover:opacity-70"
            style={{ color: "var(--text-soft)" }}
          >
            ← Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1
          className="text-3xl font-extrabold"
          style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
        >
          Contrato de Prestação de Serviços & Termos de Uso
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          Documento contratual do CP System — leitura recomendada antes do cadastro.
        </p>

        <div className="mt-10">
          <ContratoTermosUso />
        </div>

        <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
              color: "#0A0A0A",
              letterSpacing: "0.18em",
            }}
          >
            Voltar ao cadastro →
          </Link>
        </div>
      </main>
    </div>
  );
}
