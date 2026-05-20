import Link from "next/link";
import { Wallet, TrendingUp, Briefcase, AlertCircle, Receipt, Coins } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularComissaoAnalista, listarExecucoesDoVinculo } from "@/lib/comissaoB2G";
import { listarComissoesDoAnalista } from "@/lib/comissaoExecucao";
import {
  listarComissoesFixasDoAnalista,
  gerarLinhasComissaoFixaDoAnalista,
} from "@/lib/comissaoFixa";
import { ComissoesVariaveisBloco } from "@/components/ComissoesVariaveisBloco";
import { ComissoesFixasBloco } from "@/components/ComissoesFixasBloco";
import { brl, formatarCnpj } from "@/lib/validators";
import { PercentualForm } from "./PercentualForm";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { KPI } from "@/components/ui/KPI";

// Formato compacto pra valores grandes — evita corte no KPI ("R$ 1,2 Mi" em vez de "R$ 1.234.567,89")
function brlCompacto(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace(".", ",")} Mi`;
  if (n >= 10_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return brl(n);
}

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
  searchParams: Promise<{ vinculo?: string; cnpj?: string; analistaId?: string }>;
}) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;

  // Bloqueio: precisa ser ANALISTA OU superAdmin
  if (usuario.conta.tipo !== "ANALISTA" && !usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <Wallet className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
        <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--text)" }}>
          Painel exclusivo de analistas
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          Esta área é exclusiva para contas do tipo Analista de Licitação.
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-mute)" }}>
          Sua conta é do tipo <strong>{usuario.conta.tipo}</strong>. Pra gerenciar analistas vinculados,{" "}
          <Link href="/vinculos" style={{ color: "var(--primary-deep)" }} className="font-bold underline">vá em Vínculos</Link>.
        </p>
      </div>
    );
  }

  // Resolve qual analista exibir:
  // - ANALISTA logado: o próprio (via contaId)
  // - SUPER ADMIN: pelo query param ?analistaId=X (ou tela de seleção se omisso)
  let analista =
    usuario.conta.tipo === "ANALISTA"
      ? await prisma.analista.findUnique({ where: { contaId: usuario.contaId } })
      : sp.analistaId
        ? await prisma.analista.findUnique({ where: { id: sp.analistaId } })
        : null;

  // Super admin sem analistaId — dashboard consolidado da rede + lista de seleção.
  if (usuario.superAdmin && !analista) {
    const analistas = await prisma.analista.findMany({
      orderBy: { criadoEm: "desc" },
      include: {
        vinculos: {
          include: {
            conta: { select: { id: true, empresas: { select: { id: true } } } },
            fixosPagos: { where: { paga: true }, select: { valor: true } },
          },
        },
      },
    });

    // Agregação consolidada da rede
    const hojeAgora = new Date();
    let totalCarteira = 0;
    let totalComissaoPaga = 0;
    let totalComissaoAPagar = 0;
    let totalFixoMensal = 0;
    let totalFixoPagoAcum = 0;
    let totalVinculosAtivos = 0;
    const contasUnicas = new Set<string>();

    for (const a of analistas) {
      for (const v of a.vinculos) {
        if (v.status === "ATIVO") {
          totalVinculosAtivos++;
          totalFixoMensal += v.fixoMensal;
          contasUnicas.add(v.conta.id);
        }
        totalFixoPagoAcum += v.fixosPagos.reduce((s, f) => s + (f.valor ?? 0), 0);

        const empresaIds = v.conta.empresas.map((e) => e.id);
        if (empresaIds.length === 0) continue;
        // Consulta a Linha B canônica (ComissaoExecucao) em vez de tentar
        // inferir do empenho.status — esse era o bug que somava órgão pagar
        // empresa com empresa pagar comissão.
        const [comissoes, atas, contratos] = await Promise.all([
          prisma.comissaoExecucao.findMany({
            where: { vinculoId: v.id },
            select: {
              status: true,
              valorCalculado: true,
              valorRecebido: true,
              valorBaseEmpenho: true,
              percentual: true,
            },
          }),
          v.status === "ATIVO"
            ? prisma.ata.findMany({
                where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hojeAgora } },
                select: { itens: { select: { valorTotal: true } } },
              })
            : Promise.resolve([]),
          v.status === "ATIVO"
            ? prisma.contrato.findMany({
                where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hojeAgora } },
                select: { itens: { select: { valorTotal: true } } },
              })
            : Promise.resolve([]),
        ]);
        for (const c of comissoes) {
          if (c.status === "PAGO") {
            totalComissaoPaga += c.valorRecebido || c.valorCalculado;
          } else if (c.status === "PAGO_PARCIAL") {
            totalComissaoPaga += c.valorRecebido;
            if (v.status === "ATIVO") {
              totalComissaoAPagar += Math.max(0, c.valorCalculado - c.valorRecebido);
            }
          } else if (c.status === "A_RECEBER" || c.status === "ATRASADO") {
            if (v.status === "ATIVO") totalComissaoAPagar += c.valorCalculado;
          }
          // AGUARDANDO_ORGAO: não conta como "a pagar" — empresa só deve
          // a comissão depois que o órgão pagar a ela.
        }
        if (v.status === "ATIVO") {
          totalCarteira +=
            atas.reduce((s, a2) => s + a2.itens.reduce((ss, it) => ss + it.valorTotal, 0), 0) +
            contratos.reduce((s, c) => s + c.itens.reduce((ss, it) => ss + it.valorTotal, 0), 0);
        }
      }
    }

    const totalAnalistas = analistas.length;
    const ativos = analistas.filter((a) => a.ativo).length;
    const novos30 = analistas.filter((a) => Date.now() - a.criadoEm.getTime() < 30 * 86400000).length;

    return (
      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <PageHeader
          eyebrow="Adm CP System · Rede"
          titulo="Painel da rede de"
          destaque="Analistas"
          subtitulo={`Visão geral consolidada de ${totalAnalistas} analista${totalAnalistas !== 1 ? "s" : ""} cadastrado${totalAnalistas !== 1 ? "s" : ""} — depois selecione um para visualizar o painel individual.`}
          cta={
            <Link href="/admin-plataforma/analistas" className="btn-secondary">
              Ver listagem completa →
            </Link>
          }
        />

        {/* KPIs consolidados — escala da rede */}
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <KPI tone="primary" icon={Wallet} label="Analistas" value={totalAnalistas} meta={`${ativos} ativos · ${novos30} novos (30d)`} />
          <KPI tone="lavender" icon={Briefcase} label="Empresas atendidas" value={contasUnicas.size} meta={`${totalVinculosAtivos} vínculo(s) ativo(s)`} />
          <KPI tone="mint" icon={Coins} label="Carteira sob gestão" value={brlCompacto(totalCarteira)} meta="atas + contratos vigentes" />
          <KPI tone="sky" icon={Receipt} label="Fixo mensal recorrente" value={brlCompacto(totalFixoMensal)} meta={`Acumulado pago: ${brlCompacto(totalFixoPagoAcum + totalComissaoPaga)}`} />
        </div>

        {/* KPIs financeiros — desembolso */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <KPI tone="mint" icon={Wallet} label="Já pago à rede (acumulado)" value={brlCompacto(totalFixoPagoAcum + totalComissaoPaga)} meta={`Fixo: ${brlCompacto(totalFixoPagoAcum)} · Variável: ${brlCompacto(totalComissaoPaga)}`} />
          <KPI tone="rose" icon={Coins} label="A pagar (pendente)" value={brlCompacto(totalFixoMensal + totalComissaoAPagar)} meta={`Fixo/mês: ${brlCompacto(totalFixoMensal)} · Comissão variável: ${brlCompacto(totalComissaoAPagar)}`} />
        </div>

        {/* Lista de analistas pra selecionar */}
        <section className="mt-8">
          <h2
            className="mb-3 text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Selecione um analista para ver o painel individual
          </h2>
          <div className="grid gap-3">
            {analistas.length === 0 ? (
              <div
                className="glass-tile rounded-[18px] p-12 text-center"
                style={{ border: "0.5px dashed var(--hairline)" }}
              >
                <p className="text-sm" style={{ color: "var(--text-soft)" }}>
                  Nenhum analista cadastrado na plataforma.
                </p>
              </div>
            ) : (
              analistas.map((a) => {
                const ativosCount = a.vinculos.filter((v) => v.status === "ATIVO").length;
                return (
                  <Link
                    key={a.id}
                    href={`/painel-analista?analistaId=${a.id}`}
                    className="glass-tile group flex items-center justify-between gap-4 rounded-[16px] px-5 py-4 transition hover:-translate-y-0.5"
                  >
                    <div>
                      <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
                        {a.nomeCompleto}
                      </h3>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>
                        {a.email} · {ativosCount} vínculo(s) ativo(s) · cadastrado em{" "}
                        {a.criadoEm.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: "var(--primary-deep)" }}>
                      Ver painel →
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>
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
  const comissoesExecucao = await listarComissoesDoAnalista(analista.id);
  // Garante que existem linhas do mês corrente — caso o cron ainda não tenha
  // rodado depois da virada ou de um vínculo recente. Idempotente.
  await gerarLinhasComissaoFixaDoAnalista(analista.id).catch(() => 0);
  const comissoesFixas = await listarComissoesFixasDoAnalista(analista.id);
  // Label do dropdown precisa incluir CNPJ pra desambiguar MEI/PJ cujo nome
  // é o do dono (ex: "IGOR DA SILVA FERNANDES" pode ser tanto a pessoa
  // quanto o MEI da pessoa — sem CNPJ fica confuso).
  const empresasOpcoes = Array.from(
    new Map(
      comissoesExecucao.map((c) => [
        c.empenho.empresa.id,
        {
          id: c.empenho.empresa.id,
          label: `${c.empenho.empresa.nomeFantasia || c.empenho.empresa.razaoSocial} · ${formatarCnpj(c.empenho.empresa.cnpj)}`,
        },
      ]),
    ).values(),
  );
  // Opções de empresa pro filtro do bloco fixo: vêm dos VÍNCULOS do analista,
  // não das comissões fixas já geradas. Senão, quando o cron ainda não rodou
  // (mês recém-virado ou vínculo novo), o dropdown ficaria vazio e o analista
  // não consegue cadastrar/alimentar nada.
  const vinculosDoAnalista = await prisma.vinculoAnalista.findMany({
    where: { analistaId: analista.id },
    select: {
      conta: {
        select: {
          empresas: {
            select: { id: true, razaoSocial: true, nomeFantasia: true },
            take: 1,
          },
        },
      },
    },
  });
  const empresasFixoOpcoes = Array.from(
    new Map(
      vinculosDoAnalista
        .map((v) => v.conta.empresas[0])
        .filter((e): e is { id: string; razaoSocial: string; nomeFantasia: string | null } => !!e)
        .map((e) => [e.id, { id: e.id, label: e.nomeFantasia || e.razaoSocial }]),
    ).values(),
  );
  const ehPreviewAdmin = usuario.superAdmin && usuario.conta.tipo !== "ANALISTA";
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
      {ehPreviewAdmin && (
        <div
          className="glass-tile mb-4 flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-sm"
          style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06)), rgba(255,255,255,0.5)",
            border: "0.5px solid rgba(168,137,71,0.4)",
            color: "var(--text-soft)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-extrabold uppercase"
              style={{
                letterSpacing: "0.16em",
                background: "var(--primary)",
                color: "#0A0A0A",
              }}
            >
              Admin · Preview
            </span>
            <span style={{ color: "var(--text-soft)" }}>
              Visualizando como{" "}
              <strong style={{ color: "var(--primary-deep)" }}>{analista.nomeCompleto}</strong>{" "}
              vê o painel dele.
            </span>
          </div>
          <Link
            href="/painel-analista"
            className="text-xs font-bold underline transition hover:opacity-70"
            style={{ color: "var(--primary-deep)" }}
          >
            Trocar analista
          </Link>
        </div>
      )}
      <PageHeader
        eyebrow="Painel · Analista de licitações"
        titulo={`Olá, ${analista.nomeCompleto.split(" ")[0]}.`}
        subtitulo={`${consolidado.totalEmpresas} empresa(s) vinculada(s) — comissões, carteira e atividade consolidada.`}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <KPI
          tone="mint"
          icon={Wallet}
          label="Recebido (comissão variável)"
          value={brlCompacto(consolidado.totalComissaoRecebida)}
          meta="empresa já repassou a comissão"
        />
        <KPI
          tone="primary"
          icon={Coins}
          label="A receber"
          value={brlCompacto(consolidado.totalComissaoAReceber)}
          meta="órgão pagou a empresa; comissão pendente"
        />
        <KPI
          tone="sky"
          icon={Receipt}
          label="Aguardando órgão"
          value={brlCompacto(consolidado.totalComissaoAguardandoOrgao)}
          meta="empenhos ainda não pagos pelo órgão (potencial)"
        />
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <KPI
          tone="lavender"
          icon={Briefcase}
          label="Carteira contratada"
          value={brlCompacto(consolidado.totalCarteiraContratada)}
          meta="atas + contratos vigentes"
        />
        <KPI
          tone="sky"
          icon={Receipt}
          label="Fixo mensal ativo"
          value={brlCompacto(consolidado.totalFixoMensalAtivo)}
          meta={`${consolidado.empresas.filter((e) => e.status === "ATIVO").length} vínculos ativos`}
        />
      </div>

      <ComissoesFixasBloco linhas={comissoesFixas} empresas={empresasFixoOpcoes} />

      <ComissoesVariaveisBloco
        comissoes={comissoesExecucao}
        empresas={empresasOpcoes}
      />

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
                        Vínculo desde {e.dataInicio.toLocaleDateString("pt-BR")} · {e.totalExecucoes} execuções ({e.totalExecucoesPagasPeloOrgao} pagas pelo órgão)
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
