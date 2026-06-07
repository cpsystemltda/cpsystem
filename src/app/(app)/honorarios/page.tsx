import Link from "next/link";
import { Wallet, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, tierPorAtivos } from "@/lib/validators";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { HonorariosAnalistaBloco } from "@/components/HonorariosAnalistaBloco";
import { LinkIndicacaoCard } from "@/components/LinkIndicacaoCard";

// Quantos clientes ativos faltam pra subir de tier. null = ja esta no
// tier maximo (DIAMOND).
function faltaParaProximoTier(ativos: number): { proximo: string; faltam: number } | null {
  if (ativos < 6) return { proximo: "Prata", faltam: 6 - ativos };
  if (ativos < 11) return { proximo: "Ouro", faltam: 11 - ativos };
  if (ativos < 16) return { proximo: "Diamante", faltam: 16 - ativos };
  return null;
}

export default async function HonorariosPage() {
  const usuario = await exigirUsuario();

  // Conta vinculada como analista?
  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    include: { analista: true },
  });

  // Conta EMPRESA — mostra os pagamentos que a empresa faz aos analistas
  // vinculados (movido pra cá vindo do Dashboard, Regina 31/05). Inclui
  // fixo mensal (PagamentoFixoMensal) + variável por execução
  // (ComissaoExecucao).
  if (conta?.tipo === "EMPRESA") {
    return <HonorariosDaEmpresa contaId={usuario.contaId} />;
  }

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
      <PageHeader
        eyebrow="Painel · Comissões SaaS"
        titulo="Honorários"
        destaque={tier}
        subtitulo={`Olá ${conta.analista.nomeCompleto} — controle suas comissões e clientes ativos.`}
      />

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card titulo="Clientes ativos" valor={String(ativos.length)} sub={`${trial.length} em trial`} />
        <Card
          titulo="Tier atual"
          valor={tier}
          sub={
            faltaParaProximoTier(ativos.length)
              ? `Comissão ${percentual}% · faltam ${faltaParaProximoTier(ativos.length)!.faltam} pra ${faltaParaProximoTier(ativos.length)!.proximo}`
              : `Comissão ${percentual}% · tier máximo`
          }
        />
        <Card titulo="A receber" valor={brl(totalAReceber)} sub={`${comissoes.filter((c) => !c.paga).length} comissões`} cor="amber" />
        <Card titulo="Já recebido" valor={brl(totalRecebido)} sub={`${comissoes.filter((c) => c.paga).length} pagamentos`} cor="emerald" />
      </div>

      <div className="mt-6">
        <LinkIndicacaoCard analistaId={analistaId} nomeCompleto={conta.analista.nomeCompleto} />
      </div>

      {!conta.analista.divulgacaoUrl && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Cadastre seu link de divulgação na bio das redes sociais para manter as comissões ativas.
        </div>
      )}

      <section className="glass mt-6 rounded-[20px] px-6 py-5">
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

      <section className="glass mt-6 rounded-[20px] px-6 py-5">
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
    <div className="glass-tile rounded-[18px] px-5 py-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold ${corCls}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

// ============================================================
// EMPRESA — Pagamentos que ela faz aos analistas vinculados.
// Lógica espelhada do que estava no dashboard antes da Regina mover
// pra módulo separado (31/05).
// ============================================================
async function HonorariosDaEmpresa({ contaId }: { contaId: string }) {
  const hoje = new Date();
  const [linhasFixoBruto, comissoesVarBruto] = await Promise.all([
    prisma.pagamentoFixoMensal.findMany({
      where: { vinculo: { contaId } },
      include: {
        vinculo: { select: { analista: { select: { nomeCompleto: true } } } },
      },
      orderBy: [{ competencia: "desc" }, { vencimento: "asc" }],
    }),
    prisma.comissaoExecucao.findMany({
      where: { vinculo: { contaId }, status: { in: ["A_RECEBER", "ATRASADO", "PAGO_PARCIAL"] } },
      include: {
        empenho: { select: { numero: true, orgaoNome: true } },
        vinculo: { select: { analista: { select: { nomeCompleto: true } } } },
      },
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  const temVinculoAnalista = linhasFixoBruto.length > 0 || comissoesVarBruto.length > 0;
  if (!temVinculoAnalista) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <Wallet className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Honorários do analista</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sua empresa ainda não tem vínculo ativo com analista de licitação. Quando o vínculo for cadastrado, os pagamentos (fixo mensal + variável por execução) aparecem aqui.
        </p>
        <Link href="/vinculos" className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline">
          Ver/cadastrar analista vinculado →
        </Link>
      </div>
    );
  }

  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const linhasFixoPendentes = linhasFixoBruto
    .filter((l) => l.status !== "PAGO" || l.competencia === mesAtualStr)
    .slice(0, 12)
    .map((l) => ({
      id: l.id,
      competencia: l.competencia,
      valor: l.valor,
      valorRecebido: l.valorRecebido ?? 0,
      status: l.status as "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL",
      vencimento: l.vencimento,
      pagaEm: l.pagaEm,
      analistaNome: l.vinculo.analista?.nomeCompleto ?? "Analista",
    }));
  const comissoesVarPendentes = comissoesVarBruto.map((c) => ({
    id: c.id,
    empenhoNumero: `Empenho ${c.empenho.numero}`,
    orgaoNome: c.empenho.orgaoNome,
    valorBaseEmpenho: c.valorBaseEmpenho,
    valorCalculado: c.valorCalculado,
    valorRecebido: c.valorRecebido ?? 0,
    percentual: c.percentual,
    status: c.status as "AGUARDANDO_ORGAO" | "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL",
    analistaNome: c.vinculo.analista?.nomeCompleto ?? "Analista",
  }));
  const totalPagoFixoMes = linhasFixoBruto
    .filter((l) => l.status === "PAGO" && l.pagaEm && l.pagaEm.toISOString().slice(0, 7) === mesAtualStr)
    .reduce((s, l) => s + (l.valorRecebido ?? l.valor), 0);
  const totalAtrasadoFixo = linhasFixoBruto
    .filter((l) => l.status === "ATRASADO" || (l.status === "A_RECEBER" && l.vencimento && l.vencimento < hoje))
    .reduce((s, l) => s + l.valor, 0);
  const totalAPagarFixoMes = linhasFixoBruto
    .filter((l) => l.status !== "PAGO" && l.competencia === mesAtualStr)
    .reduce((s, l) => s + l.valor, 0);
  const totalAPagarVar = comissoesVarBruto.reduce(
    (s, c) => s + (c.status === "PAGO_PARCIAL" ? Math.max(0, c.valorCalculado - (c.valorRecebido ?? 0)) : c.valorCalculado),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Módulo · Pagamentos a analistas"
        titulo="Honorários"
        destaque="do analista"
        subtitulo="Acompanhe os pagamentos da sua empresa aos analistas de licitação vinculados — fixo mensal + variável por execução."
      />
      <div className="mt-8">
        <HonorariosAnalistaBloco
          fixosPendentes={linhasFixoPendentes}
          variaveisPendentes={comissoesVarPendentes}
          totalPagoMes={totalPagoFixoMes}
          totalAtrasado={totalAtrasadoFixo}
          totalAPagar={totalAPagarFixoMes + totalAPagarVar}
        />
      </div>
    </div>
  );
}
