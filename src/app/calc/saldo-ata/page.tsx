import Link from "next/link";
import { Calculator, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { CalcSaldoAtaForm } from "./CalcSaldoAtaForm";

// Calculadora publica de saldo de Ata de Registro de Precos.
// Sem auth — qualquer um acessa. Captura email no fim (depois do calculo).
// SEO target: "como calcular saldo de ata registro de precos" + variacoes.
//
// Regra Lei 14.133: saldo por vigencia SEPARADA (nao cumulativa).
// Esta calculadora calcula saldo de UMA vigencia, demonstrando a logica
// e atraindo o usuario pro sistema completo.

export const metadata = {
  title: "Calculadora de Saldo de Ata · CP System",
  description:
    "Calcule em 30 segundos o saldo disponível da sua Ata de Registro de Preços conforme a Lei 14.133. Grátis, sem cadastro.",
  keywords: "saldo ata registro de preços, lei 14.133, SRP, calculadora",
};

export default function CalcSaldoAtaPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#FAF6EC] via-white to-[#FFF8E1]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-[#9C7A2D]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-12">
        {/* Topo */}
        <div className="mb-12 flex items-center justify-between">
          <Logo variant="md" />
          <Link
            href="/"
            className="text-xs font-semibold text-[#9C7A2D] hover:text-[#7a5c1a]"
          >
            ← Voltar pro site
          </Link>
        </div>

        {/* Hero */}
        <header className="mx-auto max-w-3xl text-center">
          <div
            className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #D4AF37, #9C7A2D)",
              boxShadow: "0 12px 36px rgba(212,175,55,0.4)",
            }}
          >
            <Calculator className="h-8 w-8 text-white" />
          </div>
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.24em", color: "#9C7A2D" }}
          >
            Calculadora grátis · CP System
          </p>
          <h1
            className="mt-4 text-[40px] font-extrabold leading-[1.05] text-[#2D3340]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Calcule o saldo da sua
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #B8860B, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Ata de Registro de Preços
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#3D434C]">
            Em 30 segundos. Conforme a Lei 14.133/2021 — saldo por vigência
            separada (art. 84). Sem cadastro pra calcular.
          </p>
        </header>

        {/* Formulario */}
        <div className="mt-12">
          <CalcSaldoAtaForm />
        </div>

        {/* Explicacao da regra */}
        <section className="mt-16 rounded-3xl bg-white p-8 shadow ring-1 ring-slate-100">
          <h2
            className="text-[22px] font-extrabold text-[#2D3340]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Por que essa calculadora respeita a Lei 14.133
          </h2>
          <div className="mt-5 space-y-4 text-[14px] leading-relaxed text-[#3D434C]">
            <p>
              A Lei 14.133/2021 mudou a regra de saldo de Ata. Antes (Lei 8.666),
              não-executado em 1 vigência <strong>cumulava</strong> com a próxima.
              Agora, cada vigência tem saldo <strong>separado</strong>.
            </p>
            <p>
              Implicação prática: <strong>o que sobrou na 1ª vigência NÃO acumula
              com a 2ª</strong>. Se você executar 70% da 1ª vigência, os 30%
              restantes <strong>são perdidos</strong> quando a 2ª começa.
            </p>
            <p>
              A maioria das planilhas e ERPs genéricos calcula errado, somando
              tudo. <strong>O CP System é o único sistema do mercado</strong> que
              respeita essa regra desde o dia 1.
            </p>
          </div>
        </section>

        {/* CTA pro sistema */}
        <section className="mt-12 rounded-3xl bg-gradient-to-br from-[#2D3340] to-[#1F232B] p-10 text-center text-white">
          <Sparkles className="mx-auto h-10 w-10 text-[#D4AF37]" />
          <h2
            className="mt-5 text-[28px] font-extrabold leading-[1.1]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Tem várias atas pra controlar?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/80">
            O CP System calcula saldo de todas as suas atas, em tempo real,
            por vigência. Mais alertas de prazo, reajuste e IA jurídica.
          </p>
          <Link
            href="/signup"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
          >
            Testar 14 dias grátis
          </Link>
          <p className="mt-3 text-[11px] text-white/60">
            Cartão valida no cadastro — não cobramos no teste.
          </p>
        </section>

        <footer className="mt-16 text-center text-[11px] text-[#9C7A2D]/70">
          CP System · Gestão pós-licitação sob a Lei 14.133/2021
        </footer>
      </div>
    </div>
  );
}
