import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { NavigationProgress } from "@/components/NavigationProgress";
import { contarNaoLidas } from "@/lib/notificacoes";
import { SinoNotificacoes } from "@/components/SinoNotificacoes";
import { lerVisao, type Visao } from "@/lib/visao";
import { lerEmpresaSelecionada } from "@/lib/empresaContexto";
import { lerEspionagemAtual } from "@/lib/espionagem";
import { BannerEspionagem } from "@/components/BannerEspionagem";
import { FlutuanteIAsystem } from "@/components/FlutuanteIAsystem";
import { ComandoRapido } from "@/components/ComandoRapido";
import { SemAcessoModulo } from "@/components/SemAcessoModulo";
import { moduloDaRota, podeAcessarModulo } from "@/lib/modulosAcesso";
import { avaliarBloqueio } from "@/lib/bloqueio";
import { AvisoUltimoDiaTrial } from "@/components/AvisoUltimoDiaTrial";

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

// Rotas que continuam acessíveis com a conta bloqueada por falta de pagamento.
// Regina 24/08 apertou a régua: sem pagamento, o cliente não opera o sistema.
// Sobra o que ele precisa pra pagar (tudo em /conta) e o contrato.
const ROTAS_PERMITIDAS_INADIMPLENTE = ["/conta/", "/termos"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Todas as queries/cookies em paralelo — layout não pode bloquear a navegação
  const [usuario, h, empresaSelecionadaCookie, visaoSalva, espionagem] = await Promise.all([
    exigirUsuario(),
    headers(),
    lerEmpresaSelecionada(),
    lerVisao(),
    lerEspionagemAtual(),
  ]);

  // Onboarding pendente: usuario migrado ou com dados incompletos precisa
  // completar cadastro pessoal antes de acessar (Regina 02/07).
  // Super admin escapa (nao passa por wizard).
  const pathnameAtual = h.get("x-pathname") || "/";
  if (!usuario.superAdmin && !pathnameAtual.startsWith("/onboarding")) {
    const perfilUsuario = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { onboardingConcluido: true },
    });
    if (perfilUsuario && !perfilUsuario.onboardingConcluido) {
      redirect("/onboarding");
    }
  }

  const qtdNotificacoes = await contarNaoLidas(usuario.id);
  // Últimos avisos pro sino. Oito é o que cabe no painel sem virar rolagem
  // infinita — o resto fica na tela de notificações.
  const avisosRecentes = await prisma.notificacaoSistema.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 8,
    select: { id: true, titulo: true, descricao: true, link: true, lida: true, criadoEm: true },
  });

  const empresas = usuario.conta.empresas;
  const principal = empresas[0]?.nomeFantasia || empresas[0]?.razaoSocial || (usuario.conta.tipo === "ANALISTA" ? "Analista" : "Sem empresa cadastrada");
  const tipoConta = usuario.conta.tipo as "EMPRESA" | "ANALISTA";

  const pathname = h.get("x-pathname") || "/";

  const conta = usuario.conta;
  // Bloqueio por falta de pagamento: 3 dias de atraso travam o uso. A regra
  // mora em `@/lib/bloqueio` porque a tela de assinatura precisa dela também.
  // Super admin nunca bloqueia — senão a plataforma fica sem operação.
  const bloqueio = usuario.superAdmin
    ? { bloqueada: false, motivo: null }
    : await avaliarBloqueio(conta);
  const bloqueada = bloqueio.bloqueada;

  // Regina 13/07: se conta EMPRESA nao tem subscription Asaas (signup antigo),
  // manda direto pra tela de completar cadastro em vez de mostrar Paywall.
  // Aplica pra qualquer TRIAL sem subscription, expirado ou nao (assim o Léo
  // e outros TRIAL antigos ativam recorrencia antes do trial terminar).
  //
  // Regina 24/08: `diaVencimento` preenchido significa que o cliente JA passou
  // por essa tela e escolheu como pagar. Sem essa condicao, quem escolhia PIX
  // (que nao gera assinatura no gateway) voltava pro funil do cartao em toda
  // navegacao — inclusive quando ia justamente pagar o PIX em /conta/assinatura.
  //
  // Regina 24/08, regra final do trial:
  //   "No 14º dia eu já tenho que exigir o cartão. E no 15º dia, se a pessoa não
  //    tiver cadastrado, ela não consegue navegar pelas funcionalidades, e a
  //    mensagem de pagamento fica aparecendo pra ela."
  //
  // Traduzindo pro código:
  //   - até o 13º dia: usa o sistema inteiro, sem interrupção;
  //   - 14º dia (último do teste): aviso fixo em toda tela cobrando a forma de
  //     pagamento — exige, mas não trava, senão o 15º dia não seria a virada;
  //   - 15º dia em diante sem forma de pagamento: acesso travado e todo caminho
  //     leva pra tela de pagamento.
  const semFormaDePagamento =
    !conta.gatewaySubscriptionId && conta.diaVencimento === null;
  const msAteFimDoTrial = conta.trialAteEm ? conta.trialAteEm.getTime() - Date.now() : null;
  const ultimoDiaDoTrial =
    msAteFimDoTrial !== null && msAteFimDoTrial > 0 && msAteFimDoTrial <= 86400000;
  const exigirFormaDePagamento =
    tipoConta === "EMPRESA" &&
    !usuario.superAdmin &&
    conta.statusAssinatura === "TRIAL" &&
    semFormaDePagamento &&
    ultimoDiaDoTrial;

  // O funil que empurra pra tela de pagamento só entra quando o teste ACABOU —
  // antes disso o cliente navega normalmente (no último dia ele vê o aviso).
  const precisaCompletarCadastro =
    tipoConta === "EMPRESA" &&
    !usuario.superAdmin &&
    conta.statusAssinatura === "TRIAL" &&
    semFormaDePagamento &&
    msAteFimDoTrial !== null &&
    msAteFimDoTrial <= 0;
  if (precisaCompletarCadastro && !pathname.startsWith("/conta/completar-cadastro") && !pathname.startsWith("/termos") && !pathname.startsWith("/api")) {
    redirect("/conta/completar-cadastro");
  }

  // Quem administra a plataforma é obrigado a usar segundo fator (Regina 28/08).
  //
  // O 2FA já existia completo — aplicativo autenticador, códigos de recuperação
  // e dispositivos conhecidos — mas era opcional, inclusive pra quem enxerga
  // TODOS os clientes. Uma senha vazada dessas contas é um vazamento de base
  // inteira, não de uma conta.
  //
  // A trava deixa passar /conta/seguranca (onde se ativa), /termos e /api pra
  // ninguém ficar sem caminho de saída — e nunca vale em modo de
  // acompanhamento, porque ali `superAdmin` já vem desligado.
  const precisaAtivar2FA = usuario.superAdmin && !usuario.totpAtivadoEm;
  if (
    precisaAtivar2FA &&
    !pathname.startsWith("/conta/seguranca") &&
    !pathname.startsWith("/termos") &&
    !pathname.startsWith("/api")
  ) {
    redirect("/conta/seguranca?exigir2fa=1");
  }

  // Regina 14/07: ANALISTA sem aceite do contrato v1.0 (cadastrado antes do
  // contrato existir) e forcado pra /termos ate aceitar. Nao pode pular
  // pra /painel-analista ou qualquer outra tela sem ter aceitado.
  const VERSAO_CONTRATO_ANALISTA_ATUAL = "1.0";
  const precisaAceitarContratoAnalista =
    tipoConta === "ANALISTA" &&
    !usuario.superAdmin &&
    conta.termosAceitosVersao !== VERSAO_CONTRATO_ANALISTA_ATUAL;
  if (
    precisaAceitarContratoAnalista &&
    !pathname.startsWith("/termos") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/entrar")
  ) {
    redirect("/termos");
  }

  // Paywall só aplica pra contas EMPRESA (analista não paga assinatura).
  const rotaPermitidaPaywall = ROTAS_PERMITIDAS_INADIMPLENTE.some((r) => pathname.startsWith(r));

  // Conta bloqueada vai DIRETO pra tela de pagamento (Regina 24/08). Antes
  // aparecia um aviso com links e o cliente tinha que procurar onde pagar —
  // agora ele cai na cobrança em aberto, com o PIX na tela.
  if (tipoConta === "EMPRESA" && bloqueada && !rotaPermitidaPaywall) {
    redirect("/conta/assinatura");
  }

  // Acesso por modulo (Regina 21/08). A trava fica AQUI, e nao em cada pagina:
  // o layout ja conhece a rota atual pelo header x-pathname, entao uma regra so
  // cobre tambem as subrotas (/contratos/<id>, /atas/<id>/editar...) sem deixar
  // buraco quando alguem criar uma tela nova. Mesmo mecanismo do paywall.
  const moduloDaRotaAtual = moduloDaRota(pathname);
  const moduloBloqueado =
    moduloDaRotaAtual && !podeAcessarModulo(usuario, moduloDaRotaAtual) ? moduloDaRotaAtual : null;

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
      <FlutuanteIAsystem plano={usuario.conta.plano} superAdmin={usuario.superAdmin} />
      <ComandoRapido visao={visao} superAdmin={usuario.superAdmin} />
      <div className="app-content flex flex-1 w-full overflow-hidden">
        <SinoNotificacoes
          naoLidas={qtdNotificacoes}
          avisos={avisosRecentes.map((a) => ({
            id: a.id,
            titulo: a.titulo,
            descricao: a.descricao,
            link: a.link,
            lida: a.lida,
            quando: a.criadoEm.toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            }),
          }))}
        />
        <Sidebar
          nomeUsuario={usuario.nome}
          nomeConta={principal}
          tipoConta={tipoConta}
          visao={visao}
          superAdmin={usuario.superAdmin}
          qtdNotificacoesNaoLidas={qtdNotificacoes}
          empresas={empresasOpcoes}
          empresaIdSelecionada={empresaIdSelecionada}
          acessoRestrito={usuario.acessoRestrito}
          modulosPermitidos={usuario.modulosPermitidos}
        />
        <main className="flex-1 overflow-y-auto">
          {exigirFormaDePagamento && <AvisoUltimoDiaTrial />}
          {consolidadoBloqueado ? (
            <SelecioneEmpresa />
          ) : moduloBloqueado ? (
            <SemAcessoModulo chave={moduloBloqueado} />
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

