import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";
import { Logo } from "@/components/Logo";
import { PrintButton } from "./PrintButton";

// Extrato impresso da Ata de Registro de Preços. Clone do extrato do
// Contrato adaptado pro modelo Ata (sem 'Fornecedor', sem prazoPagamento
// que e do contrato derivado, com lista de Contratos derivados em vez
// de empenhos diretos).

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

export default async function ImprimirAtaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const ata = await prisma.ata.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      empresa: true,
      itens: { orderBy: { id: "asc" } },
      orgaos: { orderBy: { tipo: "asc" } },
      contratos: {
        select: {
          id: true,
          numero: true,
          objeto: true,
          orgaoNome: true,
          vigenciaInicio: true,
          vigenciaFim: true,
          itens: { select: { valorTotal: true } },
        },
        orderBy: { vigenciaInicio: "asc" },
      },
      termosAditivos: { orderBy: { dataAssinatura: "asc" } },
      apostilamentos: { orderBy: { dataAssinatura: "asc" } },
    },
  });
  if (!ata) notFound();

  const saldo = await calcularSaldoAta(id);
  const valorTotal = saldo.valorTotal;
  const valorExecutado = saldo.valorUsado;
  const valorDisponivel = saldo.valorDisponivel;

  return (
    <>
      {/* Header de tela (nao imprime) */}
      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href={`/atas/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar à Ata
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Pré-visualização do extrato</span>
            <PrintButton />
          </div>
        </div>
      </div>

      {/* Folha do extrato */}
      <main className="mx-auto max-w-5xl bg-white p-10 text-slate-900 print:p-0">
        {/* Cabecalho */}
        <header className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
          <div>
            <div className="text-slate-900">
              <Logo variant="xs" />
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              CP System · Extrato de Ata de Registro de Preços
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Gerado em {new Date().toLocaleString("pt-BR")} · Documento auditável
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ata Nº</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{ata.numero}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {ROTULOS_TIPO[ata.tipo] || ata.tipo}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                ata.vigenciaFim < new Date()
                  ? "bg-red-100 text-red-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {ata.vigenciaFim < new Date() ? "Vencida" : "Vigente"}
            </span>
          </div>
        </header>

        {/* Partes */}
        <section className="mt-7 grid grid-cols-2 gap-6">
          <BlocoExtrato titulo="Fornecedora Registrada">
            <p className="text-sm font-bold">{ata.empresa.razaoSocial}</p>
            {ata.empresa.nomeFantasia && (
              <p className="text-xs text-slate-600">{ata.empresa.nomeFantasia}</p>
            )}
            <p className="mt-2 text-xs">
              <strong>CNPJ:</strong> {formatarCnpj(ata.empresa.cnpj)}
            </p>
            <p className="text-xs">
              <strong>Endereço:</strong> {ata.empresa.endereco}
            </p>
            <p className="text-xs">
              <strong>E-mail:</strong> {ata.empresa.email} · <strong>Tel:</strong>{" "}
              {ata.empresa.telefones}
            </p>
          </BlocoExtrato>
          <BlocoExtrato titulo="Órgão Gerenciador">
            <p className="text-sm font-bold">{ata.orgaoNome}</p>
            <p className="mt-2 text-xs">
              <strong>CNPJ:</strong> {formatarCnpj(ata.orgaoCnpj)}
            </p>
            <p className="text-xs">
              <strong>Endereço:</strong> {ata.orgaoEndereco}
            </p>
            {(ata.orgaoEmail || ata.orgaoTelefone) && (
              <p className="text-xs">
                {ata.orgaoEmail && (
                  <>
                    <strong>E-mail:</strong> {ata.orgaoEmail}
                  </>
                )}
                {ata.orgaoEmail && ata.orgaoTelefone && " · "}
                {ata.orgaoTelefone && (
                  <>
                    <strong>Tel:</strong> {ata.orgaoTelefone}
                  </>
                )}
              </p>
            )}
          </BlocoExtrato>
        </section>

        {/* Orgaos participantes / caronas */}
        {ata.orgaos.length > 0 && (
          <section className="mt-6">
            <H>Órgãos participantes / Caronas</H>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {ata.orgaos.map((o) => (
                <li key={o.id}>
                  <span className="font-semibold">{o.nome}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {o.tipo === "PARTICIPANTE" ? "Participante" : "Carona"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Objeto */}
        <section className="mt-6">
          <H>Objeto</H>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{ata.objeto}</p>
        </section>

        {/* Dados da ata */}
        <section className="mt-6">
          <H>Dados da Ata</H>
          <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2 text-xs">
            <Linha label="Processo administrativo" valor={ata.processoAdministrativo} />
            <Linha
              label="Procedimento de seleção"
              valor={ROTULOS_PROCEDIMENTO[ata.procedimentoSelecao] || ata.procedimentoSelecao}
            />
            <Linha label="Nº licitação" valor={ata.numeroLicitacao || "—"} />
            <Linha label="ID Ata PNCP" valor={ata.idAtaPncp || "—"} />
            <Linha label="Tipo" valor={ROTULOS_TIPO[ata.tipo] || ata.tipo} />
            <Linha label="Aceita carona" valor={ata.aceitaCarona ? "Sim" : "Não"} />
          </div>
        </section>

        {/* Vigencia e saldos */}
        <section className="mt-6">
          <H>Vigência e saldos</H>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Vigência
              </p>
              <p className="mt-1 text-sm font-bold">
                {ata.vigenciaInicio.toLocaleDateString("pt-BR")} até{" "}
                {ata.vigenciaFim.toLocaleDateString("pt-BR")}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Assinatura: {ata.dataAssinatura.toLocaleDateString("pt-BR")}
                {ata.dataPublicacao &&
                  ` · Publicação: ${ata.dataPublicacao.toLocaleDateString("pt-BR")}`}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Marco do orçamento estimado
              </p>
              <p className="mt-1 text-sm font-bold">
                {ata.marcoOrcamentoEstimado
                  ? ata.marcoOrcamentoEstimado.toLocaleDateString("pt-BR")
                  : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Janela de reajuste: marco + 12 meses
              </p>
            </div>
          </div>

          {/* Resumo financeiro */}
          <table className="mt-4 w-full text-xs">
            <tbody>
              <ResumoLinha label="Valor total registrado" valor={brl(valorTotal)} forte />
              <ResumoLinha
                label="Valor já contratado/executado"
                valor={brl(valorExecutado)}
                cor="text-amber-700"
              />
              <ResumoLinha
                label="Saldo disponível para nova contratação"
                valor={brl(valorDisponivel)}
                forte
                cor="text-emerald-700"
              />
            </tbody>
          </table>
        </section>

        {/* Itens */}
        <section className="mt-6">
          <H>Itens registrados</H>
          <table className="mt-3 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left">
                <th className="py-2 pr-2 font-semibold">Lote</th>
                <th className="py-2 pr-2 font-semibold">Item</th>
                <th className="py-2 pr-2 font-semibold">Descrição</th>
                <th className="py-2 pr-2 text-right font-semibold">Qtd.</th>
                <th className="py-2 pr-2 text-left font-semibold">Un.</th>
                <th className="py-2 pr-2 text-right font-semibold">Valor unit.</th>
                <th className="py-2 text-right font-semibold">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {ata.itens.map((it, i) => (
                <tr key={it.id} className="border-b border-slate-200">
                  <td className="py-2 pr-2 text-slate-500">{it.lote || "—"}</td>
                  <td className="py-2 pr-2 text-slate-500">{it.numero ?? i + 1}</td>
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
                <td colSpan={6} className="py-2 text-right">
                  TOTAL
                </td>
                <td className="py-2 text-right">{brl(valorTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Contratos derivados */}
        {ata.contratos.length > 0 && (
          <section className="mt-6">
            <H>Contratos derivados desta Ata</H>
            <table className="mt-3 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-2 pr-2 font-semibold">Nº</th>
                  <th className="py-2 pr-2 font-semibold">Órgão</th>
                  <th className="py-2 pr-2 font-semibold">Vigência</th>
                  <th className="py-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {ata.contratos.map((c) => {
                  const valor = c.itens.reduce((s, i) => s + i.valorTotal, 0);
                  return (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-medium">{c.numero}</td>
                      <td className="py-2 pr-2">{c.orgaoNome}</td>
                      <td className="py-2 pr-2">
                        {c.vigenciaInicio.toLocaleDateString("pt-BR")} →{" "}
                        {c.vigenciaFim.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 text-right font-medium">{brl(valor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Aditivos / Apostilamentos */}
        {(ata.termosAditivos.length > 0 || ata.apostilamentos.length > 0) && (
          <section className="mt-6">
            <H>Eventos contratuais</H>
            <ul className="mt-3 space-y-2 text-xs">
              {ata.termosAditivos.map((a) => (
                <li key={a.id} className="flex items-start gap-2 border-l-2 border-violet-400 pl-3">
                  <span className="font-semibold">Aditivo {a.numero}</span>
                  <span className="text-slate-500">
                    {a.dataAssinatura.toLocaleDateString("pt-BR")} · {a.objeto}
                  </span>
                </li>
              ))}
              {ata.apostilamentos.map((a) => (
                <li key={a.id} className="flex items-start gap-2 border-l-2 border-blue-400 pl-3">
                  <span className="font-semibold">Apostilamento {a.numero}</span>
                  <span className="text-slate-500">
                    {a.dataAssinatura.toLocaleDateString("pt-BR")} · {a.objeto}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Rodape */}
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

      {/* CSS de impressao */}
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
