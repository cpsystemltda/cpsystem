import Link from "next/link";
import { Plus, Coins, TrendingUp, ArrowRight, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContratosBrowser, type ContratoCard } from "@/components/ContratosBrowser";
import { filtroEmpresaWhere } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { KpiVencimentos } from "@/components/KpiVencimentos";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { KPI } from "@/components/ui/KPI";
import { TimelineVencimentos } from "@/components/TimelineVencimentos";
import { brl } from "@/lib/validators";

function classifica(vigenciaFim: Date): ContratoCard["status"] {
  const hoje = new Date();
  const dias = Math.ceil((vigenciaFim.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return "vencidos";
  if (dias <= 30) return "vencimento_proximo";
  return "vigentes";
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; orgao?: string; aba?: string; v?: string; alerta?: string; status?: string }>;
}) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);
  const filtroEmpresa = await filtroEmpresaWhere(usuario.contaId);

  const q = (sp.q || "").trim();
  const orgaoFiltro = sp.orgao || "";
  const alertaDias = sp.alerta ? Number(sp.alerta) : 0;
  const statusQs = sp.status || "";
  const abaSelecionada =
    statusQs === "vigentes" ? "vigentes" : statusQs === "vencidas" ? "vencidos" : sp.aba || "vigentes";

  const hojeDate = new Date();
  const limiteAlertaContrato =
    alertaDias > 0 ? new Date(hojeDate.getTime() + alertaDias * 86400000) : null;

  const whereBase = { empresa: filtroEmpresa };
  const whereQuery = {
    empresa: filtroEmpresa,
    ...(q && { OR: [{ numero: { contains: q } }, { objeto: { contains: q } }, { processoAdministrativo: { contains: q } }, { orgaoNome: { contains: q } }] }),
    ...(orgaoFiltro && { orgaoNome: orgaoFiltro }),
    ...(statusQs === "vencidas" && { vigenciaFim: { lt: hojeDate } }),
    ...(limiteAlertaContrato && { vigenciaFim: { gte: hojeDate, lte: limiteAlertaContrato } }),
  };
  const d30 = new Date(hojeDate.getTime() + 30 * 86400000);
  const d60 = new Date(hojeDate.getTime() + 60 * 86400000);
  const d90 = new Date(hojeDate.getTime() + 90 * 86400000);
  const d120 = new Date(hojeDate.getTime() + 120 * 86400000);

  // Tudo em paralelo — sem N+1
  const [todos, orgaosDistintos, qtdContratosVigentes, qtdContratosFinalizados, venc30c, venc60c, venc90c, venc120c, contratosVigentesFin] =
    await Promise.all([
      prisma.contrato.findMany({
        where: whereQuery,
        orderBy: { vigenciaFim: "asc" },
        include: {
          empresa: { select: { nomeFantasia: true, razaoSocial: true } },
          ata: { select: { numero: true } },
          itens: { select: { valorTotal: true } },
          empenhos: { select: { itens: { select: { valorTotal: true } } } },
        },
      }),
      prisma.contrato.groupBy({ by: ["orgaoNome"], where: whereBase, orderBy: { orgaoNome: "asc" } }),
      prisma.contrato.count({ where: { ...whereBase, vigenciaFim: { gte: hojeDate } } }),
      prisma.contrato.count({ where: { ...whereBase, vigenciaFim: { lt: hojeDate } } }),
      prisma.contrato.count({ where: { ...whereBase, vigenciaFim: { gte: hojeDate, lte: d30 } } }),
      prisma.contrato.count({ where: { ...whereBase, vigenciaFim: { gte: hojeDate, lte: d60 } } }),
      prisma.contrato.count({ where: { ...whereBase, vigenciaFim: { gte: hojeDate, lte: d90 } } }),
      prisma.contrato.count({ where: { ...whereBase, vigenciaFim: { gte: hojeDate, lte: d120 } } }),
      // Contratos vigentes detalhados pra bloco financeiro + reajuste (ignora filtros de busca/status)
      prisma.contrato.findMany({
        where: { ...whereBase, vigenciaFim: { gte: hojeDate } },
        select: {
          id: true,
          numero: true,
          orgaoNome: true,
          vigenciaFim: true,
          marcoOrcamentoEstimado: true,
          valorInicial: true,
          itens: { select: { valorTotal: true } },
          empenhos: {
            select: {
              status: true,
              itens: { select: { valorTotal: true } },
            },
          },
        },
      }),
    ]);

  // ============================================================
  // Bloco Financeiro de Contratos (espelha o /atas)
  // ============================================================
  const valoresContratadosContr = contratosVigentesFin.reduce(
    (s, c) => s + (c.valorInicial ?? c.itens.reduce((ss, it) => ss + it.valorTotal, 0)),
    0,
  );
  const valoresExecutadosContr = contratosVigentesFin.reduce(
    (s, c) => s + c.empenhos.reduce((ss, e) => ss + e.itens.reduce((sss, it) => sss + it.valorTotal, 0), 0),
    0,
  );
  const valoresAExecutarContr = Math.max(0, valoresContratadosContr - valoresExecutadosContr);
  const valoresRecebidosContr = contratosVigentesFin
    .flatMap((c) => c.empenhos)
    .filter((e) => e.status === "PAGO")
    .reduce((s, e) => s + e.itens.reduce((ss, it) => ss + it.valorTotal, 0), 0);
  const valoresAReceberContr = contratosVigentesFin
    .flatMap((c) => c.empenhos)
    .filter((e) => e.status === "NF_ENCAMINHADA" || e.status === "NF_EMITIDA")
    .reduce((s, e) => s + e.itens.reduce((ss, it) => ss + it.valorTotal, 0), 0);

  // Contratos com janela de reajuste próxima (≤90 dias até marco+12 meses)
  const contratosComReajuste = contratosVigentesFin
    .filter((c) => c.marcoOrcamentoEstimado)
    .map((c) => {
      const janela = new Date(c.marcoOrcamentoEstimado!);
      janela.setFullYear(janela.getFullYear() + 1);
      const dias = Math.ceil((janela.getTime() - hojeDate.getTime()) / 86400000);
      return { id: c.id, numero: c.numero, dias };
    })
    .filter((c) => c.dias >= 0 && c.dias <= 90);

  // Itens da timeline — só Contratos vigentes; janela de 120 dias é filtrada
  // internamente pelo componente.
  const itensTimeline = contratosVigentesFin.map((c) => ({
    id: c.id,
    tipo: "contrato" as const,
    numero: c.numero,
    orgaoNome: c.orgaoNome,
    vigenciaFim: c.vigenciaFim,
  }));

  // Saldo calculado em memória — zero queries extras
  const contratosCard: ContratoCard[] = todos.map((c) => {
    const valorTotal = c.itens.reduce((s, i) => s + i.valorTotal, 0);
    const valorExecutado = c.empenhos.reduce((s, e) => s + e.itens.reduce((ss, i) => ss + i.valorTotal, 0), 0);
    const pctExecutado = valorTotal === 0 ? 0 : (valorExecutado / valorTotal) * 100;
    const dias = Math.ceil((c.vigenciaFim.getTime() - hojeDate.getTime()) / 86400000);
    return {
      id: c.id,
      numero: c.numero,
      tipo: c.tipo,
      objeto: c.objeto,
      orgaoNome: c.orgaoNome,
      empresaNome: c.empresa.nomeFantasia || c.empresa.razaoSocial,
      ataNumero: c.ata?.numero ?? null,
      vigenciaInicio: c.vigenciaInicio.toISOString(),
      vigenciaFim: c.vigenciaFim.toISOString(),
      diasParaVencer: dias,
      valorTotal,
      valorExecutado,
      pctExecutado,
      status: classifica(c.vigenciaFim),
    };
  });

  const contadores = {
    vigentes: contratosCard.filter((c) => c.status === "vigentes").length,
    vencimento_proximo: contratosCard.filter((c) => c.status === "vencimento_proximo").length,
    vencidos: contratosCard.filter((c) => c.status === "vencidos").length,
    finalizados: contratosCard.filter((c) => c.status === "finalizados").length,
  };

  const filtrados = contratosCard.filter((c) => {
    if (abaSelecionada === "finalizados") return c.pctExecutado >= 100;
    return c.status === abaSelecionada;
  });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <BannerEmpresaEmFoco contaId={usuario.contaId} />
      <PageHeader
        eyebrow="Módulo · Contratos"
        titulo="Contratos"
        destaque="administrativos"
        subtitulo={`${todos.length} contrato(s) cadastrado(s) · use as abas pra filtrar por status.`}
        cta={
          <Link href="/contratacoes/nova/contrato" className="btn-primary">
            <Plus className="h-4 w-4" /> Novo contrato
          </Link>
        }
      />

      <div className="mt-6">
        <KpiVencimentos
          rotuloPlural="Contratos"
          rotuloSingularDe="contrato"
          genero="m"
          totalVigentes={qtdContratosVigentes}
          totalFinalizados={qtdContratosFinalizados}
          vencendoEm30={venc30c}
          vencendoEm60={venc60c}
          vencendoEm90={venc90c}
          vencendoEm120={venc120c}
          hrefVigentes="/contratos?status=vigentes"
          hrefFinalizados="/contratos?status=vencidas"
          hrefBaseAlerta="/contratos?alerta="
        />
      </div>

      {/* Bloco Financeiro de Contratos — espelha o /atas */}
      <div className="mt-4 grid gap-3.5 lg:grid-cols-3">
        <KPI
          tone="lavender"
          icon={Coins}
          label="Contratados em Contratos"
          value={brl(valoresContratadosContr)}
          meta="Soma do valor total dos Contratos vigentes"
        />
        <KPI
          tone="primary"
          icon={TrendingUp}
          label="Executados em Contratos"
          value={brl(valoresExecutadosContr)}
          meta="Consumido via Empenhos vinculados"
        />
        <KPI
          tone="mint"
          icon={ArrowRight}
          label="A executar em Contratos"
          value={brl(valoresAExecutarContr)}
          meta="Contratados − Executados"
        />
        <KPI
          tone="mint"
          icon={Coins}
          label="Valores recebidos"
          value={brl(valoresRecebidosContr)}
          meta="Empenhos PAGOS vinculados aos Contratos"
          href="/execucao?status=PAGO"
        />
        <KPI
          tone="primary"
          icon={Coins}
          label="Valores a receber"
          value={brl(valoresAReceberContr)}
          meta="NF emitida/encaminhada, aguardando pagamento"
          href="/execucao?status=NF_ENCAMINHADA"
        />
        <KPI
          tone="rose"
          icon={AlertTriangle}
          label="Contratos em janela de reajuste"
          value={contratosComReajuste.length}
          meta="Marco + 12 meses dentro de 90 dias"
          pulse={contratosComReajuste.length > 0}
          href="/reajustes"
        />
      </div>

      {/* Timeline de vencimentos — janela de 120 dias, só Contratos vigentes */}
      <div className="mt-4">
        <TimelineVencimentos itens={itensTimeline} />
      </div>

      {alertaDias > 0 && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Filtrando por vencimento em até {alertaDias} dias · {todos.length} contrato(s) ·{" "}
          <Link href="/contratos" className="underline">
            limpar
          </Link>
        </p>
      )}

      <div className="mt-6">
        <ContratosBrowser
          contratos={filtrados}
          contadores={contadores}
          orgaos={orgaosDistintos.map((o) => o.orgaoNome)}
        />
      </div>
    </div>
  );
}
