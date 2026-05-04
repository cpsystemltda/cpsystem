import Link from "next/link";
import { Wallet, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, tierPorAtivos } from "@/lib/validators";

export default async function HonorariosPage() {
  const usuario = await exigirUsuario();

  // Conta vinculada como analista?
  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    include: { analista: true },
  });

  if (!conta?.analista) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <Wallet className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Painel de honorários</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta tela é exclusiva para contas do tipo <strong>Analista de Licitação</strong>. Sua conta atual é do tipo <strong>{conta?.tipo}</strong>.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Se você é um analista parceiro, precisa cadastrar uma conta separada do tipo Analista.{" "}
          <Link href="/embaixadores" className="text-blue-700 hover:underline">
            Veja o programa de embaixadores →
          </Link>
        </p>
      </div>
    );
  }

  const analistaId = conta.analista.id;

  // Clientes ativos indicados
  const contasIndicadas = await prisma.conta.findMany({
    where: { embaixadorId: analistaId },
    include: {
      usuarios: { take: 1, select: { nome: true, email: true } },
      empresas: { take: 1, select: { razaoSocial: true, nomeFantasia: true } },
    },
    orderBy: { criadoEm: "desc" },
  });

  const ativos = contasIndicadas.filter((c) => c.statusAssinatura === "ATIVA");
  const trial = contasIndicadas.filter((c) => c.statusAssinatura === "TRIAL");

  const { tier, percentual } = tierPorAtivos(ativos.length);

  // Comissões
  const comissoes = await prisma.comissao.findMany({
    where: { analistaId },
    include: { conta: { include: { usuarios: { take: 1, select: { nome: true } } } } },
    orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
  });

  const totalRecebido = comissoes.filter((c) => c.paga).reduce((s, c) => s + c.valor, 0);
  const totalAReceber = comissoes.filter((c) => !c.paga).reduce((s, c) => s + c.valor, 0);

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50">
          <Wallet className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Painel de honorários</h1>
          <p className="mt-1 text-sm text-slate-600">
            Olá {conta.analista.nomeCompleto} — controle suas comissões e clientes ativos.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card titulo="Clientes ativos" valor={String(ativos.length)} sub={`${trial.length} em trial`} />
        <Card titulo="Tier atual" valor={tier} sub={`Comissão ${percentual}%`} />
        <Card titulo="A receber" valor={brl(totalAReceber)} sub={`${comissoes.filter((c) => !c.paga).length} comissões`} cor="amber" />
        <Card titulo="Já recebido" valor={brl(totalRecebido)} sub={`${comissoes.filter((c) => c.paga).length} pagamentos`} cor="emerald" />
      </div>

      {!conta.analista.divulgacaoUrl && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Cadastre seu link de divulgação na bio das redes sociais para manter as comissões ativas.
        </div>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Meus clientes ({contasIndicadas.length})</h2>
        {contasIndicadas.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum cliente indicado ainda.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Plano</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {contasIndicadas.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{c.usuarios[0]?.nome || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {c.empresas[0]?.nomeFantasia || c.empresas[0]?.razaoSocial || "—"}
                  </td>
                  <td className="px-3 py-2">{c.plano}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        c.statusAssinatura === "ATIVA"
                          ? "bg-emerald-100 text-emerald-700"
                          : c.statusAssinatura === "TRIAL"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {c.statusAssinatura}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico de comissões ({comissoes.length})</h2>
        {comissoes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhuma comissão registrada.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Competência</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {comissoes.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{c.competencia}</td>
                  <td className="px-3 py-2">{c.conta.usuarios[0]?.nome || "—"}</td>
                  <td className="px-3 py-2 text-xs">{c.tier}</td>
                  <td className="px-3 py-2 text-right">{c.percentual}%</td>
                  <td className="px-3 py-2 text-right font-medium">{brl(c.valor)}</td>
                  <td className="px-3 py-2">
                    {c.paga ? (
                      <span className="text-xs text-emerald-700">Pago em {c.pagaEm?.toLocaleDateString("pt-BR")}</span>
                    ) : (
                      <span className="text-xs text-amber-700">A receber</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Card({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub: string; cor?: "amber" | "emerald" }) {
  const corCls = cor === "amber" ? "text-amber-700" : cor === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold ${corCls}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
