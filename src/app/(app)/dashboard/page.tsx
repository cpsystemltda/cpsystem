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
import { dadosPorUf, extrairUf } from "@/lib/agregacaoUf";
import { coletarPinsOrgaos } from "@/lib/pinsOrgaos";
import { coletarPinsEntregas } from "@/lib/pinsEntregas";
import { MapaBrasil } from "@/components/MapaBrasil";
import { ClientesMapaSync } from "@/components/ClientesMapaSync";
import { filtroEmpresaWhere, lerEmpresaSelecionada } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { Block } from "@/components/ui/Block";
import { KPI, CurrencyValue } from "@/components/ui/KPI";
import { ChartCard } from "@/components/ui/ChartCard";
import { TimelineVencimentos } from "@/components/TimelineVencimentos";
import { UploadInteligenteCard } from "@/components/UploadInteligenteCard";
import { labelCurtoInstrumento, labelInstrumento } from "@/lib/instrumentoLabel";
import type { InstrumentoContratual } from "@/generated/prisma/client";
import { HonorariosAnalistaBloco } from "@/components/HonorariosAnalistaBloco";

const ROTULO_STATUS: Record<string, string> = {
  EMPENHADO: "Empenhado",
  PEDIDO_RECEBIDO: "Pedido recebido",
  EM_TRANSITO: "Em trânsito/Em execução",
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
    empresasDaConta,
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
    prisma.empresa.findMany({ where: { contaId }, select: { id: true, cnpj: true } }),
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
        orgaoEndereco: true,
      },
    }),
    prisma.contrato.findMany({
      where: { empresa: filtroEmpresa, vigenciaFim: { gte: hoje } },
      select: {
        id: true,
        numero: true,
        orgaoNome: true,
        tipo: true,
        vigenciaFim: true,
        itens: { select: { valorTotal: true } },
      },
    }),
    prisma.ata.findMany({
      where: { empresa: filtroEmpresa, vigenciaFim: { gte: hoje } },
      select: {
        id: true,
        numero: true,
        tipo: true,
        vigenciaFim: true,
        orgaoNome: true,
        orgaoCnpj: true,
        orgaoEndereco: true,
        itens: { select: { valorTotal: true } },
        orgaos: { select: { cnpj: true, nome: true, endereco: true } },
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
        instrumento: true,
        vigenciaFim: true,
        dataPrevistaExecucao: true,
        empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      },
      orderBy: [{ dataPrevistaExecucao: "asc" }, { vigenciaFim: "asc" }],
      // Take maior pra capturar agenda da semana corrente + lista geral
      take: 50,
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

  // === Honorários do analista ===
  // Bloco só aparece se a empresa tem vínculo ativo com analista. Cobre as
  // duas semânticas: fixo mensal (PagamentoFixoMensal) e variável por
  // execução (ComissaoExecucao).
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
  const temVinculoAnalista = linhasFixoBruto.length > 0 || comissoesVarBruto.length > 0;

  // Pins geocodificados — fora do Promise.all principal porque a primeira
  // chamada pode bater no Nominatim (até 5-6 segundos). Cache em
  // OrgaoGeocode garante que carregas subsequentes sejam instantâneas.
  // Falha silenciosa: pins vazio = fallback no choropleth.
  const pinsOrgaos = await coletarPinsOrgaos(contaId, empresaIdSelecionada ?? undefined).catch(
    () => [],
  );
  // Pins de endereços de entrega cadastrados (toggle "Entregas" no mapa).
  // Falha silenciosa pelo mesmo motivo do pinsOrgaos.
  const pinsEntregas = await coletarPinsEntregas(contaId, empresaIdSelecionada ?? undefined).catch(
    () => [],
  );

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

  // Fórmula determinística (briefing Igor): saldo disponível = carteira
  // contratada (Atas+Contratos vigentes) menos o que já entrou em execução
  // efetiva. Antes era um filtro por status dos empenhos, o que dava número
  // diferente do "Contratados − Executados" esperado.
  const valoresAExecutar = Math.max(0, valoresContratados - valoresExecutados);

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

  // Total contratado = carteira de Atas + Contratos vigentes (denominador).
  // % executado = quanto dessa carteira já virou empenho com status >= ENTREGUE
  // (valoresExecutados já agrega ENTREGUE/NF_EMITIDA/NF_ENCAMINHADA/PAGO; PAGO é
  // subset, NÃO somar separadamente). Quando a carteira é zero mas há execução
  // (caso raro: atas vencidas com empenhos recentes), evita Infinity.
  const totalContratado = valoresContratados;
  const pctExecutado =
    totalContratado > 0
      ? Math.min(100, Math.round((valoresExecutados / totalContratado) * 100))
      : valoresExecutados > 0
        ? 100
        : 0;

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

  // Agenda da semana corrente (segunda a domingo). Recorta proximasEntregas
  // pelo intervalo. Usa dataPrevistaExecucao quando preenchida, senão
  // vigenciaFim como proxy de "data limite".
  const inicioSemana = (() => {
    const d = new Date(hoje);
    d.setHours(0, 0, 0, 0);
    // getDay: 0=domingo, 1=segunda... — converte pra semana iniciando na seg
    const diaSemana = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diaSemana);
    return d;
  })();
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(fimSemana.getDate() + 7);
  const agendaSemana = proximasEntregas
    .map((e) => ({ ...e, limite: e.dataPrevistaExecucao ?? e.vigenciaFim }))
    .filter((e) => e.limite >= inicioSemana && e.limite < fimSemana)
    .sort((a, b) => a.limite.getTime() - b.limite.getTime());

  // Lista única pra TimelineVencimentos: Atas + Contratos com vigência em
  // até 120 dias. Sort feito no componente client (pra reagir aos filtros).
  const itensTimeline = [
    ...atasVigentesDetalhe.map((a) => ({
      id: a.id,
      tipo: "ata" as const,
      numero: a.numero,
      orgaoNome: a.orgaoNome,
      vigenciaFim: a.vigenciaFim,
    })),
    ...contratosVigentesDetalhe.map((c) => ({
      id: c.id,
      tipo: "contrato" as const,
      numero: c.numero,
      orgaoNome: c.orgaoNome,
      vigenciaFim: c.vigenciaFim,
    })),
  ];

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

  // Órgãos atendidos (distintos) — empenhos + Atas (gerenciador + participantes).
  // CNPJs vazios e CNPJs das próprias empresas da conta são excluídos
  // (defesa contra erro de digitação em que o usuário coloca o próprio CNPJ
  // no campo do órgão público).
  const cnpjsDasEmpresas = new Set(empresasDaConta.map((e) => e.cnpj.replace(/\D/g, "")));
  const orgaosUnicos = new Set<string>();
  function adicionarOrgao(cnpjBruto: string | null | undefined) {
    if (!cnpjBruto) return;
    const cnpj = cnpjBruto.replace(/\D/g, "");
    if (!cnpj) return;
    if (cnpjsDasEmpresas.has(cnpj)) return; // não conta empresa fornecedora
    orgaosUnicos.add(cnpj);
  }
  for (const e of empenhosCompletos) adicionarOrgao(e.orgaoCnpj);
  for (const a of atasVigentesDetalhe) {
    adicionarOrgao(a.orgaoCnpj);
    for (const op of a.orgaos) adicionarOrgao(op.cnpj);
  }
  const qtdOrgaos = orgaosUnicos.size;

  // Ranking de órgãos por valor contratado — soma empenhos + atas vigentes.
  // Mantém também o endereço e CNPJ pra sync lista↔mapa (por UF no
  // choropleth, por pin individual no Leaflet).
  const orgaoMap = new Map<
    string,
    { cnpj: string; nome: string; valor: number; endereco: string | null }
  >();
  for (const e of empenhosCompletos) {
    const cnpjLimpo = (e.orgaoCnpj ?? "").replace(/\D/g, "");
    if (!cnpjLimpo) continue;
    const cur = orgaoMap.get(cnpjLimpo) ?? {
      cnpj: cnpjLimpo,
      nome: e.orgaoNome,
      valor: 0,
      endereco: e.orgaoEndereco ?? null,
    };
    cur.valor += sumItens(e);
    if (!cur.endereco && e.orgaoEndereco) cur.endereco = e.orgaoEndereco;
    orgaoMap.set(cnpjLimpo, cur);
  }
  for (const a of atasVigentesDetalhe) {
    if (!a.orgaoCnpj) continue;
    const cnpjLimpo = a.orgaoCnpj.replace(/\D/g, "");
    if (!cnpjLimpo) continue;
    const valorAta = a.itens.reduce((s, it) => s + it.valorTotal, 0);
    const cur = orgaoMap.get(cnpjLimpo) ?? {
      cnpj: cnpjLimpo,
      nome: a.orgaoNome,
      valor: 0,
      endereco: a.orgaoEndereco ?? null,
    };
    cur.valor += valorAta;
    if (!cur.endereco && a.orgaoEndereco) cur.endereco = a.orgaoEndereco;
    orgaoMap.set(cnpjLimpo, cur);
  }
  const rankingOrgaos = Array.from(orgaoMap.values())
    .map((r) => ({ ...r, uf: extrairUf(r.endereco) }))
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

      {/* Upload Inteligente — drop universal de PDF (camada IA) */}
      <div className="mt-6">
        <UploadInteligenteCard />
      </div>

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
            href="/execucao?status=PAGO"
          />
          <KPI
            tone="rose"
            icon={CreditCard}
            label="Valores a receber"
            value={<CurrencyValue amount={valoresAReceber} />}
            meta={`${nfsPendentes} NFs pendentes`}
            href="/execucao?status=NF_ENCAMINHADA"
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
          <TimelineVencimentos itens={itensTimeline} />
        </div>
      </Block>

      {/* === Honorários do analista (só aparece se a empresa tem vínculo ativo) === */}
      {temVinculoAnalista && (
        <HonorariosAnalistaBloco
          fixosPendentes={linhasFixoPendentes}
          variaveisPendentes={comissoesVarPendentes}
          totalPagoMes={totalPagoFixoMes}
          totalAtrasado={totalAtrasadoFixo}
          totalAPagar={totalAPagarFixoMes + totalAPagarVar}
        />
      )}

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
            label="Execuções em andamento"
            value={empenhosEmExecucao}
            meta="Empenhos, AE, OS, AC e Cartas-Contrato em curso"
            href="/execucao"
          />
        </div>

        <div className="mt-3.5">
          <AgendaSemana
            entregas={agendaSemana}
            inicio={inicioSemana}
            fim={fimSemana}
            hoje={hoje}
          />
        </div>

        <div className="mt-3.5">
          <TabelaLogistica entregas={proximasEntregas.slice(0, 6)} hoje={hoje} />
        </div>
      </Block>

      {/* === Bloco V — Clientes === */}
      <Block numero="05" eyebrow="Carteira de órgãos" titulo="Clientes atendidos">
        {dadosUf.length === 0 ? (
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
            <div
              className="grid place-items-center rounded-2xl"
              style={{
                border: "0.5px dashed var(--hairline)",
                background: "rgba(15,14,12,0.02)",
                minHeight: "160px",
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
          </div>
        ) : (
          <ClientesMapaSync
            clientes={clientesTabela}
            dadosUf={dadosUf}
            pins={pinsOrgaos}
            pinsEntregas={pinsEntregas}
            kpiSlot={
              <KPI
                tone="rose"
                size="hero"
                icon={Building2}
                label="Órgãos atendidos"
                value={qtdOrgaos}
                meta="Distintos · CNPJ único"
              />
            }
          />
        )}

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
  const barras: { val: number; cor: string; rotulo: string }[] = [
    { val: recebido, cor: "linear-gradient(180deg, #5DD8B6, #2EAB85)", rotulo: "Recebidos" },
    { val: aReceber, cor: "linear-gradient(180deg, #F0B8A8, #C66B4A)", rotulo: "A receber" },
    { val: aExecutar, cor: "linear-gradient(180deg, #C5B4FF, #8E73E0)", rotulo: "A executar" },
  ];
  // Eixo Y — calcula 4 ticks múltiplos de mil/milhão pra "respirar" o gráfico
  const escala = (() => {
    if (max >= 1_000_000) return Math.ceil(max / 100_000) * 100_000;
    if (max >= 100_000) return Math.ceil(max / 50_000) * 50_000;
    if (max >= 10_000) return Math.ceil(max / 25_000) * 25_000 || 25_000;
    return Math.ceil(max / 1_000) * 1_000 || 1_000;
  })();
  const ticks = [0, escala / 4, escala / 2, (escala * 3) / 4, escala].reverse();
  const alturaGrafico = 220;

  return (
    <div className="flex gap-3">
      {/* Eixo Y */}
      <div
        className="flex flex-col justify-between text-[11px] font-semibold"
        style={{ color: "var(--text-mute)", height: `${alturaGrafico}px`, paddingBottom: "2px" }}
      >
        {ticks.map((t) => (
          <span key={t} className="tabular leading-none">
            {brlCompacto(t)}
          </span>
        ))}
      </div>

      {/* Área do gráfico com gridlines */}
      <div className="flex-1">
        <div
          className="relative flex items-end gap-10 px-2"
          style={{ height: `${alturaGrafico}px` }}
        >
          {/* Gridlines horizontais */}
          {ticks.map((t, i) => (
            <span
              key={`grid-${t}`}
              className="absolute left-0 right-0 h-px"
              style={{
                top: `${(i / (ticks.length - 1)) * 100}%`,
                background: "rgba(15,14,12,0.06)",
              }}
            />
          ))}
          {barras.map((b) => {
            const alturaPx = Math.max(2, Math.round((b.val / escala) * (alturaGrafico - 30)));
            return (
              <div
                key={b.rotulo}
                className="relative z-[1] flex flex-1 flex-col items-center justify-end gap-2"
                style={{ height: "100%" }}
              >
                <span
                  className="tabular text-[11px] font-extrabold"
                  style={{ color: "var(--text)" }}
                >
                  {brlCompacto(b.val)}
                </span>
                <div
                  className="w-full max-w-[72px]"
                  style={{
                    height: `${alturaPx}px`,
                    background: b.cor,
                    borderRadius: "12px 12px 4px 4px",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px -6px rgba(20,16,8,0.16)",
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* Rótulos abaixo das barras */}
        <div
          className="mt-3 flex gap-10 px-2 text-[12px] font-semibold"
          style={{ color: "var(--text-soft)" }}
        >
          {barras.map((b) => (
            <span key={b.rotulo} className="flex-1 text-center">
              {b.rotulo}
            </span>
          ))}
        </div>
      </div>
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
  const radius = 92;
  const circ = 2 * Math.PI * radius;
  const dashoffset = circ - (circ * pct) / 100;
  return (
    <div className="flex flex-col items-center justify-center py-3">
      <div className="relative">
        <svg
          width="240"
          height="240"
          viewBox="0 0 240 240"
          style={{ filter: "drop-shadow(0 8px 24px rgba(212,175,55,0.18))" }}
        >
          <defs>
            <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E8C875" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#A88947" />
            </linearGradient>
          </defs>
          {/* Anel de fundo (parte vazia do donut) */}
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            stroke="rgba(15,14,12,0.06)"
            strokeWidth="22"
          />
          {/* Anel preenchido (executado) */}
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            stroke="url(#donutGrad)"
            strokeWidth="22"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 120 120)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="tabular text-[72px] font-extrabold leading-none"
            style={{
              background: "linear-gradient(180deg, var(--primary-deep), var(--primary))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.06em",
            }}
          >
            {pct}%
          </div>
          <div
            className="mt-2 text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: "0.32em", color: "var(--primary-deep)" }}
          >
            executado
          </div>
        </div>
      </div>
      <div
        className="mt-4 text-center text-[12px] font-semibold"
        style={{ color: "var(--text-soft)" }}
      >
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
  const faixas: { rotuloCurto: string; rotuloLongo: string; valor: number; cor: string; glow: string }[] = [
    { rotuloCurto: "< 30d", rotuloLongo: "Em menos de 30 dias", valor: ate30, cor: "var(--coral)", glow: "var(--coral-glow)" },
    { rotuloCurto: "30–60d", rotuloLongo: "Entre 30 e 60 dias", valor: de30a60, cor: "var(--rose)", glow: "var(--rose-glow)" },
    { rotuloCurto: "60–90d", rotuloLongo: "Entre 60 e 90 dias", valor: de60a90, cor: "var(--primary)", glow: "var(--primary-glow)" },
    { rotuloCurto: "90–180d", rotuloLongo: "Entre 90 e 180 dias", valor: de90a180, cor: "var(--lavender)", glow: "var(--lavender-glow)" },
    { rotuloCurto: "Até 12m", rotuloLongo: "Em até 12 meses", valor: ate12meses, cor: "var(--sky)", glow: "var(--sky-glow)" },
    { rotuloCurto: "+12m", rotuloLongo: "Acima de 12 meses", valor: acima12meses, cor: "var(--mint)", glow: "var(--mint-glow)" },
  ];
  const max = Math.max(1, ...faixas.map((f) => f.valor));
  const total = faixas.reduce((acc, f) => acc + f.valor, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Grid 6 colunas — compacto, todas faixas visíveis lado a lado.
          Tiles com valor > 0 ganham fundo saturado + sombra; zero fica suave. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {faixas.map((f) => {
          const ativo = f.valor > 0;
          const pct = (f.valor / max) * 100;
          return (
            <div
              key={f.rotuloLongo}
              className="relative flex flex-col items-start justify-between gap-2 overflow-hidden rounded-2xl px-3 py-3 transition"
              title={f.rotuloLongo}
              style={{
                background: ativo
                  ? `linear-gradient(135deg, ${f.cor}22, ${f.cor}0d)`
                  : "rgba(15,14,12,0.03)",
                border: `0.5px solid ${ativo ? `${f.cor}55` : "rgba(15,14,12,0.06)"}`,
                boxShadow: ativo ? `0 4px 18px ${f.glow}` : "none",
                minHeight: "76px",
              }}
            >
              {/* topo: dot + rótulo curto */}
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: ativo ? f.cor : "rgba(15,14,12,0.18)",
                    boxShadow: ativo ? `0 0 8px ${f.glow}` : "none",
                  }}
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: ativo ? "var(--text)" : "var(--text-mute)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {f.rotuloCurto}
                </span>
              </div>

              {/* número grande */}
              <span
                className="text-[26px] font-extrabold leading-none tabular-nums"
                style={{
                  color: ativo ? "var(--text)" : "var(--text-mute)",
                  letterSpacing: "-0.04em",
                  opacity: ativo ? 1 : 0.35,
                }}
              >
                {f.valor}
              </span>

              {/* trilho sutil no rodapé com a proporção */}
              <div
                className="h-[3px] w-full overflow-hidden rounded-full"
                style={{ background: "rgba(15,14,12,0.05)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: ativo ? `${Math.max(8, pct)}%` : "0%",
                    background: `linear-gradient(90deg, ${f.cor}aa, ${f.cor})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo abaixo do grid */}
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2"
        style={{ background: "rgba(15,14,12,0.03)" }}
      >
        <span
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
        >
          Total no horizonte
        </span>
        <span
          className="text-[14px] font-extrabold tabular-nums"
          style={{ color: total > 0 ? "var(--text)" : "var(--text-mute)" }}
        >
          {total} {total === 1 ? "vencimento" : "vencimentos"}
        </span>
      </div>
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
    instrumento: InstrumentoContratual;
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
            <th>Registro</th>
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
                <td className="num">{labelCurtoInstrumento(e.instrumento)} {e.numero}</td>
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

// Agenda da semana corrente (segunda a domingo) — empenhos cujo prazo de
// execução cai no intervalo. Renderiza em 7 colunas (dia da semana) com os
// itens agrupados; se um dia está vazio mostra "—" pra dar previsibilidade
// visual.
function AgendaSemana({
  entregas,
  inicio,
  fim,
  hoje,
}: {
  entregas: {
    id: string;
    numero: string;
    objeto: string;
    orgaoNome: string;
    status: string;
    instrumento: InstrumentoContratual;
    limite: Date;
  }[];
  inicio: Date;
  fim: Date;
  hoje: Date;
}) {
  const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const hojeNorm = new Date(hoje);
  hojeNorm.setHours(0, 0, 0, 0);

  // Agrupa por offset 0..6 a partir do início da semana
  const porDia: Map<number, typeof entregas> = new Map();
  for (let i = 0; i < 7; i++) porDia.set(i, []);
  for (const e of entregas) {
    const ms = e.limite.getTime() - inicio.getTime();
    const dia = Math.floor(ms / 86400000);
    if (dia >= 0 && dia < 7) porDia.get(dia)!.push(e);
  }

  const total = entregas.length;
  const fimMostrar = new Date(fim.getTime() - 86400000);

  return (
    <section
      className="glass overflow-hidden rounded-[20px] px-5 py-5"
      style={{ border: "0.5px solid var(--hairline)" }}
    >
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3
            className="text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Agenda da semana
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>
            {inicio.toLocaleDateString("pt-BR")} → {fimMostrar.toLocaleDateString("pt-BR")} · {total} execução(ões) com prazo nesta semana
          </p>
        </div>
      </header>

      {total === 0 ? (
        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{ border: "0.5px dashed var(--hairline)" }}
        >
          <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
            Sem entregas previstas para esta semana.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
            Empenhos com prazo entre {inicio.toLocaleDateString("pt-BR")} e {fimMostrar.toLocaleDateString("pt-BR")}.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-7">
          {DIAS.map((label, idx) => {
            const dataDia = new Date(inicio);
            dataDia.setDate(dataDia.getDate() + idx);
            const ehHoje = dataDia.getTime() === hojeNorm.getTime();
            const itens = porDia.get(idx) ?? [];
            return (
              <div
                key={idx}
                className="rounded-xl px-3 py-2"
                style={{
                  background: ehHoje ? "rgba(212,175,55,0.14)" : "rgba(15,14,12,0.03)",
                  border: ehHoje
                    ? "0.5px solid rgba(168,137,71,0.5)"
                    : "0.5px solid var(--hairline)",
                  minHeight: "92px",
                }}
              >
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      color: ehHoje ? "var(--primary-deep)" : "var(--text-mute)",
                    }}
                  >
                    {label} {dataDia.getDate().toString().padStart(2, "0")}
                  </span>
                  {ehHoje && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold"
                      style={{
                        background: "var(--primary-deep)",
                        color: "white",
                        letterSpacing: "0.06em",
                      }}
                    >
                      HOJE
                    </span>
                  )}
                </div>
                {itens.length === 0 ? (
                  <p className="text-[11px]" style={{ color: "var(--text-mute)" }}>
                    —
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {itens.map((e) => {
                      const atrasado = e.limite < hojeNorm;
                      return (
                        <li key={e.id}>
                          <Link
                            href={`/execucao/${e.id}`}
                            className="block rounded px-1.5 py-1 text-[11px] hover:bg-white/70"
                            style={{
                              color: atrasado ? "var(--coral-deep)" : "var(--text)",
                              background: "rgba(255,255,255,0.5)",
                              border: "0.5px solid var(--hairline)",
                            }}
                            title={`${labelInstrumento(e.instrumento)} ${e.numero} · ${e.orgaoNome} · ${e.objeto}`}
                          >
                            <p className="truncate font-bold">{labelCurtoInstrumento(e.instrumento)} {e.numero}</p>
                            <p className="truncate" style={{ color: "var(--text-soft)" }}>
                              {e.orgaoNome}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
