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

async function chamarNominatim(endereco: string): Promise<Geocode | null> {
  await aguardarRateLimit();
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", endereco);
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
    // Precisão grosseira: se tem road/house, é "exact"; se só city, "city";
    // se só state, "state". Usado pra mostrar avisos quando o pin é
    // aproximado.
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
    // Network/timeout/parsing — falha silenciosa pra não quebrar dashboard
    return null;
  }
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
  for (const p of pendentes.slice(0, 5)) {
    const geo = await geocodificarOrgao(p.cnpj, p.endereco);
    if (geo) out.set(p.cnpj, geo);
  }

  return out;
}
