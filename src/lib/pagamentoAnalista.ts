import "server-only";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";

// Pagamento automático de comissão do analista via PIX (Regina 13/07).
// Regra:
// - Roda dia 20 de cada mês (cron)
// - Referência: MÊS ANTERIOR fechado
// - Só paga comissões com paga=false do mês anterior
// - Se analista sem PIX ou PIX inválido: marca ultimoErroPgto, não bloqueia outras
// - Idempotente por (analistaId, contaId, competencia)

const tiposPix = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"] as const;
export type TipoChavePix = (typeof tiposPix)[number];

// Detecta o tipo de chave PIX (CPF/CNPJ/EMAIL/PHONE/EVP=aleatoria).
export function detectarTipoPix(chave: string): TipoChavePix | null {
  const c = chave.trim();
  const digitos = c.replace(/\D/g, "");
  if (c.includes("@")) return "EMAIL";
  if (digitos.length === 11 && !digitos.startsWith("55")) return "CPF";
  if (digitos.length === 14) return "CNPJ";
  if (digitos.length >= 10 && digitos.length <= 13) return "PHONE";
  // Chave aleatória (EVP) = UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return "EVP";
  return null;
}

// Formata a chave conforme o tipo (Asaas exige formato específico).
function normalizarChavePix(chave: string, tipo: TipoChavePix): string {
  if (tipo === "CPF" || tipo === "CNPJ") return chave.replace(/\D/g, "");
  if (tipo === "PHONE") {
    const d = chave.replace(/\D/g, "");
    return d.startsWith("55") ? `+${d}` : `+55${d}`;
  }
  return chave.trim();
}

// YYYY-MM do mês anterior
function competenciaMesAnterior(hoje: Date): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function pagarComissoesDoMesAnterior(hoje: Date = new Date()): Promise<{
  competenciaPaga: string;
  tentativas: number;
  sucessos: number;
  falhas: number;
  totalPagoBRL: number;
}> {
  const competencia = competenciaMesAnterior(hoje);
  const gateway = await getGateway();
  if (!gateway.transferirPix) {
    return { competenciaPaga: competencia, tentativas: 0, sucessos: 0, falhas: 0, totalPagoBRL: 0 };
  }

  // Busca comissões não pagas do mês anterior + comissões de bônus/pendências antigas
  // Filtro amplo: qualquer competencia <= mês anterior e paga=false.
  const comissoes = await prisma.comissao.findMany({
    where: {
      paga: false,
      competencia: { lte: competencia }, // inclui bonus com sufixo (ex: 2026-07-BONUS-INICIO) — compara alfabeticamente
    },
    include: {
      analista: {
        select: { id: true, nomeCompleto: true, pix: true, ativo: true },
      },
      conta: { select: { id: true } },
    },
  });

  let sucessos = 0;
  let falhas = 0;
  let totalPagoBRL = 0;

  for (const c of comissoes) {
    if (!c.analista.ativo) continue;

    // Sem PIX cadastrado — marca erro e segue
    if (!c.analista.pix || c.analista.pix.trim().length < 4) {
      await prisma.comissao.update({
        where: { id: c.id },
        data: { ultimoErroPgto: "Analista sem chave PIX cadastrada" },
      });
      falhas++;
      continue;
    }

    const tipo = detectarTipoPix(c.analista.pix);
    if (!tipo) {
      await prisma.comissao.update({
        where: { id: c.id },
        data: { ultimoErroPgto: `Chave PIX em formato desconhecido: ${c.analista.pix.slice(0, 30)}` },
      });
      falhas++;
      continue;
    }

    try {
      const chave = normalizarChavePix(c.analista.pix, tipo);
      const tf = await gateway.transferirPix({
        valor: c.valor,
        chavePix: chave,
        tipoChave: tipo,
        descricao: `Comissão ${c.competencia} — CP System`,
        referenciaExterna: `comissao-${c.id}`,
      });
      await prisma.comissao.update({
        where: { id: c.id },
        data: {
          paga: true,
          pagaEm: new Date(),
          transferenciaId: tf.transferId,
          ultimoErroPgto: null,
        },
      });
      sucessos++;
      totalPagoBRL += c.valor;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.comissao.update({
        where: { id: c.id },
        data: { ultimoErroPgto: msg.slice(0, 500) },
      });
      falhas++;
    }
  }

  return {
    competenciaPaga: competencia,
    tentativas: comissoes.length,
    sucessos,
    falhas,
    totalPagoBRL,
  };
}
