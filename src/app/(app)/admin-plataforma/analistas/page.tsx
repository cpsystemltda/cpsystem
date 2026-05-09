import Link from "next/link";
import { Crown, UserCheck, Users2, Wallet, Sparkles, Building2, Briefcase, Coins, TrendingUp } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { KPI } from "@/components/ui/KPI";

function brlCompacto(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace(".", ",")} Mi`;
  if (n >= 10_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return brl(n);
}

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function tempoNaPlataforma(criadoEm: Date): string {
  const dias = Math.floor((Date.now() - criadoEm.getTime()) / 86400000);
  if (dias < 30) return `${dias}d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses} mes${meses > 1 ? "es" : ""}`;
  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses - anos * 12;
  return `${anos}a${mesesRestantes > 0 ? ` ${mesesRestantes}m` : ""}`;
}

export default async function AdminAnalistasPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          Acesso restrito
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--text-soft)" }}>
          Esta área é exclusiva para gestores da plataforma.
        </p>
      </div>
    );
  }

  // Busca todos os analistas + vínculos + execuções (empenhos) das empresas vinculadas
  // pra calcular comissão variável (% sobre execuções com criadoEm >= vinculo.dataInicio).
  const analistas = await prisma.analista.findMany({
    include: {
      conta: { select: { id: true, statusAssinatura: true, criadoEm: true } },
      vinculos: {
        include: {
          conta: {
            select: {
              id: true,
              empresas: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
              statusAssinatura: true,
            },
          },
          fixosPagos: { where: { paga: true }, select: { valor: true } },
        },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  // Calcula em paralelo, por vínculo, comissão variável paga vs a pagar
  // baseado em execuções (empenhos) das empresas da conta com criadoEm >= dataInicio.
  // Também calcula carteira contratada (atas + contratos vigentes).
  const hojeAgora = new Date();
  type ResumoVinculo = { vinculoId: string; comissaoPaga: number; comissaoAPagar: number; carteira: number };
  const resumoVinculo = new Map<string, ResumoVinculo>();
  for (const a of analistas) {
    for (const v of a.vinculos) {
      const empresaIds = v.conta.empresas.map((e) => e.id);
      if (empresaIds.length === 0) {
        resumoVinculo.set(v.id, { vinculoId: v.id, comissaoPaga: 0, comissaoAPagar: 0, carteira: 0 });
        continue;
      }
      const [empenhos, atas, contratos] = await Promise.all([
        prisma.empenho.findMany({
          where: { empresaId: { in: empresaIds }, criadoEm: { gte: v.dataInicio } },
          select: { status: true, itens: { select: { valorTotal: true } } },
        }),
        prisma.ata.findMany({
          where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hojeAgora } },
          select: { itens: { select: { valorTotal: true } } },
        }),
        prisma.contrato.findMany({
          where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hojeAgora } },
          select: { itens: { select: { valorTotal: true } } },
        }),
      ]);
      let pago = 0;
      let aPagar = 0;
      for (const e of empenhos) {
        const valor = e.itens.reduce((s, i) => s + i.valorTotal, 0);
        const com = (valor * v.percentualComissao) / 100;
        if (e.status === "PAGO") pago += com;
        else aPagar += com;
      }
      const carteira =
        atas.reduce((s, a) => s + a.itens.reduce((ss, it) => ss + it.valorTotal, 0), 0) +
        contratos.reduce((s, c) => s + c.itens.reduce((ss, it) => ss + it.valorTotal, 0), 0);
      resumoVinculo.set(v.id, { vinculoId: v.id, comissaoPaga: pago, comissaoAPagar: aPagar, carteira });
    }
  }

  // Agregações por analista
  type Linha = {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    cpfMascarado: string;
    criadoEm: Date;
    ativo: boolean;
    statusConta: string | null;
    vinculosAtivos: number;
    vinculosEncerrados: number;
    clientesAtendidos: string[];
    fixoMensalAtivo: number;
    fixoPagoAcumulado: number;
    percentualMedio: number;
    comissaoVarPaga: number;
    comissaoVarAPagar: number;
    carteiraSobGestao: number;
  };

  const linhas: Linha[] = analistas.map((a) => {
    const ativos = a.vinculos.filter((v) => v.status === "ATIVO");
    const encerrados = a.vinculos.filter((v) => v.status === "ENCERRADO");
    const fixoMensalAtivo = ativos.reduce((s, v) => s + v.fixoMensal, 0);
    const fixoPagoAcumulado = a.vinculos.reduce(
      (s, v) => s + v.fixosPagos.reduce((ss, f) => ss + (f.valor ?? 0), 0),
      0,
    );
    const percentuais = ativos.map((v) => v.percentualComissao).filter((p) => p > 0);
    const percentualMedio = percentuais.length > 0 ? percentuais.reduce((s, p) => s + p, 0) / percentuais.length : 0;
    const clientesAtendidos = ativos
      .map((v) => v.conta.empresas[0]?.nomeFantasia || v.conta.empresas[0]?.razaoSocial)
      .filter(Boolean) as string[];
    const comissaoVarPaga = a.vinculos.reduce(
      (s, v) => s + (resumoVinculo.get(v.id)?.comissaoPaga ?? 0),
      0,
    );
    const comissaoVarAPagar = ativos.reduce(
      (s, v) => s + (resumoVinculo.get(v.id)?.comissaoAPagar ?? 0),
      0,
    );
    const carteiraSobGestao = ativos.reduce(
      (s, v) => s + (resumoVinculo.get(v.id)?.carteira ?? 0),
      0,
    );
    return {
      id: a.id,
      nome: a.nomeCompleto,
      email: a.email,
      telefone: a.telefone,
      cpfMascarado: formatarCpf(a.cpf),
      criadoEm: a.criadoEm,
      ativo: a.ativo,
      statusConta: a.conta?.statusAssinatura ?? null,
      vinculosAtivos: ativos.length,
      vinculosEncerrados: encerrados.length,
      clientesAtendidos,
      fixoMensalAtivo,
      fixoPagoAcumulado,
      percentualMedio,
      comissaoVarPaga,
      comissaoVarAPagar,
      carteiraSobGestao,
    };
  });

  // KPIs agregados da rede
  const totalAnalistas = linhas.length;
  const ativos = linhas.filter((l) => l.ativo).length;
  const totalVinculosAtivos = linhas.reduce((s, l) => s + l.vinculosAtivos, 0);
  const fixoMensalRedeAtivo = linhas.reduce((s, l) => s + l.fixoMensalAtivo, 0);
  const fixoPagoAcumuladoTotal = linhas.reduce((s, l) => s + l.fixoPagoAcumulado, 0);
  const comissaoVarPagaTotal = linhas.reduce((s, l) => s + l.comissaoVarPaga, 0);
  const comissaoVarAPagarTotal = linhas.reduce((s, l) => s + l.comissaoVarAPagar, 0);
  const carteiraSobGestaoTotal = linhas.reduce((s, l) => s + l.carteiraSobGestao, 0);
  const novosUltimos30 = linhas.filter(
    (l) => Date.now() - l.criadoEm.getTime() < 30 * 86400000,
  ).length;
  // Empresas únicas atendidas pela rede (contas distintas com vínculo ativo)
  const contasComVinculoAtivo = new Set<string>();
  for (const a of analistas) for (const v of a.vinculos) if (v.status === "ATIVO") contasComVinculoAtivo.add(v.conta.id);
  const empresasUnicas = contasComVinculoAtivo.size;
  const ticketMedioCarteira = ativos > 0 ? carteiraSobGestaoTotal / ativos : 0;
  // Top 3 por carteira sob gestão
  const top3 = [...linhas].sort((a, b) => b.carteiraSobGestao - a.carteiraSobGestao).slice(0, 3);
  const totalDesembolsado = fixoPagoAcumuladoTotal + comissaoVarPagaTotal;
  const totalAPagar = fixoMensalRedeAtivo + comissaoVarAPagarTotal;

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <PageHeader
        eyebrow="Adm CP System · Rede"
        titulo="Analistas"
        destaque="cadastrados"
        subtitulo={`${totalAnalistas} analista${totalAnalistas !== 1 ? "s" : ""} na plataforma — visão completa do programa de parceiros.`}
        cta={
          <Link href="/admin-plataforma" className="btn-secondary">
            <Crown className="h-3.5 w-3.5" /> Voltar à visão geral
          </Link>
        }
      />

      {/* KPIs primários — escala da rede */}
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <KPI tone="primary" icon={UserCheck} label="Total de analistas" value={totalAnalistas} meta={`${ativos} ativos · ${totalAnalistas - ativos} inativos`} href="/admin-plataforma/analistas" />
        <KPI tone="mint" icon={Sparkles} label="Novos (30 dias)" value={novosUltimos30} meta="Cadastrados no último mês" />
        <KPI tone="lavender" icon={Users2} label="Vínculos ativos" value={totalVinculosAtivos} meta={`${empresasUnicas} empresa(s) única(s) atendida(s)`} />
        <KPI tone="sky" icon={Building2} label="Empresas únicas" value={empresasUnicas} meta="Contas com pelo menos 1 vínculo ativo" />
      </div>

      {/* KPIs financeiros — desembolso da plataforma com a rede */}
      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <KPI tone="lavender" icon={Briefcase} label="Carteira sob gestão" value={brlCompacto(carteiraSobGestaoTotal)} meta={`Ticket médio/analista: ${brlCompacto(ticketMedioCarteira)}`} />
        <KPI tone="mint" icon={Wallet} label="Já pago à rede" value={brlCompacto(totalDesembolsado)} meta={`Fixo: ${brlCompacto(fixoPagoAcumuladoTotal)} · Variável: ${brlCompacto(comissaoVarPagaTotal)}`} />
        <KPI tone="rose" icon={Coins} label="A pagar (próximos)" value={brlCompacto(totalAPagar)} meta={`Fixo/mês: ${brlCompacto(fixoMensalRedeAtivo)} · Variável: ${brlCompacto(comissaoVarAPagarTotal)}`} />
        <KPI tone="primary" icon={TrendingUp} label="% comissão médio" value={`${linhas.filter((l) => l.percentualMedio > 0).length === 0 ? 0 : (linhas.filter((l) => l.percentualMedio > 0).reduce((s, l) => s + l.percentualMedio, 0) / Math.max(1, linhas.filter((l) => l.percentualMedio > 0).length)).toFixed(1)}%`} meta="Média entre analistas com vínculo ativo" />
      </div>

      {/* Top 3 por carteira sob gestão */}
      {top3.length > 0 && top3[0].carteiraSobGestao > 0 && (
        <section className="glass mt-6 rounded-[20px] px-6 py-5">
          <h2
            className="text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Top analistas por carteira sob gestão
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {top3.map((l, i) => (
              <Link
                key={l.id}
                href={`/painel-analista?analistaId=${l.id}`}
                className={`glass-tile group block rounded-[16px] px-5 py-4 transition hover:-translate-y-0.5 ${i === 0 ? "t-primary" : i === 1 ? "t-mint" : "t-lavender"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold"
                    style={{
                      background: "rgba(212,175,55,0.25)",
                      border: "0.5px solid rgba(168,137,71,0.5)",
                      color: "var(--primary-deep)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-[14px] font-extrabold" style={{ color: "var(--text)" }}>
                    {l.nome}
                  </h3>
                </div>
                <p className="mt-2 text-[22px] font-extrabold tabular leading-none" style={{ color: "var(--text)", letterSpacing: "-0.04em" }}>
                  {brlCompacto(l.carteiraSobGestao)}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
                  {l.vinculosAtivos} vínculo(s) · {l.percentualMedio.toFixed(1)}% médio · pago acum. {brlCompacto(l.fixoPagoAcumulado + l.comissaoVarPaga)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tabela de analistas */}
      <section className="glass mt-8 overflow-hidden rounded-[20px]">
        <header
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderBottom: "0.5px solid var(--hairline)" }}
        >
          <h2
            className="text-[15px] font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
          >
            Lista de analistas
          </h2>
          <span className="text-xs" style={{ color: "var(--text-soft)" }}>
            Ordenado por data de cadastro (mais recentes primeiro)
          </span>
        </header>
        {linhas.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm" style={{ color: "var(--text-soft)" }}>
            Nenhum analista cadastrado ainda.
          </p>
        ) : (
          <table className="table-glass" style={{ minWidth: "1500px", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "auto", minWidth: "220px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "auto", minWidth: "180px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Analista</th>
                <th className="center">Status</th>
                <th>Tempo</th>
                <th className="num">Vínculos</th>
                <th className="num">% médio</th>
                <th className="num">Fixo/mês</th>
                <th className="num">Carteira gestão</th>
                <th className="num">Comissão paga</th>
                <th className="num">A pagar</th>
                <th>Clientes</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="strong" style={{ verticalAlign: "top" }}>
                    <Link
                      href={`/painel-analista?analistaId=${l.id}`}
                      className="font-extrabold underline-offset-2 hover:underline"
                      style={{ color: "var(--text)" }}
                      title="Ver painel desse analista"
                    >
                      {l.nome}
                    </Link>
                    <div className="text-[11px] font-mono" style={{ color: "var(--text-mute)" }}>
                      {l.cpfMascarado}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-soft)" }}>
                      {l.email}
                    </div>
                  </td>
                  <td className="center">
                    <span className={`badge ${l.ativo ? "b-entregue" : "b-empenhado"}`}>
                      {l.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: "var(--text-soft)" }}>
                    {tempoNaPlataforma(l.criadoEm)}
                    <div className="text-[10px]" style={{ color: "var(--text-mute)" }}>
                      desde {l.criadoEm.toLocaleDateString("pt-BR")}
                    </div>
                  </td>
                  <td className="num strong">
                    {l.vinculosAtivos}
                    {l.vinculosEncerrados > 0 && (
                      <div className="text-[10px] font-normal" style={{ color: "var(--text-mute)" }}>
                        +{l.vinculosEncerrados} encerrado{l.vinculosEncerrados > 1 ? "s" : ""}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {l.percentualMedio > 0 ? `${l.percentualMedio.toFixed(1)}%` : "—"}
                  </td>
                  <td className="num strong">{l.fixoMensalAtivo > 0 ? brlCompacto(l.fixoMensalAtivo) : "—"}</td>
                  <td className="num" style={{ color: "var(--text)", fontWeight: 700 }}>
                    {l.carteiraSobGestao > 0 ? brlCompacto(l.carteiraSobGestao) : "—"}
                  </td>
                  <td className="num" style={{ color: "var(--mint-deep)", fontWeight: 700 }}>
                    {brlCompacto(l.fixoPagoAcumulado + l.comissaoVarPaga)}
                  </td>
                  <td className="num" style={{ color: l.comissaoVarAPagar > 0 ? "var(--primary-deep)" : "var(--text-mute)", fontWeight: 700 }}>
                    {l.comissaoVarAPagar > 0 ? brlCompacto(l.comissaoVarAPagar) : "—"}
                  </td>
                  <td className="text-xs" style={{ color: "var(--text-soft)" }}>
                    {l.clientesAtendidos.length === 0
                      ? "—"
                      : l.clientesAtendidos.slice(0, 2).join(" · ") +
                        (l.clientesAtendidos.length > 2 ? ` +${l.clientesAtendidos.length - 2}` : "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Atalho */}
      <p className="mt-6 text-center text-xs" style={{ color: "var(--text-mute)" }}>
        Cada analista pode ter múltiplos vínculos com empresas fornecedoras. As comissões variáveis (5–10% sobre execuções) são calculadas automaticamente nas execuções com data de pagamento {">"}= data de início do vínculo.
      </p>
    </div>
  );
}
