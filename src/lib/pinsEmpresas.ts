import "server-only";
import { prisma } from "@/lib/prisma";
import {
  geocodificarEnderecosEmBatch,
  normalizarEnderecoChave,
} from "@/lib/geocode";

export type PinEmpresa = {
  id: string; // empresaId
  cnpj: string;
  nome: string; // razao social (ou fantasia quando distinto)
  endereco: string;
  latitude: number;
  longitude: number;
  precisao: string | null;
};

/**
 * Coleta as sedes das EMPRESAS (fornecedora) da conta — diferente de
 * pinsOrgaos (sedes dos orgaos publicos atendidos) e pinsEntregas
 * (locais de entrega). Geocodifica `endereco` de cada Empresa.
 * Cadastrada pra Regina (31/05): no mapa, deixar claro a quantidade
 * de empresas da propria conta, alem dos orgaos.
 */
export async function coletarPinsEmpresas(
  contaId: string,
  empresaIdFiltro?: string,
): Promise<PinEmpresa[]> {
  const empresas = await prisma.empresa.findMany({
    where: empresaIdFiltro ? { contaId, id: empresaIdFiltro } : { contaId },
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      endereco: true,
    },
  });
  if (empresas.length === 0) return [];

  const enderecos = empresas.map((e) => e.endereco).filter(Boolean) as string[];
  const geoMap = await geocodificarEnderecosEmBatch(enderecos);

  const pins: PinEmpresa[] = [];
  for (const e of empresas) {
    if (!e.endereco?.trim()) continue;
    const chave = normalizarEnderecoChave(e.endereco);
    const geo = geoMap.get(chave);
    if (!geo) continue;
    const nome =
      e.nomeFantasia && e.nomeFantasia.trim() !== e.razaoSocial.trim()
        ? `${e.razaoSocial} (${e.nomeFantasia})`
        : e.razaoSocial;
    pins.push({
      id: e.id,
      cnpj: e.cnpj,
      nome,
      endereco: e.endereco,
      latitude: geo.latitude,
      longitude: geo.longitude,
      precisao: geo.precisao,
    });
  }
  return pins;
}
