import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { CompletarCadastroForm } from "./CompletarCadastroForm";
import { VERSAO_TERMOS } from "@/components/legal/ContratoTermosUso";

// Tela pra contas TRIAL antigas que NÃO passaram pelo signup novo com
// dia de vencimento + subscription Asaas (Regina 13/07). Cliente cadastra
// cartão + escolhe dia de vencimento aqui, sistema cria Customer +
// Subscription no Asaas e conta vira ATIVA quando trial acaba (ou agora
// se já expirou).
export default async function CompletarCadastroPage() {
  const usuario = await exigirUsuario();

  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    include: {
      empresas: { take: 1, select: { razaoSocial: true, cnpj: true, endereco: true, cep: true, telefones: true } },
    },
  });
  if (!conta) redirect("/dashboard");

  // Se já tem subscription, nada a fazer aqui
  if (conta.gatewaySubscriptionId) redirect("/dashboard");

  const empresa = conta.empresas[0];
  const trialAteEm = conta.trialAteEm ?? new Date();
  const jaExpirou = trialAteEm < new Date();
  // Regina 13/07: TRIAL antiga precisa RE-ACEITAR contrato v2.2 antes de
  // seguir. Se ja aceitou v2.2, ok. Senao, bloqueia.
  const precisaReaceitarTermos = conta.termosAceitosVersao !== VERSAO_TERMOS;
  // Modo migracao: caso do Leo — a conta EMPRESA foi criada com dados do
  // Igor (que operava o trial), e Leo precisa assumir com os dados dele.
  // Sinal: CNPJ da empresa da conta bate com o CNPJ do CP System (Igor cadastrou
  // com CNPJ dele) OU nao ha CNPJ preenchido. Regina disse que o Leo precisa
  // atualizar endereco tambem. Assumimos migracao sempre que a conta veio
  // pra completar-cadastro — a UX ganha campos editaveis por padrao.
  const modoMigracao = true;

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Pagamento"
        titulo="Complete seu"
        destaque="cadastro"
        subtitulo={jaExpirou
          ? "Seu período de teste terminou e o acesso está pausado. Escolha como pagar — PIX, boleto ou cartão — pra voltar a usar o sistema."
          : "Escolha como pagar a mensalidade: PIX, boleto ou cartão. Nada é cobrado até o teste terminar."}
      />

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {jaExpirou ? (
          <>
            <strong>Período de teste encerrado em {trialAteEm.toLocaleDateString("pt-BR")}.</strong> Enquanto não houver forma de pagamento, o acesso às telas do sistema fica pausado. No cartão, o acesso volta na hora; no PIX, assim que o pagamento cair (leva segundos).
          </>
        ) : (
          <>
            <strong>Seu trial termina em {trialAteEm.toLocaleDateString("pt-BR")}.</strong> A partir do dia seguinte, o acesso ao sistema depende de ter uma forma de pagamento escolhida — no cartão a cobrança sai sozinha no dia que você escolher; no PIX ou boleto, a fatura aparece aqui todo mês.
          </>
        )}
      </div>

      {precisaReaceitarTermos ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Antes de cadastrar o cartão, você precisa ler e aceitar a nova versão do contrato (v{VERSAO_TERMOS}).
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Atualizamos as cláusulas de reajuste anual e incluímos o plano Intermediário. Após o aceite, você volta aqui pra concluir o cadastro do cartão.
          </p>
          <Link
            href="/termos"
            className="mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
              color: "#0A0A0A",
              letterSpacing: "0.18em",
            }}
          >
            Ler contrato v{VERSAO_TERMOS} →
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <CompletarCadastroForm
            empresa={{
              razaoSocial: empresa?.razaoSocial ?? "",
              cnpj: empresa?.cnpj ?? "",
              endereco: empresa?.endereco ?? "",
              cep: empresa?.cep ?? "",
              telefones: empresa?.telefones ?? "",
            }}
            plano={conta.plano}
            modoMigracao={modoMigracao}
          />
        </div>
      )}
    </div>
  );
}
