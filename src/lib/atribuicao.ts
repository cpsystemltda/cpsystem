/**
 * Atribuicao de marketing — de onde veio quem se cadastrou (Regina 10/08).
 *
 * O Google poe `?gclid=...` na URL de quem chega por anuncio. Esse valor e a
 * unica ponte entre "clique que a gente pagou" e "assinatura que entrou": sem
 * guardar ele, a campanha so consegue medir visita, nunca receita.
 *
 * Como a pessoa costuma cair na home e so depois ir pro /signup, o valor nao
 * pode ficar so na querystring — ele e gravado num cookie de 90 dias (mesma
 * janela de conversao configurada no Google Ads) e lido de volta no cadastro.
 */

export const COOKIE_ATRIBUICAO = "cp_atrib";
export const DIAS_ATRIBUICAO = 90;

export type Atribuicao = {
  gclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
};

const CAMPOS: Array<[keyof Atribuicao, string]> = [
  ["gclid", "gclid"],
  ["utmSource", "utm_source"],
  ["utmMedium", "utm_medium"],
  ["utmCampaign", "utm_campaign"],
  ["utmTerm", "utm_term"],
];

/** Le os parametros de atribuicao de uma querystring. */
export function lerAtribuicaoDaUrl(search: string): Atribuicao {
  const params = new URLSearchParams(search);
  const out: Atribuicao = {};
  for (const [chave, param] of CAMPOS) {
    const v = params.get(param);
    if (v) out[chave] = v.slice(0, 255);
  }
  // O Google tambem usa `wbraid`/`gbraid` quando o usuario esta em contexto
  // sem cookies de terceiros (iOS). Servem pro mesmo fim, entao entram no
  // mesmo campo — o upload offline aceita os tres.
  if (!out.gclid) {
    const alt = params.get("wbraid") || params.get("gbraid");
    if (alt) out.gclid = alt.slice(0, 255);
  }
  return out;
}

export function serializar(a: Atribuicao): string {
  return JSON.stringify(a);
}

export function desserializar(raw: string | undefined | null): Atribuicao {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    const out: Atribuicao = {};
    for (const [chave] of CAMPOS) {
      const v = (obj as Record<string, unknown>)[chave];
      if (typeof v === "string" && v) out[chave] = v.slice(0, 255);
    }
    return out;
  } catch {
    return {};
  }
}

export function temAlgo(a: Atribuicao): boolean {
  return CAMPOS.some(([chave]) => Boolean(a[chave]));
}
