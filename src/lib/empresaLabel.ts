import { formatarCnpj } from "@/lib/validators";

export type EmpresaParaLabel = {
  razaoSocial: string;
  nomeFantasia: string | null;
  responsavel: string;
  cnpj: string;
};

// Sempre prefere razaoSocial; so anexa nomeFantasia quando for distinta da
// razao E distinta do responsavel. Existe pra cobrir o caso MEI em que o
// BrasilAPI devolve `nome_fantasia` = nome da pessoa fisica e o autopreenchimento
// grava isso no banco — sem a checagem o seletor mostraria o nome do responsavel.
export function montarLabelEmpresa(e: EmpresaParaLabel): string {
  const razao = e.razaoSocial.trim();
  const fantasia = (e.nomeFantasia ?? "").trim();
  const respNorm = e.responsavel.trim().toLowerCase();

  let nome = razao;
  if (
    fantasia &&
    fantasia.toLowerCase() !== razao.toLowerCase() &&
    fantasia.toLowerCase() !== respNorm
  ) {
    nome = `${razao} (${fantasia})`;
  }
  return `${nome} · CNPJ ${formatarCnpj(e.cnpj)}`;
}
