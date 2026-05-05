import { headers } from "next/headers";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { contarNaoLidas } from "@/lib/notificacoes";
import { lerVisao, type Visao } from "@/lib/visao";
import { lerEmpresaSelecionada } from "@/lib/empresaContexto";

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
  const [usuario, h, empresaSelecionadaCookie, visaoSalva] = await Promise.all([
    exigirUsuario(),
    headers(),
    lerEmpresaSelecionada(),
    lerVisao(),
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

  // Bloqueio cruzado por tipo de conta (super admin nunca bloqueia)
  const rotaSoEmpresa = ROTAS_SO_EMPRESA.some((r) => pathname.startsWith(r));
  const rotaSoAnalista = ROTAS_SO_ANALISTA.some((r) => pathname.startsWith(r));
  const acessoErrado = usuario.superAdmin
    ? false
    : (tipoConta === "ANALISTA" && rotaSoEmpresa) || (tipoConta === "EMPRESA" && rotaSoAnalista);

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
    <div className="flex h-screen">
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
      <main className="flex-1 overflow-y-auto bg-slate-50/60">
        {acessoErrado ? (
          <AcessoNegado tipoConta={tipoConta} />
        ) : tipoConta === "EMPRESA" && bloqueada && !rotaPermitidaPaywall ? (
          <Paywall status={conta.statusAssinatura} trialExpirado={!!trialExpirado} />
        ) : consolidadoBloqueado ? (
          <SelecioneEmpresa />
        ) : (
          children
        )}
      </main>
    </div>
  );
}

function AcessoNegado({ tipoConta }: { tipoConta: "EMPRESA" | "ANALISTA" }) {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Esta tela não está disponível pra sua conta</h1>
      <p className="mt-3 text-sm text-slate-600">
        Sua conta é do tipo <strong>{tipoConta}</strong>. Use o menu lateral pra acessar suas funcionalidades.
      </p>
      <Link
        href={tipoConta === "ANALISTA" ? "/painel-analista" : "/dashboard"}
        className="mt-6 inline-block rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Ir pra minha tela inicial
      </Link>
    </div>
  );
}

function SelecioneEmpresa() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blue-100">
        <AlertTriangle className="h-8 w-8 text-blue-700" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">Selecione uma empresa</h1>
      <p className="mt-3 text-base text-slate-600">
        Esta tela mostra dados operacionais de uma empresa específica.
        <br />
        Para acessá-la, escolha qual empresa do grupo está em foco usando o
        seletor verde no topo da barra lateral.
      </p>
      <p className="mt-6 text-sm text-slate-500">
        Em &ldquo;Todas as empresas&rdquo;, você só vê o painel consolidado e o cadastro de
        novos CNPJs. Operação dia a dia (Atas, Contratos, Execução etc.) acontece
        sempre dentro de uma empresa específica.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/dashboard" className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          Voltar ao Dashboard
        </Link>
        <Link href="/empresas" className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100">
        <AlertTriangle className="h-8 w-8 text-amber-700" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">{titulo}</h1>
      <p className="mt-3 text-base text-slate-600">{texto}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/conta/assinatura" className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          Ir para Assinatura
        </Link>
        <Link href="/conta/checkout" className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Ativar plano
        </Link>
      </div>
      <p className="mt-12 text-xs text-slate-500">
        Ainda pode acessar: <strong>Empresas</strong>, <strong>Equipe</strong>, <strong>Termos / LGPD</strong>, <strong>Auditoria</strong>, <strong>Admin</strong> e <strong>Conta</strong>.
      </p>
    </div>
  );
}
