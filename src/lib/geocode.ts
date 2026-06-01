import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Geocodificação de endereços de órgãos públicos via Nominatim (OpenStreetMap).
 *
 * Política de uso do Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
 *   - Rate limit: máximo 1 request/segundo
 *   - User-Agent customizado obrigatório
 *   - Não bombardear; preferir cache
 *
 * Estratégia: cache em OrgaoGeocode por CNPJ. Re-geocodifica quando o
 * endereço cadastrado muda. Geocodificação acontece on-demand quando o
 * dashboard precisa do pin e o cache não tem.
 *
 * Em failover (sem internet, Nominatim fora, etc.), retorna null sem
 * quebrar o dashboard — o pin é omitido pra esse órgão.
 */

type Geocode = {
  latitude: number;
  longitude: number;
  precisao: string | null;
};

const USER_AGENT = "cp-system/1.0 (suporte@cpsystem.com.br)";

// Rate limit: garante mínimo 1100ms entre chamadas consecutivas (folga
// sobre o 1000ms oficial). Quando vários órgãos são geocodificados na
// mesma renderização, ficam serializados.
let ultimaChamada = 0;
async function aguardarRateLimit() {
  const agora = Date.now();
  const passados = agora - ultimaChamada;
  if (passados < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - passados));
  }
  ultimaChamada = Date.now();
}

async function tentarNominatim(query: string): Promise<Geocode | null> {
  await aguardarRateLimit();
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      // 8s de timeout — não pode prender o dashboard
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const r = data[0];
    if (!r.lat || !r.lon) return null;
    let precisao: string | null = null;
    if (r.address?.road || r.address?.house_number) precisao = "exact";
    else if (r.address?.city || r.address?.town) precisao = "city";
    else if (r.address?.state) precisao = "state";
    return {
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      precisao,
    };
  } catch {
    return null;
  }
}

// Heuristicas pra extrair fallback "Cidade-UF" quando o endereco completo
// nao casa no Nominatim. Cobre formatos B2G comuns: "...Brasilia-DF",
// "...Brasília/DF", "...Brasília, DF", "Rua X, São Paulo/SP".
function extrairCidadeUf(endereco: string): string | null {
  const upper = endereco
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  // Padrao "Cidade-UF" ou "Cidade/UF" ou "Cidade, UF"
  const padrao = /([A-Z][A-Z\s]+?)\s*[-/,]\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:\s|$|[\d\-,.])/;
  const m = upper.match(padrao);
  if (m) {
    const cidade = m[1].trim();
    if (cidade.length >= 3) return `${cidade}, ${m[2]}, Brasil`;
  }
  return null;
}

/**
 * Geocodifica um endereco com 3 tentativas em cascata:
 *   1. Endereco completo (precisao "exact" quando o Nominatim acha).
 *   2. Fallback: "Cidade, UF" extraida do endereco (precisao "city").
 *   3. Ultimo recurso: so a UF (precisao "state").
 * Sem isso, enderecos B2G especificos do DF (ex: "SAISo Setor Policial
 * Sul...") batem em null e o orgao nao aparecia no mapa.
 */
async function chamarNominatim(endereco: string): Promise<Geocode | null> {
  const direto = await tentarNominatim(endereco);
  if (direto) return direto;

  const cidadeUf = extrairCidadeUf(endereco);
  if (cidadeUf) {
    const fallback = await tentarNominatim(cidadeUf);
    if (fallback) {
      return { ...fallback, precisao: fallback.precisao ?? "city" };
    }
  }

  // Ultimo recurso: tenta so a UF. Ainda melhor que pin ausente.
  const matchUf = endereco
    .toUpperCase()
    .match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (matchUf) {
    const soUf = await tentarNominatim(`${matchUf[1]}, Brasil`);
    if (soUf) return { ...soUf, precisao: "state" };
  }
  return null;
}

/**
 * Garante que o órgão com `cnpj` (normalizado) tem geocode em cache.
 * Re-geocodifica se o endereço atual difere do cacheado.
 * Retorna o geocode (cacheado ou recém-criado) ou null se Nominatim falhou.
 */
export async function geocodificarOrgao(
  cnpj: string,
  endereco: string,
): Promise<Geocode | null> {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  if (!cnpjLimpo || !endereco?.trim()) return null;

  const cache = await prisma.orgaoGeocode.findUnique({ where: { cnpj: cnpjLimpo } });
  if (cache && cache.endereco === endereco) {
    return {
      latitude: cache.latitude,
      longitude: cache.longitude,
      precisao: cache.precisao,
    };
  }

  const geo = await chamarNominatim(endereco);
  if (!geo) return null;

  await prisma.orgaoGeocode.upsert({
    where: { cnpj: cnpjLimpo },
    create: {
      cnpj: cnpjLimpo,
      endereco,
      latitude: geo.latitude,
      longitude: geo.longitude,
      precisao: geo.precisao,
    },
    update: {
      endereco,
      latitude: geo.latitude,
      longitude: geo.longitude,
      precisao: geo.precisao,
    },
  });

  return geo;
}

/**
 * Geocodifica vários órgãos em batch, respeitando rate limit. Útil pra
 * primeira renderização do dashboard quando há muitos órgãos novos.
 * Retorna mapa cnpj → geocode (omitindo os que falharam).
 *
 * Estratégia de performance: lê tudo do cache primeiro de uma vez,
 * só chama Nominatim para os que faltam.
 */
export async function geocodificarOrgaosEmBatch(
  orgaos: { cnpj: string; endereco: string }[],
): Promise<Map<string, Geocode>> {
  const out = new Map<string, Geocode>();
  if (orgaos.length === 0) return out;

  // Normaliza CNPJs e remove duplicatas (mesmo órgão em várias Atas)
  const normalizado = new Map<string, string>(); // cnpjLimpo → endereco
  for (const o of orgaos) {
    const cnpj = o.cnpj.replace(/\D/g, "");
    if (cnpj && o.endereco && !normalizado.has(cnpj)) {
      normalizado.set(cnpj, o.endereco);
    }
  }

  // 1. Cache hit batch
  const cnpjs = Array.from(normalizado.keys());
  const cached = await prisma.orgaoGeocode.findMany({
    where: { cnpj: { in: cnpjs } },
  });
  const cacheByCnpj = new Map(cached.map((c) => [c.cnpj, c]));

  // 2. Lista de pendentes (sem cache ou cache com endereço diferente)
  const pendentes: { cnpj: string; endereco: string }[] = [];
  for (const [cnpj, endereco] of normalizado) {
    const c = cacheByCnpj.get(cnpj);
    if (c && c.endereco === endereco) {
      out.set(cnpj, {
        latitude: c.latitude,
        longitude: c.longitude,
        precisao: c.precisao,
      });
    } else {
      pendentes.push({ cnpj, endereco });
    }
  }

  // 3. Geocodifica pendentes serialmente (rate limit). Limita a 5 por
  // renderização pra não atrasar o dashboard mais que 5-6s. Os demais
  // ficam pra próximas cargas (já têm cache parcial após cada chamada).
  for (const p of pendentes.slice(0, 10)) {
    const geo = await geocodificarOrgao(p.cnpj, p.endereco);
    if (geo) out.set(p.cnpj, geo);
  }

  return out;
}

/**
 * Geocodifica endereços de entrega (sem CNPJ associado). Cache por
 * endereço normalizado (trim + lowercase) — mesmo endereço em várias
 * Atas/Contratos é geocodificado uma vez só. Reutiliza o mesmo rate
 * limit do Nominatim e o mesmo limite de 5 chamadas por renderização.
 */
function normalizarEnderecoChave(e: string): string {
  return e.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function geocodificarEnderecosEmBatch(
  enderecos: string[],
): Promise<Map<string, Geocode>> {
  const out = new Map<string, Geocode>(); // chave = endereço normalizado
  if (enderecos.length === 0) return out;

  const unicos = new Map<string, string>(); // chave normalizada → endereço original (pra Nominatim)
  for (const raw of enderecos) {
    if (!raw?.trim()) continue;
    const chave = normalizarEnderecoChave(raw);
    if (!unicos.has(chave)) unicos.set(chave, raw);
  }
  if (unicos.size === 0) return out;

  const chaves = Array.from(unicos.keys());
  const cached = await prisma.enderecoGeocode.findMany({
    where: { endereco: { in: chaves } },
  });
  const cacheByChave = new Map(cached.map((c) => [c.endereco, c]));

  const pendentes: { chave: string; endereco: string }[] = [];
  for (const [chave, original] of unicos) {
    const c = cacheByChave.get(chave);
    if (c) {
      out.set(chave, { latitude: c.latitude, longitude: c.longitude, precisao: c.precisao });
    } else {
      pendentes.push({ chave, endereco: original });
    }
  }

  for (const p of pendentes.slice(0, 10)) {
    const geo = await chamarNominatim(p.endereco);
    if (!geo) continue;
    await prisma.enderecoGeocode.upsert({
      where: { endereco: p.chave },
      create: { endereco: p.chave, latitude: geo.latitude, longitude: geo.longitude, precisao: geo.precisao },
      update: { latitude: geo.latitude, longitude: geo.longitude, precisao: geo.precisao },
    });
    out.set(p.chave, geo);
  }

  return out;
}

export { normalizarEnderecoChave };

/**
 * Aplica jitter deterministico (~1.6km de raio) em coords aproximadas
 * (precisao = 'city' ou 'state') pra evitar que multiplos pins caiam
 * EXATAMENTE na mesma coordenada do centroide da cidade — sobrepostos,
 * usuario via 1 so. Determinismo (seed = chave) garante que o mesmo
 * orgao/endereco sempre aparece no mesmo deslocamento, evitando "pulo"
 * entre renderizacoes. Pins 'exact' nao recebem jitter.
 */
export function aplicarJitter(
  lat: number,
  lng: number,
  precisao: string | null,
  seed: string,
): { latitude: number; longitude: number } {
  if (precisao === "exact") return { latitude: lat, longitude: lng };
  // Hash simples (FNV-1a 32-bit) — basta determinismo, nao seguranca.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const r1 = ((h >>> 0) % 10000) / 10000 - 0.5;
  const r2 = (((h * 16807) >>> 0) % 10000) / 10000 - 0.5;
  // ~0.08 graus = ~9km no equador. Garantia que mesmo no mesmo
  // centroide de cidade os pins fiquem visualmente separados (Regina
  // tinha 5 orgaos no DF caindo todos no mesmo ponto; com 0.03 ainda
  // sobrepunham apos o cluster do Leaflet).
  return {
    latitude: lat + r1 * 0.08,
    longitude: lng + r2 * 0.08,
  };
}
