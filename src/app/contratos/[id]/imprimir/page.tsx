import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoContrato } from "@/lib/saldo";
import { Logo } from "@/components/Logo";
import { PrintButton } from "./PrintButton";

const ROTULOS_TIPO: Record<string, string> = {
  COMPRAS: "Compras",
  SERVICOS: "Serviços",
  OBRA: "Obra",
  FORNECIMENTO: "Fornecimento",
  SERVICO_CONTINUADO: "Serviço Continuado",
  AQUISICAO: "Aquisição",
  ALUGUEL: "Aluguel",
  CONVENIO: "Convênio",
  OUTRO: "Outro",
};

const ROTULOS_PROCEDIMENTO: Record<string, string> = {
  PREGAO_ELETRONICO: "Pregão Eletrônico",
  PREGAO_PRESENCIAL: "Pregão Presencial",
  CONCORRENCIA: "Concorrência",
  DISPENSA: "Dispensa",
  INEXIGIBILIDADE: "Inexigibilidade",
  TOMADA_PRECOS: "Tomada de Preços",
  CONVITE: "Convite",
};

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default async function ImprimirContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const contrato = await prisma.contrato.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      empresa: true,
      ata: { select: { numero: true, processoAdministrativo: true } },
      itens: { orderBy: { id: "asc" } },
      empenhos: {
        select: {
          id: true,
          numero: true,
          identificador: true,
          status: true,
          dataEmissao: true,
          dataPagamento: true,
          itens: { select: { valorTotal: true } },
        },
        orderBy: { dataEmissao: "asc" },
      },
      termosAditivos: { orderBy: { dataAssinatura: "asc" } },
      apostilamentos: { orderBy: { dataAssinatura: "asc" } },
      reajustes: { orderBy: { dataPedido: "asc" } },
    },
  });
  if (!contrato) notFound();

  const saldo = await calcularSaldoContrato(id);
  const valorTotal = saldo.valorTotal;
  const valorExecutado = saldo.valorUsado;
  const valorPago = contrato.empenhos
    .filter((e) => e.status === "PAGO")
    .reduce((s, e) => s + e.itens.reduce((ss, i) => ss + i.valorTotal, 0), 0);
  const valorAReceber = valorExecutado - valorPago;

  return (
    <>
      {/* Header de tela (não imprime) */}
      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href={`/contratos/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao contrato
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Pré-visualização do extrato</span>
            <PrintButton />
          </div>
        </div>
      </div>

      {/* Folha do extrato */}
      <main className="mx-auto max-w-5xl bg-white p-10 text-slate-900 print:p-0">
        {/* Cabeçalho da folha */}
        <header className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
          <div>
            <div className="text-slate-900">
              <Logo variant="xs" />
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              CP System · Extrato de Contrato
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Gerado em {new Date().toLocaleString("pt-BR")} · Documento auditável
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Nº/Ano</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{contrato.numero}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {ROTULOS_TIPO[contrato.tipo] || contrato.tipo}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                contrato.vigenciaFim < new Date()
                  ? "bg-red-100 text-red-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {contrato.vigenciaFim < new Date() ? "Vencido" : "Vigente"}
            </span>
          </div>
        </header>

        {/* Partes */}
        <section className="mt-7 grid grid-cols-2 gap-6">
          <BlocoExtrato titulo="Contratada (Fornecedora)">
            <p className="text-sm font-bold">{contrato.empresa.razaoSocial}</p>
            {contrato.empresa.nomeFantasia && (
              <p className="text-xs text-slate-600">{contrato.empresa.nomeFantasia}</p>
            )}
            <p className="mt-2 text-xs">
              <strong>CNPJ:</strong> {formatarCnpj(contrato.empresa.cnpj)}
            </p>
            <p className="text-xs">
              <strong>Endereço:</strong> {contrato.empresa.endereco}
            </p>
            <p className="text-xs">
              <strong>E-mail:</strong> {contrato.empresa.email} · <strong>Tel:</strong>{" "}
              {contrato.empresa.telefones}
            </p>
          </BlocoExtrato>
          <BlocoExtrato titulo="Contratante (Órgão Público)">
            <p className="text-sm font-bold">{contrato.orgaoNome}</p>
            <p className="mt-2 text-xs">
              <strong>CNPJ:</strong> {formatarCnpj(contrato.orgaoCnpj)}
            </p>
            <p className="text-xs">
              <strong>Endereço:</strong> {contrato.orgaoEndereco}
            </p>
            {(contrato.orgaoEmail || contrato.orgaoTelefone) && (
              <p className="text-xs">
                {contrato.orgaoEmail && (
                  <>
                    <strong>E-mail:</strong> {contrato.orgaoEmail}
                  </>
                )}
                {contrato.orgaoEmail && contrato.orgaoTelefone && " · "}
                {contrato.orgaoTelefone && (
                  <>
                    <strong>Tel:</strong> {contrato.orgaoTelefone}
                  </>
                )}
              </p>
            )}
          </BlocoExtrato>
        </section>

        {/* Objeto */}
        <section className="mt-6">
          <H>Objeto</H>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{contrato.objeto}</p>
        </section>

        {/* Dados do contrato */}
        <section className="mt-6">
          <H>Dados do contrato</H>
          <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2 text-xs">
            <Linha label="Processo administrativo" valor={contrato.processoAdministrativo} />
            <Linha label="Procedimento de seleção" valor={ROTULOS_PROCEDIMENTO[contrato.procedimentoSelecao]} />
            <Linha label="Nº licitação" valor={contrato.numeroLicitacao || "—"} />
            <Linha label="Nota de empenho de suporte" valor={contrato.numeroNotaEmpenho || "—"} />
            <Linha
              label="Ata de origem"
              valor={contrato.ata ? `Ata ${contrato.ata.numero}` : "Contrato direto"}
            />
            <Linha label="Tipo" valor={ROTULOS_TIPO[contrato.tipo] || contrato.tipo} />
          </div>
        </section>

        {/* Histórico de vigência e saldos */}
        <section className="mt-6">
          <H>Histórico de vigência e saldos</H>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Vigência</p>
              <p className="mt-1 text-sm font-bold">
                {contrato.vigenciaInicio.toLocaleDateString("pt-BR")} até{" "}
                {contrato.vigenciaFim.toLocaleDateString("pt-BR")}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Assinatura: {contrato.dataAssinatura.toLocaleDateString("pt-BR")}
                {contrato.dataPublicacao &&
                  ` · Publicação: ${contrato.dataPublicacao.toLocaleDateString("pt-BR")}`}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Prazos</p>
              <p className="mt-1 text-sm font-bold">
                {contrato.prazoEntregaDias ? `${contrato.prazoEntregaDias}d entrega` : "—"} ·{" "}
                {contrato.prazoPagamentoDias ? `${contrato.prazoPagamentoDias}d pagamento` : "—"}
              </p>
            </div>
          </div>

          {/* Resumo financeiro */}
          <table className="mt-4 w-full text-xs">
            <tbody>
              <ResumoLinha label="Valor total contratado" valor={brl(valorTotal)} forte />
              <ResumoLinha label="Valor executado (empenhado)" valor={brl(valorExecutado)} />
              <ResumoLinha label="Valor pago" valor={brl(valorPago)} cor="text-emerald-700" />
              <ResumoLinha label="Valor a receber" valor={brl(valorAReceber)} cor="text-amber-700" />
              <ResumoLinha
                label="Saldo a executar"
                valor={brl(saldo.valorDisponivel)}
                forte
                cor="text-blue-700"
              />
            </tbody>
          </table>
        </section>

        {/* Itens */}
        <section className="mt-6">
          <H>Itens contratados</H>
          <table className="mt-3 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Descrição</th>
                <th className="py-2 pr-2 text-right font-semibold">Qtd.</th>
                <th className="py-2 pr-2 text-left font-semibold">Un.</th>
                <th className="py-2 pr-2 text-right font-semibold">Valor unit.</th>
                <th className="py-2 text-right font-semibold">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {contrato.itens.map((it, i) => (
                <tr key={it.id} className="border-b border-slate-200">
                  <td className="py-2 pr-2 text-slate-500">{i + 1}</td>
                  <td className="py-2 pr-2">
                    {it.descricao}
                    {it.marca && <span className="ml-1 text-slate-500">({it.marca})</span>}
                  </td>
                  <td className="py-2 pr-2 text-right">{it.quantidade}</td>
                  <td className="py-2 pr-2">{it.unidade}</td>
                  <td className="py-2 pr-2 text-right">{brl(it.valorUnitario)}</td>
                  <td className="py-2 text-right font-medium">{brl(it.valorTotal)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-900 text-sm font-bold">
                <td colSpan={5} className="py-2 text-right">
                  TOTAL
                </td>
                <td className="py-2 text-right">{brl(valorTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Fornecimento (empenhos) */}
        {contrato.empenhos.length > 0 && (
          <section className="mt-6">
            <H>Fornecimento (Notas de Empenho)</H>
            <table className="mt-3 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-2 pr-2 font-semibold">Nº NE</th>
                  <th className="py-2 pr-2 font-semibold">Identificação</th>
                  <th className="py-2 pr-2 font-semibold">Emissão</th>
                  <th className="py-2 pr-2 font-semibold">Status</th>
                  <th className="py-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {contrato.empenhos.map((e) => {
                  const valor = e.itens.reduce((s, i) => s + i.valorTotal, 0);
                  return (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-medium">{e.numero}</td>
                      <td className="py-2 pr-2">{e.identificador || "—"}</td>
                      <td className="py-2 pr-2">{e.dataEmissao.toLocaleDateString("pt-BR")}</td>
                      <td className="py-2 pr-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            e.status === "PAGO"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium">{brl(valor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Aditivos / Apostilamentos / Reajustes */}
        {(contrato.termosAditivos.length > 0 ||
          contrato.apostilamentos.length > 0 ||
          contrato.reajustes.length > 0) && (
          <section className="mt-6">
            <H>Eventos contratuais</H>
            <ul className="mt-3 space-y-2 text-xs">
              {contrato.termosAditivos.map((a) => (
                <li key={a.id} className="flex items-start gap-2 border-l-2 border-violet-400 pl-3">
                  <span className="font-semibold">Aditivo {a.numero}</span>
                  <span className="text-slate-500">
                    {a.dataAssinatura.toLocaleDateString("pt-BR")} · {a.objeto}
                  </span>
                </li>
              ))}
              {contrato.apostilamentos.map((a) => (
                <li key={a.id} className="flex items-start gap-2 border-l-2 border-blue-400 pl-3">
                  <span className="font-semibold">Apostilamento {a.numero}</span>
                  <span className="text-slate-500">
                    {a.dataAssinatura.toLocaleDateString("pt-BR")} · {a.objeto}
                  </span>
                </li>
              ))}
              {contrato.reajustes.map((r) => (
                <li key={r.id} className="flex items-start gap-2 border-l-2 border-emerald-400 pl-3">
                  <span className="font-semibold">Reajuste {r.percentual}%</span>
                  <span className="text-slate-500">
                    {r.dataPedido.toLocaleDateString("pt-BR")} · {r.indice}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Rodapé */}
        <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500">
          <p>
            <strong>CP System</strong> · Gestão pós-licitação sob a Lei 14.133/2021 · Documento gerado em{" "}
            {new Date().toLocaleString("pt-BR")}
          </p>
          <p className="mt-1">
            Este extrato é gerado automaticamente a partir dos dados cadastrados na plataforma.
          </p>
        </footer>
      </main>

      {/* CSS de impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
        }
      `}</style>
    </>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-slate-200 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
      {children}
    </h2>
  );
}

function BlocoExtrato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{titulo}</p>
      {children}
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm">{valor}</p>
    </div>
  );
}

function ResumoLinha({
  label,
  valor,
  forte,
  cor,
}: {
  label: string;
  valor: string;
  forte?: boolean;
  cor?: string;
}) {
  return (
    <tr className={forte ? "border-b-2 border-slate-300" : "border-b border-slate-100"}>
      <td className={`py-1.5 ${forte ? "font-bold" : ""}`}>{label}</td>
      <td className={`py-1.5 text-right font-bold ${cor || "text-slate-900"}`}>{valor}</td>
    </tr>
  );
}
