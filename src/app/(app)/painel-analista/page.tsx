import Link from "next/link";
import { Wallet, TrendingUp, Briefcase, AlertCircle, Receipt, Coins } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularComissaoAnalista, listarExecucoesDoVinculo } from "@/lib/comissaoB2G";
import { brl, formatarCnpj } from "@/lib/validators";
import { PercentualForm } from "./PercentualForm";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { KPI } from "@/components/ui/KPI";

const STATUS_BADGE: Record<string, string> = {
  EMPENHADO: "b-empenhado",
  PEDIDO_RECEBIDO: "b-pedido",
  EM_TRANSITO: "b-transito",
  ENTREGUE: "b-entregue",
  NF_EMITIDA: "b-nf-emitida",
  NF_ENCAMINHADA: "b-nf-encam",
  PAGO: "b-entregue",
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
      <PageHeader
        eyebrow="Painel · Analista de licitações"
        titulo={`Olá, ${analista.nomeCompleto.split(" ")[0]}.`}
        subtitulo={`${consolidado.totalEmpresas} empresa(s) vinculada(s) — comissões, carteira e atividade consolidada.`}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <KPI tone="mint" icon={Wallet} label="Comissão recebida" value={brl(consolidado.totalComissaoRecebida)} meta="execuções pagas após o vínculo" />
        <KPI tone="primary" icon={Coins} label="Comissão a receber" value={brl(consolidado.totalComissaoAReceber)} meta="execuções pendentes" />
        <KPI tone="lavender" icon={Briefcase} label="Carteira contratada" value={brl(consolidado.totalCarteiraContratada)} meta="atas + contratos vigentes" />
        <KPI tone="sky" icon={Receipt} label="Fixo mensal ativo" value={brl(consolidado.totalFixoMensalAtivo)} meta={`${consolidado.empresas.filter((e) => e.status === "ATIVO").length} vínculos ativos`} />
      </div>

      <section className="mt-8">
        <h2
          className="mb-3 text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          Empresas vinculadas
        </h2>
        {consolidado.empresas.length === 0 ? (
          <div
            className="glass-tile rounded-[20px] p-12 text-center"
            style={{ border: "0.5px dashed var(--hairline)" }}
          >
            <Briefcase className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
            <h3 className="mt-4 text-[18px] font-extrabold" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
              Nenhuma empresa vinculou você ainda
            </h3>
            <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
              Quando uma empresa fornecedora cadastrar você como analista responsável, ela aparece aqui.
            </p>
            <p className="mt-3 text-xs" style={{ color: "var(--text-mute)" }}>
              Compartilhe seu CPF:{" "}
              <strong style={{ color: "var(--primary-deep)" }}>{formatarCpf(analista.cpf)}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {consolidado.empresas.map((e) => {
              const ativo = e.vinculoId === sp.vinculo;
              return (
                <div
                  key={e.vinculoId}
                  className={`glass-tile rounded-[18px] px-5 py-5 ${ativo ? "t-primary" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-[17px] font-extrabold"
                          style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
                        >
                          {e.empresaPrincipalNome}
                        </h3>
                        <span className={`badge ${e.status === "ATIVO" ? "b-entregue" : "b-empenhado"}`}>
                          {e.status}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-soft)" }}>
                          {e.cnpjsCount} CNPJ{e.cnpjsCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
                        Vínculo desde {e.dataInicio.toLocaleDateString("pt-BR")} · {e.totalExecucoes} execuções ({e.totalExecucoesPagas} pagas)
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p
                            className="text-[10px] font-bold uppercase"
                            style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
                          >
                            Recebido
                          </p>
                          <p className="text-[15px] font-extrabold tabular" style={{ color: "var(--mint-deep)" }}>
                            {brl(e.comissaoRecebida)}
                          </p>
                        </div>
                        <div>
                          <p
                            className="text-[10px] font-bold uppercase"
                            style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
                          >
                            A receber
                          </p>
                          <p className="text-[15px] font-extrabold tabular" style={{ color: "var(--primary-deep)" }}>
                            {brl(e.comissaoAReceber)}
                          </p>
                        </div>
                        <div>
                          <p
                            className="text-[10px] font-bold uppercase"
                            style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
                          >
                            Carteira
                          </p>
                          <p className="text-[15px] font-extrabold tabular" style={{ color: "var(--text)" }}>
                            {brl(e.carteiraContratada)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div>
                        <p
                          className="text-[10px] font-bold uppercase"
                          style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
                        >
                          Comissão
                        </p>
                        {e.status === "ATIVO" ? (
                          <PercentualForm vinculoId={e.vinculoId} valorAtual={e.percentual} />
                        ) : (
                          <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>{e.percentual}%</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className="text-[10px] font-bold uppercase"
                          style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
                        >
                          Fixo mensal
                        </p>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-soft)" }}>
                          {brl(e.fixoMensal)}
                        </p>
                      </div>
                      <Link
                        href={ativo ? "/painel-analista" : `/painel-analista?vinculo=${e.vinculoId}`}
                        className={ativo ? "btn-primary" : "btn-secondary"}
                        style={ativo ? { height: "32px", padding: "0 14px", fontSize: "12px" } : { height: "32px", padding: "0 14px", fontSize: "12px" }}
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
            <h2
              className="text-[12px] font-bold uppercase"
              style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
            >
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
                className="rounded-[10px] px-3 py-1.5 text-xs"
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
            <p
              className="glass-tile rounded-[16px] p-6 text-center text-sm"
              style={{ color: "var(--text-soft)", border: "0.5px dashed var(--hairline)" }}
            >
              Nenhuma execução nesse filtro.
            </p>
          ) : (
            <div className="glass overflow-hidden rounded-[20px]">
              <table className="table-glass">
                <thead>
                  <tr>
                    <th>Identificador</th>
                    <th>CNPJ</th>
                    <th>Órgão</th>
                    <th>Status</th>
                    <th className="num">Valor</th>
                    <th className="num">Comissão ({vinculoSelecionado.percentual}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {execucoesFiltradas.map((e) => {
                    const valor = e.itens.reduce((s, i) => s + i.valorTotal, 0);
                    const comissao = valor * (vinculoSelecionado.percentual / 100);
                    const ss = statusSimples(e.status);
                    return (
                      <tr key={e.id}>
                        <td>
                          <div className="strong" style={{ color: "var(--text)" }}>
                            {e.identificador || `Empenho ${e.numero}`}
                          </div>
                          <div className="text-[11px]" style={{ color: "var(--text-mute)" }}>
                            {e.objeto.slice(0, 50)}
                          </div>
                        </td>
                        <td className="text-xs font-mono">{formatarCnpj(e.empresa.cnpj)}</td>
                        <td className="text-xs">{e.orgaoNome}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[e.status] ?? "b-empenhado"}`}>{ss}</span>
                        </td>
                        <td className="num strong">{brl(valor)}</td>
                        <td
                          className="num"
                          style={{
                            fontWeight: 700,
                            color: ss === "Paga" ? "var(--mint-deep)" : "var(--primary-deep)",
                          }}
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

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
