import pg from "pg";
import "dotenv/config";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const c = new pg.Client({ connectionString: url });
async function main() {
  await c.connect();
  await c.query("SELECT pg_advisory_unlock_all()");
  await c.query("DELETE FROM \"_prisma_migrations\" WHERE finished_at IS NULL AND rolled_back_at IS NULL");
  console.log("locks + pending rows cleared");
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
