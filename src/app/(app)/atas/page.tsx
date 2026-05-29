import Link from "next/link";
import { Plus, FileText, ArrowRight, Coins, TrendingUp, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, ROTULO_TIPO } from "@/lib/validators";
import { FiltroLista } from "@/components/FiltroLista";
import { filtroEmpresaWhere } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { KpiVencimentos } from "@/components/KpiVencimentos";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { KPI } from "@/components/ui/KPI";
import { TimelineVencimentos } from "@/components/TimelineVencimentos";

export default async function AtasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; orgao?: string; alerta?: string }>;
}) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);
  const filtroEmpresa = await filtroEmpresaWhere(usuario.contaId);

  const q = (sp.q || "").trim();
  const status = sp.status || "";
  const orgao = sp.orgao || "";
  const alertaDias = sp.alerta ? Number(sp.alerta) : 0;

  const hoje = new Date();
  const limiteAlerta = alertaDias > 0 ? new Date(hoje.getTime() + alertaDias * 86400000) : null;
  const d30 = new Date(hoje.getTime() + 30 * 86400000);
  const d60 = new Date(hoje.getTime() + 60 * 86400000);
  const d90 = new Date(hoje.getTime() + 90 * 86400000);
  const d120 = new Date(hoje.getTime() + 120 * 86400000);

  const whereBase = { empresa: filtroEmpresa };
  const whereQuery = {
    empresa: filtroEmpresa,
    ...(q && { OR: [{ numero: { contains: q } }, { objeto: { contains: q } }, { processoAdministrativo: { contains: q } }, { orgaoNome: { contains: q } }, { idAtaPncp: { contains: q } }] }),
    ...(status === "vigentes" && { vigenciaFim: { gte: hoje } }),
    ...(status === "vencidas" && { vigenciaFim: { lt: hoje } }),
    ...(limiteAlerta && { vigenciaFim: { gte: hoje, lte: limiteAlerta } }),
    ...(orgao && { orgaoNome: orgao }),
  };

  // Tudo em paralelo — sem N+1
  const [atas, orgaosDistintos, qtdVigentes, qtdFinalizadas, venc30, venc60, venc90, venc120] =
    await Promise.all([
      prisma.ata.findMany({
        where: whereQuery,
        orderBy: { criadoEm: "desc" },
        include: {
          empresa: { select: { nomeFantasia: true, razaoSocial: true } },
          itens: {
            select: {
              valorTotal: true,
              valorUnitario: true,
              quantidade: true,
              contratoItens: { select: { quantidade: true } },
              empenhoItens: { select: { quantidade: true, empenho: { select: { contratoId: true } } } },
            },
          },
        },
      }),
      prisma.ata.groupBy({ by: ["orgaoNome"], where: whereBase, orderBy: { orgaoNome: "asc" } }),
      prisma.ata.count({ where: { ...whereBase, vigenciaFim: { gte: hoje } } }),
      prisma.ata.count({ where: { ...whereBase, vigenciaFim: { lt: hoje } } }),
      prisma.ata.count({ where: { ...whereBase, vigenciaFim: { gte: hoje, lte: d30 } } }),
      prisma.ata.count({ where: { ...whereBase, vigenciaFim: { gte: hoje, lte: d60 } } }),
      prisma.ata.count({ where: { ...whereBase, vigenciaFim: { gte: hoje, lte: d90 } } }),
      prisma.ata.count({ where: { ...whereBase, vigenciaFim: { gte: hoje, lte: d120 } } }),
    ]);

  // Saldo calculado em memória — zero queries extras
  const atasComSaldo = atas.map((a) => {
    const valorTotal = a.itens.reduce((s, it) => s + it.valorTotal, 0);
    const valorUsado = a.itens.reduce((s, it) => {
      const usadoContrato = it.contratoItens.reduce((ss, c) => ss + c.quantidade, 0);
      const usadoEmpenhoSolto = it.empenhoItens.filter((e) => e.empenho.contratoId === null).reduce((ss, e) => ss + e.quantidade, 0);
      return s + (usadoContrato + usadoEmpenhoSolto) * it.valorUnitario;
    }, 0);
    return { ...a, saldo: { valorTotal, valorUsado, valorDisponivel: valorTotal - valorUsado, percentualUsado: valorTotal === 0 ? 0 : (valorUsado / valorTotal) * 100 } };
  });

  // ============================================================
  // Bloco Financeiro de ARPs (Ampliação 1 do M3 Painel de Atas)
  // ============================================================
  // Dois blocos lado a lado pra evitar a inconsistência de comparar
  // contratado (vigente) com executado/recebido (histórico):
  //
  //   Série histórica → todas as ARPs (vigentes + expiradas)
  //   Vigentes        → só ARPs com vigenciaFim >= hoje
  //
  // Cada bloco tem as mesmas 6 caixinhas (Contratado, Executado, A
  // executar, Recebido, A receber, Reajuste). Recebido/A receber
  // particionam os empenhos da empresa pela vigência da Ata-mãe (direta
  // ou via contrato): vigente quando essa vigenciaFim >= hoje.
  const atasVigentesFin = atasComSaldo.filter((a) => a.vigenciaFim >= hoje);

  // Histórico (todas)
  const valoresContratadosARPsHist = atasComSaldo.reduce((s, a) => s + a.saldo.valorTotal, 0);
  const valoresExecutadosARPsHist = atasComSaldo.reduce((s, a) => s + a.saldo.valorUsado, 0);
  const valoresAExecutarARPsHist = Math.max(0, valoresContratadosARPsHist - valoresExecutadosARPsHist);

  // Vigentes
  const valoresContratadosARPsVig = atasVigentesFin.reduce((s, a) => s + a.saldo.valorTotal, 0);
  const valoresExecutadosARPsVig = atasVigentesFin.reduce((s, a) => s + a.saldo.valorUsado, 0);
  const valoresAExecutarARPsVig = Math.max(0, valoresContratadosARPsVig - valoresExecutadosARPsVig);

  // Empenhos vinculados a Atas (direto OU via Contrato) — traz a
  // vigência da Ata-mãe pra particionar histórico × vigente em memória.
  const empenhosDeArps = await prisma.empenho.findMany({
    where: {
      empresa: filtroEmpresa,
      OR: [
        { ataId: { not: null } },
        { contrato: { ataId: { not: null } } },
      ],
    },
    select: {
      status: true,
      itens: { select: { valorTotal: true } },
      ata: { select: { vigenciaFim: true } },
      contrato: { select: { ata: { select: { vigenciaFim: true } } } },
    },
  });
  const valorEmpenho = (e: { itens: { valorTotal: number }[] }) =>
    e.itens.reduce((ss, it) => ss + it.valorTotal, 0);
  const ataVencDoEmpenho = (e: {
    ata: { vigenciaFim: Date } | null;
    contrato: { ata: { vigenciaFim: Date } | null } | null;
  }) => e.ata?.vigenciaFim ?? e.contrato?.ata?.vigenciaFim ?? null;
  const empenhosDeArpsVig = empenhosDeArps.filter((e) => {
    const v = ataVencDoEmpenho(e);
    return v !== null && v >= hoje;
  });

  const valoresRecebidosARPsHist = empenhosDeArps
    .filter((e) => e.status === "PAGO")
    .reduce((s, e) => s + valorEmpenho(e), 0);
  const valoresAReceberARPsHist = empenhosDeArps
    .filter((e) => e.status === "NF_ENCAMINHADA" || e.status === "NF_EMITIDA")
    .reduce((s, e) => s + valorEmpenho(e), 0);
  const valoresRecebidosARPsVig = empenhosDeArpsVig
    .filter((e) => e.status === "PAGO")
    .reduce((s, e) => s + valorEmpenho(e), 0);
  const valoresAReceberARPsVig = empenhosDeArpsVig
    .filter((e) => e.status === "NF_ENCAMINHADA" || e.status === "NF_EMITIDA")
    .reduce((s, e) => s + valorEmpenho(e), 0);

  // Atas com janela de reajuste próxima (≤90 dias até marco+12meses)
  const atasComReajuste = atasVigentesFin
    .filter((a) => a.marcoOrcamentoEstimado)
    .map((a) => {
      const janelaReajuste = new Date(a.marcoOrcamentoEstimado!);
      janelaReajuste.setFullYear(janelaReajuste.getFullYear() + 1);
      const dias = Math.ceil((janelaReajuste.getTime() - hoje.getTime()) / 86400000);
      return { id: a.id, numero: a.numero, dias };
    })
    .filter((a) => a.dias >= 0 && a.dias <= 90);

  // Itens da timeline — só Atas vigentes em janela de 120 dias.
  // O componente filtra >= 0 dias internamente.
  const itensTimeline = atasVigentesFin.map((a) => ({
    id: a.id,
    tipo: "ata" as const,
    numero: a.numero,
    orgaoNome: a.orgaoNome,
    vigenciaFim: a.vigenciaFim,
  }));

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <BannerEmpresaEmFoco contaId={usuario.contaId} />
      <PageHeader
        eyebrow="Sistema de Registro de Preços"
        titulo="Atas de"
        destaque="Registro"
        subtitulo={`${atasComSaldo.length} ata(s)${q ? ` correspondendo a "${q}"` : ""}.`}
        cta={
          <Link href="/contratacoes/nova/ata" className="btn-primary">
            <Plus className="h-4 w-4" /> Nova Ata
          </Link>
        }
      />

      <div className="mt-6">
        <KpiVencimentos
          rotuloPlural="Atas"
          rotuloSingularDe="ata"
          genero="f"
          totalVigentes={qtdVigentes}
          totalFinalizados={qtdFinalizadas}
          vencendoEm30={venc30}
          vencendoEm60={venc60}
          vencendoEm90={venc90}
          vencendoEm120={venc120}
          hrefVigentes="/atas?status=vigentes"
          hrefFinalizados="/atas?status=vencidas"
          hrefBaseAlerta="/atas?alerta="
        />
      </div>

      {/* Bloco Financeiro de ARPs — Ampliação 1 do M3
          Dois grupos: Série histórica (todas) × Vigentes (atuais).
          Reajuste só aparece em "Vigentes" — é sobre janela futura. */}
      <div className="mt-6 space-y-6">
        <FinanceiroArpsGrupo
          titulo="Série histórica"
          subtitulo="Todas as ARPs da empresa (vigentes + expiradas)"
          contratados={valoresContratadosARPsHist}
          executados={valoresExecutadosARPsHist}
          aExecutar={valoresAExecutarARPsHist}
          recebidos={valoresRecebidosARPsHist}
          aReceber={valoresAReceberARPsHist}
        />
        <FinanceiroArpsGrupo
          titulo="Vigentes"
          subtitulo="Apenas ARPs atualmente vigentes"
          contratados={valoresContratadosARPsVig}
          executados={valoresExecutadosARPsVig}
          aExecutar={valoresAExecutarARPsVig}
          recebidos={valoresRecebidosARPsVig}
          aReceber={valoresAReceberARPsVig}
          reajusteQtd={atasComReajuste.length}
        />
      </div>

      {/* Timeline de vencimentos — Ampliação 2 do M3, só ARPs */}
      <div className="mt-4">
        <TimelineVencimentos itens={itensTimeline} />
      </div>

      {alertaDias > 0 && (
        <p
          className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
          style={{
            background: "rgba(212,175,55,0.18)",
            border: "0.5px solid rgba(168,137,71,0.4)",
            color: "var(--primary-deep)",
          }}
        >
          Filtrando por vencimento em até {alertaDias} dias · {atasComSaldo.length} ata(s) ·{" "}
          <Link href="/atas" className="underline">
            limpar
          </Link>
        </p>
      )}

      <div className="mt-6">
        <FiltroLista
          placeholderBusca="Buscar por nº, objeto, processo, órgão, PNCP…"
          filtros={[
            {
              name: "status",
              label: "Todas",
              opcoes: [
                { value: "vigentes", label: "Vigentes" },
                { value: "vencidas", label: "Vencidas" },
              ],
            },
            {
              name: "orgao",
              label: "Todos os órgãos",
              opcoes: orgaosDistintos.map((o) => ({ value: o.orgaoNome, label: o.orgaoNome })),
            },
          ]}
        />
      </div>

      {atasComSaldo.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 grid gap-4">
          {atasComSaldo.map((a) => {
            const s = a.saldo;
            const venceEmDias = Math.ceil((a.vigenciaFim.getTime() - Date.now()) / 86400000);
            const venceColor =
              venceEmDias < 30
                ? "var(--coral-deep)"
                : venceEmDias < 90
                  ? "var(--primary-deep)"
                  : "var(--text-mute)";
            return (
              <Link
                key={a.id}
                href={`/atas/${a.id}`}
                className="glass-tile group block cursor-pointer rounded-[18px] px-5 py-5 transition hover:-translate-y-0.5"
                title="Abrir detalhe da Ata"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
                      style={{ background: "rgba(212,175,55,0.18)", color: "var(--primary-deep)" }}
                    >
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-[16px] font-extrabold"
                        style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
                      >
                        Ata {a.numero}
                        <span className="ml-2 badge b-empenhado">
                          {ROTULO_TIPO[a.tipo as keyof typeof ROTULO_TIPO]}
                        </span>
                      </h3>
                      <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>
                        {a.objeto}
                      </p>
                      <p className="mt-2 text-xs" style={{ color: "var(--text-mute)" }}>
                        {a.orgaoNome} · {a.empresa.nomeFantasia || a.empresa.razaoSocial}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-48 text-right">
                      <div
                        className="text-[10px] font-bold uppercase"
                        style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
                      >
                        Saldo disponível
                      </div>
                      <div
                        className="mt-1 text-[18px] font-extrabold tabular leading-none"
                        style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
                      >
                        {brl(s.valorDisponivel)}
                      </div>
                      <div
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: "rgba(15,14,12,0.06)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, s.percentualUsado)}%`,
                            background: "linear-gradient(90deg, var(--primary-deep), var(--primary))",
                          }}
                        />
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: "var(--text-mute)" }}>
                        {s.percentualUsado.toFixed(1)}% utilizado · de {brl(s.valorTotal)}
                      </div>
                      <div
                        className="mt-2 text-xs font-bold"
                        style={{ color: venceColor }}
                      >
                        {venceEmDias > 0 ? `Vence em ${venceEmDias}d` : `Vencida há ${-venceEmDias}d`}
                      </div>
                    </div>
                    <ArrowRight
                      className="mt-1 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: "var(--primary-deep)" }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FinanceiroArpsGrupo({
  titulo,
  subtitulo,
  contratados,
  executados,
  aExecutar,
  recebidos,
  aReceber,
  reajusteQtd,
}: {
  titulo: string;
  subtitulo: string;
  contratados: number;
  executados: number;
  aExecutar: number;
  recebidos: number;
  aReceber: number;
  reajusteQtd?: number;
}) {
  return (
    <section>
      <header className="mb-2 flex items-baseline gap-3">
        <h3
          className="text-[13px] font-extrabold uppercase"
          style={{ letterSpacing: "0.15em", color: "var(--primary-deep)" }}
        >
          {titulo}
        </h3>
        <span className="text-xs" style={{ color: "var(--text-soft)" }}>
          {subtitulo}
        </span>
      </header>
      <div className="grid gap-3.5 lg:grid-cols-3">
        <KPI tone="lavender" icon={Coins} label="Contratado em ARPs" value={brl(contratados)} meta="Valor total das ARPs" />
        <KPI tone="primary" icon={TrendingUp} label="Executado em ARPs" value={brl(executados)} meta="Consumido via Contratos + Empenhos diretos" />
        <KPI tone="mint" icon={ArrowRight} label="A executar em ARPs" value={brl(aExecutar)} meta="Contratado − Executado" />
        <KPI tone="mint" icon={Coins} label="Recebido" value={brl(recebidos)} meta="Empenhos PAGOS vinculados a ARPs" href="/execucao?status=PAGO" />
        <KPI tone="primary" icon={Coins} label="A receber" value={brl(aReceber)} meta="NF emitida/encaminhada, aguardando pagamento" href="/execucao?status=NF_ENCAMINHADA" />
        {reajusteQtd !== undefined ? (
          <KPI
            tone="rose"
            icon={AlertTriangle}
            label="ARPs em janela de reajuste"
            value={reajusteQtd}
            meta="Marco + 12 meses dentro de 90 dias"
            pulse={reajusteQtd > 0}
            href="/reajustes"
          />
        ) : (
          <div />
        )}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div
      className="glass-tile mt-12 rounded-[20px] p-12 text-center"
      style={{ border: "0.5px dashed var(--hairline)" }}
    >
      <FileText className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
      <h3
        className="mt-4 text-[18px] font-extrabold"
        style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
      >
        Nenhuma Ata encontrada
      </h3>
      <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
        Ajuste os filtros ou cadastre a primeira Ata.
      </p>
      <Link href="/contratacoes/nova/ata" className="btn-primary mt-4 inline-flex">
        <Plus className="h-4 w-4" /> Cadastrar primeira Ata
      </Link>
    </div>
  );
}
