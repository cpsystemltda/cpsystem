import pg from "pg";
import { readFileSync } from "node:fs";
import "dotenv/config";

async function main() {
  const sql = readFileSync("/tmp/mark-applied.sql", "utf8");
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
  await c.connect();
  await c.query(sql);
  console.log("ok");
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
