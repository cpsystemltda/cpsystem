/**
 * Backfill das datas logísticas dos empenhos pra normalizar o bug do D-1.
 *
 * Por que: antes do fix, `registrarMarcoAction` fazia `new Date("YYYY-MM-DD")`
 * que parseia como UTC 00:00. Em BR (-3h) a data salva no banco corresponde
 * a 21:00 do DIA ANTERIOR — `toLocaleDateString("pt-BR")` mostra D-1.
 *
 * Solução: pra cada data logística com UTC 00:00, somar 12h (ancora no meio-dia
 * UTC, que é seguro pra qualquer fuso brasileiro). Datas que não foram afetadas
 * (qualquer hora diferente de 00:00) ficam intactas. Idempotente.
 *
 * Campos afetados (model Empenho):
 *   - dataPedidoRecebido
 *   - dataDespacho
 *   - dataEntrega
 *   - dataNfEmitida
 *   - dataNfEncaminhada
 *   - dataPagamento
 *
 * Rodar:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/backfill-datas-logistica.ts
 */
import { prisma } from "@/lib/prisma";

const CAMPOS = [
  "dataPedidoRecebido",
  "dataDespacho",
  "dataEntrega",
  "dataNfEmitida",
  "dataNfEncaminhada",
  "dataPagamento",
] as const;

type Campo = (typeof CAMPOS)[number];

async function main() {
  const empenhos = await prisma.empenho.findMany({
    select: {
      id: true,
      numero: true,
      dataPedidoRecebido: true,
      dataDespacho: true,
      dataEntrega: true,
      dataNfEmitida: true,
      dataNfEncaminhada: true,
      dataPagamento: true,
    },
  });

  console.log(`Backfill: ${empenhos.length} empenho(s) encontrados.`);
  let ajustados = 0;
  let camposAjustados = 0;

  for (const e of empenhos) {
    const updates: Partial<Record<Campo, Date>> = {};
    for (const campo of CAMPOS) {
      const d = e[campo] as Date | null;
      if (!d) continue;
      // Bug deixava UTC 00:00:00 — qualquer data com essa hora é candidata.
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        // Soma 12h pra ancorar no meio-dia UTC. Em BR (-3h), passa a representar
        // o mesmo dia útil sem variação de fuso.
        updates[campo] = new Date(d.getTime() + 12 * 3600 * 1000);
      }
    }
    if (Object.keys(updates).length > 0) {
      await prisma.empenho.update({ where: { id: e.id }, data: updates });
      ajustados++;
      camposAjustados += Object.keys(updates).length;
      console.log(`  ✓ Empenho ${e.numero}: ${Object.keys(updates).join(", ")}`);
    }
  }

  console.log(
    `Backfill concluído. ${ajustados} empenho(s) atualizado(s), ${camposAjustados} data(s) ajustada(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
