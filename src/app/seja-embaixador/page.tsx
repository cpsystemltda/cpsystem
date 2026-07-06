import Link from "next/link";
import { Crown, Sparkles, ArrowRight, TrendingUp, Coins, Users, Infinity as InfinityIcon } from "lucide-react";
import { Logo } from "@/components/Logo";

// Landing publica do Programa de Embaixador. Sem auth — qualquer um
// pode abrir. CTA principal: cadastrar-se como Analista (que automaticamente
// vira elegivel pra ganhar comissao indicando empresas).
//
// Modelo de comissao (Regina 03/07/2026): R$ 29,90 FIXO por vinculo ativo,
// recorrente vitalicio. Nao e mais % escalonado.
export default function SejaEmbaixadorPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#FAF6EC] via-white to-[#FFF8E1]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-[#9C7A2D]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        {/* Topo: logo + voltar */}
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
            <Crown className="h-8 w-8 text-white" />
          </div>
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.24em", color: "#9C7A2D" }}
          >
            Programa de Embaixador · CP System
          </p>
          <h1
            className="mt-4 text-[44px] font-extrabold leading-[1.05] text-[#2D3340]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Ganhe{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #B8860B, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              R$ 29,90 por cliente
            </span>
            <br />
            todo mês. Pra sempre.
          </h1>
          <p
            className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-[#3D434C]"
          >
            Se você é analista de licitação ou consultor de empresas que vendem ao
            governo, indique o CP System pros seus clientes e receba{" "}
            <strong>R$ 29,90 por cada empresa vinculada</strong> — todo mês, enquanto ela continuar
            assinando. Sem tiers, sem metas, sem letra miúda.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/signup?tipo=ANALISTA"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
            >
              Quero ser um analista parceiro <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-[#2D3340] hover:bg-slate-50"
            >
              Já sou analista
            </Link>
          </div>
        </header>

        {/* Como funciona — 3 passos */}
        <section className="mt-20 grid gap-5 md:grid-cols-3">
          <Passo
            n="1"
            icon={Users}
            titulo="Cadastre-se como analista"
            desc="Gratuito. Você vira analista no sistema e ganha um link pessoal de indicação."
          />
          <Passo
            n="2"
            icon={Sparkles}
            titulo="Indique empresas"
            desc="Compartilhe seu link com empresas que vendem ao governo. Elas se cadastram via ele."
          />
          <Passo
            n="3"
            icon={Coins}
            titulo="Receba R$ 29,90/mês por vínculo"
            desc="A partir da 1ª fatura paga pela empresa, R$ 29,90 caem na sua conta todo mês. Enquanto ela pagar."
          />
        </section>

        {/* Projeções — escalabilidade */}
        <section className="mt-20">
          <p
            className="text-center text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "#9C7A2D" }}
          >
            Renda passiva escalável
          </p>
          <h2
            className="mt-3 text-center text-[32px] font-extrabold text-[#2D3340]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Quanto mais empresas indica,
            <br />mais você fatura sem esforço extra
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[14px] text-[#5D6470]">
            R$ 29,90 por cada cliente ativo, todo mês. Simples de calcular, simples de escalar.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-5">
            <Projecao clientes={5} valor="149,50" rotulo="Comissão inicial" />
            <Projecao clientes={10} valor="299,00" rotulo="Renda extra sólida" />
            <Projecao clientes={25} valor="747,50" rotulo="Meio salário passivo" destaque />
            <Projecao clientes={50} valor="1.495,00" rotulo="1 salário mínimo" />
            <Projecao clientes={100} valor="2.990,00" rotulo="Renda profissional" />
          </div>

          <p className="mt-6 text-center text-[12px] text-[#5D6470]">
            <InfinityIcon className="mr-1 inline-block h-3.5 w-3.5" />
            <strong>Recorrente vitalício</strong> — enquanto o cliente permanecer assinante do CP System, você recebe.
          </p>
        </section>

        {/* Bônus destaque */}
        <section className="mt-20 rounded-3xl bg-gradient-to-br from-[#FFF8E1] via-white to-[#FAF6EC] p-10 ring-1 ring-[#D4AF37]/30">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <p
                className="text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.22em", color: "#9C7A2D" }}
              >
                Bônus de ativação
              </p>
              <h2
                className="mt-3 text-[28px] font-extrabold text-[#2D3340]"
                style={{ letterSpacing: "-0.03em" }}
              >
                <span
                  style={{
                    background: "linear-gradient(135deg, #B8860B, #D4AF37)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  + R$ 500 fixos
                </span>
                <br />
                na 1ª fatura paga de cada indicação
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#3D434C]">
                Além dos R$ 29,90 recorrentes, você recebe um bônus de <strong>R$ 500 no primeiro
                pagamento</strong> de cada empresa que se cadastrar pelo seu link. Independe do plano
                que ela contrate.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-md">
              <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.2em", color: "#9C7A2D" }}>
                Exemplo · 1 cliente novo
              </p>
              <ul className="mt-4 space-y-2 text-[13px] text-[#3D434C]">
                <li className="flex items-baseline justify-between border-b border-slate-100 pb-2">
                  <span>Bônus de ativação (1x)</span>
                  <strong className="text-[#2D3340]">R$ 500,00</strong>
                </li>
                <li className="flex items-baseline justify-between border-b border-slate-100 pb-2">
                  <span>Comissão recorrente (12 meses)</span>
                  <strong className="text-[#2D3340]">R$ 358,80</strong>
                </li>
                <li className="flex items-baseline justify-between pt-1">
                  <span className="font-bold">1º ano · total</span>
                  <strong
                    className="text-[16px]"
                    style={{
                      background: "linear-gradient(135deg, #B8860B, #D4AF37)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    R$ 858,80
                  </strong>
                </li>
              </ul>
              <p className="mt-3 text-[10px] text-[#5D6470]">
                E os R$ 29,90 continuam nos meses seguintes, ano após ano.
              </p>
            </div>
          </div>
        </section>

        {/* Pra quem é */}
        <section className="mt-20 rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-100">
          <h2
            className="text-[28px] font-extrabold text-[#2D3340]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Pra quem é esse programa
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <ParaQuem
              titulo="Analistas de licitação"
              desc="Você já atende empresas que vendem ao governo. Indique o CP System e some uma renda recorrente sobre a base que você já tem."
            />
            <ParaQuem
              titulo="Consultores e advogados de Direito Administrativo"
              desc="Quem trabalha com Lei 14.133 conhece empresas que precisam de gestão pós-licitação. Ganhe R$ 29,90/mês por cada uma."
            />
            <ParaQuem
              titulo="Contadores especializados em empresas B2G"
              desc="Empresas que vendem ao governo precisam de controle financeiro de contratos públicos — você indica, elas resolvem."
            />
            <ParaQuem
              titulo="Profissionais com rede no setor público"
              desc="Se você fala com empresas fornecedoras, vale a pena. CP System é a solução técnica que falta na operação delas."
            />
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-20 rounded-3xl bg-gradient-to-br from-[#2D3340] to-[#1F232B] p-12 text-center text-white">
          <TrendingUp className="mx-auto h-10 w-10 text-[#D4AF37]" />
          <h2
            className="mt-5 text-[32px] font-extrabold leading-[1.1]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Comece hoje. Ganhe pra sempre.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/80">
            Cadastro gratuito. Sem mensalidade. Sem letra miúda. Você se torna analista no sistema e
            recebe seu link pessoal de indicação imediatamente.
          </p>
          <Link
            href="/signup?tipo=ANALISTA"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
          >
            Quero meu link de indicação <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <footer className="mt-16 text-center text-[11px] text-[#9C7A2D]/70">
          CP System · Gestão pós-licitação sob a Lei 14.133/2021
        </footer>
      </div>
    </div>
  );
}

function Passo({
  n,
  icon: Icon,
  titulo,
  desc,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, #B8860B, #D4AF37)" }}
        >
          {n}
        </span>
        <Icon className="h-5 w-5 text-[#9C7A2D]" />
      </div>
      <h3 className="mt-4 text-[16px] font-extrabold text-[#2D3340]">{titulo}</h3>
      <p className="mt-2 text-[13px] text-[#5D6470]">{desc}</p>
    </div>
  );
}

function Projecao({
  clientes,
  valor,
  rotulo,
  destaque,
}: {
  clientes: number;
  valor: string;
  rotulo: string;
  destaque?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-white p-5 text-center"
      style={
        destaque
          ? { boxShadow: "0 0 0 2px #D4AF37, 0 10px 30px rgba(212,175,55,0.15)" }
          : { boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }
      }
    >
      {destaque && (
        <span
          className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-white"
          style={{ background: "linear-gradient(135deg, #B8860B, #D4AF37)", letterSpacing: "0.16em" }}
        >
          Foco
        </span>
      )}
      <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "#5D6470" }}>
        {clientes} clientes
      </p>
      <p className="mt-3 text-[11px] uppercase text-[#9C7A2D]" style={{ letterSpacing: "0.14em" }}>
        R$
      </p>
      <p className="text-[26px] font-extrabold leading-none text-[#2D3340]" style={{ letterSpacing: "-0.03em" }}>
        {valor}
      </p>
      <p className="mt-1 text-[10px] uppercase text-[#5D6470]" style={{ letterSpacing: "0.14em" }}>
        /mês
      </p>
      <p className="mt-3 text-[11px] leading-tight text-[#5D6470]">{rotulo}</p>
    </div>
  );
}

function ParaQuem({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <div className="rounded-xl bg-[#FAF6EC]/50 p-5">
      <h3 className="text-[15px] font-extrabold text-[#2D3340]">{titulo}</h3>
      <p className="mt-2 text-[13px] text-[#5D6470]">{desc}</p>
    </div>
  );
}
