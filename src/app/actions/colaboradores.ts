"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { bloqueioModulo, registrarContagem } from "@/lib/faixasTerceirizacaoServer";
import { registrarAuditoria } from "@/lib/auditoria";
import { podeEditarColaboradores, cpfValido, pareceDocumentoDeSaude } from "@/lib/lgpd";
import { MOTIVOS_FIM, TIPOS_ALOCACAO, type TipoAlocacao } from "@/lib/colaboradores";
import {
  alocar,
  anonimizarColaborador,
  criarColaborador,
  desligarColaborador,
  encerrarAlocacao,
  importarColaboradores,
  lerGradeDoArquivo,
} from "@/lib/colaboradoresServer";

/**
 * Colaboradores e alocação (ESP-008, Igor 07/11/2026). Quem edita: ADMIN,
 * RH do contrato ou OPERACIONAL com a permissão "Dados de colaboradores".
 */

export type ResultadoColab = { ok?: boolean; erro?: string; mensagem?: string; id?: string; contratos?: { id: string; numero: string }[]; rejeitadas?: { linha: number; motivo: string; trecho: string }[]; criados?: number } | null;

function parseDia(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function usuarioQueEdita() {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!podeEditarColaboradores(usuario)) return { usuario, erro: "Você não tem a permissão “Dados de colaboradores”. Peça ao administrador da conta (tela Equipe)." };
  // ESP-011 RN01/RN07: Premium ou trial; fora disso, somente leitura por 90 dias. Anonimizar (LGPD) continua sempre liberado.
  const bloqueio = await bloqueioModulo(usuario.contaId);
  if (bloqueio) return { usuario, erro: bloqueio };
  return { usuario, erro: null };
}

export async function criarColaboradorAction(_p: ResultadoColab, formData: FormData): Promise<ResultadoColab> {
  const { usuario, erro } = await usuarioQueEdita();
  if (erro) return { erro };
  const nome = String(formData.get("nome") || "").trim();
  const cpf = String(formData.get("cpf") || "").replace(/\D/g, "");
  const dataAdmissao = parseDia(String(formData.get("dataAdmissao") || ""));
  const funcao = String(formData.get("funcao") || "").trim();
  if (!nome) return { erro: "Informe o nome." };
  if (!cpfValido(cpf)) return { erro: "CPF inválido." };
  if (!dataAdmissao) return { erro: "Informe a data de admissão." };
  if (!funcao) return { erro: "Informe a função." };
  const r = await criarColaborador(usuario.contaId, usuario.id, {
    nome,
    cpf,
    dataAdmissao,
    funcao,
    cbo: String(formData.get("cbo") || "") || null,
    jornada: String(formData.get("jornada") || "") || null,
    telefone: String(formData.get("telefone") || "") || null,
  });
  if ("erro" in r) return { erro: r.erro };
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "CRIAR", recurso: "Colaborador", recursoId: r.id, resumo: `Colaborador ${nome} cadastrado (${funcao})` });
  revalidatePath("/colaboradores");
  return { ok: true, id: r.id, mensagem: `${nome} cadastrado(a).` };
}

export async function atualizarColaboradorAction(_p: ResultadoColab, formData: FormData): Promise<ResultadoColab> {
  const { usuario, erro } = await usuarioQueEdita();
  if (erro) return { erro };
  const id = String(formData.get("id") || "");
  const c = await prisma.colaborador.findFirst({ where: { id, contaId: usuario.contaId }, select: { id: true, nome: true, anonimizadoEm: true, situacao: true } });
  if (!c) return { erro: "Colaborador não encontrado." };
  if (c.anonimizadoEm) return { erro: "Registro anonimizado não pode ser editado." };
  const nome = String(formData.get("nome") || "").trim();
  const funcao = String(formData.get("funcao") || "").trim();
  const dataAdmissao = parseDia(String(formData.get("dataAdmissao") || ""));
  if (!nome || !funcao || !dataAdmissao) return { erro: "Nome, função e data de admissão são obrigatórios." };
  const situacaoForm = String(formData.get("situacao") || "");
  const situacao = situacaoForm === "AFASTADO" || situacaoForm === "ATIVO" ? situacaoForm : c.situacao === "DESLIGADO" ? "DESLIGADO" : c.situacao;
  await prisma.colaborador.update({
    where: { id },
    data: { nome, funcao, dataAdmissao, cbo: String(formData.get("cbo") || "") || null, jornada: String(formData.get("jornada") || "") || null, telefone: String(formData.get("telefone") || "") || null, ...(c.situacao !== "DESLIGADO" ? { situacao } : {}) },
  });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Colaborador", recursoId: id, resumo: `Ficha de ${nome} atualizada (${funcao}, ${situacao.toLowerCase()})` });
  revalidatePath(`/colaboradores/${id}`);
  revalidatePath("/colaboradores");
  return { ok: true, mensagem: "Ficha atualizada." };
}

export async function desligarColaboradorAction(_p: ResultadoColab, formData: FormData): Promise<ResultadoColab> {
  const { usuario, erro } = await usuarioQueEdita();
  if (erro) return { erro };
  const id = String(formData.get("id") || "");
  const data = parseDia(String(formData.get("data") || ""));
  if (!data) return { erro: "Informe a data do desligamento." };
  const r = await desligarColaborador(id, usuario.contaId, usuario.id, data);
  if ("erro" in r) return { erro: r.erro };
  revalidatePath(`/colaboradores/${id}`);
  revalidatePath("/colaboradores");
  for (const c of r.contratos) revalidatePath(`/contratos/${c.id}`);
  await registrarContagem(usuario.contaId).catch(() => {}); // ESP-011 RN03
  return {
    ok: true,
    contratos: r.contratos,
    mensagem: r.contratos.length
      ? "Desligamento registrado e alocações encerradas. Abra o pedido de liberação de rescisão na conta vinculada do(s) contrato(s) indicado(s)."
      : "Desligamento registrado e alocações encerradas.",
  };
}

export async function anonimizarColaboradorAction(id: string): Promise<ResultadoColab> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") return { erro: "Só o administrador da empresa anonimiza um colaborador (pedido do titular, LGPD art. 18)." };
  const c = await prisma.colaborador.findFirst({ where: { id, contaId: usuario.contaId }, select: { situacao: true, alocacoes: { where: { dataFim: null }, select: { id: true } } } });
  if (!c) return { erro: "Colaborador não encontrado." };
  if (c.alocacoes.length > 0) return { erro: "Encerre as alocações abertas (ou registre o desligamento) antes de anonimizar." };
  await anonimizarColaborador(id, usuario.contaId, usuario.id, "pedido do titular / decisão do administrador");
  revalidatePath(`/colaboradores/${id}`);
  revalidatePath("/colaboradores");
  return { ok: true, mensagem: "Dados pessoais anonimizados. O histórico de alocações ficou sem identificação." };
}

export async function importarColaboradoresAction(_p: ResultadoColab, formData: FormData): Promise<ResultadoColab> {
  const { usuario, erro } = await usuarioQueEdita();
  if (erro) return { erro };
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha a planilha (.xlsx ou .csv)." };
  if (arquivo.size > 5 * 1024 * 1024) return { erro: "Planilha maior que 5 MB." };
  if (pareceDocumentoDeSaude(arquivo.name)) return { erro: "Este arquivo parece documento médico. Não envie atestados, ASO ou laudos." };
  let grade: (string | number)[][];
  try {
    grade = lerGradeDoArquivo(Buffer.from(await arquivo.arrayBuffer()));
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não consegui ler a planilha." };
  }
  if (grade.length > 2001) return { erro: "A planilha tem mais de 2.000 linhas; divida em partes." };
  const r = await importarColaboradores(usuario.contaId, usuario.id, grade);
  revalidatePath("/colaboradores");
  return { ok: true, criados: r.criados, rejeitadas: r.rejeitadas, mensagem: `${r.criados} colaborador(es) cadastrado(s); ${r.rejeitadas.length} linha(s) rejeitada(s).` };
}

export async function alocarAction(_p: ResultadoColab, formData: FormData): Promise<ResultadoColab> {
  const { usuario, erro } = await usuarioQueEdita();
  if (erro) return { erro };
  const tipo = String(formData.get("tipo") || "TITULAR") as TipoAlocacao;
  if (!TIPOS_ALOCACAO.includes(tipo)) return { erro: "Tipo de alocação inválido." };
  const dataInicio = parseDia(String(formData.get("dataInicio") || ""));
  if (!dataInicio) return { erro: "Informe a data de início." };
  const contratoId = String(formData.get("contratoId") || "");
  const r = await alocar(usuario.contaId, usuario.id, {
    colaboradorId: String(formData.get("colaboradorId") || ""),
    contratoId,
    contratoItemId: String(formData.get("contratoItemId") || "") || null,
    tipo,
    dataInicio,
    dataFim: parseDia(String(formData.get("dataFim") || "")),
    observacao: String(formData.get("observacao") || "").trim() || null,
  });
  if ("erro" in r) return { erro: r.erro };
  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/colaboradores");
  await registrarContagem(usuario.contaId).catch(() => {}); // ESP-011 RN03
  return { ok: true, id: r.id, mensagem: "Alocação registrada." };
}

export async function encerrarAlocacaoAction(_p: ResultadoColab, formData: FormData): Promise<ResultadoColab> {
  const { usuario, erro } = await usuarioQueEdita();
  if (erro) return { erro };
  const id = String(formData.get("id") || "");
  const dataFim = parseDia(String(formData.get("dataFim") || ""));
  if (!dataFim) return { erro: "Informe a data de fim." };
  const motivo = String(formData.get("motivo") || "OUTRO");
  if (!(MOTIVOS_FIM as readonly string[]).includes(motivo)) return { erro: "Motivo inválido." };
  const r = await encerrarAlocacao(id, usuario.contaId, usuario.id, dataFim, motivo, String(formData.get("observacao") || "").trim() || null);
  if ("erro" in r) return { erro: r.erro };
  const contratoId = String(formData.get("contratoId") || "");
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/colaboradores");
  await registrarContagem(usuario.contaId).catch(() => {}); // ESP-011 RN03
  return { ok: true, mensagem: "Alocação encerrada." };
}
