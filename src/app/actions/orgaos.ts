"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { LIMITE_CARONA_POR_ORGAO_PCT, LIMITE_CARONA_TOTAL_PCT, normalizarCnpj } from "@/lib/validators";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  calcularDiff,
  CAMPOS_ATA_ITEM,
  CAMPOS_CONTRATO_ITEM,
  CAMPOS_EMPENHO_ITEM,
  CAMPOS_ENDERECO_ENTREGA,
  CAMPOS_ORGAO_NA_ATA,
  CAMPOS_PONTO_FOCAL,
} from "@/lib/diff";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";

type Result = { erro?: string; ok?: boolean };

// Helper: confere tenancy + permissão de edição do recurso pai.
// Retorna ataId/contratoId/empenhoId pra revalidar a página certa.
// Lança quando o recurso pertence a outra conta ou o usuário não tem permissão.
async function escopoDoRecursoFilho(
  usuario: {
    id: string;
    contaId: string;
    perfil: "ADMIN" | "OPERACIONAL" | "VISUALIZADOR";
    superAdmin: boolean;
  },
  rec: { ataId: string | null; contratoId: string | null; empenhoId: string | null },
): Promise<{ ataId?: string; contratoId?: string; empenhoId?: string }> {
  if (rec.ataId) {
    const ata = await prisma.ata.findFirst({
      where: { id: rec.ataId, empresa: { contaId: usuario.contaId } },
      select: { id: true, criadoPorId: true },
    });
    if (!ata) throw new Error("Ata sem permissão.");
    if (!podeEditarDocumento(usuario, ata)) throw new Error(mensagemSemPermissao(ata));
    return { ataId: rec.ataId };
  }
  if (rec.contratoId) {
    const contrato = await prisma.contrato.findFirst({
      where: { id: rec.contratoId, empresa: { contaId: usuario.contaId } },
      select: { id: true, criadoPorId: true },
    });
    if (!contrato) throw new Error("Contrato sem permissão.");
    if (!podeEditarDocumento(usuario, contrato)) throw new Error(mensagemSemPermissao(contrato));
    return { contratoId: rec.contratoId };
  }
  if (rec.empenhoId) {
    const empenho = await prisma.empenho.findFirst({
      where: { id: rec.empenhoId, empresa: { contaId: usuario.contaId } },
      select: { id: true, criadoPorId: true },
    });
    if (!empenho) throw new Error("Empenho sem permissão.");
    if (!podeEditarDocumento(usuario, empenho)) throw new Error(mensagemSemPermissao(empenho));
    return { empenhoId: rec.empenhoId };
  }
  throw new Error("Registro sem vínculo (ata/contrato/empenho).");
}

async function valorTotalAta(ataId: string): Promise<number> {
  const itens = await prisma.ataItem.findMany({ where: { ataId }, select: { valorTotal: true } });
  return itens.reduce((s, i) => s + i.valorTotal, 0);
}

export async function adicionarOrgaoNaAtaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "");
  const tipo = String(formData.get("tipo") || "") as "GERENCIADOR" | "PARTICIPANTE" | "CARONA";

  const ata = await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } });
  if (!ata) return { erro: "Ata não encontrada." };

  if (tipo === "CARONA" && !ata.aceitaCarona) {
    return { erro: "Esta Ata não aceita carona — habilite no cadastro principal antes." };
  }

  let limiteValor: number | null = null;
  let limitePct: number | null = null;

  if (tipo === "CARONA") {
    const valorTotal = await valorTotalAta(ataId);
    limitePct = formData.get("limitePct") ? Number(formData.get("limitePct")) : LIMITE_CARONA_POR_ORGAO_PCT;
    if (limitePct > LIMITE_CARONA_POR_ORGAO_PCT) {
      return {
        erro: `Limite por carona não pode exceder ${LIMITE_CARONA_POR_ORGAO_PCT}% (Lei 14.133/2021 art. 86).`,
      };
    }

    // Verifica limite total dos caronas
    const caronasExistentes = await prisma.orgaoNaAta.findMany({
      where: { ataId, tipo: "CARONA" },
      select: { limitePct: true },
    });
    const somaPct = caronasExistentes.reduce((s, c) => s + (c.limitePct || 0), 0) + limitePct;
    if (somaPct > LIMITE_CARONA_TOTAL_PCT) {
      return {
        erro: `Soma dos limites de carona ultrapassaria ${LIMITE_CARONA_TOTAL_PCT}% (atual: ${somaPct.toFixed(0)}%).`,
      };
    }

    limiteValor = (valorTotal * limitePct) / 100;
  }

  await prisma.orgaoNaAta.create({
    data: {
      ataId,
      tipo,
      nome: String(formData.get("nome") || ""),
      cnpj: normalizarCnpj(String(formData.get("cnpj") || "")),
      endereco: String(formData.get("endereco") || ""),
      email: String(formData.get("email") || "") || null,
      telefone: String(formData.get("telefone") || "") || null,
      limiteValor,
      limitePct,
    },
  });

  revalidatePath(`/atas/${ataId}`);
  return { ok: true };
}

export async function adicionarEnderecoEntregaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;
  const orgaoNaAtaId = String(formData.get("orgaoNaAtaId") || "") || undefined;

  // Validações de pertinência
  if (ataId && !(await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Ata inválida." };
  if (contratoId && !(await prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Contrato inválido." };
  if (empenhoId && !(await prisma.empenho.findFirst({ where: { id: empenhoId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Empenho inválido." };

  await prisma.enderecoEntrega.create({
    data: {
      rotulo: String(formData.get("rotulo") || "") || null,
      endereco: String(formData.get("endereco") || ""),
      ataId: ataId || null,
      contratoId: contratoId || null,
      empenhoId: empenhoId || null,
      orgaoNaAtaId: orgaoNaAtaId || null,
    },
  });

  if (ataId) revalidatePath(`/atas/${ataId}`);
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
  if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
  return { ok: true };
}

// ============================================================
// ATUALIZAR / REMOVER — endereços, pontos focais, órgãos
// ============================================================

export async function atualizarEnderecoEntregaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const enderecoAntes = await prisma.enderecoEntrega.findUnique({ where: { id } });
  if (!enderecoAntes) return { erro: "Endereço não encontrado." };

  let escopo;
  try {
    escopo = await escopoDoRecursoFilho(usuario, enderecoAntes);
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Sem permissão." };
  }

  const dadosNovos = {
    rotulo: String(formData.get("rotulo") || "") || null,
    endereco: String(formData.get("endereco") || ""),
  };

  await prisma.enderecoEntrega.update({ where: { id }, data: dadosNovos });

  const mudancas = calcularDiff(
    enderecoAntes as unknown as Record<string, unknown>,
    dadosNovos,
    CAMPOS_ENDERECO_ENTREGA,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "EnderecoEntrega",
    recursoId: id,
    titulo: `Endereço${enderecoAntes.rotulo ? ` "${enderecoAntes.rotulo}"` : ""}`,
    mudancas,
  });

  if (escopo.ataId) revalidatePath(`/atas/${escopo.ataId}`);
  if (escopo.contratoId) revalidatePath(`/contratos/${escopo.contratoId}`);
  if (escopo.empenhoId) revalidatePath(`/execucao/${escopo.empenhoId}`);
  return { ok: true };
}

export async function removerEnderecoEntregaAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const endereco = await prisma.enderecoEntrega.findUnique({
    where: { id },
    select: { ataId: true, contratoId: true, empenhoId: true },
  });
  if (!endereco) throw new Error("Endereço não encontrado.");

  const escopo = await escopoDoRecursoFilho(usuario, endereco);
  await prisma.enderecoEntrega.delete({ where: { id } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "EnderecoEntrega",
    recursoId: id,
    resumo: "Endereço de entrega removido",
  });

  if (escopo.ataId) revalidatePath(`/atas/${escopo.ataId}`);
  if (escopo.contratoId) revalidatePath(`/contratos/${escopo.contratoId}`);
  if (escopo.empenhoId) revalidatePath(`/execucao/${escopo.empenhoId}`);
}

export async function atualizarPontoFocalAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const pfAntes = await prisma.pontoFocal.findUnique({ where: { id } });
  if (!pfAntes) return { erro: "Ponto focal não encontrado." };

  let escopo;
  try {
    escopo = await escopoDoRecursoFilho(usuario, pfAntes);
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Sem permissão." };
  }

  const funcao = String(formData.get("funcao") || "CONTATO_GERAL") as
    | "GESTOR"
    | "FISCAL_TECNICO"
    | "FISCAL_ADMINISTRATIVO"
    | "RESPONSAVEL_SETOR"
    | "CONTATO_GERAL"
    | "AUTORIDADE_COMPETENTE"
    | "FISCAL"
    | "OUTRO";

  const dadosNovos = {
    funcao,
    funcaoDescricao:
      funcao === "OUTRO" ? (String(formData.get("funcaoDescricao") || "") || null) : null,
    nome: String(formData.get("nome") || ""),
    email: String(formData.get("email") || "") || null,
    telefone: String(formData.get("telefone") || "") || null,
  };

  await prisma.pontoFocal.update({ where: { id }, data: dadosNovos });

  const mudancas = calcularDiff(
    pfAntes as unknown as Record<string, unknown>,
    dadosNovos,
    CAMPOS_PONTO_FOCAL,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "PontoFocal",
    recursoId: id,
    titulo: `Ponto focal "${pfAntes.nome}"`,
    mudancas,
  });

  if (escopo.ataId) revalidatePath(`/atas/${escopo.ataId}`);
  if (escopo.contratoId) revalidatePath(`/contratos/${escopo.contratoId}`);
  if (escopo.empenhoId) revalidatePath(`/execucao/${escopo.empenhoId}`);
  return { ok: true };
}

export async function removerPontoFocalAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const pf = await prisma.pontoFocal.findUnique({
    where: { id },
    select: { ataId: true, contratoId: true, empenhoId: true },
  });
  if (!pf) throw new Error("Ponto focal não encontrado.");
  const escopo = await escopoDoRecursoFilho(usuario, pf);
  await prisma.pontoFocal.delete({ where: { id } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "PontoFocal",
    recursoId: id,
    resumo: "Ponto focal removido",
  });

  if (escopo.ataId) revalidatePath(`/atas/${escopo.ataId}`);
  if (escopo.contratoId) revalidatePath(`/contratos/${escopo.contratoId}`);
  if (escopo.empenhoId) revalidatePath(`/execucao/${escopo.empenhoId}`);
}

export async function atualizarOrgaoNaAtaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const orgaoAntes = await prisma.orgaoNaAta.findUnique({
    where: { id },
    include: {
      ata: {
        select: {
          aceitaCarona: true,
          criadoPorId: true,
          empresa: { select: { contaId: true } },
        },
      },
    },
  });
  if (!orgaoAntes) return { erro: "Órgão não encontrado." };
  if (orgaoAntes.ata.empresa.contaId !== usuario.contaId) return { erro: "Sem permissão." };
  if (!podeEditarDocumento(usuario, orgaoAntes.ata)) {
    return { erro: mensagemSemPermissao(orgaoAntes.ata) };
  }
  if (orgaoAntes.tipo === "GERENCIADOR") {
    return { erro: "Para alterar o órgão gerenciador, edite a Ata principal." };
  }
  const orgao = orgaoAntes;

  const nome = String(formData.get("nome") || "");
  const cnpj = String(formData.get("cnpj") || "");
  const endereco = String(formData.get("endereco") || "");
  const email = String(formData.get("email") || "") || null;
  const telefone = String(formData.get("telefone") || "") || null;

  let limitePct: number | null = orgao.limitePct;
  let limiteValor: number | null = null;
  if (orgao.tipo === "CARONA") {
    const pct = formData.get("limitePct") ? Number(formData.get("limitePct")) : null;
    if (pct !== null) {
      if (pct > LIMITE_CARONA_POR_ORGAO_PCT) {
        return { erro: `Limite por carona não pode exceder ${LIMITE_CARONA_POR_ORGAO_PCT}% (Lei 14.133 art. 86).` };
      }
      const outros = await prisma.orgaoNaAta.findMany({
        where: { ataId: orgao.ataId, tipo: "CARONA", id: { not: id } },
        select: { limitePct: true },
      });
      const soma = outros.reduce((s, c) => s + (c.limitePct || 0), 0) + pct;
      if (soma > LIMITE_CARONA_TOTAL_PCT) {
        return { erro: `Soma dos limites de carona ultrapassaria ${LIMITE_CARONA_TOTAL_PCT}%.` };
      }
      limitePct = pct;
      const itens = await prisma.ataItem.findMany({
        where: { ataId: orgao.ataId },
        select: { valorTotal: true },
      });
      const totalAta = itens.reduce((s, i) => s + i.valorTotal, 0);
      limiteValor = (totalAta * pct) / 100;
    }
  }

  const dadosNovos = {
    nome,
    cnpj: normalizarCnpj(cnpj),
    endereco,
    email,
    telefone,
    limitePct,
  };

  await prisma.orgaoNaAta.update({
    where: { id },
    data: { ...dadosNovos, limiteValor },
  });

  const mudancas = calcularDiff(
    orgaoAntes as unknown as Record<string, unknown>,
    dadosNovos,
    CAMPOS_ORGAO_NA_ATA,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "OrgaoNaAta",
    recursoId: id,
    titulo: `Órgão "${orgaoAntes.nome}"`,
    mudancas,
  });

  revalidatePath(`/atas/${orgao.ataId}`);
  return { ok: true };
}

export async function removerOrgaoNaAtaAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const orgao = await prisma.orgaoNaAta.findUnique({
    where: { id },
    select: {
      ataId: true,
      tipo: true,
      nome: true,
      ata: { select: { criadoPorId: true, empresa: { select: { contaId: true } } } },
    },
  });
  if (!orgao) throw new Error("Órgão não encontrado.");
  if (orgao.ata.empresa.contaId !== usuario.contaId) throw new Error("Sem permissão.");
  if (!podeEditarDocumento(usuario, orgao.ata)) throw new Error(mensagemSemPermissao(orgao.ata));
  if (orgao.tipo === "GERENCIADOR") {
    throw new Error("Não é possível remover o órgão gerenciador.");
  }
  await prisma.orgaoNaAta.delete({ where: { id } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "OrgaoNaAta",
    recursoId: id,
    resumo: `Órgão "${orgao.nome}" removido`,
  });

  revalidatePath(`/atas/${orgao.ataId}`);
}

// ============================================================
// ITENS DA ATA — atualizar/remover inline
// ============================================================

export async function atualizarAtaItemAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const itemAntes = await prisma.ataItem.findUnique({
    where: { id },
    include: {
      ata: { select: { criadoPorId: true, empresa: { select: { contaId: true } } } },
    },
  });
  if (!itemAntes) return { erro: "Item não encontrado." };
  if (itemAntes.ata.empresa.contaId !== usuario.contaId) return { erro: "Sem permissão." };
  if (!podeEditarDocumento(usuario, itemAntes.ata)) {
    return { erro: mensagemSemPermissao(itemAntes.ata) };
  }

  const descricao = String(formData.get("descricao") || "");
  const unidade = String(formData.get("unidade") || "");
  const quantidade = Number(formData.get("quantidade") || 0);
  const marca = String(formData.get("marca") || "") || null;
  const valorUnitario = Number(formData.get("valorUnitario") || 0);
  const lote = String(formData.get("lote") || "") || null;
  const numero = String(formData.get("numero") || "") || null;

  if (!descricao || !unidade || quantidade <= 0 || valorUnitario <= 0) {
    return { erro: "Preencha descrição, unidade, quantidade > 0 e valor unitário > 0." };
  }

  const dadosNovos = { descricao, unidade, quantidade, marca, valorUnitario, lote, numero };

  await prisma.ataItem.update({
    where: { id },
    data: { ...dadosNovos, valorTotal: quantidade * valorUnitario },
  });

  const mudancas = calcularDiff(
    itemAntes as unknown as Record<string, unknown>,
    dadosNovos,
    CAMPOS_ATA_ITEM,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "AtaItem",
    recursoId: id,
    titulo: `Item "${itemAntes.descricao.slice(0, 60)}"`,
    mudancas,
  });

  revalidatePath(`/atas/${itemAntes.ataId}`);
  return { ok: true };
}

export async function removerAtaItemAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const item = await prisma.ataItem.findUnique({
    where: { id },
    select: {
      ataId: true,
      descricao: true,
      ata: { select: { criadoPorId: true, empresa: { select: { contaId: true } } } },
      contratoItens: { select: { id: true } },
      empenhoItens: { select: { id: true } },
    },
  });
  if (!item) throw new Error("Item não encontrado.");
  if (item.ata.empresa.contaId !== usuario.contaId) throw new Error("Sem permissão.");
  if (!podeEditarDocumento(usuario, item.ata)) throw new Error(mensagemSemPermissao(item.ata));
  if (item.contratoItens.length > 0 || item.empenhoItens.length > 0) {
    throw new Error(
      `Item "${item.descricao}" está vinculado a um Contrato ou Empenho. Remova-o do documento dependente antes.`,
    );
  }

  await prisma.ataItem.delete({ where: { id } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "AtaItem",
    recursoId: id,
    resumo: `Item "${item.descricao}" removido`,
  });

  revalidatePath(`/atas/${item.ataId}`);
}

// ============================================================
// ITENS DO CONTRATO — atualizar/remover inline
// ============================================================
export async function atualizarContratoItemAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const itemAntes = await prisma.contratoItem.findUnique({
    where: { id },
    include: {
      contrato: { select: { criadoPorId: true, empresa: { select: { contaId: true } } } },
    },
  });
  if (!itemAntes) return { erro: "Item não encontrado." };
  if (itemAntes.contrato.empresa.contaId !== usuario.contaId)
    return { erro: "Sem permissão." };
  if (!podeEditarDocumento(usuario, itemAntes.contrato)) {
    return { erro: mensagemSemPermissao(itemAntes.contrato) };
  }

  const descricao = String(formData.get("descricao") || "");
  const unidade = String(formData.get("unidade") || "");
  const quantidade = Number(formData.get("quantidade") || 0);
  const marca = String(formData.get("marca") || "") || null;
  const valorUnitario = Number(formData.get("valorUnitario") || 0);

  if (!descricao || !unidade || quantidade <= 0 || valorUnitario <= 0) {
    return { erro: "Preencha descrição, unidade, quantidade > 0 e valor unitário > 0." };
  }

  const dadosNovos = { descricao, unidade, quantidade, marca, valorUnitario };

  await prisma.contratoItem.update({
    where: { id },
    data: { ...dadosNovos, valorTotal: quantidade * valorUnitario },
  });

  const mudancas = calcularDiff(
    itemAntes as unknown as Record<string, unknown>,
    dadosNovos,
    CAMPOS_CONTRATO_ITEM,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "ContratoItem",
    recursoId: id,
    titulo: `Item "${itemAntes.descricao.slice(0, 60)}"`,
    mudancas,
  });

  revalidatePath(`/contratos/${itemAntes.contratoId}`);
  return { ok: true };
}

export async function removerContratoItemAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const item = await prisma.contratoItem.findUnique({
    where: { id },
    include: {
      contrato: {
        select: {
          criadoPorId: true,
          empenhos: { select: { id: true } },
          empresa: { select: { contaId: true } },
        },
      },
    },
  });
  if (!item) throw new Error("Item não encontrado.");
  if (item.contrato.empresa.contaId !== usuario.contaId) throw new Error("Sem permissão.");
  if (!podeEditarDocumento(usuario, item.contrato))
    throw new Error(mensagemSemPermissao(item.contrato));
  // ContratoItem não tem FK reversa, mas se o contrato tem empenhos
  // referenciando o mesmo AtaItem (ou descrição), remover pode corromper
  // o saldo. Mais seguro bloquear quando há empenhos.
  if (item.contrato.empenhos.length > 0) {
    throw new Error(
      `Este contrato tem ${item.contrato.empenhos.length} empenho(s) vinculados. Remova-os antes para não bagunçar o saldo.`,
    );
  }
  await prisma.contratoItem.delete({ where: { id } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "ContratoItem",
    recursoId: id,
    resumo: `Item "${item.descricao}" removido`,
  });

  revalidatePath(`/contratos/${item.contratoId}`);
}

// ============================================================
// ITENS DO EMPENHO — atualizar/remover inline
// ============================================================
export async function atualizarEmpenhoItemAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const itemAntes = await prisma.empenhoItem.findUnique({
    where: { id },
    include: {
      empenho: {
        select: {
          status: true,
          criadoPorId: true,
          empresa: { select: { contaId: true } },
        },
      },
    },
  });
  if (!itemAntes) return { erro: "Item não encontrado." };
  if (itemAntes.empenho.empresa.contaId !== usuario.contaId)
    return { erro: "Sem permissão." };
  if (!podeEditarDocumento(usuario, itemAntes.empenho)) {
    return { erro: mensagemSemPermissao(itemAntes.empenho) };
  }
  if (itemAntes.empenho.status === "PAGO")
    return { erro: "Empenho já pago não pode ser editado." };

  const descricao = String(formData.get("descricao") || "");
  const unidade = String(formData.get("unidade") || "");
  const quantidade = Number(formData.get("quantidade") || 0);
  const marca = String(formData.get("marca") || "") || null;
  const valorUnitario = Number(formData.get("valorUnitario") || 0);

  if (!descricao || !unidade || quantidade <= 0 || valorUnitario <= 0) {
    return { erro: "Preencha descrição, unidade, quantidade > 0 e valor unitário > 0." };
  }

  const dadosNovos = { descricao, unidade, quantidade, marca, valorUnitario };

  await prisma.empenhoItem.update({
    where: { id },
    data: { ...dadosNovos, valorTotal: quantidade * valorUnitario },
  });

  const mudancas = calcularDiff(
    itemAntes as unknown as Record<string, unknown>,
    dadosNovos,
    CAMPOS_EMPENHO_ITEM,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "EmpenhoItem",
    recursoId: id,
    titulo: `Item "${itemAntes.descricao.slice(0, 60)}"`,
    mudancas,
  });

  revalidatePath(`/execucao/${itemAntes.empenhoId}`);
  return { ok: true };
}

export async function removerEmpenhoItemAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id") || "");
  const item = await prisma.empenhoItem.findUnique({
    where: { id },
    include: {
      empenho: {
        select: {
          status: true,
          criadoPorId: true,
          empresa: { select: { contaId: true } },
        },
      },
    },
  });
  if (!item) throw new Error("Item não encontrado.");
  if (item.empenho.empresa.contaId !== usuario.contaId) throw new Error("Sem permissão.");
  if (!podeEditarDocumento(usuario, item.empenho))
    throw new Error(mensagemSemPermissao(item.empenho));
  if (item.empenho.status === "PAGO") throw new Error("Empenho já pago não pode ser editado.");

  await prisma.empenhoItem.delete({ where: { id } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "EmpenhoItem",
    recursoId: id,
    resumo: `Item "${item.descricao}" removido`,
  });

  revalidatePath(`/execucao/${item.empenhoId}`);
}

export async function adicionarPontoFocalAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;
  const orgaoNaAtaId = String(formData.get("orgaoNaAtaId") || "") || undefined;

  if (ataId && !(await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Ata inválida." };
  if (contratoId && !(await prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Contrato inválido." };
  if (empenhoId && !(await prisma.empenho.findFirst({ where: { id: empenhoId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Empenho inválido." };

  await prisma.pontoFocal.create({
    data: {
      funcao: String(formData.get("funcao") || "CONTATO_GERAL") as "GESTOR" | "FISCAL_TECNICO" | "FISCAL_ADMINISTRATIVO" | "RESPONSAVEL_SETOR" | "CONTATO_GERAL",
      nome: String(formData.get("nome") || ""),
      email: String(formData.get("email") || "") || null,
      telefone: String(formData.get("telefone") || "") || null,
      ataId: ataId || null,
      contratoId: contratoId || null,
      empenhoId: empenhoId || null,
      orgaoNaAtaId: orgaoNaAtaId || null,
    },
  });

  if (ataId) revalidatePath(`/atas/${ataId}`);
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
  if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
  return { ok: true };
}
