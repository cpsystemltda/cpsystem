import "server-only";
import { prisma } from "@/lib/prisma";
import { aplicarJitter, geocodificarOrgaosEmBatch } from "@/lib/geocode";

export type PinOrgao = {
  cnpj: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  precisao: string | null;
  atas: number;       // quantidade de Atas vigentes
  contratos: number;  // quantidade de Contratos vigentes
  empenhos: number;   // quantidade de Empenhos
  valor: number;      // valor agregado (Atas + Contratos vigentes)
};

/**
 * Coleta todos os órgãos públicos com os quais a conta tem operação,
 * agregados por CNPJ. Inclui geocode (lat/long) buscado do cache ou
 * geocodificado on-demand.
 *
 * Órgãos não geocodificados (Nominatim falhou ou rate limit excedido na
 * renderização atual) NÃO entram no array de pins — voltam na próxima
 * renderização. O fallback visual é o choropleth (que continua existindo
 * em paralelo).
 *
 * CNPJs das próprias empresas da conta são excluídos (defensivo contra
 * erro comum: usuário cadastra empenho com CNPJ da fornecedora no campo
 * do órgão público).
 */
export async function coletarPinsOrgaos(
  contaId: string,
  empresaIdFiltro?: string,
): Promise<PinOrgao[]> {
  const empresasDaConta = await prisma.empresa.findMany({
    where: empresaIdFiltro ? { contaId, id: empresaIdFiltro } : { contaId },
    select: { id: true, cnpj: true },
  });
  const empresaIds = empresasDaConta.map((e) => e.id);
  if (empresaIds.length === 0) return [];

  const cnpjsEmpresas = new Set(
    empresasDaConta.map((e) => e.cnpj.replace(/\D/g, "")).filter(Boolean),
  );

  const hoje = new Date();
  const [atas, contratos, empenhos] = await Promise.all([
    prisma.ata.findMany({
      where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hoje } },
      select: {
        orgaoNome: true,
        orgaoCnpj: true,
        orgaoEndereco: true,
        itens: { select: { valorTotal: true } },
        orgaos: { select: { nome: true, cnpj: true, endereco: true } },
      },
    }),
    prisma.contrato.findMany({
      where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hoje } },
      select: {
        orgaoNome: true,
        orgaoCnpj: true,
        orgaoEndereco: true,
        itens: { select: { valorTotal: true } },
      },
    }),
    prisma.empenho.findMany({
      where: { empresaId: { in: empresaIds } },
      select: {
        orgaoNome: true,
        orgaoCnpj: true,
        orgaoEndereco: true,
      },
    }),
  ]);

  // Agregação por CNPJ. Mantém o primeiro nome/endereço encontrado.
  type Agg = {
    cnpj: string;
    nome: string;
    endereco: string;
    atas: number;
    contratos: number;
    empenhos: number;
    valor: number;
  };
  const agg = new Map<string, Agg>();
  function adicionar(
    cnpjRaw: string | null,
    nome: string,
    endereco: string | null,
    kind: "ata" | "contrato" | "empenho",
    valor: number,
  ) {
    const cnpj = (cnpjRaw ?? "").replace(/\D/g, "");
    if (!cnpj || cnpjsEmpresas.has(cnpj)) return;
    if (!endereco?.trim()) return; // sem endereço não há como geocodificar
    let cur = agg.get(cnpj);
    if (!cur) {
      cur = { cnpj, nome, endereco, atas: 0, contratos: 0, empenhos: 0, valor: 0 };
      agg.set(cnpj, cur);
    }
    if (kind === "ata") cur.atas += 1;
    if (kind === "contrato") cur.contratos += 1;
    if (kind === "empenho") cur.empenhos += 1;
    cur.valor += valor;
  }

  for (const a of atas) {
    const valor = a.itens.reduce((s, i) => s + i.valorTotal, 0);
    adicionar(a.orgaoCnpj, a.orgaoNome, a.orgaoEndereco, "ata", valor);
    for (const op of a.orgaos) {
      // Órgão participante/carona — não soma valor (já contado no gerenciador)
      adicionar(op.cnpj, op.nome, op.endereco, "ata", 0);
    }
  }
  for (const c of contratos) {
    const valor = c.itens.reduce((s, i) => s + i.valorTotal, 0);
    adicionar(c.orgaoCnpj, c.orgaoNome, c.orgaoEndereco, "contrato", valor);
  }
  for (const e of empenhos) {
    adicionar(e.orgaoCnpj, e.orgaoNome, e.orgaoEndereco, "empenho", 0);
  }

  if (agg.size === 0) return [];

  // Geocodifica
  const orgaosParaGeo = Array.from(agg.values()).map((a) => ({
    cnpj: a.cnpj,
    endereco: a.endereco,
  }));
  const geoMap = await geocodificarOrgaosEmBatch(orgaosParaGeo);

  // Combina com pins. Aplica jitter deterministico em pins aproximados
  // (precisao 'city'/'state') pra evitar sobreposicao quando varios orgaos
  // batem no mesmo centroide de cidade.
  const pins: PinOrgao[] = [];
  for (const a of agg.values()) {
    const geo = geoMap.get(a.cnpj);
    if (!geo) continue;
    const ajust = aplicarJitter(geo.latitude, geo.longitude, geo.precisao, a.cnpj);
    pins.push({
      ...a,
      latitude: ajust.latitude,
      longitude: ajust.longitude,
      precisao: geo.precisao,
    });
  }

  return pins.sort((x, y) => y.valor - x.valor);
}
