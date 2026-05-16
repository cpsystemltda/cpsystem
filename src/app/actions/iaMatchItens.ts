"use server";

/**
 * IA Matching de itens — recebe itens extraídos de um PDF (contrato/empenho)
 * e itens disponíveis na Ata vinculada; retorna pra cada item extraído o
 * melhor candidato (id) + confidence (0-1) + razão.
 *
 * Estratégia: Claude com prompt estruturado quando ANTHROPIC_API_KEY está
 * configurada; senão, fallback heurístico (similarity textual).
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { exigirUsuario } from "@/lib/auth";

export type ItemExtraido = {
  descricao: string;
  unidade: string;
  quantidade: number;
  marca: string | null;
  valorUnitario: number;
};

export type ItemReferencia = {
  id: string;
  descricao: string;
  unidade: string;
  quantidadeDisponivel: number;
  valorUnitario: number;
};

export type Sugestao = {
  indexExtraido: number;
  ataItemId: string | null;
  confidence: number; // 0-1
  razao: string;
};

export type MatchResult = { ok: true; sugestoes: Sugestao[]; modo: "ia" | "heuristica" } | { ok: false; erro: string };

const SYSTEM_PROMPT = `Você é um analista de contratações públicas. Sua tarefa é matchear itens de um Empenho/Contrato contra os itens disponíveis na Ata de Registro de Preços (ARP) vinculada.

REGRAS:
- Pra cada item extraído, identifique o item da ARP que MELHOR corresponde.
- Critérios (em ordem de peso): descrição similar (essencial), unidade compatível, marca consistente.
- Quantidade NÃO precisa bater — o empenho pode ser parcial em relação à ARP.
- Se nenhum item da ARP corresponde com razoável confiança, retorne ataItemId=null.
- confidence: 0.9-1.0 = match óbvio (mesma descrição); 0.6-0.9 = similar; 0.3-0.6 = parcial; <0.3 = não match.
- razao: 1 frase curta explicando o match (ou ausência dele).

Retorne APENAS o JSON solicitado.`;

export async function matchItensIaAction(
  itensExtraidos: ItemExtraido[],
  itensRef: ItemReferencia[],
): Promise<MatchResult> {
  await exigirUsuario();
  if (itensExtraidos.length === 0 || itensRef.length === 0) {
    return { ok: true, sugestoes: [], modo: "heuristica" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return { ok: true, sugestoes: matchHeuristico(itensExtraidos, itensRef), modo: "heuristica" };
  }

  try {
    const client = new Anthropic({ apiKey });
    const schema = {
      type: "object",
      properties: {
        sugestoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              indexExtraido: { type: "integer" },
              ataItemId: { type: ["string", "null"] },
              confidence: { type: "number" },
              razao: { type: "string" },
            },
            required: ["indexExtraido", "ataItemId", "confidence", "razao"],
            additionalProperties: false,
          },
        },
      },
      required: ["sugestoes"],
      additionalProperties: false,
    };

    const userMsg = `ITENS EXTRAÍDOS (do PDF):
${itensExtraidos
  .map(
    (it, i) =>
      `[${i}] ${it.descricao} | un=${it.unidade} | qtd=${it.quantidade} | marca=${it.marca ?? "—"} | unit=R$ ${it.valorUnitario.toFixed(2)}`,
  )
  .join("\n")}

ITENS DA ARP DISPONÍVEIS:
${itensRef
  .map(
    (it) =>
      `id=${it.id} | ${it.descricao} | un=${it.unidade} | disponível=${it.quantidadeDisponivel} | unit=R$ ${it.valorUnitario.toFixed(2)}`,
  )
  .join("\n")}

Pra cada item extraído (na ordem dos índices acima), retorne o melhor match contra a ARP.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_config: { format: { type: "json_schema", schema } } as any,
      messages: [{ role: "user", content: userMsg }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { ok: true, sugestoes: matchHeuristico(itensExtraidos, itensRef), modo: "heuristica" };
    }
    const parsed = JSON.parse(block.text) as { sugestoes: Sugestao[] };
    // Valida: filtra IDs que não existem na ref
    const idsValidos = new Set(itensRef.map((r) => r.id));
    const sanitizada = parsed.sugestoes.map((s) => ({
      ...s,
      ataItemId: s.ataItemId && idsValidos.has(s.ataItemId) ? s.ataItemId : null,
    }));
    return { ok: true, sugestoes: sanitizada, modo: "ia" };
  } catch (err) {
    console.warn("[matchItensIaAction] IA falhou, usando heurística:", err);
    return { ok: true, sugestoes: matchHeuristico(itensExtraidos, itensRef), modo: "heuristica" };
  }
}

/**
 * Fallback heurístico: similarity Jaccard sobre tokens da descrição,
 * com bônus por unidade igual. Retorna pra cada item extraído o ref de
 * maior score (se >= threshold).
 */
function matchHeuristico(itensExtraidos: ItemExtraido[], itensRef: ItemReferencia[]): Sugestao[] {
  type Melhor = { ref: ItemReferencia; score: number };
  return itensExtraidos.map((it, idx): Sugestao => {
    let melhor: Melhor | null = null;
    for (const ref of itensRef) {
      const score = similaridade(it, ref);
      if (!melhor || score > melhor.score) melhor = { ref, score };
    }
    if (!melhor || melhor.score < 0.3) {
      const fallbackScore: number = melhor ? melhor.score : 0;
      return {
        indexExtraido: idx,
        ataItemId: null,
        confidence: fallbackScore,
        razao: "Sem correspondência clara na ARP.",
      };
    }
    return {
      indexExtraido: idx,
      ataItemId: melhor.ref.id,
      confidence: Math.min(1, melhor.score),
      razao: `Descrição similar (Jaccard ${(melhor.score * 100).toFixed(0)}%)`,
    };
  });
}

function tokenizar(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // remove acentos
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersec = [...a].filter((x) => b.has(x)).length;
  const uniao = new Set([...a, ...b]).size;
  return uniao === 0 ? 0 : intersec / uniao;
}

function similaridade(ext: ItemExtraido, ref: ItemReferencia): number {
  const tokA = tokenizar(ext.descricao);
  const tokB = tokenizar(ref.descricao);
  let score = jaccard(tokA, tokB);
  // Bônus se unidade igual
  if (ext.unidade.trim().toUpperCase() === ref.unidade.trim().toUpperCase()) {
    score += 0.1;
  }
  return Math.min(1, score);
}
