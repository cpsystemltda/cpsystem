import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Descoberta de leads — empresas com contrato público vencendo.
 *
 * Regina, 05/10/2026: *"vamos descobrir mais empresas para prospectar."* A
 * lista importada acabou: 462 leads, e no dia em que ela pediu restavam zero
 * celulares no perfil ideal. A prospecção ia parar na terça por falta de
 * gente, não por defeito.
 *
 * **De onde vêm.** Duas fontes públicas, nenhuma com chave:
 *
 * · **PNCP** (`pncp.gov.br/api/consulta`) — o registro oficial de contratações
 *   da Lei 14.133. Cobre União, estados E municípios, que é muito mais do que
 *   o Portal da Transparência federal alcança: 175 mil contratos só em
 *   setembro de 2026. Dá CNPJ do fornecedor, órgão, objeto, valor e — o que
 *   importa para a abordagem — `dataVigenciaFim`.
 * · **BrasilAPI** (`brasilapi.com.br/api/cnpj/v1`) — completa o que o PNCP não
 *   traz: telefone, porte, município e situação cadastral.
 *
 * **Por que o vencimento é o gancho.** A conversa que funciona não é "conheça
 * nosso sistema", é "o contrato de vocês com o órgão X vence em 40 dias —
 * vocês já pediram o atestado de capacidade técnica?". Por isso a janela de
 * busca é de contratos que ESTÃO para vencer, e não de qualquer fornecedor.
 *
 * **O que não entra.** Pessoa física, empresa fora de atividade, telefone fixo
 * (não tem WhatsApp, e 19% da lista antiga era isso), e CNPJ que já está na
 * base — recontatar quem já foi abordado queima o número e a reputação.
 */

const PNCP = "https://pncp.gov.br/api/consulta/v1/contratos";
const BRASILAPI = "https://brasilapi.com.br/api/cnpj/v1";
const CABECALHOS = { "User-Agent": "CP System (contato@cpsystem.app.br)", Accept: "application/json" };

/** Teto da API do PNCP. */
const POR_PAGINA = 500;

/**
 * Espera entre consultas de CNPJ.
 *
 * A BrasilAPI é gratuita e tem limite por minuto. Ir devagar é o que mantém o
 * acesso — uma rajada derruba a chave de todo mundo que usa o serviço.
 */
const PAUSA_ENTRE_CNPJ_MS = 350;

/**
 * Espera entre páginas do PNCP.
 *
 * Sem pausa, a oitava página volta 429. Páginas de 500 em 500 são pesadas para
 * o servidor deles, e a rodada não tem pressa — roda de madrugada.
 */
const PAUSA_ENTRE_PAGINAS_MS = 1200;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * O celular, no formato de hoje, a partir do que a Receita guarda.
 *
 * A Receita Federal guarda telefone no formato **antigo, de oito dígitos** —
 * de antes da migração nacional de 2016, que acrescentou o nono dígito aos
 * celulares. A HMD, por exemplo, está lá como `6193270211`: DDD 61 e
 * `9327-0211`, que hoje é `99327-0211`.
 *
 * Por isso a primeira versão desta função devolveu zero celular em 189
 * empresas — ela exigia os onze dígitos que o cadastro não tem.
 *
 * A conversão não é palpite: na migração, todo celular `XXXX-XXXX` virou
 * `9XXXX-XXXX`, e os prefixos 6, 7, 8 e 9 eram justamente os de celular. Fixo
 * começava em 2, 3, 4 ou 5 e continua com oito dígitos.
 *
 * O que sobra de incerteza é a idade do cadastro: empresa que trocou de número
 * depois de se registrar não é alcançada. Isso a ponte resolve na entrega —
 * número sem conta no WhatsApp volta como falha e o lead não é recontatado.
 */
function celularDeHoje(tel: string): string | null {
  const d = (tel || "").replace(/\D/g, "");
  if (/^0+$/.test(d)) return null; // "000000000000" aparece no cadastro

  // Já no formato novo.
  if (d.length === 11 && d[2] === "9") return d;

  // Formato antigo: DDD + 8 dígitos, com prefixo de celular.
  if (d.length === 10 && /[6-9]/.test(d[2])) return `${d.slice(0, 2)}9${d.slice(2)}`;

  return null;
}

/**
 * Micro e pequena empresa — quem o dono atende.
 *
 * É o critério que a lista antiga já usava em `alvoIdeal`, e a razão é de
 * vendas: em empresa média ou grande, quem decide não está no WhatsApp que
 * atende a um número desconhecido.
 */
function ehAlvoIdeal(porte: string | null | undefined): boolean {
  const p = (porte || "").toUpperCase();
  return p.includes("MICRO") || p.includes("PEQUEN") || p === "ME" || p === "EPP";
}

type ContratoPncp = {
  niFornecedor?: string;
  nomeRazaoSocialFornecedor?: string;
  tipoPessoa?: string;
  objetoContrato?: string;
  valorGlobal?: number;
  dataVigenciaFim?: string;
  orgaoEntidade?: { razaoSocial?: string };
  unidadeOrgao?: { ufSigla?: string; municipioNome?: string };
};

export type ResumoDescoberta = {
  paginasLidas: number;
  contratosVistos: number;
  empresasCandidatas: number;
  jaConheciamos: number;
  consultadasNaReceita: number;
  semCelular: number;
  foraDeAtividade: number;
  gravados: number;
  alvoIdeal: number;
  detalhes: string[];
};

export type OpcoesDescoberta = {
  /** Janela de publicação no PNCP que será varrida. */
  publicadosDe: Date;
  publicadosAte: Date;
  /** Só contratos vencendo entre hoje+min e hoje+max dias. */
  venceEntreDias?: [number, number];
  /** Ignora contrato pequeno demais para valer a conversa. */
  valorMinimo?: number;
  /** Teto de CNPJs novos gravados nesta rodada. */
  limite?: number;
  /** Teto de páginas do PNCP, para a rodada não ficar horas no ar. */
  maxPaginas?: number;
};

const aaaammdd = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).replace(/-/g, "");

export async function descobrirLeads(o: OpcoesDescoberta): Promise<ResumoDescoberta> {
  const r: ResumoDescoberta = {
    paginasLidas: 0, contratosVistos: 0, empresasCandidatas: 0, jaConheciamos: 0,
    consultadasNaReceita: 0, semCelular: 0, foraDeAtividade: 0, gravados: 0,
    alvoIdeal: 0, detalhes: [],
  };

  const [minDias, maxDias] = o.venceEntreDias ?? [15, 120];
  const valorMinimo = o.valorMinimo ?? 20_000;
  const limite = o.limite ?? 200;
  const maxPaginas = o.maxPaginas ?? 40;

  const hoje = new Date();
  const venceDe = new Date(hoje.getTime() + minDias * 86400_000);
  const venceAte = new Date(hoje.getTime() + maxDias * 86400_000);

  /** CNPJ → o melhor contrato dele e os totais. */
  type Candidata = {
    cnpj: string; empresa: string; orgao: string | null; objeto: string | null;
    uf: string | null; municipio: string | null;
    venceEm: Date; valorDoContrato: number; valorTotal: number; qtdContratos: number;
  };
  const candidatas = new Map<string, Candidata>();

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const url =
      `${PNCP}?dataInicial=${aaaammdd(o.publicadosDe)}&dataFinal=${aaaammdd(o.publicadosAte)}` +
      `&pagina=${pagina}&tamanhoPagina=${POR_PAGINA}`;
    if (pagina > 1) await dormir(PAUSA_ENTRE_PAGINAS_MS);

    let dados: { data?: ContratoPncp[]; totalPaginas?: number } | null = null;
    // Uma segunda chance com espera maior: 429 costuma ser pressa nossa, não
    // porta fechada. Duas falhas seguidas é que encerram a varredura.
    for (let tentativa = 1; tentativa <= 2 && !dados; tentativa++) {
      try {
        const resp = await fetch(url, { headers: CABECALHOS });
        if (resp.status === 429) {
          if (tentativa === 1) {
            await dormir(8_000);
            continue;
          }
          r.detalhes.push(`PNCP manteve o 429 na página ${pagina} — varredura encerrada aqui.`);
          break;
        }
        if (!resp.ok) {
          r.detalhes.push(`PNCP respondeu ${resp.status} na página ${pagina}`);
          break;
        }
        dados = await resp.json();
      } catch (e) {
        if (tentativa === 2) r.detalhes.push(`PNCP falhou na página ${pagina}: ${(e as Error).message}`);
        else await dormir(5_000);
      }
    }
    if (!dados) break;

    const itens = dados.data ?? [];
    r.paginasLidas++;
    r.contratosVistos += itens.length;
    if (itens.length === 0) break;

    for (const c of itens) {
      if (c.tipoPessoa !== "PJ") continue;
      const cnpj = (c.niFornecedor || "").replace(/\D/g, "");
      if (cnpj.length !== 14) continue;

      const valor = Number(c.valorGlobal ?? 0);
      if (!Number.isFinite(valor) || valor < valorMinimo) continue;

      const fim = c.dataVigenciaFim ? new Date(`${c.dataVigenciaFim}T12:00:00-03:00`) : null;
      if (!fim || Number.isNaN(fim.getTime())) continue;
      if (fim < venceDe || fim > venceAte) continue;

      const atual = candidatas.get(cnpj);
      if (!atual) {
        candidatas.set(cnpj, {
          cnpj,
          empresa: (c.nomeRazaoSocialFornecedor || "").trim(),
          orgao: c.orgaoEntidade?.razaoSocial?.trim() || null,
          objeto: c.objetoContrato?.trim().slice(0, 500) || null,
          uf: c.unidadeOrgao?.ufSigla?.trim() || null,
          municipio: c.unidadeOrgao?.municipioNome?.trim() || null,
          venceEm: fim,
          valorDoContrato: valor,
          valorTotal: valor,
          qtdContratos: 1,
        });
      } else {
        atual.valorTotal += valor;
        atual.qtdContratos++;
        // O gancho da conversa é o que vence PRIMEIRO.
        if (fim < atual.venceEm) {
          atual.venceEm = fim;
          atual.valorDoContrato = valor;
          atual.orgao = c.orgaoEntidade?.razaoSocial?.trim() || atual.orgao;
          atual.objeto = c.objetoContrato?.trim().slice(0, 500) || atual.objeto;
        }
      }
    }

    if (dados.totalPaginas && pagina >= dados.totalPaginas) break;
  }

  r.empresasCandidatas = candidatas.size;

  // Quem já está na base sai antes de gastar consulta na Receita.
  const cnpjs = [...candidatas.keys()];
  const conhecidos = new Set(
    (
      await prisma.leadProspeccao.findMany({
        where: { cnpj: { in: cnpjs } },
        select: { cnpj: true },
      })
    ).map((l) => l.cnpj),
  );
  const nossasEmpresas = new Set(
    (await prisma.empresa.findMany({ select: { cnpj: true } })).map((e) => e.cnpj.replace(/\D/g, "")),
  );

  // Contrato maior primeiro: se a rodada bater no teto, que fique com o que
  // vale mais a conversa.
  const fila = [...candidatas.values()]
    .filter((c) => {
      if (conhecidos.has(c.cnpj) || nossasEmpresas.has(c.cnpj)) {
        r.jaConheciamos++;
        return false;
      }
      return true;
    })
    .sort((a, b) => b.valorTotal - a.valorTotal);

  for (const c of fila) {
    if (r.gravados >= limite) break;

    let receita: Record<string, unknown> | null = null;
    try {
      const resp = await fetch(`${BRASILAPI}/${c.cnpj}`, { headers: CABECALHOS });
      r.consultadasNaReceita++;
      if (resp.ok) receita = await resp.json();
      else if (resp.status === 429) {
        r.detalhes.push("BrasilAPI pediu calma (429) — rodada encerrada aqui.");
        break;
      }
    } catch {
      // CNPJ que a Receita não devolve agora volta na próxima rodada.
    }
    await dormir(PAUSA_ENTRE_CNPJ_MS);
    if (!receita) continue;

    const situacao = String(receita["descricao_situacao_cadastral"] ?? "").toUpperCase();
    if (situacao && situacao !== "ATIVA") {
      r.foraDeAtividade++;
      continue;
    }

    const celular = [receita["ddd_telefone_1"], receita["ddd_telefone_2"]]
      .map((t) => celularDeHoje(String(t ?? "")))
      .find((t): t is string => !!t);
    if (!celular) {
      r.semCelular++;
      continue;
    }

    const porte = String(receita["porte"] ?? "") || null;
    const alvo = ehAlvoIdeal(porte);
    const email = String(receita["email"] ?? "").trim() || null;

    await prisma.leadProspeccao.create({
      data: {
        empresa: String(receita["razao_social"] ?? c.empresa).trim(),
        cnpj: c.cnpj,
        uf: String(receita["uf"] ?? c.uf ?? "").trim() || "—",
        municipio: String(receita["municipio"] ?? c.municipio ?? "").trim() || null,
        telefone: celular,
        email,
        venceEm: c.venceEm,
        valorDoContrato: c.valorDoContrato,
        orgao: c.orgao,
        objeto: c.objeto,
        valorTotal: c.valorTotal,
        qtdContratos: c.qtdContratos,
        porte,
        perfil: String(receita["cnae_fiscal_descricao"] ?? "").trim() || null,
        alvoIdeal: alvo,
        anotacoes:
          `Descoberto automaticamente em ${hoje.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} ` +
          `a partir do PNCP: ${c.qtdContratos} contrato(s) público(s), o primeiro vencendo em ` +
          `${c.venceEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. ` +
          `Telefone vindo do cadastro da Receita — confira se ainda é o da empresa.`,
        atualizadoPorNome: "CP System (descoberta automática)",
      },
    });
    r.gravados++;
    if (alvo) r.alvoIdeal++;
  }

  return r;
}
