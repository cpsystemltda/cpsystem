import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { NavigationProgress } from "@/components/NavigationProgress";
import { contarNaoLidas } from "@/lib/notificacoes";
import { lerVisao, type Visao } from "@/lib/visao";
import { lerEmpresaSelecionada } from "@/lib/empresaContexto";
import { lerEspionagemAtual } from "@/lib/espionagem";
import { BannerEspionagem } from "@/components/BannerEspionagem";

// Rotas que SÓ a empresa acessa (analista é redirecionado pro painel dele)
const ROTAS_SO_EMPRESA = [
  "/dashboard",
  "/operacao",
  "/contratacoes",
  "/atas",
  "/contratos",
  "/execucao",
  "/reajustes",
  "/relatorios",
  "/juridico",
  "/empresas",
  "/vinculos",
  "/conta",
];

// Rotas que SÓ o analista acessa
const ROTAS_SO_ANALISTA = ["/painel-analista"];

// Rotas que continuam acessíveis mesmo com conta bloqueada (paywall)
const ROTAS_PERMITIDAS_INADIMPLENTE = [
  "/conta/assinatura",
  "/conta/checkout",
  "/empresas",
  "/equipe",
  "/termos",
  "/auditoria",
  "/admin",
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Todas as queries/cookies em paralelo — layout não pode bloquear a navegação
  const [usuario, h, empresaSelecionadaCookie, visaoSalva, espionagem] = await Promise.all([
    exigirUsuario(),
    headers(),
    lerEmpresaSelecionada(),
    lerVisao(),
    lerEspionagemAtual(),
  ]);

  const qtdNotificacoes = await contarNaoLidas(usuario.id);

  const empresas = usuario.conta.empresas;
  const principal = empresas[0]?.nomeFantasia || empresas[0]?.razaoSocial || (usuario.conta.tipo === "ANALISTA" ? "Analista" : "Sem empresa cadastrada");
  const tipoConta = usuario.conta.tipo as "EMPRESA" | "ANALISTA";

  const pathname = h.get("x-pathname") || "/";

  const conta = usuario.conta;
  const trialExpirado = conta.statusAssinatura === "TRIAL" && conta.trialAteEm && conta.trialAteEm < new Date();
  const inadimplente = conta.statusAssinatura === "INADIMPLENTE" || conta.statusAssinatura === "CANCELADA";
  const bloqueada = inadimplente || trialExpirado;

  // Paywall só aplica pra contas EMPRESA (analista não paga assinatura)
  const ROTAS_PERMITIDAS_INADIMPLENTE = ["/conta/", "/empresas", "/equipe", "/termos", "/auditoria", "/admin"];
  const rotaPermitidaPaywall = ROTAS_PERMITIDAS_INADIMPLENTE.some((r) => pathname.startsWith(r));

  // Bloqueio cruzado por tipo de conta (super admin nunca bloqueia).
  // Em vez de exibir tela de erro, redirecionamos pra rota inicial do perfil —
  // o usuário nunca cai em "tela não disponível" quando há um destino óbvio.
  const rotaSoEmpresa = ROTAS_SO_EMPRESA.some((r) => pathname.startsWith(r));
  const rotaSoAnalista = ROTAS_SO_ANALISTA.some((r) => pathname.startsWith(r));
  if (!usuario.superAdmin) {
    if (tipoConta === "ANALISTA" && rotaSoEmpresa) redirect("/painel-analista");
    if (tipoConta === "EMPRESA" && rotaSoAnalista) redirect("/dashboard");
  }

  // Rotas operacionais — só fazem sentido quando uma empresa específica está em foco.
  // Em "Todas as empresas" (visão consolidada com 2+ CNPJs) só permitimos Dashboard,
  // Empresas (CNPJs), Conta, Equipe, Notificações, Auditoria etc.
  const ROTAS_OPERACIONAIS_POR_EMPRESA = [
    "/operacao",
    "/contratacoes",
    "/atas",
    "/contratos",
    "/execucao",
    "/reajustes",
    "/relatorios",
    "/juridico",
  ];

  // Empresa em foco (cookie). Validamos contra a lista da conta — se o cookie
  // apontar para uma empresa que não existe mais, cai pra consolidado.
  const empresaIdSelecionada =
    empresaSelecionadaCookie && empresas.some((e) => e.id === empresaSelecionadaCookie)
      ? empresaSelecionadaCookie
      : null;
  const empresasOpcoes = empresas.map((e) => ({
    id: e.id,
    nome: e.nomeFantasia || e.razaoSocial,
  }));

  // Bloqueio operacional consolidado (multi-empresas + nenhuma em foco)
  const consolidadoBloqueado =
    tipoConta === "EMPRESA" &&
    empresas.length > 1 &&
    !empresaIdSelecionada &&
    ROTAS_OPERACIONAIS_POR_EMPRESA.some((r) => pathname.startsWith(r));
  const visao: Visao = usuario.superAdmin
    ? (visaoSalva ?? "ADMIN_PLATAFORMA")
    : tipoConta === "ANALISTA"
    ? "ANALISTA"
    : "EMPRESA";

  return (
    <div className="app-shell flex h-screen flex-col">
      {/* Background atmosférico Liquid Glass — fixed atrás de tudo */}
      <div className="bg-image" aria-hidden />
      <div className="bg-blobs" aria-hidden>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <NavigationProgress />
      {espionagem && <BannerEspionagem contaNome={espionagem.contaNome} />}
      <div className="app-content flex flex-1 w-full overflow-hidden">
        <Sidebar
          nomeUsuario={usuario.nome}
          nomeConta={principal}
          tipoConta={tipoConta}
          visao={visao}
          superAdmin={usuario.superAdmin}
          qtdNotificacoesNaoLidas={qtdNotificacoes}
          empresas={empresasOpcoes}
          empresaIdSelecionada={empresaIdSelecionada}
        />
        <main className="flex-1 overflow-y-auto">
          {tipoConta === "EMPRESA" && bloqueada && !rotaPermitidaPaywall ? (
            <Paywall status={conta.statusAssinatura} trialExpirado={!!trialExpirado} />
          ) : consolidadoBloqueado ? (
            <SelecioneEmpresa />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function SelecioneEmpresa() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-center">
      <div className="glass mx-auto inline-flex h-16 w-16 place-items-center justify-center rounded-full">
        <AlertTriangle className="h-8 w-8" style={{ color: "var(--primary)" }} />
      </div>
      <h1 className="mt-6 text-3xl font-bold" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
        Selecione uma empresa
      </h1>
      <p className="mt-3 text-base" style={{ color: "var(--text-soft)" }}>
        Esta tela mostra dados operacionais de uma empresa específica.
        <br />
        Para acessá-la, escolha qual empresa do grupo está em foco usando o
        seletor no topo da barra lateral.
      </p>
      <p className="mt-6 text-sm" style={{ color: "var(--text-mute)" }}>
        Em &ldquo;Todas as empresas&rdquo;, você só vê o painel consolidado e o cadastro de
        novos CNPJs. Operação dia a dia (Atas, Contratos, Execução etc.) acontece
        sempre dentro de uma empresa específica.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/dashboard" className="btn-primary">
          Voltar ao Dashboard
        </Link>
        <Link href="/empresas" className="btn-secondary">
          Ver empresas (CNPJs)
        </Link>
      </div>
    </div>
  );
}

function Paywall({ status, trialExpirado }: { status: string; trialExpirado: boolean }) {
  const titulo = trialExpirado
    ? "Seu trial gratuito acabou"
    : status === "INADIMPLENTE"
      ? "Sua assinatura está inadimplente"
      : "Sua assinatura foi cancelada";
  const texto = trialExpirado
    ? "Para continuar usando o CP System, ative um plano pago. Seus dados estão preservados."
    : status === "INADIMPLENTE"
      ? "Identificamos cobrança em atraso. Regularize para liberar novamente o acesso aos módulos operacionais."
      : "Reative para continuar gerenciando suas contratações.";

  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-center">
      <div className="glass mx-auto inline-flex h-16 w-16 place-items-center justify-center rounded-full">
        <AlertTriangle className="h-8 w-8" style={{ color: "var(--primary)" }} />
      </div>
      <h1 className="mt-6 text-3xl font-bold" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
        {titulo}
      </h1>
      <p className="mt-3 text-base" style={{ color: "var(--text-soft)" }}>{texto}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/conta/assinatura" className="btn-primary">Ir para Assinatura</Link>
        <Link href="/conta/checkout" className="btn-secondary">Ativar plano</Link>
      </div>
      <p className="mt-12 text-xs" style={{ color: "var(--text-mute)" }}>
        Ainda pode acessar: <strong>Empresas</strong>, <strong>Equipe</strong>, <strong>Termos / LGPD</strong>, <strong>Auditoria</strong>, <strong>Admin</strong> e <strong>Conta</strong>.
      </p>
    </div>
  );
}
