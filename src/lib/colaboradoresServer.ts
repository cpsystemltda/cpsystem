import "server-only";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { cifrarCpf, decifrarCpf, hashCpf, lgpdPronta, registrarAcessoDadosPessoais } from "@/lib/lgpdServer";
import { mascararCpf } from "@/lib/lgpd";
import { colaboradoresNecessarios } from "@/lib/maoDeObra";
import { itensVigentesEm } from "@/lib/competencias";
import {
  COLUNAS_MODELO,
  ROTULO_MOTIVO_FIM,
  conflitoTitular,
  diaUtc,
  quadroDoContrato,
  validarGrade,
  type AlocacaoBase,
  type LinhaImportada,
  type SituacaoColaborador,
  type TipoAlocacao,
} from "@/lib/colaboradores";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Colaboradores (ESP-008) — lado do servidor. CPF nunca sai do banco em
 * claro para lista: só a máscara. O CPF completo só é decifrado no detalhe,
 * para quem pode ver, e o acesso fica registrado (ESP-007 RN05).
 */

export type AlocacaoDto = {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  cpfMascarado: string;
  contratoId: string;
  contratoNumero: string;
  contratoItemId: string | null;
  itemDescricao: string | null;
  tipo: TipoAlocacao;
  dataInicio: string;
  dataFim: string | null;
  motivoFim: string | null;
  observacao: string | null;
};

export type ColaboradorDto = {
  id: string;
  nome: string;
  cpfMascarado: string;
  cpf: string | null; // só no detalhe, para quem pode ver
  dataAdmissao: string;
  funcao: string;
  cbo: string | null;
  jornada: string | null;
  situacao: SituacaoColaborador;
  dataDesligamento: string | null;
  telefone: string | null;
  vinculoAnteriorId: string | null;
  anonimizadoEm: string | null;
  alocacoes: AlocacaoDto[];
};

const r = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function dto(c: {
  id: string;
  nome: string;
  cpfMascarado: string;
  dataAdmissao: Date;
  funcao: string;
  cbo: string | null;
  jornada: string | null;
  situacao: SituacaoColaborador;
  dataDesligamento: Date | null;
  telefone: string | null;
  vinculoAnteriorId: string | null;
  anonimizadoEm: Date | null;
  alocacoes?: { id: string; contratoId: string; contratoItemId: string | null; tipo: TipoAlocacao; dataInicio: Date; dataFim: Date | null; motivoFim: string | null; observacao: string | null; contrato: { numero: string }; contratoItem: { descricao: string } | null }[];
}, podeVer: boolean, cpf: string | null = null): ColaboradorDto {
  return {
    id: c.id,
    nome: podeVer ? c.nome : "Colaborador",
    cpfMascarado: podeVer ? c.cpfMascarado : "***.***.***-**",
    cpf,
    dataAdmissao: c.dataAdmissao.toISOString(),
    funcao: c.funcao,
    cbo: c.cbo,
    jornada: c.jornada,
    situacao: c.situacao,
    dataDesligamento: r(c.dataDesligamento),
    telefone: podeVer ? c.telefone : null,
    vinculoAnteriorId: c.vinculoAnteriorId,
    anonimizadoEm: r(c.anonimizadoEm),
    alocacoes: (c.alocacoes ?? []).map((a) => ({
      id: a.id,
      colaboradorId: c.id,
      colaboradorNome: podeVer ? c.nome : "Colaborador",
      cpfMascarado: podeVer ? c.cpfMascarado : "***.***.***-**",
      contratoId: a.contratoId,
      contratoNumero: a.contrato.numero,
      contratoItemId: a.contratoItemId,
      itemDescricao: a.contratoItem?.descricao ?? null,
      tipo: a.tipo,
      dataInicio: a.dataInicio.toISOString(),
      dataFim: r(a.dataFim),
      motivoFim: a.motivoFim,
      observacao: a.observacao,
    })),
  };
}

const INCLUDE_ALOC = { alocacoes: { orderBy: { dataInicio: "desc" as const }, include: { contrato: { select: { numero: true } }, contratoItem: { select: { descricao: true } } } } };

export async function listarColaboradores(contaId: string, filtro: { busca?: string; situacao?: string }, podeVer: boolean): Promise<ColaboradorDto[]> {
  const busca = (filtro.busca ?? "").trim();
  const digitos = busca.replace(/\D/g, "");
  const where: Record<string, unknown> = { contaId };
  if (filtro.situacao && ["ATIVO", "AFASTADO", "DESLIGADO"].includes(filtro.situacao)) where.situacao = filtro.situacao;
  if (busca) {
    if (digitos.length === 11) where.cpfHash = hashCpf(digitos);
    else where.OR = [{ nome: { contains: busca, mode: "insensitive" } }, { funcao: { contains: busca, mode: "insensitive" } }];
  }
  const rows = await prisma.colaborador.findMany({ where, orderBy: [{ situacao: "asc" }, { nome: "asc" }], include: INCLUDE_ALOC, take: 500 });
  return rows.map((c) => dto({ ...c, alocacoes: c.alocacoes.filter((a) => !a.dataFim) }, podeVer));
}

export async function contagemColaboradores(contaId: string): Promise<{ ativos: number; afastados: number; desligados: number; alocados: number }> {
  const [ativos, afastados, desligados, alocados] = await Promise.all([
    prisma.colaborador.count({ where: { contaId, situacao: "ATIVO" } }),
    prisma.colaborador.count({ where: { contaId, situacao: "AFASTADO" } }),
    prisma.colaborador.count({ where: { contaId, situacao: "DESLIGADO" } }),
    contarAtivosAlocados(contaId),
  ]);
  return { ativos, afastados, desligados, alocados };
}

/** RN08: colaboradores ativos com alocação aberta — alimenta a cobrança por faixa (ESP-011). */
export async function contarAtivosAlocados(contaId: string): Promise<number> {
  const rows = await prisma.alocacao.findMany({
    where: { dataFim: null, colaborador: { contaId, situacao: "ATIVO", anonimizadoEm: null } },
    select: { colaboradorId: true },
    distinct: ["colaboradorId"],
  });
  return rows.length;
}

export async function buscarColaborador(id: string, contaId: string, podeVer: boolean, usuarioId?: string): Promise<ColaboradorDto | null> {
  const c = await prisma.colaborador.findFirst({ where: { id, contaId }, include: INCLUDE_ALOC });
  if (!c) return null;
  const cpf = podeVer && !c.anonimizadoEm ? decifrarCpf(c.cpfCifrado) : null;
  if (podeVer && usuarioId && !c.anonimizadoEm) {
    await registrarAcessoDadosPessoais({ contaId, usuarioId, recurso: "Colaborador", recursoId: c.id, resumo: `Consultou a ficha de ${c.nome} (${c.cpfMascarado})` });
  }
  return dto(c, podeVer, cpf);
}

export type NovoColaborador = Omit<LinhaImportada, "dataDesligamento" | "situacao"> & { situacao?: SituacaoColaborador; dataDesligamento?: Date | null };

/** Cadastro único. CPF já vigente na conta bloqueia; desligado permite readmissão (vínculo novo). */
export async function criarColaborador(contaId: string, usuarioId: string, d: NovoColaborador): Promise<{ id: string } | { erro: string }> {
  if (!lgpdPronta()) return { erro: "SEGREDO_CHAVE não configurada: o sistema não grava CPF sem cifrar." };
  const hash = hashCpf(d.cpf);
  const vigente = await prisma.colaborador.findFirst({ where: { contaId, cpfHash: hash, situacao: { not: "DESLIGADO" }, anonimizadoEm: null }, select: { id: true, nome: true } });
  if (vigente) return { erro: `CPF já cadastrado para ${vigente.nome}.` };
  const anterior = await prisma.colaborador.findFirst({ where: { contaId, cpfHash: hash, situacao: "DESLIGADO" }, orderBy: { dataDesligamento: "desc" }, select: { id: true } });
  const c = await prisma.colaborador.create({
    data: {
      contaId,
      nome: d.nome.trim(),
      cpfCifrado: cifrarCpf(d.cpf),
      cpfHash: hash,
      cpfMascarado: mascararCpf(d.cpf),
      dataAdmissao: d.dataAdmissao,
      funcao: d.funcao.trim(),
      cbo: d.cbo?.trim() || null,
      jornada: d.jornada?.trim() || null,
      telefone: d.telefone?.trim() || null,
      situacao: d.situacao ?? "ATIVO",
      dataDesligamento: d.situacao === "DESLIGADO" ? d.dataDesligamento ?? null : null,
      vinculoAnteriorId: anterior?.id ?? null,
      criadoPorId: usuarioId,
    },
    select: { id: true },
  });
  return { id: c.id };
}

export async function importarColaboradores(contaId: string, usuarioId: string, grade: (string | number)[][]): Promise<{ criados: number; rejeitadas: { linha: number; motivo: string; trecho: string }[] }> {
  const v = validarGrade(grade);
  const rejeitadas = [...v.rejeitadas];
  let criados = 0;
  for (const l of v.aceitas) {
    const res = await criarColaborador(contaId, usuarioId, l);
    if ("erro" in res) rejeitadas.push({ linha: l.linha, motivo: res.erro, trecho: `${l.nome} · ${mascararCpf(l.cpf)}` });
    else criados++;
  }
  rejeitadas.sort((a, b) => a.linha - b.linha);
  await registrarAuditoria({ contaId, usuarioId, acao: "UPLOAD", recurso: "Colaborador", resumo: `Importação de colaboradores: ${criados} cadastrado(s), ${rejeitadas.length} linha(s) rejeitada(s)` });
  return { criados, rejeitadas };
}

/** Modelo XLSX para a importação (RN02). */
export function gerarModeloXlsx(): Buffer {
  const aoa: (string | number)[][] = [
    [...COLUNAS_MODELO],
    ["Maria da Silva", "529.982.247-25", "09/05/2026", "Auxiliar administrativo", "4110-05", "40h semanais", "(61) 99999-0000", "Ativo", ""],
    ["José de Souza", "390.533.447-05", "01/06/2025", "Vigia", "5174-20", "12x36 noturno", "", "Desligado", "30/06/2026"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = COLUNAS_MODELO.map((c) => ({ wch: Math.max(16, c.length + 4) }));
  const instr = XLSX.utils.aoa_to_sheet([
    ["Como preencher"],
    ["Uma linha por colaborador. Apague as duas linhas de exemplo."],
    ["CPF com ou sem pontuação; datas em dd/mm/aaaa."],
    ["Situação: Ativo, Afastado ou Desligado (desligado exige a data de desligamento)."],
    ["Não inclua nenhum dado de saúde (atestado, CID, laudo): o sistema não guarda e a LGPD proíbe."],
    ["CPF repetido no arquivo ou já cadastrado e ativo é rejeitado; o relatório mostra a linha e o motivo."],
  ]);
  instr["!cols"] = [{ wch: 100 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
  XLSX.utils.book_append_sheet(wb, instr, "Instruções");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function lerGradeDoArquivo(buffer: Buffer): (string | number)[][] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const nome = wb.SheetNames.find((n) => /colab/i.test(n)) ?? wb.SheetNames[0];
  if (!nome) throw new Error("A planilha não tem nenhuma aba.");
  const linhas = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[nome], { header: 1, blankrows: false, defval: "", raw: true });
  return linhas.map((l) => (Array.isArray(l) ? l.map((c) => (typeof c === "number" ? c : String(c ?? "").trim())) : [])).filter((l) => l.some((c) => c !== ""));
}

// ─────────────────────────────────────────────
// Alocação (RN03–RN07)
// ─────────────────────────────────────────────

export async function alocar(
  contaId: string,
  usuarioId: string,
  d: { colaboradorId: string; contratoId: string; contratoItemId: string | null; tipo: TipoAlocacao; dataInicio: Date; dataFim: Date | null; observacao: string | null },
): Promise<{ id: string } | { erro: string }> {
  const col = await prisma.colaborador.findFirst({ where: { id: d.colaboradorId, contaId }, select: { id: true, nome: true, situacao: true } });
  if (!col) return { erro: "Colaborador não encontrado." };
  if (col.situacao === "DESLIGADO") return { erro: `${col.nome} está desligado: readmita antes de alocar.` };
  const contrato = await prisma.contrato.findFirst({ where: { id: d.contratoId, empresa: { contaId } }, select: { id: true, numero: true } });
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (d.contratoItemId) {
    const item = await prisma.contratoItem.findFirst({ where: { id: d.contratoItemId, contratoId: d.contratoId }, select: { id: true } });
    if (!item) return { erro: "Posto não pertence a este contrato." };
  } else if (d.tipo !== "VOLANTE") return { erro: "Escolha o posto (item do contrato)." };
  if (d.dataFim && diaUtc(d.dataFim) < diaUtc(d.dataInicio)) return { erro: "A data de fim é anterior ao início." };

  // RN04: dedicação exclusiva — titular em dois postos ao mesmo tempo não.
  const existentes = await prisma.alocacao.findMany({
    where: { colaboradorId: d.colaboradorId, tipo: "TITULAR" },
    include: { contrato: { select: { numero: true } }, contratoItem: { select: { descricao: true } } },
  });
  const conflito = conflitoTitular(existentes as (AlocacaoBase & { id: string; contrato: { numero: string }; contratoItem: { descricao: string } | null })[], { ...d });
  if (conflito) {
    return {
      erro: `${col.nome} já é titular no contrato ${conflito.contrato.numero}${conflito.contratoItem ? ` (${conflito.contratoItem.descricao})` : ""} desde ${conflito.dataInicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })}${conflito.dataFim ? ` até ${conflito.dataFim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}. Dedicação exclusiva não permite dois postos como titular no mesmo período — encerre a alocação anterior ou registre esta como cobertura.`,
    };
  }
  const a = await prisma.alocacao.create({ data: { ...d, observacao: d.observacao || null, criadoPorId: usuarioId }, select: { id: true } });
  await registrarAuditoria({ contaId, usuarioId, acao: "CRIAR", recurso: "Alocacao", recursoId: a.id, resumo: `${col.nome} alocado(a) no contrato ${contrato.numero} como ${d.tipo.toLowerCase()} a partir de ${d.dataInicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` });
  return { id: a.id };
}

export async function encerrarAlocacao(id: string, contaId: string, usuarioId: string, dataFim: Date, motivo: string, observacao?: string | null): Promise<{ ok: true } | { erro: string }> {
  const a = await prisma.alocacao.findFirst({ where: { id, contrato: { empresa: { contaId } } }, include: { colaborador: { select: { nome: true } }, contrato: { select: { numero: true } } } });
  if (!a) return { erro: "Alocação não encontrada." };
  if (a.dataFim) return { erro: "Esta alocação já está encerrada (o histórico não é apagado; crie uma nova se precisar corrigir)." };
  if (diaUtc(dataFim) < diaUtc(a.dataInicio)) return { erro: "A data de fim é anterior ao início." };
  await prisma.alocacao.update({ where: { id }, data: { dataFim, motivoFim: motivo, observacao: observacao ?? a.observacao } });
  await registrarAuditoria({ contaId, usuarioId, acao: "ATUALIZAR", recurso: "Alocacao", recursoId: id, resumo: `Alocação de ${a.colaborador.nome} no contrato ${a.contrato.numero} encerrada em ${dataFim.toLocaleDateString("pt-BR", { timeZone: "UTC" })} (${ROTULO_MOTIVO_FIM[motivo as keyof typeof ROTULO_MOTIVO_FIM] ?? motivo})` });
  return { ok: true };
}

/** RN06: desligamento encerra as alocações abertas e sugere o pedido de rescisão na conta vinculada. */
export async function desligarColaborador(id: string, contaId: string, usuarioId: string, data: Date): Promise<{ contratos: { id: string; numero: string }[] } | { erro: string }> {
  const c = await prisma.colaborador.findFirst({ where: { id, contaId }, include: { alocacoes: { where: { dataFim: null }, include: { contrato: { select: { id: true, numero: true, garantiaVerbas: true } } } } } });
  if (!c) return { erro: "Colaborador não encontrado." };
  if (c.situacao === "DESLIGADO") return { erro: "Já está desligado." };
  if (diaUtc(data) < diaUtc(c.dataAdmissao)) return { erro: "Desligamento anterior à admissão." };
  await prisma.$transaction([
    prisma.colaborador.update({ where: { id }, data: { situacao: "DESLIGADO", dataDesligamento: data } }),
    prisma.alocacao.updateMany({ where: { colaboradorId: id, dataFim: null }, data: { dataFim: data, motivoFim: "DESLIGAMENTO" } }),
  ]);
  const contratos = [...new Map(c.alocacoes.map((a) => [a.contrato.id, a.contrato])).values()];
  await registrarAuditoria({ contaId, usuarioId, acao: "ATUALIZAR", recurso: "Colaborador", recursoId: id, resumo: `${c.nome} desligado(a) em ${data.toLocaleDateString("pt-BR", { timeZone: "UTC" })} · ${c.alocacoes.length} alocação(ões) encerrada(s)` });
  return { contratos: contratos.filter((k) => k.garantiaVerbas === "CONTA_VINCULADA" || k.garantiaVerbas === "FATO_GERADOR").map((k) => ({ id: k.id, numero: k.numero })) };
}

export type QuadroContrato = {
  linhas: { id: string; descricao: string; necessarios: number; alocados: number; titulares: number; coberturas: number; descobertos: number; excedentes: number }[];
  volantes: number;
  descobertosTotal: number;
  alocacoes: AlocacaoDto[];
  totalAlocados: number;
};

/** RN05/RN07: quadro do contrato na data (hoje por padrão). */
export async function quadroContrato(contratoId: string, dia: Date, podeVer: boolean, opts?: { incluirEncerradas?: boolean }): Promise<QuadroContrato> {
  const contrato = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { numero: true, vigencias: { orderBy: { ordem: "asc" }, select: { id: true, dataInicio: true, dataFim: true } } } });
  const vig = contrato?.vigencias.find((v) => diaUtc(v.dataInicio) <= diaUtc(dia) && diaUtc(dia) <= diaUtc(v.dataFim)) ?? contrato?.vigencias.at(-1) ?? null;
  const itens = await prisma.contratoItem.findMany({
    where: { contratoId, ...(vig ? { vigenciaId: vig.id } : {}) },
    select: { id: true, descricao: true, quantidade: true, unidadeMaoDeObra: true, colaboradoresPorPosto: true, vigenteDe: true, vigenteAte: true },
    orderBy: { descricao: "asc" },
  });
  const vigentes = itensVigentesEm(itens, dia);
  const alocs = await prisma.alocacao.findMany({
    where: { contratoId, ...(opts?.incluirEncerradas ? {} : { OR: [{ dataFim: null }, { dataFim: { gte: diaUtc(dia) } }] }) },
    include: { colaborador: { select: { id: true, nome: true, cpfMascarado: true } }, contratoItem: { select: { descricao: true } } },
    orderBy: [{ dataInicio: "desc" }],
  });
  const base: AlocacaoBase[] = alocs.map((a) => ({ id: a.id, colaboradorId: a.colaboradorId, contratoId: a.contratoId, contratoItemId: a.contratoItemId, tipo: a.tipo, dataInicio: a.dataInicio, dataFim: a.dataFim }));
  const q = quadroDoContrato(vigentes.map((i) => ({ id: i.id, descricao: i.descricao, necessarios: colaboradoresNecessarios(i) })), base, dia);
  const vigentesDia = alocs.filter((a) => diaUtc(a.dataInicio) <= diaUtc(dia) && (!a.dataFim || diaUtc(a.dataFim) >= diaUtc(dia)));
  return {
    ...q,
    totalAlocados: new Set(vigentesDia.map((a) => a.colaboradorId)).size,
    alocacoes: vigentesDia.map((a) => ({
      id: a.id,
      colaboradorId: a.colaboradorId,
      colaboradorNome: podeVer ? a.colaborador.nome : "Colaborador",
      cpfMascarado: podeVer ? a.colaborador.cpfMascarado : "***.***.***-**",
      contratoId: a.contratoId,
      contratoNumero: contrato?.numero ?? "",
      contratoItemId: a.contratoItemId,
      itemDescricao: a.contratoItem?.descricao ?? null,
      tipo: a.tipo,
      dataInicio: a.dataInicio.toISOString(),
      dataFim: a.dataFim ? a.dataFim.toISOString() : null,
      motivoFim: a.motivoFim,
      observacao: a.observacao,
    })),
  };
}

// ─────────────────────────────────────────────
// Retenção e anonimização (ESP-007 RN07)
// ─────────────────────────────────────────────

const ANO_MS = 365.25 * 86_400_000;

async function candidatosARetencao(contaId: string, anos: number, hoje: Date, margemDias: number) {
  // Desligado há mais de (anos − margem) e sem contrato de alocação ainda dentro do prazo.
  const limite = new Date(hoje.getTime() - anos * ANO_MS + margemDias * 86_400_000);
  const cols = await prisma.colaborador.findMany({
    where: { contaId, situacao: "DESLIGADO", anonimizadoEm: null, dataDesligamento: { lte: limite } },
    include: { alocacoes: { include: { contrato: { select: { vigenciaFim: true } } } } },
  });
  return cols.filter((c) => c.alocacoes.every((a) => a.contrato.vigenciaFim.getTime() <= limite.getTime()));
}

export async function avisoRetencao(contaId: string, hoje = new Date()): Promise<{ anos: number; emAviso: number; vencidos: number }> {
  const conta = await prisma.conta.findUnique({ where: { id: contaId }, select: { retencaoDadosColaboradoresAnos: true } });
  const anos = conta?.retencaoDadosColaboradoresAnos ?? 5;
  const [emAviso, vencidos] = await Promise.all([candidatosARetencao(contaId, anos, hoje, 30), candidatosARetencao(contaId, anos, hoje, 0)]);
  return { anos, emAviso: emAviso.length - vencidos.length, vencidos: vencidos.length };
}

export async function anonimizarColaborador(id: string, contaId: string, usuarioId: string | null, motivo: string): Promise<void> {
  const c = await prisma.colaborador.findFirst({ where: { id, contaId }, select: { id: true, nome: true, cpfMascarado: true } });
  if (!c) return;
  await prisma.colaborador.update({
    where: { id },
    data: { nome: "Colaborador anonimizado", cpfCifrado: "", cpfHash: `anon:${id}`, cpfMascarado: "***.***.***-**", telefone: null, cbo: null, anonimizadoEm: new Date() },
  });
  await registrarAuditoria({ contaId, usuarioId, acao: "ATUALIZAR", recurso: "Colaborador", recursoId: id, resumo: `Colaborador anonimizado (${motivo}); histórico de alocações preservado sem identificação` });
}

/** Rotina diária: avisa o Admin 30 dias antes e anonimiza quem venceu o prazo. */
export async function rodarRetencaoColaboradores(hoje = new Date()): Promise<{ avisados: number; anonimizados: number; detalhes: string[] }> {
  const contas = await prisma.conta.findMany({ where: { colaboradores: { some: { situacao: "DESLIGADO", anonimizadoEm: null } } }, select: { id: true, retencaoDadosColaboradoresAnos: true, empresas: { select: { razaoSocial: true }, take: 1 } } });
  let avisados = 0;
  let anonimizados = 0;
  const detalhes: string[] = [];
  for (const conta of contas) {
    const anos = conta.retencaoDadosColaboradoresAnos;
    const vencidos = await candidatosARetencao(conta.id, anos, hoje, 0);
    for (const c of vencidos) {
      await anonimizarColaborador(c.id, conta.id, null, `prazo de retenção de ${anos} ano(s) após o desligamento`);
      anonimizados++;
    }
    const proximos = (await candidatosARetencao(conta.id, anos, hoje, 30)).filter((c) => !vencidos.some((v) => v.id === c.id) && !c.avisoAnonimizacaoEm);
    if (proximos.length > 0) {
      const admin = await prisma.usuario.findFirst({ where: { contaId: conta.id, perfil: "ADMIN", telefoneWhatsApp: { not: null } }, orderBy: { criadoEm: "asc" }, select: { id: true } });
      if (admin) {
        const { dispararNotificacao } = await import("@/lib/whatsapp");
        await dispararNotificacao({
          usuarioId: admin.id,
          tipo: "LGPD_ANONIMIZACAO",
          referenciaId: `${conta.id}-${hoje.toISOString().slice(0, 7)}`,
          mensagem:
            `🔒 *Retenção de dados de colaboradores*\n\n` +
            `${proximos.length} colaborador(es) desligado(s) há quase ${anos} ano(s) serão anonimizados em até 30 dias, conforme o prazo configurado em Conta › Privacidade. ` +
            `Depois disso ficam só os números agregados. Se precisar manter por mais tempo, aumente o prazo lá antes do vencimento.\n\n— Contato CP System`,
        }).catch(() => {});
      }
      await prisma.colaborador.updateMany({ where: { id: { in: proximos.map((p) => p.id) } }, data: { avisoAnonimizacaoEm: hoje } });
      avisados += proximos.length;
    }
    if (vencidos.length || proximos.length) detalhes.push(`${conta.empresas[0]?.razaoSocial ?? conta.id}: ${vencidos.length} anonimizado(s), ${proximos.length} em aviso`);
  }
  return { avisados, anonimizados, detalhes };
}
