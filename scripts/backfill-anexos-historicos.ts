/**
 * Backfill: cria registros Anexo retroativos pros PDFs já cadastrados em:
 *   - Ata.arquivoPdfUrl              (CONTRATUAL)
 *   - Contrato.arquivoPdfUrl + arquivoOfUrl (CONTRATUAL)
 *   - Empenho.arquivoPdfUrl          (CONTRATUAL)
 *   - TermoAditivo.arquivoPdfUrl     (ADITIVO)
 *   - Apostilamento.arquivoPdfUrl    (APOSTILAMENTO)
 *   - Garantia.arquivoPdfUrl         (GARANTIA)
 *   - Endosso.arquivoPdfUrl          (GARANTIA)
 *   - Notificacao.arquivoPdfUrl + AndamentoNotificacao.arquivoPdfUrl (NOTIFICACAO)
 *   - ProcedimentoApuratorio.arquivoPdfUrl + AndamentoProcedimento.arquivoPdfUrl (PROCEDIMENTO)
 *
 * Idempotente: pula registros já presentes em Anexo (matching por url+vinculo).
 *
 * Rodar:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/backfill-anexos-historicos.ts
 */
import { prisma } from "@/lib/prisma";
import type { CategoriaAnexo } from "@/generated/prisma/client";

type Vinculo = { ataId?: string | null; contratoId?: string | null; empenhoId?: string | null };

async function criarSeFaltar(opts: {
  url: string;
  nome: string;
  categoria: CategoriaAnexo;
  vinculo: Vinculo;
}): Promise<boolean> {
  const existente = await prisma.anexo.findFirst({
    where: {
      url: opts.url,
      ataId: opts.vinculo.ataId ?? null,
      contratoId: opts.vinculo.contratoId ?? null,
      empenhoId: opts.vinculo.empenhoId ?? null,
    },
  });
  if (existente) return false;
  await prisma.anexo.create({
    data: {
      nome: opts.nome,
      url: opts.url,
      mimeType: "application/pdf",
      categoria: opts.categoria,
      ataId: opts.vinculo.ataId ?? null,
      contratoId: opts.vinculo.contratoId ?? null,
      empenhoId: opts.vinculo.empenhoId ?? null,
    },
  });
  return true;
}

async function main() {
  let total = 0;

  // 1) Atas
  const atas = await prisma.ata.findMany({
    where: { arquivoPdfUrl: { not: null } },
    select: { id: true, numero: true, arquivoPdfUrl: true },
  });
  for (const a of atas) {
    if (a.arquivoPdfUrl && await criarSeFaltar({
      url: a.arquivoPdfUrl,
      nome: `ata-${a.numero}.pdf`,
      categoria: "CONTRATUAL",
      vinculo: { ataId: a.id },
    })) total++;
  }

  // 2) Contratos (arquivoPdfUrl + arquivoOfUrl)
  const contratos = await prisma.contrato.findMany({
    where: { OR: [{ arquivoPdfUrl: { not: null } }, { arquivoOfUrl: { not: null } }] },
    select: { id: true, numero: true, arquivoPdfUrl: true, arquivoOfUrl: true },
  });
  for (const c of contratos) {
    if (c.arquivoPdfUrl && await criarSeFaltar({
      url: c.arquivoPdfUrl,
      nome: `contrato-${c.numero}.pdf`,
      categoria: "CONTRATUAL",
      vinculo: { contratoId: c.id },
    })) total++;
    if (c.arquivoOfUrl && await criarSeFaltar({
      url: c.arquivoOfUrl,
      nome: `of-${c.numero}.pdf`,
      categoria: "CONTRATUAL",
      vinculo: { contratoId: c.id },
    })) total++;
  }

  // 3) Empenhos
  const empenhos = await prisma.empenho.findMany({
    where: { arquivoPdfUrl: { not: null } },
    select: { id: true, numero: true, arquivoPdfUrl: true },
  });
  for (const e of empenhos) {
    if (e.arquivoPdfUrl && await criarSeFaltar({
      url: e.arquivoPdfUrl,
      nome: `empenho-${e.numero}.pdf`,
      categoria: "CONTRATUAL",
      vinculo: { empenhoId: e.id },
    })) total++;
  }

  // 4) Termos aditivos
  const aditivos = await prisma.termoAditivo.findMany({
    where: { arquivoPdfUrl: { not: null } },
    select: { id: true, numero: true, arquivoPdfUrl: true, ataId: true, contratoId: true, empenhoId: true },
  });
  for (const a of aditivos) {
    if (a.arquivoPdfUrl && await criarSeFaltar({
      url: a.arquivoPdfUrl,
      nome: `aditivo-${a.numero}.pdf`,
      categoria: "ADITIVO",
      vinculo: { ataId: a.ataId, contratoId: a.contratoId, empenhoId: a.empenhoId },
    })) total++;
  }

  // 5) Apostilamentos
  const apost = await prisma.apostilamento.findMany({
    where: { arquivoPdfUrl: { not: null } },
    select: { id: true, numero: true, arquivoPdfUrl: true, ataId: true, contratoId: true, empenhoId: true },
  });
  for (const a of apost) {
    if (a.arquivoPdfUrl && await criarSeFaltar({
      url: a.arquivoPdfUrl,
      nome: `apostilamento-${a.numero}.pdf`,
      categoria: "APOSTILAMENTO",
      vinculo: { ataId: a.ataId, contratoId: a.contratoId, empenhoId: a.empenhoId },
    })) total++;
  }

  // 6) Garantias (+ endossos)
  const garantias = await prisma.garantia.findMany({
    where: { arquivoPdfUrl: { not: null } },
    select: { id: true, contratoId: true, empenhoId: true, arquivoPdfUrl: true, endossos: { select: { id: true, arquivoPdfUrl: true } } },
  });
  for (const g of garantias) {
    if (g.arquivoPdfUrl && await criarSeFaltar({
      url: g.arquivoPdfUrl,
      nome: `garantia-${g.id.slice(0, 6)}.pdf`,
      categoria: "GARANTIA",
      vinculo: { contratoId: g.contratoId, empenhoId: g.empenhoId },
    })) total++;
    for (const e of g.endossos) {
      if (e.arquivoPdfUrl && await criarSeFaltar({
        url: e.arquivoPdfUrl,
        nome: `endosso-${e.id.slice(0, 6)}.pdf`,
        categoria: "GARANTIA",
        vinculo: { contratoId: g.contratoId, empenhoId: g.empenhoId },
      })) total++;
    }
  }

  // 7) Notificações + andamentos
  const notifs = await prisma.notificacao.findMany({
    where: { OR: [{ arquivoPdfUrl: { not: null } }, { andamentos: { some: { arquivoPdfUrl: { not: null } } } }] },
    select: { id: true, numero: true, arquivoPdfUrl: true, ataId: true, contratoId: true, empenhoId: true, andamentos: { select: { id: true, status: true, arquivoPdfUrl: true } } },
  });
  for (const n of notifs) {
    if (n.arquivoPdfUrl && await criarSeFaltar({
      url: n.arquivoPdfUrl,
      nome: `notificacao-${n.numero ?? n.id.slice(0, 6)}.pdf`,
      categoria: "NOTIFICACAO",
      vinculo: { ataId: n.ataId, contratoId: n.contratoId, empenhoId: n.empenhoId },
    })) total++;
    for (const a of n.andamentos) {
      if (a.arquivoPdfUrl && await criarSeFaltar({
        url: a.arquivoPdfUrl,
        nome: `notif-andamento-${a.status.toLowerCase()}.pdf`,
        categoria: "NOTIFICACAO",
        vinculo: { ataId: n.ataId, contratoId: n.contratoId, empenhoId: n.empenhoId },
      })) total++;
    }
  }

  // 8) Procedimentos apuratórios + andamentos
  const procs = await prisma.procedimentoApuratorio.findMany({
    where: { OR: [{ arquivoPdfUrl: { not: null } }, { andamentos: { some: { arquivoPdfUrl: { not: null } } } }] },
    select: { id: true, numero: true, arquivoPdfUrl: true, ataId: true, contratoId: true, empenhoId: true, andamentos: { select: { id: true, fase: true, arquivoPdfUrl: true } } },
  });
  for (const p of procs) {
    if (p.arquivoPdfUrl && await criarSeFaltar({
      url: p.arquivoPdfUrl,
      nome: `procedimento-${p.numero ?? p.id.slice(0, 6)}.pdf`,
      categoria: "PROCEDIMENTO",
      vinculo: { ataId: p.ataId, contratoId: p.contratoId, empenhoId: p.empenhoId },
    })) total++;
    for (const a of p.andamentos) {
      if (a.arquivoPdfUrl && await criarSeFaltar({
        url: a.arquivoPdfUrl,
        nome: `proc-andamento-${a.fase.toLowerCase()}.pdf`,
        categoria: "PROCEDIMENTO",
        vinculo: { ataId: p.ataId, contratoId: p.contratoId, empenhoId: p.empenhoId },
      })) total++;
    }
  }

  console.log(`\nBackfill anexos concluído. ${total} novo(s) registro(s) Anexo criado(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
