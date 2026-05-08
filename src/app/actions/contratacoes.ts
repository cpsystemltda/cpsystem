"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { calcularSaldoAta, calcularSaldoContrato } from "@/lib/saldo";
import { notificarAnalistasDaEmpresa } from "@/lib/notificacoes";
import {
  novaAtaSchema,
  novoContratoSchema,
  novoEmpenhoSchema,
  normalizarCnpj,
} from "@/lib/validators";
import { salvarArquivo } from "@/lib/uploads";

type ActionResult = { erro?: string; campos?: Record<string, string> };

function parseItens(formData: FormData) {
  const out: {
    descricao: string;
    unidade: string;
    quantidade: number;
    marca?: string;
    valorUnitario: number;
    ataItemId?: string;
    lote?: string;
  }[] = [];

  // formato: itens[0][descricao], itens[0][unidade], etc.
  let i = 0;
  while (formData.has(`itens[${i}][descricao]`)) {
    out.push({
      descricao: String(formData.get(`itens[${i}][descricao]`) || ""),
      unidade: String(formData.get(`itens[${i}][unidade]`) || ""),
      quantidade: Number(formData.get(`itens[${i}][quantidade]`) || 0),
      marca: String(formData.get(`itens[${i}][marca]`) || "") || undefined,
      valorUnitario: Number(formData.get(`itens[${i}][valorUnitario]`) || 0),
      ataItemId: String(formData.get(`itens[${i}][ataItemId]`) || "") || undefined,
      lote: String(formData.get(`itens[${i}][lote]`) || "") || undefined,
    });
    i++;
  }
  return out;
}

function parseOrgaosParticipantes(formData: FormData) {
  const out: {
    tipo: "PARTICIPANTE" | "CARONA";
    nome: string;
    cnpj: string;
    endereco: string;
    email?: string;
    telefone?: string;
  }[] = [];
  let i = 0;
  while (formData.has(`orgaosParticipantes[${i}][nome]`)) {
    const nome = String(formData.get(`orgaosParticipantes[${i}][nome]`) || "").trim();
    if (nome) {
      out.push({
        tipo: (String(formData.get(`orgaosParticipantes[${i}][tipo]`) || "PARTICIPANTE")) as
          | "PARTICIPANTE"
          | "CARONA",
        nome,
        cnpj: String(formData.get(`orgaosParticipantes[${i}][cnpj]`) || ""),
        endereco: String(formData.get(`orgaosParticipantes[${i}][endereco]`) || ""),
        email: String(formData.get(`orgaosParticipantes[${i}][email]`) || "") || undefined,
        telefone: String(formData.get(`orgaosParticipantes[${i}][telefone]`) || "") || undefined,
      });
    }
    i++;
  }
  return out;
}

function parseEnderecosEntrega(formData: FormData) {
  const out: { rotulo?: string; endereco: string }[] = [];
  let i = 0;
  while (formData.has(`enderecosEntrega[${i}][endereco]`)) {
    out.push({
      rotulo: String(formData.get(`enderecosEntrega[${i}][rotulo]`) || "") || undefined,
      endereco: String(formData.get(`enderecosEntrega[${i}][endereco]`) || ""),
    });
    i++;
  }
  return out;
}

type FuncaoFocal =
  | "AUTORIDADE_COMPETENTE"
  | "GESTOR"
  | "FISCAL"
  | "FISCAL_TECNICO"
  | "FISCAL_ADMINISTRATIVO"
  | "RESPONSAVEL_SETOR"
  | "CONTATO_GERAL"
  | "OUTRO";

function parsePontosFocais(formData: FormData) {
  const out: {
    funcao: FuncaoFocal;
    funcaoDescricao?: string;
    nome: string;
    email?: string;
    telefone?: string;
  }[] = [];
  let i = 0;
  while (formData.has(`pontosFocais[${i}][nome]`)) {
    const nome = String(formData.get(`pontosFocais[${i}][nome]`) || "").trim();
    if (nome) {
      out.push({
        funcao: String(formData.get(`pontosFocais[${i}][funcao]`) || "CONTATO_GERAL") as FuncaoFocal,
        funcaoDescricao:
          String(formData.get(`pontosFocais[${i}][funcaoDescricao]`) || "") || undefined,
        nome,
        email: String(formData.get(`pontosFocais[${i}][email]`) || "") || undefined,
        telefone: String(formData.get(`pontosFocais[${i}][telefone]`) || "") || undefined,
      });
    }
    i++;
  }
  return out;
}

function parseParcelas(formData: FormData) {
  const out: { numero: number; prazoDias: number; descricao?: string; valorEstimado?: number }[] = [];
  let i = 0;
  while (formData.has(`parcelas[${i}][prazoDias]`)) {
    const valor = formData.get(`parcelas[${i}][valorEstimado]`);
    out.push({
      numero: Number(formData.get(`parcelas[${i}][numero]`) || i + 1),
      prazoDias: Number(formData.get(`parcelas[${i}][prazoDias]`) || 0),
      descricao: String(formData.get(`parcelas[${i}][descricao]`) || "") || undefined,
      valorEstimado: valor ? Number(valor) : undefined,
    });
    i++;
  }
  return out;
}

function extrairCampos(formData: FormData) {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (
      k.startsWith("itens[") ||
      k.startsWith("parcelas[") ||
      k.startsWith("enderecosEntrega[") ||
      k.startsWith("pontosFocais[") ||
      k.startsWith("orgaosParticipantes[")
    )
      continue;
    obj[k] = v;
  }
  obj.itens = parseItens(formData);
  const parcelas = parseParcelas(formData);
  if (parcelas.length > 0) obj.parcelas = parcelas;
  const enderecosEntrega = parseEnderecosEntrega(formData);
  if (enderecosEntrega.length > 0) obj.enderecosEntrega = enderecosEntrega;
  const pontosFocais = parsePontosFocais(formData);
  if (pontosFocais.length > 0) obj.pontosFocais = pontosFocais;
  const orgaosParticipantes = parseOrgaosParticipantes(formData);
  if (orgaosParticipantes.length > 0) obj.orgaosParticipantes = orgaosParticipantes;
  if (obj.aceitaCarona === "on") obj.aceitaCarona = true;
  if (obj.prazoEntregaNaoAplica === "on") obj.prazoEntregaNaoAplica = true;
  return obj;
}

async function pegarEmpresaDoUsuario(empresaId: string, contaId: string) {
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, contaId } });
  if (!empresa) throw new Error("Empresa inválida.");
  return empresa;
}

// ============================================================
// ATA
// ============================================================
export async function criarAtaAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  const dados = extrairCampos(formData);
  const parsed = novaAtaSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (!campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos };
  }

  const v = parsed.data;
  await pegarEmpresaDoUsuario(v.empresaId, usuario.contaId);

  if (v.vigenciaFim < v.vigenciaInicio) {
    return { erro: "A vigência final precisa ser posterior à inicial." };
  }

  try {
    const ata = await prisma.ata.create({
      data: {
        empresaId: v.empresaId,
        tipo: v.tipo,
        numero: v.numero,
        processoAdministrativo: v.processoAdministrativo,
        procedimentoSelecao: v.procedimentoSelecao,
        numeroLicitacao: v.numeroLicitacao || null,
        orgaoNome: v.orgaoNome,
        orgaoCnpj: normalizarCnpj(v.orgaoCnpj),
        orgaoEndereco: v.orgaoEndereco,
        orgaoEmail: v.orgaoEmail || null,
        orgaoTelefone: v.orgaoTelefone || null,
        objeto: v.objeto,
        dataAssinatura: v.dataAssinatura,
        dataPublicacao: v.dataPublicacao || null,
        vigenciaInicio: v.vigenciaInicio,
        vigenciaFim: v.vigenciaFim,
        prazoEntregaDias: v.prazoEntregaNaoAplica ? null : (v.prazoEntregaDias || null),
        prazoEntregaNaoAplica: !!v.prazoEntregaNaoAplica,
        prazoPagamentoDias: v.prazoPagamentoDias || null,
        marcoOrcamentoEstimado: v.marcoOrcamentoEstimado || null,
        marcoReajusteOrigem: v.marcoReajusteOrigem || null,
        aceitaCarona: !!v.aceitaCarona,
        idAtaPncp: v.idAtaPncp || null,
        itens: {
          create: v.itens.map((i) => ({
            descricao: i.descricao,
            unidade: i.unidade,
            quantidade: i.quantidade,
            marca: i.marca || null,
            valorUnitario: i.valorUnitario,
            valorTotal: i.quantidade * i.valorUnitario,
            lote: i.lote || null,
          })),
        },
        ...(v.enderecosEntrega && v.enderecosEntrega.length > 0 && {
          enderecosEntrega: {
            create: v.enderecosEntrega.map((e) => ({
              rotulo: e.rotulo || null,
              endereco: e.endereco,
            })),
          },
        }),
        ...(v.pontosFocais && v.pontosFocais.length > 0 && {
          pontosFocais: {
            create: v.pontosFocais.map((p) => ({
              funcao: p.funcao,
              funcaoDescricao: p.funcao === "OUTRO" ? (p.funcaoDescricao || null) : null,
              nome: p.nome,
              email: p.email || null,
              telefone: p.telefone || null,
            })),
          },
        }),
        ...(v.orgaosParticipantes && v.orgaosParticipantes.length > 0 && {
          orgaos: {
            create: v.orgaosParticipantes.map((o) => ({
              tipo: o.tipo,
              nome: o.nome,
              cnpj: normalizarCnpj(o.cnpj),
              endereco: o.endereco,
              email: o.email || null,
              telefone: o.telefone || null,
            })),
          },
        }),
      },
    });

    revalidatePath("/atas");
    revalidatePath("/dashboard");
    redirect(`/atas/${ata.id}`);
  } catch (err) {
    // Bug PDF: "preenchi tudo mas não cadastrou" — log + retornar erro humanizado
    // Erros mais comuns: duplicidade de número, FK inválida, campo obrigatório vazio
    if (err instanceof Error) {
      const msg = err.message;
      // redirect() do Next.js dispara erro NEXT_REDIRECT — relançar
      if (msg.includes("NEXT_REDIRECT")) throw err;
      console.error("[criarAtaAction] erro ao salvar Ata:", msg);
      return {
        erro: `Não foi possível salvar a Ata: ${msg.slice(0, 240)}`,
      };
    }
    throw err;
  }
}

// ============================================================
// CONTRATO
// ============================================================
export async function criarContratoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  const dados = extrairCampos(formData);
  const parsed = novoContratoSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (!campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos };
  }

  const v = parsed.data;
  await pegarEmpresaDoUsuario(v.empresaId, usuario.contaId);

  // Se vincula a uma Ata, validar saldo
  if (v.ataId) {
    const ata = await prisma.ata.findFirst({
      where: { id: v.ataId, empresa: { contaId: usuario.contaId } },
    });
    if (!ata) return { erro: "Ata vinculada inválida." };

    const saldo = await calcularSaldoAta(v.ataId);
    for (const item of v.itens) {
      if (!item.ataItemId) {
        return { erro: "Itens vinculados a uma Ata precisam selecionar o item da Ata." };
      }
      const linha = saldo.itens.find((s) => s.ataItemId === item.ataItemId);
      if (!linha) return { erro: "Item da Ata não encontrado." };
      if (item.quantidade > linha.quantidadeDisponivel) {
        return {
          erro: `Saldo insuficiente: "${linha.descricao}" tem ${linha.quantidadeDisponivel} ${linha.unidade} disponíveis, você pediu ${item.quantidade}.`,
        };
      }
    }
  }

  const parcelasParaCriar =
    v.modalidadeEntrega === "PARCELADA" && v.parcelas
      ? v.parcelas.map((p) => ({
          numero: p.numero,
          prazoDias: p.prazoDias,
          descricao: p.descricao || null,
          valorEstimado: p.valorEstimado ?? null,
        }))
      : [];

  const contrato = await prisma.contrato.create({
    data: {
      empresaId: v.empresaId,
      ataId: v.ataId || null,
      tipo: v.tipo,
      numero: v.numero,
      numeroNotaEmpenho: v.numeroNotaEmpenho || null,
      numeroOrdemFornecimento: v.numeroOrdemFornecimento || null,
      processoAdministrativo: v.processoAdministrativo,
      procedimentoSelecao: v.procedimentoSelecao,
      numeroLicitacao: v.numeroLicitacao || null,
      orgaoNome: v.orgaoNome,
      orgaoCnpj: normalizarCnpj(v.orgaoCnpj),
      orgaoEndereco: v.orgaoEndereco,
      orgaoEmail: v.orgaoEmail || null,
      orgaoTelefone: v.orgaoTelefone || null,
      objeto: v.objeto,
      dataAssinatura: v.dataAssinatura,
      dataPublicacao: v.dataPublicacao || null,
      vigenciaInicio: v.vigenciaInicio,
      vigenciaFim: v.vigenciaFim,
      prazoEntregaDias: v.prazoEntregaDias || null,
      prazoPagamentoDias: v.prazoPagamentoDias || null,
      marcoOrcamentoEstimado: v.marcoOrcamentoEstimado || null,
      modalidadeEntrega: v.modalidadeEntrega,
      marcoInicialPrazo: v.modalidadeEntrega === "SOB_DEMANDA" ? null : v.marcoInicialPrazo ?? null,
      marcoInicialDescricao:
        v.marcoInicialPrazo === "OUTRO" ? v.marcoInicialDescricao?.trim() || null : null,
      itens: {
        create: v.itens.map((i) => ({
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: i.quantidade,
          marca: i.marca || null,
          valorUnitario: i.valorUnitario,
          valorTotal: i.quantidade * i.valorUnitario,
          ataItemId: i.ataItemId || null,
        })),
      },
      ...(parcelasParaCriar.length > 0 && { parcelas: { create: parcelasParaCriar } }),
      ...(v.enderecosEntrega && v.enderecosEntrega.length > 0 && {
        enderecosEntrega: {
          create: v.enderecosEntrega.map((e) => ({
            rotulo: e.rotulo || null,
            endereco: e.endereco,
          })),
        },
      }),
      ...(v.pontosFocais && v.pontosFocais.length > 0 && {
        pontosFocais: {
          create: v.pontosFocais.map((p) => ({
            funcao: p.funcao,
            nome: p.nome,
            email: p.email || null,
            telefone: p.telefone || null,
          })),
        },
      }),
    },
  });

  revalidatePath("/contratos");
  revalidatePath("/atas");
  revalidatePath("/dashboard");
  redirect(`/contratos/${contrato.id}`);
}

// ============================================================
// EXCLUIR (com checagem de dependências)
// ============================================================
export async function excluirAtaAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id"));
  const ata = await prisma.ata.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: { contratos: { select: { id: true } }, empenhos: { select: { id: true } } },
  });
  if (!ata) throw new Error("Ata não encontrada.");
  if (ata.contratos.length > 0 || ata.empenhos.length > 0) {
    throw new Error("Não é possível excluir: existem contratos ou empenhos vinculados a esta Ata.");
  }
  await prisma.ata.delete({ where: { id } });
  revalidatePath("/atas");
  revalidatePath("/dashboard");
  redirect("/atas");
}

export async function excluirContratoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id"));
  const contrato = await prisma.contrato.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: { empenhos: { select: { id: true } } },
  });
  if (!contrato) throw new Error("Contrato não encontrado.");
  if (contrato.empenhos.length > 0) {
    throw new Error("Não é possível excluir: existem empenhos vinculados a este Contrato.");
  }
  await prisma.contrato.delete({ where: { id } });
  revalidatePath("/contratos");
  revalidatePath("/dashboard");
  redirect("/contratos");
}

export async function excluirEmpenhoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("id"));
  const empenho = await prisma.empenho.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
  });
  if (!empenho) throw new Error("Empenho não encontrado.");
  if (empenho.status === "PAGO") {
    throw new Error("Não é possível excluir empenho já pago. Use o histórico ou notificação.");
  }
  await prisma.empenho.delete({ where: { id } });
  revalidatePath("/execucao");
  revalidatePath("/dashboard");
  redirect("/execucao");
}

// ============================================================
// EMPENHO
// ============================================================
export async function criarEmpenhoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  const dados = extrairCampos(formData);
  const parsed = novoEmpenhoSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (!campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos };
  }

  const v = parsed.data;
  await pegarEmpresaDoUsuario(v.empresaId, usuario.contaId);

  // Trava de saldo
  if (v.contratoId) {
    const saldo = await calcularSaldoContrato(v.contratoId);
    for (const item of v.itens) {
      const linha = saldo.itens.find((s) => s.descricao === item.descricao);
      if (linha && item.quantidade > linha.quantidadeDisponivel) {
        return {
          erro: `Saldo insuficiente no Contrato: "${linha.descricao}" tem ${linha.quantidadeDisponivel} ${linha.unidade} disponíveis.`,
        };
      }
    }
  } else if (v.ataId) {
    const saldo = await calcularSaldoAta(v.ataId);
    for (const item of v.itens) {
      if (!item.ataItemId) {
        return { erro: "Itens de Empenho derivado de Ata precisam selecionar o item da Ata." };
      }
      const linha = saldo.itens.find((s) => s.ataItemId === item.ataItemId);
      if (!linha) return { erro: "Item da Ata não encontrado." };
      if (item.quantidade > linha.quantidadeDisponivel) {
        return {
          erro: `Saldo insuficiente: "${linha.descricao}" tem ${linha.quantidadeDisponivel} ${linha.unidade} disponíveis.`,
        };
      }
    }
  }

  const empenho = await prisma.empenho.create({
    data: {
      empresaId: v.empresaId,
      ataId: v.ataId || null,
      contratoId: v.contratoId || null,
      tipo: v.tipo,
      numero: v.numero,
      processoAdministrativo: v.processoAdministrativo,
      procedimentoSelecao: v.procedimentoSelecao,
      numeroLicitacao: v.numeroLicitacao || null,
      orgaoNome: v.orgaoNome,
      orgaoCnpj: normalizarCnpj(v.orgaoCnpj),
      orgaoEndereco: v.orgaoEndereco,
      orgaoEmail: v.orgaoEmail || null,
      orgaoTelefone: v.orgaoTelefone || null,
      objeto: v.objeto,
      dataEmissao: v.dataEmissao,
      vigenciaInicio: v.vigenciaInicio,
      vigenciaFim: v.vigenciaFim,
      prazoEntregaDias: v.prazoEntregaDias || null,
      prazoPagamentoDias: v.prazoPagamentoDias || null,
      numeroOrdemFornecimento: v.numeroOrdemFornecimento || null,
      status: "EMPENHADO",
      itens: {
        create: v.itens.map((i) => ({
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: i.quantidade,
          marca: i.marca || null,
          valorUnitario: i.valorUnitario,
          valorTotal: i.quantidade * i.valorUnitario,
          ataItemId: i.ataItemId || null,
        })),
      },
      ...(v.enderecosEntrega && v.enderecosEntrega.length > 0 && {
        enderecosEntrega: {
          create: v.enderecosEntrega.map((e) => ({
            rotulo: e.rotulo || null,
            endereco: e.endereco,
          })),
        },
      }),
      ...(v.pontosFocais && v.pontosFocais.length > 0 && {
        pontosFocais: {
          create: v.pontosFocais.map((p) => ({
            funcao: p.funcao,
            nome: p.nome,
            email: p.email || null,
            telefone: p.telefone || null,
          })),
        },
      }),
    },
  });

  const valorTotalEmpenho = v.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
  await notificarAnalistasDaEmpresa({
    empresaId: v.empresaId,
    tipo: "NOVA_EXECUCAO",
    titulo: `Nova execução: empenho ${v.numero}`,
    descricao: `${v.orgaoNome} · ${v.objeto.slice(0, 80)} · R$ ${valorTotalEmpenho.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    link: `/painel-analista`,
    recursoTipo: "Empenho",
    recursoId: empenho.id,
  });

  revalidatePath("/execucao");
  revalidatePath("/contratos");
  revalidatePath("/atas");
  revalidatePath("/dashboard");
  revalidatePath("/painel-analista");
  redirect(`/execucao/${empenho.id}`);
}

// ============================================================
// EXECUÇÃO — registrar marco com data + arquivo (useActionState)
// ============================================================
const CAMPO_DATA: Record<string, string> = {
  PEDIDO_RECEBIDO: "dataPedidoRecebido",
  EM_TRANSITO:     "dataDespacho",
  ENTREGUE:        "dataEntrega",
  NF_EMITIDA:      "dataNfEmitida",
  NF_ENCAMINHADA:  "dataNfEncaminhada",
  PAGO:            "dataPagamento",
};
const CAMPO_ARQUIVO: Record<string, string> = {
  PEDIDO_RECEBIDO: "arquivoPedidoRecebido",
  EM_TRANSITO:     "arquivoDespacho",
  ENTREGUE:        "arquivoEntrega",
  NF_EMITIDA:      "arquivoNfEmitida",
  NF_ENCAMINHADA:  "arquivoNfEncaminhada",
  PAGO:            "arquivoPagamento",
};

export async function registrarMarcoAction(
  _p: { erro?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ erro?: string; ok?: boolean }> {
  const usuario = await exigirUsuario();
  const empenhoId = String(formData.get("empenhoId") || "");
  const marco     = String(formData.get("marco") || "");
  const dataIso   = String(formData.get("data") || "");

  if (!CAMPO_DATA[marco]) return { erro: "Marco inválido." };

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
  });
  if (!empenho) return { erro: "Empenho não encontrado." };

  const data = new Date(dataIso);
  if (isNaN(data.getTime())) return { erro: "Data inválida." };

  const update: Record<string, Date | string> = {
    [CAMPO_DATA[marco]]: data,
    status: marco,
  };

  const file = formData.get("arquivo") as File | null;
  if (file && file.size > 0) {
    const salvo = await salvarArquivo(file);
    update[CAMPO_ARQUIVO[marco]] = salvo.url;
  }

  await prisma.empenho.update({ where: { id: empenhoId }, data: update });

  if (marco === "PAGO") {
    const empenhoCompleto = await prisma.empenho.findUnique({
      where: { id: empenhoId },
      include: { itens: { select: { valorTotal: true } } },
    });
    if (empenhoCompleto) {
      const valorTotal = empenhoCompleto.itens.reduce((s, i) => s + i.valorTotal, 0);
      await notificarAnalistasDaEmpresa({
        empresaId: empenho.empresaId,
        tipo: "STATUS_PAGO",
        titulo: `Empenho ${empenho.numero} pago`,
        descricao: `${empenho.orgaoNome} · R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · sua comissão está liberada`,
        link: `/painel-analista`,
        recursoTipo: "Empenho",
        recursoId: empenhoId,
      });
    }
  }

  revalidatePath(`/execucao/${empenhoId}`);
  if (marco === "PAGO") {
    revalidatePath("/execucao");
    revalidatePath("/dashboard");
    revalidatePath("/painel-analista");
  }
  return { ok: true };
}

// ============================================================
// EXECUÇÃO — atualizar marco logístico
// ============================================================
export async function avancarStatusAction(empenhoId: string, marco: string, dataIso: string) {
  const usuario = await exigirUsuario();

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
  });
  if (!empenho) throw new Error("Empenho não encontrado.");

  const data = new Date(dataIso);
  if (isNaN(data.getTime())) throw new Error("Data inválida.");

  const update: Record<string, Date | string> = {};
  switch (marco) {
    case "PEDIDO_RECEBIDO":
      update.dataPedidoRecebido = data;
      update.status = "PEDIDO_RECEBIDO";
      break;
    case "EM_TRANSITO":
      update.dataDespacho = data;
      update.status = "EM_TRANSITO";
      break;
    case "ENTREGUE":
      update.dataEntrega = data;
      update.status = "ENTREGUE";
      break;
    case "NF_EMITIDA":
      update.dataNfEmitida = data;
      update.status = "NF_EMITIDA";
      break;
    case "NF_ENCAMINHADA":
      update.dataNfEncaminhada = data;
      update.status = "NF_ENCAMINHADA";
      break;
    case "PAGO":
      update.dataPagamento = data;
      update.status = "PAGO";
      break;
    default:
      throw new Error("Marco inválido.");
  }

  await prisma.empenho.update({ where: { id: empenhoId }, data: update });

  if (marco === "PAGO") {
    const empenhoCompleto = await prisma.empenho.findUnique({
      where: { id: empenhoId },
      include: { itens: { select: { valorTotal: true } } },
    });
    if (empenhoCompleto) {
      const valorTotal = empenhoCompleto.itens.reduce((s, i) => s + i.valorTotal, 0);
      await notificarAnalistasDaEmpresa({
        empresaId: empenho.empresaId,
        tipo: "STATUS_PAGO",
        titulo: `Empenho ${empenho.numero} pago`,
        descricao: `${empenho.orgaoNome} · R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · sua comissão está liberada`,
        link: `/painel-analista`,
        recursoTipo: "Empenho",
        recursoId: empenhoId,
      });
    }
  }

  revalidatePath(`/execucao/${empenhoId}`);
  revalidatePath("/execucao");
  revalidatePath("/dashboard");
  revalidatePath("/painel-analista");
}
