import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContratosBrowser, type ContratoCard } from "@/components/ContratosBrowser";
import { filtroEmpresaWhere } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { KpiVencimentos } from "@/components/KpiVencimentos";
import { PageHeader } from "@/components/ui/SecaoGlass";

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
  const [todos, orgaosDistintos, qtdContratosVigentes, qtdContratosFinalizados, venc30c, venc60c, venc90c, venc120c] =
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
    ]);

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
