/**
 * Identidade de órgão a partir de texto digitado à mão.
 *
 * Igor, 27/09/2026: *"quando eu vou selecionar por órgão, o DPU aparece 1, 2,
 * 3, 4 — ele está puxando da forma como eu digito a cada execução. Se eu ponho
 * um acento aqui na União, o de baixo não tem, o terceiro ficou 'Defensoria
 * Pública da União - DPU'. Queria ver se tem como identificar, independente de
 * maiúsculo, minúsculo ou acento, que é o mesmo órgão, pra pesquisa ficar mais
 * ajustada."*
 *
 * O nome do órgão é campo livre, preenchido a cada lançamento, e o filtro era
 * montado com `groupBy(["orgaoNome"])` — então cada jeito de digitar virava um
 * órgão diferente na lista, e escolher um escondia os outros. No banco havia 48
 * combinações de nome+CNPJ para cerca de 30 órgãos reais: a Defensoria Pública
 * da União em 3 grafias, o Grupamento de Apoio de Brasília em 3, Águas Lindas
 * em 3.
 *
 * Duas saídas que parecem óbvias e não servem:
 *
 * · **Agrupar pelo CNPJ.** O dado é sujo nos dois sentidos. A Polícia Militar
 *   do DF está gravada com dois CNPJs distintos, e o CNPJ 10284509000167 está
 *   colado em quatro órgãos sem relação nenhuma (PMDF, TST, Fundo de Segurança
 *   e Secretaria de Segurança). Agrupar por CNPJ partiria a PMDF em duas linhas
 *   e juntaria o Tribunal Superior do Trabalho com a Polícia Militar.
 *
 * · **Normalizar na gravação.** Reescreveria o que a pessoa digitou, e o
 *   documento oficial dela às vezes traz exatamente aquela grafia.
 *
 * Por isso o texto bruto continua intacto no banco e a identidade é derivada na
 * leitura: uma chave canônica vinda do nome, com o CNPJ entrando só como
 * testemunha de um parentesco que o nome já sugere — nunca como chave.
 */

/** Palavras de ligação não distinguem dois órgãos. */
const CONECTORES = new Set(["de", "da", "do", "das", "dos", "e", "d"]);

/**
 * As palavras que definem o órgão, sem acento, sem caixa e sem pontuação.
 * Duas grafias com a mesma sequência de palavras são o mesmo órgão.
 */
export function palavrasDoOrgao(nome: string): string[] {
  const limpo = (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  let p = limpo.split(" ").filter((x) => x && !CONECTORES.has(x));

  // "Prefeitura Municipal de X" e "Prefeitura de X" são a mesma prefeitura —
  // prefeitura é municipal por definição, então o qualificador ali não separa
  // nada. A regra é estreita de propósito: em "Fundo Municipal" contra "Fundo
  // Estadual" o qualificador é justamente o que distingue, e ali ela não cai.
  if (p[0] === "prefeitura" && p[1] === "municipal") p = ["prefeitura", ...p.slice(2)];

  // Sigla repetida no fim ("Defensoria Pública da União - DPU") só cai quando é
  // exatamente a inicial das palavras anteriores. Sem esse teste, o "AR" de
  // "SESC - AR" seria descartado sem ser sigla de coisa nenhuma.
  if (p.length > 2) {
    const sigla = p[p.length - 1];
    const iniciais = p.slice(0, -1).map((x) => x[0]).join("");
    if (sigla.length >= 2 && sigla === iniciais) p = p.slice(0, -1);
  }

  return p;
}

/** Chave canônica do órgão — é o que viaja na URL do filtro. */
export function chaveOrgao(nome: string): string {
  return palavrasDoOrgao(nome).join(" ");
}

export type OrgaoAgrupado = {
  /** Vai no `value` da opção e na URL. */
  valor: string;
  /** Grafia exibida na lista. */
  label: string;
  /** Todas as grafias que o filtro tem de aceitar. */
  variantes: string[];
  /** Quantos documentos, somando as grafias. */
  quantidade: number;
};

type Linha = { nome: string; cnpj?: string | null; quantidade?: number };

/**
 * Uma opção por órgão real, com a lista de grafias que ela representa.
 *
 * `cnpj` é opcional: atestados guardam só o nome do emissor, e ali o
 * agrupamento fica por nome — que já resolve caixa, acento e pontuação.
 */
export function agruparOrgaos(linhas: Linha[]): OrgaoAgrupado[] {
  type Grupo = {
    chaves: Set<string>;
    cnpjs: Set<string>;
    /** grafia → quantidade */
    grafias: Map<string, number>;
  };

  const porChave = new Map<string, Grupo>();

  for (const l of linhas) {
    const nome = (l.nome || "").trim();
    if (!nome) continue;
    const chave = chaveOrgao(nome);
    if (!chave) continue;

    let g = porChave.get(chave);
    if (!g) {
      g = { chaves: new Set([chave]), cnpjs: new Set(), grafias: new Map() };
      porChave.set(chave, g);
    }
    const cnpj = (l.cnpj || "").replace(/\D/g, "");
    if (cnpj) g.cnpjs.add(cnpj);
    g.grafias.set(nome, (g.grafias.get(nome) ?? 0) + (l.quantidade ?? 1));
  }

  // Segunda passada: junta grupos cujo parentesco o nome sozinho não fecha.
  // Exige as duas provas ao mesmo tempo — CNPJ em comum **e** um nome contido
  // no outro. É o que separa "Fundação Universidade de Brasília - UNB" x
  // "Universidade de Brasília" (junta, 00038174000143) de "Comando da
  // Aeronáutica" x "Grupamento de Apoio de Brasília" (mesmo CNPJ, nomes sem
  // parentesco: ficam separados, porque são unidades diferentes).
  const grupos = [...new Set(porChave.values())];
  let juntou = true;
  while (juntou) {
    juntou = false;
    for (let i = 0; i < grupos.length && !juntou; i++) {
      for (let j = i + 1; j < grupos.length && !juntou; j++) {
        if (parentes(grupos[i], grupos[j])) {
          absorver(grupos[i], grupos[j]);
          grupos.splice(j, 1);
          juntou = true;
        }
      }
    }
  }

  function parentes(a: Grupo, b: Grupo): boolean {
    const cnpjEmComum = [...a.cnpjs].some((c) => b.cnpjs.has(c));
    if (!cnpjEmComum) return false;
    for (const ca of a.chaves) {
      for (const cb of b.chaves) {
        if (contido(ca, cb) || contido(cb, ca)) return true;
      }
    }
    return false;
  }

  /** "universidade brasilia" está contido em "fundacao universidade brasilia unb". */
  function contido(menor: string, maior: string): boolean {
    const pm = menor.split(" ");
    // Uma palavra genérica solta ("prefeitura") não pode engolir grupo nenhum.
    if (pm.length < 2) return false;
    const pM = new Set(maior.split(" "));
    return pm.every((x) => pM.has(x));
  }

  function absorver(dono: Grupo, outro: Grupo) {
    outro.chaves.forEach((c) => dono.chaves.add(c));
    outro.cnpjs.forEach((c) => dono.cnpjs.add(c));
    outro.grafias.forEach((n, g) => dono.grafias.set(g, (dono.grafias.get(g) ?? 0) + n));
  }

  return grupos
    .map((g) => {
      const variantes = [...g.grafias.keys()];
      return {
        valor: melhorChave(g),
        label: melhorGrafia(g),
        variantes,
        quantidade: [...g.grafias.values()].reduce((s, n) => s + n, 0),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** A chave da sequência de palavras mais usada — a que vai na URL. */
function melhorChave(g: { chaves: Set<string>; grafias: Map<string, number> }): string {
  let melhor = "";
  let maior = -1;
  for (const chave of g.chaves) {
    let soma = 0;
    g.grafias.forEach((n, grafia) => {
      if (chaveOrgao(grafia) === chave) soma += n;
    });
    if (soma > maior) {
      maior = soma;
      melhor = chave;
    }
  }
  return melhor;
}

/**
 * Qual grafia aparece na lista.
 *
 * Caixa e acento decidem apenas entre grafias das **mesmas palavras** — ali é
 * só digitação, e a bem digitada ganha: entre "GRUPAMENTO DE APOIO DE
 * BRASILIA" (13 vezes) e "Grupamento de Apoio de Brasília" (7), mostra a
 * segunda. Quando as palavras em si divergem, quem decide é o uso: "Universidade
 * de Brasília" (13) ganha de "FUNDACAO UNIVERSIDADE DE BRASILIA - UNB" (1).
 *
 * A ordem importa: se acento viesse antes do uso, um acento digitado errado uma
 * única vez apareceria no lugar do nome que a empresa escreve sempre.
 */
function melhorGrafia(g: { chaves: Set<string>; grafias: Map<string, number> }): string {
  const chave = melhorChave(g);
  const candidatas = [...g.grafias.entries()].filter(([grafia]) => chaveOrgao(grafia) === chave);
  const lista = candidatas.length ? candidatas : [...g.grafias.entries()];

  const acentos = (s: string) => (s.normalize("NFD").match(/[̀-ͯ]/g) || []).length;
  const soMaiusculas = (s: string) => s === s.toUpperCase();

  return lista.sort(([ga, na], [gb, nb]) =>
    acentos(gb) - acentos(ga) ||
    Number(soMaiusculas(ga)) - Number(soMaiusculas(gb)) ||
    nb - na ||
    gb.length - ga.length,
  )[0][0];
}

/**
 * As grafias que o filtro tem de aceitar quando a URL traz `chave`.
 *
 * Aceita também o nome cru, e não só a chave: link antigo salvo pelo cliente com
 * `?orgao=Defensoria%20Pública%20da%20União` continua funcionando — e passa a
 * trazer as outras grafias junto, que é o que ele sempre quis dizer.
 *
 * Devolve `[]` quando nada casa, e aí quem chama não deve aplicar filtro algum:
 * filtrar por lista vazia esconderia tudo.
 */
export function variantesDoOrgao(chave: string, grupos: OrgaoAgrupado[]): string[] {
  const alvo = chaveOrgao(chave);
  if (!alvo) return [];
  const g = grupos.find((x) => x.valor === alvo || chaveOrgao(x.label) === alvo);
  if (g) return g.variantes;
  // Chave que não bate com grupo nenhum (documento apagado, por exemplo): ainda
  // vale tentar o texto original, para o filtro não virar silêncio.
  return grupos.find((x) => x.variantes.includes(chave))?.variantes ?? [chave];
}
