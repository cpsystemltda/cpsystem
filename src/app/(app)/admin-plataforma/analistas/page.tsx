import Link from "next/link";
import { Crown, UserCheck, Users2, Wallet, Sparkles, ArrowUpRight } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { KPI } from "@/components/ui/KPI";

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function tempoNaPlataforma(criadoEm: Date): string {
  const dias = Math.floor((Date.now() - criadoEm.getTime()) / 86400000);
  if (dias < 30) return `${dias}d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses} mes${meses > 1 ? "es" : ""}`;
  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses - anos * 12;
  return `${anos}a${mesesRestantes > 0 ? ` ${mesesRestantes}m` : ""}`;
}

export default async function AdminAnalistasPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          Acesso restrito
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--text-soft)" }}>
          Esta área é exclusiva para gestores da plataforma.
        </p>
      </div>
    );
  }

  // Busca todos os analistas + vínculos + comissões em uma única query
  const analistas = await prisma.analista.findMany({
    include: {
      conta: { select: { id: true, statusAssinatura: true, criadoEm: true } },
      vinculos: {
        include: {
          conta: {
            select: {
              empresas: { select: { nomeFantasia: true, razaoSocial: true } },
              statusAssinatura: true,
            },
          },
          fixosPagos: { where: { paga: true }, select: { valor: true } },
        },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  // Agregações por analista
  type Linha = {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    cpfMascarado: string;
    criadoEm: Date;
    ativo: boolean;
    statusConta: string | null;
    vinculosAtivos: number;
    vinculosEncerrados: number;
    clientesAtendidos: string[];
    fixoMensalAtivo: number;
    fixoPagoAcumulado: number;
    percentualMedio: number;
  };

  const linhas: Linha[] = analistas.map((a) => {
    const ativos = a.vinculos.filter((v) => v.status === "ATIVO");
    const encerrados = a.vinculos.filter((v) => v.status === "ENCERRADO");
    const fixoMensalAtivo = ativos.reduce((s, v) => s + v.fixoMensal, 0);
    const fixoPagoAcumulado = a.vinculos.reduce(
      (s, v) => s + v.fixosPagos.reduce((ss, f) => ss + (f.valor ?? 0), 0),
      0,
    );
    const percentuais = ativos.map((v) => v.percentualComissao).filter((p) => p > 0);
    const percentualMedio = percentuais.length > 0 ? percentuais.reduce((s, p) => s + p, 0) / percentuais.length : 0;
    const clientesAtendidos = ativos
      .map((v) => v.conta.empresas[0]?.nomeFantasia || v.conta.empresas[0]?.razaoSocial)
      .filter(Boolean) as string[];
    return {
      id: a.id,
      nome: a.nomeCompleto,
      email: a.email,
      telefone: a.telefone,
      cpfMascarado: formatarCpf(a.cpf),
      criadoEm: a.criadoEm,
      ativo: a.ativo,
      statusConta: a.conta?.statusAssinatura ?? null,
      vinculosAtivos: ativos.length,
      vinculosEncerrados: encerrados.length,
      clientesAtendidos,
      fixoMensalAtivo,
      fixoPagoAcumulado,
      percentualMedio,
    };
  });

  // KPIs agregados
  const totalAnalistas = linhas.length;
  const ativos = linhas.filter((l) => l.ativo).length;
  const totalVinculosAtivos = linhas.reduce((s, l) => s + l.vinculosAtivos, 0);
  const fixoMensalRedeAtivo = linhas.reduce((s, l) => s + l.fixoMensalAtivo, 0);
  const fixoPagoAcumuladoTotal = linhas.reduce((s, l) => s + l.fixoPagoAcumulado, 0);
  const novosUltimos30 = linhas.filter(
    (l) => Date.now() - l.criadoEm.getTime() < 30 * 86400000,
  ).length;

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <PageHeader
        eyebrow="Adm CP System · Rede"
        titulo="Analistas"
        destaque="cadastrados"
        subtitulo={`${totalAnalistas} analista${totalAnalistas !== 1 ? "s" : ""} na plataforma — visão completa do programa de parceiros.`}
        cta={
          <Link href="/admin-plataforma" className="btn-secondary">
            <Crown className="h-3.5 w-3.5" /> Voltar à visão geral
          </Link>
        }
      />

      {/* KPIs */}
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <KPI tone="primary" icon={UserCheck} label="Total de analistas" value={totalAnalistas} meta={`${ativos} ativos · ${totalAnalistas - ativos} inativos`} />
        <KPI tone="mint" icon={Sparkles} label="Novos (30 dias)" value={novosUltimos30} meta="Cadastrados no último mês" />
        <KPI tone="lavender" icon={Users2} label="Vínculos ativos" value={totalVinculosAtivos} meta="Empresas atendidas pela rede" />
        <KPI tone="sky" icon={Wallet} label="Fixo mensal da rede" value={brl(fixoMensalRedeAtivo)} meta={`Acumulado pago: ${brl(fixoPagoAcumuladoTotal)}`} />
      </div>

      {/* Tabela de analistas */}
      <section className="glass mt-8 overflow-hidden rounded-[20px]">
        <header
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderBottom: "0.5px solid var(--hairline)" }}
        >
          <h2
            className="text-[15px] font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
          >
            Lista de analistas
          </h2>
          <span className="text-xs" style={{ color: "var(--text-soft)" }}>
            Ordenado por data de cadastro (mais recentes primeiro)
          </span>
        </header>
        {linhas.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm" style={{ color: "var(--text-soft)" }}>
            Nenhum analista cadastrado ainda.
          </p>
        ) : (
          <table className="table-glass" style={{ minWidth: "1200px", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "auto", minWidth: "240px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "auto", minWidth: "200px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Analista</th>
                <th className="center">Status</th>
                <th>Tempo</th>
                <th className="num">Vínculos</th>
                <th className="num">% médio</th>
                <th className="num">Fixo/mês</th>
                <th className="num">Acumulado pago</th>
                <th>Clientes ativos</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="strong" style={{ verticalAlign: "top" }}>
                    <div style={{ color: "var(--text)" }}>{l.nome}</div>
                    <div className="text-[11px] font-mono" style={{ color: "var(--text-mute)" }}>
                      {l.cpfMascarado}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-soft)" }}>
                      {l.email}
                    </div>
                  </td>
                  <td className="center">
                    <span className={`badge ${l.ativo ? "b-entregue" : "b-empenhado"}`}>
                      {l.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: "var(--text-soft)" }}>
                    {tempoNaPlataforma(l.criadoEm)}
                    <div className="text-[10px]" style={{ color: "var(--text-mute)" }}>
                      desde {l.criadoEm.toLocaleDateString("pt-BR")}
                    </div>
                  </td>
                  <td className="num strong">
                    {l.vinculosAtivos}
                    {l.vinculosEncerrados > 0 && (
                      <div className="text-[10px] font-normal" style={{ color: "var(--text-mute)" }}>
                        +{l.vinculosEncerrados} encerrado{l.vinculosEncerrados > 1 ? "s" : ""}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {l.percentualMedio > 0 ? `${l.percentualMedio.toFixed(1)}%` : "—"}
                  </td>
                  <td className="num strong">{l.fixoMensalAtivo > 0 ? brl(l.fixoMensalAtivo) : "—"}</td>
                  <td className="num" style={{ color: "var(--mint-deep)", fontWeight: 700 }}>
                    {brl(l.fixoPagoAcumulado)}
                  </td>
                  <td className="text-xs" style={{ color: "var(--text-soft)" }}>
                    {l.clientesAtendidos.length === 0
                      ? "—"
                      : l.clientesAtendidos.slice(0, 2).join(" · ") +
                        (l.clientesAtendidos.length > 2 ? ` +${l.clientesAtendidos.length - 2}` : "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Atalho */}
      <p className="mt-6 text-center text-xs" style={{ color: "var(--text-mute)" }}>
        Cada analista pode ter múltiplos vínculos com empresas fornecedoras. As comissões variáveis (5–10% sobre execuções) são calculadas automaticamente nas execuções com data de pagamento {">"}= data de início do vínculo.
      </p>
    </div>
  );
}
