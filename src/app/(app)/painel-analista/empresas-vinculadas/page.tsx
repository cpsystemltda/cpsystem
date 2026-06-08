import Link from "next/link";
import { AlertCircle, Briefcase, Wallet } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularComissaoAnalista, listarExecucoesDoVinculo } from "@/lib/comissaoB2G";
import { brl, formatarCnpj } from "@/lib/validators";
import { PercentualForm } from "../PercentualForm";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { CnpjFiltroSelect } from "./CnpjFiltroSelect";

// Pagina exclusiva 'Empresas vinculadas'. Regina (05/06): a aba na
// sidebar apontava pra um anchor #empresas-vinculadas dentro do dashboard
// do painel-analista, e nao funcionava de forma confiavel (navegacao
// SPA + scroll). Movido pra rota propria.

const STATUS_BADGE: Record<string, string> = {
  EMPENHADO: "b-empenhado",
  PEDIDO_RECEBIDO: "b-pedido",
  EM_TRANSITO: "b-transito",
  ENTREGUE: "b-entregue",
  NF_EMITIDA: "b-nf-emitida",
  NF_ENCAMINHADA: "b-nf-encam",
  PAGO: "b-entregue",
};

function statusSimples(s: string): "Emitida" | "Pendente" | "Paga" {
  if (s === "PAGO") return "Paga";
  if (s === "EMPENHADO") return "Emitida";
  return "Pendente";
}

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default async function EmpresasVinculadasPage({
  searchParams,
}: {
  searchParams: Promise<{ vinculo?: string; cnpj?: string; analistaId?: string }>;
}) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;

  // Mesmo bloqueio do painel-analista — so analista ou superAdmin.
  if (usuario.conta.tipo !== "ANALISTA" && !usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <Wallet className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
        <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--text)" }}>
          Área exclusiva de analistas
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          Pra gerenciar analistas vinculados,{" "}
          <Link href="/vinculos" style={{ color: "var(--primary-deep)" }} className="font-bold underline">
            vá em Vínculos
          </Link>
          .
        </p>
      </div>
    );
  }

  // Resolve qual analista exibir (espelhando a logica do painel-analista).
  const analista =
    usuario.conta.tipo === "ANALISTA"
      ? await prisma.analista.findUnique({ where: { contaId: usuario.contaId } })
      : sp.analistaId
        ? await prisma.analista.findUnique({ where: { id: sp.analistaId } })
        : null;

  // Super admin sem analistaId — Regina (08/06): antes mostrava "Selecione
  // um analista" sem link, parecia tela quebrada. Agora lista os analistas
  // ativos com link clicavel direto.
  if (!analista && usuario.superAdmin) {
    const analistas = await prisma.analista.findMany({
      where: { ativo: true },
      orderBy: { criadoEm: "desc" },
      include: {
        contasIndicadas: {
          where: { statusAssinatura: "ATIVA" },
          select: { id: true },
        },
      },
    });
    return (
      <div className="mx-auto max-w-4xl px-8 py-8">
        <h1
          className="text-[28px] font-extrabold"
          style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
        >
          Empresas vinculadas
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          Você é super admin — escolha qual analista quer visualizar.
        </p>
        {analistas.length === 0 ? (
          <div
            className="glass-tile mt-8 rounded-[20px] p-12 text-center"
            style={{ border: "0.5px dashed var(--hairline)" }}
          >
            <Briefcase className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
            <p className="mt-4 text-sm" style={{ color: "var(--text-soft)" }}>
              Nenhum analista cadastrado ainda.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {analistas.map((a) => (
              <Link
                key={a.id}
                href={`/painel-analista/empresas-vinculadas?analistaId=${a.id}`}
                className="glass-tile group block rounded-[18px] px-5 py-5 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
                    style={{
                      background: "rgba(212,175,55,0.18)",
                      color: "var(--primary-deep)",
                    }}
                  >
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-[15px] font-extrabold"
                      style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
                    >
                      {a.nomeCompleto}
                    </h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
                      {a.contasIndicadas.length} empresa
                      {a.contasIndicadas.length !== 1 ? "s" : ""} vinculada
                      {a.contasIndicadas.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!analista) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <AlertCircle className="mx-auto h-10 w-10" style={{ color: "var(--primary-deep)" }} />
        <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--text)" }}>
          Perfil de analista não encontrado
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          Entre em contato com o suporte.
        </p>
      </div>
    );
  }

  const consolidado = await calcularComissaoAnalista(analista.id);
  const vinculoSelecionado = sp.vinculo
    ? consolidado.empresas.find((e) => e.vinculoId === sp.vinculo)
    : null;
  const execucoes = vinculoSelecionado
    ? await listarExecucoesDoVinculo(vinculoSelecionado.vinculoId)
    : [];
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
        eyebrow="Painel · Analista"
        titulo="Empresas"
        destaque="vinculadas"
        subtitulo={`${consolidado.empresas.length} vínculo(s) — gerencie comissões, % e execuções por empresa.`}
      />

      <section className="mt-6">
        {consolidado.empresas.length === 0 ? (
          <div
            className="glass-tile rounded-[20px] p-12 text-center"
            style={{ border: "0.5px dashed var(--hairline)" }}
          >
            <Briefcase className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
            <h3
              className="mt-4 text-[18px] font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
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
                  className={`glass-tile rounded-[18px] px-5 py-5 transition hover:-translate-y-0.5 ${ativo ? "t-primary" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-[17px] font-extrabold"
                          style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
                        >
                          <Link
                            href={`/painel-analista/empresa/${e.vinculoId}`}
                            className="hover:underline"
                            title="Ver todas as informações desta empresa"
                          >
                            {e.empresaPrincipalNome}
                          </Link>
                        </h3>
                        <span className={`badge ${e.status === "ATIVO" ? "b-entregue" : "b-empenhado"}`}>
                          {e.status}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-soft)" }}>
                          {e.cnpjsCount} CNPJ{e.cnpjsCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
                        Vínculo desde {e.dataInicio.toLocaleDateString("pt-BR")} · {e.totalExecucoes} execuções (
                        {e.totalExecucoesPagasPeloOrgao} pagas pelo órgão)
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
                          <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
                            {e.percentual}%
                          </p>
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
                        href={
                          ativo
                            ? "/painel-analista/empresas-vinculadas"
                            : `/painel-analista/empresas-vinculadas?vinculo=${e.vinculoId}`
                        }
                        className={ativo ? "btn-primary" : "btn-secondary"}
                        style={{ height: "32px", padding: "0 14px", fontSize: "12px" }}
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
              <CnpjFiltroSelect cnpjs={cnpjsDoVinculo} valor={cnpjFiltro} />
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

