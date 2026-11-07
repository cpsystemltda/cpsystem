/**
 * Regime legal do contrato (ESP-001, Igor 07/11/2026).
 *
 * Contrato assinado sob a Lei 8.666 continua regido por ela até o fim
 * (Lei 14.133, art. 190). O regime decide o limite ordinário de prorrogação
 * de serviço contínuo, os textos de alerta e o fundamento dos pedidos que as
 * outras ESPs geram. Funções puras: servem no servidor e no cliente.
 */

export const REGIMES_LEGAIS = ["LEI_8666", "LEI_14133", "LEI_13303", "OUTRO"] as const;
export type RegimeLegal = (typeof REGIMES_LEGAIS)[number];

export const ROTULO_REGIME: Record<RegimeLegal, string> = {
  LEI_8666: "Lei 8.666/1993",
  LEI_14133: "Lei 14.133/2021",
  LEI_13303: "Lei 13.303/2016 (estatais)",
  OUTRO: "Outro",
};

export function ehRegimeLegal(s: unknown): s is RegimeLegal {
  return typeof s === "string" && (REGIMES_LEGAIS as readonly string[]).includes(s);
}

/** Dica mostrada quando a IA não acha evidência (RN03). */
export const DICA_REGIME_VAZIO =
  "Contratos assinados até 2023 costumam ser da Lei 8.666; confira o preâmbulo do contrato.";

/**
 * Limite ordinário de vigência de serviço contínuo, em meses, contado do
 * início da 1ª vigência (RN07). `null` = sem regra automática ("Outro").
 */
export function limiteOrdinarioMeses(regime: RegimeLegal | null | undefined): number | null {
  switch (regime) {
    case "LEI_8666":
      return 60; // art. 57, II
    case "LEI_14133":
      return 120; // arts. 106 e 107: até 10 anos
    case "LEI_13303":
      return 60; // art. 71, observado o regulamento da estatal
    default:
      return null;
  }
}

/** Observação que acompanha o limite no detalhe do contrato (RN07). */
export function avisoDoLimite(regime: RegimeLegal | null | undefined): string | null {
  switch (regime) {
    case "LEI_8666":
      return "A Lei 8.666, art. 57, §4º, admite mais 12 meses em caráter excepcional.";
    case "LEI_14133":
      return "Lei 14.133, arts. 106 e 107: serviços contínuos podem chegar a 10 anos.";
    case "LEI_13303":
      return "Lei 13.303, art. 71: até 5 anos, observado o regulamento da estatal.";
    default:
      return null;
  }
}

export function somarMesesData(d: Date, meses: number): Date {
  const r = new Date(d.getTime());
  const dia = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(dia, ultimo));
  return r;
}

/**
 * Prazo máximo de vigência (RN07): início da contagem + limite. O início
 * pode ser editado pelo usuário (contagem interrompida por nova licitação) e
 * o limite também (regulamento estadual/municipal) — por isso os dois
 * parâmetros aceitam override.
 */
export function prazoMaximoVigencia(opts: {
  regime: RegimeLegal | null | undefined;
  inicioPrimeiraVigencia: Date | null | undefined;
  inicioContagemLimite?: Date | null;
  limiteMesesOverride?: number | null;
}): { prazoMaximo: Date; limiteMeses: number; inicioContagem: Date } | null {
  const inicio = opts.inicioContagemLimite ?? opts.inicioPrimeiraVigencia;
  const limite = opts.limiteMesesOverride ?? limiteOrdinarioMeses(opts.regime);
  if (!inicio || !limite) return null;
  return { prazoMaximo: somarMesesData(inicio, limite), limiteMeses: limite, inicioContagem: inicio };
}

/** Meses inteiros entre duas datas (a < b), sem contar fração. */
export function mesesEntre(a: Date, b: Date): number {
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * "Prorrogações restantes estimadas: n" (RN07): quantas prorrogações de 12
 * meses ainda cabem entre o fim da vigência atual e o prazo máximo.
 */
export function prorrogacoesRestantesEstimadas(vigenciaFimAtual: Date, prazoMaximo: Date): number {
  if (vigenciaFimAtual >= prazoMaximo) return 0;
  return Math.floor(mesesEntre(vigenciaFimAtual, prazoMaximo) / 12);
}

/** A prorrogação pedida ultrapassa o limite ordinário? (RN08: alerta, não bloqueio) */
export function prorrogacaoUltrapassaLimite(novaVigenciaFim: Date, prazoMaximo: Date | null): boolean {
  return !!prazoMaximo && novaVigenciaFim > prazoMaximo;
}

export const ALERTA_PRORROGACAO_ALEM_DO_LIMITE =
  "Esta prorrogação ultrapassa o limite ordinário do regime. Confira o fundamento.";

/**
 * Sugestão de regime a partir de texto (preâmbulo, aditivos). É o que a IA
 * faz com o PDF (RN02); aqui serve de segunda opinião barata sobre o texto
 * que já temos (objeto, anotações) e para testes. Devolve o trecho que
 * justificou, para o selo "Sugerido pela IA — confirme".
 */
export function sugerirRegimePorTexto(texto: string | null | undefined): { regime: RegimeLegal; trecho: string } | null {
  if (!texto) return null;
  const regras: { regime: RegimeLegal; re: RegExp }[] = [
    { regime: "LEI_14133", re: /14\.?133/i },
    { regime: "LEI_8666", re: /8\.?666/i },
    { regime: "LEI_13303", re: /13\.?303/i },
    { regime: "LEI_14133", re: /art(?:igo|\.)?\s*10[67]\b/i },
    { regime: "LEI_8666", re: /art(?:igo|\.)?\s*57\b/i },
  ];
  for (const { regime, re } of regras) {
    const m = re.exec(texto);
    if (m) {
      const ini = Math.max(0, m.index - 80);
      const fim = Math.min(texto.length, m.index + m[0].length + 80);
      return { regime, trecho: texto.slice(ini, fim).replace(/\s+/g, " ").trim() };
    }
  }
  return null;
}
