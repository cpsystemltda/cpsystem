import "server-only";
import { validarCnpj } from "@/lib/cnpj";

/**
 * Consulta de CNPJ na Receita (via BrasilAPI) do lado do servidor.
 *
 * Existe por causa da importacao da carteira do analista (opcao B aprovada pela
 * Regina em 18/08): a planilha dele traz nome, CNPJ e contato, mas `Empresa`
 * exige porte, natureza juridica, endereco, CEP, e-mail, telefone e
 * responsavel. Em vez de fazer o analista digitar isso 40 vezes, o que da pra
 * buscar na Receita vem da Receita — e so o que nem assim aparece e perguntado.
 *
 * O `CampoCnpj` ja faz essa consulta no navegador, mas ali e um CNPJ por vez,
 * num formulario. Aqui e em lote e no servidor, entao a logica de mapeamento
 * (porte, natureza juridica, endereco) vive num lugar testavel.
 *
 * Nada aqui inventa dado: campo ausente na Receita volta null e vira pergunta.
 */

export type EmpresaDaReceita = {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  porte: string | null;
  cnaePrincipal: string | null;
  naturezaJuridica: string | null;
  endereco: string | null;
  complemento: string | null;
  cep: string | null;
  email: string | null;
  telefone: string | null;
  responsavel: string | null;
  /** Situacao cadastral ("ATIVA", "BAIXADA"...) — cliente baixado e sinal de alerta. */
  situacao: string | null;
};

/**
 * Codigo da natureza juridica (tabela Receita/IBGE) -> enum interno do sistema.
 * A tabela oficial tem ~90 entradas; aqui ficam as que aparecem em licitacao.
 * O que nao casa cai em OUTRA (3xx inteiro vira SEM_FINS_LUCRATIVOS).
 */
const NATUREZA_POR_CODIGO: Record<string, string> = {
  "2011": "EMPRESA_PUBLICA", // Empresa Pública
  "2038": "EMPRESA_PUBLICA", // Sociedade de Economia Mista
  "2046": "SA_ABERTA", // Sociedade Anônima Aberta
  "2054": "SA_FECHADA", // Sociedade Anônima Fechada
  "2062": "LTDA", // Sociedade Empresária Limitada (inclui a SLU, que a Receita nao distingue)
  "2135": "EI", // Empresário (Individual)
  "2143": "COOPERATIVA",
  "2232": "SS", // Sociedade Simples Pura
  "2240": "SS", // Sociedade Simples Limitada
  "2259": "SS", // Sociedade Simples em Nome Coletivo
  "2267": "SS", // Sociedade Simples em Comandita Simples
  "2305": "EIRELI", // EIRELI de natureza empresária (extinta em 2021, ainda aparece em base antiga)
  "2313": "EIRELI", // EIRELI de natureza simples
  "2321": "SOC_PROFISSIONAL", // Sociedade Unipessoal de Advocacia
  "2330": "COOPERATIVA", // Cooperativas de Consumo
};

function mapearNatureza(codigo: unknown, descricao: unknown): string | null {
  // A BrasilAPI devolve ora `codigo_natureza_juridica: 2062`, ora so o texto
  // "206-2 - Sociedade Empresária Limitada". Nos dois casos sobram 4 digitos.
  const digitos = String(codigo ?? "").replace(/\D/g, "") || String(descricao ?? "").replace(/\D/g, "");
  if (digitos.length >= 4) {
    const chave = digitos.slice(0, 4);
    if (NATUREZA_POR_CODIGO[chave]) return NATUREZA_POR_CODIGO[chave];
    if (chave.startsWith("3")) return "SEM_FINS_LUCRATIVOS"; // associações e fundações
    return "OUTRA";
  }
  const texto = String(descricao ?? "").toUpperCase();
  if (!texto) return null;
  if (texto.includes("LIMITADA")) return texto.includes("SIMPLES") ? "SS" : "LTDA";
  if (texto.includes("ANÔNIMA") || texto.includes("ANONIMA")) {
    return texto.includes("ABERTA") ? "SA_ABERTA" : "SA_FECHADA";
  }
  if (texto.includes("EMPRESÁRIO") || texto.includes("EMPRESARIO")) return "EI";
  if (texto.includes("COOPERATIVA")) return "COOPERATIVA";
  return "OUTRA";
}

function mapearPorte(dados: Record<string, unknown>): string | null {
  if (dados.opcao_pelo_mei === true) return "MEI";
  const p = `${String(dados.porte ?? "")} ${String(dados.descricao_porte ?? "")}`.toUpperCase();
  if (p.includes("MEI")) return "MEI";
  if (p.includes("MICRO")) return "ME";
  if (p.includes("PEQUENO")) return "EPP";
  if (p.includes("DEMAIS") || p.includes("GRANDE")) return "GRANDE";
  return null;
}

/** Socio administrador quando a Receita expoe o QSA — vira o responsavel da empresa. */
function extrairResponsavel(dados: Record<string, unknown>): string | null {
  const qsa = Array.isArray(dados.qsa) ? (dados.qsa as Record<string, unknown>[]) : [];
  if (qsa.length === 0) return null;
  const admin = qsa.find((s) =>
    String(s.qualificacao_socio ?? "").toUpperCase().includes("ADMINISTRADOR"),
  );
  const escolhido = admin ?? qsa[0];
  const nome = String(escolhido.nome_socio ?? escolhido.nome ?? "").trim();
  return nome || null;
}

function montarEndereco(d: Record<string, unknown>): string | null {
  const partes = [
    [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ").trim(),
    d.numero ? `nº ${d.numero}` : null,
    d.bairro,
    d.municipio && d.uf ? `${d.municipio}/${d.uf}` : d.municipio,
  ]
    .map((p) => (p ? String(p).trim() : ""))
    .filter((p) => p.length > 0);
  return partes.length > 0 ? partes.join(", ") : null;
}

// A BrasilAPI responde 429 pra requisicao sem User-Agent — e o que o fetch do
// Node manda por padrao. Medido em 21/08: sem header, 429 em 100% das
// tentativas; com header, 200. No navegador nunca apareceu porque o navegador
// sempre manda o seu. Identificamos o CP System aqui de proposito, pra quem
// mantem a API saber de quem e o trafego.
const USER_AGENT = "CP System (contato@cpsystem.app.br)";

/** Espera crescente entre tentativas quando a API limita o volume. */
const ESPERA_MS = [0, 2000, 5000];

async function buscar(cnpj: string): Promise<Record<string, unknown> | null> {
  for (let tentativa = 0; tentativa < ESPERA_MS.length; tentativa++) {
    if (ESPERA_MS[tentativa] > 0) {
      await new Promise((res) => setTimeout(res, ESPERA_MS[tentativa]));
    }
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(12_000),
    });
    if (r.ok) return (await r.json()) as Record<string, unknown>;
    // 404 = CNPJ que nao existe na Receita. Insistir nao muda a resposta.
    if (r.status !== 429) return null;
  }
  return null;
}

export async function consultarCnpjNaReceita(cnpjBruto: string): Promise<EmpresaDaReceita | null> {
  const cnpj = cnpjBruto.replace(/\D/g, "");
  if (!validarCnpj(cnpj)) return null;

  let d: Record<string, unknown> | null = null;
  try {
    d = await buscar(cnpj);
  } catch {
    return null; // sem rede / timeout: degrada pra preenchimento manual
  }
  if (!d) return null;

  const razao = String(d.razao_social ?? "").trim();
  const fantasia = String(d.nome_fantasia ?? "").trim();
  const cep = String(d.cep ?? "").replace(/\D/g, "");
  const email = String(d.email ?? "").trim().toLowerCase();
  const telefone = String(d.ddd_telefone_1 ?? "").replace(/\D/g, "");
  const cnae = d.cnae_fiscal_descricao
    ? `${d.cnae_fiscal ?? ""} — ${d.cnae_fiscal_descricao}`.trim()
    : null;

  return {
    razaoSocial: razao || null,
    // MEI: a Receita devolve nome_fantasia = nome da pessoa fisica. Quando e
    // igual a razao social, e ruido — o mesmo cuidado que o CampoCnpj toma.
    nomeFantasia: fantasia && fantasia.toLowerCase() !== razao.toLowerCase() ? fantasia : null,
    porte: mapearPorte(d),
    cnaePrincipal: cnae,
    naturezaJuridica: mapearNatureza(d.codigo_natureza_juridica, d.natureza_juridica),
    endereco: montarEndereco(d),
    complemento: d.complemento ? String(d.complemento).trim() || null : null,
    cep: cep.length === 8 ? cep : null,
    email: email.includes("@") ? email : null,
    telefone: telefone.length >= 10 ? telefone : null,
    responsavel: extrairResponsavel(d),
    situacao: String(d.descricao_situacao_cadastral ?? "").trim() || null,
  };
}

/**
 * Consulta varios CNPJs com paralelismo baixo — a BrasilAPI limita chamadas e
 * uma planilha de 40 clientes derrubaria o limite se disparasse tudo de uma vez.
 */
export async function consultarCnpjsNaReceita(
  cnpjs: string[],
  concorrencia = 2,
): Promise<Record<string, EmpresaDaReceita | null>> {
  const unicos = [...new Set(cnpjs.map((c) => c.replace(/\D/g, "")).filter((c) => c.length === 14))];
  const saida: Record<string, EmpresaDaReceita | null> = {};
  let cursor = 0;

  async function trabalhador() {
    while (cursor < unicos.length) {
      const cnpj = unicos[cursor++];
      saida[cnpj] = await consultarCnpjNaReceita(cnpj);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concorrencia, unicos.length) }, () => trabalhador()),
  );
  return saida;
}


/**
 * Codigo IBGE do municipio a partir do CNPJ.
 *
 * A NFS-e identifica a cidade pelo codigo IBGE, nao pelo nome — e e o campo que
 * mais gera recusa quando digitado a mao. Como a BrasilAPI ja devolve
 * `codigo_municipio_ibge` na consulta de CNPJ, da pra preencher sozinho tanto o
 * municipio do prestador quanto o do orgao tomador.
 */
export async function consultarCodigoMunicipioPorCnpj(cnpjBruto: string): Promise<string | null> {
  const d = await buscar(cnpjBruto.replace(/\D/g, ""));
  const codigo = d?.codigo_municipio_ibge;
  return codigo ? String(codigo) : null;
}

/** Endereco estruturado do CNPJ — o formato que a nota fiscal exige. */
export type EnderecoDaReceita = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  codigoMunicipio: string | null;
};

export async function consultarEnderecoPorCnpj(cnpjBruto: string): Promise<EnderecoDaReceita | null> {
  const d = await buscar(cnpjBruto.replace(/\D/g, ""));
  if (!d) return null;
  const texto = (v: unknown) => {
    const t = String(v ?? "").trim();
    return t || null;
  };
  const cep = String(d.cep ?? "").replace(/\D/g, "");
  return {
    logradouro: texto(
      [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ").trim(),
    ),
    numero: texto(d.numero),
    complemento: texto(d.complemento),
    bairro: texto(d.bairro),
    municipio: texto(d.municipio),
    uf: texto(d.uf),
    cep: cep.length === 8 ? cep : null,
    codigoMunicipio: d.codigo_municipio_ibge ? String(d.codigo_municipio_ibge) : null,
  };
}
