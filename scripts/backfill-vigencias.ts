/**
 * Backfill: cria Vigência 1 pra todo Contrato e Ata existentes, e atribui
 * vigenciaId a todos ContratoItem, AtaItem e Empenho órfãos.
 *
 * Por que: Phase 1 da refatoração de "saldo por vigência" introduz o model
 * Vigência com FKs nullable em items e empenhos. Tudo que existia antes
 * fica órfão até o backfill atribuir à Vigência 1 do contrato/ata pai.
 *
 * Política:
 * - Cada Contrato vira 1 Vigência (ordem=1, dataInicio=contrato.vigenciaInicio,
 *   dataFim=contrato.vigenciaFim, valorTotal=contrato.valorInicial OU somatório
 *   atual dos itens caso valorInicial seja null).
 * - Cada Ata vira 1 Vigência idem.
 * - ContratoItem.vigenciaId = vigência 1 do contrato pai
 * - AtaItem.vigenciaId = vigência 1 da ata pai
 * - Empenho.vigenciaId = vigência 1 do contrato OU ata pai (preferência
 *   pelo contratoId quando ambos estão presentes)
 *
 * Idempotente: detecta contratos/atas que já têm Vigência 1 e pula.
 * Items/empenhos já com vigenciaId também são pulados.
 *
 * Rodar:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/backfill-vigencias.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Backfill Vigências ===\n");

  // ----- CONTRATOS -----
  const contratos = await prisma.contrato.findMany({
    select: {
      id: true,
      numero: true,
      vigenciaInicio: true,
      vigenciaFim: true,
      valorInicial: true,
      itens: { select: { id: true, valorTotal: true, vigenciaId: true } },
      empenhos: { select: { id: true, vigenciaId: true } },
      vigencias: { select: { id: true, ordem: true } },
    },
  });

  console.log(`Contratos analisados: ${contratos.length}`);
  let contratosVigCriada = 0;
  let contratoItensAjustados = 0;
  let contratoEmpenhosAjustados = 0;

  for (const c of contratos) {
    const jaTemV1 = c.vigencias.some((v) => v.ordem === 1);
    let vigenciaId: string;

    if (jaTemV1) {
      vigenciaId = c.vigencias.find((v) => v.ordem === 1)!.id;
    } else {
      const valorTotal =
        c.valorInicial ?? c.itens.reduce((s, it) => s + it.valorTotal, 0);
      const v = await prisma.vigencia.create({
        data: {
          ordem: 1,
          dataInicio: c.vigenciaInicio,
          dataFim: c.vigenciaFim,
          valorTotal,
          contratoId: c.id,
          observacao: "Vigência original (backfill automático)",
        },
        select: { id: true },
      });
      vigenciaId = v.id;
      contratosVigCriada++;
      console.log(`  ✓ Contrato ${c.numero}: Vigência 1 criada (R$ ${valorTotal.toFixed(2)})`);
    }

    // ContratoItem.vigenciaId
    const itensOrfaos = c.itens.filter((i) => i.vigenciaId === null);
    if (itensOrfaos.length > 0) {
      await prisma.contratoItem.updateMany({
        where: { id: { in: itensOrfaos.map((i) => i.id) } },
        data: { vigenciaId },
      });
      contratoItensAjustados += itensOrfaos.length;
    }

    // Empenho.vigenciaId
    const empenhosOrfaos = c.empenhos.filter((e) => e.vigenciaId === null);
    if (empenhosOrfaos.length > 0) {
      await prisma.empenho.updateMany({
        where: { id: { in: empenhosOrfaos.map((e) => e.id) } },
        data: { vigenciaId },
      });
      contratoEmpenhosAjustados += empenhosOrfaos.length;
    }
  }

  // ----- ATAS -----
  const atas = await prisma.ata.findMany({
    select: {
      id: true,
      numero: true,
      vigenciaInicio: true,
      vigenciaFim: true,
      itens: { select: { id: true, valorTotal: true, vigenciaId: true } },
      empenhos: {
        select: { id: true, vigenciaId: true, contratoId: true },
      },
      vigencias: { select: { id: true, ordem: true } },
    },
  });

  console.log(`\nAtas analisadas: ${atas.length}`);
  let atasVigCriada = 0;
  let ataItensAjustados = 0;
  let ataEmpenhosAjustados = 0;

  for (const a of atas) {
    const jaTemV1 = a.vigencias.some((v) => v.ordem === 1);
    let vigenciaId: string;

    if (jaTemV1) {
      vigenciaId = a.vigencias.find((v) => v.ordem === 1)!.id;
    } else {
      const valorTotal = a.itens.reduce((s, it) => s + it.valorTotal, 0);
      const v = await prisma.vigencia.create({
        data: {
          ordem: 1,
          dataInicio: a.vigenciaInicio,
          dataFim: a.vigenciaFim,
          valorTotal,
          ataId: a.id,
          observacao: "Vigência original (backfill automático)",
        },
        select: { id: true },
      });
      vigenciaId = v.id;
      atasVigCriada++;
      console.log(`  ✓ Ata ${a.numero}: Vigência 1 criada (R$ ${valorTotal.toFixed(2)})`);
    }

    // AtaItem.vigenciaId
    const itensOrfaos = a.itens.filter((i) => i.vigenciaId === null);
    if (itensOrfaos.length > 0) {
      await prisma.ataItem.updateMany({
        where: { id: { in: itensOrfaos.map((i) => i.id) } },
        data: { vigenciaId },
      });
      ataItensAjustados += itensOrfaos.length;
    }

    // Empenho.vigenciaId — APENAS empenhos diretos da ata (sem contratoId).
    // Empenhos com contratoId já receberam vigenciaId no loop de contratos.
    const empenhosOrfaos = a.empenhos.filter(
      (e) => e.vigenciaId === null && e.contratoId === null,
    );
    if (empenhosOrfaos.length > 0) {
      await prisma.empenho.updateMany({
        where: { id: { in: empenhosOrfaos.map((e) => e.id) } },
        data: { vigenciaId },
      });
      ataEmpenhosAjustados += empenhosOrfaos.length;
    }
  }

  // ----- AUDITORIA FINAL -----
  console.log("\n=== Verificação ===");
  const itensContratoOrfaos = await prisma.contratoItem.count({
    where: { vigenciaId: null },
  });
  const itensAtaOrfaos = await prisma.ataItem.count({
    where: { vigenciaId: null },
  });
  const empenhosOrfaos = await prisma.empenho.count({
    where: { vigenciaId: null },
  });

  console.log(`Resumo:`);
  console.log(`  Contratos com vigência 1 criada agora: ${contratosVigCriada}`);
  console.log(`  ContratoItem atribuídos: ${contratoItensAjustados}`);
  console.log(`  Empenho (de contrato) atribuídos: ${contratoEmpenhosAjustados}`);
  console.log(`  Atas com vigência 1 criada agora: ${atasVigCriada}`);
  console.log(`  AtaItem atribuídos: ${ataItensAjustados}`);
  console.log(`  Empenho (de ata, sem contrato) atribuídos: ${ataEmpenhosAjustados}`);
  console.log(`\nÓrfãos restantes (deve ser 0):`);
  console.log(`  ContratoItem sem vigência: ${itensContratoOrfaos}`);
  console.log(`  AtaItem sem vigência: ${itensAtaOrfaos}`);
  console.log(`  Empenho sem vigência: ${empenhosOrfaos}`);

  if (itensContratoOrfaos + itensAtaOrfaos + empenhosOrfaos > 0) {
    console.error("\n⚠ ATENÇÃO: ainda há órfãos. Investigar antes de seguir pra Phase 2.");
    process.exit(1);
  }

  console.log("\n✓ Backfill concluído com sucesso. Tudo atribuído a alguma Vigência.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
