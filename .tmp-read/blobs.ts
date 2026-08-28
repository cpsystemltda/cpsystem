import { list } from "@vercel/blob";
async function main() {
  const r = await list({ limit: 1000 });
  console.log("arquivos no store:", r.blobs.length);
  const total = r.blobs.reduce((s, b) => s + (b.size || 0), 0);
  console.log("tamanho total:", (total/1024/1024).toFixed(1), "MB");
  const porPasta: Record<string, number> = {};
  for (const b of r.blobs) { const p = b.pathname.split("/")[0]; porPasta[p] = (porPasta[p]||0)+1; }
  console.log("por pasta:", JSON.stringify(porPasta));
  console.log("exemplos:", r.blobs.slice(0,3).map(b=>b.pathname).join(", "));
}
main();
