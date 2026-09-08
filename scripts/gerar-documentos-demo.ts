/**
 * Gera os documentos fictícios que o Igor sobe no vídeo tutorial.
 *
 * Regina 08/09: "crie documentos de simulação para o Igor fazer upload quando
 * ele for gravar o vídeo tutorial, simulando como o sistema funciona e como ele
 * extrai os dados de forma inteligente".
 *
 * Todos os dados são inventados — empresa, órgão, CNPJ e número de processo.
 * Órgão real num vídeo de demonstração dá a entender que temos contrato com
 * ele, e não temos.
 *
 * Os PDFs seguem a estrutura dos documentos de verdade (ata, contrato, empenho
 * e nota fiscal de serviço) porque é isso que a leitura automática precisa
 * encontrar: número, datas, valores, CNPJ do órgão e itens. Documento
 * "bonitinho" mas fora do formato faz a extração falhar no meio do vídeo.
 *
 * Uso:  npx tsx scripts/gerar-documentos-demo.ts [pasta-de-saida]
 * Depois: converta para PDF com o Chrome (o script imprime o comando).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SAIDA = process.argv[2] ?? join(process.env.HOME ?? ".", "Downloads", "CP-System-Documentos-Demo");

const EMPRESA = {
  razao: "CONSTRUTORA MODELO LTDA",
  cnpj: "45.678.912/0001-34",
  endereco: "SRTVS Quadra 701, Bloco O, Sala 616 — Asa Sul, Brasília/DF",
  cep: "70.340-906",
  ie: "07.412.556/001-88",
};

const ORGAO = {
  nome: "PREFEITURA MUNICIPAL DE SANTA CLARA",
  cnpj: "12.345.678/0001-90",
  endereco: "Praça da Matriz, 100 — Centro, Santa Clara/GO",
  secretaria: "Secretaria Municipal de Educação",
};

function dataBr(offsetDias: number): string {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return d.toLocaleDateString("pt-BR");
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function extenso(v: number): string {
  // Suficiente para os valores da simulação; não é conversor geral.
  const mil = Math.floor(v / 1000);
  const resto = Math.round(v % 1000);
  return `${mil} mil${resto ? ` e ${resto}` : ""} reais`;
}

const ESTILO = `
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; font-size: 11.5pt; line-height: 1.5; color: #000; margin: 0; }
  .brasao { text-align: center; margin-bottom: 4mm; }
  .brasao .orgao { font-weight: bold; font-size: 13pt; text-transform: uppercase; letter-spacing: .5px; }
  .brasao .sub { font-size: 10.5pt; }
  .brasao .end { font-size: 9pt; color: #333; }
  hr { border: none; border-top: 1.5px solid #000; margin: 4mm 0 6mm; }
  h1 { text-align: center; font-size: 13pt; text-transform: uppercase; margin: 0 0 6mm; letter-spacing: .5px; }
  .campo { margin-bottom: 2.5mm; }
  .campo b { display: inline-block; min-width: 52mm; }
  table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 10.5pt; }
  th, td { border: 1px solid #000; padding: 2mm 2.5mm; text-align: left; vertical-align: top; }
  th { background: #e8e8e8; font-size: 9.5pt; text-transform: uppercase; }
  td.num { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; background: #f2f2f2; }
  .clausula { margin: 3mm 0; text-align: justify; }
  .clausula b { text-transform: uppercase; }
  .assinaturas { margin-top: 14mm; display: flex; gap: 12mm; }
  .assinaturas div { flex: 1; text-align: center; border-top: 1px solid #000; padding-top: 2mm; font-size: 10pt; }
  .rodape { margin-top: 8mm; font-size: 8.5pt; color: #444; text-align: center; }
  .selo { border: 1px dashed #888; padding: 2mm; font-size: 8pt; color: #666; text-align: center; margin-top: 6mm; }
</style>`;

function cabecalho(sub?: string): string {
  return `
  <div class="brasao">
    <div class="orgao">${ORGAO.nome}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ""}
    <div class="end">${ORGAO.endereco} · CNPJ ${ORGAO.cnpj}</div>
  </div>
  <hr>`;
}

const RODAPE = `<div class="selo">Documento fictício, gerado para demonstração do CP System. Não possui valor legal ou fiscal.</div>`;

// ── 1 · Ata de Registro de Preços ──────────────────────────────────────────
const itensAta = [
  ["1", "Cimento Portland CP-II-32, saco 50 kg", "SC", 12000, 42.5],
  ["2", "Areia média lavada, a granel", "M³", 3000, 130.0],
  ["3", "Brita nº 1, a granel", "M³", 2500, 145.0],
  ["4", "Bloco cerâmico de vedação 9x19x39 cm", "UN", 45000, 2.35],
];
const totalAta = itensAta.reduce((s, i) => s + (i[3] as number) * (i[4] as number), 0);

const ATA = `${ESTILO}${cabecalho(ORGAO.secretaria)}
<h1>Ata de Registro de Preços nº 012/2026</h1>
<div class="campo"><b>Processo Administrativo:</b> 23.456/2026</div>
<div class="campo"><b>Pregão Eletrônico:</b> nº 045/2026</div>
<div class="campo"><b>Data de assinatura:</b> ${dataBr(-200)}</div>
<div class="campo"><b>Vigência:</b> ${dataBr(-200)} a ${dataBr(45)} (12 meses)</div>
<div class="campo"><b>Órgão gerenciador:</b> ${ORGAO.secretaria} — CNPJ ${ORGAO.cnpj}</div>
<div class="campo"><b>Fornecedor beneficiário:</b> ${EMPRESA.razao} — CNPJ ${EMPRESA.cnpj}</div>
<div class="campo"><b>Endereço do fornecedor:</b> ${EMPRESA.endereco}</div>
<div class="campo"><b>Valor total registrado:</b> ${brl(totalAta)}</div>

<p class="clausula"><b>Cláusula primeira — do objeto.</b> Registro de preços para eventual
aquisição de materiais de construção destinados à manutenção predial das unidades escolares
do município, conforme quantidades e especificações constantes desta Ata.</p>

<table>
  <thead><tr><th>Item</th><th>Descrição</th><th>Unid.</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th></tr></thead>
  <tbody>
    ${itensAta
      .map(
        (i) =>
          `<tr><td>${i[0]}</td><td>${i[1]}</td><td>${i[2]}</td><td class="num">${(i[3] as number).toLocaleString("pt-BR")}</td><td class="num">${brl(i[4] as number)}</td><td class="num">${brl((i[3] as number) * (i[4] as number))}</td></tr>`,
      )
      .join("")}
    <tr class="total"><td colspan="5">Valor global da ata</td><td class="num">${brl(totalAta)}</td></tr>
  </tbody>
</table>

<p class="clausula"><b>Cláusula segunda — da vigência.</b> A presente Ata terá validade de 12
(doze) meses, contados da data de sua assinatura, nos termos do art. 84 da Lei nº 14.133/2021,
podendo ser prorrogada por igual período mediante pesquisa que comprove a vantajosidade.</p>

<p class="clausula"><b>Cláusula terceira — do prazo de entrega.</b> A entrega deverá ocorrer em
até 15 (quinze) dias corridos, contados do recebimento da Nota de Empenho.</p>

<p class="clausula"><b>Cláusula quarta — do pagamento.</b> O pagamento será efetuado em até 30
(trinta) dias, contados do recebimento definitivo e do encaminhamento da respectiva nota fiscal
ao órgão.</p>

<div class="assinaturas">
  <div>${ORGAO.nome}<br>Órgão gerenciador</div>
  <div>${EMPRESA.razao}<br>Fornecedor beneficiário</div>
</div>
${RODAPE}`;

// ── 2 · Contrato administrativo ────────────────────────────────────────────
const CONTRATO = `${ESTILO}${cabecalho(ORGAO.secretaria)}
<h1>Contrato Administrativo nº 045/2026</h1>
<div class="campo"><b>Processo Administrativo:</b> 18.902/2026</div>
<div class="campo"><b>Modalidade:</b> Pregão Eletrônico nº 031/2026</div>
<div class="campo"><b>Contratante:</b> ${ORGAO.nome} — CNPJ ${ORGAO.cnpj}</div>
<div class="campo"><b>Contratada:</b> ${EMPRESA.razao} — CNPJ ${EMPRESA.cnpj}</div>
<div class="campo"><b>Data de assinatura:</b> ${dataBr(-180)}</div>
<div class="campo"><b>Vigência:</b> ${dataBr(-180)} a ${dataBr(28)}</div>
<div class="campo"><b>Valor global:</b> ${brl(1_180_000)} (um milhão, cento e oitenta mil reais)</div>
<div class="campo"><b>Prazo de pagamento:</b> 30 (trinta) dias após o encaminhamento da nota fiscal</div>

<p class="clausula"><b>Cláusula primeira — do objeto.</b> Prestação de serviços de reforma e
manutenção predial em unidades escolares da rede municipal de ensino, com fornecimento de
material e mão de obra, conforme projeto básico anexo ao processo.</p>

<p class="clausula"><b>Cláusula segunda — do prazo de vigência.</b> O presente contrato vigorará
por 12 (doze) meses, contados da data de sua assinatura, podendo ser prorrogado nos termos do
art. 107 da Lei nº 14.133/2021, mediante termo aditivo firmado <b>antes do término da vigência</b>.</p>

<p class="clausula"><b>Cláusula terceira — do valor e do reajuste.</b> O valor global é de
${brl(1_180_000)}, admitido reajuste após 12 (doze) meses pelo IPCA, mediante requerimento
da contratada.</p>

<p class="clausula"><b>Cláusula quarta — das medições.</b> Os serviços serão medidos mensalmente,
e a nota fiscal somente poderá ser emitida após o atesto da medição pelo fiscal do contrato.</p>

<p class="clausula"><b>Cláusula quinta — das penalidades.</b> O atraso injustificado na execução
sujeitará a contratada à multa de 0,5% (cinco décimos por cento) por dia de atraso, limitada a
10% (dez por cento) do valor do contrato, sem prejuízo das demais sanções do art. 156 da
Lei nº 14.133/2021.</p>

<div class="assinaturas">
  <div>${ORGAO.nome}<br>Contratante</div>
  <div>${EMPRESA.razao}<br>Contratada</div>
</div>
${RODAPE}`;

// ── 3 · Nota de Empenho ────────────────────────────────────────────────────
const itensEmp = [
  ["1", "Cimento Portland CP-II-32, saco 50 kg", "SC", 2400, 42.5],
  ["2", "Areia média lavada, a granel", "M³", 480, 130.0],
];
const totalEmp = itensEmp.reduce((s, i) => s + (i[3] as number) * (i[4] as number), 0);

const EMPENHO = `${ESTILO}${cabecalho("Secretaria Municipal de Fazenda — Departamento de Contabilidade")}
<h1>Nota de Empenho nº 2026NE000412</h1>
<div class="campo"><b>Data de emissão:</b> ${dataBr(-6)}</div>
<div class="campo"><b>Tipo de empenho:</b> Ordinário</div>
<div class="campo"><b>Unidade gestora:</b> ${ORGAO.secretaria}</div>
<div class="campo"><b>Processo:</b> 23.456/2026</div>
<div class="campo"><b>Origem:</b> Ata de Registro de Preços nº 012/2026</div>
<div class="campo"><b>Credor:</b> ${EMPRESA.razao}</div>
<div class="campo"><b>CNPJ do credor:</b> ${EMPRESA.cnpj}</div>
<div class="campo"><b>Endereço do credor:</b> ${EMPRESA.endereco}</div>
<div class="campo"><b>Dotação orçamentária:</b> 12.361.0012.2045.3.3.90.30.00</div>
<div class="campo"><b>Fonte de recurso:</b> 1.500.1001 — Recursos Ordinários</div>
<div class="campo"><b>Prazo de entrega:</b> até ${dataBr(9)}</div>
<div class="campo"><b>Prazo de pagamento:</b> 30 dias após o encaminhamento da nota fiscal</div>
<div class="campo"><b>Local de entrega:</b> Almoxarifado Central — Rua das Obras, 250, Santa Clara/GO</div>

<table>
  <thead><tr><th>Item</th><th>Descrição</th><th>Unid.</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th></tr></thead>
  <tbody>
    ${itensEmp
      .map(
        (i) =>
          `<tr><td>${i[0]}</td><td>${i[1]}</td><td>${i[2]}</td><td class="num">${(i[3] as number).toLocaleString("pt-BR")}</td><td class="num">${brl(i[4] as number)}</td><td class="num">${brl((i[3] as number) * (i[4] as number))}</td></tr>`,
      )
      .join("")}
    <tr class="total"><td colspan="5">Valor total empenhado</td><td class="num">${brl(totalEmp)}</td></tr>
  </tbody>
</table>

<p class="clausula">Valor por extenso: ${extenso(totalEmp)}.</p>
<p class="clausula">O recebimento definitivo ficará condicionado à conferência de quantidade e
qualidade pelo setor requisitante, nos termos do art. 140 da Lei nº 14.133/2021.</p>

<div class="assinaturas">
  <div>Ordenador de Despesas</div>
  <div>Setor de Contabilidade</div>
</div>
${RODAPE}`;

// ── 4 · Nota Fiscal de Serviço ─────────────────────────────────────────────
const valorNf = 129_000;
const NOTA = `${ESTILO}
<div class="brasao">
  <div class="orgao">Nota Fiscal de Serviços Eletrônica — NFS-e</div>
  <div class="sub">Município de Brasília — Distrito Federal</div>
</div>
<hr>
<h1>Número da nota: 1350 &nbsp;·&nbsp; Série: 1</h1>
<div class="campo"><b>Data de emissão:</b> ${dataBr(-4)}</div>
<div class="campo"><b>Código de verificação:</b> 4F7A-9C21-B8E3</div>
<div class="campo"><b>Competência:</b> ${new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</div>

<table>
  <tr><th colspan="2">Prestador de serviços</th></tr>
  <tr><td><b>Razão social</b></td><td>${EMPRESA.razao}</td></tr>
  <tr><td><b>CNPJ</b></td><td>${EMPRESA.cnpj}</td></tr>
  <tr><td><b>Inscrição municipal</b></td><td>${EMPRESA.ie}</td></tr>
  <tr><td><b>Endereço</b></td><td>${EMPRESA.endereco} — CEP ${EMPRESA.cep}</td></tr>
</table>

<table>
  <tr><th colspan="2">Tomador de serviços</th></tr>
  <tr><td><b>Razão social</b></td><td>${ORGAO.nome}</td></tr>
  <tr><td><b>CNPJ</b></td><td>${ORGAO.cnpj}</td></tr>
  <tr><td><b>Endereço</b></td><td>${ORGAO.endereco}</td></tr>
</table>

<table>
  <tr><th>Discriminação dos serviços</th></tr>
  <tr><td>
    Manutenção elétrica predial executada no posto de saúde central, referente à Nota de
    Empenho nº 2026NE000350, medição do mês corrente, conforme Contrato nº 045/2026.
  </td></tr>
</table>

<table>
  <tr><td><b>Valor dos serviços</b></td><td class="num">${brl(valorNf)}</td></tr>
  <tr><td><b>Base de cálculo do ISS</b></td><td class="num">${brl(valorNf)}</td></tr>
  <tr><td><b>Alíquota do ISS</b></td><td class="num">5,00%</td></tr>
  <tr><td><b>Valor do ISS</b></td><td class="num">${brl(valorNf * 0.05)}</td></tr>
  <tr><td><b>ISS retido na fonte</b></td><td class="num">Não</td></tr>
  <tr class="total"><td>Valor líquido da nota</td><td class="num">${brl(valorNf)}</td></tr>
</table>

<p class="clausula">Valor por extenso: ${extenso(valorNf)}.</p>
${RODAPE}`;

const DOCS: [string, string][] = [
  ["1 - Ata de Registro de Precos 012-2026", ATA],
  ["2 - Contrato Administrativo 045-2026", CONTRATO],
  ["3 - Nota de Empenho 2026NE000412", EMPENHO],
  ["4 - Nota Fiscal de Servico 1350", NOTA],
];

mkdirSync(SAIDA, { recursive: true });
for (const [nome, html] of DOCS) {
  writeFileSync(join(SAIDA, `${nome}.html`), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${nome}</title></head><body>${html}</body></html>`, "utf8");
}

console.log(`\n${DOCS.length} documentos gerados em:\n  ${SAIDA}\n`);
console.log("Para virar PDF (é o formato que o sistema lê), rode:\n");
for (const [nome] of DOCS) {
  console.log(
    `  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \\\n` +
      `    --no-pdf-header-footer --print-to-pdf="${SAIDA}/${nome}.pdf" "file://${SAIDA}/${nome}.html"`,
  );
}
console.log("");
