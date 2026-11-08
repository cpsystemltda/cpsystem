/**
 * LGPD para dados de colaboradores (ESP-007, Igor 07/11/2026). Funções
 * puras — servidor e cliente. O que depende de chave (cifrar CPF, hash,
 * registro de acesso) fica em `lgpdServer.ts`.
 */

export const VERSAO_ADENDO_LGPD = "1.0";
export const VIGENCIA_ADENDO_LGPD = "07/11/2026";

export type PerfilComDados = { perfil: string; superAdmin?: boolean; permissaoDadosColaboradores?: boolean | null; espionando?: boolean };

/**
 * RN04/RN06: quem vê nome, CPF e documentos de colaboradores. ADMIN e RH do
 * contrato sempre; os demais só com a permissão específica. No acesso de
 * suporte (espionagem) o usuário vira VISUALIZADOR sem permissão — e CPF e
 * documentos ficam ocultos, como a RN06 manda.
 */
export function podeVerDadosColaboradores(u: PerfilComDados): boolean {
  if (u.espionando) return false;
  return u.perfil === "ADMIN" || u.perfil === "RH_CONTRATO" || !!u.permissaoDadosColaboradores;
}

/** Quem cadastra e altera colaboradores: ADMIN, RH do contrato ou OPERACIONAL com a permissão. */
export function podeEditarColaboradores(u: PerfilComDados): boolean {
  if (u.espionando) return false;
  return u.perfil === "ADMIN" || u.perfil === "RH_CONTRATO" || (u.perfil === "OPERACIONAL" && !!u.permissaoDadosColaboradores);
}

export const ROTULO_PERFIL_USUARIO: Record<string, string> = {
  ADMIN: "Admin",
  OPERACIONAL: "Operacional",
  VISUALIZADOR: "Visualizador",
  RH_CONTRATO: "RH do contrato",
};

/** RN02: ***.456.789-** — só o miolo aparece em listas e exportações. */
export function mascararCpf(cpf: string | null | undefined): string {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return d ? "***.***.***-**" : "";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function formatarCpf(cpf: string | null | undefined): string {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cpfValido(cpf: string | null | undefined): boolean {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, peso: number) => {
    let s = 0;
    for (const ch of base) s += Number(ch) * peso--;
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

/** RN03: nada de dado de saúde. Aviso fixo nos uploads de documentos do colaborador. */
export const AVISO_SEM_DADOS_DE_SAUDE =
  "Não envie atestados médicos, ASO, laudos ou documentos com diagnóstico ou CID. Registre só datas e situação (ex.: afastamento de 10 a 20/11). Dado de saúde é sensível pela LGPD e este sistema não o guarda.";

const TERMOS_SAUDE = /\b(atestado|aso\b|cid[- ]?\d|laudo|diagn[oó]stico|prontu[aá]rio|exame m[eé]dico|receitu[aá]rio|ocupacional)/i;

/** Heurística pelo nome do arquivo: bloqueia upload que parece documento médico. */
export function pareceDocumentoDeSaude(nomeArquivo: string): boolean {
  return TERMOS_SAUDE.test(nomeArquivo.normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

/** RN07: anos de guarda depois do fim do contrato (padrão 5; entre 1 e 10). */
export function anosRetencaoValidos(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 10;
}
