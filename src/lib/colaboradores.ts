/**
 * Colaboradores e alocação em postos (ESP-008, Igor 07/11/2026). Funções
 * puras — servidor e cliente. Nada de dado de saúde (ESP-007 RN03).
 */
import { cpfValido, mascararCpf } from "@/lib/lgpd";

export type SituacaoColaborador = "ATIVO" | "AFASTADO" | "DESLIGADO";
export type TipoAlocacao = "TITULAR" | "COBERTURA" | "VOLANTE";

export const SITUACOES: SituacaoColaborador[] = ["ATIVO", "AFASTADO", "DESLIGADO"];
export const ROTULO_SITUACAO: Record<SituacaoColaborador, string> = { ATIVO: "Ativo", AFASTADO: "Afastado", DESLIGADO: "Desligado" };
export const TIPOS_ALOCACAO: TipoAlocacao[] = ["TITULAR", "COBERTURA", "VOLANTE"];
export const ROTULO_TIPO_ALOCACAO: Record<TipoAlocacao, string> = { TITULAR: "Titular", COBERTURA: "Cobertura", VOLANTE: "Volante" };
export const MOTIVOS_FIM = ["DESLIGAMENTO", "TROCA", "CORRECAO", "FIM_COBERTURA", "OUTRO"] as const;
export const ROTULO_MOTIVO_FIM: Record<(typeof MOTIVOS_FIM)[number], string> = {
  DESLIGAMENTO: "Desligamento",
  TROCA: "Troca de posto",
  CORRECAO: "Correção",
  FIM_COBERTURA: "Fim da cobertura",
  OUTRO: "Outro",
};

const DIA_MS = 86_400_000;
export function diaUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Intervalos [ini, fim] inclusivos; fim null = aberto. */
export function periodosSobrepoem(aIni: Date, aFim: Date | null, bIni: Date, bFim: Date | null): boolean {
  const a1 = diaUtc(aIni).getTime();
  const a2 = aFim ? diaUtc(aFim).getTime() : Infinity;
  const b1 = diaUtc(bIni).getTime();
  const b2 = bFim ? diaUtc(bFim).getTime() : Infinity;
  return a1 <= b2 && b1 <= a2;
}

export type AlocacaoBase = {
  id?: string;
  colaboradorId: string;
  contratoId: string;
  contratoItemId: string | null;
  tipo: TipoAlocacao;
  dataInicio: Date;
  dataFim: Date | null;
};

/**
 * RN04: dedicação exclusiva — um colaborador não é titular em dois postos ao
 * mesmo tempo. Cobertura e volante não bloqueiam. Devolve a alocação que
 * conflita, para a mensagem explicar o motivo.
 */
export function conflitoTitular<T extends AlocacaoBase>(existentes: T[], nova: AlocacaoBase): T | null {
  if (nova.tipo !== "TITULAR") return null;
  for (const e of existentes) {
    if (e.id && e.id === nova.id) continue;
    if (e.colaboradorId !== nova.colaboradorId || e.tipo !== "TITULAR") continue;
    if (periodosSobrepoem(e.dataInicio, e.dataFim, nova.dataInicio, nova.dataFim)) return e;
  }
  return null;
}

export function alocacaoVigenteEm(a: { dataInicio: Date; dataFim: Date | null }, dia: Date): boolean {
  const d = diaUtc(dia).getTime();
  return diaUtc(a.dataInicio).getTime() <= d && (a.dataFim == null || diaUtc(a.dataFim).getTime() >= d);
}

export type ItemParaQuadro = { id: string; descricao: string; necessarios: number };
export type LinhaQuadro = ItemParaQuadro & { alocados: number; titulares: number; coberturas: number; descobertos: number; excedentes: number };

/** RN05: por item, colaboradores necessários × alocados na data; falta = "posto descoberto". */
export function quadroDoContrato(itens: ItemParaQuadro[], alocacoes: AlocacaoBase[], dia: Date): { linhas: LinhaQuadro[]; volantes: number; descobertosTotal: number } {
  const vigentes = alocacoes.filter((a) => alocacaoVigenteEm(a, dia));
  const linhas = itens.map((it) => {
    const doItem = vigentes.filter((a) => a.contratoItemId === it.id && a.tipo !== "VOLANTE");
    const titulares = doItem.filter((a) => a.tipo === "TITULAR").length;
    const coberturas = doItem.filter((a) => a.tipo === "COBERTURA").length;
    const alocados = titulares + coberturas;
    return { ...it, alocados, titulares, coberturas, descobertos: Math.max(0, it.necessarios - alocados), excedentes: Math.max(0, alocados - it.necessarios) };
  });
  return { linhas, volantes: vigentes.filter((a) => a.tipo === "VOLANTE").length, descobertosTotal: linhas.reduce((s, l) => s + l.descobertos, 0) };
}

/** RN07: quem ocupava cada posto numa data. */
export function posicaoEmData<T extends AlocacaoBase>(alocacoes: T[], dia: Date): T[] {
  return alocacoes.filter((a) => alocacaoVigenteEm(a, dia));
}

// ─────────────────────────────────────────────
// Importação por planilha (RN02)
// ─────────────────────────────────────────────

export const COLUNAS_MODELO = ["Nome", "CPF", "Data de admissão", "Função", "CBO", "Jornada/escala", "Telefone", "Situação", "Data de desligamento"] as const;

export type LinhaImportada = {
  nome: string;
  cpf: string; // só dígitos
  dataAdmissao: Date;
  funcao: string;
  cbo: string | null;
  jornada: string | null;
  telefone: string | null;
  situacao: SituacaoColaborador;
  dataDesligamento: Date | null;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Mapeia cabeçalhos livres para as colunas do modelo (tolerante a variações). */
export function mapearCabecalho(cabecalho: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  cabecalho.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    if (/^nome/.test(n) && idx.nome == null) idx.nome = i;
    else if (/cpf/.test(n) && idx.cpf == null) idx.cpf = i;
    else if (/admiss/.test(n) && idx.dataAdmissao == null) idx.dataAdmissao = i;
    else if (/deslig|demiss|rescis/.test(n) && idx.dataDesligamento == null) idx.dataDesligamento = i;
    else if (/funcao|cargo|posto/.test(n) && idx.funcao == null) idx.funcao = i;
    else if (/cbo/.test(n) && idx.cbo == null) idx.cbo = i;
    else if (/jornada|escala|horario/.test(n) && idx.jornada == null) idx.jornada = i;
    else if (/telefone|celular|whats/.test(n) && idx.telefone == null) idx.telefone = i;
    else if (/situacao|status/.test(n) && idx.situacao == null) idx.situacao = i;
  });
  return idx;
}

/** dd/mm/aaaa, aaaa-mm-dd, dd-mm-aaaa ou serial do Excel. */
export function parseDataFlex(v: string | number | null | undefined): Date | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null;
    const ms = Math.round((v - 25569) * DIA_MS);
    const d = new Date(ms);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(ano, Number(m[2]) - 1, Number(m[1]), 12));
    return d.getUTCMonth() === Number(m[2]) - 1 ? d : null;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return null;
}

export function validarLinha(cols: Record<string, number>, linha: (string | number)[]): { ok: true; dados: LinhaImportada } | { ok: false; erro: string } {
  const get = (k: string) => (cols[k] == null ? "" : String(linha[cols[k]] ?? "").trim());
  const getRaw = (k: string) => (cols[k] == null ? "" : linha[cols[k]]);
  const nome = get("nome");
  if (!nome) return { ok: false, erro: "nome em branco" };
  const cpf = get("cpf").replace(/\D/g, "");
  if (!cpfValido(cpf)) return { ok: false, erro: `CPF inválido (${get("cpf") || "vazio"})` };
  const dataAdmissao = parseDataFlex(getRaw("dataAdmissao") as string | number);
  if (!dataAdmissao) return { ok: false, erro: `data de admissão inválida (${get("dataAdmissao") || "vazia"})` };
  const funcao = get("funcao");
  if (!funcao) return { ok: false, erro: "função em branco" };
  const sitTxt = norm(get("situacao"));
  const situacao: SituacaoColaborador = /deslig|demit/.test(sitTxt) ? "DESLIGADO" : /afast|licen/.test(sitTxt) ? "AFASTADO" : "ATIVO";
  const dataDesligamento = parseDataFlex(getRaw("dataDesligamento") as string | number);
  if (situacao === "DESLIGADO" && !dataDesligamento) return { ok: false, erro: "desligado sem data de desligamento" };
  return {
    ok: true,
    dados: { nome, cpf, dataAdmissao, funcao, cbo: get("cbo") || null, jornada: get("jornada") || null, telefone: get("telefone") || null, situacao, dataDesligamento: situacao === "DESLIGADO" ? dataDesligamento : null },
  };
}

export type ResultadoValidacao = { aceitas: (LinhaImportada & { linha: number })[]; rejeitadas: { linha: number; motivo: string; trecho: string }[] };

/** Valida a grade inteira: cabeçalho na 1ª linha; duplicidade de CPF dentro do arquivo é rejeitada. */
export function validarGrade(grade: (string | number)[][]): ResultadoValidacao {
  const aceitas: ResultadoValidacao["aceitas"] = [];
  const rejeitadas: ResultadoValidacao["rejeitadas"] = [];
  if (grade.length < 2) return { aceitas, rejeitadas };
  const cols = mapearCabecalho(grade[0].map(String));
  if (cols.nome == null || cols.cpf == null) {
    rejeitadas.push({ linha: 1, motivo: "cabeçalho sem as colunas Nome e CPF — use o modelo do sistema", trecho: grade[0].join(" | ").slice(0, 80) });
    return { aceitas, rejeitadas };
  }
  const vistos = new Map<string, number>();
  grade.slice(1).forEach((linha, i) => {
    const n = i + 2;
    const r = validarLinha(cols, linha);
    if (!r.ok) {
      rejeitadas.push({ linha: n, motivo: r.erro, trecho: linha.join(" | ").slice(0, 80) });
      return;
    }
    const antes = vistos.get(r.dados.cpf);
    if (antes != null && r.dados.situacao !== "DESLIGADO") {
      rejeitadas.push({ linha: n, motivo: `CPF repetido no arquivo (linha ${antes})`, trecho: linha.join(" | ").slice(0, 80) });
      return;
    }
    vistos.set(r.dados.cpf, n);
    aceitas.push({ ...r.dados, linha: n });
  });
  return { aceitas, rejeitadas };
}

export { mascararCpf };

/**
 * Posto versionado por aditivo (ESP-002 RN07): a alocação feita no item
 * anterior continua valendo para a versão nova. Devolve, para cada id de
 * item (antigo ou atual), o id do item vigente da mesma cadeia.
 */
export function mapaParaItemVigente(todos: { id: string; substituiItemId: string | null }[], vigentes: { id: string }[]): Map<string, string> {
  const porId = new Map(todos.map((i) => [i.id, i]));
  const mapa = new Map<string, string>();
  for (const v of vigentes) {
    let atual: { id: string; substituiItemId: string | null } | undefined = porId.get(v.id);
    for (let k = 0; k < 10 && atual; k++) {
      if (!mapa.has(atual.id)) mapa.set(atual.id, v.id);
      atual = atual.substituiItemId ? porId.get(atual.substituiItemId) : undefined;
    }
  }
  return mapa;
}
