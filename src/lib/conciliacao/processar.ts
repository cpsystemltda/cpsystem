import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extrairExtrato } from "./extrator";
import { encontrarCandidatos, SCORE_AUTO_CONFIRMA, classificarScore } from "./match";
import type { FonteExtrato } from "@/generated/prisma/client";

// Orquestrador: recebe PDF, salva Extrato, extrai transacoes via LLM,
// matcheia com empenhos e grava tudo em transacao Prisma.

export type ProcessarExtratoInput = {
  contaId: string;
  fonte: FonteExtrato;
  nomeArquivo: string;
  pdfBuffer: Buffer;
  urlArquivo?: string; // opcional — se ja salvo em Vercel Blob
};

export type ProcessarExtratoResultado =
  | { ok: true; extratoId: string; jaProcessado: boolean }
  | { ok: false; erro: string };

// Ponto de entrada. Idempotente por (contaId, hashArquivo) — se enviar o
// MESMO PDF 2x pra mesma conta, retorna o Extrato ja processado sem reprocessar.
export async function processarExtrato(
  input: ProcessarExtratoInput,
): Promise<ProcessarExtratoResultado> {
  const hashArquivo = createHash("sha256").update(input.pdfBuffer).digest("hex");

  // Dedup: ja processou esse mesmo arquivo?
  const existente = await prisma.extrato.findUnique({
    where: { contaId_hashArquivo: { contaId: input.contaId, hashArquivo } },
    select: { id: true, status: true },
  });
  if (existente) {
    return { ok: true, extratoId: existente.id, jaProcessado: true };
  }

  // 1) Cria o Extrato como RECEBIDO
  const extrato = await prisma.extrato.create({
    data: {
      contaId: input.contaId,
      fonte: input.fonte,
      status: "RECEBIDO",
      hashArquivo,
      nomeArquivo: input.nomeArquivo,
      tamanhoBytes: input.pdfBuffer.length,
      urlArquivo: input.urlArquivo,
    },
  });

  // 2) Extrai via LLM (marca como EXTRAINDO)
  await prisma.extrato.update({
    where: { id: extrato.id },
    data: { status: "EXTRAINDO" },
  });

  let extracao;
  try {
    const b64 = input.pdfBuffer.toString("base64");
    extracao = await extrairExtrato(b64);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.extrato.update({
      where: { id: extrato.id },
      data: { status: "ERRO", erroMsg: `extrator: ${msg}` },
    });
    return { ok: false, erro: msg };
  }

  // 3) Grava transacoes + metadata
  const creditos = extracao.transacoes.filter((t) => t.tipo === "CREDITO");
  const debitos = extracao.transacoes.filter((t) => t.tipo === "DEBITO");
  const totalCreditos = creditos.reduce((s, t) => s + t.valor, 0);
  const totalDebitos = debitos.reduce((s, t) => s + t.valor, 0);

  await prisma.$transaction([
    prisma.extrato.update({
      where: { id: extrato.id },
      data: {
        status: "EXTRAIDO",
        bancoDetectado: extracao.meta.bancoDetectado ?? null,
        agenciaConta: extracao.meta.agenciaConta ?? null,
        periodoInicio: extracao.meta.periodoInicio ? new Date(extracao.meta.periodoInicio) : null,
        periodoFim: extracao.meta.periodoFim ? new Date(extracao.meta.periodoFim) : null,
        saldoInicial: extracao.meta.saldoInicial ?? null,
        saldoFinal: extracao.meta.saldoFinal ?? null,
        totalTransacoes: extracao.transacoes.length,
        totalCreditos,
        totalDebitos,
      },
    }),
    prisma.transacaoExtrato.createMany({
      data: extracao.transacoes.map((t) => ({
        extratoId: extrato.id,
        tipo: t.tipo,
        data: new Date(t.data),
        valor: t.valor,
        descricao: t.descricao,
        nomeContraparte: t.nomeContraparte,
        cnpjContraparte: t.cnpjContraparte,
        identificadorBancario: t.identificadorBancario,
      })),
    }),
  ]);

  // 4) Matching (marca como CONCILIANDO)
  await prisma.extrato.update({
    where: { id: extrato.id },
    data: { status: "CONCILIANDO" },
  });

  const transacoes = await prisma.transacaoExtrato.findMany({
    where: { extratoId: extrato.id, tipo: "CREDITO" },
    select: {
      id: true, data: true, valor: true, descricao: true,
      nomeContraparte: true, cnpjContraparte: true,
    },
  });

  let qtdAlto = 0, qtdMedio = 0, qtdSem = 0;

  for (const tx of transacoes) {
    const candidatos = await encontrarCandidatos(input.contaId, tx);
    if (candidatos.length === 0) {
      qtdSem++;
      continue;
    }
    // Salva top 3 candidatos como Conciliacao
    for (const c of candidatos) {
      const auto = c.score >= SCORE_AUTO_CONFIRMA;
      await prisma.conciliacao.create({
        data: {
          transacaoId: tx.id,
          empenhoId: c.empenhoId,
          score: c.score,
          fatoresMatch: c.fatores as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue,
          status: auto ? "CONFIRMADA" : "SUGERIDA",
          confirmadaEm: auto ? new Date() : null,
        },
      });
    }
    const melhor = candidatos[0];
    const nivel = classificarScore(melhor.score);
    if (nivel === "alto") {
      qtdAlto++;
      // Se auto-confirmou o melhor candidato, atualiza o Empenho pra PAGO
      await prisma.empenho.update({
        where: { id: melhor.empenhoId },
        data: { status: "PAGO" },
      });
    } else if (nivel === "medio") qtdMedio++;
    else qtdSem++;
  }

  // 5) Marca CONCLUIDO + estatisticas
  await prisma.extrato.update({
    where: { id: extrato.id },
    data: {
      status: "CONCLUIDO",
      qtdMatchAlto: qtdAlto,
      qtdMatchMedio: qtdMedio,
      qtdSemMatch: qtdSem,
    },
  });

  return { ok: true, extratoId: extrato.id, jaProcessado: false };
}
