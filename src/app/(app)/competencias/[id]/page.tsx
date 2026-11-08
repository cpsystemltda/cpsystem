import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeEditarDocumento } from "@/lib/permissoes";
import { buscarCompetencia, empenhosDoContratoComSaldo } from "@/lib/competenciasServer";
import { RETENCOES_PADRAO } from "@/lib/competencias";
import { CompetenciaDetalhe } from "@/components/CompetenciaDetalhe";
import { HistoricoLista } from "@/components/abas/HistoricoLista";

// Detalhe da competência mensal (ESP-004): etapas, valores, empenhos e histórico.
export default async function CompetenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  const c = await buscarCompetencia(id, usuario.contaId);
  if (!c) notFound();

  const contrato = await prisma.contrato.findUnique({
    where: { id: c.contratoId },
    select: { criadoPorId: true, retencoesPadrao: true },
  });
  if (!contrato) notFound();
  const podeEditar = podeEditarDocumento(usuario, contrato);
  const ehAdmin = usuario.superAdmin || usuario.perfil === "ADMIN";
  const empenhos = await empenhosDoContratoComSaldo(c.contratoId);
  const retencoesSugeridas = Array.isArray(contrato.retencoesPadrao)
    ? (contrato.retencoesPadrao as { codigo: string; rotulo: string; pct: number | null }[])
    : RETENCOES_PADRAO.map((r) => ({ codigo: r.codigo, rotulo: r.rotulo, pct: r.pct }));
  const historico = await prisma.logAuditoria.findMany({
    where: { contaId: usuario.contaId, recurso: "Competencia", recursoId: c.id },
    orderBy: { criadoEm: "desc" },
    take: 50,
    include: { usuario: { select: { nome: true, email: true } } },
  });
  const hojeIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return (
    <>
      <CompetenciaDetalhe
        c={c}
        empenhosDoContrato={empenhos}
        retencoesSugeridas={retencoesSugeridas}
        podeEditar={podeEditar}
        ehAdmin={ehAdmin}
        hojeIso={hojeIso}
        nomeUsuario={usuario.nome ?? ""}
      />
      <div className="mx-auto max-w-6xl px-8 pb-10">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Histórico</h2>
        <HistoricoLista entradas={historico} />
      </div>
    </>
  );
}
