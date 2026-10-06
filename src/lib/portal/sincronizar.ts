import "server-only";
import { prisma } from "@/lib/prisma";
import { contaTemAcessoConciliacao } from "@/lib/conciliacao/planoGuard";
import {
  lerZipDoPortal,
  urlNotasFiscaisDoMes,
  urlDespesasDoDia,
  dataDoPortal,
  valorDoPortal,
  type LinhaCsv,
} from "./arquivos";

/**
 * Traz para dentro do sistema o que o órgão publica sobre o cliente.
 *
 * Regina, 28/09/2026: *"eu quero que exista. Dentro da conciliação bancária,
 * para os clientes intermediário e premium, junto com a conciliação."*
 *
 * A conciliação por extrato responde *"o dinheiro entrou na conta?"*. Esta
 * aqui responde a outra metade, que o cliente hoje só descobre ligando para o
 * órgão: *"o órgão reconhece que deve, e já mandou pagar?"*. São duas verdades
 * diferentes, e conciliar de verdade é cruzar as duas.
 *
 * **O que decide a arquitetura:** os arquivos do portal são do Brasil inteiro,
 * um por dia (despesas) ou um por mês (notas fiscais). Então a sincronização
 * NÃO é por cliente — é por arquivo. Baixa uma vez, filtra os CNPJs de todos
 * os clientes na mesma passada. Vinte clientes custam o mesmo que um.
 */

export type ResumoPortal = {
  empresas: number;
  linhasLidas: number;
  notasGravadas: number;
  notasCasadas: number;
  pagamentosGravados: number;
  pagamentosCasados: number;
  empenhosGravados: number;
  detalhes: string[];
};

function resumoVazio(): ResumoPortal {
  return {
    empresas: 0, linhasLidas: 0, notasGravadas: 0, notasCasadas: 0,
    pagamentosGravados: 0, pagamentosCasados: 0, empenhosGravados: 0, detalhes: [],
  };
}

const soDigitos = (s: string) => (s || "").replace(/\D/g, "");

/**
 * Empresas cujo plano dá direito ao módulo.
 *
 * A trava é a MESMA da conciliação por extrato — `contaTemAcessoConciliacao`,
 * que já cobre Intermediário, Premium e a janela de cortesia. Regra nova
 * paralela seria uma forma elegante de as duas divergirem com o tempo.
 */
async function empresasComAcesso() {
  const todas = await prisma.empresa.findMany({
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      conta: { select: { plano: true, conciliacaoCortesiaAte: true } },
    },
  });
  return todas.filter((e) => contaTemAcessoConciliacao(e.conta));
}

/** cnpj (só dígitos) → empresa */
function indexarPorCnpj<T extends { cnpj: string }>(lista: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const e of lista) m.set(soDigitos(e.cnpj), e);
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════
// Notas fiscais — arquivo mensal, por CNPJ do emitente
// ═══════════════════════════════════════════════════════════════════════════

export async function sincronizarNotasDoMes(mes: Date): Promise<ResumoPortal> {
  const r = resumoVazio();
  const empresas = await empresasComAcesso();
  r.empresas = empresas.length;
  if (empresas.length === 0) return r;

  const porCnpj = indexarPorCnpj(empresas);
  const achadas: { empresaId: string; l: LinhaCsv }[] = [];

  const { lidas } = await lerZipDoPortal({
    url: urlNotasFiscaisDoMes(mes),
    // Só o cabeçalho da nota. O arquivo de ITENS tem 300 MB e não é pedido,
    // então nem chega a ser descompactado.
    alvos: [
      {
        sufixo: "_NFe_NotaFiscal.csv",
        aoLer: (l) => {
          const emp = porCnpj.get(soDigitos(l["CPF/CNPJ Emitente"]));
          if (emp) achadas.push({ empresaId: emp.id, l });
        },
      },
    ],
  });
  r.linhasLidas = Object.values(lidas).reduce((s, n) => s + n, 0);

  // O portal republica a mesma nota em linhas idênticas — em setembro a NF
  // 611/1 da HMD veio duas vezes, byte a byte igual. Contar linha inflaria o
  // número que o cliente vê, então a chave de acesso manda: uma nota, uma vez.
  const porChave = new Map<string, { empresaId: string; l: LinhaCsv }>();
  for (const a of achadas) {
    const chave = (a.l["CHAVE DE ACESSO"] || "").trim();
    if (chave) porChave.set(chave, a);
  }

  for (const { empresaId, l } of porChave.values()) {
    const chave = (l["CHAVE DE ACESSO"] || "").trim();
    const emissao = dataDoPortal(l["DATA EMISSÃO"]);
    if (!emissao) continue;

    const dados = {
      numero: (l["NÚMERO"] || "").trim(),
      serie: (l["SÉRIE"] || "").trim() || null,
      valor: valorDoPortal(l["VALOR NOTA FISCAL"]),
      dataEmissao: emissao,
      orgaoDestinatario: (l["ÓRGÃO DESTINATÁRIO"] || "").trim() || null,
      ultimoEvento: (l["EVENTO MAIS RECENTE"] || "").trim() || null,
      sincronizadoEm: new Date(),
    };

    const gravada = await prisma.notaFiscalPortal.upsert({
      where: { empresaId_chave: { empresaId, chave } },
      create: { empresaId, chave, ...dados },
      update: dados,
    });
    r.notasGravadas++;

    if (!gravada.notaFiscalId) {
      const nossa = await acharNossaNota(empresaId, dados.numero, dados.serie, dados.valor);
      if (nossa) {
        await prisma.notaFiscalPortal.update({
          where: { id: gravada.id },
          data: { notaFiscalId: nossa },
        });
        r.notasCasadas++;
      }
    }
  }

  r.detalhes.push(`notas do mês ${urlNotasFiscaisDoMes(mes).slice(-6)}: ${r.notasGravadas} gravadas, ${r.notasCasadas} casadas`);
  return r;
}

/**
 * A nota do portal e a nota cadastrada são a mesma?
 *
 * Número é o sinal forte, mas número sozinho se repete entre séries. Quando as
 * duas pontas têm série, ela precisa bater. Quando só uma tem — é o caso de
 * boa parte do cadastro atual —, o valor decide, com um centavo de tolerância
 * para arredondamento.
 */
async function acharNossaNota(
  empresaId: string,
  numero: string,
  serie: string | null,
  valor: number,
): Promise<string | null> {
  if (!numero) return null;
  const candidatas = await prisma.notaFiscal.findMany({
    where: { empresaId, numero },
    select: { id: true, serie: true, valorServicos: true },
  });
  if (candidatas.length === 0) return null;

  const comSerie = serie ? candidatas.filter((c) => c.serie && c.serie.trim() === serie) : [];
  if (comSerie.length === 1) return comSerie[0].id;

  const porValor = candidatas.filter((c) => Math.abs(c.valorServicos - valor) < 0.01);
  if (porValor.length === 1) return porValor[0].id;

  // Uma única candidata com o mesmo número e nenhuma contradição de série.
  if (candidatas.length === 1 && (!serie || !candidatas[0].serie)) return candidatas[0].id;
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Despesas — arquivo diário: empenho, liquidação e pagamento
// ═══════════════════════════════════════════════════════════════════════════

export async function sincronizarDespesasDoDia(dia: Date): Promise<ResumoPortal> {
  const r = resumoVazio();
  const empresas = await empresasComAcesso();
  r.empresas = empresas.length;
  if (empresas.length === 0) return r;

  const porCnpj = indexarPorCnpj(empresas);

  const pagamentos: { empresaId: string; l: LinhaCsv }[] = [];
  const empenhos: { empresaId: string; l: LinhaCsv }[] = [];
  const liquidacoes: { empresaId: string; l: LinhaCsv }[] = [];
  /** Código do pagamento → empenhos que ele quitou, com o valor de cada um. */
  const impactados = new Map<string, { empenho: string; valor: number }[]>();
  /**
   * Código do empenho → seus itens.
   *
   * O empenho do portal quase nunca tem observação — nos três do Léo, nenhuma.
   * Então o objeto da contratação não vem do cabeçalho: vem da descrição dos
   * itens. Sem isso, o cadastro por CNPJ abria o formulário com o objeto
   * vazio, que é justamente o campo mais trabalhoso de digitar.
   */
  const itensPorEmpenho = new Map<string, { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[]>();

  const { lidas } = await lerZipDoPortal({
    url: urlDespesasDoDia(dia),
    alvos: [
      {
        sufixo: "_Despesas_Pagamento.csv",
        aoLer: (l) => {
          const emp = porCnpj.get(soDigitos(l["Código Favorecido"]));
          if (emp) pagamentos.push({ empresaId: emp.id, l });
        },
      },
      {
        sufixo: "_Despesas_Empenho.csv",
        aoLer: (l) => {
          const emp = porCnpj.get(soDigitos(l["Código Favorecido"]));
          if (emp) empenhos.push({ empresaId: emp.id, l });
        },
      },
      {
        sufixo: "_Despesas_Liquidacao.csv",
        aoLer: (l) => {
          const emp = porCnpj.get(soDigitos(l["Código Favorecido"]));
          if (emp) liquidacoes.push({ empresaId: emp.id, l });
        },
      },
      {
        sufixo: "_Despesas_ItemEmpenho.csv",
        aoLer: (l) => {
          const cod = (l["Código Empenho"] || "").trim();
          if (!cod) return;
          const lista = itensPorEmpenho.get(cod);
          // Teto por empenho e no total: o arquivo é do Brasil inteiro, e
          // guardar tudo trocaria um problema de digitação por um de memória.
          if (lista && lista.length >= 20) return;
          if (!lista && itensPorEmpenho.size >= 150_000) return;
          const descricao = (l["Descrição"] || "").trim();
          if (!descricao) return;
          const item = {
            descricao: descricao.slice(0, 300),
            quantidade: valorDoPortal(l["Quantidade"]),
            valorUnitario: valorDoPortal(l["Valor Unitário"]),
            valorTotal: valorDoPortal(l["Valor Total"]),
          };
          if (lista) lista.push(item);
          else itensPorEmpenho.set(cod, [item]);
        },
      },
      {
        // A ligação que o Igor deu por perdida no vídeo: pagamento → empenho,
        // com o valor pago em cada um. Guardado inteiro porque a ordem das
        // entradas dentro do zip não é garantida — quando esta é lida, ainda
        // pode não se saber quais pagamentos são nossos. São ~37 mil linhas
        // curtas, cabe de sobra.
        sufixo: "_Despesas_Pagamento_EmpenhosImpactados.csv",
        aoLer: (l) => {
          const cod = (l["Código Pagamento"] || "").trim();
          if (!cod) return;
          const lista = impactados.get(cod) ?? [];
          lista.push({
            empenho: (l["Código Empenho"] || "").trim(),
            valor: valorDoPortal(l["Valor Pago (R$)"]),
          });
          impactados.set(cod, lista);
        },
      },
    ],
  });
  r.linhasLidas = Object.values(lidas).reduce((s, n) => s + n, 0);

  for (const { empresaId, l } of empenhos) {
    await gravarDocumento({
      empresaId, l, fase: "EMPENHO",
      campoCodigo: "Código Empenho", campoResumido: "Código Empenho Resumido",
      itens: itensPorEmpenho.get((l["Código Empenho"] || "").trim()) ?? null,
      r,
    });
    r.empenhosGravados++;
  }
  for (const { empresaId, l } of liquidacoes) {
    await gravarDocumento({ empresaId, l, fase: "LIQUIDACAO", campoCodigo: "Código Liquidação", campoResumido: "Código Liquidação Resumido", r });
  }
  for (const { empresaId, l } of pagamentos) {
    const codigo = (l["Código Pagamento"] || "").trim();
    const ligacoes = impactados.get(codigo) ?? [];
    await gravarDocumento({
      empresaId, l, fase: "PAGAMENTO",
      campoCodigo: "Código Pagamento", campoResumido: "Código Pagamento Resumido",
      codigoEmpenhoPortal: ligacoes[0]?.empenho ?? null,
      r,
    });
    r.pagamentosGravados++;
  }

  return r;
}

async function gravarDocumento(opts: {
  empresaId: string;
  l: LinhaCsv;
  fase: "EMPENHO" | "LIQUIDACAO" | "PAGAMENTO";
  campoCodigo: string;
  campoResumido: string;
  codigoEmpenhoPortal?: string | null;
  itens?: { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[] | null;
  r: ResumoPortal;
}) {
  const { empresaId, l, fase } = opts;
  const codigo = (l[opts.campoCodigo] || "").trim();
  const data = dataDoPortal(l["Data Emissão"]);
  if (!codigo || !data) return;

  // O nome da coluna de valor muda de arquivo para arquivo ("Valor Original do
  // Pagamento", "Valor do Empenho Convertido pra R$"...). Em vez de uma lista
  // que envelhece, acha a primeira coluna de valor da linha.
  const chaveValor = Object.keys(l).find((k) => /^valor/i.test(k));
  const valor = chaveValor ? valorDoPortal(l[chaveValor]) : 0;

  const codigoEmpenho = opts.codigoEmpenhoPortal ?? (fase === "EMPENHO" ? codigo : null);
  const empenhoId = codigoEmpenho ? await acharNossoEmpenho(empresaId, codigoEmpenho) : null;

  const dados = {
    codigoResumido: (l[opts.campoResumido] || "").trim() || null,
    data,
    valor,
    observacao: (l["Observação"] || "").trim() || null,
    codigoUg: (l["Código Unidade Gestora"] || "").trim() || null,
    ug: (l["Unidade Gestora"] || "").trim() || null,
    codigoOrgao: (l["Código Órgão"] || "").trim() || null,
    orgao: (l["Órgão"] || "").trim() || null,
    numeroProcesso: (l["Processo"] || "").trim() || null,
    codigoEmpenhoPortal: codigoEmpenho,
    empenhoId,
    ...(opts.itens && opts.itens.length > 0 ? { itens: opts.itens } : {}),
    sincronizadoEm: new Date(),
  };

  const doc = await prisma.documentoPortal.upsert({
    where: { empresaId_fase_codigo: { empresaId, fase, codigo } },
    create: { empresaId, fase, codigo, ...dados },
    update: dados,
  });
  if (empenhoId && fase === "PAGAMENTO") opts.r.pagamentosCasados++;

  if (fase === "PAGAMENTO") {
    await conciliarPagamento({
      pagamentoId: doc.id,
      empresaId,
      empenhoId,
      valor,
      observacao: dados.observacao,
    });
  }
}

/**
 * O número da nota fiscal escrito à mão na observação do SIAFI.
 *
 * Igor, no vídeo de 27/09: *"lá no portal ele não fala qual é a nota fiscal,
 * ele não traz esse dado. Se trouxesse, tava amarrado."* Não traz em campo
 * próprio — mas o operador do órgão escreve no texto livre, e escreve quase
 * sempre. Nos pagamentos do próprio Léo, de julho a setembro:
 *
 *     NF:221 DE 25/05/2026 - PAG:0650/2024 - GABAER
 *     NFS-E 238 EMITIDA EM 26/06/2026 // FORNECIMENTO DE INFRAESTRUTURA
 *     NFE. 252, DE 08/07/2026 // REF A CONTRATACAO DE GRUPO MUSICAL
 *
 * Três grafias, todas com o número logo depois da sigla. Quando dá para ler,
 * a conciliação deixa de ser palpite por valor e vira amarração exata.
 *
 * O cuidado que o texto exige: `PAG:10650/2024` também tem dois-pontos e
 * número, e casaria numa expressão frouxa. Por isso a sigla é obrigatória e
 * ancorada em início de palavra.
 */
export function numeroDaNotaNaObservacao(texto: string | null): string | null {
  if (!texto) return null;
  const padroes = [
    /\bNFS?[\s.-]?E?\s*[:.\-]?\s*(\d{1,9})\b/i,
    /\bNOTA\s+FISCAL\s*(?:N[º°.]?\s*)?(\d{1,9})\b/i,
  ];
  for (const p of padroes) {
    const m = texto.match(p);
    if (m?.[1]) {
      const n = m[1].replace(/^0+/, "") || m[1];
      // Número de quatro dígitos começando em 20 quase sempre é o ano de uma
      // data vizinha, não a nota.
      if (/^20\d{2}$/.test(n)) continue;
      return n;
    }
  }
  return null;
}

/**
 * Liga o pagamento do portal às notas do cliente.
 *
 * Três caminhos, do mais forte para o mais fraco, e o primeiro que fecha
 * manda:
 *
 * 1. **O órgão citou a nota** na observação — não há o que discutir.
 * 2. **Uma nota só com aquele valor** dentro do empenho — também não há outra
 *    leitura possível.
 * 3. **Mais de uma nota compatível** — o sistema não escolhe calado: grava
 *    como provável, e o cliente confirma com um clique.
 */
async function conciliarPagamento(opts: {
  pagamentoId: string;
  empresaId: string;
  empenhoId: string | null;
  valor: number;
  observacao: string | null;
}): Promise<"CONFIRMADO" | "PROVAVEL" | null> {
  const ondeBuscar = opts.empenhoId
    ? { empresaId: opts.empresaId, empenhoId: opts.empenhoId }
    : { empresaId: opts.empresaId };

  const citada = numeroDaNotaNaObservacao(opts.observacao);
  if (citada) {
    const porNumero = await prisma.notaFiscal.findMany({
      where: { ...ondeBuscar, numero: citada },
      select: { id: true },
    });
    if (porNumero.length === 1) {
      await registrarConciliacao(opts.pagamentoId, porNumero[0].id, "CONFIRMADO",
        `O órgão citou a NF ${citada} na observação do pagamento.`);
      return "CONFIRMADO";
    }
  }

  // Sem empenho reconhecido, casar por valor solto pela empresa inteira
  // acertaria por acaso. Melhor não afirmar nada.
  if (!opts.empenhoId) return null;

  const doEmpenho = await prisma.notaFiscal.findMany({
    where: ondeBuscar,
    select: { id: true, numero: true, valorServicos: true },
  });
  const mesmoValor = doEmpenho.filter((n) => Math.abs(n.valorServicos - opts.valor) < 0.01);

  if (mesmoValor.length === 1) {
    await registrarConciliacao(opts.pagamentoId, mesmoValor[0].id, "CONFIRMADO",
      `Valor idêntico ao da NF ${mesmoValor[0].numero ?? "sem número"} e nenhuma outra nota do empenho bate.`);
    return "CONFIRMADO";
  }
  if (mesmoValor.length > 1) {
    await registrarConciliacao(opts.pagamentoId, mesmoValor[0].id, "PROVAVEL",
      `${mesmoValor.length} notas do empenho têm exatamente este valor — confirme qual foi paga.`);
    return "PROVAVEL";
  }
  if (doEmpenho.length === 1) {
    await registrarConciliacao(opts.pagamentoId, doEmpenho[0].id, "PROVAVEL",
      `Única nota do empenho, mas o valor pago difere do valor da nota.`);
    return "PROVAVEL";
  }
  return null;
}

async function registrarConciliacao(
  pagamentoId: string,
  notaFiscalId: string,
  confianca: "CONFIRMADO" | "PROVAVEL",
  motivo: string,
) {
  await prisma.conciliacaoPortal.upsert({
    where: { pagamentoId_notaFiscalId: { pagamentoId, notaFiscalId } },
    create: { pagamentoId, notaFiscalId, confianca, motivo },
    // Recusa do cliente é decisão de gente: a rodada seguinte não a desfaz.
    update: {},
  });
}

/**
 * O empenho do portal é um dos nossos?
 *
 * O código do portal é unidade gestora + gestão + número — por exemplo
 * `110001000012026NE000356`, em que `2026NE000356` é o número que o cliente
 * digita. Então o nosso número é o FINAL do código deles, e o confronto é por
 * sufixo, sem acento nem espaço.
 */
async function acharNossoEmpenho(empresaId: string, codigoPortal: string): Promise<string | null> {
  const alvo = codigoPortal.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (alvo.length < 6) return null;
  const nossos = await prisma.empenho.findMany({
    where: { empresaId },
    select: { id: true, numero: true },
  });
  for (const e of nossos) {
    const n = (e.numero || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Número curto demais casaria por acaso — "12" é sufixo de quase tudo.
    if (n.length >= 6 && alvo.endsWith(n)) return e.id;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * A rodada diária: as notas do mês corrente e as despesas dos últimos dias.
 *
 * O portal publica com atraso de alguns dias, então reler uma janela curta é
 * o que garante não perder documento — e o `upsert` faz a releitura ser
 * inofensiva.
 */
export async function sincronizarPortal(opts?: { diasDeDespesa?: number }): Promise<ResumoPortal> {
  const total = resumoVazio();
  const juntar = (p: ResumoPortal) => {
    total.empresas = Math.max(total.empresas, p.empresas);
    total.linhasLidas += p.linhasLidas;
    total.notasGravadas += p.notasGravadas;
    total.notasCasadas += p.notasCasadas;
    total.pagamentosGravados += p.pagamentosGravados;
    total.pagamentosCasados += p.pagamentosCasados;
    total.empenhosGravados += p.empenhosGravados;
    total.detalhes.push(...p.detalhes);
  };

  const agora = new Date();
  try {
    juntar(await sincronizarNotasDoMes(agora));
  } catch (e) {
    total.detalhes.push(`notas do mês falharam: ${(e as Error).message}`);
  }

  const dias = opts?.diasDeDespesa ?? 3;
  for (let i = 1; i <= dias; i++) {
    const dia = new Date(agora.getTime() - i * 86400_000);
    try {
      juntar(await sincronizarDespesasDoDia(dia));
    } catch (e) {
      // Dia sem arquivo publicado é rotina (fim de semana, feriado), não falha.
      total.detalhes.push(`despesas de ${dia.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}: ${(e as Error).message}`);
    }
  }

  return total;
}
