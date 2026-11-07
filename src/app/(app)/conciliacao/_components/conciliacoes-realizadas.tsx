import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fatoresLegiveis } from "@/lib/conciliacao/fatoresLegiveis";
import { labelInstrumento } from "@/lib/instrumentoLabel";

const ROTULO_STATUS: Record<string, string> = {
  EMPENHADO: "Empenhado",
  PEDIDO_RECEBIDO: "Pedido recebido",
  EM_TRANSITO: "Em trânsito/Em execução",
  ENTREGUE: "Entregue",
  NF_EMITIDA: "NF emitida",
  NF_ENCAMINHADA: "NF encaminhada",
  PAGO: "Pago",
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
/** Data do lançamento é DIA, gravada como meia-noite sem fuso — ver `lista-extratos.tsx`. */
function dia(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function instante(d: Date | null) {
  return d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
}

/**
 * As conciliações já feitas (automáticas ou confirmadas), cada uma com o
 * empenho casado a um clique.
 *
 * C2VENDAS, follow-up de 06/11/2026 (Igor): a empresa faz várias entregas
 * parciais e pediu "um botão clicável, em cada conciliação feita, para que já
 * abra uma tela auxiliar com o empenho casado". Até aqui a tela só mostrava as
 * sugestões pendentes; o que já tinha sido conciliado sumia da vista e só
 * aparecia dentro de cada empenho. O link abre em outra aba de propósito: a
 * pessoa confere o empenho sem perder a lista.
 *
 * O "por quê" ao lado do percentual vem de `fatoresLegiveis`: foi o
 * percentual sozinho que a empresa não entendeu.
 */
export async function ConciliacoesRealizadas({ contaId }: { contaId: string }) {
  const realizadas = await prisma.conciliacao.findMany({
    where: { status: "CONFIRMADA", transacao: { extrato: { contaId } } },
    orderBy: [{ confirmadaEm: "desc" }, { criadoEm: "desc" }],
    take: 30,
    select: {
      id: true,
      score: true,
      fatoresMatch: true,
      empenhoId: true,
      confirmadaEm: true,
      confirmadaPorId: true,
      criadoEm: true,
      transacao: { select: { data: true, valor: true, descricao: true, nomeContraparte: true } },
    },
  });
  if (realizadas.length === 0) return null;

  const ids = Array.from(new Set(realizadas.map((c) => c.empenhoId)));
  const empenhos = await prisma.empenho.findMany({
    where: { id: { in: ids }, empresa: { contaId } },
    select: {
      id: true,
      numero: true,
      instrumento: true,
      orgaoNome: true,
      status: true,
      itens: { select: { valorTotal: true } },
      notasFiscais: { where: { status: "AUTORIZADA" }, select: { numero: true }, orderBy: { criadoEm: "desc" }, take: 1 },
    },
  });
  const porId = new Map(empenhos.map((e) => [e.id, e]));

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-900">Conciliações realizadas ({realizadas.length})</h2>
      <p className="mt-1 text-sm text-slate-600">
        Créditos do extrato já casados com um empenho. Clique em <strong>Abrir empenho</strong> para conferir a entrega, a nota e o pagamento; a aba abre ao lado para você não perder esta lista.
      </p>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Crédito no extrato</th>
              <th className="px-4 py-3">Empenho casado</th>
              <th className="px-4 py-3">Por quê</th>
              <th className="px-4 py-3">Conciliado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {realizadas.map((c) => {
              const e = porId.get(c.empenhoId);
              const valorEmpenho = e ? e.itens.reduce((s, i) => s + i.valorTotal, 0) : 0;
              const fatores = fatoresLegiveis(c.fatoresMatch);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-emerald-700">{brl(c.transacao.valor)}</div>
                    <div className="text-xs text-slate-600">{dia(c.transacao.data)}</div>
                    <div className="mt-0.5 max-w-xs truncate text-xs text-slate-500" title={c.transacao.nomeContraparte ?? c.transacao.descricao}>
                      {c.transacao.nomeContraparte ?? c.transacao.descricao}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {e ? (
                      <>
                        <div className="font-medium text-slate-900">
                          {labelInstrumento(e.instrumento)} {e.numero} — {brl(valorEmpenho)}
                        </div>
                        <div className="max-w-xs truncate text-xs text-slate-600" title={e.orgaoNome}>{e.orgaoNome}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {ROTULO_STATUS[e.status] ?? e.status}
                          {e.notasFiscais[0]?.numero ? ` · NF nº ${e.notasFiscais[0].numero}` : ""}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">Empenho não encontrado (pode ter sido excluído).</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      {Math.round(c.score)}% de match
                    </span>
                    {fatores.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {fatores.map((f) => (
                          <span key={f} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">{f}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {c.confirmadaPorId ? "confirmada por você" : "automática"}
                    </span>
                    <div className="mt-0.5 text-slate-500">{instante(c.confirmadaEm ?? c.criadoEm)}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e && (
                      <Link
                        href={`/execucao/${e.id}?from=conciliacao`}
                        target="_blank"
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Abrir empenho <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
