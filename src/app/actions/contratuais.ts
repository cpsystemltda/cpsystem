"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { salvarArquivo } from "@/lib/uploads";
import { registrarAuditoria } from "@/lib/auditoria";
import { isContratoNaoContinuado, ROTULO_TIPO } from "@/lib/validators";

type Result = { erro?: string; ok?: boolean };
type Vinculo = { contratoId?: string; empenhoId?: string; ataId?: string };

type LinkValido =
  | { contratoId: string; contratoTipo: keyof typeof ROTULO_TIPO; paiPath: string; empenhoId?: undefined; ataId?: undefined }
  | { empenhoId: string; paiPath: string; contratoId?: undefined; contratoTipo?: undefined; ataId?: undefined }
  | { ataId: string; paiPath: string; contratoId?: undefined; contratoTipo?: undefined; empenhoId?: undefined };

async function validarVinculo(usuario: { contaId: string }, v: Vinculo): Promise<LinkValido> {
  if (v.contratoId) {
    const c = await prisma.contrato.findFirst({
      where: { id: v.contratoId, empresa: { contaId: usuario.contaId } },
    });
    if (!c) throw new Error("Contrato inválido.");
    return { contratoId: c.id, contratoTipo: c.tipo, paiPath: `/contratos/${c.id}` };
  }
  if (v.empenhoId) {
    const e = await prisma.empenho.findFirst({
      where: { id: v.empenhoId, empresa: { contaId: usuario.contaId } },
    });
    if (!e) throw new Error("Empenho inválido.");
    return { empenhoId: e.id, paiPath: `/execucao/${e.id}` };
  }
  if (v.ataId) {
    const a = await prisma.ata.findFirst({
      where: { id: v.ataId, empresa: { contaId: usuario.contaId } },
    });
    if (!a) throw new Error("Ata inválida.");
    return { ataId: a.id, paiPath: `/atas/${a.id}` };
  }
  throw new Error("Vínculo obrigatório.");
}

// ============================================================
// TERMO ADITIVO
// ============================================================
export async function criarTermoAditivoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const v: Vinculo = {
    contratoId: String(formData.get("contratoId") || "") || undefined,
    empenhoId: String(formData.get("empenhoId") || "") || undefined,
    ataId: String(formData.get("ataId") || "") || undefined,
  };

  try {
    const link = await validarVinculo(usuario, v);
    const alteraPrazoVigencia = formData.get("alteraPrazoVigencia") === "on";

    // Lei 14.133 — fluxograma do contrato não-continuado: prorrogação de vigência
    // não é admissível. O contrato encerra após cumprimento (entrega + pagamento).
    if (
      alteraPrazoVigencia &&
      link.contratoTipo &&
      isContratoNaoContinuado(link.contratoTipo)
    ) {
      return {
        erro: `Contratos do tipo "${ROTULO_TIPO[link.contratoTipo]}" não admitem prorrogação de vigência (Lei 14.133 — fluxograma do contrato independente). Para alterar valor, prazo de entrega ou outra natureza, mantenha "Altera prazo de vigência" desmarcado.`,
      };
    }

    const file = formData.get("arquivo") as File | null;
    let arquivoPdfUrl: string | undefined;
    if (file && file.size > 0) {
      const salvo = await salvarArquivo(file);
      arquivoPdfUrl = salvo.url;
    }

    const aditivo = await prisma.termoAditivo.create({
      data: {
        numero: String(formData.get("numero") || ""),
        objeto: String(formData.get("objeto") || ""),
        dataAssinatura: new Date(String(formData.get("dataAssinatura"))),
        natureza: String(formData.get("natureza") || ""),
        alteraValor: formData.get("alteraValor") === "on",
        novoValor: formData.get("novoValor") ? Number(formData.get("novoValor")) : null,
        alteraPrazoVigencia,
        novaVigenciaFim: formData.get("novaVigenciaFim") ? new Date(String(formData.get("novaVigenciaFim"))) : null,
        alteraPrazoEntrega: formData.get("alteraPrazoEntrega") === "on",
        novoPrazoEntregaDias: formData.get("novoPrazoEntregaDias")
          ? Number(formData.get("novoPrazoEntregaDias"))
          : null,
        observacoes: String(formData.get("observacoes") || "") || null,
        arquivoPdfUrl: arquivoPdfUrl || null,
        contratoId: link.contratoId || null,
        empenhoId: link.empenhoId || null,
        ataId: link.ataId || null,
      },
    });

    // Reflete no contrato/empenho/ata se aplicável
    if (link.contratoId) {
      const updates: Record<string, Date | number> = {};
      if (aditivo.alteraPrazoVigencia && aditivo.novaVigenciaFim) updates.vigenciaFim = aditivo.novaVigenciaFim;
      if (aditivo.alteraPrazoEntrega && aditivo.novoPrazoEntregaDias)
        updates.prazoEntregaDias = aditivo.novoPrazoEntregaDias;
      if (Object.keys(updates).length > 0) {
        await prisma.contrato.update({ where: { id: link.contratoId }, data: updates });
      }
    }
    if (link.ataId) {
      // Aditivos de Ata podem prorrogar vigência (Lei 14.133 art. 84 — ARP
      // pode ser estendida até 12 meses).
      const updates: Record<string, Date> = {};
      if (aditivo.alteraPrazoVigencia && aditivo.novaVigenciaFim) {
        updates.vigenciaFim = aditivo.novaVigenciaFim;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.ata.update({ where: { id: link.ataId }, data: updates });
      }
    }

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "TermoAditivo",
      recursoId: aditivo.id,
      resumo: `Aditivo ${aditivo.numero}`,
    });

    revalidatePath(link.paiPath);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao salvar aditivo." };
  }
}

// ============================================================
// APOSTILAMENTO
// ============================================================
export async function criarApostilamentoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const v: Vinculo = {
    contratoId: String(formData.get("contratoId") || "") || undefined,
    empenhoId: String(formData.get("empenhoId") || "") || undefined,
    ataId: String(formData.get("ataId") || "") || undefined,
  };

  try {
    const link = await validarVinculo(usuario, v);
    const file = formData.get("arquivo") as File | null;
    let arquivoPdfUrl: string | undefined;
    if (file && file.size > 0) {
      arquivoPdfUrl = (await salvarArquivo(file)).url;
    }

    const ap = await prisma.apostilamento.create({
      data: {
        numero: String(formData.get("numero") || ""),
        objeto: String(formData.get("objeto") || ""),
        dataAssinatura: new Date(String(formData.get("dataAssinatura"))),
        natureza: String(formData.get("natureza") || ""),
        alteraValor: formData.get("alteraValor") === "on",
        novoValor: formData.get("novoValor") ? Number(formData.get("novoValor")) : null,
        alteraPrazoVigencia: formData.get("alteraPrazoVigencia") === "on",
        novaVigenciaFim: formData.get("novaVigenciaFim") ? new Date(String(formData.get("novaVigenciaFim"))) : null,
        alteraPrazoEntrega: formData.get("alteraPrazoEntrega") === "on",
        novoPrazoEntregaDias: formData.get("novoPrazoEntregaDias")
          ? Number(formData.get("novoPrazoEntregaDias"))
          : null,
        observacoes: String(formData.get("observacoes") || "") || null,
        arquivoPdfUrl: arquivoPdfUrl || null,
        contratoId: link.contratoId || null,
        empenhoId: link.empenhoId || null,
        ataId: link.ataId || null,
      },
    });

    if (link.contratoId) {
      const updates: Record<string, Date | number> = {};
      if (ap.alteraPrazoVigencia && ap.novaVigenciaFim) updates.vigenciaFim = ap.novaVigenciaFim;
      if (ap.alteraPrazoEntrega && ap.novoPrazoEntregaDias) updates.prazoEntregaDias = ap.novoPrazoEntregaDias;
      if (Object.keys(updates).length > 0) {
        await prisma.contrato.update({ where: { id: link.contratoId }, data: updates });
      }
    }
    if (link.ataId) {
      // Apostilamento de reajuste percentual: atualiza valorUnitario dos itens
      // proporcionalmente. Campo `percentualReajusteItens` opcional no form.
      const pctStr = String(formData.get("percentualReajusteItens") || "").trim();
      const pct = pctStr ? Number(pctStr) : 0;
      if (pct > 0) {
        const itens = await prisma.ataItem.findMany({ where: { ataId: link.ataId } });
        for (const it of itens) {
          const novoValorUnit = it.valorUnitario * (1 + pct / 100);
          const novoValorTotal = novoValorUnit * it.quantidade;
          await prisma.ataItem.update({
            where: { id: it.id },
            data: { valorUnitario: novoValorUnit, valorTotal: novoValorTotal },
          });
        }
      }
      // Aplica também alteração de vigência se houver
      if (ap.alteraPrazoVigencia && ap.novaVigenciaFim) {
        await prisma.ata.update({
          where: { id: link.ataId },
          data: { vigenciaFim: ap.novaVigenciaFim },
        });
      }
    }

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Apostilamento",
      recursoId: ap.id,
      resumo: `Apostilamento ${ap.numero}`,
    });

    revalidatePath(link.paiPath);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}

// ============================================================
// REAJUSTE
// ============================================================
export async function criarReajusteAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const v: Vinculo = {
    contratoId: String(formData.get("contratoId") || "") || undefined,
    empenhoId: String(formData.get("empenhoId") || "") || undefined,
  };

  try {
    const link = await validarVinculo(usuario, v);

    const valorAnterior = Number(formData.get("valorAnterior") || 0);
    const percentual = Number(formData.get("percentual") || 0);
    const valorNovo = valorAnterior * (1 + percentual / 100);

    const r = await prisma.reajuste.create({
      data: {
        dataPedido: new Date(String(formData.get("dataPedido"))),
        dataAprovacao: formData.get("dataAprovacao") ? new Date(String(formData.get("dataAprovacao"))) : null,
        indice: String(formData.get("indice") || "CONTRATUAL") as "IPCA" | "IGPM" | "INCC" | "INPC" | "CONTRATUAL" | "OUTRO",
        percentual,
        valorAnterior,
        valorNovo,
        instrumento: String(formData.get("instrumento") || "APOSTILAMENTO") as "TERMO_ADITIVO" | "APOSTILAMENTO",
        instrumentoNumero: String(formData.get("instrumentoNumero") || "") || null,
        observacoes: String(formData.get("observacoes") || "") || null,
        contratoId: link.contratoId || null,
        empenhoId: link.empenhoId || null,
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Reajuste",
      recursoId: r.id,
      resumo: `Reajuste ${percentual}% (${r.indice})`,
    });

    revalidatePath(link.paiPath);
    revalidatePath("/reajustes");
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}

// ============================================================
// NOTIFICAÇÃO
// ============================================================
export async function criarNotificacaoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;

  if (!ataId && !contratoId && !empenhoId) return { erro: "Vínculo obrigatório." };

  // Validar que pertence à conta
  if (ataId && !(await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Ata inválida." };
  if (
    contratoId &&
    !(await prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: usuario.contaId } } }))
  )
    return { erro: "Contrato inválido." };
  if (
    empenhoId &&
    !(await prisma.empenho.findFirst({ where: { id: empenhoId, empresa: { contaId: usuario.contaId } } }))
  )
    return { erro: "Empenho inválido." };

  try {
    const file = formData.get("arquivo") as File | null;
    let arquivoPdfUrl: string | undefined;
    if (file && file.size > 0) arquivoPdfUrl = (await salvarArquivo(file)).url;

    const n = await prisma.notificacao.create({
      data: {
        numero: String(formData.get("numero") || "") || null,
        assunto: String(formData.get("assunto") || ""),
        descricao: String(formData.get("descricao") || ""),
        dataRecebimento: new Date(String(formData.get("dataRecebimento"))),
        prazoResposta: formData.get("prazoResposta") ? Number(formData.get("prazoResposta")) : null,
        arquivoPdfUrl: arquivoPdfUrl || null,
        ataId: ataId || null,
        contratoId: contratoId || null,
        empenhoId: empenhoId || null,
        andamentos: {
          create: {
            status: "RECEBIDA",
            descricao: "Notificação recebida.",
            dataEvento: new Date(String(formData.get("dataRecebimento"))),
          },
        },
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Notificacao",
      recursoId: n.id,
      resumo: n.assunto,
    });

    if (ataId) revalidatePath(`/atas/${ataId}`);
    if (contratoId) revalidatePath(`/contratos/${contratoId}`);
    if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}

export async function avancarNotificacaoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("notificacaoId"));
  const status = String(formData.get("status")) as "RECEBIDA" | "EM_TRATATIVA" | "RESPONDIDA" | "FINALIZADA";
  const descricao = String(formData.get("descricao") || "");
  const dataEvento = formData.get("dataEvento") ? new Date(String(formData.get("dataEvento"))) : new Date();

  const n = await prisma.notificacao.findFirst({
    where: {
      id,
      OR: [
        { ata: { empresa: { contaId: usuario.contaId } } },
        { contrato: { empresa: { contaId: usuario.contaId } } },
        { empenho: { empresa: { contaId: usuario.contaId } } },
      ],
    },
  });
  if (!n) throw new Error("Notificação não encontrada.");

  await prisma.$transaction([
    prisma.andamentoNotificacao.create({
      data: { notificacaoId: id, status, descricao, dataEvento },
    }),
    prisma.notificacao.update({ where: { id }, data: { status } }),
  ]);

  if (n.ataId) revalidatePath(`/atas/${n.ataId}`);
  if (n.contratoId) revalidatePath(`/contratos/${n.contratoId}`);
  if (n.empenhoId) revalidatePath(`/execucao/${n.empenhoId}`);
}

// ============================================================
// PROCEDIMENTO APURATÓRIO
// ============================================================
export async function criarProcedimentoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;

  if (!ataId && !contratoId && !empenhoId) return { erro: "Vínculo obrigatório." };

  try {
    const file = formData.get("arquivo") as File | null;
    let arquivoPdfUrl: string | undefined;
    if (file && file.size > 0) arquivoPdfUrl = (await salvarArquivo(file)).url;

    const dataAbertura = new Date(String(formData.get("dataAbertura")));
    const p = await prisma.procedimentoApuratorio.create({
      data: {
        numero: String(formData.get("numero") || "") || null,
        notificacaoNumero: String(formData.get("notificacaoNumero") || "") || null,
        assunto: String(formData.get("assunto") || ""),
        descricao: String(formData.get("descricao") || ""),
        comissao: String(formData.get("comissao") || "") || null,
        autoridade: String(formData.get("autoridade") || "") || null,
        dataAbertura,
        prazoDefesaDias: Number(formData.get("prazoDefesaDias") || 15),
        prazoRecursoDias: Number(formData.get("prazoRecursoDias") || 15),
        arquivoPdfUrl: arquivoPdfUrl || null,
        ataId: ataId || null,
        contratoId: contratoId || null,
        empenhoId: empenhoId || null,
        andamentos: {
          create: {
            fase: "ABERTURA",
            descricao: "Procedimento administrativo aberto.",
            dataEvento: dataAbertura,
          },
        },
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "ProcedimentoApuratorio",
      recursoId: p.id,
      resumo: p.assunto,
    });

    if (ataId) revalidatePath(`/atas/${ataId}`);
    if (contratoId) revalidatePath(`/contratos/${contratoId}`);
    if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}

export async function avancarProcedimentoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("procedimentoId"));
  const fase = String(formData.get("fase")) as
    | "ABERTURA" | "NOTIFICACAO_DEFESA" | "DEFESA_APRESENTADA" | "PEDIDO_PROVAS"
    | "DEFERIMENTO_PROVAS" | "NOTIFICACAO_ALEGACOES" | "ALEGACOES_FINAIS"
    | "DECISAO_1A_INSTANCIA" | "RECURSO" | "DECISAO_FINAL" | "ARQUIVAMENTO" | "PENALIDADE_APLICADA";
  const descricao = String(formData.get("descricao") || "");
  const dataEvento = formData.get("dataEvento") ? new Date(String(formData.get("dataEvento"))) : new Date();

  const p = await prisma.procedimentoApuratorio.findFirst({
    where: {
      id,
      OR: [
        { ata: { empresa: { contaId: usuario.contaId } } },
        { contrato: { empresa: { contaId: usuario.contaId } } },
        { empenho: { empresa: { contaId: usuario.contaId } } },
      ],
    },
  });
  if (!p) throw new Error("Procedimento não encontrado.");

  await prisma.andamentoProcedimento.create({
    data: { procedimentoId: id, fase, descricao, dataEvento },
  });

  if (fase === "ARQUIVAMENTO") {
    await prisma.procedimentoApuratorio.update({ where: { id }, data: { arquivado: true } });
  }

  if (p.ataId) revalidatePath(`/atas/${p.ataId}`);
  if (p.contratoId) revalidatePath(`/contratos/${p.contratoId}`);
  if (p.empenhoId) revalidatePath(`/execucao/${p.empenhoId}`);
}

export async function aplicarPenalidadeAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const procedimentoId = String(formData.get("procedimentoId"));

  const p = await prisma.procedimentoApuratorio.findFirst({
    where: {
      id: procedimentoId,
      OR: [
        { ata: { empresa: { contaId: usuario.contaId } } },
        { contrato: { empresa: { contaId: usuario.contaId } } },
        { empenho: { empresa: { contaId: usuario.contaId } } },
      ],
    },
  });
  if (!p) throw new Error("Procedimento não encontrado.");

  await prisma.penalidade.create({
    data: {
      procedimentoId,
      tipo: String(formData.get("tipo")) as "ADVERTENCIA" | "MULTA" | "IMPEDIMENTO_LICITAR" | "DECLARACAO_INIDONEIDADE",
      valor: formData.get("valor") ? Number(formData.get("valor")) : null,
      duracaoMeses: formData.get("duracaoMeses") ? Number(formData.get("duracaoMeses")) : null,
      fundamentacao: String(formData.get("fundamentacao") || "") || null,
      dataAplicacao: new Date(String(formData.get("dataAplicacao"))),
    },
  });

  if (p.contratoId) revalidatePath(`/contratos/${p.contratoId}`);
  if (p.empenhoId) revalidatePath(`/execucao/${p.empenhoId}`);
}

// ============================================================
// GARANTIA
// ============================================================
export async function criarGarantiaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const v: Vinculo = {
    contratoId: String(formData.get("contratoId") || "") || undefined,
    empenhoId: String(formData.get("empenhoId") || "") || undefined,
  };

  try {
    const link = await validarVinculo(usuario, v);
    const file = formData.get("arquivo") as File | null;
    let arquivoPdfUrl: string | undefined;
    let arquivoPdfNome: string | undefined;
    if (file && file.size > 0) {
      const salvo = await salvarArquivo(file);
      arquivoPdfUrl = salvo.url;
      arquivoPdfNome = salvo.nome;
    }
    // M5 — quando a IA já persistiu o PDF antes (extrairGarantiaPdfAction),
    // form envia URL/nome em hidden inputs. Usa esses se não veio file novo.
    if (!arquivoPdfUrl) {
      const url = String(formData.get("arquivoPdfUrlIa") || "").trim();
      if (url) {
        arquivoPdfUrl = url;
        arquivoPdfNome = String(formData.get("arquivoPdfNomeIa") || "").trim() || "garantia.pdf";
      }
    }

    const g = await prisma.garantia.create({
      data: {
        modalidade: String(formData.get("modalidade")) as
          | "SEGURO_GARANTIA" | "FIANCA_BANCARIA" | "CAUCAO_DINHEIRO" | "TITULOS_DIVIDA_PUBLICA",
        seguradora: String(formData.get("seguradora") || "") || null,
        banco: String(formData.get("banco") || "") || null,
        valor: Number(formData.get("valor") || 0),
        dataInicio: new Date(String(formData.get("dataInicio"))),
        dataFim: formData.get("dataFim") ? new Date(String(formData.get("dataFim"))) : null,
        descricao: String(formData.get("descricao") || "") || null,
        arquivoPdfUrl: arquivoPdfUrl || null,
        contratoId: link.contratoId || null,
        empenhoId: link.empenhoId || null,
      },
    });

    // Auto-anexo (M5): se houver PDF, registra também na aba "Anexos"
    // do contrato/empenho com categoria GARANTIA.
    if (arquivoPdfUrl) {
      try {
        await prisma.anexo.create({
          data: {
            nome: arquivoPdfNome || "garantia.pdf",
            url: arquivoPdfUrl,
            mimeType: "application/pdf",
            categoria: "GARANTIA",
            contratoId: link.contratoId || null,
            empenhoId: link.empenhoId || null,
          },
        });
      } catch (errAnexo) {
        console.warn("[criarGarantiaAction] falha ao criar Anexo:", errAnexo);
      }
    }

    // Garante que `temGarantia=true` quando o usuário cadastra garantia
    // (em registros que vieram marcados como "Sem garantia" mas o usuário
    // mudou de ideia).
    if (link.contratoId) {
      await prisma.contrato.update({
        where: { id: link.contratoId },
        data: { temGarantia: true },
      });
    }
    if (link.empenhoId) {
      await prisma.empenho.update({
        where: { id: link.empenhoId },
        data: { temGarantia: true },
      });
    }

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Garantia",
      recursoId: g.id,
      resumo: g.modalidade,
    });

    revalidatePath(link.paiPath);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}

/**
 * Marca a previsão de garantia do contrato/empenho.
 * - temGarantia=false: usuário declara explicitamente "sem garantia"
 * - temGarantia=true: volta pro fluxo de cadastro normal (limpa flag)
 * Sem isso, marcar "Não" no GarantiasTab não persistia nada e o status
 * ficava como "não declarado" pra sempre.
 */
export async function marcarSemGarantiaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;
  const valor = formData.get("valor") === "true"; // false = sem garantia

  if (!contratoId && !empenhoId) return { erro: "Vínculo obrigatório." };

  try {
    if (contratoId) {
      const c = await prisma.contrato.findFirst({
        where: { id: contratoId, empresa: { contaId: usuario.contaId } },
      });
      if (!c) return { erro: "Contrato inválido." };
      await prisma.contrato.update({
        where: { id: contratoId },
        data: { temGarantia: valor },
      });
      revalidatePath(`/contratos/${contratoId}`);
    }
    if (empenhoId) {
      const e = await prisma.empenho.findFirst({
        where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
      });
      if (!e) return { erro: "Empenho inválido." };
      await prisma.empenho.update({
        where: { id: empenhoId },
        data: { temGarantia: valor },
      });
      revalidatePath(`/execucao/${empenhoId}`);
    }
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}

export async function adicionarEndossoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const garantiaId = String(formData.get("garantiaId"));

  const g = await prisma.garantia.findFirst({
    where: {
      id: garantiaId,
      OR: [
        { contrato: { empresa: { contaId: usuario.contaId } } },
        { empenho: { empresa: { contaId: usuario.contaId } } },
      ],
    },
  });
  if (!g) return { erro: "Garantia não encontrada." };

  try {
    const file = formData.get("arquivo") as File | null;
    let arquivoPdfUrl: string | undefined;
    if (file && file.size > 0) arquivoPdfUrl = (await salvarArquivo(file)).url;

    const dataFimEndosso = formData.get("dataFim") ? new Date(String(formData.get("dataFim"))) : null;
    await prisma.endosso.create({
      data: {
        garantiaId,
        valor: Number(formData.get("valor") || 0),
        dataInicio: new Date(String(formData.get("dataInicio"))),
        dataFim: dataFimEndosso,
        observacoes: String(formData.get("observacoes") || "") || null,
        arquivoPdfUrl: arquivoPdfUrl || null,
      },
    });

    // Bug do Contrato 82/2024 UNB: o endosso prorroga a vigência da
    // garantia mas a tela continuava mostrando "expirada" porque só lia
    // garantia.dataFim. Quando o endosso estende a vigência, propagamos
    // pra garantia pai. Caso comum: endosso 30/12 sobre garantia 30/06.
    if (dataFimEndosso && (!g.dataFim || dataFimEndosso > g.dataFim)) {
      await prisma.garantia.update({
        where: { id: garantiaId },
        data: { dataFim: dataFimEndosso },
      });
    }

    if (g.contratoId) revalidatePath(`/contratos/${g.contratoId}`);
    if (g.empenhoId) revalidatePath(`/execucao/${g.empenhoId}`);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}

// ============================================================
// ANEXOS + ANOTAÇÕES
// ============================================================
export async function adicionarAnexoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;

  if (!ataId && !contratoId && !empenhoId) return { erro: "Vínculo obrigatório." };

  try {
    if (ataId && !(await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } })))
      return { erro: "Ata inválida." };
    if (contratoId && !(await prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: usuario.contaId } } })))
      return { erro: "Contrato inválido." };
    if (empenhoId && !(await prisma.empenho.findFirst({ where: { id: empenhoId, empresa: { contaId: usuario.contaId } } })))
      return { erro: "Empenho inválido." };

    const file = formData.get("arquivo") as File | null;
    if (!file || file.size === 0) return { erro: "Selecione um arquivo." };

    const salvo = await salvarArquivo(file);

    await prisma.anexo.create({
      data: {
        nome: salvo.nome,
        url: salvo.url,
        mimeType: salvo.mimeType,
        tamanhoBytes: salvo.tamanhoBytes,
        categoria: (String(formData.get("categoria")) || "OUTRO") as
          | "CONTRATUAL" | "ADITIVO" | "APOSTILAMENTO" | "GARANTIA" | "NOTIFICACAO" | "PROCEDIMENTO" | "NF" | "COMPROVANTE" | "OUTRO",
        ataId: ataId || null,
        contratoId: contratoId || null,
        empenhoId: empenhoId || null,
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "UPLOAD",
      recurso: "Anexo",
      resumo: salvo.nome,
    });

    if (ataId) revalidatePath(`/atas/${ataId}`);
    if (contratoId) revalidatePath(`/contratos/${contratoId}`);
    if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro no upload." };
  }
}

export async function adicionarAnotacaoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;
  const texto = String(formData.get("texto") || "").trim();

  if (!texto) return { erro: "Anotação vazia." };
  if (!ataId && !contratoId && !empenhoId) return { erro: "Vínculo obrigatório." };

  try {
    if (ataId && !(await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } })))
      return { erro: "Ata inválida." };
    if (contratoId && !(await prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: usuario.contaId } } })))
      return { erro: "Contrato inválido." };
    if (empenhoId && !(await prisma.empenho.findFirst({ where: { id: empenhoId, empresa: { contaId: usuario.contaId } } })))
      return { erro: "Empenho inválido." };

    await prisma.anotacao.create({
      data: {
        texto,
        autorNome: usuario.nome,
        ataId: ataId || null,
        contratoId: contratoId || null,
        empenhoId: empenhoId || null,
      },
    });

    if (ataId) revalidatePath(`/atas/${ataId}`);
    if (contratoId) revalidatePath(`/contratos/${contratoId}`);
    if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}
