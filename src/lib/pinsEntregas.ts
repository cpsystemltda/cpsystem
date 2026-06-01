import "server-only";
import { prisma } from "@/lib/prisma";
import {
  aplicarJitter,
  geocodificarEnderecosEmBatch,
  normalizarEnderecoChave,
} from "@/lib/geocode";

export type PinEntrega = {
  id: string;             // chave estável (endereço normalizado)
  endereco: string;       // endereço como exibir
  rotulo: string | null;  // rótulo cadastrado (ex.: "Almoxarifado Central")
  latitude: number;
  longitude: number;
  precisao: string | null;
  // Contagem de documentos que entregam aqui (usado em tooltip)
  atas: number;
  contratos: number;
  empenhos: number;
  // Nomes dos órgãos que entregam aqui (até 3, pra tooltip)
  orgaos: string[];
};

/**
 * Coleta todos os endereços de entrega cadastrados em Atas/Contratos/Empenhos
 * vigentes da conta. Agrega por endereço normalizado — se duas Atas usam o
 * mesmo endereço de entrega, vira 1 pin com contagem 2.
 *
 * Endereços vinculados a Ata: vigência ativa.
 * Endereços vinculados a Contrato: vigência ativa.
 * Endereços vinculados a Empenho: incluem todos (independente de status —
 * empenho pago ainda foi entregue ali).
 */
export async function coletarPinsEntregas(
  contaId: string,
  empresaIdFiltro?: string,
): Promise<PinEntrega[]> {
  const empresasDaConta = await prisma.empresa.findMany({
    where: empresaIdFiltro ? { contaId, id: empresaIdFiltro } : { contaId },
    select: { id: true },
  });
  const empresaIds = empresasDaConta.map((e) => e.id);
  if (empresaIds.length === 0) return [];

  const hoje = new Date();

  // Puxa endereços ligados a Atas/Contratos/Empenhos da conta
  const enderecos = await prisma.enderecoEntrega.findMany({
    where: {
      OR: [
        { ata: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hoje } } },
        { contrato: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hoje } } },
        { empenho: { empresaId: { in: empresaIds } } },
      ],
    },
    select: {
      id: true,
      rotulo: true,
      endereco: true,
      ata: { select: { orgaoNome: true } },
      contrato: { select: { orgaoNome: true } },
      empenho: { select: { orgaoNome: true } },
    },
  });

  if (enderecos.length === 0) return [];

  // Agrega por endereço normalizado
  type Agg = {
    chave: string;
    enderecoOriginal: string;
    rotulo: string | null;
    atas: number;
    contratos: number;
    empenhos: number;
    orgaos: Set<string>;
  };
  const agg = new Map<string, Agg>();
  for (const e of enderecos) {
    if (!e.endereco?.trim()) continue;
    const chave = normalizarEnderecoChave(e.endereco);
    let cur = agg.get(chave);
    if (!cur) {
      cur = {
        chave,
        enderecoOriginal: e.endereco,
        rotulo: e.rotulo,
        atas: 0,
        contratos: 0,
        empenhos: 0,
        orgaos: new Set(),
      };
      agg.set(chave, cur);
    }
    if (e.ata) {
      cur.atas += 1;
      cur.orgaos.add(e.ata.orgaoNome);
    } else if (e.contrato) {
      cur.contratos += 1;
      cur.orgaos.add(e.contrato.orgaoNome);
    } else if (e.empenho) {
      cur.empenhos += 1;
      cur.orgaos.add(e.empenho.orgaoNome);
    }
  }

  // Geocodifica
  const enderecosParaGeo = Array.from(agg.values()).map((a) => a.enderecoOriginal);
  const geoMap = await geocodificarEnderecosEmBatch(enderecosParaGeo);

  // Combina. Jitter em coords aproximadas pra nao sobrepor pins.
  const pins: PinEntrega[] = [];
  for (const a of agg.values()) {
    const geo = geoMap.get(a.chave);
    if (!geo) continue;
    const ajust = aplicarJitter(geo.latitude, geo.longitude, geo.precisao, a.chave);
    pins.push({
      id: a.chave,
      endereco: a.enderecoOriginal,
      rotulo: a.rotulo,
      latitude: ajust.latitude,
      longitude: ajust.longitude,
      precisao: geo.precisao,
      atas: a.atas,
      contratos: a.contratos,
      empenhos: a.empenhos,
      orgaos: Array.from(a.orgaos).slice(0, 3),
    });
  }

  return pins.sort(
    (x, y) =>
      y.atas + y.contratos + y.empenhos - (x.atas + x.contratos + x.empenhos),
  );
}
