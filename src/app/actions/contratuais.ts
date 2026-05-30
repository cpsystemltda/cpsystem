"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { salvarArquivo } from "@/lib/uploads";
import { registrarAuditoria } from "@/lib/auditoria";
import { isContratoNaoContinuado, ROTULO_TIPO } from "@/lib/validators";
import type {
  IndiceReajuste,
  PrazoEntregaUnidade,
  TipoAlteracaoValor,
  FinalidadeApostilamento,
} from "@/generated/prisma/client";

type Result = { erro?: string; ok?: boolean };
type Vinculo = { contratoId?: string; empenhoId?: string; ataId?: string };

type LinkValido =
  | { contratoId: string; contratoTipo: keyof typeof ROTULO_TIPO; paiPath: string; empenhoId?: undefined; ataId?: undefined }
  | { empenhoId: string; paiPath: string; contratoId?: undefined; contratoTipo?: undefined; ataId?: undefined }
  | { ataId: string; paiPath: string; contratoId?: undefined; contratoTipo?: undefined; empenhoId?: undefined };

/**
 * Cria um registro Anexo vinculado ao recurso (ata/contrato/empenho) — usado
 * pra coletar PDFs lançados em aditivos/apostilamentos/procedimentos/etc.,
 * fazendo com que apareçam centralizados na aba "Anexos" da contratação.
 *
 * Idempotente: se já existe um Anexo com mesma url no mesmo recurso, skip.
 */
async function registrarAnexo(opts: {
  arquivoPdfUrl: string | null | undefined;
  nome: string;
  categoria:
    | "CONTRATUAL" | "ADITIVO" | "APOSTILAMENTO" | "GARANTIA"
    | "NOTIFICACAO" | "PROCEDIMENTO" | "NF" | "COMPROVANTE" | "OUTRO";
  ataId?: string | null;
  contratoId?: string | null;
  empenhoId?: string | null;
}) {
  if (!opts.arquivoPdfUrl) return;
  try {
    const existente = await prisma.anexo.findFirst({
      where: {
        url: opts.arquivoPdfUrl,
        ataId: opts.ataId ?? null,
        contratoId: opts.contratoId ?? null,
        empenhoId: opts.empenhoId ?? null,
      },
    });
    if (existente) return;
    await prisma.anexo.create({
      data: {
        nome: opts.nome,
        url: opts.arquivoPdfUrl,
        mimeType: "application/pdf",
        categoria: opts.categoria,
        ataId: opts.ataId ?? null,
        contratoId: opts.contratoId ?? null,
        empenhoId: opts.empenhoId ?? null,
      },
    });
  } catch (err) {
    // Não bloqueia o save principal — Anexo é coleta secundária.
    console.warn("[registrarAnexo] falha ao registrar Anexo:", err);
  }
}

/**
 * Cria nova Vigência (ordem N+1) quando um Termo Aditivo prorroga prazo.
 * Phase 3 da refatoração de saldo por vigência.
 *
 * Política:
 *  - Aplica APENAS quando aditivo está vinculado a Contrato OU Ata (não Empenho).
 *  - Itens da nova vigência: cópia dos itens da vigência anterior. Se
 *    aditivo aplicou reajuste, valores unitários e totais são reajustados
 *    no momento da cópia (snapshot — itens da vigência anterior ficam
 *    com os valores antigos congelados).
 *  - Empenhos futuros (criados após este aditivo) caem na nova vigência
 *    automaticamente via Empenho.vigenciaId resolvido por dataEmissao —
 *    isso é responsabilidade de quem cria o empenho, não desta função.
 *  - Falha silenciosa (log warn) — não derruba o save do aditivo.
 */
type ItemNovaVigencia = {
  descricao: string;
  unidade: string;
  quantidade: number;
  marca: string | null;
  valorUnitario: number;
};

async function criarVigenciaProrrogada(opts: {
  aditivoId: string;
  contratoId?: string | null;
  ataId?: string | null;
  dataInicio: Date | null;
  dataFim: Date | null;
  aplicaReajuste: boolean;
  reajustePercentual: number | null;
  novoValorAditivo: number | null;
  tipoAlteracaoValor: TipoAlteracaoValor | null;
  // Itens explícitos da nova vigência (extraídos da IA do PDF do aditivo).
  // Quando fornecidos, substituem a cópia automática dos itens da vigência
  // anterior. Útil quando o aditivo renova SLA/escopo com tabela própria.
  itensExplicitos?: ItemNovaVigencia[] | null;
}) {
  if (!opts.contratoId && !opts.ataId) return;
  if (!opts.dataInicio || !opts.dataFim) {
    console.warn("[criarVigenciaProrrogada] aditivo sem datas de nova vigência — pulando.");
    return;
  }

  try {
    // 1) Pega a vigência atual (maior ordem) do contrato OU ata
    const vigAtual = await prisma.vigencia.findFirst({
      where: opts.contratoId
        ? { contratoId: opts.contratoId }
        : { ataId: opts.ataId! },
      orderBy: { ordem: "desc" },
      include: {
        contratoItens: true,
        ataItens: true,
      },
    });

    if (!vigAtual) {
      console.warn("[criarVigenciaProrrogada] vigência anterior não encontrada — backfill incompleto?");
      return;
    }

    // 2) Calcula valor total da nova vigência:
    //    - Se vieram itens explícitos da IA → soma deles (autoritativo)
    //    - Senão default = valor da vigência anterior, ajustado por
    //      ACRÉSCIMO/SUPRESSÃO/REEQUILIBRIO do aditivo
    //    - Reajuste só muda valor unitário no momento da cópia (caso sem
    //      itensExplicitos); valor total absorve via fatorReajuste abaixo
    const temItensExplicitos =
      (opts.itensExplicitos?.length ?? 0) > 0;
    let valorTotalNovo: number;
    if (temItensExplicitos) {
      valorTotalNovo = opts.itensExplicitos!.reduce(
        (s, it) => s + it.quantidade * it.valorUnitario,
        0,
      );
    } else {
      valorTotalNovo = vigAtual.valorTotal;
      if (opts.novoValorAditivo) {
        if (opts.tipoAlteracaoValor === "SUPRESSAO") {
          valorTotalNovo = Math.max(0, valorTotalNovo - Math.abs(opts.novoValorAditivo));
        } else {
          valorTotalNovo = valorTotalNovo + Math.abs(opts.novoValorAditivo);
        }
      }
    }

    // 3) Cria a nova Vigência
    const novaVig = await prisma.vigencia.create({
      data: {
        ordem: vigAtual.ordem + 1,
        dataInicio: opts.dataInicio,
        dataFim: opts.dataFim,
        valorTotal: valorTotalNovo,
        termoAditivoId: opts.aditivoId,
        contratoId: opts.contratoId ?? null,
        ataId: opts.ataId ?? null,
        observacao: "Prorrogação via Termo Aditivo",
      },
      select: { id: true, ordem: true },
    });

    // 4) Cria os itens da nova vigência. Duas estratégias:
    //    A) itensExplicitos (IA) — cria 1:1, sem reajuste aplicado (a IA
    //       já leu valores finais do PDF). Em contrato vinculado a ata,
    //       perde-se o vínculo ataItemId — não é catastrófico mas pode
    //       afetar match de saldo (descrição-fallback resolve).
    //    B) Cópia da vigência anterior — itens replicados com fatorReajuste
    //       aplicado quando aditivo tem aplicaReajuste=true.
    const fatorReajuste =
      opts.aplicaReajuste && opts.reajustePercentual
        ? 1 + opts.reajustePercentual / 100
        : 1;

    if (temItensExplicitos) {
      const itensIa = opts.itensExplicitos!;
      if (opts.contratoId) {
        for (const it of itensIa) {
          await prisma.contratoItem.create({
            data: {
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca,
              valorUnitario: it.valorUnitario,
              valorTotal: it.quantidade * it.valorUnitario,
              contratoId: opts.contratoId,
              vigenciaId: novaVig.id,
            },
          });
        }
      } else if (opts.ataId) {
        for (const it of itensIa) {
          await prisma.ataItem.create({
            data: {
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca,
              valorUnitario: it.valorUnitario,
              valorTotal: it.quantidade * it.valorUnitario,
              ataId: opts.ataId,
              vigenciaId: novaVig.id,
            },
          });
        }
      }
    } else if (opts.contratoId) {
      for (const it of vigAtual.contratoItens) {
        const novoValorUnit = it.valorUnitario * fatorReajuste;
        await prisma.contratoItem.create({
          data: {
            descricao: it.descricao,
            unidade: it.unidade,
            quantidade: it.quantidade,
            marca: it.marca,
            valorUnitario: novoValorUnit,
            valorTotal: novoValorUnit * it.quantidade,
            moeda: it.moeda,
            contratoId: opts.contratoId,
            ataItemId: it.ataItemId,
            vigenciaId: novaVig.id,
          },
        });
      }
    } else if (opts.ataId) {
      for (const it of vigAtual.ataItens) {
        const novoValorUnit = it.valorUnitario * fatorReajuste;
        await prisma.ataItem.create({
          data: {
            descricao: it.descricao,
            unidade: it.unidade,
            quantidade: it.quantidade,
            marca: it.marca,
            valorUnitario: novoValorUnit,
            valorTotal: novoValorUnit * it.quantidade,
            moeda: it.moeda,
            lote: it.lote,
            numero: it.numero,
            ataId: opts.ataId,
            vigenciaId: novaVig.id,
          },
        });
      }
    }

    console.log(
      `[criarVigenciaProrrogada] Vigência ${novaVig.ordem} criada (R$ ${valorTotalNovo.toFixed(2)})${temItensExplicitos ? " — itens da IA" : fatorReajuste !== 1 ? ` com reajuste ${((fatorReajuste - 1) * 100).toFixed(2)}%` : ""}`,
    );
  } catch (err) {
    console.warn("[criarVigenciaProrrogada] falhou:", err);
  }
}

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
// TERMO ADITIVO (M3 v2 — layout do print)
// ============================================================

type DadosAnterioresContrato = {
  tipo: "CONTRATO";
  vigenciaFim: string;
  prazoEntregaDias: number | null;
  prazoEntregaUnidade: string;
  dataEntregaCerta: string | null;
  marcoOrcamentoEstimado: string | null;
  itens: Array<{ id: string; valorUnitario: number; valorTotal: number }>;
};
type DadosAnterioresAta = {
  tipo: "ATA";
  vigenciaFim: string;
  itens: Array<{ id: string; valorUnitario: number; valorTotal: number }>;
};
type DadosAnterioresEmpenho = {
  tipo: "EMPENHO";
  vigenciaFim: string;
  prazoEntregaDias: number | null;
  prazoEntregaUnidade: string | null;
  dataEntregaCerta: string | null;
};
type DadosAnteriores =
  | DadosAnterioresContrato
  | DadosAnterioresAta
  | DadosAnterioresEmpenho;

type AditivoInput = {
  numero: string;
  objeto: string;
  dataAssinatura: Date;

  alteraValor: boolean;
  tipoAlteracaoValor: TipoAlteracaoValor | null;
  novoValor: number | null;

  alteraPrazoVigencia: boolean;
  novaVigenciaInicio: Date | null;
  novaVigenciaFim: Date | null;
  novaVigenciaPrazo: number | null;
  novaVigenciaUnidade: PrazoEntregaUnidade | null;

  alteraPrazoEntrega: boolean;
  novoPrazoEntregaDias: number | null;
  novoPrazoEntregaUnidade: PrazoEntregaUnidade | null;

  aplicaReajuste: boolean;
  reajusteIndice: IndiceReajuste | null;
  reajusteIndiceOutro: string | null;
  reajustePeriodoInicio: Date | null;
  reajustePeriodoFim: Date | null;
  reajustePercentual: number | null;
  // Data a partir da qual o reajuste tem efeitos financeiros — empenhos
  // emitidos antes dela ficam com valor original; a partir dela, valor reajustado.
  reajusteEfeitosFinanceiros: Date | null;

  observacoes: string | null;
  arquivoPdfUrl: string | null;
};

function parseDataInputBr(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Ancora YYYY-MM-DD ao meio-dia UTC pra evitar o bug do D-1 em fusos BR.
  return new Date(`${s}T12:00:00.000Z`);
}

function lerEnum<T extends string>(fd: FormData, key: string, valid: readonly T[]): T | null {
  const v = String(fd.get(key) || "").trim();
  return (valid as readonly string[]).includes(v) ? (v as T) : null;
}

function lerInput(fd: FormData): AditivoInput {
  return {
    numero: String(fd.get("numero") || ""),
    objeto: String(fd.get("objeto") || ""),
    dataAssinatura: parseDataInputBr(String(fd.get("dataAssinatura"))) ?? new Date(),

    alteraValor: fd.get("alteraValor") === "on",
    tipoAlteracaoValor: lerEnum<TipoAlteracaoValor>(fd, "tipoAlteracaoValor", [
      "ACRESCIMO", "SUPRESSAO", "REAJUSTE_REPACTUACAO", "REEQUILIBRIO",
    ]),
    novoValor: fd.get("novoValor") ? Number(fd.get("novoValor")) : null,

    alteraPrazoVigencia: fd.get("alteraPrazoVigencia") === "on",
    novaVigenciaInicio: parseDataInputBr(String(fd.get("novaVigenciaInicio") || "")),
    novaVigenciaFim: parseDataInputBr(String(fd.get("novaVigenciaFim") || "")),
    novaVigenciaPrazo: fd.get("novaVigenciaPrazo") ? Number(fd.get("novaVigenciaPrazo")) : null,
    novaVigenciaUnidade: lerEnum<PrazoEntregaUnidade>(fd, "novaVigenciaUnidade", ["DIAS", "MESES"]),

    alteraPrazoEntrega: fd.get("alteraPrazoEntrega") === "on",
    novoPrazoEntregaDias: fd.get("novoPrazoEntregaDias") ? Number(fd.get("novoPrazoEntregaDias")) : null,
    novoPrazoEntregaUnidade: lerEnum<PrazoEntregaUnidade>(fd, "novoPrazoEntregaUnidade", ["DIAS", "MESES"]),

    aplicaReajuste: fd.get("aplicaReajuste") === "on",
    reajusteIndice: lerEnum<IndiceReajuste>(fd, "reajusteIndice", [
      "IPCA", "IPCA_E", "IPCA_15", "IGPM", "INCC", "INPC", "IST", "CONTRATUAL", "OUTRO",
    ]),
    reajusteIndiceOutro: String(fd.get("reajusteIndiceOutro") || "") || null,
    reajustePeriodoInicio: parseDataInputBr(String(fd.get("reajustePeriodoInicio") || "")),
    reajustePeriodoFim: parseDataInputBr(String(fd.get("reajustePeriodoFim") || "")),
    reajustePercentual: fd.get("reajustePercentual") ? Number(fd.get("reajustePercentual")) : null,
    reajusteEfeitosFinanceiros: parseDataInputBr(String(fd.get("reajusteEfeitosFinanceiros") || "")),

    observacoes: String(fd.get("observacoes") || "") || null,
    arquivoPdfUrl: String(fd.get("arquivoPdfUrl") || "") || null,
  };
}

/**
 * Captura o estado corrente do pai (contrato/ata/empenho) antes de aplicar
 * o aditivo. Usado pra reverter no editar/excluir.
 */
async function capturarSnapshot(
  link: { contratoId?: string; ataId?: string; empenhoId?: string },
): Promise<DadosAnteriores> {
  if (link.contratoId) {
    const c = await prisma.contrato.findUniqueOrThrow({
      where: { id: link.contratoId },
      include: { itens: { select: { id: true, valorUnitario: true, valorTotal: true } } },
    });
    return {
      tipo: "CONTRATO",
      vigenciaFim: c.vigenciaFim.toISOString(),
      prazoEntregaDias: c.prazoEntregaDias,
      prazoEntregaUnidade: c.prazoEntregaUnidade,
      dataEntregaCerta: c.dataEntregaCerta?.toISOString() ?? null,
      marcoOrcamentoEstimado: c.marcoOrcamentoEstimado?.toISOString() ?? null,
      itens: c.itens,
    };
  }
  if (link.ataId) {
    const a = await prisma.ata.findUniqueOrThrow({
      where: { id: link.ataId },
      include: { itens: { select: { id: true, valorUnitario: true, valorTotal: true } } },
    });
    return {
      tipo: "ATA",
      vigenciaFim: a.vigenciaFim.toISOString(),
      itens: a.itens,
    };
  }
  if (link.empenhoId) {
    const e = await prisma.empenho.findUniqueOrThrow({
      where: { id: link.empenhoId },
    });
    return {
      tipo: "EMPENHO",
      vigenciaFim: e.vigenciaFim.toISOString(),
      prazoEntregaDias: e.prazoEntregaDias,
      prazoEntregaUnidade: e.prazoEntregaUnidade,
      dataEntregaCerta: e.dataEntregaCerta?.toISOString() ?? null,
    };
  }
  throw new Error("Vínculo inválido.");
}

/**
 * Calcula o fator efetivo de reajuste a partir da data de efeitos
 * financeiros. Sem data, retorna o fator integral (1+pct/100). Com data,
 * rateia o reajuste proporcionalmente aos dias restantes da vigencia:
 *
 *   fatorEfetivo = 1 + pct * (diasRestantes / diasTotaisVigencia)
 *
 * Exemplo Regina: contrato 12 meses (120k = 10k/mes), reajuste 10% com
 * efeitos no 7o mes → 6/12 * 10% = 5% efetivo → 120k * 1.05 = 126k.
 *
 * Casos limite:
 *   - efeitos antes da vigencia → reajuste integral
 *   - efeitos depois da vigencia → reajuste nao aplica (fator=1)
 */
function calcularFatorEfetivoReajuste(
  percentual: number,
  vigenciaInicio: Date,
  vigenciaFim: Date,
  efeitosFinanceiros: Date | null,
): number {
  const pct = percentual / 100;
  if (!efeitosFinanceiros) return 1 + pct;
  const efeitosMs = efeitosFinanceiros.getTime();
  if (efeitosMs <= vigenciaInicio.getTime()) return 1 + pct;
  if (efeitosMs >= vigenciaFim.getTime()) return 1;
  const totalMs = Math.max(1, vigenciaFim.getTime() - vigenciaInicio.getTime());
  const restanteMs = vigenciaFim.getTime() - efeitosMs;
  return 1 + pct * (restanteMs / totalMs);
}

/** Aplica side-effects do aditivo no pai (contrato/ata/empenho). */
async function aplicarSideEffects(
  link: { contratoId?: string; ataId?: string; empenhoId?: string },
  input: AditivoInput,
) {
  // Reajuste percentual em itens (item.valorUnitario * fator).
  // Aplica em Contrato OU Ata (Empenho não tem item próprio no escopo M3).
  // Quando o aditivo tem `reajusteEfeitosFinanceiros` definido, o reajuste
  // é rateado proporcionalmente ao tempo restante da vigencia (ver
  // calcularFatorEfetivoReajuste). Sem essa data, comportamento legado:
  // reajuste integral (1+pct) aplicado em todos os itens.
  if (input.aplicaReajuste && input.reajustePercentual && input.reajustePercentual !== 0) {
    if (link.contratoId) {
      const contrato = await prisma.contrato.findUniqueOrThrow({
        where: { id: link.contratoId },
        select: { vigenciaInicio: true, vigenciaFim: true },
      });
      const fator = calcularFatorEfetivoReajuste(
        input.reajustePercentual,
        contrato.vigenciaInicio,
        contrato.vigenciaFim,
        input.reajusteEfeitosFinanceiros,
      );
      const itens = await prisma.contratoItem.findMany({ where: { contratoId: link.contratoId } });
      for (const it of itens) {
        const novoUnit = it.valorUnitario * fator;
        const novoTotal = novoUnit * it.quantidade;
        await prisma.contratoItem.update({
          where: { id: it.id },
          data: { valorUnitario: novoUnit, valorTotal: novoTotal },
        });
      }
      // Bumpa marcoOrcamentoEstimado pra data do aditivo — assim a próxima
      // janela de reajuste (12 meses depois) é calculada a partir daqui.
      await prisma.contrato.update({
        where: { id: link.contratoId },
        data: { marcoOrcamentoEstimado: input.dataAssinatura },
      });
    }
    if (link.ataId) {
      const ata = await prisma.ata.findUniqueOrThrow({
        where: { id: link.ataId },
        select: { vigenciaInicio: true, vigenciaFim: true },
      });
      const fator = calcularFatorEfetivoReajuste(
        input.reajustePercentual,
        ata.vigenciaInicio,
        ata.vigenciaFim,
        input.reajusteEfeitosFinanceiros,
      );
      const itens = await prisma.ataItem.findMany({ where: { ataId: link.ataId } });
      for (const it of itens) {
        const novoUnit = it.valorUnitario * fator;
        const novoTotal = novoUnit * it.quantidade;
        await prisma.ataItem.update({
          where: { id: it.id },
          data: { valorUnitario: novoUnit, valorTotal: novoTotal },
        });
      }
    }
  }

  // Vigência
  if (input.alteraPrazoVigencia && input.novaVigenciaFim) {
    if (link.contratoId)
      await prisma.contrato.update({ where: { id: link.contratoId }, data: { vigenciaFim: input.novaVigenciaFim } });
    if (link.ataId)
      await prisma.ata.update({ where: { id: link.ataId }, data: { vigenciaFim: input.novaVigenciaFim } });
    if (link.empenhoId)
      await prisma.empenho.update({ where: { id: link.empenhoId }, data: { vigenciaFim: input.novaVigenciaFim } });
  }

  // Prazo de entrega
  if (input.alteraPrazoEntrega && input.novoPrazoEntregaDias) {
    if (link.contratoId)
      await prisma.contrato.update({
        where: { id: link.contratoId },
        data: {
          prazoEntregaDias: input.novoPrazoEntregaDias,
          ...(input.novoPrazoEntregaUnidade ? { prazoEntregaUnidade: input.novoPrazoEntregaUnidade } : {}),
        },
      });
    if (link.empenhoId)
      await prisma.empenho.update({
        where: { id: link.empenhoId },
        data: {
          prazoEntregaDias: input.novoPrazoEntregaDias,
          ...(input.novoPrazoEntregaUnidade ? { prazoEntregaUnidade: input.novoPrazoEntregaUnidade } : {}),
        },
      });
  }
}

/** Reverte side-effects usando o snapshot salvo no aditivo. */
async function reverterSideEffects(snapshot: DadosAnteriores, link: { contratoId?: string; ataId?: string; empenhoId?: string }) {
  if (snapshot.tipo === "CONTRATO" && link.contratoId) {
    await prisma.contrato.update({
      where: { id: link.contratoId },
      data: {
        vigenciaFim: new Date(snapshot.vigenciaFim),
        prazoEntregaDias: snapshot.prazoEntregaDias,
        prazoEntregaUnidade: snapshot.prazoEntregaUnidade as PrazoEntregaUnidade,
        dataEntregaCerta: snapshot.dataEntregaCerta ? new Date(snapshot.dataEntregaCerta) : null,
        marcoOrcamentoEstimado: snapshot.marcoOrcamentoEstimado ? new Date(snapshot.marcoOrcamentoEstimado) : null,
      },
    });
    for (const it of snapshot.itens) {
      await prisma.contratoItem.update({
        where: { id: it.id },
        data: { valorUnitario: it.valorUnitario, valorTotal: it.valorTotal },
      });
    }
  }
  if (snapshot.tipo === "ATA" && link.ataId) {
    await prisma.ata.update({
      where: { id: link.ataId },
      data: { vigenciaFim: new Date(snapshot.vigenciaFim) },
    });
    for (const it of snapshot.itens) {
      await prisma.ataItem.update({
        where: { id: it.id },
        data: { valorUnitario: it.valorUnitario, valorTotal: it.valorTotal },
      });
    }
  }
  if (snapshot.tipo === "EMPENHO" && link.empenhoId) {
    await prisma.empenho.update({
      where: { id: link.empenhoId },
      data: {
        vigenciaFim: new Date(snapshot.vigenciaFim),
        prazoEntregaDias: snapshot.prazoEntregaDias,
        prazoEntregaUnidade: (snapshot.prazoEntregaUnidade as PrazoEntregaUnidade) ?? "DIAS",
        dataEntregaCerta: snapshot.dataEntregaCerta ? new Date(snapshot.dataEntregaCerta) : null,
      },
    });
  }
}

/** Monta o CSV legado de `natureza` a partir das flags marcadas. */
function montarNaturezaCsv(input: AditivoInput): string {
  const partes: string[] = [];
  if (input.alteraValor) partes.push("VALOR");
  if (input.alteraPrazoVigencia) partes.push("PRAZO_VIGENCIA");
  if (input.alteraPrazoEntrega) partes.push("PRAZO_ENTREGA");
  if (input.aplicaReajuste) partes.push("REAJUSTE");
  return partes.join(",");
}

export async function criarTermoAditivoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const v: Vinculo = {
    contratoId: String(formData.get("contratoId") || "") || undefined,
    empenhoId: String(formData.get("empenhoId") || "") || undefined,
    ataId: String(formData.get("ataId") || "") || undefined,
  };

  try {
    const link = await validarVinculo(usuario, v);
    const input = lerInput(formData);

    // Lei 14.133 — contrato não-continuado não admite prorrogação de vigência.
    if (
      input.alteraPrazoVigencia &&
      link.contratoTipo &&
      isContratoNaoContinuado(link.contratoTipo)
    ) {
      return {
        erro: `Contratos do tipo "${ROTULO_TIPO[link.contratoTipo]}" não admitem prorrogação de vigência (Lei 14.133 — fluxograma do contrato independente).`,
      };
    }

    // PDF: se veio file novo, salva. Senão, usa hidden input da IA.
    let arquivoPdfUrl = input.arquivoPdfUrl;
    const file = formData.get("arquivo") as File | null;
    if (file && file.size > 0) {
      const salvo = await salvarArquivo(file);
      arquivoPdfUrl = salvo.url;
    }

    // Snapshot ANTES dos side-effects
    const snapshot = await capturarSnapshot(link);

    const aditivo = await prisma.termoAditivo.create({
      data: {
        numero: input.numero,
        objeto: input.objeto,
        dataAssinatura: input.dataAssinatura,
        natureza: montarNaturezaCsv(input),

        alteraValor: input.alteraValor,
        tipoAlteracaoValor: input.tipoAlteracaoValor,
        novoValor: input.novoValor,

        alteraPrazoVigencia: input.alteraPrazoVigencia,
        novaVigenciaInicio: input.novaVigenciaInicio,
        novaVigenciaFim: input.novaVigenciaFim,
        novaVigenciaPrazo: input.novaVigenciaPrazo,
        novaVigenciaUnidade: input.novaVigenciaUnidade,

        alteraPrazoEntrega: input.alteraPrazoEntrega,
        novoPrazoEntregaDias: input.novoPrazoEntregaDias,
        novoPrazoEntregaUnidade: input.novoPrazoEntregaUnidade,

        aplicaReajuste: input.aplicaReajuste,
        reajusteIndice: input.reajusteIndice,
        reajusteIndiceOutro: input.reajusteIndiceOutro,
        reajustePeriodoInicio: input.reajustePeriodoInicio,
        reajustePeriodoFim: input.reajustePeriodoFim,
        reajustePercentual: input.reajustePercentual,
        reajusteEfeitosFinanceiros: input.reajusteEfeitosFinanceiros,

        observacoes: input.observacoes,
        arquivoPdfUrl: arquivoPdfUrl,
        dadosAnteriores: snapshot,

        contratoId: link.contratoId || null,
        empenhoId: link.empenhoId || null,
        ataId: link.ataId || null,
      },
    });

    await aplicarSideEffects(link, input);

    // Phase 3 — aditivo prorrogando vigência cria nova Vigência (ordem N+1)
    // automaticamente. Itens são copiados da vigência anterior (com reajuste
    // aplicado quando houver). Empenhos antigos ficam atrelados à vigência
    // anterior; novos empenhos caem na nova vigência via dataEmissao.
    if (input.alteraPrazoVigencia && (link.contratoId || link.ataId)) {
      // Itens da IA: PainelIaAditivo grava itensNovaVigencia em hidden
      // input após extração. Parse defensivo — JSON inválido vira null
      // (cai no fallback de copiar itens da vigência anterior).
      const itensJsonRaw = String(formData.get("itensNovaVigenciaJson") || "").trim();
      let itensExplicitos: ItemNovaVigencia[] | null = null;
      if (itensJsonRaw) {
        try {
          const parsed = JSON.parse(itensJsonRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            itensExplicitos = parsed
              .filter(
                (it) =>
                  it &&
                  typeof it.descricao === "string" &&
                  typeof it.unidade === "string" &&
                  typeof it.quantidade === "number" &&
                  typeof it.valorUnitario === "number",
              )
              .map((it) => ({
                descricao: String(it.descricao),
                unidade: String(it.unidade),
                quantidade: Number(it.quantidade),
                marca: it.marca ? String(it.marca) : null,
                valorUnitario: Number(it.valorUnitario),
              }));
            if (itensExplicitos.length === 0) itensExplicitos = null;
          }
        } catch {
          itensExplicitos = null;
        }
      }

      await criarVigenciaProrrogada({
        aditivoId: aditivo.id,
        contratoId: link.contratoId ?? null,
        ataId: link.ataId ?? null,
        dataInicio: input.novaVigenciaInicio,
        dataFim: input.novaVigenciaFim,
        aplicaReajuste: input.aplicaReajuste,
        reajustePercentual: input.reajustePercentual,
        novoValorAditivo: input.alteraValor ? input.novoValor : null,
        tipoAlteracaoValor: input.tipoAlteracaoValor,
        itensExplicitos,
      });
    }

    // Coleta o PDF na aba Anexos (se houver)
    await registrarAnexo({
      arquivoPdfUrl,
      nome: `aditivo-${aditivo.numero}.pdf`,
      categoria: "ADITIVO",
      contratoId: link.contratoId,
      ataId: link.ataId,
      empenhoId: link.empenhoId,
    });

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

export async function editarTermoAditivoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const aditivoId = String(formData.get("aditivoId") || "");
  if (!aditivoId) return { erro: "Aditivo inválido." };

  try {
    const atual = await prisma.termoAditivo.findFirst({
      where: {
        id: aditivoId,
        OR: [
          { contrato: { empresa: { contaId: usuario.contaId } } },
          { ata: { empresa: { contaId: usuario.contaId } } },
          { empenho: { empresa: { contaId: usuario.contaId } } },
        ],
      },
    });
    if (!atual) return { erro: "Aditivo não encontrado." };

    const link = {
      contratoId: atual.contratoId ?? undefined,
      ataId: atual.ataId ?? undefined,
      empenhoId: atual.empenhoId ?? undefined,
    };
    const linkPath = atual.contratoId
      ? `/contratos/${atual.contratoId}`
      : atual.ataId
        ? `/atas/${atual.ataId}`
        : `/execucao/${atual.empenhoId}`;

    const input = lerInput(formData);

    // 1) Reverter side-effects antigos pelo snapshot
    if (atual.dadosAnteriores) {
      await reverterSideEffects(atual.dadosAnteriores as unknown as DadosAnteriores, link);
    }

    // 2) PDF
    let arquivoPdfUrl = input.arquivoPdfUrl || atual.arquivoPdfUrl;
    const file = formData.get("arquivo") as File | null;
    if (file && file.size > 0) {
      arquivoPdfUrl = (await salvarArquivo(file)).url;
    }

    // 3) Snapshot novo (estado já revertido)
    const novoSnapshot = await capturarSnapshot(link);

    // 4) Atualizar aditivo
    await prisma.termoAditivo.update({
      where: { id: aditivoId },
      data: {
        numero: input.numero,
        objeto: input.objeto,
        dataAssinatura: input.dataAssinatura,
        natureza: montarNaturezaCsv(input),

        alteraValor: input.alteraValor,
        tipoAlteracaoValor: input.tipoAlteracaoValor,
        novoValor: input.novoValor,

        alteraPrazoVigencia: input.alteraPrazoVigencia,
        novaVigenciaInicio: input.novaVigenciaInicio,
        novaVigenciaFim: input.novaVigenciaFim,
        novaVigenciaPrazo: input.novaVigenciaPrazo,
        novaVigenciaUnidade: input.novaVigenciaUnidade,

        alteraPrazoEntrega: input.alteraPrazoEntrega,
        novoPrazoEntregaDias: input.novoPrazoEntregaDias,
        novoPrazoEntregaUnidade: input.novoPrazoEntregaUnidade,

        aplicaReajuste: input.aplicaReajuste,
        reajusteIndice: input.reajusteIndice,
        reajusteIndiceOutro: input.reajusteIndiceOutro,
        reajustePeriodoInicio: input.reajustePeriodoInicio,
        reajustePeriodoFim: input.reajustePeriodoFim,
        reajustePercentual: input.reajustePercentual,
        reajusteEfeitosFinanceiros: input.reajusteEfeitosFinanceiros,

        observacoes: input.observacoes,
        arquivoPdfUrl,
        dadosAnteriores: novoSnapshot,
      },
    });

    // 5) Aplicar side-effects novos
    await aplicarSideEffects(link, input);

    await registrarAnexo({
      arquivoPdfUrl,
      nome: `aditivo-${input.numero}.pdf`,
      categoria: "ADITIVO",
      contratoId: link.contratoId,
      ataId: link.ataId,
      empenhoId: link.empenhoId,
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "TermoAditivo",
      recursoId: aditivoId,
      resumo: `Aditivo ${input.numero} (editado)`,
    });

    revalidatePath(linkPath);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao editar aditivo." };
  }
}

export async function excluirTermoAditivoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const aditivoId = String(formData.get("aditivoId") || "");
  if (!aditivoId) return { erro: "Aditivo inválido." };

  try {
    const atual = await prisma.termoAditivo.findFirst({
      where: {
        id: aditivoId,
        OR: [
          { contrato: { empresa: { contaId: usuario.contaId } } },
          { ata: { empresa: { contaId: usuario.contaId } } },
          { empenho: { empresa: { contaId: usuario.contaId } } },
        ],
      },
    });
    if (!atual) return { erro: "Aditivo não encontrado." };

    const link = {
      contratoId: atual.contratoId ?? undefined,
      ataId: atual.ataId ?? undefined,
      empenhoId: atual.empenhoId ?? undefined,
    };
    const linkPath = atual.contratoId
      ? `/contratos/${atual.contratoId}`
      : atual.ataId
        ? `/atas/${atual.ataId}`
        : `/execucao/${atual.empenhoId}`;

    // Reverte alterações pelo snapshot
    if (atual.dadosAnteriores) {
      await reverterSideEffects(atual.dadosAnteriores as unknown as DadosAnteriores, link);
    }

    await prisma.termoAditivo.delete({ where: { id: aditivoId } });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "EXCLUIR",
      recurso: "TermoAditivo",
      recursoId: aditivoId,
      resumo: `Aditivo ${atual.numero} (excluído)`,
    });

    revalidatePath(linkPath);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao excluir aditivo." };
  }
}

// ============================================================
// APOSTILAMENTO (M3 v2 — layout do print Comprasnet)
// ============================================================
type ApostilamentoInput = AditivoInput & {
  finalidade: FinalidadeApostilamento | null;
  motivo: string | null;
};

function lerInputApostilamento(fd: FormData): ApostilamentoInput {
  return {
    ...lerInput(fd),
    finalidade: lerEnum<FinalidadeApostilamento>(fd, "finalidade", [
      "REAJUSTE", "APLICACAO_PENALIDADE", "EMPENHO_CREDITO_SUPLEMENTAR", "OUTROS",
    ]),
    motivo: String(fd.get("motivo") || "") || null,
  };
}

export async function criarApostilamentoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const v: Vinculo = {
    contratoId: String(formData.get("contratoId") || "") || undefined,
    empenhoId: String(formData.get("empenhoId") || "") || undefined,
    ataId: String(formData.get("ataId") || "") || undefined,
  };

  try {
    const link = await validarVinculo(usuario, v);
    const input = lerInputApostilamento(formData);

    // PDF: file novo ou hidden URL da IA
    let arquivoPdfUrl = input.arquivoPdfUrl;
    const file = formData.get("arquivo") as File | null;
    if (file && file.size > 0) {
      arquivoPdfUrl = (await salvarArquivo(file)).url;
    }

    // Snapshot ANTES dos side-effects
    const snapshot = await capturarSnapshot(link);

    const ap = await prisma.apostilamento.create({
      data: {
        numero: input.numero,
        objeto: input.objeto,
        dataAssinatura: input.dataAssinatura,
        natureza: montarNaturezaCsv(input),

        finalidade: input.finalidade,
        motivo: input.motivo,

        alteraValor: input.alteraValor,
        tipoAlteracaoValor: input.tipoAlteracaoValor,
        novoValor: input.novoValor,

        alteraPrazoVigencia: input.alteraPrazoVigencia,
        novaVigenciaInicio: input.novaVigenciaInicio,
        novaVigenciaFim: input.novaVigenciaFim,
        novaVigenciaPrazo: input.novaVigenciaPrazo,
        novaVigenciaUnidade: input.novaVigenciaUnidade,

        alteraPrazoEntrega: input.alteraPrazoEntrega,
        novoPrazoEntregaDias: input.novoPrazoEntregaDias,
        novoPrazoEntregaUnidade: input.novoPrazoEntregaUnidade,

        aplicaReajuste: input.aplicaReajuste,
        reajusteIndice: input.reajusteIndice,
        reajusteIndiceOutro: input.reajusteIndiceOutro,
        reajustePeriodoInicio: input.reajustePeriodoInicio,
        reajustePeriodoFim: input.reajustePeriodoFim,
        reajustePercentual: input.reajustePercentual,
        reajusteEfeitosFinanceiros: input.reajusteEfeitosFinanceiros,

        observacoes: input.observacoes,
        arquivoPdfUrl,
        dadosAnteriores: snapshot,

        contratoId: link.contratoId || null,
        empenhoId: link.empenhoId || null,
        ataId: link.ataId || null,
      },
    });

    await aplicarSideEffects(link, input);

    await registrarAnexo({
      arquivoPdfUrl,
      nome: `apostilamento-${ap.numero}.pdf`,
      categoria: "APOSTILAMENTO",
      contratoId: link.contratoId,
      ataId: link.ataId,
      empenhoId: link.empenhoId,
    });

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
    return { erro: err instanceof Error ? err.message : "Erro ao salvar apostilamento." };
  }
}

export async function editarApostilamentoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("apostilamentoId") || "");
  if (!id) return { erro: "Apostilamento inválido." };

  try {
    const atual = await prisma.apostilamento.findFirst({
      where: {
        id,
        OR: [
          { contrato: { empresa: { contaId: usuario.contaId } } },
          { ata: { empresa: { contaId: usuario.contaId } } },
          { empenho: { empresa: { contaId: usuario.contaId } } },
        ],
      },
    });
    if (!atual) return { erro: "Apostilamento não encontrado." };

    const link = {
      contratoId: atual.contratoId ?? undefined,
      ataId: atual.ataId ?? undefined,
      empenhoId: atual.empenhoId ?? undefined,
    };
    const linkPath = atual.contratoId
      ? `/contratos/${atual.contratoId}`
      : atual.ataId
        ? `/atas/${atual.ataId}`
        : `/execucao/${atual.empenhoId}`;

    const input = lerInputApostilamento(formData);

    if (atual.dadosAnteriores) {
      await reverterSideEffects(atual.dadosAnteriores as unknown as DadosAnteriores, link);
    }

    let arquivoPdfUrl = input.arquivoPdfUrl || atual.arquivoPdfUrl;
    const file = formData.get("arquivo") as File | null;
    if (file && file.size > 0) {
      arquivoPdfUrl = (await salvarArquivo(file)).url;
    }

    const novoSnapshot = await capturarSnapshot(link);

    await prisma.apostilamento.update({
      where: { id },
      data: {
        numero: input.numero,
        objeto: input.objeto,
        dataAssinatura: input.dataAssinatura,
        natureza: montarNaturezaCsv(input),

        finalidade: input.finalidade,
        motivo: input.motivo,

        alteraValor: input.alteraValor,
        tipoAlteracaoValor: input.tipoAlteracaoValor,
        novoValor: input.novoValor,

        alteraPrazoVigencia: input.alteraPrazoVigencia,
        novaVigenciaInicio: input.novaVigenciaInicio,
        novaVigenciaFim: input.novaVigenciaFim,
        novaVigenciaPrazo: input.novaVigenciaPrazo,
        novaVigenciaUnidade: input.novaVigenciaUnidade,

        alteraPrazoEntrega: input.alteraPrazoEntrega,
        novoPrazoEntregaDias: input.novoPrazoEntregaDias,
        novoPrazoEntregaUnidade: input.novoPrazoEntregaUnidade,

        aplicaReajuste: input.aplicaReajuste,
        reajusteIndice: input.reajusteIndice,
        reajusteIndiceOutro: input.reajusteIndiceOutro,
        reajustePeriodoInicio: input.reajustePeriodoInicio,
        reajustePeriodoFim: input.reajustePeriodoFim,
        reajustePercentual: input.reajustePercentual,
        reajusteEfeitosFinanceiros: input.reajusteEfeitosFinanceiros,

        observacoes: input.observacoes,
        arquivoPdfUrl,
        dadosAnteriores: novoSnapshot,
      },
    });

    await aplicarSideEffects(link, input);

    await registrarAnexo({
      arquivoPdfUrl,
      nome: `apostilamento-${input.numero}.pdf`,
      categoria: "APOSTILAMENTO",
      contratoId: link.contratoId,
      ataId: link.ataId,
      empenhoId: link.empenhoId,
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Apostilamento",
      recursoId: id,
      resumo: `Apostilamento ${input.numero} (editado)`,
    });

    revalidatePath(linkPath);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao editar apostilamento." };
  }
}

export async function excluirApostilamentoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("apostilamentoId") || "");
  if (!id) return { erro: "Apostilamento inválido." };

  try {
    const atual = await prisma.apostilamento.findFirst({
      where: {
        id,
        OR: [
          { contrato: { empresa: { contaId: usuario.contaId } } },
          { ata: { empresa: { contaId: usuario.contaId } } },
          { empenho: { empresa: { contaId: usuario.contaId } } },
        ],
      },
    });
    if (!atual) return { erro: "Apostilamento não encontrado." };

    const link = {
      contratoId: atual.contratoId ?? undefined,
      ataId: atual.ataId ?? undefined,
      empenhoId: atual.empenhoId ?? undefined,
    };
    const linkPath = atual.contratoId
      ? `/contratos/${atual.contratoId}`
      : atual.ataId
        ? `/atas/${atual.ataId}`
        : `/execucao/${atual.empenhoId}`;

    if (atual.dadosAnteriores) {
      await reverterSideEffects(atual.dadosAnteriores as unknown as DadosAnteriores, link);
    }

    await prisma.apostilamento.delete({ where: { id } });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "EXCLUIR",
      recurso: "Apostilamento",
      recursoId: id,
      resumo: `Apostilamento ${atual.numero} (excluído)`,
    });

    revalidatePath(linkPath);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao excluir apostilamento." };
  }
}

// ============================================================
// REAJUSTE
// ============================================================
export async function criarReajusteAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
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
  await bloquearEspionagem();
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

    const dataRecebimento = parseDataInputBr(String(formData.get("dataRecebimento"))) ?? new Date();
    const n = await prisma.notificacao.create({
      data: {
        numero: String(formData.get("numero") || "") || null,
        assunto: String(formData.get("assunto") || ""),
        descricao: String(formData.get("descricao") || ""),
        dataRecebimento,
        prazoResposta: formData.get("prazoResposta") ? Number(formData.get("prazoResposta")) : null,
        arquivoPdfUrl: arquivoPdfUrl || null,
        ataId: ataId || null,
        contratoId: contratoId || null,
        empenhoId: empenhoId || null,
        andamentos: {
          create: {
            status: "RECEBIDA",
            descricao: "Notificação recebida.",
            dataEvento: dataRecebimento,
          },
        },
      },
    });

    await registrarAnexo({
      arquivoPdfUrl,
      nome: `notificacao-${n.numero ?? n.id}.pdf`,
      categoria: "NOTIFICACAO",
      ataId: ataId || null,
      contratoId: contratoId || null,
      empenhoId: empenhoId || null,
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
  await bloquearEspionagem();
  const id = String(formData.get("notificacaoId"));
  const status = String(formData.get("status")) as "RECEBIDA" | "EM_TRATATIVA" | "RESPONDIDA" | "FINALIZADA";
  const descricao = String(formData.get("descricao") || "");
  const dataEvento = formData.get("dataEvento") ? parseDataInputBr(String(formData.get("dataEvento"))) ?? new Date() : new Date();

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

  // M3 — anexo opcional no andamento (ex.: PDF da resposta enviada)
  const file = formData.get("arquivo") as File | null;
  let arquivoPdfUrl: string | undefined;
  if (file && file.size > 0) {
    arquivoPdfUrl = (await salvarArquivo(file)).url;
  }

  await prisma.$transaction([
    prisma.andamentoNotificacao.create({
      data: { notificacaoId: id, status, descricao, dataEvento, arquivoPdfUrl: arquivoPdfUrl ?? null },
    }),
    prisma.notificacao.update({ where: { id }, data: { status } }),
  ]);

  await registrarAnexo({
    arquivoPdfUrl,
    nome: `notificacao-andamento-${status.toLowerCase()}.pdf`,
    categoria: "NOTIFICACAO",
    ataId: n.ataId,
    contratoId: n.contratoId,
    empenhoId: n.empenhoId,
  });

  if (n.ataId) revalidatePath(`/atas/${n.ataId}`);
  if (n.contratoId) revalidatePath(`/contratos/${n.contratoId}`);
  if (n.empenhoId) revalidatePath(`/execucao/${n.empenhoId}`);
}

/**
 * M3 — Permite corrigir os dados da notificação após cadastro.
 * Pode trocar o PDF, ajustar assunto/descrição/número/prazo.
 */
export async function editarNotificacaoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("notificacaoId") || "");
  if (!id) return { erro: "Notificação inválida." };

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
  if (!n) return { erro: "Notificação não encontrada." };

  try {
    const file = formData.get("arquivo") as File | null;
    let arquivoPdfUrl: string | null = n.arquivoPdfUrl;
    if (file && file.size > 0) {
      arquivoPdfUrl = (await salvarArquivo(file)).url;
    }

    await prisma.notificacao.update({
      where: { id },
      data: {
        numero: String(formData.get("numero") || "") || null,
        assunto: String(formData.get("assunto") || ""),
        descricao: String(formData.get("descricao") || ""),
        dataRecebimento: parseDataInputBr(String(formData.get("dataRecebimento") || "")) ?? n.dataRecebimento,
        prazoResposta: formData.get("prazoResposta") ? Number(formData.get("prazoResposta")) : null,
        arquivoPdfUrl,
      },
    });

    await registrarAnexo({
      arquivoPdfUrl,
      nome: `notificacao-${n.numero ?? id}.pdf`,
      categoria: "NOTIFICACAO",
      ataId: n.ataId,
      contratoId: n.contratoId,
      empenhoId: n.empenhoId,
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Notificacao",
      recursoId: id,
      resumo: `Notificação ${n.assunto} (editada)`,
    });

    if (n.ataId) revalidatePath(`/atas/${n.ataId}`);
    if (n.contratoId) revalidatePath(`/contratos/${n.contratoId}`);
    if (n.empenhoId) revalidatePath(`/execucao/${n.empenhoId}`);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao editar notificação." };
  }
}

/**
 * Edita um andamento específico de uma notificação — Regina:
 * "cada etapa de lançamento da notificação deve permitir a edição".
 * Permite corrigir data, descrição e/ou anexar/trocar arquivo.
 * NÃO altera o status do andamento (pra mudar status, exclua + crie novo).
 */
export async function editarAndamentoNotificacaoAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("andamentoId") || "");
  if (!id) return { erro: "Andamento inválido." };

  const andamento = await prisma.andamentoNotificacao.findFirst({
    where: {
      id,
      notificacao: {
        OR: [
          { ata: { empresa: { contaId: usuario.contaId } } },
          { contrato: { empresa: { contaId: usuario.contaId } } },
          { empenho: { empresa: { contaId: usuario.contaId } } },
        ],
      },
    },
    include: {
      notificacao: { select: { ataId: true, contratoId: true, empenhoId: true } },
    },
  });
  if (!andamento) return { erro: "Andamento não encontrado." };

  try {
    let arquivoPdfUrl: string | null = andamento.arquivoPdfUrl;
    const file = formData.get("arquivo") as File | null;
    if (file && file.size > 0) {
      arquivoPdfUrl = (await salvarArquivo(file)).url;
    }

    const dataEventoStr = String(formData.get("dataEvento") || "");
    const dataEvento = dataEventoStr
      ? parseDataInputBr(dataEventoStr) ?? andamento.dataEvento
      : andamento.dataEvento;

    await prisma.andamentoNotificacao.update({
      where: { id },
      data: {
        descricao: String(formData.get("descricao") || andamento.descricao),
        dataEvento,
        arquivoPdfUrl,
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "AndamentoNotificacao",
      recursoId: id,
      resumo: `Andamento ${andamento.status} editado`,
    });

    if (andamento.notificacao.ataId) revalidatePath(`/atas/${andamento.notificacao.ataId}`);
    if (andamento.notificacao.contratoId) revalidatePath(`/contratos/${andamento.notificacao.contratoId}`);
    if (andamento.notificacao.empenhoId) revalidatePath(`/execucao/${andamento.notificacao.empenhoId}`);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao editar andamento." };
  }
}

/**
 * Exclui um andamento — útil quando lançado por engano. Caso seja o
 * último andamento, a notificação volta ao status do andamento anterior
 * (ou RECEBIDA se não houver mais andamentos).
 */
export async function excluirAndamentoNotificacaoAction(formData: FormData): Promise<void> {
  await _excluirAndamentoInterno(formData);
}

async function _excluirAndamentoInterno(formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("andamentoId") || "");
  if (!id) return { erro: "Andamento inválido." };

  const andamento = await prisma.andamentoNotificacao.findFirst({
    where: {
      id,
      notificacao: {
        OR: [
          { ata: { empresa: { contaId: usuario.contaId } } },
          { contrato: { empresa: { contaId: usuario.contaId } } },
          { empenho: { empresa: { contaId: usuario.contaId } } },
        ],
      },
    },
    include: {
      notificacao: {
        include: { andamentos: { orderBy: { dataEvento: "asc" } } },
      },
    },
  });
  if (!andamento) return { erro: "Andamento não encontrado." };

  try {
    await prisma.andamentoNotificacao.delete({ where: { id } });

    // Atualiza status da notificação pra refletir o último andamento restante
    const restantes = andamento.notificacao.andamentos.filter((a) => a.id !== id);
    const novoStatus = restantes.length > 0
      ? restantes[restantes.length - 1].status
      : "RECEBIDA";
    await prisma.notificacao.update({
      where: { id: andamento.notificacaoId },
      data: { status: novoStatus },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "EXCLUIR",
      recurso: "AndamentoNotificacao",
      recursoId: id,
      resumo: `Andamento ${andamento.status} excluído`,
    });

    if (andamento.notificacao.ataId) revalidatePath(`/atas/${andamento.notificacao.ataId}`);
    if (andamento.notificacao.contratoId) revalidatePath(`/contratos/${andamento.notificacao.contratoId}`);
    if (andamento.notificacao.empenhoId) revalidatePath(`/execucao/${andamento.notificacao.empenhoId}`);
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao excluir andamento." };
  }
}

// ============================================================
// PROCEDIMENTO APURATÓRIO (Lei 14.133/2021 art. 157+)
// ============================================================
export async function criarProcedimentoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;

  if (!ataId && !contratoId && !empenhoId) return { erro: "Vínculo obrigatório." };

  try {
    // PDF: se IA persistiu, pega hidden URL; senão usa file novo.
    let arquivoPdfUrl = String(formData.get("arquivoPdfUrl") || "") || undefined;
    const file = formData.get("arquivo") as File | null;
    if (file && file.size > 0) arquivoPdfUrl = (await salvarArquivo(file)).url;

    // M3 — comissão como array de membros (mín. 2 servidores)
    const membros = formData
      .getAll("comissaoMembros")
      .map((v) => String(v).trim())
      .filter((s) => s.length > 0);

    const dataAbertura = parseDataInputBr(String(formData.get("dataAbertura"))) ?? new Date();
    const p = await prisma.procedimentoApuratorio.create({
      data: {
        numero: String(formData.get("numero") || "") || null,
        notificacaoNumero: String(formData.get("notificacaoNumero") || "") || null,
        assunto: String(formData.get("assunto") || ""),
        descricao: String(formData.get("descricao") || ""),
        // `comissao` (CSV legado) — mantém pra retrocompat
        comissao: membros.join(", ") || null,
        comissaoMembros: membros,
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

    await registrarAnexo({
      arquivoPdfUrl,
      nome: `procedimento-${p.numero ?? p.id}.pdf`,
      categoria: "PROCEDIMENTO",
      ataId: ataId || null,
      contratoId: contratoId || null,
      empenhoId: empenhoId || null,
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
    return { erro: err instanceof Error ? err.message : "Erro ao abrir procedimento." };
  }
}

export async function avancarProcedimentoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("procedimentoId"));
  const fase = String(formData.get("fase")) as
    | "ABERTURA" | "NOTIFICACAO_DEFESA" | "DEFESA_APRESENTADA" | "PEDIDO_PROVAS"
    | "DEFERIMENTO_PROVAS" | "NOTIFICACAO_ALEGACOES" | "ALEGACOES_FINAIS"
    | "DECISAO_1A_INSTANCIA" | "RECURSO" | "DECISAO_FINAL" | "ARQUIVAMENTO" | "PENALIDADE_APLICADA";
  const descricao = String(formData.get("descricao") || "");
  const dataEvento = formData.get("dataEvento")
    ? parseDataInputBr(String(formData.get("dataEvento"))) ?? new Date()
    : new Date();

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

  // M3 — upload de PDF no andamento (comprovante de notificação, defesa, etc.)
  const file = formData.get("arquivo") as File | null;
  let arquivoPdfUrl: string | null = null;
  if (file && file.size > 0) {
    arquivoPdfUrl = (await salvarArquivo(file)).url;
  }

  await prisma.andamentoProcedimento.create({
    data: { procedimentoId: id, fase, descricao, dataEvento, arquivoPdfUrl },
  });

  if (fase === "ARQUIVAMENTO") {
    await prisma.procedimentoApuratorio.update({ where: { id }, data: { arquivado: true } });
  }

  await registrarAnexo({
    arquivoPdfUrl,
    nome: `procedimento-${fase.toLowerCase()}.pdf`,
    categoria: "PROCEDIMENTO",
    ataId: p.ataId,
    contratoId: p.contratoId,
    empenhoId: p.empenhoId,
  });

  if (p.ataId) revalidatePath(`/atas/${p.ataId}`);
  if (p.contratoId) revalidatePath(`/contratos/${p.contratoId}`);
  if (p.empenhoId) revalidatePath(`/execucao/${p.empenhoId}`);
}

export async function aplicarPenalidadeAction(formData: FormData) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
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
      dataAplicacao: parseDataInputBr(String(formData.get("dataAplicacao"))) ?? new Date(),
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
  await bloquearEspionagem();
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
  await bloquearEspionagem();
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;
  // valor pode ser "false" (sem previsão), "true" (há previsão) ou "reset"
  // (volta pra null/não declarado). Tri-estado igual ao schema.
  const valorRaw = String(formData.get("valor") || "");
  const valor: boolean | null = valorRaw === "true" ? true : valorRaw === "false" ? false : null;

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
    console.error("[marcarSemGarantiaAction]", err);
    return { erro: err instanceof Error ? err.message : "Erro ao salvar." };
  }
}

export async function adicionarEndossoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const garantiaId = String(formData.get("garantiaId") || "");
  if (!garantiaId) return { erro: "Garantia não informada." };

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

  // Validações explícitas — antes recuavam silenciosamente quando o input
  // vinha vazio (Number("") = NaN; new Date("") = Invalid Date), e o Prisma
  // só estourava na inserção, surgindo um erro críptico no toast.
  const valorRaw = String(formData.get("valor") || "").trim();
  const valor = Number(valorRaw);
  if (!valorRaw || !Number.isFinite(valor) || valor < 0) {
    return { erro: "Informe um valor numérico válido (R$)." };
  }
  const dataInicioStr = String(formData.get("dataInicio") || "").trim();
  if (!dataInicioStr) return { erro: "Informe a data de início." };
  const dataInicio = parseDataInputBr(dataInicioStr);
  if (!dataInicio) return { erro: "Data de início inválida." };
  const dataFimStr = String(formData.get("dataFim") || "").trim();
  const dataFimEndosso = dataFimStr ? parseDataInputBr(dataFimStr) : null;
  if (dataFimStr && !dataFimEndosso) return { erro: "Data de fim inválida." };

  try {
    const file = formData.get("arquivo") as File | null;
    let arquivoPdfUrl: string | undefined;
    if (file && file.size > 0) arquivoPdfUrl = (await salvarArquivo(file)).url;

    await prisma.endosso.create({
      data: {
        garantiaId,
        valor,
        dataInicio,
        dataFim: dataFimEndosso,
        observacoes: String(formData.get("observacoes") || "").trim() || null,
        arquivoPdfUrl: arquivoPdfUrl || null,
      },
    });

    // Bug do Contrato 82/2024 UNB: o endosso prorroga a vigência da
    // garantia mas a tela continuava mostrando "expirada" porque só lia
    // garantia.dataFim. Write-through na garantia pai quando o endosso
    // estende. (A UI também calcula vigência efetiva dinamicamente como
    // safety net pra dados legacy — ver CardGarantia.)
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
    console.error("[adicionarEndossoAction]", err);
    return { erro: err instanceof Error ? err.message : "Erro ao salvar endosso." };
  }
}

// ============================================================
// ANEXOS + ANOTAÇÕES
// ============================================================
export async function adicionarAnexoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
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
  await bloquearEspionagem();
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
