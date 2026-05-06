/**
 * Lista dos principais bancos brasileiros com código COMPE.
 * Cobre os 30+ mais usados (>99% das contas no Brasil).
 *
 * Formato salvo: "código - nome" (ex: "341 - Itaú Unibanco S.A.")
 * — facilita relatório financeiro e busca posterior.
 */

export type Banco = { codigo: string; nome: string; apelido: string };

export const BANCOS_BR: Banco[] = [
  { codigo: "001", nome: "Banco do Brasil S.A.", apelido: "Banco do Brasil" },
  { codigo: "033", nome: "Banco Santander (Brasil) S.A.", apelido: "Santander" },
  { codigo: "104", nome: "Caixa Econômica Federal", apelido: "Caixa" },
  { codigo: "237", nome: "Banco Bradesco S.A.", apelido: "Bradesco" },
  { codigo: "341", nome: "Itaú Unibanco S.A.", apelido: "Itaú" },
  { codigo: "260", nome: "Nu Pagamentos S.A.", apelido: "Nubank" },
  { codigo: "077", nome: "Banco Inter S.A.", apelido: "Inter" },
  { codigo: "212", nome: "Banco Original S.A.", apelido: "Original" },
  { codigo: "336", nome: "Banco C6 S.A.", apelido: "C6 Bank" },
  { codigo: "208", nome: "Banco BTG Pactual S.A.", apelido: "BTG Pactual" },
  { codigo: "623", nome: "Banco Pan S.A.", apelido: "Pan" },
  { codigo: "655", nome: "Banco Votorantim S.A.", apelido: "Votorantim" },
  { codigo: "422", nome: "Banco Safra S.A.", apelido: "Safra" },
  { codigo: "041", nome: "Banco do Estado do Rio Grande do Sul S.A.", apelido: "Banrisul" },
  { codigo: "004", nome: "Banco do Nordeste do Brasil S.A.", apelido: "Banco do Nordeste" },
  { codigo: "070", nome: "BRB - Banco de Brasília S.A.", apelido: "BRB" },
  { codigo: "748", nome: "Sicredi", apelido: "Sicredi" },
  { codigo: "756", nome: "Sicoob", apelido: "Sicoob" },
  { codigo: "290", nome: "PagSeguro Internet S.A.", apelido: "PagBank" },
  { codigo: "323", nome: "Mercado Pago", apelido: "Mercado Pago" },
  { codigo: "380", nome: "PicPay Servicos S.A.", apelido: "PicPay" },
  { codigo: "335", nome: "Banco Digio S.A.", apelido: "Digio" },
  { codigo: "082", nome: "Banco Topázio S.A.", apelido: "Topázio" },
  { codigo: "184", nome: "Banco Itaú BBA S.A.", apelido: "Itaú BBA" },
  { codigo: "318", nome: "Banco BMG S.A.", apelido: "BMG" },
  { codigo: "643", nome: "Banco Pine S.A.", apelido: "Pine" },
  { codigo: "707", nome: "Banco Daycoval S.A.", apelido: "Daycoval" },
  { codigo: "025", nome: "Banco Alfa S.A.", apelido: "Alfa" },
  { codigo: "037", nome: "Banco do Estado do Pará S.A.", apelido: "Banpará" },
  { codigo: "047", nome: "Banco do Estado de Sergipe S.A.", apelido: "Banese" },
  { codigo: "085", nome: "Cooperativa Central de Crédito Ailos", apelido: "Ailos" },
  { codigo: "133", nome: "Confederação Nacional Cresol", apelido: "Cresol" },
  { codigo: "197", nome: "Stone Pagamentos S.A.", apelido: "Stone" },
  { codigo: "246", nome: "Banco ABC Brasil S.A.", apelido: "ABC Brasil" },
  { codigo: "389", nome: "Banco Mercantil do Brasil S.A.", apelido: "Mercantil" },
  { codigo: "748", nome: "Banco Cooperativo Sicredi S.A.", apelido: "Sicredi" },
  { codigo: "121", nome: "Banco Agibank S.A.", apelido: "Agibank" },
  { codigo: "364", nome: "Gerencianet Pagamentos do Brasil", apelido: "Gerencianet (Efí)" },
  { codigo: "332", nome: "Acesso Soluções de Pagamento S.A.", apelido: "Acesso" },
  { codigo: "274", nome: "Money Plus S.C.M.E.P.P. Ltda", apelido: "Money Plus" },
];

export function buscarBancos(termo: string): Banco[] {
  const t = termo.trim().toLowerCase();
  if (!t) return BANCOS_BR.slice(0, 12); // top 12 mais comuns
  // Busca por código exato OU apelido/nome contendo o termo
  return BANCOS_BR.filter(
    (b) =>
      b.codigo === t ||
      b.codigo.startsWith(t) ||
      b.apelido.toLowerCase().includes(t) ||
      b.nome.toLowerCase().includes(t),
  ).slice(0, 12);
}

export function formatarBancoSalvo(codigo: string, apelido: string): string {
  return `${codigo} - ${apelido}`;
}
