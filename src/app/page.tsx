import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Map,
  ShieldCheck,
  Wallet,
  Bell,
  FileText,
  Layers,
  Zap,
  CheckCircle2,
  Lock,
  Plus,
  Building2,
  Users,
  TrendingUp,
  Crown,
} from "lucide-react";
import { getUsuarioAtual } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export default async function Home() {
  const usuario = await getUsuarioAtual();
  if (usuario) redirect("/dashboard");

  return (
    <div className="bg-white text-[#2D3340] antialiased">
      <Header />
      <Hero />
      <ProvaSocial />
      <ManifestoBlock />
      <FeaturesGrid />
      <DashboardShowcase />
      <ComoFunciona />
      <PricingNubank />
      <FAQ />
      <CTAFinal />
      <Footer />
    </div>
  );
}

// ============================================================
// HEADER
// ============================================================
function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl">
      {/* faixa dourada premium */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Logo variant="md" mode="full" priority />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#manifesto" className="text-sm font-medium text-[#3D434C] transition hover:text-[#9C7A2D]">Por que</a>
          <a href="#features" className="text-sm font-medium text-[#3D434C] transition hover:text-[#9C7A2D]">Sistema</a>
          <a href="#pricing" className="text-sm font-medium text-[#3D434C] transition hover:text-[#9C7A2D]">Planos</a>
          <a href="#faq" className="text-sm font-medium text-[#3D434C] transition hover:text-[#9C7A2D]">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-full px-5 py-2.5 text-sm font-semibold text-[#2D3340] transition hover:bg-[#F5EFE0] sm:inline-block"
          >
            Entrar
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#D4AF37]/30 transition hover:from-[#8B6914] hover:to-[#B8860B]"
          >
            Assinar
          </Link>
        </div>
      </div>
    </header>
  );
}

// ============================================================
// HERO
// ============================================================
function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0C1019] text-white">
      {/* Aura cromática dourada */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-[#D4AF37]/30 via-[#9C7A2D]/20 to-transparent blur-3xl" />
        <div className="absolute -right-20 top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-[#F4D374]/25 via-[#B8860B]/20 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-t from-[#D4AF37]/15 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-32 pt-28 lg:pt-36">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[#F4D374]" />
            <span>IA que extrai sua Ata em segundos · Lei 14.133/2021 nativa</span>
          </div>

          <h1 className="mt-10 text-[3.2rem] font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-7xl md:text-[5.5rem] lg:text-[6.5rem]">
            O fim do <br />
            <span className="bg-gradient-to-r from-[#F4D374] via-[#D4AF37] to-[#B8860B] bg-clip-text text-transparent">
              Excel
            </span>{" "}
            no B2G.
          </h1>

          <p className="mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            CP System é a plataforma premium para empresas que vendem ao governo.
            <span className="text-white"> Atas, contratos, empenhos, comissões, IA jurídica</span>: tudo num só
            lugar, com a inteligência da Contratos Públicos por trás.
          </p>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#F4D374] px-8 py-4 text-base font-bold text-[#1A1206] shadow-2xl shadow-[#D4AF37]/40 transition hover:scale-[1.02] hover:from-[#8B6914] hover:to-[#E8C547]"
            >
              Assine e transforme seu negócio
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a
              href="#dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Ver o sistema
            </a>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            14 dias grátis · sem cartão · cancele quando quiser
          </p>
        </div>

        {/* Mockup do dashboard com moldura dourada premium */}
        <div className="relative mx-auto mt-24 max-w-6xl">
          <div className="absolute -inset-x-10 -inset-y-10 rounded-[2.5rem] bg-gradient-to-b from-[#D4AF37]/25 to-transparent blur-2xl" />
          <div className="relative rotate-[-0.5deg] rounded-[1.75rem] bg-gradient-to-br from-[#F4D374]/60 via-[#D4AF37]/30 to-[#B8860B]/20 p-[1.5px] shadow-[0_30px_80px_-20px_rgba(212,175,55,0.4)] backdrop-blur">
            <div className="rounded-[1.5rem] bg-white p-5 lg:p-7 text-[#2D3340]">
              <div className="flex items-center justify-between border-b border-[#F0E8D2] pb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C7A2D]">
                    Olá Igor
                  </p>
                  <p className="mt-0.5 text-lg font-bold tracking-tight text-[#2D3340]">Dashboard</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-3 py-1.5 text-xs font-semibold text-white">
                  <Plus className="h-3 w-3" /> Nova contratação
                </span>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <MockKpi cor="from-[#3D434C] to-[#1F232B]" titulo="Contratos vigentes" valor="42" />
                <MockKpi cor="from-[#B8860B] to-[#9C7A2D]" titulo="Carteira" valor="R$ 18,4 Mi" />
                <MockKpi cor="from-[#D4AF37] to-[#8B6914]" titulo="Pago em 2026" valor="R$ 6,2 Mi" />
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-[#F0E8D2] p-3 lg:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C7A2D]">
                    Mapa de operações
                  </p>
                  <div className="mt-2 grid h-32 place-items-center rounded-lg bg-gradient-to-br from-[#FFF8E1] via-white to-[#F5EFE0]">
                    <Map className="h-9 w-9 text-[#D4AF37]" />
                  </div>
                </div>
                <div className="rounded-xl border border-[#F0E8D2] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C7A2D]">
                    Posição financeira
                  </p>
                  <div className="mt-3 space-y-2">
                    <MockBar cor="bg-emerald-500" label="Pago" valor="68%" />
                    <MockBar cor="bg-amber-500" label="Pendente" valor="22%" />
                    <MockBar cor="bg-[#D4AF37]" label="Carteira" valor="92%" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MockKpi({ cor, titulo, valor }: { cor: string; titulo: string; valor: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${cor} p-4 text-white shadow-lg`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">{titulo}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{valor}</p>
    </div>
  );
}

function MockBar({ cor, label, valor }: { cor: string; label: string; valor: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-[#3D434C]">
        <span>{label}</span>
        <span className="font-semibold text-[#2D3340]">{valor}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F0E8D2]">
        <div className={`h-full rounded-full ${cor}`} style={{ width: valor }} />
      </div>
    </div>
  );
}

// ============================================================
// PROVA SOCIAL
// ============================================================
function ProvaSocial() {
  return (
    <section className="bg-[#0C1019] pb-24 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
          Pensado por quem opera licitação no Brasil há mais de uma década
        </p>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-y-8 sm:grid-cols-4">
          <Stat valor="R$ 30 mi" label="por cliente / ano" />
          <Stat valor="< 30s" label="pra cadastrar uma Ata" />
          <Stat valor="100%" label="auditável" />
          <Stat valor="3 anos" label="de retorno em compliance" />
        </div>
      </div>
    </section>
  );
}

function Stat({ valor, label }: { valor: string; label: string }) {
  return (
    <div className="text-center">
      <p className="bg-gradient-to-r from-[#F4D374] via-[#D4AF37] to-[#B8860B] bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
        {valor}
      </p>
      <p className="mt-1 text-xs text-white/60">{label}</p>
    </div>
  );
}

// ============================================================
// MANIFESTO
// ============================================================
function ManifestoBlock() {
  return (
    <section id="manifesto" className="bg-white py-32">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9C7A2D]">Manifesto</p>
        <h2 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-[#2D3340] sm:text-6xl md:text-7xl">
          Empresas faturando
          <br />
          milhões, geridas
          <br />
          no <span className="bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#F4D374] bg-clip-text text-transparent">Excel</span>.
        </h2>
        <p className="mt-10 max-w-3xl text-xl leading-relaxed text-[#4A5160] sm:text-2xl">
          Um único cliente real: 5 CNPJs, 40+ contratos, R$ 30 mi/ano em B2G. Operação inteira por
          caixa de e-mail e planilhas improvisadas. <span className="font-semibold text-[#2D3340]">Esse é o padrão do mercado.</span>
        </p>
        <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#4A5160] sm:text-2xl">
          O CP System nasceu para isso: dar a empresas que vendem ao governo o mesmo nível de
          ferramenta que grandes corporações têm, a custo de assinatura mensal, sem licenciamento
          corporativo de R$ 17 mil.
        </p>
      </div>

      {/* Vantagem competitiva — Inteligência Jurídica Nativa */}
      <div className="mt-24 bg-[#0C1019] py-24">
        <div className="mx-auto max-w-5xl px-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F4D374]">
            Vantagem competitiva
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-[#F4D374] via-[#D4AF37] to-[#B8860B] bg-clip-text text-transparent">
              Inteligência Jurídica Nativa.
            </span>
            <br />
            <span className="text-white">O fosso defensivo do CP System.</span>
          </h2>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            O nosso fosso defensivo não é apenas o código.{" "}
            <strong className="text-white">Não somos uma empresa de tecnologia tentando entender de licitação;
            somos especialistas em licitação aplicando tecnologia.</strong>
          </p>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            A plataforma é desenhada sob uma ótica{" "}
            <span className="text-[#F4D374] font-semibold">Legal-Business-driven</span> — orientada para o mundo
            jurídico e empresarial, garantindo que cada funcionalidade entregue
            <span className="text-white"> conformidade legal (compliance)</span> e
            <span className="text-white"> defesa estratégica</span>.
          </p>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Um ativo impossível de ser replicado por empresas de software tradicionais.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/5 p-6 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#F4D374]">
                Lei 14.133/2021
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Cada regra do sistema (vigências, modalidades, prazos, prerrogativas, sanções,
                reajuste, prorrogação, formalização) reflete o texto legal vigente.
              </p>
            </div>
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/5 p-6 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#F4D374]">
                Compliance embutido
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Bloqueios automáticos para movimentos não admitidos pela lei (ex.: contrato
                não-continuado não aceita prorrogação de vigência).
              </p>
            </div>
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-white/5 p-6 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#F4D374]">
                Defesa estratégica
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Notificações, procedimentos apuratórios, garantias e equilíbrio econômico-financeiro
                geridos com cabeça de jurista, não de planilhista.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FEATURES
// ============================================================
function FeaturesGrid() {
  return (
    <section id="features" className="bg-[#FAF6EC] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9C7A2D]">O sistema</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-[#2D3340] sm:text-6xl">
            8 módulos. Zero planilha.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#4A5160]">
            Cada cadastro abate saldo, dispara notificação, alimenta dashboard, gera comissão e cria
            registro auditável. Sem retrabalho, sem dado em duas planilhas.
          </p>
        </div>

        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          <FeatureCard
            icon={Sparkles}
            cor="bg-gradient-to-br from-[#D4AF37] to-[#9C7A2D]"
            titulo="Extração via IA"
            texto="Anexe o PDF da Ata, do Contrato ou do Empenho. Em segundos a IA extrai número, processo, órgão, vigência e itens."
            badge="Novidade"
          />
          <FeatureCard
            icon={Layers}
            cor="bg-gradient-to-br from-[#3D434C] to-[#1F232B]"
            titulo="Saldo travado"
            texto="Cada Contrato e Empenho derivado abate o saldo da Ata. Você nunca vende acima do disponível."
          />
          <FeatureCard
            icon={Map}
            cor="bg-gradient-to-br from-emerald-500 to-teal-700"
            titulo="Mapa nacional"
            texto="Mapa coroplético do Brasil mostra onde estão suas empresas e contratos. Tooltip com KPIs por estado."
          />
          <FeatureCard
            icon={Bell}
            cor="bg-gradient-to-br from-[#B8860B] to-[#8B6914]"
            titulo="Alertas legais"
            texto="Reajuste anual, prescrição quinquenal, defesa em PA. O sistema avisa antes do órgão."
          />
          <FeatureCard
            icon={Wallet}
            cor="bg-gradient-to-br from-[#F4D374] to-[#B8860B]"
            titulo="Comissão automática"
            texto="Painel próprio do analista mostra recebido, a receber e carteira. Cálculo por execução paga, sem disputas."
          />
          <FeatureCard
            icon={Crown}
            cor="bg-gradient-to-br from-[#2D3340] to-[#0C1019]"
            titulo="Multi-perfil"
            texto="Gestor da plataforma vê todos os clientes, MRR e churn. Empresa vê sua operação. Analista vê suas comissões."
          />
          <FeatureCard
            icon={Building2}
            cor="bg-gradient-to-br from-[#9C7A2D] to-[#5A4622]"
            titulo="Multi-CNPJ até 4"
            texto="Gerencie todas as empresas do grupo econômico em uma única assinatura, painel consolidado."
          />
          <FeatureCard
            icon={ShieldCheck}
            cor="bg-gradient-to-br from-rose-500 to-red-600"
            titulo="Auditoria total"
            texto="Cada criação, edição, exclusão, login e upload registrado. LGPD-ready desde o dia zero."
          />
          <FeatureCard
            icon={Users}
            cor="bg-gradient-to-br from-[#D4AF37] to-[#B8860B]"
            titulo="Equipe e papéis"
            texto="Convide responsáveis financeiros, fiscais, comerciais. Cada um vê o que precisa, com permissões."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  cor,
  titulo,
  texto,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  cor: string;
  titulo: string;
  texto: string;
  badge?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white p-7 shadow-sm transition hover:shadow-xl">
      {badge && (
        <span className="absolute right-5 top-5 rounded-full bg-[#FFF8E1] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9C7A2D]">
          {badge}
        </span>
      )}
      <div
        className={`grid h-14 w-14 place-items-center rounded-2xl ${cor} text-white shadow-md transition group-hover:scale-110`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-6 text-xl font-bold tracking-tight text-[#2D3340]">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#4A5160]">{texto}</p>
    </div>
  );
}

// ============================================================
// DASHBOARD SHOWCASE
// ============================================================
function DashboardShowcase() {
  return (
    <section id="dashboard" className="overflow-hidden bg-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9C7A2D]">Dashboard</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-[#2D3340] sm:text-6xl">
            Sua operação inteira
            <br />
            em uma tela.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#4A5160]">
            KPIs grandes, mapa interativo, gráficos de vencimentos, ranking por estado, alertas dos
            próximos 30 dias. Tudo respirando.
          </p>
        </div>

        <div className="mt-20 grid gap-6 lg:grid-cols-12">
          <Showcase
            className="lg:col-span-7"
            cor="from-[#B8860B] via-[#D4AF37] to-[#F4D374]"
            titulo="Mapa de operações"
            texto="Hover em qualquer estado revela quantas empresas, contratos, empenhos e o valor em carteira. Gradient dourado indica concentração."
            icone={Map}
          />
          <Showcase
            className="lg:col-span-5"
            cor="from-emerald-500 to-green-700"
            titulo="Posição financeira"
            texto="Pago × Pendente × Em carteira em barras. Atualizado em tempo real conforme você muda o status do empenho."
            icone={TrendingUp}
          />
          <Showcase
            className="lg:col-span-5"
            cor="from-[#D4AF37] to-[#9C7A2D]"
            titulo="Vencimentos por mês"
            texto="Antecipe renovações e aditivos com até 12 meses de visão."
            icone={FileText}
          />
          <Showcase
            className="lg:col-span-7"
            cor="from-[#3D434C] to-[#0C1019]"
            titulo="Próximos 30 dias"
            texto="Empenhos com prazo próximo, ordenados por urgência. Badges vermelho (≤7d), amarelo (≤15d), cinza (≤30d)."
            icone={Bell}
          />
        </div>
      </div>
    </section>
  );
}

function Showcase({
  className = "",
  cor,
  titulo,
  texto,
  icone: Icone,
}: {
  className?: string;
  cor: string;
  titulo: string;
  texto: string;
  icone: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${cor} p-10 text-white shadow-xl ${className}`}
    >
      <Icone className="h-9 w-9 text-white/90" />
      <h3 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">{texto}</p>
      <Icone className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10" />
    </div>
  );
}

// ============================================================
// COMO FUNCIONA
// ============================================================
function ComoFunciona() {
  return (
    <section className="relative overflow-hidden bg-[#0C1019] py-32 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-[#D4AF37]/25 blur-3xl" />
        <div className="absolute -left-20 bottom-20 h-96 w-96 rounded-full bg-[#9C7A2D]/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F4D374]">Em 3 passos</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Da licitação ganha
            <br />
            ao pagamento.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            Sem planilha, sem caixa de e-mail confusa, sem prazo perdido.
          </p>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          <Passo numero="01" titulo="Anexe o PDF" texto="Em segundos a IA extrai todos os campos: número, processo, órgão, vigência, prazos e a lista completa de itens. Você confere, edita e salva." icone={FileText} />
          <Passo numero="02" titulo="Derive contratos e empenhos" texto="Cada cadastro abate o saldo automaticamente, vincula ao órgão, registra valor por item e dispara comissão pra quem ajudou." icone={Layers} />
          <Passo numero="03" titulo="Acompanhe a execução" texto="Dashboard, mapa e timeline em tempo real. Alertas no app + WhatsApp. Cada mudança de status notifica o analista vinculado." icone={Zap} />
        </div>
      </div>
    </section>
  );
}

function Passo({
  numero,
  titulo,
  texto,
  icone: Icone,
}: {
  numero: string;
  titulo: string;
  texto: string;
  icone: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-[#D4AF37]/20 bg-white/5 p-8 backdrop-blur transition hover:border-[#D4AF37]/40 hover:bg-white/10">
      <div className="flex items-start justify-between">
        <span className="bg-gradient-to-r from-[#F4D374] to-[#D4AF37] bg-clip-text text-5xl font-extrabold text-transparent">
          {numero}
        </span>
        <Icone className="h-7 w-7 text-[#D4AF37]/80" />
      </div>
      <h3 className="mt-8 text-2xl font-bold tracking-tight">{titulo}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{texto}</p>
    </div>
  );
}

// ============================================================
// PRICING
// ============================================================
function PricingNubank() {
  return (
    <section id="pricing" className="bg-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9C7A2D]">Planos</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-[#2D3340] sm:text-6xl">
            Preço transparente.
            <br />
            Sem letra miúda.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#4A5160]">
            14 dias grátis em ambos os planos. Cancele quando quiser. Multi-CNPJ até 4 incluso.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-2">
          <PricingCard
            nome="Básico"
            preco="397"
            sub="por mês"
            descricao="Tudo que sua empresa precisa pra profissionalizar a gestão de contratos públicos."
            destaque={false}
            features={[
              "Multi-CNPJ até 4 (5º+ tem cobrança adicional)",
              "8 módulos integrados",
              "Extração de PDF via IA (ilimitada)",
              "Dashboard premium com mapa interativo",
              "Notificações no app",
              "Painel gratuito pra 1 analista vinculado",
              "Suporte por chat em horário comercial",
            ]}
          />
          <PricingCard
            nome="Premium"
            preco="997"
            sub="por mês"
            descricao="Software + força jurídica de uma das maiores escolas de Direito Administrativo do Brasil."
            destaque
            features={[
              "Tudo do plano Básico, sem limites",
              "12 consultas jurídicas por ano com especialistas",
              "2 peças jurídicas por ano (defesa, recurso, parecer)",
              "Notificações via WhatsApp",
              "Suporte prioritário com SLA",
              "Onboarding assistido",
              "Personalização de relatórios",
            ]}
          />
        </div>

        <p className="mt-10 text-center text-sm text-[#6B7280]">
          Programa de embaixadores: analistas independentes ganham 3% a 6% recorrente por cliente indicado.
        </p>
      </div>
    </section>
  );
}

function PricingCard({
  nome,
  preco,
  sub,
  descricao,
  features,
  destaque,
}: {
  nome: string;
  preco: string;
  sub: string;
  descricao: string;
  features: string[];
  destaque: boolean;
}) {
  return (
    <div
      className={`relative rounded-3xl p-10 ${
        destaque
          ? "bg-gradient-to-br from-[#3D434C] via-[#2D3340] to-[#0C1019] text-white shadow-2xl shadow-[#D4AF37]/30 ring-1 ring-[#D4AF37]/40"
          : "border border-[#E8DCC0] bg-white text-[#2D3340] shadow-sm"
      }`}
    >
      {destaque && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#F4D374] px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#1A1206] shadow-lg">
          Recomendado
        </span>
      )}
      <h3 className={`text-3xl font-extrabold tracking-tight ${destaque ? "text-white" : "text-[#2D3340]"}`}>
        {nome}
      </h3>
      <p className={`mt-3 text-sm ${destaque ? "text-[#E8DCC0]" : "text-[#4A5160]"}`}>{descricao}</p>

      <div className="mt-8 flex items-baseline gap-1">
        <span className={`text-2xl font-medium ${destaque ? "text-[#D4AF37]" : "text-[#9C7A2D]"}`}>R$</span>
        <span className={`text-6xl font-extrabold tracking-tighter ${destaque ? "text-white" : "text-[#2D3340]"}`}>
          {preco}
        </span>
        <span className={`ml-2 text-sm ${destaque ? "text-[#E8DCC0]" : "text-[#6B7280]"}`}>/{sub}</span>
      </div>

      <Link
        href="/signup"
        className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-bold transition ${
          destaque
            ? "bg-gradient-to-r from-[#B8860B] to-[#F4D374] text-[#1A1206] hover:from-[#8B6914] hover:to-[#E8C547]"
            : "bg-[#2D3340] text-white hover:bg-[#1F232B]"
        }`}
      >
        Assinar {nome}
        <ArrowRight className="h-4 w-4" />
      </Link>

      <ul className="mt-10 space-y-4">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm">
            <CheckCircle2
              className={`mt-0.5 h-5 w-5 shrink-0 ${destaque ? "text-[#D4AF37]" : "text-emerald-600"}`}
            />
            <span className={destaque ? "text-[#E8DCC0]" : "text-[#3D434C]"}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// FAQ
// ============================================================
function FAQ() {
  const perguntas = [
    {
      q: "Funciona pra MEI ou empresa pequena?",
      a: "Sim. O plano Básico (R$ 397/mês) atende MEI, ME e EPP. Pensado pra realidade do médio e pequeno fornecedor brasileiro, sem licenciamento corporativo de R$ 17 mil/mês como concorrência.",
    },
    {
      q: "Posso cadastrar várias empresas (CNPJs)?",
      a: "Até 4 CNPJs no mesmo plano, sem custo adicional. A partir do 5º há uma cobrança adicional pequena. Painel consolidado e visão por CNPJ.",
    },
    {
      q: "Como funciona a extração via IA?",
      a: "Você anexa o PDF da Ata, do Contrato ou do Empenho. O sistema usa Claude Haiku 4.5 (Anthropic) pra extrair número, processo, órgão, vigência, prazos e a lista completa de itens em segundos. Você confere, edita e salva. Auditoria registra cada upload.",
    },
    {
      q: "O analista entra no meu sistema?",
      a: "Sim, com painel exclusivo dele e gratuito. Ele vê apenas as empresas que o vincularam, com cálculo automático de comissão por execução paga. Ele só edita o percentual do vínculo, nada mais.",
    },
    {
      q: "Meus dados ficam seguros?",
      a: "Sim. LGPD-ready. Toda ação fica registrada em log de auditoria (quem, quando, de onde). Backup diário. Você é dono dos seus dados e pode exportar a qualquer momento.",
    },
    {
      q: "Como funciona o jurídico do Premium?",
      a: "12 consultas anuais com especialistas em Direito Administrativo da Contratos Públicos + 2 peças por ano: defesa em PA, recurso, contrarrazão ou parecer técnico.",
    },
  ];
  return (
    <section id="faq" className="bg-[#FAF6EC] py-32">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9C7A2D]">FAQ</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-[#2D3340] sm:text-5xl">
            Antes de criar sua conta.
          </h2>
        </div>

        <div className="mt-14 grid gap-3">
          {perguntas.map((p) => (
            <details
              key={p.q}
              className="group rounded-2xl border border-[#E8DCC0] bg-white p-6 transition hover:border-[#D4AF37]/60 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4">
                <span className="text-base font-semibold text-[#2D3340]">{p.q}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#E8DCC0] transition group-open:rotate-45 group-open:border-[#D4AF37] group-open:bg-[#FFF8E1]">
                  <Plus className="h-4 w-4 text-[#3D434C] group-open:text-[#9C7A2D]" />
                </span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-[#4A5160]">{p.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CTA FINAL
// ============================================================
function CTAFinal() {
  return (
    <section className="bg-white px-6 pb-32 pt-12">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0C1019] via-[#1F232B] to-[#3D434C] px-10 py-24 text-center shadow-2xl">
        <div className="pointer-events-none absolute inset-0 -z-0">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#D4AF37]/30 blur-3xl" />
          <div className="absolute -right-10 bottom-10 h-72 w-72 rounded-full bg-[#F4D374]/25 blur-3xl" />
        </div>

        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
            Pronto pra parar de perder
            <br />
            dinheiro com Excel?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-200">
            14 dias grátis, sem cartão. Em 30 minutos você cadastra sua primeira Ata via PDF + IA e
            tem o dashboard rodando.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#F4D374] px-9 py-4 text-base font-bold text-[#1A1206] shadow-2xl shadow-[#D4AF37]/40 transition hover:scale-[1.02] hover:from-[#8B6914] hover:to-[#E8C547]"
            >
              Assine e transforme seu negócio
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-9 py-4 text-base font-medium text-white backdrop-blur transition hover:bg-white/20"
            >
              Já tenho conta
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> LGPD-ready
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Auditoria completa
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Suporte humano em PT-BR
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FOOTER
// ============================================================
function Footer() {
  return (
    <footer className="bg-[#0C1019] py-20 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center">
              <Logo variant="md" mode="full" onDark />
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-slate-400">
              Plataforma premium de gestão pós-licitação. Filial do Grupo Contratos Públicos, uma
              das maiores escolas de Direito Administrativo do Brasil.
            </p>
            <a
              href="https://contratospublicos.com.br"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-white/5 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur transition hover:bg-white/10"
            >
              contratospublicos.com.br
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]/80">Produto</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="#features" className="text-white/70 hover:text-white">Funcionalidades</a></li>
              <li><a href="#dashboard" className="text-white/70 hover:text-white">Dashboard</a></li>
              <li><a href="#pricing" className="text-white/70 hover:text-white">Planos</a></li>
              <li><a href="#faq" className="text-white/70 hover:text-white">FAQ</a></li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]/80">Conta</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/signup" className="text-white/70 hover:text-white">Trial gratuito</Link></li>
              <li><Link href="/login" className="text-white/70 hover:text-white">Entrar</Link></li>
              <li><Link href="/termos" className="text-white/70 hover:text-white">Termos / LGPD</Link></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]/80">Falar com a gente</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="mailto:contato@contratospublicos.com.br" className="text-white/70 hover:text-white">
                  contato@contratospublicos.com.br
                </a>
              </li>
              <li>
                <a href="https://wa.me/556139000000" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">
                  WhatsApp suporte
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-[#D4AF37]/15 pt-8 text-xs text-white/50 md:flex-row">
          <p>© {new Date().getFullYear()} Contratos Públicos System · Todos os direitos reservados</p>
          <p>Hospedado e operado no Brasil · Lei 14.133/2021</p>
        </div>
      </div>
    </footer>
  );
}
