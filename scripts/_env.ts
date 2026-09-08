/**
 * Carrega .env.local antes de qualquer import que use DATABASE_URL.
 *
 * `next` lê os .env sozinho, mas `tsx` não. Sem isto, script de manutenção
 * roda contra o banco errado — ou contra nenhum.
 *
 * Importe SEMPRE na primeira linha do script, antes do prisma.
 */
import { readFileSync, existsSync } from "node:fs";

for (const arquivo of [".env.local", ".env"]) {
  if (!existsSync(arquivo)) continue;
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
