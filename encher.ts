import { descobrirLeads } from "./src/lib/leads/descobrir";
import { prisma } from "./src/lib/prisma";

async function main() {
  const t0 = Date.now();
  const hoje = new Date();
  const r = await descobrirLeads({
    publicadosDe: new Date(hoje.getTime() - 90 * 86400000),
    publicadosAte: hoje,
    venceEntreDias: [15, 150],
    valorMinimo: 20000,
    limite: 150,
    maxPaginas: 60,
  });
  console.log(`páginas lidas       : ${r.paginasLidas}`);
  console.log(`contratos vistos    : ${r.contratosVistos.toLocaleString("pt-BR")}`);
  console.log(`empresas candidatas : ${r.empresasCandidatas.toLocaleString("pt-BR")}`);
  console.log(`já conhecíamos      : ${r.jaConheciamos}`);
  console.log(`consultadas Receita : ${r.consultadasNaReceita}`);
  console.log(`sem celular         : ${r.semCelular}`);
  console.log(`fora de atividade   : ${r.foraDeAtividade}`);
  console.log(`GRAVADOS            : ${r.gravados} (alvo ideal: ${r.alvoIdeal})`);
  console.log(`tempo               : ${((Date.now()-t0)/60000).toFixed(1)} min`);
  if (r.detalhes.length) console.log("obs:", r.detalhes);

  const cel = (t: string | null) => { const d=(t||"").replace(/\D/g,""); return d.length===11 && d[2]==="9"; };
  const est = await prisma.leadProspeccao.findMany({ where:{ alvoIdeal:true, situacao:"NAO_CONTATADO", telefone:{not:null} }, select:{telefone:true} });
  const comCel = est.filter(l=>cel(l.telefone)).length;
  console.log(`\nESTOQUE AGORA: ${comCel} leads com celular = ${Math.floor(comCel/10)} dias de prospecção cheia`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALHOU:", e); process.exit(1); });
