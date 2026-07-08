import Link from "next/link";
import { Wallet, TrendingUp, Briefcase, AlertCircle, Receipt, Coins } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularComissaoAnalista } from "@/lib/comissaoB2G";
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
import { LinkIndicacaoBloco } from "@/components/LinkIndicacaoBloco";

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

      <LinkIndicacaoBloco analistaId={analista.id} nomeAnalista={analista.nomeCompleto} />

      {/* KPIs do painel do analista — ordem definida pela Regina (24/05):
          1. Carteira contratada
          2. Fixo mensal ativo
          3. Recebidos · TOTAL (fixo + variável)
          4. Recebidos · Comissões Fixas
          5. Recebidos · Comissões Variáveis
          6. A Receber · Comissões Variáveis (órgão pendente + cliente pendente)
          7. Comissões · CP System (programa embaixador — placeholder por enquanto)
      */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
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
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <KPI
          tone="mint"
          icon={Wallet}
          label="Recebidos · TOTAL"
          value={brlCompacto(consolidado.totalFixoRecebido + consolidado.totalComissaoRecebida)}
          meta="fixos + variáveis pagos pelos clientes"
        />
        <KPI
          tone="mint"
          icon={Receipt}
          label="Recebidos · Comissões Fixas"
          value={brlCompacto(consolidado.totalFixoRecebido)}
          meta="todos os fixos mensais já pagos"
        />
        <KPI
          tone="mint"
          icon={Coins}
          label="Recebidos · Comissões Variáveis"
          value={brlCompacto(consolidado.totalComissaoRecebida)}
          meta="todas as comissões variáveis já pagas"
        />
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <KPI
          tone="primary"
          icon={Coins}
          label="A Receber · Comissões Variáveis"
          value={brlCompacto(consolidado.totalComissaoAReceber + consolidado.totalComissaoAguardandoOrgao)}
          meta={`Cliente: ${brlCompacto(consolidado.totalComissaoAReceber)} · Órgão: ${brlCompacto(consolidado.totalComissaoAguardandoOrgao)}`}
        />
        <KPI
          tone="primary"
          icon={Wallet}
          label="Comissões · CP System"
          value={brlCompacto(consolidado.totalComissaoCpSystem)}
          meta="programa de embaixador (em breve)"
        />
      </div>

      <ComissoesFixasBloco linhas={comissoesFixas} empresas={empresasFixoOpcoes} />

      <ComissoesVariaveisBloco
        comissoes={comissoesExecucao}
        empresas={empresasOpcoes}
      />

      {/* Bloco 'Empresas vinculadas' + 'Execucoes do vinculo' foram
          movidos pra pagina exclusiva /painel-analista/empresas-vinculadas
          (Regina 05/06). Aqui mostramos so um atalho. */}
      <section className="mt-8">
        <div
          className="glass-tile flex items-center justify-between gap-4 rounded-[18px] px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
              style={{ background: "rgba(212,175,55,0.18)", color: "var(--primary-deep)" }}
            >
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
              >
                Empresas vinculadas
              </p>
              <p className="text-[14px] font-extrabold" style={{ color: "var(--text)" }}>
                {consolidado.empresas.length} vínculo{consolidado.empresas.length !== 1 ? "s" : ""} —
                gerencie comissões, % e execuções por empresa.
              </p>
            </div>
          </div>
          <Link
            href="/painel-analista/empresas-vinculadas"
            className="btn-primary"
            style={{ height: "32px", padding: "0 14px", fontSize: "12px" }}
          >
            Abrir
          </Link>
        </div>
      </section>

    </div>
  );
}

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
