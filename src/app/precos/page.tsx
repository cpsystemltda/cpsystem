import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";

// Pagina publica de precos transparente — sem auth, sem login obrigatorio.
// Regina (08/06): cliente precisa ver preco ANTES de criar conta. Hoje
// o preco so aparece dentro do signup, quebrando confianca.

export default function PrecosPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#FAF6EC] via-white to-[#FFF8E1]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-[#9C7A2D]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
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
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.24em", color: "#9C7A2D" }}
          >
            Planos transparentes
          </p>
          <h1
            className="mt-4 text-[44px] font-extrabold leading-[1.05] text-[#2D3340]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Escolha seu plano e
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #B8860B, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              comece em 14 dias grátis.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-[#3D434C]">
            Cartão validado no cadastro — <strong>não cobramos durante o teste</strong>.
            Cancela com 1 clique antes do 14º dia, sem fidelidade, sem letra miúda.
          </p>
        </header>

        {/* 3 planos */}
        <section className="mt-16 grid gap-5 md:grid-cols-3">
          {/* BÁSICO */}
          <PlanoCard
            nome="Básico"
            preco="R$ 397"
            descricao="Pra empresa com 1 CNPJ que precisa controlar contratos públicos."
            cta="Começar trial grátis"
            features={[
              "1 CNPJ incluso · CNPJ adicional: R$ 39,90/mês cada",
              "Atas, Contratos e Empenhos ilimitados",
              "Alertas automáticos de prazo, pagamento e reajuste",
              "Saldo de Ata por vigência separada (Lei 14.133)",
              "Histórico de execução com timeline",
              "Suporte por email e chat (4h dia útil)",
              "10 perguntas IAsystem / mês",
            ]}
          />

          {/* PREMIUM (destaque) */}
          <PlanoCard
            destaque
            nome="Premium"
            preco="R$ 997"
            descricao="Pra empresa com múltiplos CNPJs ou que precisa de IA jurídica completa."
            cta="Começar trial grátis"
            features={[
              "Múltiplas empresas (CNPJs ilimitados)",
              "Tudo do Básico, sem limite",
              "IAsystem ilimitado — parecer jurídico em 30s",
              "Análise jurídica de PDF (Ata, Contrato, Aditivo, Apostilamento)",
              "Painel financeiro consolidado multi-empresa",
              "Programa de vínculo com analista parceiro",
              "Suporte prioritário (4h dia útil)",
            ]}
          />

          {/* CORPORATIVO */}
          <PlanoCard
            nome="Corporativo"
            preco="R$ 2.497"
            descricao="Pra empresas grandes com operação intensa em contratos públicos."
            cta="Falar com vendas"
            ctaHref="https://cpsystem-three.vercel.app/signup"
            features={[
              "Tudo do Premium",
              "Relatório jurídico IA aprofundado mensal (escopo personalizado)",
              "Multi-empresa ilimitado",
              "SLA de resposta em 4h dia útil garantido",
              "Suporte prioritário 24h via WhatsApp",
              "Onboarding guiado",
              "Workshop trimestral de melhores práticas Lei 14.133",
            ]}
          />
        </section>

        {/* FAQ rápido */}
        <section className="mt-16">
          <h2
            className="text-center text-[28px] font-extrabold text-[#2D3340]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Perguntas frequentes
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <FaqItem
              p="Preciso de cartão pra começar o trial?"
              r="Sim. Validamos o cartão no cadastro, mas NÃO cobramos durante os 14 dias. A cobrança automática só rola no 15º dia. Pode cancelar com 1 clique antes."
            />
            <FaqItem
              p="O que acontece se eu cancelar?"
              r="Você mantém acesso até o final do período pago. Dados ficam disponíveis em arquivo morto por 12 meses caso queira voltar."
            />
            <FaqItem
              p="Tem fidelidade ou multa?"
              r="Não. Mensal puro. Cancele quando quiser. A cobrança anual tem desconto, mas é opcional — não exigimos compromisso."
            />
            <FaqItem
              p="Posso mudar de plano depois?"
              r="Sim, a qualquer momento. Upgrade libera os recursos na hora; downgrade entra em vigor no próximo ciclo."
            />
            <FaqItem
              p="A IA jurídica substitui meu advogado?"
              r="Não. Ela acelera análise rotineira (cláusulas, prazos, conformidade básica). Decisões críticas devem passar pelo seu jurídico."
            />
            <FaqItem
              p="Quem mantém o sistema sob Lei 14.133?"
              r="O CP System é desenvolvido com conselho técnico jurídico permanente em Lei 14.133/2021 e atualizado a cada decisão relevante do TCU/STJ."
            />
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-20 rounded-3xl bg-gradient-to-br from-[#2D3340] to-[#1F232B] p-12 text-center text-white">
          <Sparkles className="mx-auto h-10 w-10 text-[#D4AF37]" />
          <h2
            className="mt-5 text-[32px] font-extrabold leading-[1.1]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Pronto pra parar de esquecer prazo?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/80">
            14 dias grátis. Cancela com 1 clique. Sem letra miúda.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
          >
            Começar agora <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <footer className="mt-16 text-center text-[11px] text-[#9C7A2D]/70">
          CP System · Gestão pós-licitação sob a Lei 14.133/2021
        </footer>
      </div>
    </div>
  );
}

function PlanoCard({
  nome,
  preco,
  descricao,
  cta,
  ctaHref,
  features,
  destaque,
}: {
  nome: string;
  preco: string;
  descricao: string;
  cta: string;
  ctaHref?: string;
  features: string[];
  destaque?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-7 transition ${
        destaque
          ? "shadow-2xl"
          : "shadow-md ring-1 ring-slate-100"
      }`}
      style={{
        background: destaque
          ? "linear-gradient(180deg, #FFFFFF 0%, #FFF8E1 100%)"
          : "white",
        boxShadow: destaque
          ? "0 0 0 2px #D4AF37, 0 20px 50px rgba(212,175,55,0.15)"
          : undefined,
      }}
    >
      {destaque && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white"
          style={{
            background: "linear-gradient(135deg, #B8860B, #D4AF37)",
            letterSpacing: "0.18em",
          }}
        >
          ⭐ mais escolhido
        </div>
      )}

      <h3
        className="text-[14px] font-bold uppercase"
        style={{ letterSpacing: "0.16em", color: "#9C7A2D" }}
      >
        {nome}
      </h3>

      <p
        className="mt-3 text-[42px] font-extrabold leading-none text-[#2D3340]"
        style={{ letterSpacing: "-0.04em" }}
      >
        {preco}
        <span className="text-[16px] font-semibold text-[#5D6470]"> /mês</span>
      </p>

      <p className="mt-3 text-[13px] text-[#5D6470] min-h-[40px]">{descricao}</p>

      <Link
        href={ctaHref || "/signup"}
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition ${
          destaque
            ? "bg-gradient-to-r from-[#B8860B] to-[#D4AF37] text-white shadow-lg hover:opacity-90"
            : "border-2 border-[#2D3340] text-[#2D3340] hover:bg-[#2D3340] hover:text-white"
        }`}
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>

      <ul className="mt-7 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[#3D434C]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#B8860B]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FaqItem({ p, r }: { p: string; r: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow ring-1 ring-slate-100">
      <p className="text-[15px] font-extrabold text-[#2D3340]">{p}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#5D6470]">{r}</p>
    </div>
  );
}
