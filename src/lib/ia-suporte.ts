import "server-only";
import { prisma } from "@/lib/prisma";

// IA de suporte (Regina 14/07). Recebe uma mensagem inbound de WA, junto
// com o contexto do remetente (nome, tipo de conta, se tem assinatura, se
// tem cadastro na base) e retorna:
//   - "auto_responder"  -> texto pronto pra enviar
//   - "escalar_admin"   -> mensagem pra Regina + titulo/categoria do chamado
//
// Nao faz alteracao no banco por si so — o chamador decide agir com base
// na acao retornada. Alteracoes futuras (via tools) exigem confirmacao.

const CLAUDE_MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

export type ContextoRemetente = {
  usuarioId: string;
  nome: string;
  email: string;
  telefone: string;
  tipoConta: "EMPRESA" | "ANALISTA";
  isSuperAdmin: boolean;
  statusAssinatura?: string;
  proximoVencimento?: Date | null;
  empresaRazao?: string;
  ultimasMensagens: { autor: string; conteudo: string; criadoEm: Date }[];
};

export type DecisaoIA =
  | {
      acao: "auto_responder";
      resposta: string;
      categoria: string;
      resumo: string;
    }
  | {
      acao: "escalar_admin";
      resposta: string; // resposta educada pro cliente ("recebemos, admin vai retornar")
      motivo: string; // por que a IA nao pode responder
      resumoParaAdmin: string;
      categoria: string;
    };

function systemPrompt(ctx: ContextoRemetente): string {
  const linhasCtx: string[] = [
    `Cliente: ${ctx.nome} (${ctx.email})`,
    `Tipo de conta: ${ctx.tipoConta}${ctx.isSuperAdmin ? " (é SUPER ADMIN da plataforma — Regina/Igor)" : ""}`,
    ctx.empresaRazao ? `Empresa: ${ctx.empresaRazao}` : "",
    ctx.statusAssinatura ? `Status assinatura: ${ctx.statusAssinatura}` : "",
    ctx.proximoVencimento ? `Próximo vencimento: ${ctx.proximoVencimento.toLocaleDateString("pt-BR")}` : "",
  ].filter(Boolean);

  return `Você é o assistente de suporte oficial do CP System — SaaS brasileiro de gestão pós-licitação (Lei 14.133/2021) que atende empresas privadas que vendem pro governo e analistas que indicam clientes.

**Sobre o produto**:
- 3 planos: Básico R$ 397 (1 CNPJ), Intermediário R$ 697 (3 CNPJs + conciliação + IA 10p/mês), Premium R$ 997 (CNPJs ilimitados + IA ilimitada + canal VIP + consultoria especializada anual)
- Trial gratuito 14 dias
- Cobrança automática no cartão via Asaas, dia escolhido pelo cliente (10, 15 ou 20)
- Programa Analista Parceiro: R$ 29,90/mês por cliente ativo indicado, PIX automático dia 20
- Módulos: Atas de Registro de Preços, Contratos, Empenhos/Ordens, Consultoria Jurídica IA (IAsystem), Relatórios
- Site: cpsystem.app.br

**Contexto do cliente que te escreveu**:
${linhasCtx.join("\n")}

**Suas regras**:
1. Tom: **cordial, corporativo, ligeiramente bem-humorado** (não descontraído demais — nada de gírias, emojis em excesso, "é nós", "beleza"). Português brasileiro, direto, sem enrolação. Nome do cliente no cumprimento. Um emoji ocasional é ok (✅ 📊 💳), no máximo 1-2 por mensagem.
2. Se a mensagem é AGRADECIMENTO/CORTESIA ("obrigado", "valeu", "beleza") — responda educadamente e agradeça a mensagem. NÃO escale pro admin.
3. Se é DÚVIDA sobre USO do sistema (onde clico X? como faço Y?) — responda com base no que você sabe do produto. NÃO invente feature que não existe.
4. Se é PEDIDO SIMPLES de ajuste de preferência (mudar dia de vencimento, mudar PIX, opt-out WA) — instrua ele a acessar cpsystem.app.br/conta/perfil que ele mesmo altera com confirmação de senha.
5. Se é RECLAMAÇÃO DE BUG, PEDIDO DE FEATURE NOVA, ALTERAÇÃO DE DADOS OPERACIONAIS (valor de ata, vigência que digitou errado) ou qualquer coisa que exija alteração de código/estrutura — ESCALE PRO ADMIN. Você não age nisso.
6. Se você NÃO ENTENDEU a mensagem, tem dúvida, ou não sabe responder com certeza — ESCALE PRO ADMIN. Melhor perguntar que inventar.
7. NUNCA prometa prazos, valores, features ou descontos que não estejam explicitamente no produto atual.
8. NUNCA invente número de contrato, valor, prazo, telefone, e-mail que não esteja no contexto acima.

**Formato obrigatório da resposta** — JSON puro, sem markdown, sem texto ao redor:
{
  "acao": "auto_responder" OU "escalar_admin",
  "resposta": "texto que vai pro cliente via WhatsApp (curto, cordial)",
  "categoria": "DUVIDA_USO" | "AJUSTE_DADOS" | "CORRECAO_OPERACIONAL" | "BUG_SISTEMA" | "FEATURE_PEDIDO" | "OUTRO",
  "resumo": "1 linha do que o cliente quis (interna)",
  "motivo": "(SÓ SE escalar_admin) — por que precisa admin",
  "resumoParaAdmin": "(SÓ SE escalar_admin) — resumo em 1-2 linhas do que Regina/Igor precisam fazer"
}`;
}

export async function decidirRespostaIA(mensagem: string, ctx: ContextoRemetente): Promise<DecisaoIA> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nao configurado");

  const historicoStr = ctx.ultimasMensagens.length > 0
    ? "\n\nHistórico recente da conversa:\n" + ctx.ultimasMensagens.map((m) => `[${m.autor}] ${m.conteudo}`).join("\n")
    : "";

  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: systemPrompt(ctx),
      messages: [
        {
          role: "user",
          content: `Mensagem recebida do cliente agora:\n"${mensagem}"${historicoStr}\n\nResponda no formato JSON especificado.`,
        },
      ],
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Anthropic ${r.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await r.json()) as {
    content?: { type: string; text?: string }[];
  };
  const texto = data.content?.map((c) => c.text ?? "").join("") ?? "";

  // Extrai JSON — a resposta deveria ser JSON puro mas defende contra markdown
  const jsonMatch = texto.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`IA nao retornou JSON: ${texto.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]);

  if (parsed.acao === "auto_responder") {
    return {
      acao: "auto_responder",
      resposta: String(parsed.resposta || ""),
      categoria: String(parsed.categoria || "OUTRO"),
      resumo: String(parsed.resumo || ""),
    };
  }
  return {
    acao: "escalar_admin",
    resposta: String(parsed.resposta || "Recebemos sua mensagem, um administrador retorna em breve."),
    motivo: String(parsed.motivo || ""),
    resumoParaAdmin: String(parsed.resumoParaAdmin || parsed.resumo || ""),
    categoria: String(parsed.categoria || "OUTRO"),
  };
}

// Recupera as ultimas N mensagens da conversa desse usuario em chamados
// abertos ou recentes. Ajuda a IA a nao esquecer contexto.
export async function historicoDoUsuario(usuarioId: string, limite = 5): Promise<{ autor: string; conteudo: string; criadoEm: Date }[]> {
  const chamadosRecentes = await prisma.chamadoSuporte.findMany({
    where: { usuarioId, status: { in: ["ABERTO", "IA_ANALISANDO", "AGUARDANDO_ADMIN", "IA_RESOLVEU"] } },
    orderBy: { atualizadoEm: "desc" },
    take: 3,
    include: {
      mensagens: { orderBy: { criadoEm: "asc" }, take: limite },
    },
  });
  const all: { autor: string; conteudo: string; criadoEm: Date }[] = [];
  for (const c of chamadosRecentes) {
    for (const m of c.mensagens) all.push({ autor: m.autor, conteudo: m.conteudo, criadoEm: m.criadoEm });
  }
  return all.slice(-limite);
}
