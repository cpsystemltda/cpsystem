import Link from "next/link";
import { Users, Gift, CheckCircle2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { LinkIndicacaoClienteCard } from "@/components/LinkIndicacaoClienteCard";

// Programa de Referral cliente-indica-cliente. Cliente atual compartilha
// link `/signup?ref=conta-<id>`. A cada empresa que se cadastra via esse
// link E paga 1a fatura, o cliente recebe 1 mes gratis (credito).
//
// Regina (08/06, plano marketing v7).

export default async function IndicarPage() {
  const usuario = await exigirUsuario();

  // Carrega contas indicadas + status delas.
  const indicadas = await prisma.conta.findMany({
    where: { indicadoPorContaId: usuario.contaId },
    include: {
      usuarios: { take: 1, select: { nome: true, email: true } },
      empresas: { take: 1, select: { razaoSocial: true, nomeFantasia: true } },
      cobrancas: {
        where: { status: "PAGA" },
        orderBy: { pagaEm: "asc" },
        take: 1,
        select: { pagaEm: true },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  const totalIndicadas = indicadas.length;
  const pagantes = indicadas.filter((c) => c.cobrancas.length > 0).length;
  const emTrial = indicadas.filter((c) => c.cobrancas.length === 0 && c.statusAssinatura === "TRIAL").length;
  const mesesCreditados = pagantes;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        eyebrow="Programa de Indicação"
        titulo="Indique e"
        destaque="ganhe meses grátis"
        subtitulo="A cada empresa que se cadastrar via seu link E pagar a 1ª fatura, você ganha 1 mês grátis no seu próximo ciclo de cobrança."
      />

      {/* Link de indicação */}
      <div className="mt-8">
        <LinkIndicacaoClienteCard contaId={usuario.contaId} />
      </div>

      {/* Resumo */}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard
          icon={Users}
          titulo="Total indicadas"
          valor={String(totalIndicadas)}
          cor="var(--text)"
        />
        <StatCard
          icon={Gift}
          titulo="Em trial"
          valor={String(emTrial)}
          sub="aguardando 1ª paga"
          cor="var(--primary-deep)"
        />
        <StatCard
          icon={CheckCircle2}
          titulo="Pagantes"
          valor={String(pagantes)}
          cor="var(--mint-deep)"
        />
        <StatCard
          icon={Gift}
          titulo="Meses grátis ganhos"
          valor={String(mesesCreditados)}
          sub="(crédito futuro)"
          cor="var(--mint-deep)"
          destaque
        />
      </div>

      {/* Lista de indicadas */}
      <section className="glass mt-8 rounded-[20px] px-6 py-5">
        <h2
          className="text-[13px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          Suas indicações ({totalIndicadas})
        </h2>

        {indicadas.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: "var(--text-soft)" }}>
            Você ainda não indicou nenhuma empresa. Compartilhe seu link acima
            e ganhe 1 mês grátis a cada indicação que pagar.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead
                className="text-[10px] uppercase"
                style={{ letterSpacing: "0.16em", color: "var(--text-soft)" }}
              >
                <tr>
                  <th className="px-3 py-2 text-left">Empresa</th>
                  <th className="px-3 py-2 text-left">Cadastro</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Crédito gerado</th>
                </tr>
              </thead>
              <tbody>
                {indicadas.map((c) => {
                  const pagou = c.cobrancas.length > 0;
                  return (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5">
                        <div className="font-bold" style={{ color: "var(--text)" }}>
                          {c.empresas[0]?.nomeFantasia ||
                            c.empresas[0]?.razaoSocial ||
                            "—"}
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--text-mute)" }}>
                          {c.usuarios[0]?.nome || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-soft)" }}>
                        {c.criadoEm.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            background: pagou
                              ? "rgba(93,216,182,0.20)"
                              : "rgba(212,175,55,0.20)",
                            color: pagou ? "var(--mint-deep)" : "var(--primary-deep)",
                            letterSpacing: "0.12em",
                          }}
                        >
                          {pagou ? "Pagante" : "Em trial"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {pagou ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-extrabold"
                            style={{ color: "var(--mint-deep)" }}
                          >
                            <Gift className="h-3.5 w-3.5" /> 1 mês grátis
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-mute)" }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Como funciona */}
      <section
        className="mt-8 rounded-[20px] p-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(212,175,55,0.08), rgba(184,137,71,0.04)), white",
          border: "0.5px solid var(--hairline)",
        }}
      >
        <h2
          className="text-[14px] font-extrabold"
          style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
        >
          Como funciona o programa de indicação
        </h2>
        <ol className="mt-4 space-y-3 text-[13px]" style={{ color: "var(--text-soft)" }}>
          <li>
            <strong>1. Copie seu link de indicação acima</strong> — ele tem seu ID
            de conta, então cada cadastro feito via ele é vinculado a você.
          </li>
          <li>
            <strong>2. Compartilhe com empresas</strong> que vendem ao governo —
            por WhatsApp, email, redes sociais ou pessoalmente.
          </li>
          <li>
            <strong>3. A empresa se cadastra</strong> via seu link e começa o trial
            de 14 dias (igual a você fez).
          </li>
          <li>
            <strong>4. Quando ela paga a 1ª fatura</strong>, você ganha automaticamente
            1 mês grátis de crédito — descontado no seu próximo ciclo.
          </li>
        </ol>
        <p className="mt-4 text-[12px]" style={{ color: "var(--text-mute)" }}>
          Sem limite de indicações. Sem letra miúda. Cada empresa indicada que
          virar pagante = 1 mês grátis pra você. 5 indicações pagantes = 5 meses
          grátis acumulados.
        </p>
      </section>

      <p className="mt-6 text-center text-[11px]" style={{ color: "var(--text-mute)" }}>
        Dúvidas?{" "}
        <Link
          href="/conta/assinatura"
          className="font-bold underline"
          style={{ color: "var(--primary-deep)" }}
        >
          Veja sua assinatura
        </Link>{" "}
        ou fale com nossa equipe.
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  titulo,
  valor,
  sub,
  cor,
  destaque,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  valor: string;
  sub?: string;
  cor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className="glass-tile rounded-[18px] px-5 py-5"
      style={
        destaque
          ? {
              background:
                "linear-gradient(135deg, rgba(93,216,182,0.18), rgba(93,216,182,0.06)), white",
              border: "0.5px solid rgba(93,216,182,0.4)",
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
          style={{
            background: destaque
              ? "rgba(93,216,182,0.20)"
              : "rgba(15,14,12,0.05)",
            color: cor,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
        >
          {titulo}
        </p>
      </div>
      <p
        className="mt-3 text-[28px] font-extrabold tabular leading-none"
        style={{ color: cor, letterSpacing: "-0.025em" }}
      >
        {valor}
      </p>
      {sub && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-mute)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
