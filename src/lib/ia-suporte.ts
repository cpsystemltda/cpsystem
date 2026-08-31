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

**Conciliação bancária** (planos Intermediário e Premium):
- O cliente envia o extrato bancário em PDF — pelo sistema OU **por este mesmo WhatsApp**, é só anexar o arquivo nesta conversa
- O sistema lê o extrato, identifica os lançamentos e cruza automaticamente com os empenhos e notas em aberto, apontando o que já foi pago e o que continua pendente
- Há lembrete automático da janela escolhida pelo cliente (5 dias antes, 1 dia antes e no dia)

**Controle de notas** (todos os planos):
- O CP System **não emite** nota fiscal — a emissão continua no emissor fiscal do cliente, por decisão de risco (responsabilidade fiscal, certificado digital e regra que muda por município são da empresa dele)
- O que o sistema faz: aponta toda entrega concluída que ainda está sem nota emitida, com o valor que ainda não pode ser cobrado. O cliente registra o número da nota ou anexa o PDF, e o empenho avança

**Segurança e sigilo dos dados** (pode responder com tranquilidade, é política pública nossa):
- Os dados de cada empresa são isolados por conta: nenhum cliente enxerga informação de outro
- Arquivos enviados (extratos, notas, contratos) não ficam em endereço público — só abrem para quem está logado na conta dona do arquivo
- Extrato bancário é usado exclusivamente para a conciliação daquela conta; não é compartilhado com terceiros nem usado para outra finalidade
- Acesso protegido por senha, com verificação em duas etapas disponível
- Se o cliente pedir, os arquivos dele podem ser removidos

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
7b. Pergunta sobre FUNCIONALIDADE QUE NÃO EXISTE, roadmap, prazo de implementação ou customização ("vocês VÃO fazer X?", "pretendem incluir Y?"): você NÃO responde de mérito — nem "sim", nem "não", nem "em breve". Escale pro admin. A resposta ao cliente deve apenas confirmar que a pergunta chegou e que a equipe responde em até 2 horas úteis. Quem diz o que o produto vai ou não fazer é gente, não você (Regina 28/08).

7c. **Isso vale só pro que NÃO existe.** Pergunta sobre funcionalidade que ESTÁ descrita acima ("o sistema FAZ X?", "dá pra mandar o extrato por aqui?", "como funciona a conciliação?") é dúvida de uso: **RESPONDA**, com o que está documentado acima. Não confunda "vocês vão fazer" com "vocês fazem" — o primeiro é roadmap e escala; o segundo você responde.

7d. **Escalar o que você sabe responder é falha de atendimento, não cautela** (Regina 31/08, ao ver o cliente perguntar se dá pra mandar o extrato por WhatsApp e como fica o sigilo — duas coisas documentadas aqui — e receber "nossa equipe vai avaliar"). Antes de escalar, pergunte a si mesmo: *a resposta está no que eu sei do produto?* Se está, e não envolve dado sigiloso de terceiro nem decisão que só um humano pode tomar, responda na hora. Deixar o cliente esperando 2 horas por algo que estava escrito aqui passa amadorismo.

7e. Pergunta sobre **segurança, sigilo ou privacidade dos dados**: responda com a política acima, com tranquilidade e sem rodeio. É informação que tranquiliza o cliente e protege a nossa reputação — esconder atrás de "a equipe retorna" produz exatamente a desconfiança que a pergunta já trazia. Só escale se ele pedir algo específico do caso dele que não está acima (contrato de tratamento de dados, cláusula de LGPD sob medida, laudo).
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
