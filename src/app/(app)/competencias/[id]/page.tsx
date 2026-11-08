import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeEditarDocumento } from "@/lib/permissoes";
import { buscarCompetencia, empenhosDoContratoComSaldo } from "@/lib/competenciasServer";
import { RETENCOES_PADRAO } from "@/lib/competencias";
import { faixasDe } from "@/lib/glosas";
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
    select: {
      criadoPorId: true,
      retencoesPadrao: true,
      indicadoresImr: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true, meta: true, descricao: true, faixas: true } },
    },
  });
  if (!contrato) notFound();
  // Postos da competência (ESP-005): os vigentes no período, para a glosa apontar a função.
  const itensBrutos = await prisma.contratoItem.findMany({
    where: { contratoId: c.contratoId, ...(c.vigenciaId ? { vigenciaId: c.vigenciaId } : {}) },
    select: { id: true, descricao: true, vigenteDe: true, vigenteAte: true },
    orderBy: { descricao: "asc" },
  });
  const fimPeriodo = new Date(c.periodoFim);
  const itens = itensBrutos
    .filter((i) => (!i.vigenteDe || i.vigenteDe <= fimPeriodo) && (!i.vigenteAte || i.vigenteAte >= new Date(c.periodoInicio)))
    .map((i) => ({ id: i.id, descricao: i.descricao }));
  const indicadores = contrato.indicadoresImr.map((i) => ({ ...i, faixas: faixasDe(i.faixas) }));
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
        itens={itens}
        indicadores={indicadores}
      />
      <div className="mx-auto max-w-6xl px-8 pb-10">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Histórico</h2>
        <HistoricoLista entradas={historico} />
      </div>
    </>
  );
}
