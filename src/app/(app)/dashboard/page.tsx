import Link from "next/link";
import {
  Building2,
  FileText,
  ClipboardList,
  Truck,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Calendar,
  MapPin,
  DollarSign,
  CircleDollarSign,
  Wallet,
  CreditCard,
  RotateCcw,
  CheckCircle,
  Scale,
  Clock,
} from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dadosPorUf } from "@/lib/agregacaoUf";
import { MapaBrasil } from "@/components/MapaBrasil";
import { filtroEmpresaWhere, lerEmpresaSelecionada } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { Block } from "@/components/ui/Block";
import { KPI, CurrencyValue } from "@/components/ui/KPI";
import { ChartCard } from "@/components/ui/ChartCard";

const ROTULO_STATUS: Record<string, string> = {
  EMPENHADO: "Empenhado",
  PEDIDO_RECEBIDO: "Pedido recebido",
  EM_TRANSITO: "Em trânsito",
  ENTREGUE: "Entregue",
  NF_EMITIDA: "NF emitida",
  NF_ENCAMINHADA: "NF encaminhada",
  PAGO: "Pago",
};

const CLASSE_STATUS: Record<string, string> = {
  EMPENHADO: "b-empenhado",
  PEDIDO_RECEBIDO: "b-pedido",
  EM_TRANSITO: "b-transito",
  ENTREGUE: "b-entregue",
  NF_EMITIDA: "b-nf-emitida",
  NF_ENCAMINHADA: "b-nf-encam",
  PAGO: "b-entregue",
};

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

export default async function DashboardPage() {
  const usuario = await exigirUsuario();
  const contaId = usuario.contaId;
  const filtroEmpresa = await filtroEmpresaWhere(contaId);
  const empresaIdSelecionada = await lerEmpresaSelecionada();
  const hoje = new Date();
  const fimAno = new Date(hoje.getFullYear(), 11, 31);
  const em30dias = new Date(hoje.getTime() + 30 * 86400000);

  const [
    qtdEmpresas,
    atasVigentes,
    contratosVigentes,
    atasVencidas,
    contratosVencidos,
    empenhosCompletos,
    contratosVigentesDetalhe,
    atasVigentesDetalhe,
    proximasEntregas,
    dadosUf,
    procedimentos,
    reajustesPendentes,
  ] = await Promise.all([
    prisma.empresa.count({ where: { contaId } }),
    prisma.ata.count({ where: { empresa: filtroEmpresa, vigenciaFim: { gte: hoje } } }),
    prisma.contrato.count({ where: { empresa: filtroEmpresa, vigenciaFim: { gte: hoje } } }),
    prisma.ata.count({ where: { empresa: filtroEmpresa, vigenciaFim: { lt: hoje } } }),
    prisma.contrato.count({ where: { empresa: filtroEmpresa, vigenciaFim: { lt: hoje } } }),
    prisma.empenho.findMany({
      where: { empresa: filtroEmpresa },
      select: {
        id: true,
        status: true,
        tipo: true,
        vigenciaFim: true,
        dataPrevistaExecucao: true,
        dataPagamento: true,
        itens: { select: { valorTotal: true } },
        orgaoNome: true,
        orgaoCnpj: true,
      },
    }),
    prisma.contrato.findMany({
      where: { empresa: filtroEmpresa, vigenciaFim: { gte: hoje } },
      select: { tipo: true, vigenciaFim: true, itens: { select: { valorTotal: true } } },
    }),
    prisma.ata.findMany({
      where: { empresa: filtroEmpresa, vigenciaFim: { gte: hoje } },
      select: {
        tipo: true,
        vigenciaFim: true,
        orgaoNome: true,
        orgaoCnpj: true,
        itens: { select: { valorTotal: true } },
        orgaos: { select: { cnpj: true, nome: true } },
      },
    }),
    prisma.empenho.findMany({
      where: {
        empresa: filtroEmpresa,
        status: { not: "PAGO" },
      },
      select: {
        id: true,
        numero: true,
        objeto: true,
        orgaoNome: true,
        status: true,
        vigenciaFim: true,
        dataPrevistaExecucao: true,
        empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      },
      orderBy: [{ dataPrevistaExecucao: "asc" }, { vigenciaFim: "asc" }],
      take: 6,
    }),
    dadosPorUf(contaId, empresaIdSelecionada ?? undefined),
    prisma.procedimentoApuratorio.findMany({
      where: {
        OR: [
          { empenho: { empresa: filtroEmpresa } },
          { contrato: { empresa: filtroEmpresa } },
          { ata: { empresa: filtroEmpresa } },
        ],
      },
      select: {
        id: true,
        assunto: true,
        dataAbertura: true,
        prazoDefesaDias: true,
        arquivado: true,
        ata: { select: { orgaoNome: true } },
        contrato: { select: { orgaoNome: true } },
        empenho: { select: { orgaoNome: true } },
        penalidades: { select: { tipo: true, valor: true } },
      },
    }),
    prisma.ata.count({
      where: {
        empresa: filtroEmpresa,
        vigenciaFim: { gte: hoje },
        marcoOrcamentoEstimado: { gte: hoje, lte: em30dias },
      },
    }).catch(() => 0),
  ]);

  // === Cálculos financeiros (semântica do briefing) ===
  const sumItens = (e: { itens: { valorTotal: number }[] }) =>
    e.itens.reduce((s, i) => s + i.valorTotal, 0);

  // Empenhos vigentes (não pagos, dentro da vigência)
  const empenhosVigentes = empenhosCompletos.filter(
    (e) => e.vigenciaFim >= hoje && e.status !== "PAGO",
  );

  // Valor total das Atas vigentes (Sistema de Registro de Preços)
  const valorTotalAtasVigentes = atasVigentesDetalhe.reduce(
    (s, a) => s + a.itens.reduce((ss, it) => ss + it.valorTotal, 0),
    0,
  );

  // Valor total dos Contratos vigentes
  const valorTotalContratosVigentes = contratosVigentesDetalhe.reduce(
    (s, c) => s + c.itens.reduce((ss, it) => ss + it.valorTotal, 0),
    0,
  );

  // Valor total contratado: Atas + Contratos vigentes (carteira disponível pra execução).
  // Empenhos derivam destes instrumentos — não soma separadamente pra evitar dupla contagem.
  const valoresContratados = valorTotalAtasVigentes + valorTotalContratosVigentes;

  const valoresExecutados = empenhosCompletos
    .filter((e) => ["ENTREGUE", "NF_EMITIDA", "NF_ENCAMINHADA", "PAGO"].includes(e.status))
    .reduce((s, e) => s + sumItens(e), 0);

  const valoresAExecutar = empenhosCompletos
    .filter((e) => ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO"].includes(e.status))
    .reduce((s, e) => s + sumItens(e), 0);

  const valoresRecebidos = empenhosCompletos
    .filter((e) => e.status === "PAGO")
    .reduce((s, e) => s + sumItens(e), 0);

  const valoresAReceber = empenhosCompletos
    .filter((e) => ["NF_EMITIDA", "NF_ENCAMINHADA"].includes(e.status))
    .reduce((s, e) => s + sumItens(e), 0);

  const empenhosPagos = empenhosCompletos.filter((e) => e.status === "PAGO").length;
  const nfsPendentes = empenhosCompletos.filter((e) =>
    ["NF_EMITIDA", "NF_ENCAMINHADA"].includes(e.status),
  ).length;

  const totalContratado = valoresContratados + valoresRecebidos;
  const pctExecutado =
    totalContratado > 0 ? Math.round((valoresExecutados / totalContratado) * 100) : 0;

  // Logística: empenhos em execução (status entre EMPENHADO..NF_ENCAMINHADA)
  const empenhosEmExecucao = empenhosCompletos.filter((e) =>
    ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO", "NF_EMITIDA", "NF_ENCAMINHADA"].includes(
      e.status,
    ),
  ).length;

  const contratosEmExecucao = await prisma.contrato.count({
    where: {
      empresa: filtroEmpresa,
      vigenciaFim: { gte: hoje },
      empenhos: { some: { status: { not: "PAGO" } } },
    },
  });

  // Vencimentos por mês — janela rolling de 12 meses a partir de hoje
  // (antes era ano corrente; meses passados ficavam sempre 0).
  const vencimentosPorMes = new Array(12).fill(0);
  const rotulosMeses: string[] = [];
  for (let i = 0; i < 12; i++) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    rotulosMeses.push(ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""));
  }
  const fimJanela = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 0);
  function bucketIndex(d: Date): number {
    return (d.getFullYear() - hoje.getFullYear()) * 12 + (d.getMonth() - hoje.getMonth());
  }
  for (const c of contratosVigentesDetalhe) {
    if (c.vigenciaFim < hoje || c.vigenciaFim > fimJanela) continue;
    const idx = bucketIndex(c.vigenciaFim);
    if (idx >= 0 && idx < 12) vencimentosPorMes[idx] += 1;
  }
  for (const a of atasVigentesDetalhe) {
    if (a.vigenciaFim < hoje || a.vigenciaFim > fimJanela) continue;
    const idx = bucketIndex(a.vigenciaFim);
    if (idx >= 0 && idx < 12) vencimentosPorMes[idx] += 1;
  }
  const maxVenc = Math.max(1, ...vencimentosPorMes);

  // Contratos contínuos (briefing Igor): só tipos contínuos, agrupados em faixas
  // de vencimento (alertas de renovação). Sem "renovação automática" (não existe).
  const continuoTipos = ["FORNECIMENTO_CONTINUO", "SERVICOS_CONTINUOS"];
  const contratosContinuos = contratosVigentesDetalhe.filter((c) =>
    continuoTipos.includes(c.tipo as string),
  );
  const faixasContinuos = {
    ate30: 0,
    de30a60: 0,
    de60a90: 0,
    de90a180: 0,
    ate12meses: 0,
    acima12meses: 0,
  };
  for (const c of contratosContinuos) {
    const dias = Math.ceil((c.vigenciaFim.getTime() - hoje.getTime()) / 86400000);
    if (dias < 0) continue;
    if (dias <= 30) faixasContinuos.ate30 += 1;
    else if (dias <= 60) faixasContinuos.de30a60 += 1;
    else if (dias <= 90) faixasContinuos.de60a90 += 1;
    else if (dias <= 180) faixasContinuos.de90a180 += 1;
    else if (dias <= 365) faixasContinuos.ate12meses += 1;
    else faixasContinuos.acima12meses += 1;
  }
  const totalContinuos = contratosContinuos.length;

  // Órgãos atendidos (distintos) — empenhos + Atas (gerenciador + participantes)
  const orgaosUnicos = new Set<string>(empenhosCompletos.map((e) => e.orgaoCnpj));
  for (const a of atasVigentesDetalhe) {
    if (a.orgaoCnpj) orgaosUnicos.add(a.orgaoCnpj);
    for (const op of a.orgaos) {
      if (op.cnpj) orgaosUnicos.add(op.cnpj);
    }
  }
  const qtdOrgaos = orgaosUnicos.size;

  // Ranking de órgãos por valor contratado — soma empenhos + atas vigentes
  const orgaoMap = new Map<string, { nome: string; valor: number }>();
  for (const e of empenhosCompletos) {
    const cur = orgaoMap.get(e.orgaoCnpj) ?? { nome: e.orgaoNome, valor: 0 };
    cur.valor += sumItens(e);
    orgaoMap.set(e.orgaoCnpj, cur);
  }
  for (const a of atasVigentesDetalhe) {
    if (!a.orgaoCnpj) continue;
    const valorAta = a.itens.reduce((s, it) => s + it.valorTotal, 0);
    const cur = orgaoMap.get(a.orgaoCnpj) ?? { nome: a.orgaoNome, valor: 0 };
    cur.valor += valorAta;
    orgaoMap.set(a.orgaoCnpj, cur);
  }
  const rankingOrgaos = Array.from(orgaoMap.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
  const maiorRanking = rankingOrgaos[0]?.valor ?? 1;

  // Tabela clientes (órgão + UF a partir de dadosUf)
  // Como agregação, vamos usar os 5 primeiros do ranking
  const clientesTabela = rankingOrgaos.slice(0, 5);

  // Processos apuratórios — em andamento = não arquivado
  const procEmAndamento = procedimentos
    .filter((p) => !p.arquivado)
    .map((p) => ({
      id: p.id,
      assunto: p.assunto,
      orgaoNome:
        p.empenho?.orgaoNome ?? p.contrato?.orgaoNome ?? p.ata?.orgaoNome ?? "—",
      tipoPrincipal: (p.penalidades.find((x) => x.tipo === "MULTA")?.tipo ??
        p.penalidades[0]?.tipo ??
        "MULTA") as string,
      valor: p.penalidades.reduce((s, x) => s + (x.valor ?? 0), 0),
      prazoFinal: new Date(p.dataAbertura.getTime() + p.prazoDefesaDias * 86400000),
    }));
  const valorRiscoMulta = procEmAndamento.reduce((s, p) => s + p.valor, 0);
  const proxPrazoDefesa = procEmAndamento
    .filter((p) => p.prazoFinal >= hoje)
    .sort((a, b) => a.prazoFinal.getTime() - b.prazoFinal.getTime())[0];
  const diasProxPrazo = proxPrazoDefesa
    ? Math.ceil((proxPrazoDefesa.prazoFinal.getTime() - hoje.getTime()) / 86400000)
    : null;

  const trial = usuario.conta.statusAssinatura === "TRIAL" && usuario.conta.trialAteEm;
  const diasTrial = trial
    ? Math.max(0, Math.ceil((usuario.conta.trialAteEm!.getTime() - Date.now()) / 86400000))
    : 0;

  const nomePrimeiro = usuario.nome.split(" ")[0];
  const dataExtenso = hoje.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Saudação por hora local — Brasil/SP (server pode rodar em UTC, então
  // forçamos timezone explícito pra "Bom dia/Boa tarde/Boa noite" bater).
  const horaSP = Number(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }),
  );
  const saudacao = horaSP < 12 ? "Bom dia" : horaSP < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <BannerEmpresaEmFoco contaId={contaId} />

      {/* === Header / Topbar === */}
      <header className="glass mb-[18px] flex items-end justify-between gap-6 rounded-[28px] px-9 py-7">
        <div className="relative z-[1]">
          <p
            className="text-[11px] font-semibold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--primary)" }}
          >
            {dataExtenso}
          </p>
          <h1
            className="mt-2 text-[44px] font-extrabold leading-none"
            style={{ color: "var(--text)", letterSpacing: "-0.045em" }}
          >
            {saudacao},{" "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {nomePrimeiro}.
            </em>
          </h1>
          <p
            className="mt-2 max-w-[580px] text-[14px]"
            style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
          >
            Visão consolidada das suas contratações públicas, posição financeira e logística operacional.
          </p>
        </div>
        <Link href="/contratacoes/nova" className="btn-primary">
          <Plus className="h-4 w-4" /> Nova contratação
        </Link>
      </header>

      {trial && (
        <div
          className="glass-tile t-primary mb-[18px] flex items-center gap-3 rounded-[18px] px-5 py-3.5 text-sm"
          style={{ color: "var(--text)" }}
        >
          <AlertTriangle className="h-5 w-5" style={{ color: "var(--primary-deep)" }} />
          <span>
            Trial gratuito · <strong>{diasTrial} dias restantes</strong>. Ative uma assinatura antes do
            término para não perder acesso.
          </span>
          <Link
            href="/conta/assinatura"
            className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ background: "var(--primary)", color: "#0A0A0A" }}
          >
            Ver planos <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* === Bloco I — Financeiro === */}
      <Block numero="01" eyebrow="Performance financeira" titulo="Financeiro">
        <div className="grid grid-cols-3 gap-3.5">
          <KPI
            tone="primary"
            icon={DollarSign}
            label="Valores contratados"
            value={<CurrencyValue amount={valoresContratados} />}
            meta={`${atasVigentes} ata(s) + ${contratosVigentes} contrato(s) vigente(s)`}
            href="/atas?status=vigentes"
          />
          <KPI
            tone="mint"
            icon={TrendingUp}
            label="Valores executados"
            value={<CurrencyValue amount={valoresExecutados} />}
            meta={`${pctExecutado}% do contratado`}
            href="/execucao"
          />
          <KPI
            tone="lavender"
            icon={Clock}
            label="Valores a executar"
            value={<CurrencyValue amount={valoresAExecutar} />}
            meta="Saldo disponível"
            href="/execucao"
          />
          <KPI
            tone="mint"
            icon={CheckCircle}
            label="Valores recebidos"
            value={<CurrencyValue amount={valoresRecebidos} />}
            meta={`${empenhosPagos} empenhos pagos`}
            href="/execucao"
          />
          <KPI
            tone="rose"
            icon={CreditCard}
            label="Valores a receber"
            value={<CurrencyValue amount={valoresAReceber} />}
            meta={`${nfsPendentes} NFs pendentes`}
            href="/execucao"
          />
          <KPI
            tone="coral"
            icon={AlertTriangle}
            label="Reajuste de preços"
            value={
              <>
                {reajustesPendentes}{" "}
                <span style={{ fontSize: "14px", color: "var(--text-mute)", fontWeight: 600 }}>
                  vencendo
                </span>
              </>
            }
            meta="Em 30 dias ou menos"
            href="/reajustes"
            pulse={reajustesPendentes > 0}
          />
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-3.5">
          <ChartCard
            title="Posição financeira"
            subtitle="Distribuição entre os estágios do contrato"
          >
            <BarsPosicao
              recebido={valoresRecebidos}
              aReceber={valoresAReceber}
              aExecutar={valoresAExecutar}
            />
          </ChartCard>
          <ChartCard
            title="Executado / Contratado"
            subtitle="Quanto do total contratado já foi entregue"
          >
            <DonutChart pct={pctExecutado} executado={valoresExecutados} contratado={totalContratado} />
          </ChartCard>
        </div>
      </Block>

      {/* === Bloco II — Atas & Contratos === */}
      <Block numero="02" eyebrow="Instrumentos vigentes" titulo="Atas & Contratos">
        <div className="grid grid-cols-2 gap-3.5">
          <KPI
            tone="primary"
            size="hero"
            icon={FileText}
            label="Atas vigentes"
            value={atasVigentes}
            meta={
              atasVigentesDetalhe.length > 0
                ? `Próx. vencimento: ${atasVigentesDetalhe
                    .slice()
                    .sort((a, b) => a.vigenciaFim.getTime() - b.vigenciaFim.getTime())[0]
                    .vigenciaFim.toLocaleDateString("pt-BR")}`
                : atasVencidas > 0
                  ? `Nenhuma vigente · ${atasVencidas} vencida(s)`
                  : "Atas de Registro de Preços ativas"
            }
            href="/atas?status=vigentes"
          />
          <KPI
            tone="mint"
            size="hero"
            icon={ClipboardList}
            label="Contratos vigentes"
            value={contratosVigentes}
            meta={
              contratosVigentes === 0 && contratosVencidos > 0
                ? `Nenhum vigente · ${contratosVencidos} vencido(s)`
                : "Contratos administrativos em vigor"
            }
            href="/contratos?status=vigentes"
          />
        </div>

        {(atasVencidas > 0 || contratosVencidos > 0) && (
          <div
            className="glass-tile mt-3.5 flex items-start gap-3 rounded-[16px] px-5 py-4 text-sm"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06)), rgba(255,255,255,0.5)",
              border: "0.5px solid rgba(168,137,71,0.4)",
              color: "var(--text-soft)",
            }}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary-deep)" }} />
            <div>
              <p className="font-extrabold" style={{ color: "var(--primary-deep)" }}>
                Você tem {atasVencidas} ata{atasVencidas !== 1 ? "s" : ""} e {contratosVencidos} contrato
                {contratosVencidos !== 1 ? "s" : ""} com vigência expirada.
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
                Atas/Contratos vencidos não entram nas métricas vigentes do dashboard. Para reativar, edite a vigência em{" "}
                <Link href="/atas?status=vencidas" className="font-bold underline" style={{ color: "var(--primary-deep)" }}>
                  Atas → Vencidas
                </Link>{" "}
                ou{" "}
                <Link href="/contratos?status=vencidas" className="font-bold underline" style={{ color: "var(--primary-deep)" }}>
                  Contratos → Vencidos
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        <div className="mt-3.5">
          <ChartCard
            title="Vencimentos nos próximos 12 meses"
            subtitle="Janela rolling a partir de hoje — antecipe renovações e aditivos"
          >
            <MesesChart dados={vencimentosPorMes} max={maxVenc} rotulos={rotulosMeses} />
          </ChartCard>
        </div>
      </Block>

      {/* === Bloco III — Contratos contínuos (alertas de renovação) === */}
      <Block
        numero="03"
        eyebrow="Recorrentes · alertas de renovação"
        titulo="Contratos contínuos"
      >
        <div className="grid grid-cols-3 gap-3.5" style={{ marginBottom: "18px" }}>
          <KPI
            tone="primary"
            icon={ClipboardList}
            label="Contínuos vigentes"
            value={totalContinuos}
            meta={`${faixasContinuos.ate30 + faixasContinuos.de30a60 + faixasContinuos.de60a90} a renovar nos próximos 90 dias`}
            href="/contratos?status=vigentes"
          />
          <KPI
            tone="coral"
            icon={AlertTriangle}
            label="Crítico (≤ 30 dias)"
            value={faixasContinuos.ate30}
            meta="Inicie a tratativa imediatamente"
            href="/contratos?alerta=30"
            pulse={faixasContinuos.ate30 > 0}
          />
          <KPI
            tone="rose"
            icon={Clock}
            label="Próximos a renovar (60–90d)"
            value={faixasContinuos.de30a60 + faixasContinuos.de60a90}
            meta="Janela ideal de tratativa"
            href="/contratos?alerta=90"
          />
        </div>

        <ChartCard
          title="Vencimentos por faixa"
          subtitle="Antecipe renovações pelas janelas críticas"
        >
          <FaixasVencimentoChart
            ate30={faixasContinuos.ate30}
            de30a60={faixasContinuos.de30a60}
            de60a90={faixasContinuos.de60a90}
            de90a180={faixasContinuos.de90a180}
            ate12meses={faixasContinuos.ate12meses}
            acima12meses={faixasContinuos.acima12meses}
          />
        </ChartCard>
      </Block>

      {/* === Bloco IV — Logística === */}
      <Block numero="04" eyebrow="Operação" titulo="Logística">
        <div className="grid grid-cols-2 gap-3.5">
          <KPI
            tone="lavender"
            size="hero"
            icon={ClipboardList}
            label="Contratos em execução"
            value={contratosEmExecucao}
            meta="Com pelo menos 1 empenho ativo"
            href="/contratos?status=vigentes"
          />
          <KPI
            tone="primary"
            size="hero"
            icon={Truck}
            label="Empenhos em execução"
            value={empenhosEmExecucao}
            meta="Não pagos / não finalizados"
            href="/execucao"
          />
        </div>

        <div className="mt-3.5">
          <TabelaLogistica entregas={proximasEntregas} hoje={hoje} />
        </div>
      </Block>

      {/* === Bloco V — Clientes === */}
      <Block numero="05" eyebrow="Carteira de órgãos" titulo="Clientes atendidos">
        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: "1fr 2fr" }}
        >
          <KPI
            tone="rose"
            size="hero"
            icon={Building2}
            label="Órgãos atendidos"
            value={qtdOrgaos}
            meta="Distintos · CNPJ único"
          />
          <div className="glass-tile relative overflow-hidden rounded-[20px]">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Órgão</th>
                  <th className="num">Valor contratado</th>
                </tr>
              </thead>
              <tbody>
                {clientesTabela.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", color: "var(--text-mute)" }}>
                      Sem dados ainda.
                    </td>
                  </tr>
                ) : (
                  clientesTabela.map((c) => (
                    <tr key={c.nome}>
                      <td className="strong">{c.nome}</td>
                      <td className="num strong">{brl(c.valor)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3.5">
          <ChartCard
            title="Mapa de operações por estado"
            subtitle="Distribuição geográfica — passe o mouse sobre o estado para detalhes"
          >
            {dadosUf.length === 0 ? (
              <div
                className="grid h-[320px] place-items-center rounded-2xl"
                style={{
                  border: "0.5px dashed var(--hairline)",
                  background: "rgba(15,14,12,0.02)",
                }}
              >
                <div className="text-center">
                  <MapPin className="mx-auto h-10 w-10" style={{ color: "var(--text-faint)" }} />
                  <p
                    className="mt-3 text-sm font-semibold"
                    style={{ color: "var(--text-soft)" }}
                  >
                    Sem dados geográficos ainda
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-mute)" }}>
                    Cadastre suas empresas com endereço completo para visualizar o mapa.
                  </p>
                </div>
              </div>
            ) : (
              <MapaBrasil dados={dadosUf} />
            )}
          </ChartCard>
        </div>

        <div className="mt-3.5">
          <ChartCard
            title="Ranking de órgãos por valor contratado"
            subtitle="Onde estão concentrados seus contratos públicos"
          >
            {rankingOrgaos.length === 0 ? (
              <p
                className="grid h-[200px] place-items-center text-sm"
                style={{ color: "var(--text-mute)" }}
              >
                Sem dados.
              </p>
            ) : (
              <div>
                {rankingOrgaos.map((o, i) => (
                  <div
                    key={o.nome}
                    className="flex items-center gap-5 border-b border-[color:var(--hairline)] py-3.5 last:border-b-0"
                  >
                    <div
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(212,175,55,0.22), rgba(212,175,55,0.05))",
                        border: "0.5px solid rgba(212,175,55,0.35)",
                        color: "var(--primary-deep)",
                        letterSpacing: "-0.04em",
                        boxShadow: "0 0 14px rgba(212,175,55,0.18)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div
                      className="w-[220px] truncate text-[14px] font-semibold"
                      style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
                    >
                      {o.nome}
                    </div>
                    <div
                      className="flex-1 overflow-hidden rounded-full"
                      style={{ background: "rgba(15,14,12,0.06)", height: "8px" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(o.valor / maiorRanking) * 100}%`,
                          background:
                            "linear-gradient(90deg, var(--primary-deep), var(--primary-bright))",
                          boxShadow: "0 0 16px var(--primary-glow)",
                        }}
                      />
                    </div>
                    <div
                      className="tabular w-[150px] text-right text-[15px] font-extrabold"
                      style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
                    >
                      {brl(o.valor)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </Block>

      {/* === Bloco VI — Processos apuratórios === */}
      <Block
        numero="06"
        eyebrow="Risco & conformidade"
        titulo="Processos apuratórios"
        tag={procEmAndamento.length === 0 ? undefined : undefined}
      >
        <div className="grid grid-cols-3 gap-3.5">
          <KPI
            tone="coral"
            icon={AlertTriangle}
            label="Em andamento"
            value={procEmAndamento.length}
            meta="Multa, impedimento ou inidoneidade"
          />
          <KPI
            tone="coral"
            icon={DollarSign}
            label="Risco de multa"
            value={<CurrencyValue amount={valorRiscoMulta} />}
            meta="Soma dos valores em apuração"
          />
          <KPI
            tone="primary"
            icon={Clock}
            label="Próximo prazo"
            value={
              diasProxPrazo !== null ? (
                <span style={{ fontSize: "26px" }}>
                  {diasProxPrazo === 0 ? "Hoje" : `${diasProxPrazo}d`}
                </span>
              ) : (
                <span style={{ fontSize: "20px" }}>Sem prazo crítico</span>
              )
            }
            meta={proxPrazoDefesa ? `Defesa em ${formatDate(proxPrazoDefesa.prazoFinal)}` : "Nenhum em aberto"}
          />
        </div>

        {procEmAndamento.length > 0 && (
          <div className="glass-tile mt-3.5 relative overflow-hidden rounded-[20px]">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Órgão</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Prazo</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {procEmAndamento.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td className="strong">{p.orgaoNome}</td>
                    <td>
                      <span
                        className={`badge ${p.tipoPrincipal === "MULTA" ? "b-multa" : "b-impedimento"}`}
                      >
                        {p.tipoPrincipal === "MULTA"
                          ? "Multa"
                          : p.tipoPrincipal === "IMPEDIMENTO_LICITAR"
                            ? "Impedimento"
                            : p.tipoPrincipal === "DECLARACAO_INIDONEIDADE"
                              ? "Inidoneidade"
                              : "Advertência"}
                      </span>
                    </td>
                    <td>{p.assunto}</td>
                    <td className="num">{formatDate(p.prazoFinal)}</td>
                    <td className="num strong">{p.valor > 0 ? brl(p.valor) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>
    </div>
  );
}

/* ============================================================
   Sub-componentes server (gráficos puros, sem JS no cliente)
   ============================================================ */

function BarsPosicao({
  recebido,
  aReceber,
  aExecutar,
}: {
  recebido: number;
  aReceber: number;
  aExecutar: number;
}) {
  const max = Math.max(1, recebido, aReceber, aExecutar);
  const barras: { val: number; cor: string; rotulo: string; glow: string }[] = [
    { val: recebido, cor: "linear-gradient(180deg, var(--mint), #2EAB85)", rotulo: "Recebido", glow: "var(--mint-glow)" },
    { val: aReceber, cor: "linear-gradient(180deg, var(--rose), #C18876)", rotulo: "A receber", glow: "var(--rose-glow)" },
    { val: aExecutar, cor: "linear-gradient(180deg, var(--lavender), #8A7DAD)", rotulo: "A executar", glow: "var(--lavender-glow)" },
  ];
  return (
    <div>
      <div
        className="flex items-end gap-8 px-4"
        style={{ height: "200px", borderBottom: "0.5px solid var(--hairline)" }}
      >
        {barras.map((b) => {
          const alturaPx = Math.max(2, Math.round((b.val / max) * 170));
          return (
            <div
              key={b.rotulo}
              className="flex flex-1 flex-col items-center justify-end gap-3"
              style={{ height: "100%" }}
            >
              <span className="tabular text-[11px] font-semibold" style={{ color: "var(--text)" }}>
                {brlCompacto(b.val)}
              </span>
              <div
                className="relative w-full max-w-[64px]"
                style={{
                  height: `${alturaPx}px`,
                  background: b.cor,
                  borderRadius: "10px 10px 3px 3px",
                  boxShadow: `0 0 28px ${b.glow}`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="mt-4 flex gap-6 px-4 text-[12px] font-medium"
        style={{ color: "var(--text-soft)" }}
      >
        <Legenda cor="var(--mint)" rotulo="Recebido" />
        <Legenda cor="var(--rose)" rotulo="A receber" />
        <Legenda cor="var(--lavender)" rotulo="A executar" />
      </div>
    </div>
  );
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2.5">
      <span
        className="h-2.5 w-2.5 rounded-[3px]"
        style={{ background: cor, boxShadow: `0 0 10px ${cor}` }}
      />
      <span>{rotulo}</span>
    </div>
  );
}

function brlCompacto(n: number): string {
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(2).replace(".", ",")} Bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace(".", ",")} Mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

function DonutChart({
  pct,
  executado,
  contratado,
}: {
  pct: number;
  executado: number;
  contratado: number;
}) {
  const radius = 86;
  const circ = 2 * Math.PI * radius;
  const dashoffset = circ - (circ * pct) / 100;
  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative">
        <svg width="220" height="220" viewBox="0 0 220 220" style={{ filter: "drop-shadow(0 0 30px var(--primary-glow))" }}>
          <defs>
            <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary-bright)" />
              <stop offset="100%" stopColor="var(--primary-deep)" />
            </linearGradient>
          </defs>
          <circle cx="110" cy="110" r={radius} fill="none" stroke="rgba(15,14,12,0.08)" strokeWidth="20" />
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="url(#donutGrad)"
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 110 110)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="text-[56px] font-extrabold leading-none"
            style={{
              background: "linear-gradient(180deg, var(--text), var(--primary-bright))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.06em",
            }}
          >
            {pct}%
          </div>
          <div
            className="mt-2 text-[9px] font-extrabold uppercase"
            style={{ letterSpacing: "0.32em", color: "var(--text-mute)" }}
          >
            executado
          </div>
        </div>
      </div>
      <div className="mt-3.5 text-center text-[12px] font-medium" style={{ color: "var(--text-mute)" }}>
        {brlCompacto(executado)} executados de {brlCompacto(contratado)} contratados
      </div>
    </div>
  );
}

function FaixasVencimentoChart({
  ate30,
  de30a60,
  de60a90,
  de90a180,
  ate12meses,
  acima12meses,
}: {
  ate30: number;
  de30a60: number;
  de60a90: number;
  de90a180: number;
  ate12meses: number;
  acima12meses: number;
}) {
  const faixas: { rotulo: string; valor: number; cor: string; glow: string }[] = [
    { rotulo: "Em menos de 30 dias", valor: ate30, cor: "var(--coral)", glow: "var(--coral-glow)" },
    { rotulo: "Entre 30 e 60 dias", valor: de30a60, cor: "var(--rose)", glow: "var(--rose-glow)" },
    { rotulo: "Entre 60 e 90 dias", valor: de60a90, cor: "var(--primary)", glow: "var(--primary-glow)" },
    { rotulo: "Entre 90 e 180 dias", valor: de90a180, cor: "var(--lavender)", glow: "var(--lavender-glow)" },
    { rotulo: "Em até 12 meses", valor: ate12meses, cor: "var(--sky)", glow: "var(--sky-glow)" },
    { rotulo: "Acima de 12 meses", valor: acima12meses, cor: "var(--mint)", glow: "var(--mint-glow)" },
  ];
  const max = Math.max(1, ...faixas.map((f) => f.valor));

  return (
    <div className="flex flex-col gap-3">
      {faixas.map((f) => {
        const pct = (f.valor / max) * 100;
        return (
          <div key={f.rotulo} className="flex items-center gap-4">
            <div
              className="w-[180px] shrink-0 text-[12px] font-medium"
              style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
            >
              {f.rotulo}
            </div>
            <div
              className="relative flex-1 overflow-hidden rounded-full"
              style={{ background: "rgba(15,14,12,0.06)", height: "20px" }}
            >
              <div
                className="absolute inset-y-0 left-0 flex items-center justify-end pr-2.5 rounded-full"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${f.cor}99, ${f.cor})`,
                  boxShadow: `0 0 16px ${f.glow}`,
                  minWidth: f.valor > 0 ? "32px" : "0",
                }}
              >
                {f.valor > 0 && (
                  <span
                    className="text-[11px] font-extrabold"
                    style={{ color: "#0A0A0A", letterSpacing: "-0.02em" }}
                  >
                    {f.valor}
                  </span>
                )}
              </div>
            </div>
            <div
              className="w-[40px] text-right text-[14px] font-extrabold tabular-nums"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              {f.valor}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MesesChart({ dados, max, rotulos }: { dados: number[]; max: number; rotulos?: string[] }) {
  const mesesFallback = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const meses = rotulos ?? mesesFallback;
  return (
    <div>
      <div
        className="flex items-end gap-3.5 px-3"
        style={{ height: "180px", borderBottom: "0.5px solid var(--hairline)" }}
      >
        {dados.map((v, i) => {
          const isHigh = v > max * 0.6;
          const alturaPx = v === 0 ? 0 : Math.max(4, Math.round((v / max) * 150));
          return (
            <div
              key={i}
              className="flex flex-1 flex-col items-center justify-end gap-2"
              style={{ height: "100%" }}
            >
              <span className="tabular text-[11px] font-semibold" style={{ color: "var(--text)" }}>
                {v}
              </span>
              <div
                className="w-full max-w-[38px]"
                style={{
                  height: `${alturaPx}px`,
                  background: isHigh
                    ? "linear-gradient(180deg, var(--primary), var(--primary-deep))"
                    : "linear-gradient(180deg, rgba(15,14,12,0.16), rgba(15,14,12,0.06))",
                  borderRadius: "8px 8px 2px 2px",
                  boxShadow: isHigh ? "0 0 28px var(--primary-glow)" : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="mt-3 flex gap-3.5 px-3 text-[11px] font-medium capitalize"
        style={{ color: "var(--text-mute)", letterSpacing: "0.04em" }}
      >
        {meses.map((m, i) => (
          <div key={`${m}-${i}`} className="flex-1 text-center">
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabelaLogistica({
  entregas,
  hoje,
}: {
  entregas: {
    id: string;
    numero: string;
    objeto: string;
    orgaoNome: string;
    status: string;
    vigenciaFim: Date;
    dataPrevistaExecucao: Date | null;
    empresa: { nomeFantasia: string | null; razaoSocial: string };
  }[];
  hoje: Date;
}) {
  const emAtraso = entregas.filter((e) => {
    const limite = e.dataPrevistaExecucao ?? e.vigenciaFim;
    return limite < hoje && !["ENTREGUE", "NF_EMITIDA", "NF_ENCAMINHADA", "PAGO"].includes(e.status);
  }).length;

  if (entregas.length === 0) {
    return (
      <div
        className="glass-tile rounded-[20px] py-10 text-center text-sm"
        style={{ color: "var(--text-mute)" }}
      >
        Nenhum empenho em execução. Tudo em dia!
      </div>
    );
  }

  return (
    <div className="glass-tile relative overflow-hidden rounded-[20px]">
      <div
        className="flex items-center justify-between border-b border-[color:var(--hairline)] px-6 py-3.5 text-[12px] font-medium"
        style={{ color: "var(--text-mute)", background: "rgba(0,0,0,0.18)" }}
      >
        <span>
          Ordenado por <strong style={{ color: "var(--text)" }}>data limite</strong> · entregas mais próximas
          no topo
        </span>
        {emAtraso > 0 && (
          <span style={{ color: "var(--coral)", fontWeight: 700 }}>
            ⚠ {emAtraso} em atraso
          </span>
        )}
      </div>
      <table className="table-glass">
        <thead>
          <tr>
            <th>Órgão</th>
            <th>Empenho</th>
            <th>Data limite</th>
            <th>Status</th>
            <th>Atraso</th>
          </tr>
        </thead>
        <tbody>
          {entregas.map((e) => {
            const limite = e.dataPrevistaExecucao ?? e.vigenciaFim;
            const diasAtraso = Math.floor((hoje.getTime() - limite.getTime()) / 86400000);
            const atrasado = diasAtraso > 0;
            return (
              <tr key={e.id} className={atrasado ? "row-alert" : undefined}>
                <td className="strong">{e.orgaoNome}</td>
                <td className="num">EMP {e.numero}</td>
                <td className="num">{formatDate(limite)}</td>
                <td>
                  <span className={`badge ${CLASSE_STATUS[e.status] ?? "b-empenhado"}`}>
                    {ROTULO_STATUS[e.status] ?? e.status}
                  </span>
                </td>
                <td>
                  {atrasado ? (
                    <span style={{ color: "var(--coral)", fontWeight: 700, fontSize: "12px" }}>
                      Sim — {diasAtraso} {diasAtraso === 1 ? "dia" : "dias"}
                    </span>
                  ) : (
                    <span style={{ color: "var(--mint)", fontWeight: 700, fontSize: "12px" }}>
                      Em dia
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
