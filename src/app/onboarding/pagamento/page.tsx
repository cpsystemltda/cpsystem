import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { WizardIndicator } from "../page";
import { ConcluirButton } from "./ConcluirButton";
import { CreditCard, Shield, Zap } from "lucide-react";

export default async function OnboardingPagamentoPage() {
  const usuario = await exigirUsuario();
  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    select: {
      plano: true,
      statusAssinatura: true,
      trialAteEm: true,
      _count: { select: { metodosPagamento: true } },
    },
  });
  const jaTemCartao = (conta?._count?.metodosPagamento ?? 0) > 0;
  const jaPagou = conta?.statusAssinatura === "ATIVA";

  return (
    <div>
      <WizardIndicator etapa={3} />
      <h1 className="mt-6 text-3xl font-extrabold" style={{ color: "var(--text)" }}>
        Ativação do plano
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
        Para acessar o sistema, cadastre seu cartão e ative o plano <strong>{conta?.plano === "PREMIUM" ? "Premium" : "Básico"}</strong>.
      </p>

      <div
        className="mt-6 rounded-2xl px-6 py-6"
        style={{
          background: "linear-gradient(180deg, rgba(212,175,55,0.08) 0%, rgba(232,200,117,0.03) 100%)",
          border: "1px solid rgba(212,175,55,0.5)",
        }}
      >
        <div className="flex items-start gap-3">
          <Zap size={22} style={{ color: "var(--primary-deep)" }} />
          <div>
            <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
              Cobrança imediata
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
              O plano é cobrado assim que você cadastra o cartão. Não é trial.
              Se não cadastrar em <strong>2 dias</strong>, a conta fica inativa automaticamente
              até o pagamento.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        {jaPagou ? (
          <ConcluirButton />
        ) : (
          <Link
            href="/conta/checkout"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[13px] font-bold uppercase transition hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
              color: "#0A0A0A",
              letterSpacing: "0.18em",
              boxShadow: "0 10px 26px -6px rgba(168,137,71,0.4)",
            }}
          >
            <CreditCard size={16} />
            {jaTemCartao ? "Ativar plano agora" : "Cadastrar cartão e ativar"}
          </Link>
        )}
        <Link href="/onboarding/empresa" className="text-xs font-bold uppercase transition hover:opacity-70" style={{ letterSpacing: "0.14em", color: "var(--text-soft)" }}>
          ← Voltar
        </Link>
      </div>

      <div className="mt-6 text-[11px]" style={{ color: "var(--text-mute)" }}>
        <Shield size={11} className="mr-1 inline" />
        Pagamento processado pelo Asaas. Cartão validado pela bandeira. CP System nunca vê o PAN.
      </div>
    </div>
  );
}
