import { prisma } from "@/lib/prisma";
import type { DadosUf } from "@/components/MapaBrasil";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const NOMES_ESTADOS: Record<string, string> = {
  ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA",
  CEARA: "CE", "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", GOIAS: "GO",
  MARANHAO: "MA", "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS",
  "MINAS GERAIS": "MG", PARA: "PA", PARAIBA: "PB", PARANA: "PR",
  PERNAMBUCO: "PE", PIAUI: "PI", "RIO DE JANEIRO": "RJ",
  "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS", RONDONIA: "RO",
  RORAIMA: "RR", "SANTA CATARINA": "SC", "SAO PAULO": "SP", SERGIPE: "SE",
  TOCANTINS: "TO",
};

const FAIXAS_CEP: Array<[number, number, string]> = [
  [1000000, 19999999, "SP"],
  [20000000, 28999999, "RJ"],
  [29000000, 29999999, "ES"],
  [30000000, 39999999, "MG"],
  [40000000, 48999999, "BA"],
  [49000000, 49999999, "SE"],
  [50000000, 56999999, "PE"],
  [57000000, 57999999, "AL"],
  [58000000, 58999999, "PB"],
  [59000000, 59999999, "RN"],
  [60000000, 63999999, "CE"],
  [64000000, 64999999, "PI"],
  [65000000, 65999999, "MA"],
  [66000000, 68899999, "PA"],
  [68900000, 68999999, "AP"],
  [69000000, 69299999, "AM"],
  [69300000, 69399999, "RR"],
  [69400000, 69899999, "AM"],
  [69900000, 69999999, "AC"],
  [70000000, 73699999, "DF"],
  [73700000, 76799999, "GO"],
  [76800000, 76999999, "RO"],
  [77000000, 77999999, "TO"],
  [78000000, 78899999, "MT"],
  [79000000, 79999999, "MS"],
  [80000000, 87999999, "PR"],
  [88000000, 89999999, "SC"],
  [90000000, 99999999, "RS"],
];

export function extrairUf(endereco: string | null | undefined, cep?: string | null): string | null {
  // 1. Tenta extrair " - UF" ou ", UF" ou "UF " no final
  if (endereco) {
    const upper = endereco
      .toUpperCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

    // Padrão "- UF" ou ", UF" ou " UF"
    const m = upper.match(/[\s\-,/]+([A-Z]{2})(\s|$|[\d\-,.])/);
    if (m && UFS.includes(m[1])) return m[1];

    // Nome do estado
    for (const [nome, uf] of Object.entries(NOMES_ESTADOS)) {
      if (upper.includes(nome)) return uf;
    }
  }

  // 2. Fallback via faixa de CEP (Correios)
  if (cep) {
    const n = Number(cep.replace(/\D/g, "").padStart(8, "0"));
    if (!isNaN(n) && n > 0) {
      for (const [min, max, uf] of FAIXAS_CEP) {
        if (n >= min && n <= max) return uf;
      }
    }
  }

  return null;
}

export async function dadosPorUf(contaId: string, empresaIdFiltro?: string): Promise<DadosUf[]> {
  const empresas = await prisma.empresa.findMany({
    where: empresaIdFiltro ? { contaId, id: empresaIdFiltro } : { contaId },
    select: { id: true, endereco: true, cep: true },
  });

  // Mapa empresaId → uf
  const ufPorEmpresa = new Map<string, string>();
  for (const e of empresas) {
    const uf = extrairUf(e.endereco, e.cep);
    if (uf) ufPorEmpresa.set(e.id, uf);
  }

  if (ufPorEmpresa.size === 0) return [];

  const empresaIds = Array.from(ufPorEmpresa.keys());

  const [contratos, empenhos] = await Promise.all([
    prisma.contrato.findMany({
      where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: new Date() } },
      select: { empresaId: true, itens: { select: { valorTotal: true } } },
    }),
    prisma.empenho.findMany({
      where: { empresaId: { in: empresaIds } },
      select: { empresaId: true, itens: { select: { valorTotal: true } } },
    }),
  ]);

  const acc: Record<string, DadosUf> = {};
  function ensure(uf: string): DadosUf {
    if (!acc[uf]) acc[uf] = { uf, empresas: 0, contratos: 0, empenhos: 0, valor: 0 };
    return acc[uf];
  }

  for (const empresaId of empresaIds) {
    const uf = ufPorEmpresa.get(empresaId)!;
    ensure(uf).empresas += 1;
  }

  for (const c of contratos) {
    const uf = ufPorEmpresa.get(c.empresaId);
    if (!uf) continue;
    const total = c.itens.reduce((s, i) => s + i.valorTotal, 0);
    const d = ensure(uf);
    d.contratos += 1;
    d.valor += total;
  }

  for (const e of empenhos) {
    const uf = ufPorEmpresa.get(e.empresaId);
    if (!uf) continue;
    const total = e.itens.reduce((s, i) => s + i.valorTotal, 0);
    const d = ensure(uf);
    d.empenhos += 1;
    d.valor += total;
  }

  return Object.values(acc).sort((a, b) => b.valor - a.valor);
}
