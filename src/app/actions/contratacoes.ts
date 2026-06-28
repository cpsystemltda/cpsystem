"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import {
  calcularSaldoAta,
  calcularSaldoContrato,
  normalizarDescricao,
  similaridadeDesc,
} from "@/lib/saldo";
import { notificarAnalistasDaEmpresa } from "@/lib/notificacoes";
import {
  criarComissoesParaEmpenho,
  sincronizarComissoesComEmpenhoPago,
} from "@/lib/comissaoExecucao";
import {
  novaAtaSchema,
  novoContratoSchema,
  novoEmpenhoSchema,
  normalizarCnpj,
} from "@/lib/validators";
import { salvarArquivo } from "@/lib/uploads";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  calcularDiff,
  CAMPOS_ATA,
  CAMPOS_CONTRATO,
  CAMPOS_EMPENHO,
  type Mudanca,
} from "@/lib/diff";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import { labelInstrumento } from "@/lib/instrumentoLabel";
import { sincronizarEmpenho } from "@/lib/googleCalendar";

type ActionResult = {
  erro?: string;
  campos?: Record<string, string>;
  // Valores brutos do FormData — preservados após erro pra não apagar o que
  // o usuário já tinha preenchido. Inclui itens, órgãos, endereços etc.
  valores?: Record<string, unknown>;
};

function parseItens(formData: FormData) {
  const out: {
    id?: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    marca?: string;
    valorUnitario: number;
    ataItemId?: string;
    lote?: string;
    numero?: string;
  }[] = [];

  // formato: itens[0][descricao], itens[0][unidade], etc.
  let i = 0;
  while (formData.has(`itens[${i}][descricao]`)) {
    out.push({
      id: String(formData.get(`itens[${i}][id]`) || "") || undefined,
      descricao: String(formData.get(`itens[${i}][descricao]`) || ""),
      unidade: String(formData.get(`itens[${i}][unidade]`) || ""),
      quantidade: Number(formData.get(`itens[${i}][quantidade]`) || 0),
      marca: String(formData.get(`itens[${i}][marca]`) || "") || undefined,
      valorUnitario: Number(formData.get(`itens[${i}][valorUnitario]`) || 0),
      ataItemId: String(formData.get(`itens[${i}][ataItemId]`) || "") || undefined,
      lote: String(formData.get(`itens[${i}][lote]`) || "") || undefined,
      numero: String(formData.get(`itens[${i}][numero]`) || "") || undefined,
    });
    i++;
  }
  return out;
}

/**
 * Valida que não há combinação Lote+numero duplicada nos itens da Ata.
 * Retorna ActionResult com erro descritivo se houver — caso contrário null.
 * Itens com numero vazio são ignorados (Lote pode ter itens não-numerados).
 */
function validarDuplicidadeLoteItem(
  itens: { lote?: string; numero?: string }[],
  dados: Record<string, unknown>,
): ActionResult | null {
  const seen = new Map<string, number>(); // chave normalizada → índice da primeira ocorrência
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    const numero = (it.numero ?? "").trim();
    if (!numero) continue;
    const lote = (it.lote ?? "").trim();
    const chave = `${lote.toLowerCase()}|${numero.toLowerCase()}`;
    if (seen.has(chave)) {
      const primeiro = seen.get(chave)! + 1;
      const segundo = i + 1;
      const ondeNoLote = lote ? `Lote ${lote}` : "Itens isolados";
      return {
        erro: `Itens duplicados em ${ondeNoLote}: número "${numero}" aparece nos itens #${primeiro} e #${segundo}. Cada item de um lote precisa ter número único.`,
        campos: { [`itens.${i}.numero`]: "Número duplicado no mesmo lote." },
        valores: dados,
      };
    }
    seen.set(chave, i);
  }
  return null;
}

function parseOrgaosParticipantes(formData: FormData) {
  const out: {
    id?: string;
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
        id: String(formData.get(`orgaosParticipantes[${i}][id]`) || "") || undefined,
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
  const out: { id?: string; rotulo?: string; endereco: string }[] = [];
  let i = 0;
  while (formData.has(`enderecosEntrega[${i}][endereco]`)) {
    const endereco = String(formData.get(`enderecosEntrega[${i}][endereco]`) || "").trim();
    // Endereço de entrega é OPCIONAL: a UI sempre manda pelo menos 1 linha
    // (vazia) por default; descartamos as vazias aqui. Quem realmente quer
    // cadastrar um endereço preenche; quem não sabe ainda, deixa em branco.
    if (endereco.length > 0) {
      out.push({
        id: String(formData.get(`enderecosEntrega[${i}][id]`) || "") || undefined,
        rotulo: String(formData.get(`enderecosEntrega[${i}][rotulo]`) || "") || undefined,
        endereco,
      });
    }
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
    id?: string;
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
        id: String(formData.get(`pontosFocais[${i}][id]`) || "") || undefined,
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
  const out: { id?: string; numero: number; prazoDias: number; descricao?: string; valorEstimado?: number }[] = [];
  let i = 0;
  while (formData.has(`parcelas[${i}][prazoDias]`)) {
    const valor = formData.get(`parcelas[${i}][valorEstimado]`);
    out.push({
      id: String(formData.get(`parcelas[${i}][id]`) || "") || undefined,
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
  // Caso 1: empresa é da própria conta logada (tipo EMPRESA).
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, contaId } });
  if (empresa) return empresa;

  // Caso 2: a conta logada é de um ANALISTA — empresa precisa pertencer a uma
  // conta com VinculoAnalista ATIVO em que ele é responsável.
  const analista = await prisma.analista.findUnique({
    where: { contaId },
    select: {
      vinculos: { where: { status: "ATIVO" }, select: { contaId: true } },
    },
  });
  if (analista) {
    const contaIdsVinculadas = analista.vinculos.map((v) => v.contaId);
    if (contaIdsVinculadas.length > 0) {
      const empresaViaVinculo = await prisma.empresa.findFirst({
        where: { id: empresaId, contaId: { in: contaIdsVinculadas } },
      });
      if (empresaViaVinculo) return empresaViaVinculo;
    }
  }

  throw new Error("Empresa inválida ou sem vínculo com sua conta.");
}

// ============================================================
// ATA
// ============================================================
export async function criarAtaAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const dados = extrairCampos(formData);
  const parsed = novaAtaSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (!campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores: dados };
  }

  const v = parsed.data;
  try {
    await pegarEmpresaDoUsuario(v.empresaId, usuario.contaId);
  } catch (err) {
    return {
      erro: err instanceof Error ? err.message : "Empresa inválida.",
      campos: { empresaId: "Selecione uma empresa válida." },
      valores: dados,
    };
  }

  if (v.vigenciaFim < v.vigenciaInicio) {
    return {
      erro: "A vigência final precisa ser posterior à inicial.",
      campos: { vigenciaFim: "Deve ser posterior à vigência inicial." },
      valores: dados,
    };
  }

  // Bloqueia cadastro duplicado: mesmo número + mesmo órgão, considerando
  // QUALQUER empresa da conta (Regina 28/05: precisa pegar duplicidade mesmo
  // quando o usuário tem múltiplas empresas cadastradas). Número é
  // comparado com trim pra evitar diferença por espaço acidental.
  const orgaoCnpjNormalizado = normalizarCnpj(v.orgaoCnpj);
  const numeroNormalizado = v.numero.trim();
  const ataExistente = await prisma.ata.findFirst({
    where: {
      empresa: { contaId: usuario.contaId },
      numero: numeroNormalizado,
      orgaoCnpj: orgaoCnpjNormalizado,
    },
    select: { id: true, empresa: { select: { nomeFantasia: true, razaoSocial: true } } },
  });
  if (ataExistente) {
    const nomeEmp =
      ataExistente.empresa.nomeFantasia || ataExistente.empresa.razaoSocial;
    return {
      erro: `Já existe uma Ata nº ${v.numero} cadastrada para esse órgão (na empresa "${nomeEmp}"). Edite a existente em vez de duplicar.`,
      campos: { numero: "Ata duplicada (mesmo número + órgão na sua conta)." },
      valores: dados,
    };
  }

  const erroDuplicata = validarDuplicidadeLoteItem(v.itens, dados);
  if (erroDuplicata) return erroDuplicata;

  try {
    const ata = await prisma.ata.create({
      data: {
        empresaId: v.empresaId,
        criadoPorId: usuario.id,
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
        prazoEntregaUnidade: v.prazoEntregaUnidade,
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
            numero: i.numero || null,
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

    // Cria Vigência 1 da Ata e atribui aos itens recém-criados.
    // Phase 3 — saldo por vigência. Atas novas já nascem com Vigência 1.
    try {
      const valorTotalAta = v.itens.reduce(
        (s, i) => s + i.quantidade * i.valorUnitario,
        0,
      );
      const vig1 = await prisma.vigencia.create({
        data: {
          ordem: 1,
          dataInicio: v.vigenciaInicio,
          dataFim: v.vigenciaFim,
          valorTotal: valorTotalAta,
          ataId: ata.id,
          observacao: "Vigência original",
        },
        select: { id: true },
      });
      await prisma.ataItem.updateMany({
        where: { ataId: ata.id, vigenciaId: null },
        data: { vigenciaId: vig1.id },
      });
    } catch (errVig) {
      console.warn("[criarAtaAction] falha ao criar Vigência 1:", errVig);
    }

    // PDF da IA: se o form tinha hidden inputs `arquivoPdfUrl`/`arquivoPdfNome`,
    // cria registro Anexo vinculado à Ata recém-criada.
    const arquivoPdfUrl = String(formData.get("arquivoPdfUrl") || "").trim();
    const arquivoPdfNome = String(formData.get("arquivoPdfNome") || "").trim();
    if (arquivoPdfUrl) {
      try {
        await prisma.anexo.create({
          data: {
            ataId: ata.id,
            categoria: "CONTRATUAL",
            nome: arquivoPdfNome || "ata.pdf",
            url: arquivoPdfUrl,
            mimeType: "application/pdf",
          },
        });
      } catch (errAnexo) {
        // Não bloqueia o save da Ata — usuário pode re-anexar manualmente.
        console.warn("[criarAtaAction] falha ao criar Anexo do PDF:", errAnexo);
      }
    }

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
        valores: dados,
      };
    }
    throw err;
  }
}

// ============================================================
// EDITAR ATA
// ============================================================
// Reabre o mesmo formulário usado no cadastro, com dados pré-preenchidos.
// Estratégia de sync dos blocos repetíveis:
//   - Itens: smart-sync por id. Itens removidos no form que estão usados em
//     Contrato/Empenho são bloqueados (saldo quebraria); demais são deletados.
//   - Órgãos / Endereços / Pontos focais: replace wholesale (sem FK externas).
export async function editarAtaAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const ataId = String(formData.get("ataId") || "");
  const dados = extrairCampos(formData);
  const parsed = novaAtaSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (!campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores: dados };
  }

  const v = parsed.data;

  const ataExistente = await prisma.ata.findFirst({
    where: { id: ataId, empresa: { contaId: usuario.contaId } },
    include: {
      itens: {
        include: {
          contratoItens: { select: { id: true } },
          empenhoItens: { select: { id: true } },
        },
      },
    },
  });
  if (!ataExistente) return { erro: "Ata não encontrada ou sem permissão." };

  if (!podeEditarDocumento(usuario, ataExistente)) {
    return { erro: mensagemSemPermissao(ataExistente), valores: dados };
  }

  try {
    await pegarEmpresaDoUsuario(v.empresaId, usuario.contaId);
  } catch (err) {
    return {
      erro: err instanceof Error ? err.message : "Empresa inválida.",
      campos: { empresaId: "Selecione uma empresa válida." },
      valores: dados,
    };
  }

  if (v.vigenciaFim < v.vigenciaInicio) {
    return {
      erro: "A vigência final precisa ser posterior à inicial.",
      campos: { vigenciaFim: "Deve ser posterior à vigência inicial." },
      valores: dados,
    };
  }

  const erroDuplicata = validarDuplicidadeLoteItem(v.itens, dados);
  if (erroDuplicata) return erroDuplicata;

  const idsNovos = new Set(
    v.itens.map((i) => i.id).filter((id): id is string => Boolean(id)),
  );
  const itensUsados = new Set(
    ataExistente.itens
      .filter((i) => i.contratoItens.length > 0 || i.empenhoItens.length > 0)
      .map((i) => i.id),
  );
  const itensParaRemover = ataExistente.itens.filter((i) => !idsNovos.has(i.id));
  for (const it of itensParaRemover) {
    if (itensUsados.has(it.id)) {
      return {
        erro: `O item "${it.descricao}" não pode ser removido — está vinculado a um Contrato ou Empenho. Remova-o do documento dependente antes.`,
        valores: dados,
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ata.update({
        where: { id: ataId },
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
          prazoEntregaUnidade: v.prazoEntregaUnidade,
          prazoEntregaNaoAplica: !!v.prazoEntregaNaoAplica,
          prazoPagamentoDias: v.prazoPagamentoDias || null,
          marcoOrcamentoEstimado: v.marcoOrcamentoEstimado || null,
          marcoReajusteOrigem: v.marcoReajusteOrigem || null,
          aceitaCarona: !!v.aceitaCarona,
          idAtaPncp: v.idAtaPncp || null,
        },
      });

      // Itens — smart sync
      if (itensParaRemover.length > 0) {
        await tx.ataItem.deleteMany({
          where: { id: { in: itensParaRemover.map((i) => i.id) } },
        });
      }
      for (const it of v.itens) {
        const valorTotal = it.quantidade * it.valorUnitario;
        if (it.id) {
          await tx.ataItem.update({
            where: { id: it.id },
            data: {
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca || null,
              valorUnitario: it.valorUnitario,
              valorTotal,
              lote: it.lote || null,
              numero: it.numero || null,
            },
          });
        } else {
          await tx.ataItem.create({
            data: {
              ataId,
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca || null,
              valorUnitario: it.valorUnitario,
              valorTotal,
              lote: it.lote || null,
              numero: it.numero || null,
            },
          });
        }
      }

      // Órgãos participantes — replace
      await tx.orgaoNaAta.deleteMany({ where: { ataId } });
      if (v.orgaosParticipantes && v.orgaosParticipantes.length > 0) {
        for (const o of v.orgaosParticipantes) {
          await tx.orgaoNaAta.create({
            data: {
              ataId,
              tipo: o.tipo,
              nome: o.nome,
              cnpj: normalizarCnpj(o.cnpj),
              endereco: o.endereco,
              email: o.email || null,
              telefone: o.telefone || null,
            },
          });
        }
      }

      // Endereços de entrega (apenas os do nível da Ata — não os dos órgãos)
      await tx.enderecoEntrega.deleteMany({ where: { ataId, orgaoNaAtaId: null } });
      if (v.enderecosEntrega && v.enderecosEntrega.length > 0) {
        for (const e of v.enderecosEntrega) {
          await tx.enderecoEntrega.create({
            data: { ataId, rotulo: e.rotulo || null, endereco: e.endereco },
          });
        }
      }

      // Pontos focais (apenas os do nível da Ata)
      await tx.pontoFocal.deleteMany({ where: { ataId, orgaoNaAtaId: null } });
      if (v.pontosFocais && v.pontosFocais.length > 0) {
        for (const p of v.pontosFocais) {
          await tx.pontoFocal.create({
            data: {
              ataId,
              funcao: p.funcao,
              funcaoDescricao: p.funcao === "OUTRO" ? (p.funcaoDescricao || null) : null,
              nome: p.nome,
              email: p.email || null,
              telefone: p.telefone || null,
            },
          });
        }
      }
    });

    const mudancas = calcularDiff(
      ataExistente as unknown as Record<string, unknown>,
      {
        ...v,
        orgaoCnpj: normalizarCnpj(v.orgaoCnpj),
        prazoEntregaDias: v.prazoEntregaNaoAplica ? null : (v.prazoEntregaDias ?? null),
        prazoEntregaUnidade: v.prazoEntregaUnidade,
        prazoEntregaNaoAplica: !!v.prazoEntregaNaoAplica,
        marcoReajusteOrigem: v.marcoReajusteOrigem ?? null,
        marcoOrcamentoEstimado: v.marcoOrcamentoEstimado ?? null,
        aceitaCarona: !!v.aceitaCarona,
      },
      CAMPOS_ATA,
    );
    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Ata",
      recursoId: ataId,
      titulo: `Ata ${v.numero}`,
      mudancas,
    });

    // PDF da IA (mesmo padrão do criar) — aqui é adicionado como nova versão
    // sem substituir os anexos anteriores.
    const editArquivoPdfUrl = String(formData.get("arquivoPdfUrl") || "").trim();
    const editArquivoPdfNome = String(formData.get("arquivoPdfNome") || "").trim();
    if (editArquivoPdfUrl) {
      try {
        await prisma.anexo.create({
          data: {
            ataId,
            categoria: "CONTRATUAL",
            nome: editArquivoPdfNome || "ata.pdf",
            url: editArquivoPdfUrl,
            mimeType: "application/pdf",
          },
        });
      } catch (errAnexo) {
        console.warn("[editarAtaAction] falha ao criar Anexo do PDF:", errAnexo);
      }
    }

    revalidatePath("/atas");
    revalidatePath(`/atas/${ataId}`);
    revalidatePath("/dashboard");
    redirect(`/atas/${ataId}`);
  } catch (err) {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("NEXT_REDIRECT")) throw err;
      console.error("[editarAtaAction] erro ao salvar Ata:", msg);
      return { erro: `Não foi possível salvar a Ata: ${msg.slice(0, 240)}`, valores: dados };
    }
    throw err;
  }
}

// ============================================================
// CONTRATO
// ============================================================
export async function criarContratoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
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

  // Bloqueia cadastro duplicado: mesmo número + mesmo órgão na conta
  // inteira (Regina 28/05). Trim do número evita diferença por espaço.
  const contratoExistente = await prisma.contrato.findFirst({
    where: {
      empresa: { contaId: usuario.contaId },
      numero: v.numero.trim(),
      orgaoCnpj: normalizarCnpj(v.orgaoCnpj),
    },
    select: { id: true, empresa: { select: { nomeFantasia: true, razaoSocial: true } } },
  });
  if (contratoExistente) {
    const nomeEmp =
      contratoExistente.empresa.nomeFantasia || contratoExistente.empresa.razaoSocial;
    return {
      erro: `Já existe um Contrato nº ${v.numero} cadastrado para esse órgão (na empresa "${nomeEmp}"). Edite o existente em vez de duplicar.`,
      campos: { numero: "Contrato duplicado (mesmo número + órgão na sua conta)." },
    };
  }

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

  try {
    const contrato = await prisma.contrato.create({
      data: {
        empresaId: v.empresaId,
        criadoPorId: usuario.id,
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
        prazoEntregaUnidade: v.prazoEntregaUnidade,
        prazoEntregaModo: v.prazoEntregaModo,
        dataEntregaCerta: v.dataEntregaCerta ?? null,
        prazoPagamentoDias: v.prazoPagamentoDias || null,
        marcoOrcamentoEstimado: v.marcoOrcamentoEstimado || null,
        marcoReajusteOrigem: v.marcoReajusteOrigem ?? null,
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
            lote: i.lote || null,
            numero: i.numero || null,
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
              funcaoDescricao: p.funcao === "OUTRO" ? (p.funcaoDescricao || null) : null,
              nome: p.nome,
              email: p.email || null,
              telefone: p.telefone || null,
            })),
          },
        }),
      },
    });

    // Cria Vigência 1 do Contrato e atribui aos itens recém-criados.
    // Phase 3 — saldo por vigência. Contratos novos já nascem com Vigência 1.
    try {
      const valorTotalContrato = v.itens.reduce(
        (s, i) => s + i.quantidade * i.valorUnitario,
        0,
      );
      const vig1 = await prisma.vigencia.create({
        data: {
          ordem: 1,
          dataInicio: v.vigenciaInicio,
          dataFim: v.vigenciaFim,
          valorTotal: valorTotalContrato,
          contratoId: contrato.id,
          observacao: "Vigência original",
        },
        select: { id: true },
      });
      await prisma.contratoItem.updateMany({
        where: { contratoId: contrato.id, vigenciaId: null },
        data: { vigenciaId: vig1.id },
      });
    } catch (errVig) {
      console.warn("[criarContratoAction] falha ao criar Vigência 1:", errVig);
    }

    // PDF da IA — cria registro Anexo vinculado ao Contrato (Ajuste 6)
    const arquivoPdfUrl = String(formData.get("arquivoPdfUrl") || "").trim();
    const arquivoPdfNome = String(formData.get("arquivoPdfNome") || "").trim();
    if (arquivoPdfUrl) {
      try {
        await prisma.anexo.create({
          data: {
            contratoId: contrato.id,
            categoria: "CONTRATUAL",
            nome: arquivoPdfNome || "contrato.pdf",
            url: arquivoPdfUrl,
            mimeType: "application/pdf",
          },
        });
      } catch (errAnexo) {
        console.warn("[criarContratoAction] falha ao criar Anexo do PDF:", errAnexo);
      }
    }

    revalidatePath("/contratos");
    revalidatePath("/atas");
    revalidatePath("/dashboard");
    redirect(`/contratos/${contrato.id}`);
  } catch (err) {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("NEXT_REDIRECT")) throw err;
      console.error("[criarContratoAction] erro ao salvar Contrato:", msg);
      return { erro: `Não foi possível salvar o Contrato: ${msg.slice(0, 240)}` };
    }
    throw err;
  }
}

// ============================================================
// EDITAR CONTRATO
// ============================================================
// Estratégia: igual à editarAtaAction.
//   - Atualiza campos escalares do Contrato.
//   - Itens: smart-sync por id; itens removidos que estão referenciados por
//     EmpenhoItem são bloqueados.
//   - Parcelas (modalidade PARCELADA): replace wholesale (sem FK externas).
//   - Endereços e Pontos focais do nível do contrato: replace wholesale.
export async function editarContratoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contratoId = String(formData.get("contratoId") || "");
  const dados = extrairCampos(formData);
  const parsed = novoContratoSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (!campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores: dados };
  }

  const v = parsed.data;

  const contratoExistente = await prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId: usuario.contaId } },
    include: {
      itens: { select: { id: true, descricao: true, ataItemId: true, quantidade: true } },
      empenhos: { select: { id: true } },
    },
  });
  if (!contratoExistente) return { erro: "Contrato não encontrado ou sem permissão." };

  if (!podeEditarDocumento(usuario, contratoExistente)) {
    return { erro: mensagemSemPermissao(contratoExistente), valores: dados };
  }

  try {
    await pegarEmpresaDoUsuario(v.empresaId, usuario.contaId);
  } catch (err) {
    return {
      erro: err instanceof Error ? err.message : "Empresa inválida.",
      campos: { empresaId: "Selecione uma empresa válida." },
      valores: dados,
    };
  }

  // Se for derivado de Ata, validar saldo dos itens considerando que os
  // itens DESTE contrato vão ser substituídos (Ajuste 7 — devolução
  // proporcional de saldo na edição).
  if (v.ataId) {
    const ata = await prisma.ata.findFirst({
      where: { id: v.ataId, empresa: { contaId: usuario.contaId } },
    });
    if (!ata) return { erro: "Ata vinculada inválida.", valores: dados };

    const saldo = await calcularSaldoAta(v.ataId);
    // Quantidade que ESTE contrato hoje consome por ataItemId — devolve
    // ao saldo ao validar o novo valor.
    const qtyAntigaPorAtaItem = new Map<string, number>();
    for (const item of contratoExistente.itens) {
      if (item.ataItemId) {
        qtyAntigaPorAtaItem.set(
          item.ataItemId,
          (qtyAntigaPorAtaItem.get(item.ataItemId) ?? 0) + item.quantidade,
        );
      }
    }
    for (const itemNovo of v.itens) {
      if (!itemNovo.ataItemId) continue;
      const linhaSaldo = saldo.itens.find((s) => s.ataItemId === itemNovo.ataItemId);
      if (!linhaSaldo) {
        return { erro: "Item da Ata não encontrado.", valores: dados };
      }
      const qtyAntiga = qtyAntigaPorAtaItem.get(itemNovo.ataItemId) ?? 0;
      const saldoReal = linhaSaldo.quantidadeDisponivel + qtyAntiga;
      if (itemNovo.quantidade > saldoReal) {
        return {
          erro: `Quantidade excede o saldo disponível na ARP. "${linhaSaldo.descricao}" tem ${saldoReal} ${linhaSaldo.unidade} disponíveis (incluindo a quantidade atual deste contrato). Solicitado: ${itemNovo.quantidade}.`,
          valores: dados,
        };
      }
    }
  }

  // Se há empenhos vinculados, avisar antes de remover itens — o saldo pode ficar
  // inconsistente. (ContratoItem não tem FK reversa de EmpenhoItem, mas a regra
  // de saldo casa por descrição; remover um item enquanto há Empenho ativo pode
  // gerar surpresas.)
  const idsNovos = new Set(
    v.itens.map((i) => i.id).filter((id): id is string => Boolean(id)),
  );
  const itensParaRemover = contratoExistente.itens.filter((i) => !idsNovos.has(i.id));
  if (itensParaRemover.length > 0 && contratoExistente.empenhos.length > 0) {
    return {
      erro: `Este contrato tem ${contratoExistente.empenhos.length} empenho(s) vinculados. Para remover itens, exclua os empenhos primeiro ou edite-os para não referenciarem este item.`,
      valores: dados,
    };
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contrato.update({
        where: { id: contratoId },
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
          prazoEntregaUnidade: v.prazoEntregaUnidade,
          prazoEntregaModo: v.prazoEntregaModo,
          dataEntregaCerta: v.dataEntregaCerta ?? null,
          prazoPagamentoDias: v.prazoPagamentoDias || null,
          marcoOrcamentoEstimado: v.marcoOrcamentoEstimado || null,
          marcoReajusteOrigem: v.marcoReajusteOrigem ?? null,
          modalidadeEntrega: v.modalidadeEntrega,
          marcoInicialPrazo: v.modalidadeEntrega === "SOB_DEMANDA" ? null : v.marcoInicialPrazo ?? null,
          marcoInicialDescricao:
            v.marcoInicialPrazo === "OUTRO" ? v.marcoInicialDescricao?.trim() || null : null,
        },
      });

      // Itens — smart sync
      if (itensParaRemover.length > 0) {
        await tx.contratoItem.deleteMany({
          where: { id: { in: itensParaRemover.map((i) => i.id) } },
        });
      }
      for (const it of v.itens) {
        const valorTotal = it.quantidade * it.valorUnitario;
        if (it.id) {
          await tx.contratoItem.update({
            where: { id: it.id },
            data: {
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca || null,
              valorUnitario: it.valorUnitario,
              valorTotal,
              ataItemId: it.ataItemId || null,
              lote: it.lote || null,
              numero: it.numero || null,
            },
          });
        } else {
          await tx.contratoItem.create({
            data: {
              contratoId,
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca || null,
              valorUnitario: it.valorUnitario,
              valorTotal,
              ataItemId: it.ataItemId || null,
              lote: it.lote || null,
              numero: it.numero || null,
            },
          });
        }
      }

      // Parcelas — replace
      await tx.parcelaContrato.deleteMany({ where: { contratoId } });
      if (parcelasParaCriar.length > 0) {
        await tx.parcelaContrato.createMany({
          data: parcelasParaCriar.map((p) => ({ ...p, contratoId })),
        });
      }

      // Endereços e pontos focais do nível do contrato
      await tx.enderecoEntrega.deleteMany({ where: { contratoId } });
      if (v.enderecosEntrega && v.enderecosEntrega.length > 0) {
        for (const e of v.enderecosEntrega) {
          await tx.enderecoEntrega.create({
            data: { contratoId, rotulo: e.rotulo || null, endereco: e.endereco },
          });
        }
      }

      await tx.pontoFocal.deleteMany({ where: { contratoId } });
      if (v.pontosFocais && v.pontosFocais.length > 0) {
        for (const p of v.pontosFocais) {
          await tx.pontoFocal.create({
            data: {
              contratoId,
              funcao: p.funcao,
              funcaoDescricao: p.funcao === "OUTRO" ? (p.funcaoDescricao || null) : null,
              nome: p.nome,
              email: p.email || null,
              telefone: p.telefone || null,
            },
          });
        }
      }
    });

    const mudancas = calcularDiff(
      contratoExistente as unknown as Record<string, unknown>,
      {
        ...v,
        orgaoCnpj: normalizarCnpj(v.orgaoCnpj),
        marcoOrcamentoEstimado: v.marcoOrcamentoEstimado ?? null,
        marcoInicialPrazo: v.modalidadeEntrega === "SOB_DEMANDA" ? null : (v.marcoInicialPrazo ?? null),
        marcoInicialDescricao:
          v.marcoInicialPrazo === "OUTRO" ? v.marcoInicialDescricao?.trim() || null : null,
        ataId: v.ataId || null,
      },
      CAMPOS_CONTRATO,
    );
    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Contrato",
      recursoId: contratoId,
      titulo: `Contrato ${v.numero}`,
      mudancas,
    });

    // PDF da IA — cria registro Anexo se veio do upload novo no editar
    const editArquivoPdfUrl = String(formData.get("arquivoPdfUrl") || "").trim();
    const editArquivoPdfNome = String(formData.get("arquivoPdfNome") || "").trim();
    if (editArquivoPdfUrl) {
      try {
        await prisma.anexo.create({
          data: {
            contratoId,
            categoria: "CONTRATUAL",
            nome: editArquivoPdfNome || "contrato.pdf",
            url: editArquivoPdfUrl,
            mimeType: "application/pdf",
          },
        });
      } catch (errAnexo) {
        console.warn("[editarContratoAction] falha ao criar Anexo do PDF:", errAnexo);
      }
    }

    revalidatePath("/contratos");
    revalidatePath(`/contratos/${contratoId}`);
    revalidatePath("/dashboard");
    redirect(`/contratos/${contratoId}`);
  } catch (err) {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("NEXT_REDIRECT")) throw err;
      console.error("[editarContratoAction] erro ao salvar Contrato:", msg);
      return { erro: `Não foi possível salvar o Contrato: ${msg.slice(0, 240)}`, valores: dados };
    }
    throw err;
  }
}

// ============================================================
// EXCLUIR (com checagem de dependências)
// ============================================================
export async function excluirAtaAction(formData: FormData) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
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
  await bloquearEspionagem();
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
  await bloquearEspionagem();
  const id = String(formData.get("id"));
  const empenho = await prisma.empenho.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
  });
  if (!empenho) throw new Error("Empenho não encontrado.");
  // Regina 29/05: permitir excluir mesmo se PAGO — todas as relacoes
  // (ComissaoExecucao, ReajusteRetroativo, EmpenhoItem, etc.) tem
  // onDelete: Cascade no schema, entao a remocao limpa o historico
  // financeiro junto. Confirmacao inline ja existe no botao.
  // Sync Google Calendar ANTES de deletar (precisa do googleEventId)
  await sincronizarEmpenho(id, "delete");
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
  await bloquearEspionagem();
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

  // Itens com quantidade=0 sao herdados da Ata/Contrato mas o usuario nao
  // vai executar nesta NE/OS/AC — silenciosamente removidos antes de
  // validar saldo e persistir. Evita exigir delete manual no UI (Regina
  // 29/05: "no bloco Itens o sistema entende que quantidade nao preenchida
  // é zero"). O schema ja garantiu que sobra pelo menos 1 com qty>0.
  const itensEfetivos = v.itens.filter((i) => i.quantidade > 0);

  // Bloqueia cadastro duplicado: mesmo número + mesmo órgão na conta
  // inteira (Regina 28/05). Empenho ainda admite mesmo número em
  // órgãos diferentes (cada órgão usa sua própria numeração de NE/OC/OS/AC).
  const empenhoExistente = await prisma.empenho.findFirst({
    where: {
      empresa: { contaId: usuario.contaId },
      numero: v.numero.trim(),
      orgaoCnpj: normalizarCnpj(v.orgaoCnpj),
    },
    select: { id: true, empresa: { select: { nomeFantasia: true, razaoSocial: true } } },
  });
  if (empenhoExistente) {
    const nomeEmp =
      empenhoExistente.empresa.nomeFantasia || empenhoExistente.empresa.razaoSocial;
    return {
      erro: `Já existe uma execução nº ${v.numero} cadastrada para esse órgão (na empresa "${nomeEmp}"). Edite a existente em vez de duplicar.`,
      campos: { numero: "Execução duplicada (mesmo número + órgão na sua conta)." },
    };
  }

  // Trava de saldo. Quando ha multiplos ContratoItems com mesma
  // descricao (caso 18/2025 do Igor: 2 eventos repetindo 'Espaço',
  // 'Buffet'...), soma o saldo disponivel de TODOS — antes pegava so
  // o primeiro (zerado pelo empenho anterior) e bloqueava a 2a OS.
  if (v.contratoId) {
    const saldo = await calcularSaldoContrato(v.contratoId);
    for (const item of itensEfetivos) {
      const descNorm = normalizarDescricao(item.descricao);
      const candidatos = saldo.itens.filter((s) => {
        if (normalizarDescricao(s.descricao) === descNorm) return true;
        return similaridadeDesc(s.descricao, item.descricao) >= 0.6;
      });
      const disponivelTotal = candidatos.reduce(
        (sum, s) => sum + s.quantidadeDisponivel,
        0,
      );
      if (candidatos.length > 0 && item.quantidade > disponivelTotal) {
        const exemplo = candidatos[0];
        return {
          erro: `Saldo insuficiente no Contrato: "${exemplo.descricao}" tem ${disponivelTotal} ${exemplo.unidade} disponíveis.`,
        };
      }
    }
  } else if (v.ataId) {
    const saldo = await calcularSaldoAta(v.ataId);
    for (const item of itensEfetivos) {
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

  // Calcula vigência automaticamente — empenho/NE/AE/OS não tem vigência
  // própria (decisão Igor). Herda da Ata/Contrato pai; se livre, usa
  // dataEmissao + 1 ano como sentinela.
  const ataPai = v.ataId
    ? await prisma.ata.findFirst({ where: { id: v.ataId }, select: { vigenciaInicio: true, vigenciaFim: true } })
    : null;
  const contratoPai = v.contratoId
    ? await prisma.contrato.findFirst({ where: { id: v.contratoId }, select: { vigenciaInicio: true, vigenciaFim: true } })
    : null;
  const vigenciaInicio = contratoPai?.vigenciaInicio ?? ataPai?.vigenciaInicio ?? v.dataEmissao;
  const vigenciaFim =
    contratoPai?.vigenciaFim ??
    ataPai?.vigenciaFim ??
    new Date(v.dataEmissao.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Resolve vigenciaId do empenho — aponta pra Vigência do contrato/ata
  // pai cujo intervalo de datas contém dataEmissao. Phase 3 do saldo por
  // vigência. Empenhos sem pai não recebem vigenciaId.
  const vigenciaIdResolvida = await (async () => {
    if (!v.contratoId && !v.ataId) return null;
    const vigs = await prisma.vigencia.findMany({
      where: v.contratoId ? { contratoId: v.contratoId } : { ataId: v.ataId },
      orderBy: { ordem: "asc" },
      select: { id: true, ordem: true, dataInicio: true, dataFim: true },
    });
    if (vigs.length === 0) return null;
    const dentro = vigs.find(
      (vig) => vig.dataInicio <= v.dataEmissao && vig.dataFim >= v.dataEmissao,
    );
    if (dentro) return dentro.id;
    // Sem match exato: usa a última vigência (caso comum: contrato vencido
    // recebendo empenho atrasado).
    return vigs[vigs.length - 1].id;
  })();

  try {
    const empenho = await prisma.empenho.create({
      data: {
        empresaId: v.empresaId,
        criadoPorId: usuario.id,
        ataId: v.ataId || null,
        contratoId: v.contratoId || null,
        vigenciaId: vigenciaIdResolvida,
        instrumento: v.instrumento,
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
        vigenciaInicio,
        vigenciaFim,
        prazoEntregaDias: v.prazoEntregaDias || null,
        prazoEntregaUnidade: v.prazoEntregaUnidade,
        prazoEntregaModo: v.prazoEntregaModo,
        dataEntregaCerta: v.dataEntregaCerta ?? null,
        dataEntregaInicio: v.dataEntregaInicio ?? null,
        dataEntregaFim: v.dataEntregaFim ?? null,
        horaInicio: v.horaInicio ?? null,
        horaFim: v.horaFim ?? null,
        prazoPagamentoDias: v.prazoPagamentoDias || null,
        numeroOrdemFornecimento: v.numeroOrdemFornecimento || null,
        classificacaoOrcamentaria: v.classificacaoOrcamentaria || null,
        signatario: v.signatario || null,
        dataAssinatura: v.dataAssinatura || null,
        departamentoEmissor: v.departamentoEmissor || null,
        pontoColeta: v.pontoColeta || null,
        contatoRecebedor: v.contatoRecebedor || null,
        fiscalResponsavel: v.fiscalResponsavel || null,
        status: "EMPENHADO",
        itens: {
          create: itensEfetivos.map((i) => ({
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
              funcaoDescricao: p.funcao === "OUTRO" ? (p.funcaoDescricao || null) : null,
              nome: p.nome,
              email: p.email || null,
              telefone: p.telefone || null,
            })),
          },
        }),
      },
    });

    const valorTotalEmpenho = itensEfetivos.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);

    // Cria Linha B (comissão da empresa→analista) para cada vínculo ativo.
    // Começa em AGUARDANDO_ORGAO — só libera quando empenho for pago.
    await criarComissoesParaEmpenho({
      empenhoId: empenho.id,
      empresaId: v.empresaId,
      valorTotalEmpenho,
    });

    await notificarAnalistasDaEmpresa({
      empresaId: v.empresaId,
      tipo: "NOVA_EXECUCAO",
      titulo: `Nova execução: ${labelInstrumento(v.instrumento).toLowerCase()} ${v.numero}`,
      descricao: `${v.orgaoNome} · ${v.objeto.slice(0, 80)} · R$ ${valorTotalEmpenho.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      link: `/painel-analista`,
      recursoTipo: "Empenho",
      recursoId: empenho.id,
    });

    // PDF principal da IA — vira Anexo (CONTRATUAL)
    const arquivoPdfUrl = String(formData.get("arquivoPdfUrl") || "").trim();
    const arquivoPdfNome = String(formData.get("arquivoPdfNome") || "").trim();
    if (arquivoPdfUrl) {
      try {
        await prisma.anexo.create({
          data: {
            empenhoId: empenho.id,
            categoria: "CONTRATUAL",
            nome: arquivoPdfNome || "documento.pdf",
            url: arquivoPdfUrl,
            mimeType: "application/pdf",
          },
        });
      } catch (errAnexo) {
        console.warn("[criarEmpenhoAction] falha ao criar Anexo do PDF:", errAnexo);
      }
    }

    // Anexos adicionais (Ordem de Fornecimento, aditivos, apostilamentos)
    let idx = 0;
    while (formData.has(`anexosAdicionais[${idx}][url]`)) {
      const url = String(formData.get(`anexosAdicionais[${idx}][url]`) || "").trim();
      const nome = String(formData.get(`anexosAdicionais[${idx}][nome]`) || "").trim();
      const categoria = String(
        formData.get(`anexosAdicionais[${idx}][categoria]`) || "OUTRO",
      );
      if (url) {
        try {
          await prisma.anexo.create({
            data: {
              empenhoId: empenho.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              categoria: categoria as any,
              nome: nome || `anexo-${idx + 1}.pdf`,
              url,
            },
          });
        } catch (errAnexo) {
          console.warn(`[criarEmpenhoAction] falha ao criar anexo adicional #${idx}:`, errAnexo);
        }
      }
      idx++;
    }

    // Sync best-effort com Google Calendar (Igor 26/06).
    await sincronizarEmpenho(empenho.id, "upsert");

    revalidatePath("/execucao");
    revalidatePath("/contratos");
    revalidatePath("/atas");
    revalidatePath("/dashboard");
    revalidatePath("/painel-analista");
    redirect(`/execucao/${empenho.id}`);
  } catch (err) {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("NEXT_REDIRECT")) throw err;
      console.error("[criarEmpenhoAction] erro ao salvar Empenho:", msg);
      return { erro: `Não foi possível salvar o Empenho: ${msg.slice(0, 240)}` };
    }
    throw err;
  }
}

// ============================================================
// EDITAR EMPENHO / Carta-Contrato / Autorização / OS
// ============================================================
// Mesma estratégia das outras editar*Action.
// EmpenhoItem não é referenciado por nenhum outro model, então itens podem ser
// removidos livremente (diferente de AtaItem e ContratoItem).
export async function editarEmpenhoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const empenhoId = String(formData.get("empenhoId") || "");
  const dados = extrairCampos(formData);
  const parsed = novoEmpenhoSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (!campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores: dados };
  }

  const v = parsed.data;

  const empenhoExistente = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    include: {
      itens: { select: { id: true, quantidade: true, ataItemId: true, descricao: true } },
    },
  });
  if (!empenhoExistente) return { erro: "Empenho não encontrado ou sem permissão." };

  if (!podeEditarDocumento(usuario, empenhoExistente)) {
    return { erro: mensagemSemPermissao(empenhoExistente), valores: dados };
  }

  if (empenhoExistente.status === "PAGO") {
    return {
      erro: "Empenho já pago não pode ser editado. Para correções use o histórico ou abra uma notificação.",
      valores: dados,
    };
  }

  try {
    await pegarEmpresaDoUsuario(v.empresaId, usuario.contaId);
  } catch (err) {
    return {
      erro: err instanceof Error ? err.message : "Empresa inválida.",
      campos: { empresaId: "Selecione uma empresa válida." },
      valores: dados,
    };
  }

  // Filtra itens com qty=0 — mesma regra do criarEmpenhoAction: itens
  // herdados de Ata/Contrato que nao vao ser executados nesta NE/OS/AC
  // sao silenciosamente removidos. O schema ja garantiu pelo menos 1 com qty>0.
  const itensEfetivos = v.itens.filter((i) => i.quantidade > 0);

  // Ajuste 7 — validação de saldo na edição (ARP ou Contrato pai),
  // considerando que os itens antigos deste empenho vão ser substituídos.
  // Mesma logica de soma + fuzzy match do criar (issue 02/06 do Igor).
  if (v.contratoId) {
    const saldo = await calcularSaldoContrato(v.contratoId);
    const qtyAntigaPorDescNorm = new Map<string, number>();
    for (const item of empenhoExistente.itens) {
      const k = normalizarDescricao(item.descricao);
      qtyAntigaPorDescNorm.set(k, (qtyAntigaPorDescNorm.get(k) ?? 0) + item.quantidade);
    }
    for (const itemNovo of itensEfetivos) {
      const descNorm = normalizarDescricao(itemNovo.descricao);
      const candidatos = saldo.itens.filter((s) => {
        if (normalizarDescricao(s.descricao) === descNorm) return true;
        return similaridadeDesc(s.descricao, itemNovo.descricao) >= 0.6;
      });
      if (candidatos.length === 0) continue;
      const disponivelTotal = candidatos.reduce((sum, s) => sum + s.quantidadeDisponivel, 0);
      const qtyAntiga = qtyAntigaPorDescNorm.get(descNorm) ?? 0;
      const saldoReal = disponivelTotal + qtyAntiga;
      if (itemNovo.quantidade > saldoReal) {
        const exemplo = candidatos[0];
        return {
          erro: `Quantidade excede o saldo disponível no Contrato. "${exemplo.descricao}" tem ${saldoReal} ${exemplo.unidade} disponíveis (incluindo este empenho). Solicitado: ${itemNovo.quantidade}.`,
          valores: dados,
        };
      }
    }
  } else if (v.ataId) {
    const saldo = await calcularSaldoAta(v.ataId);
    const qtyAntigaPorAtaItem = new Map<string, number>();
    for (const item of empenhoExistente.itens) {
      if (item.ataItemId) {
        qtyAntigaPorAtaItem.set(
          item.ataItemId,
          (qtyAntigaPorAtaItem.get(item.ataItemId) ?? 0) + item.quantidade,
        );
      }
    }
    for (const itemNovo of itensEfetivos) {
      if (!itemNovo.ataItemId) continue;
      const linha = saldo.itens.find((s) => s.ataItemId === itemNovo.ataItemId);
      if (!linha) {
        return { erro: "Item da Ata não encontrado.", valores: dados };
      }
      const qtyAntiga = qtyAntigaPorAtaItem.get(itemNovo.ataItemId) ?? 0;
      const saldoReal = linha.quantidadeDisponivel + qtyAntiga;
      if (itemNovo.quantidade > saldoReal) {
        return {
          erro: `Quantidade excede o saldo disponível na ARP. "${linha.descricao}" tem ${saldoReal} ${linha.unidade} disponíveis (incluindo este empenho). Solicitado: ${itemNovo.quantidade}.`,
          valores: dados,
        };
      }
    }
  }

  const idsNovos = new Set(
    itensEfetivos.map((i) => i.id).filter((id): id is string => Boolean(id)),
  );

  // Vigência: herdada da Ata/Contrato pai; livre cai em dataEmissao + 1 ano.
  // Mesma lógica do criarEmpenhoAction.
  const ataPaiEdit = v.ataId
    ? await prisma.ata.findFirst({ where: { id: v.ataId }, select: { vigenciaInicio: true, vigenciaFim: true } })
    : null;
  const contratoPaiEdit = v.contratoId
    ? await prisma.contrato.findFirst({ where: { id: v.contratoId }, select: { vigenciaInicio: true, vigenciaFim: true } })
    : null;
  const novaVigenciaInicio = contratoPaiEdit?.vigenciaInicio ?? ataPaiEdit?.vigenciaInicio ?? v.dataEmissao;
  const novaVigenciaFim =
    contratoPaiEdit?.vigenciaFim ??
    ataPaiEdit?.vigenciaFim ??
    new Date(v.dataEmissao.getTime() + 365 * 24 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.empenho.update({
        where: { id: empenhoId },
        data: {
          empresaId: v.empresaId,
          ataId: v.ataId || null,
          contratoId: v.contratoId || null,
          instrumento: v.instrumento,
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
          vigenciaInicio: novaVigenciaInicio,
          vigenciaFim: novaVigenciaFim,
          prazoEntregaDias: v.prazoEntregaDias || null,
          prazoEntregaUnidade: v.prazoEntregaUnidade,
          prazoEntregaModo: v.prazoEntregaModo,
          dataEntregaCerta: v.dataEntregaCerta ?? null,
          dataEntregaInicio: v.dataEntregaInicio ?? null,
          dataEntregaFim: v.dataEntregaFim ?? null,
          horaInicio: v.horaInicio ?? null,
          horaFim: v.horaFim ?? null,
          prazoPagamentoDias: v.prazoPagamentoDias || null,
          numeroOrdemFornecimento: v.numeroOrdemFornecimento || null,
          classificacaoOrcamentaria: v.classificacaoOrcamentaria || null,
          signatario: v.signatario || null,
          dataAssinatura: v.dataAssinatura || null,
          departamentoEmissor: v.departamentoEmissor || null,
          pontoColeta: v.pontoColeta || null,
          contatoRecebedor: v.contatoRecebedor || null,
          fiscalResponsavel: v.fiscalResponsavel || null,
        },
      });

      // Itens — smart sync (sem FK externas: livre pra remover)
      const itensAtuais = await tx.empenhoItem.findMany({
        where: { empenhoId },
        select: { id: true },
      });
      const itensParaRemover = itensAtuais.filter((i) => !idsNovos.has(i.id));
      if (itensParaRemover.length > 0) {
        await tx.empenhoItem.deleteMany({
          where: { id: { in: itensParaRemover.map((i) => i.id) } },
        });
      }
      for (const it of itensEfetivos) {
        const valorTotal = it.quantidade * it.valorUnitario;
        if (it.id) {
          await tx.empenhoItem.update({
            where: { id: it.id },
            data: {
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca || null,
              valorUnitario: it.valorUnitario,
              valorTotal,
              ataItemId: it.ataItemId || null,
            },
          });
        } else {
          await tx.empenhoItem.create({
            data: {
              empenhoId,
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca || null,
              valorUnitario: it.valorUnitario,
              valorTotal,
              ataItemId: it.ataItemId || null,
            },
          });
        }
      }

      // Endereços e pontos focais — replace
      await tx.enderecoEntrega.deleteMany({ where: { empenhoId } });
      if (v.enderecosEntrega && v.enderecosEntrega.length > 0) {
        for (const e of v.enderecosEntrega) {
          await tx.enderecoEntrega.create({
            data: { empenhoId, rotulo: e.rotulo || null, endereco: e.endereco },
          });
        }
      }
      await tx.pontoFocal.deleteMany({ where: { empenhoId } });
      if (v.pontosFocais && v.pontosFocais.length > 0) {
        for (const p of v.pontosFocais) {
          await tx.pontoFocal.create({
            data: {
              empenhoId,
              funcao: p.funcao,
              funcaoDescricao: p.funcao === "OUTRO" ? (p.funcaoDescricao || null) : null,
              nome: p.nome,
              email: p.email || null,
              telefone: p.telefone || null,
            },
          });
        }
      }
    });

    const mudancas = calcularDiff(
      empenhoExistente as unknown as Record<string, unknown>,
      {
        ...v,
        orgaoCnpj: normalizarCnpj(v.orgaoCnpj),
        ataId: v.ataId || null,
        contratoId: v.contratoId || null,
      },
      CAMPOS_EMPENHO,
    );
    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Empenho",
      recursoId: empenhoId,
      titulo: `${labelInstrumento(v.instrumento)} ${v.numero}`,
      mudancas,
    });

    // PDF da IA — cria Anexo se vier do form (substitui/anexa nova versão)
    const editArquivoPdfUrl = String(formData.get("arquivoPdfUrl") || "").trim();
    const editArquivoPdfNome = String(formData.get("arquivoPdfNome") || "").trim();
    if (editArquivoPdfUrl) {
      try {
        await prisma.anexo.create({
          data: {
            empenhoId,
            categoria: "CONTRATUAL",
            nome: editArquivoPdfNome || "documento.pdf",
            url: editArquivoPdfUrl,
            mimeType: "application/pdf",
          },
        });
      } catch (errAnexo) {
        console.warn("[editarEmpenhoAction] falha ao criar Anexo do PDF:", errAnexo);
      }
    }
    // Anexos adicionais
    let idx = 0;
    while (formData.has(`anexosAdicionais[${idx}][url]`)) {
      const url = String(formData.get(`anexosAdicionais[${idx}][url]`) || "").trim();
      const nome = String(formData.get(`anexosAdicionais[${idx}][nome]`) || "").trim();
      const categoria = String(
        formData.get(`anexosAdicionais[${idx}][categoria]`) || "OUTRO",
      );
      if (url) {
        try {
          await prisma.anexo.create({
            data: {
              empenhoId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              categoria: categoria as any,
              nome: nome || `anexo-${idx + 1}.pdf`,
              url,
            },
          });
        } catch (errAnexo) {
          console.warn(`[editarEmpenhoAction] falha ao criar anexo adicional #${idx}:`, errAnexo);
        }
      }
      idx++;
    }

    // Sync best-effort com Google Calendar (Igor 26/06).
    await sincronizarEmpenho(empenhoId, "upsert");

    revalidatePath("/execucao");
    revalidatePath(`/execucao/${empenhoId}`);
    revalidatePath("/dashboard");
    redirect(`/execucao/${empenhoId}`);
  } catch (err) {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("NEXT_REDIRECT")) throw err;
      console.error("[editarEmpenhoAction] erro ao salvar Empenho:", msg);
      return { erro: `Não foi possível salvar o Empenho: ${msg.slice(0, 240)}`, valores: dados };
    }
    throw err;
  }
}

// ============================================================
// EXECUÇÃO — registrar marco com data + arquivo (useActionState)
// ============================================================

/**
 * Bug do D-1: `new Date("2026-05-14")` parseia como UTC midnight; em fuso
 * BR (-3h) vira 2026-05-13T21:00, e toLocaleDateString("pt-BR") mostra
 * "13/05/2026". Solução: ancora ao meio-dia UTC (12h) — qualquer fuso
 * brasileiro mostra o dia certo.
 */
function parseDataInputBr(dataIso: string): Date | null {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return null;
  const d = new Date(dataIso + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

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
// Ordem dos marcos no fluxo. Usado pra não fazer downgrade do status quando
// o usuário re-registra uma etapa anterior só pra editar a data/anexo.
const ORDEM_MARCO: Record<string, number> = {
  EMPENHADO: 0,
  PEDIDO_RECEBIDO: 1,
  EM_TRANSITO: 2,
  ENTREGUE: 3,
  NF_EMITIDA: 4,
  NF_ENCAMINHADA: 5,
  PAGO: 6,
};

export async function registrarMarcoAction(
  _p: { erro?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ erro?: string; ok?: boolean }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const empenhoId = String(formData.get("empenhoId") || "");
  const marco     = String(formData.get("marco") || "");
  const dataIso   = String(formData.get("data") || "");

  if (!CAMPO_DATA[marco]) return { erro: "Marco inválido." };

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
  });
  if (!empenho) return { erro: "Empenho não encontrado." };

  const data = parseDataInputBr(dataIso);
  if (!data) return { erro: "Data inválida." };

  // Edição de etapa já concluída: se o status atual está MAIS adiantado que
  // o marco sendo registrado, mantém o status atual (não regride). Só avança
  // status quando o marco é igual ou posterior ao atual.
  const ordemAtual = ORDEM_MARCO[empenho.status] ?? -1;
  const ordemMarco = ORDEM_MARCO[marco] ?? -1;
  const update: Record<string, Date | string> = {
    [CAMPO_DATA[marco]]: data,
  };
  if (ordemMarco >= ordemAtual) {
    update.status = marco;
  }

  const file = formData.get("arquivo") as File | null;
  if (file && file.size > 0) {
    // Salva arquivo ANTES do update — se o blob storage falhar, nada
    // foi gravado no banco. Regina (03/06): upload silenciava em vez
    // de mostrar a causa real (tipo invalido, tamanho, blob auth, etc).
    try {
      const salvo = await salvarArquivo(file);
      update[CAMPO_ARQUIVO[marco]] = salvo.url;
    } catch (e) {
      return {
        erro: e instanceof Error ? e.message : "Falha ao salvar arquivo.",
      };
    }
  }

  await prisma.empenho.update({ where: { id: empenhoId }, data: update });

  // Side-effects de PAGO só rodam na transição (status anterior != PAGO).
  // Sem isso, editar a data de pagamento dispararia notificações duplicadas.
  const ehTransicaoParaPago = marco === "PAGO" && empenho.status !== "PAGO";
  if (ehTransicaoParaPago) {
    const empenhoCompleto = await prisma.empenho.findUnique({
      where: { id: empenhoId },
      include: { itens: { select: { valorTotal: true } } },
    });
    if (empenhoCompleto) {
      const valorTotal = empenhoCompleto.itens.reduce((s, i) => s + i.valorTotal, 0);
      // Linha A foi paga: libera Linha B (AGUARDANDO_ORGAO → A_RECEBER).
      // NÃO marca como PAGO — quem marca isso é o analista, manualmente,
      // quando a empresa repassar a comissão.
      await sincronizarComissoesComEmpenhoPago({
        empenhoId,
        valorBasePago: valorTotal,
      });
      await notificarAnalistasDaEmpresa({
        empresaId: empenho.empresaId,
        tipo: "STATUS_PAGO",
        titulo: `Empenho ${empenho.numero} pago pelo órgão`,
        descricao: `${empenho.orgaoNome} · R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · sua comissão está disponível para cobrança`,
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
// EXECUÇÃO — desfazer marco (marcha-ré na esteira)
// Igor 02/06: usuario marcava etapa errada (ex: PAGO quando nao foi
// pago) e nao tinha como voltar — so editar a data. Esta action zera
// data+arquivo do marco e recua o status pro marco anterior preenchido.
// PAGO desfeito tambem reverte comissoes (ComissaoExecucao volta pra
// AGUARDANDO_ORGAO).
// ============================================================
const ORDEM_INVERSA_MARCO = [
  "PAGO",
  "NF_ENCAMINHADA",
  "NF_EMITIDA",
  "ENTREGUE",
  "EM_TRANSITO",
  "PEDIDO_RECEBIDO",
];

export async function desfazerMarcoAction(
  _p: { erro?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ erro?: string; ok?: boolean }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const empenhoId = String(formData.get("empenhoId") || "");
  const marco = String(formData.get("marco") || "");
  if (!CAMPO_DATA[marco]) return { erro: "Marco inválido." };

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
  });
  if (!empenho) return { erro: "Empenho não encontrado." };

  // Zera data + arquivo do marco e recalcula o status pra o marco
  // anterior preenchido (procurando de tras pra frente na ordem inversa).
  // Se nenhum estiver preenchido, volta pra EMPENHADO.
  const dataField = CAMPO_DATA[marco];
  const arquivoField = CAMPO_ARQUIVO[marco];
  const update: Record<string, Date | string | null> = {
    [dataField]: null,
    [arquivoField]: null,
  };

  // Determina novo status: vai recuar pra primeiro marco anterior
  // (excluindo o marco sendo desfeito) cuja data esta preenchida.
  let novoStatus: string = "EMPENHADO";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = empenho as any;
  for (const m of ORDEM_INVERSA_MARCO) {
    if (m === marco) continue;
    if (e[CAMPO_DATA[m]]) {
      novoStatus = m;
      break;
    }
  }
  update.status = novoStatus;

  await prisma.empenho.update({ where: { id: empenhoId }, data: update });

  // Se estava PAGO e foi desfeito, reverte as comissoes da Linha B
  // que tinham sido liberadas (volta pra AGUARDANDO_ORGAO).
  if (marco === "PAGO" && empenho.status === "PAGO") {
    await prisma.comissaoExecucao.updateMany({
      where: { empenhoId, status: { in: ["A_RECEBER", "ATRASADO"] } },
      data: { status: "AGUARDANDO_ORGAO" },
    });
  }

  revalidatePath(`/execucao/${empenhoId}`);
  revalidatePath("/execucao");
  revalidatePath("/dashboard");
  revalidatePath("/painel-analista");
  return { ok: true };
}

// ============================================================
// EXECUÇÃO — atualizar marco logístico
// ============================================================
export async function avancarStatusAction(empenhoId: string, marco: string, dataIso: string) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
  });
  if (!empenho) throw new Error("Empenho não encontrado.");

  const data = parseDataInputBr(dataIso);
  if (!data) throw new Error("Data inválida.");

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
      await sincronizarComissoesComEmpenhoPago({
        empenhoId,
        valorBasePago: valorTotal,
      });
      await notificarAnalistasDaEmpresa({
        empresaId: empenho.empresaId,
        tipo: "STATUS_PAGO",
        titulo: `Empenho ${empenho.numero} pago pelo órgão`,
        descricao: `${empenho.orgaoNome} · R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · sua comissão está disponível para cobrança`,
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

// ============================================================
// EDIÇÃO PARCIAL — número, identificador, objeto
// ============================================================
// Pra UX de edição inline na tela de detalhe da execução. Atualiza
// somente os 3 campos básicos sem precisar abrir o form completo
// (Lei 14.133 não tem objeção a corrigir digitação). Bloqueia PAGO,
// valida tenancy/permissão, registra na auditoria.

export type AtualizarBasicoEmpenhoResult =
  | { ok: true }
  | { ok: false; erro: string };

export async function atualizarBasicoEmpenhoAction(
  empenhoId: string,
  campos: { numero?: string; identificador?: string; objeto?: string },
): Promise<AtualizarBasicoEmpenhoResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    select: {
      id: true,
      status: true,
      criadoPorId: true,
      numero: true,
      identificador: true,
      objeto: true,
    },
  });
  if (!empenho) return { ok: false, erro: "Execução não encontrada." };
  if (!podeEditarDocumento(usuario, empenho)) {
    return { ok: false, erro: mensagemSemPermissao(empenho) };
  }
  if (empenho.status === "PAGO") {
    return { ok: false, erro: "Execução já paga não pode ser editada." };
  }

  const data: { numero?: string; identificador?: string | null; objeto?: string } = {};
  const mudancas: Mudanca[] = [];

  if (campos.numero !== undefined) {
    const v = campos.numero.trim();
    if (v.length < 1) return { ok: false, erro: "Número não pode ficar em branco." };
    if (v !== empenho.numero) {
      data.numero = v;
      mudancas.push({ campo: "numero", rotulo: "Número", antes: empenho.numero, depois: v });
    }
  }
  if (campos.identificador !== undefined) {
    const v = campos.identificador.trim();
    const novo = v || null;
    if (novo !== empenho.identificador) {
      data.identificador = novo;
      mudancas.push({
        campo: "identificador",
        rotulo: "Identificador",
        antes: empenho.identificador ?? "",
        depois: novo ?? "",
      });
    }
  }
  if (campos.objeto !== undefined) {
    const v = campos.objeto.trim();
    if (v.length < 2) return { ok: false, erro: "Descrição/objeto não pode ficar em branco." };
    if (v !== empenho.objeto) {
      data.objeto = v;
      mudancas.push({ campo: "objeto", rotulo: "Descrição/objeto", antes: empenho.objeto, depois: v });
    }
  }

  if (mudancas.length === 0) return { ok: true }; // nada mudou

  await prisma.empenho.update({ where: { id: empenhoId }, data });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Empenho",
    recursoId: empenhoId,
    mudancas,
  });

  revalidatePath(`/execucao/${empenhoId}`);
  revalidatePath("/execucao");
  return { ok: true };
}
