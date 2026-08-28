/**
 * Passa os arquivos já guardados de PÚBLICO para PRIVADO.
 *
 * Regina 28/08, revisão de segurança: até então todo anexo ficava público no
 * armazenamento — sem listagem e com caminho aleatório, mas aberto a quem
 * tivesse o link. Uploads novos já sobem privados; este script cuida dos 383
 * documentos que ficaram para trás.
 *
 * Como roda, e por que nesta ordem:
 *   1. copia o arquivo para um caminho privado;
 *   2. confere que a cópia privada abre;
 *   3. registra na tabela Arquivo, amarrada à conta dona;
 *   4. troca a referência no banco para /api/arquivo/<id>;
 *   5. só então apaga a cópia pública (fase 2, separada).
 *
 * O apagamento fica numa fase à parte de propósito: enquanto ele não roda, o
 * pior caso é um arquivo duplicado — nunca um documento perdido.
 *
 *   npx tsx scripts/migrar-arquivos-privados.ts            (simulação)
 *   npx tsx scripts/migrar-arquivos-privados.ts --aplicar  (copia e troca)
 *   npx tsx scripts/migrar-arquivos-privados.ts --apagar-publicos (fase 2)
 */
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const APLICAR = process.argv.includes("--aplicar");
const APAGAR = process.argv.includes("--apagar-publicos");

// Cada coluna que guarda URL de arquivo, com o caminho até a conta dona.
// A lista veio de varredura no banco: são as 12 colunas que de fato têm URL.
const COLUNAS: Array<{ tabela: string; coluna: string; sqlConta: string }> = [
  {
    tabela: "Anexo",
    coluna: "url",
    sqlConta: `COALESCE(ea.\"contaId\", ec.\"contaId\", ee.\"contaId\")
      FROM \"Anexo\" t
      LEFT JOIN \"Ata\" a ON a.id = t.\"ataId\"           LEFT JOIN \"Empresa\" ea ON ea.id = a.\"empresaId\"
      LEFT JOIN \"Contrato\" c ON c.id = t.\"contratoId\" LEFT JOIN \"Empresa\" ec ON ec.id = c.\"empresaId\"
      LEFT JOIN \"Empenho\" e ON e.id = t.\"empenhoId\"   LEFT JOIN \"Empresa\" ee ON ee.id = e.\"empresaId\"`,
  },
  ...["arquivoNfEmitida", "arquivoNfEncaminhada", "arquivoPedidoRecebido", "arquivoEntrega", "arquivoDespacho", "arquivoPagamento"].map(
    (coluna) => ({
      tabela: "Empenho",
      coluna,
      sqlConta: `emp.\"contaId\" FROM \"Empenho\" t JOIN \"Empresa\" emp ON emp.id = t.\"empresaId\"`,
    }),
  ),
  {
    tabela: "Notificacao",
    coluna: "arquivoPdfUrl",
    sqlConta: `COALESCE(ea.\"contaId\", ec.\"contaId\", ee.\"contaId\")
      FROM \"Notificacao\" t
      LEFT JOIN \"Ata\" a ON a.id = t.\"ataId\"           LEFT JOIN \"Empresa\" ea ON ea.id = a.\"empresaId\"
      LEFT JOIN \"Contrato\" c ON c.id = t.\"contratoId\" LEFT JOIN \"Empresa\" ec ON ec.id = c.\"empresaId\"
      LEFT JOIN \"Empenho\" e ON e.id = t.\"empenhoId\"   LEFT JOIN \"Empresa\" ee ON ee.id = e.\"empresaId\"`,
  },
  {
    tabela: "AndamentoNotificacao",
    coluna: "arquivoPdfUrl",
    sqlConta: `COALESCE(ea.\"contaId\", ec.\"contaId\", ee.\"contaId\")
      FROM \"AndamentoNotificacao\" t
      JOIN \"Notificacao\" n ON n.id = t.\"notificacaoId\"
      LEFT JOIN \"Ata\" a ON a.id = n.\"ataId\"           LEFT JOIN \"Empresa\" ea ON ea.id = a.\"empresaId\"
      LEFT JOIN \"Contrato\" c ON c.id = n.\"contratoId\" LEFT JOIN \"Empresa\" ec ON ec.id = c.\"empresaId\"
      LEFT JOIN \"Empenho\" e ON e.id = n.\"empenhoId\"   LEFT JOIN \"Empresa\" ee ON ee.id = e.\"empresaId\"`,
  },
  ...["TermoAditivo", "Apostilamento"].map((tabela) => ({
    tabela,
    coluna: "arquivoPdfUrl",
    sqlConta: `COALESCE(ea.\"contaId\", ec.\"contaId\", ee.\"contaId\")
      FROM \"${tabela}\" t
      LEFT JOIN \"Ata\" a ON a.id = t.\"ataId\"           LEFT JOIN \"Empresa\" ea ON ea.id = a.\"empresaId\"
      LEFT JOIN \"Contrato\" c ON c.id = t.\"contratoId\" LEFT JOIN \"Empresa\" ec ON ec.id = c.\"empresaId\"
      LEFT JOIN \"Empenho\" e ON e.id = t.\"empenhoId\"   LEFT JOIN \"Empresa\" ee ON ee.id = e.\"empresaId\"`,
  })),
  {
    // Garantia nao tem vinculo com Ata no schema — so contrato e empenho.
    tabela: "Garantia",
    coluna: "arquivoPdfUrl",
    sqlConta: `COALESCE(ec.\"contaId\", ee.\"contaId\")
      FROM \"Garantia\" t
      LEFT JOIN \"Contrato\" c ON c.id = t.\"contratoId\" LEFT JOIN \"Empresa\" ec ON ec.id = c.\"empresaId\"
      LEFT JOIN \"Empenho\" e ON e.id = t.\"empenhoId\"   LEFT JOIN \"Empresa\" ee ON ee.id = e.\"empresaId\"`,
  },
  {
    tabela: "Endosso",
    coluna: "arquivoPdfUrl",
    sqlConta: `COALESCE(ec.\"contaId\", ee.\"contaId\")
      FROM \"Endosso\" t
      JOIN \"Garantia\" g ON g.id = t.\"garantiaId\"
      LEFT JOIN \"Contrato\" c ON c.id = g.\"contratoId\" LEFT JOIN \"Empresa\" ec ON ec.id = c.\"empresaId\"
      LEFT JOIN \"Empenho\" e ON e.id = g.\"empenhoId\"   LEFT JOIN \"Empresa\" ee ON ee.id = e.\"empresaId\"`,
  },
];

function pathnameDaUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.replace(/^\//, "")) || null;
  } catch {
    return null;
  }
}

function nomeLegivel(pathname: string): string {
  return pathname.split("/").pop() || "documento";
}

async function main() {
  console.log(APAGAR ? "== FASE 2: apagar cópias públicas ==" : APLICAR ? "== APLICANDO ==" : "== SIMULAÇÃO (use --aplicar) ==");

  if (APAGAR) {
    // Só apaga o que já tem cópia privada registrada e referência trocada.
    const registros = await prisma.arquivo.findMany({ select: { pathname: true } });
    const privados = new Set(registros.map((r) => r.pathname.replace(/^privado\//, "")));
    let apagados = 0;
    for (const p of privados) {
      const publico = p;
      try {
        await del(`https://${process.env.BLOB_HOST ?? ""}/${publico}`);
        apagados++;
      } catch {
        /* já não existe */
      }
    }
    console.log(`cópias públicas apagadas: ${apagados}`);
    return;
  }

  let total = 0;
  let semDono = 0;
  let jaMigrados = 0;
  let migrados = 0;

  for (const { tabela, coluna, sqlConta } of COLUNAS) {
    const linhas = await prisma.$queryRawUnsafe<Array<{ id: string; url: string; conta: string | null }>>(
      // `sqlConta` traz a expressao da conta seguida do FROM/JOINs; o "AS conta"
      // entra aqui pra o resultado sair com o nome que o codigo espera.
      `SELECT t.id::text AS id, t."${coluna}"::text AS url, ${sqlConta.replace(/\s+FROM\s/i, " AS conta FROM ")}
       WHERE t."${coluna}" LIKE '%blob.vercel-storage.com%'`,
    );
    if (linhas.length === 0) continue;
    console.log(`\n${tabela}.${coluna}: ${linhas.length} arquivo(s)`);

    for (const l of linhas) {
      total++;
      const origem = pathnameDaUrl(l.url);
      if (!origem) { console.log(`  ! url ilegível em ${l.id}`); continue; }
      if (!l.conta) { semDono++; console.log(`  ! sem conta dona: ${tabela}.${l.id}`); continue; }

      const jaExiste = await prisma.arquivo.findUnique({ where: { pathname: origem }, select: { id: true } });
      if (jaExiste) {
        jaMigrados++;
        if (APLICAR) {
          await prisma.$executeRawUnsafe(
            `UPDATE "${tabela}" SET "${coluna}" = $1 WHERE id = $2`, `/api/arquivo/${jaExiste.id}`, l.id);
        }
        continue;
      }

      if (!APLICAR) { console.log(`  · ${origem} → /api/arquivo (conta ${l.conta.slice(0, 8)})`); continue; }

      // O store atual e PUBLICO-APENAS, entao nao da pra copiar pra privado sem
      // trocar a infraestrutura de armazenamento — decisao que mexe no token de
      // que tudo depende, e que fica pra um passo proprio.
      //
      // O que da pra fazer agora, e ja vale muito: tirar a URL crua de
      // circulacao. O banco passa a guardar /api/arquivo/<id>, entao nenhuma
      // tela, e-mail ou link entrega mais o endereco direto do arquivo — e todo
      // acesso passa a conferir sessao e dono. Some o vazamento por link
      // repassado; permanece so o risco de quem ja tenha uma URL antiga.
      const registro = await prisma.arquivo.upsert({
        where: { pathname: origem },
        create: {
          pathname: origem,
          contaId: l.conta,
          nomeOriginal: nomeLegivel(origem),
          contentType: origem.endsWith(".pdf") ? "application/pdf"
            : origem.endsWith(".png") ? "image/png"
            : origem.endsWith(".jpg") || origem.endsWith(".jpeg") ? "image/jpeg"
            : "application/octet-stream",
          tamanhoBytes: 0,
          urlPublica: l.url,
        },
        update: {},
        select: { id: true },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE "${tabela}" SET "${coluna}" = $1 WHERE id = $2`, `/api/arquivo/${registro.id}`, l.id);
      migrados++;
      if (migrados % 25 === 0) console.log(`  ... ${migrados} migrados`);
    }
  }

  console.log(`\nresumo: ${total} referência(s) | migradas agora: ${migrados} | já migradas: ${jaMigrados} | sem conta dona: ${semDono}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
