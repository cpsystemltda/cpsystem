import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { CompletarCadastroForm } from "./CompletarCadastroForm";

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

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Pagamento"
        titulo="Complete seu"
        destaque="cadastro"
        subtitulo={jaExpirou
          ? "Seu período de teste terminou. Cadastre seu cartão pra continuar usando."
          : "Cadastre seu cartão pra que a cobrança comece automaticamente no dia certo."}
      />

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {jaExpirou ? (
          <>
            <strong>Período de teste encerrado em {trialAteEm.toLocaleDateString("pt-BR")}.</strong> Cadastre seu cartão agora pra reativar o acesso — a primeira cobrança acontece no próximo dia escolhido.
          </>
        ) : (
          <>
            <strong>Seu trial termina em {trialAteEm.toLocaleDateString("pt-BR")}.</strong> Depois disso o Asaas cobra automaticamente no dia de vencimento que você escolher.
          </>
        )}
      </div>

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
        />
      </div>
    </div>
  );
}
