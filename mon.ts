import { PrismaClient } from "./src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) });
let ultimoId = "";
for (let i = 0; i < 60; i++) { // monitora 5min
  const c = await p.chamadoSuporte.findFirst({ orderBy: { criadoEm: "desc" }, include: { usuario: { select: { nome: true } }, mensagens: { orderBy: { criadoEm: "asc" } } } });
  if (c && c.id !== ultimoId) {
    ultimoId = c.id;
    console.log(`\n[${new Date().toISOString()}] NOVO CHAMADO: ${c.usuario.nome} — "${c.titulo}" [${c.status}]`);
    console.log(`  Categoria: ${c.categoria}`);
    console.log(`  IA action: ${c.iaAcaoResumo ?? "(nada)"}`);
    for (const m of c.mensagens) console.log(`  [${m.autor}] ${m.conteudo.slice(0, 200)}`);
  }
  await new Promise(r => setTimeout(r, 5000));
}
await p.$disconnect();
