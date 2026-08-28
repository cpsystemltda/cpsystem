import Link from "next/link";
import { AlertTriangle, ArrowRight, FileText, Receipt } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lerEmpresaSelecionada } from "@/lib/empresaContexto";

/**
 * Controle de notas — o que foi entregue e ainda não tem nota registrada.
 *
 * Regina 28/08, ao escolher controle em vez de emissão: "o CP System nunca toca
 * no documento fiscal, ele cuida de tudo em volta — que é onde o dinheiro do
 * cliente realmente se perde".
 *
 * A conta é simples e é a que ninguém faz: entrega feita sem nota emitida é
 * dinheiro entregue que ainda não pode ser cobrado. Enquanto a nota não sai, o
 * prazo do órgão nem começou a correr.
 */
export const dynamic = "force-dynamic";

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasDesde(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default async function NotasPage() {
  const usuario = await exigirUsuario();
  const empresaSelecionada = await lerEmpresaSelecionada();

  const filtroEmpresa = empresaSelecionada
    ? { empresaId: empresaSelecionada }
    : { empresa: { contaId: usuario.contaId } };

  const [pendentes, comNota] = await Promise.all([
    prisma.empenho.findMany({
      where: { ...filtroEmpresa, dataEntrega: { not: null }, dataNfEmitida: null },
      orderBy: { dataEntrega: "asc" },
      select: {
        id: true, numero: true, orgaoNome: true, dataEntrega: true, prazoPagamentoDias: true,
        itens: { select: { valorTotal: true } },
        empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      },
    }),
    prisma.empenho.findMany({
      where: { ...filtroEmpresa, dataNfEmitida: { not: null }, dataPagamento: null },
      orderBy: { dataNfEmitida: "asc" },
      take: 30,
      select: {
        id: true, numero: true, orgaoNome: true, dataNfEmitida: true, prazoPagamentoDias: true,
        notasFiscais: { select: { numero: true, valorServicos: true, pdfUrl: true }, take: 1, orderBy: { criadoEm: "desc" } },
        itens: { select: { valorTotal: true } },
      },
    }),
  ]);

  const totalPendente = pendentes.reduce(
    (s, e) => s + e.itens.reduce((t, i) => t + i.valorTotal, 0),
    0,
  );
  const totalAguardando = comNota.reduce(
    (s, e) => s + (e.notasFiscais[0]?.valorServicos ?? e.itens.reduce((t, i) => t + i.valorTotal, 0)),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
        Execução · Controle de notas
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
        Notas a emitir e a receber
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Entrega feita sem nota é dinheiro entregue que ainda não pode ser cobrado — enquanto a nota
        não sai, o prazo de pagamento do órgão nem começou a correr.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Entregue, sem nota
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-amber-900">
            {brl(totalPendente)}
          </p>
          <p className="text-xs text-amber-800">
            {pendentes.length} {pendentes.length === 1 ? "empenho" : "empenhos"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Com nota, aguardando pagamento
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">
            {brl(totalAguardando)}
          </p>
          <p className="text-xs text-slate-500">
            {comNota.length} {comNota.length === 1 ? "empenho" : "empenhos"}
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Receipt className="h-4 w-4" /> Pendente de nota
        </h2>

        {pendentes.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Nada pendente. Toda entrega registrada já tem nota lançada.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pendentes.map((e) => {
              const valor = e.itens.reduce((t, i) => t + i.valorTotal, 0);
              const dias = e.dataEntrega ? diasDesde(e.dataEntrega) : 0;
              // 5 dias é o ponto em que já não é esquecimento recente: passou
              // uma semana útil e a nota continua sem sair.
              const atencao = dias >= 5;
              return (
                <li key={e.id}>
                  <Link
                    href={`/execucao/${e.id}`}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition hover:shadow-sm ${
                      atencao ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        Empenho {e.numero}
                        {atencao && (
                          <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <AlertTriangle className="h-3 w-3" /> {dias} dias sem nota
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">{e.orgaoNome}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Entregue em {e.dataEntrega?.toLocaleDateString("pt-BR")}
                        {e.empresa.nomeFantasia ? ` · ${e.empresa.nomeFantasia}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold tabular-nums text-slate-900">
                        {brl(valor)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <FileText className="h-4 w-4" /> Com nota, aguardando o órgão pagar
        </h2>

        {comNota.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Nenhuma nota aguardando pagamento no momento.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[620px] text-sm">
              {/* Igor 28/08: "o número da nota fiscal é o número mais importante
                  pra aparecer" — e a coluna do empenho competia com ele por
                  atenção. A nota virou a primeira coluna; o empenho continua
                  presente, discreto, embaixo do órgão, porque é por ele que se
                  navega pro detalhe. */}
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nota fiscal</th>
                  <th className="px-4 py-3 text-left font-medium">Órgão</th>
                  <th className="px-4 py-3 text-left font-medium">Prazo do órgão</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {comNota.map((e) => {
                  const nf = e.notasFiscais[0];
                  const dias = e.prazoPagamentoDias ?? 30;
                  const limite = e.dataNfEmitida
                    ? new Date(e.dataNfEmitida.getTime() + dias * 86400000)
                    : null;
                  const atrasado = limite ? limite.getTime() < Date.now() : false;
                  return (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        {nf?.numero ? (
                          <span className="text-base font-bold tabular-nums text-slate-900">
                            nº {nf.numero}
                          </span>
                        ) : (
                          <Link
                            href={`/execucao/${e.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            informar número
                          </Link>
                        )}
                        {nf?.pdfUrl && (
                          <a href={nf.pdfUrl} target="_blank" rel="noreferrer" className="ms-2 text-xs font-medium text-violet-700 hover:underline">
                            PDF
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {e.orgaoNome}
                        <Link
                          href={`/execucao/${e.id}`}
                          className="mt-0.5 block text-[11px] text-slate-400 hover:text-violet-700 hover:underline"
                        >
                          empenho {e.numero}
                        </Link>
                      </td>
                      <td className={`px-4 py-3 ${atrasado ? "font-semibold text-red-700" : "text-slate-600"}`}>
                        {limite ? limite.toLocaleDateString("pt-BR") : "—"}
                        {atrasado && " · vencido"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {brl(nf?.valorServicos ?? e.itens.reduce((t, i) => t + i.valorTotal, 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
