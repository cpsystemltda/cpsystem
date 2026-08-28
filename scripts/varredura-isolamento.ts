/**
 * Varredura de isolamento entre clientes.
 *
 * Regina 28/08: "a checagem de hoje encontrou uma falha real; rodar isso a cada
 * publicação transforma sorte em rotina."
 *
 * O CP System não usa políticas de banco (RLS) — o banco não é acessível pelo
 * navegador, e quem separa um cliente do outro é o filtro por conta em cada
 * consulta. Isso funciona bem, com um risco: basta UMA ação esquecer o filtro
 * pra alguém alcançar documento de outra empresa. Foi exatamente o que
 * aconteceu em `criarProcedimentoAction`.
 *
 * Este script relê o código procurando esse esquecimento. É heurística, não
 * prova: ele aponta candidatos, e cada um precisa de olhada humana. O valor
 * está em a lista ser curta o bastante pra caber numa revisão.
 *
 *   npx tsx scripts/varredura-isolamento.ts
 *
 * Sai com código 1 se achar candidato — dá pra pendurar num passo de CI.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(process.cwd(), "src", "app");

// Ações que rodam sem sessão por definição — login, cadastro, recuperação.
const SEM_SESSAO_ESPERADO = ["auth.ts", "senhaReset.ts"];
// Rotas abertas por definição — formulário público do site e avisos de terceiros.
const ROTAS_ABERTAS_ESPERADAS = [
  "leads-calculadora",
  "webhooks",
  "csp-report",
  // Retorno do OAuth do Google: nao tem sessao ainda, mas confere o `state`
  // contra o cookie antes de qualquer coisa (anti-CSRF). Conferido em 28/08.
  "google/callback",
];

// Pontos ja revisados e considerados legitimos. Ficam listados aqui pra que
// achado NOVO apareca sozinho na saida, em vez de se perder no meio de ruido
// conhecido — a lista so tem valor se for curta e verdadeira.
const EXPLICADOS = [
  // O diretorio de analistas e global de proposito: qualquer empresa pode se
  // vincular a qualquer analista, e a escrita acontece na conta de quem pede.
  "auth.ts :: signupAction",
  "embaixadores.ts :: vincularEmbaixadorAction",
  "vinculoAnalista.ts :: criarVinculoAnalistaAction",
];

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, acc);
    else if (nome.endsWith(".ts")) acc.push(caminho);
  }
  return acc;
}

const achados: string[] = [];

// ── 1. Ações de servidor sem exigência de sessão ────────────────────────────
const acoes = arquivos(join(RAIZ, "actions"));
for (const f of acoes) {
  const txt = readFileSync(f, "utf-8");
  const qtd = (txt.match(/^export async function/gm) || []).length;
  if (qtd === 0) continue;
  if (!/exigirUsuario/.test(txt) && !SEM_SESSAO_ESPERADO.some((n) => f.endsWith(n))) {
    achados.push(`ação sem exigirUsuario: ${f} (${qtd} ação(ões))`);
  }
}

// ── 2. Rotas de API sem sessão nem verificação de origem ────────────────────
for (const f of arquivos(join(RAIZ, "api")).filter((x) => x.endsWith("route.ts"))) {
  const txt = readFileSync(f, "utf-8");
  const protegida = /exigirUsuario|getUsuarioAtual|CRON_SECRET|webhookToken|signature|Client-Token/.test(txt);
  const esperada = ROTAS_ABERTAS_ESPERADAS.some((n) => f.includes(n));
  if (!protegida && !esperada) achados.push(`rota aberta: ${f}`);
}

// ── 3. Id vindo do formulário indo direto pro banco, sem amarrar na conta ───
for (const f of acoes) {
  const txt = readFileSync(f, "utf-8");
  for (const bloco of txt.split(/(?=export async function )/)) {
    const nome = /export async function (\w+)/.exec(bloco)?.[1];
    if (!nome) continue;
    const entradas = new Set(
      [...bloco.matchAll(/const (\w+)\s*=\s*String\(\s*formData\.get/g)].map((m) => m[1]),
    );
    if (entradas.size === 0) continue;

    for (const m of bloco.matchAll(/prisma\.(\w+)\.(findUnique|update|delete)\(\{([\s\S]{0,300}?)\}\)/g)) {
      const corpo = m[3];
      const alvo = /where:\s*\{\s*id:\s*(\w+)\s*[,}]/.exec(corpo)?.[1];
      if (!alvo || !entradas.has(alvo)) continue;
      if (/contaId|conta:|empresa:|empresaId/.test(corpo)) continue;

      const antes = bloco.slice(0, m.index);
      // Super admin enxerga a plataforma inteira — é o papel dele.
      if (/superAdmin/.test(antes)) continue;
      // Já validou o dono antes, em consulta separada?
      const validou = new RegExp(
        `(findFirst|findUnique)\\(\\{[\\s\\S]{0,400}${alvo}[\\s\\S]{0,400}(contaId|conta:|empresa)`,
      ).test(antes);
      // Comparação explícita de conta (o padrão usado em conciliação).
      const comparou = /!==\s*usuario\.contaId|usuario\.contaId\s*!==/.test(antes);
      if (validou || comparou) continue;

      const assinatura = `${f.split("/").pop()} :: ${nome}`;
      if (EXPLICADOS.includes(assinatura)) continue;
      achados.push(`id do formulário sem amarra de conta: ${assinatura} → ${m[1]}.${m[2]}(${alvo})`);
    }
  }
}

if (achados.length === 0) {
  console.log("✅ varredura de isolamento: nada a revisar.");
  process.exit(0);
}
console.log(`⚠️  ${achados.length} ponto(s) para revisão humana:\n`);
for (const a of achados) console.log("  · " + a);
console.log("\nCada item pode ser legítimo — o script aponta, quem decide é gente.");
process.exit(1);
