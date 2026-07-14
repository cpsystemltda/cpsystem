import "server-only";
import { prisma } from "@/lib/prisma";

// IA que interpreta mensagens do GRUPO DE SUPORTE (Regina 14/07).
// Admin escreve no grupo em linguagem natural — a IA identifica:
//   - qual chamado a decisao se refere (por #idCurto ou pelo mais recente)
//   - qual acao tomar (aprovar, recusar, responder texto X ao cliente,
//     pedir mais info, adiar, ignorar)
// Retorna nulo se nao entender ou se nao for uma decisao (ex: 2 admins
// discutindo entre si).

const CLAUDE_MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

export type DecisaoAdmin = {
  acao: "responder_cliente" | "resolver" | "recusar" | "pedir_info" | "ignorar" | "nao_entendi";
  chamadoId?: string; // preenchido quando conseguiu identificar
  textoParaCliente?: string; // texto a enviar via WA ao cliente
  motivoInterno?: string; // pro admin — nao vai pro cliente
};

// Extrai idCurto de um cuid. Ex: cmrjyp9r0000004l4mlkamln0 -> #CMRJYP
export function idCurto(cuid: string): string {
  return "#" + cuid.slice(2, 8).toUpperCase();
}

export function extrairIdCurtoDeTexto(texto: string): string | null {
  const m = texto.match(/#([A-Z0-9]{4,8})/i);
  return m ? "#" + m[1].toUpperCase() : null;
}

export async function interpretarMsgAdmin(
  mensagemAdmin: string,
  autorNome: string,
): Promise<DecisaoAdmin> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { acao: "nao_entendi", motivoInterno: "ANTHROPIC_API_KEY faltando" };

  // Contexto: chamados abertos no grupo pra IA saber qual o admin ta falando
  const chamadosAbertos = await prisma.chamadoSuporte.findMany({
    where: { status: { in: ["AGUARDANDO_ADMIN", "EM_IMPLEMENTACAO"] } },
    orderBy: { criadoEm: "desc" },
    take: 10,
    include: { usuario: { select: { nome: true } } },
  });

  if (chamadosAbertos.length === 0) {
    return { acao: "ignorar", motivoInterno: "Nenhum chamado aberto no momento" };
  }

  const contextoChamados = chamadosAbertos
    .map((c) => `${idCurto(c.id)} — ${c.usuario.nome} — "${c.titulo}" — cat: ${c.categoria}`)
    .join("\n");

  const system = `Você é o assistente interno do grupo de suporte da CP System. Um super admin (Regina, Igor ou Contato CP System) acabou de escrever uma mensagem no grupo. Sua função: interpretar se a mensagem contém uma DECISÃO SOBRE UM CHAMADO, e qual.

**Chamados abertos aguardando decisão**:
${contextoChamados}

**Regras**:
1. Se a msg NÃO se refere a nenhum chamado (admins conversando entre si sobre outra coisa) → acao: "ignorar"
2. Se referencia via #IDCURTO → use esse id
3. Se não menciona ID mas só há 1 chamado aberto ou o contexto deixa claro → use o mais provável
4. Se ambíguo → acao: "nao_entendi"
5. Se admin diz coisas como "responde X ao cliente", "manda dizer que Y" → acao: "responder_cliente" + textoParaCliente
6. Se admin diz "resolvido", "pode fechar", "ok, atendemos" → acao: "resolver"
7. Se admin diz "não vamos fazer isso", "recusa", "não" → acao: "recusar"
8. Se admin diz "pergunta pro cliente detalhe X" → acao: "pedir_info" + textoParaCliente com a pergunta

**Formato de resposta** — JSON puro:
{
  "acao": "responder_cliente" | "resolver" | "recusar" | "pedir_info" | "ignorar" | "nao_entendi",
  "chamadoIdCurto": "#XXXXXX" ou null,
  "textoParaCliente": "texto exato pra enviar ao cliente (só se responder_cliente/pedir_info)",
  "motivoInterno": "explicacao curta pro log"
}`;

  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      system,
      messages: [
        { role: "user", content: `Msg do admin ${autorNome} no grupo:\n"${mensagemAdmin}"\n\nInterprete no formato JSON.` },
      ],
    }),
  });
  if (!r.ok) return { acao: "nao_entendi", motivoInterno: `Claude ${r.status}` };
  const data = (await r.json()) as { content?: { text?: string }[] };
  const texto = data.content?.map((c) => c.text ?? "").join("") ?? "";
  const jsonMatch = texto.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { acao: "nao_entendi", motivoInterno: "IA nao retornou JSON" };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const idCurtoStr = parsed.chamadoIdCurto ? String(parsed.chamadoIdCurto).toUpperCase().replace("#", "") : null;
    const chamadoAlvo = idCurtoStr
      ? chamadosAbertos.find((c) => idCurto(c.id).replace("#", "") === idCurtoStr)
      : chamadosAbertos[0];
    return {
      acao: parsed.acao || "nao_entendi",
      chamadoId: chamadoAlvo?.id,
      textoParaCliente: parsed.textoParaCliente,
      motivoInterno: parsed.motivoInterno,
    };
  } catch {
    return { acao: "nao_entendi", motivoInterno: "erro ao parsear JSON" };
  }
}
