import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoContrato } from "@/lib/saldo";
import { ContratosBrowser, type ContratoCard } from "@/components/ContratosBrowser";

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
  searchParams: Promise<{ q?: string; orgao?: string; aba?: string; v?: string }>;
}) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const orgaoFiltro = sp.orgao || "";
  const abaSelecionada = sp.aba || "vigentes";

  const todos = await prisma.contrato.findMany({
    where: {
      empresa: { contaId: usuario.contaId },
      ...(q && {
        OR: [
          { numero: { contains: q } },
          { objeto: { contains: q } },
          { processoAdministrativo: { contains: q } },
          { orgaoNome: { contains: q } },
        ],
      }),
      ...(orgaoFiltro && { orgaoNome: orgaoFiltro }),
    },
    orderBy: { vigenciaFim: "asc" },
    include: {
      empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      ata: { select: { numero: true } },
      itens: { select: { valorTotal: true } },
    },
  });

  // Saldos
  const saldos = await Promise.all(todos.map((c) => calcularSaldoContrato(c.id)));
  const hoje = new Date();

  const contratosCard: ContratoCard[] = todos.map((c, idx) => {
    const s = saldos[idx];
    const valorTotal = c.itens.reduce((sum, i) => sum + i.valorTotal, 0);
    const dias = Math.ceil((c.vigenciaFim.getTime() - hoje.getTime()) / 86400000);
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
      valorTotal: s.valorTotal || valorTotal,
      valorExecutado: s.valorUsado,
      pctExecutado: s.percentualUsado,
      status: classifica(c.vigenciaFim),
    };
  });

  // Contadores das abas
  const contadores = {
    vigentes: contratosCard.filter((c) => c.status === "vigentes").length,
    vencimento_proximo: contratosCard.filter((c) => c.status === "vencimento_proximo").length,
    vencidos: contratosCard.filter((c) => c.status === "vencidos").length,
    finalizados: contratosCard.filter((c) => c.status === "finalizados").length,
  };

  // Filtra pela aba selecionada
  const filtrados = contratosCard.filter((c) => {
    if (abaSelecionada === "finalizados") return c.pctExecutado >= 100;
    return c.status === abaSelecionada;
  });

  // Lista de órgãos pra filtro
  const orgaosDistintos = await prisma.contrato.groupBy({
    by: ["orgaoNome"],
    where: { empresa: { contaId: usuario.contaId } },
    orderBy: { orgaoNome: "asc" },
  });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <ClipboardList className="h-3.5 w-3.5" /> Módulo 4 · Contratos
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Contratos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {todos.length} contrato(s) cadastrado(s) · Use as abas pra filtrar por status.
          </p>
        </div>
        <Link
          href="/contratacoes/nova/contrato"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Cadastrar contrato
        </Link>
      </div>

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
