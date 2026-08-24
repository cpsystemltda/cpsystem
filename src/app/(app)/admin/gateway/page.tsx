import Link from "next/link";
import { ChevronLeft, CreditCard } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusGateway } from "@/lib/gateway";
import { GatewayConfigForm } from "./GatewayConfigForm";
import { ReguaCobrancaButton } from "./ReguaCobrancaButton";
import { CobrancasEmAberto } from "./CobrancasEmAberto";
import { FaturasEmFalta } from "./FaturasEmFalta";

export default async function GatewayPage() {
  const usuario = await exigirUsuario();
  // Tela de configuração de gateway expõe chaves Asaas/Stripe da plataforma —
  // SÓ super admin (Regina/Igor) pode acessar. Mostra "Acesso restrito"
  // explícito em vez de redirect silencioso.
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">
          Esta área é exclusiva para gestores da plataforma (Adm CP System).
        </p>
      </div>
    );
  }

  const cfg = await prisma.configuracaoGateway.findUnique({ where: { id: "singleton" } });
  const gw = await statusGateway();

  // Estatísticas rápidas
  const [pendentes, atrasadas, pagas] = await Promise.all([
    prisma.cobranca.count({ where: { status: "PENDENTE" } }),
    prisma.cobranca.count({ where: { status: "ATRASADA" } }),
    prisma.cobranca.count({ where: { status: "PAGA" } }),
  ]);

  const abertas = await prisma.cobranca.findMany({
    where: { status: { in: ["PENDENTE", "PROCESSANDO", "ATRASADA"] } },
    orderBy: { vencimento: "asc" },
    take: 50,
    select: {
      id: true, competencia: true, forma: true, valor: true, status: true,
      vencimento: true, observacoes: true,
      conta: {
        select: {
          empresas: { select: { nomeFantasia: true, razaoSocial: true }, take: 1 },
          usuarios: { select: { superAdmin: true } },
        },
      },
    },
  });
  const cobrancasAbertas = abertas.map((c) => ({
    id: c.id,
    competencia: c.competencia,
    forma: c.forma as string,
    valor: c.valor,
    status: c.status as string,
    vencimento: c.vencimento.toLocaleDateString("pt-BR"),
    cliente:
      c.conta.empresas[0]?.nomeFantasia ?? c.conta.empresas[0]?.razaoSocial ?? "Conta sem empresa",
    interna: c.conta.usuarios.some((u) => u.superAdmin),
    observacoes: c.observacoes,
  }));

  // Contas ativas sem cobrança na competência do mês — o mês que ficou pra trás
  // quando o cliente pagou com atraso (ver `ativarPlano`).
  const agora = new Date();
  const competenciaAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const contasAtivas = await prisma.conta.findMany({
    where: {
      tipo: "EMPRESA",
      statusAssinatura: "ATIVA",
      usuarios: { none: { superAdmin: true } },
      gatewaySubscriptionId: null, // com assinatura, quem cobra é o gateway
    },
    select: {
      id: true,
      empresas: { select: { nomeFantasia: true, razaoSocial: true }, take: 1 },
      cobrancas: {
        select: { competencia: true, status: true, pagaEm: true },
        orderBy: { vencimento: "desc" },
      },
    },
  });
  const faturasEmFalta = contasAtivas
    .filter(
      (c) =>
        !c.cobrancas.some(
          (cb) => cb.competencia === competenciaAtual && cb.status !== "CANCELADA",
        ),
    )
    .map((c) => {
      const ultimo = c.cobrancas.find((cb) => cb.status === "PAGA" && cb.pagaEm);
      return {
        contaId: c.id,
        cliente:
          c.empresas[0]?.nomeFantasia ?? c.empresas[0]?.razaoSocial ?? "Conta sem empresa",
        competencia: competenciaAtual,
        ultimoPago: ultimo?.pagaEm ? ultimo.pagaEm.toLocaleDateString("pt-BR") : null,
      };
    });

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
      <FaturasEmFalta linhas={faturasEmFalta} />
      <CobrancasEmAberto cobrancas={cobrancasAbertas} />
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
