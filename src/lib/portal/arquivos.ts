import "server-only";
import { Unzip, AsyncUnzipInflate } from "fflate";

/**
 * Leitura dos dados abertos do Portal da Transparência.
 *
 * Igor, 27/09/2026, sobre a conciliação: *"no portal da transparência eu
 * consigo filtrar por período e pelo favorecido, e me aparece tudo em relação
 * à nota de empenho e o status que ela está."* Ele fez isso à mão, pela tela,
 * exportando Excel.
 *
 * Três caminhos foram testados em 28/09 antes de escolher este:
 *
 * · **A API oficial** (`api.portaldatransparencia.gov.br`) exige chave, e a
 *   chave exige autenticação no Gov.br com conta Prata ou Ouro, atrelada ao
 *   CPF de uma pessoa. Serve, mas depende de alguém manter aquela conta.
 * · **A tela que o Igor usou** responde 405 com "Human Verification" para
 *   qualquer chamada que não venha de um navegador. Tem WAF na frente, e
 *   contornar proteção de robô não é caminho para produto nosso.
 * · **Os dados abertos** (`/download-de-dados/...`) são arquivos públicos,
 *   publicados pela CGU exatamente para consumo por máquina. Sem chave, sem
 *   WAF, e trazem MAIS do que a API: o pacote diário de despesas inclui
 *   `Pagamento_EmpenhosImpactados`, que liga cada pagamento ao seu empenho
 *   **com o valor pago em cada um** — justamente a amarração que o Igor deu
 *   por perdida.
 *
 * O detalhe que decide a arquitetura: são arquivos do Brasil inteiro. O de
 * notas fiscais de um mês tem 73 MB de nota e mais 300 MB de itens; o de
 * despesas de um dia passa de 100 MB somados. Carregar isso na memória de uma
 * função derruba a função. Por isso tudo aqui é **fluxo**: o zip é inflado em
 * pedaços, cada linha é decidida na hora, e só o que interessa aos nossos
 * CNPJs fica na memória. Os arquivos que não vamos ler nem são inflados.
 */

const BASE = "https://portaldatransparencia.gov.br/download-de-dados";

/** O portal responde a navegador; sem User-Agent algumas rotas recusam. */
const CABECALHOS = { "User-Agent": "Mozilla/5.0 (compatible; CP System/1.0)" };

export type LinhaCsv = Record<string, string>;

/**
 * Um arquivo de dentro do zip que queremos ler, e o que fazer com cada linha.
 *
 * `sufixo` casa com o fim do nome — os arquivos vêm prefixados pela data
 * (`20260901_Despesas_Pagamento.csv`), e o sufixo é a parte estável.
 */
export type Alvo = {
  sufixo: string;
  /** Chamado por linha. Guardar é responsabilidade de quem chama. */
  aoLer: (linha: LinhaCsv) => void;
};

/**
 * Lê, em UMA passada e UM download, os CSVs que interessam de dentro de um zip
 * do portal.
 *
 * Entrada que não casa com nenhum alvo não tem `start()` chamado, e por isso
 * **não é inflada** — é assim que os 300 MB de itens de nota fiscal saem de
 * cena sem custo. As que casam são processadas em pedaços, linha a linha, e
 * nada do arquivo inteiro fica em memória.
 */
export async function lerZipDoPortal(opts: {
  url: string;
  alvos: Alvo[];
}): Promise<{ lidas: Record<string, number> }> {
  const resposta = await fetch(opts.url, { headers: CABECALHOS });
  if (!resposta.ok || !resposta.body) {
    throw new Error(`Portal respondeu ${resposta.status} em ${opts.url}`);
  }

  const lidas: Record<string, number> = {};
  let pendentes = 0;
  let fluxoAcabou = false;

  await new Promise<void>((resolver, rejeitar) => {
    const terminarSePuder = () => {
      if (fluxoAcabou && pendentes === 0) resolver();
    };

    const unzip = new Unzip((entrada) => {
      const alvo = opts.alvos.find((a) => entrada.name.endsWith(a.sufixo));
      if (!alvo) return; // sem start() = não infla

      pendentes++;
      lidas[alvo.sufixo] = 0;

      // Cabeçalho e resto de linha do pedaço anterior: o inflate entrega
      // blocos que cortam linhas no meio.
      let colunas: string[] | null = null;
      let sobra = "";
      const decodificador = new TextDecoder("latin1");

      entrada.ondata = (err, dados, fim) => {
        if (err) return rejeitar(err);
        const texto = sobra + decodificador.decode(dados, { stream: !fim });
        const partes = texto.split(/\r?\n/);
        sobra = fim ? "" : (partes.pop() ?? "");
        for (const bruta of partes) {
          if (!bruta) continue;
          const campos = separarCsv(bruta);
          if (!colunas) {
            colunas = campos.map((c) => c.trim());
            continue;
          }
          lidas[alvo.sufixo]++;
          const linha: LinhaCsv = {};
          for (let i = 0; i < colunas.length; i++) linha[colunas[i]] = campos[i] ?? "";
          alvo.aoLer(linha);
        }
        if (fim) {
          pendentes--;
          terminarSePuder();
        }
      };
      entrada.start();
    });
    unzip.register(AsyncUnzipInflate);

    (async () => {
      const leitor = resposta.body!.getReader();
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) {
          unzip.push(new Uint8Array(0), true);
          fluxoAcabou = true;
          // Zip sem nenhuma entrada casada nunca chama ondata — encerra igual.
          terminarSePuder();
          return;
        }
        unzip.push(value);
      }
    })().catch(rejeitar);
  });

  return { lidas };
}

/**
 * Separador de uma linha do CSV da CGU.
 *
 * O formato é `"campo";"campo"`, e aspas dentro de campo vêm dobradas. Um
 * `split(";")` simples quebra em razão social com ponto e vírgula — e elas
 * existem.
 */
function separarCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
      continue;
    }
    if (c === ";" && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
      continue;
    }
    atual += c;
  }
  campos.push(atual);
  return campos;
}

/** `dd/mm/aaaa` ou `dd/mm/aaaa hh:mm:ss` — o portal usa os dois. */
export function dataDoPortal(valor: string): Date | null {
  const m = (valor || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mes, a, h = "00", min = "00", s = "00"] = m;
  // Horário de Brasília, que é como o portal publica.
  return new Date(`${a}-${mes}-${d}T${h}:${min}:${s}-03:00`);
}

/** "1234,56" → 1234.56. Campo vazio vira 0. */
export function valorDoPortal(valor: string): number {
  const limpo = (valor || "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function urlDespesasDoDia(dia: Date): string {
  const iso = dia.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `${BASE}/despesas/${iso.replace(/-/g, "")}`;
}

export function urlNotasFiscaisDoMes(quando: Date): string {
  const iso = quando.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [ano, mes] = iso.split("-");
  return `${BASE}/notas-fiscais/${ano}${mes}`;
}
