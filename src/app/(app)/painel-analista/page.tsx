import Link from "next/link";
import { Wallet, TrendingUp, Briefcase, AlertCircle, Receipt } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularComissaoAnalista, listarExecucoesDoVinculo } from "@/lib/comissaoB2G";
import { brl, formatarCnpj } from "@/lib/validators";
import { PercentualForm } from "./PercentualForm";

const COR_STATUS_EMPENHO: Record<string, string> = {
  EMPENHADO: "bg-slate-100 text-slate-700",
  PEDIDO_RECEBIDO: "bg-blue-100 text-blue-700",
  EM_TRANSITO: "bg-indigo-100 text-indigo-700",
  ENTREGUE: "bg-violet-100 text-violet-700",
  NF_EMITIDA: "bg-amber-100 text-amber-800",
  NF_ENCAMINHADA: "bg-orange-100 text-orange-800",
  PAGO: "bg-emerald-100 text-emerald-800",
};

// Status simplificado pra UI do analista (Emitida/Pendente/Paga)
function statusSimples(s: string): "Emitida" | "Pendente" | "Paga" {
  if (s === "PAGO") return "Paga";
  if (s === "EMPENHADO") return "Emitida";
  return "Pendente";
}

export default async function PainelAnalistaPage({
  searchParams,
}: {
  searchParams: Promise<{ vinculo?: string; cnpj?: string }>;
}) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;

  if (usuario.conta.tipo !== "ANALISTA") {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <Wallet className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Painel exclusivo de analistas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta área é exclusiva para contas do tipo Analista de Licitação.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Sua conta é do tipo <strong>{usuario.conta.tipo}</strong>. Pra gerenciar analistas vinculados,{" "}
          <Link href="/vinculos" className="text-blue-700 hover:underline">vá em Vínculos</Link>.
        </p>
      </div>
    );
  }

  const analista = await prisma.analista.findUnique({ where: { contaId: usuario.contaId } });
  if (!analista) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Perfil de analista não encontrado</h1>
        <p className="mt-2 text-sm text-slate-600">Entre em contato com o suporte.</p>
      </div>
    );
  }

  const consolidado = await calcularComissaoAnalista(analista.id);
  const vinculoSelecionado = sp.vinculo
    ? consolidado.empresas.find((e) => e.vinculoId === sp.vinculo)
    : null;
  const execucoes = vinculoSelecionado ? await listarExecucoesDoVinculo(vinculoSelecionado.vinculoId) : [];
  const cnpjFiltro = sp.cnpj || "";
  const execucoesFiltradas = cnpjFiltro
    ? execucoes.filter((e) => e.empresa.cnpj === cnpjFiltro)
    : execucoes;
  const cnpjsDoVinculo = vinculoSelecionado
    ? Array.from(new Set(execucoes.map((e) => e.empresa.cnpj))).map((cnpj) => {
        const exec = execucoes.find((e) => e.empresa.cnpj === cnpj);
        return { cnpj, nome: exec!.empresa.nomeFantasia || exec!.empresa.razaoSocial };
      })
    : [];

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50">
          <Wallet className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Painel do analista</h1>
          <p className="mt-1 text-sm text-slate-600">
            Olá {analista.nomeCompleto.split(" ")[0]} — {consolidado.totalEmpresas} empresa(s) vinculada(s).
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card titulo="Comissão recebida" valor={brl(consolidado.totalComissaoRecebida)} cor="emerald" sub="execuções pagas após o vínculo" />
        <Card titulo="Comissão a receber" valor={brl(consolidado.totalComissaoAReceber)} cor="amber" sub="execuções pendentes" />
        <Card titulo="Carteira contratada" valor={brl(consolidado.totalCarteiraContratada)} sub="atas + contratos vigentes" />
        <Card titulo="Fixo mensal ativo" valor={brl(consolidado.totalFixoMensalAtivo)} sub={`${consolidado.empresas.filter((e) => e.status === "ATIVO").length} vínculos ativos`} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Empresas vinculadas</h2>
        {consolidado.empresas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Nenhuma empresa vinculou você ainda</h3>
            <p className="mt-2 text-sm text-slate-600">
              Quando uma empresa fornecedora cadastrar você como analista responsável, ela aparece aqui.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Compartilhe seu CPF: <strong>{formatarCpf(analista.cpf)}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {consolidado.empresas.map((e) => {
              const ativo = e.vinculoId === sp.vinculo;
              return (
                <div
                  key={e.vinculoId}
                  className={`rounded-xl border bg-white p-5 ${ativo ? "border-blue-400 shadow-sm" : "border-slate-200"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{e.empresaPrincipalNome}</h3>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                            e.status === "ATIVO" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {e.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          {e.cnpjsCount} CNPJ{e.cnpjsCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Vínculo desde {e.dataInicio.toLocaleDateString("pt-BR")} · {e.totalExecucoes} execuções ({e.totalExecucoesPagas} pagas)
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Recebido</p>
                          <p className="font-bold text-emerald-700">{brl(e.comissaoRecebida)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">A receber</p>
                          <p className="font-bold text-amber-700">{brl(e.comissaoAReceber)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Carteira</p>
                          <p className="font-bold text-slate-900">{brl(e.carteiraContratada)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Comissão</p>
                        {e.status === "ATIVO" ? (
                          <PercentualForm vinculoId={e.vinculoId} valorAtual={e.percentual} />
                        ) : (
                          <p className="text-sm font-bold">{e.percentual}%</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Fixo mensal</p>
                        <p className="text-sm font-medium">{brl(e.fixoMensal)}</p>
                      </div>
                      <Link
                        href={ativo ? "/painel-analista" : `/painel-analista?vinculo=${e.vinculoId}`}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                          ativo
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {ativo ? "Esconder execuções" : "Ver execuções"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {vinculoSelecionado && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Execuções de {vinculoSelecionado.empresaPrincipalNome} ({execucoesFiltradas.length})
            </h2>
            {cnpjsDoVinculo.length > 1 && (
              <select
                defaultValue={cnpjFiltro}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  if (e.target.value) url.searchParams.set("cnpj", e.target.value);
                  else url.searchParams.delete("cnpj");
                  window.location.href = url.toString();
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="">Todos os CNPJs</option>
                {cnpjsDoVinculo.map((c) => (
                  <option key={c.cnpj} value={c.cnpj}>
                    {c.nome} ({formatarCnpj(c.cnpj)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {execucoesFiltradas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Nenhuma execução nesse filtro.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Identificador</th>
                    <th className="px-4 py-2 text-left">CNPJ</th>
                    <th className="px-4 py-2 text-left">Órgão</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-right">Comissão ({vinculoSelecionado.percentual}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {execucoesFiltradas.map((e) => {
                    const valor = e.itens.reduce((s, i) => s + i.valorTotal, 0);
                    const comissao = valor * (vinculoSelecionado.percentual / 100);
                    const ss = statusSimples(e.status);
                    return (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">
                          <div className="font-medium">{e.identificador || `Empenho ${e.numero}`}</div>
                          <div className="text-[10px] text-slate-500">{e.objeto.slice(0, 50)}</div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600 font-mono">{formatarCnpj(e.empresa.cnpj)}</td>
                        <td className="px-4 py-2 text-xs">{e.orgaoNome}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR_STATUS_EMPENHO[e.status]}`}>
                            {ss}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">{brl(valor)}</td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            ss === "Paga" ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {brl(comissao)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Card({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub: string; cor?: "emerald" | "amber" }) {
  const corCls = cor === "emerald" ? "text-emerald-700" : cor === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold ${corCls}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
