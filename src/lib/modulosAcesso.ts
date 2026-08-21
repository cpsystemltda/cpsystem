/**
 * Acesso por módulo — o "limitador de funções" que faltava (Regina 21/08).
 *
 * Veio de um pedido do Léo: ele quer colocar uma colaboradora pra operar o
 * sistema junto com ele, mas sem que ela veja tudo. Importante: no áudio ele
 * pede o OPOSTO de esconder valor de item — ele QUER que ela veja o valor da
 * ata pra parar de ser interrompido ("ela já entra, já olha lá, vê o que que
 * tem, o valor das coisas"). O que precisa ficar fora do alcance é o dinheiro
 * DELE: comissão do analista, conciliação e a assinatura do CP System. Por isso
 * o módulo FINANCEIRO agrupa essas telas, e não os valores dos instrumentos.
 *
 * Como se combina com o perfil, que já existia:
 *   - perfil  (ADMIN / OPERACIONAL / VISUALIZADOR) responde "o que pode FAZER";
 *   - módulo  responde "ONDE pode entrar".
 * Os dois valem juntos: um OPERACIONAL sem o módulo CONTRATOS não cria contrato
 * porque nem chega na tela.
 *
 * Compatibilidade: `acessoRestrito` nasce `false`, então todo usuário que já
 * existia — e todo titular de conta — continua com acesso completo. A restrição
 * só existe pra quem o titular marcar na caixa de opções da tela de Equipe.
 *
 * Este arquivo é importado pela Sidebar (client) e pelas páginas (server), por
 * isso não leva "server-only" e não toca no banco.
 */

export type ChaveModulo =
  | "EMPRESAS"
  | "ATAS"
  | "CONTRATOS"
  | "EXECUCAO"
  | "JURIDICO"
  | "RELATORIOS"
  | "FINANCEIRO";

export type Modulo = {
  chave: ChaveModulo;
  label: string;
  descricao: string;
  /** Prefixos de rota que o módulo cobre. */
  rotas: string[];
};

export const MODULOS: Modulo[] = [
  {
    chave: "EMPRESAS",
    label: "Empresas (CNPJs)",
    descricao: "Cadastro dos CNPJs, endereços e responsáveis.",
    rotas: ["/empresas"],
  },
  {
    chave: "ATAS",
    label: "Atas de Registro de Preços",
    descricao: "Atas, itens, órgãos participantes e saldo por vigência.",
    rotas: ["/atas"],
  },
  {
    chave: "CONTRATOS",
    label: "Contratos",
    descricao: "Contratos, aditivos, apostilamentos, reajustes e garantias.",
    rotas: ["/contratos", "/contratacoes", "/reajustes"],
  },
  {
    chave: "EXECUCAO",
    label: "Fornecimento/Execução",
    descricao: "Empenhos, entregas, notas fiscais e prazos do dia a dia.",
    rotas: ["/execucao", "/operacao"],
  },
  {
    chave: "JURIDICO",
    label: "Consultoria jurídica",
    descricao: "Análise de documentos por IA e pareceres arquivados.",
    rotas: ["/juridico"],
  },
  {
    chave: "RELATORIOS",
    label: "Relatórios",
    descricao: "Relatórios gerenciais e exportações.",
    rotas: ["/relatorios"],
  },
  {
    chave: "FINANCEIRO",
    label: "Financeiro da empresa",
    descricao:
      "Bloco financeiro do dashboard, conciliação bancária, honorários e comissões do analista e a assinatura do CP System. Deixe desmarcado para quem não deve ver o seu dinheiro.",
    rotas: ["/conciliacao", "/honorarios", "/vinculos", "/conta/assinatura", "/conta/checkout"],
  },
];

/** Módulos marcados por padrão ao cadastrar um colaborador: a operação, sem o dinheiro. */
export const MODULOS_PADRAO_COLABORADOR: ChaveModulo[] = [
  "EMPRESAS",
  "ATAS",
  "CONTRATOS",
  "EXECUCAO",
];

const CHAVES = new Set<string>(MODULOS.map((m) => m.chave));

export function ehChaveDeModulo(v: string): v is ChaveModulo {
  return CHAVES.has(v);
}

export function rotuloDoModulo(chave: string): string {
  return MODULOS.find((m) => m.chave === chave)?.label ?? chave;
}

/** Só o que interessa pra decidir acesso — serve tanto o Usuario do Prisma quanto props de client. */
export type AcessoDoUsuario = {
  acessoRestrito: boolean;
  modulosPermitidos: string[];
  superAdmin?: boolean;
};

export function podeAcessarModulo(usuario: AcessoDoUsuario, chave: ChaveModulo): boolean {
  if (usuario.superAdmin) return true;
  if (!usuario.acessoRestrito) return true;
  return usuario.modulosPermitidos.includes(chave);
}

/**
 * Qual módulo cobre esta rota. Casa por prefixo, pra `/contratos/abc123` cair
 * no mesmo módulo de `/contratos`. Rota sem dono (`/dashboard`,
 * `/notificacoes`, `/conta/perfil`, `/termos`) devolve null e fica sempre
 * liberada — são telas da própria pessoa ou a porta de entrada do sistema.
 */
export function moduloDaRota(rota: string): ChaveModulo | null {
  for (const m of MODULOS) {
    for (const r of m.rotas) {
      if (rota === r || rota.startsWith(r + "/")) return m.chave;
    }
  }
  return null;
}

export function podeAcessarRota(usuario: AcessoDoUsuario, rota: string): boolean {
  const chave = moduloDaRota(rota);
  if (!chave) return true;
  return podeAcessarModulo(usuario, chave);
}
