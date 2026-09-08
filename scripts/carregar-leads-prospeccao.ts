/**
 * Carrega no banco os leads de prospecção extraídos do PNCP.
 *
 * Fonte: "CP System - ALVO com telefone e email.csv" (PNCP + Receita).
 * Filtra o que vence nos próximos 30 dias e tira quem não deve receber
 * ligação — multinacional, seguradora, empresa com dezenas de contratos
 * (já tem sistema) e a Negócios Públicos, que é do nosso próprio setor.
 *
 * Idempotente: o CNPJ é único, então rodar duas vezes atualiza em vez de
 * duplicar — e NUNCA sobrescreve situação nem anotações já registradas
 * pela closer.
 */
import "./_env";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const ARQUIVO =
  process.argv[2] ??
  `${process.env.HOME}/Downloads/Planilhas/CP-System-Prospeccao/CP System - ALVO com telefone e email.csv`;

// Regina 08/09: "coloque todos os outros leads que a gente captou pra
// facilitar". Carrega tudo o que foi qualificado; a tela filtra por urgência,
// então a closer continua vendo primeiro o que vence antes.
const DIAS_JANELA = Number(process.argv[3] ?? 365);

/** Não ligar: já têm sistema, não decidem por telefone, ou são do setor. */
const FORA = [
  "NP TECNOLOGIA", "MAPFRE", "AVLA", "AIR LIQUIDE", "DRAGER",
  "CRISTALIA", "ALTERMED", "CIRURGICA UNIAO", "SOMA/PR", "SULTEPA",
];

/** Micro e pequeno porte: quem decide é o dono, e decide na hora. */
function ehAlvoIdeal(porte: string, valorTotal: number): boolean {
  const p = porte.toUpperCase();
  return (p.includes("PEQUENO") || p.includes("MICRO")) && valorTotal >= 200_000;
}

function perfilDe(porte: string, qtd: number, atividade: string): string {
  const p = porte.toUpperCase();
  const tamanho = p.includes("MICRO") ? "Microempresa" : p.includes("PEQUENO") ? "Pequeno porte" : "Médio/grande";
  const ramo = atividade.split(" ").slice(0, 4).join(" ");
  return `${tamanho}${qtd > 1 ? ` · ${qtd} contratos` : ""}${ramo ? ` · ${ramo}` : ""}`;
}

function linhasDoCsv(texto: string): Record<string, string>[] {
  // CSV com campos entre aspas e vírgulas dentro deles (objeto do contrato).
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const cab = linhas[0].map((h) => h.replace(/^﻿/, "").trim());
  return linhas.slice(1).filter((l) => l.some((v) => v.trim()))
    .map((l) => Object.fromEntries(cab.map((h, i) => [h, (l[i] ?? "").trim()])));
}

async function main() {
  const registros = linhasDoCsv(readFileSync(ARQUIVO, "utf8"));
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const limite = new Date(hoje.getTime() + DIAS_JANELA * 86400000);

  let gravados = 0, pulados = 0, fora = 0;

  for (const r of registros) {
    if (!r.vence_em) continue;
    const vence = new Date(`${r.vence_em}T12:00:00`);
    if (vence > limite) continue;
    // Sem telefone nem e-mail não há como abordar — não polui a lista dela.
    if (!(r.telefone_receita || "").trim() && !(r.email || "").trim()) { pulados++; continue; }

    const nome = (r.empresa || "").trim();
    if (FORA.some((f) => nome.toUpperCase().includes(f))) { fora++; continue; }
    const cnpj = (r.cnpj || "").replace(/\D/g, "");
    if (!cnpj || !nome) { pulados++; continue; }

    const valorTotal = Number(r.valor_total || 0);
    const dados = {
      empresa: nome,
      uf: r.uf || "",
      municipio: r.municipio || null,
      telefone: (r.telefone_receita || "").split("/")[0].trim() || null,
      email: r.email || null,
      venceEm: vence,
      valorDoContrato: Number(r.valor_do_contrato_que_vence || 0),
      orgao: r.orgao || null,
      objeto: (r.objeto || "").slice(0, 300) || null,
      valorTotal,
      qtdContratos: Number(r.qtd_contratos || 1),
      porte: r.porte || null,
      perfil: perfilDe(r.porte || "", Number(r.qtd_contratos || 1), r.atividade || ""),
      alvoIdeal: ehAlvoIdeal(r.porte || "", valorTotal),
    };

    // update NÃO toca em situacao/anotacoes: o trabalho da closer é dela.
    await prisma.leadProspeccao.upsert({
      where: { cnpj },
      update: dados,
      create: { cnpj, ...dados },
    });
    gravados++;
  }

  const total = await prisma.leadProspeccao.count();
  console.log(`Gravados/atualizados: ${gravados}`);
  console.log(`Fora da lista (não ligar): ${fora}`);
  console.log(`Sem CNPJ ou nome: ${pulados}`);
  console.log(`Total na base de prospecção: ${total}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
