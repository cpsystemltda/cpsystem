import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, CreditCard } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusGateway } from "@/lib/gateway";
import { GatewayConfigForm } from "./GatewayConfigForm";
import { ReguaCobrancaButton } from "./ReguaCobrancaButton";

export default async function GatewayPage() {
  const usuario = await exigirUsuario();
  // Tela de configuração de gateway expõe chaves Asaas/Stripe da plataforma —
  // SÓ super admin (Regina/Igor) pode acessar. Antes o guard era `perfil ===
  // "ADMIN"`, mas esse é o perfil interno da empresa-cliente, não tem nada
  // a ver com admin da plataforma → vazava as configurações pra qualquer
  // ADMIN de qualquer empresa.
  if (!usuario.superAdmin) redirect("/dashboard");

  const cfg = await prisma.configuracaoGateway.findUnique({ where: { id: "singleton" } });
  const gw = await statusGateway();

  // Estatísticas rápidas
  const [pendentes, atrasadas, pagas] = await Promise.all([
    prisma.cobranca.count({ where: { status: "PENDENTE" } }),
    prisma.cobranca.count({ where: { status: "ATRASADA" } }),
    prisma.cobranca.count({ where: { status: "PAGA" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Voltar para Admin
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50">
          <CreditCard className="h-5 w-5 text-blue-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gateway de pagamento</h1>
          <p className="mt-1 text-sm text-slate-600">Configure o provedor para começar a cobrar de verdade.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Stat titulo="Status atual" valor={gw.provider} sub={gw.configurado ? "configurado" : "demo (sem cobrança)"} cor={gw.configurado ? "emerald" : "amber"} />
        <Stat titulo="Cobranças pendentes" valor={String(pendentes)} sub={`${atrasadas} atrasadas`} />
        <Stat titulo="Cobranças pagas" valor={String(pagas)} sub="histórico total" />
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Configuração</h2>
        <div className="mt-4">
          <GatewayConfigForm cfg={cfg} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Régua de cobrança</h2>
        <p className="mt-2 text-sm text-slate-600">
          Em produção essa régua roda automaticamente (cron diário). Aqui você dispara manualmente para teste:
        </p>
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
          <li>Cobranças vencendo em ≤3 dias → registra aviso (TODO: e-mail/WhatsApp)</li>
          <li>Cobranças vencidas há ≥3 dias → marca ATRASADA</li>
          <li>Contas com cobrança ATRASADA há ≥7 dias → marca conta INADIMPLENTE (paywall)</li>
        </ul>
        <ReguaCobrancaButton />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600">
        <h3 className="font-semibold text-slate-700">Como configurar ASAAS em produção</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Crie conta em https://www.asaas.com (gratuito).</li>
          <li>Ative sua conta com CNPJ válido.</li>
          <li>Vá em Integrações → Gere a API Key de produção.</li>
          <li>Cole a key acima e selecione "production".</li>
          <li>Configure o webhook em ASAAS → Notificações → URL: <code>https://seu-dominio/api/webhooks/asaas</code></li>
          <li>Use o mesmo Webhook Token aqui e lá.</li>
        </ol>
      </section>
    </div>
  );
}

function Stat({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub: string; cor?: "emerald" | "amber" }) {
  const corCls = cor === "emerald" ? "text-emerald-700" : cor === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold ${corCls}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
