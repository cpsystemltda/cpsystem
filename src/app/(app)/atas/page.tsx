import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, ROTULO_TIPO } from "@/lib/validators";
import { FiltroLista } from "@/components/FiltroLista";
import { filtroEmpresaWhere } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { KpiVencimentos } from "@/components/KpiVencimentos";
import { PageHeader } from "@/components/ui/SecaoGlass";

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

      {alertaDias > 0 && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
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
            const venceClass = venceEmDias < 30 ? "text-red-600" : venceEmDias < 90 ? "text-amber-600" : "text-slate-500";
            return (
              <Link
                key={a.id}
                href={`/atas/${a.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50">
                      <FileText className="h-5 w-5 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">
                        Ata {a.numero}
                        <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {ROTULO_TIPO[a.tipo as keyof typeof ROTULO_TIPO]}
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">{a.objeto}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {a.orgaoNome} · {a.empresa.nomeFantasia || a.empresa.razaoSocial}
                      </p>
                    </div>
                  </div>
                  <div className="w-48 text-right">
                    <div className="text-xs text-slate-500">Saldo disponível</div>
                    <div className="mt-0.5 text-lg font-bold text-slate-900">{brl(s.valorDisponivel)}</div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, s.percentualUsado)}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {s.percentualUsado.toFixed(1)}% utilizado · de {brl(s.valorTotal)}
                    </div>
                    <div className={`mt-2 text-xs font-medium ${venceClass}`}>
                      {venceEmDias > 0 ? `Vence em ${venceEmDias}d` : `Vencida há ${-venceEmDias}d`}
                    </div>
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

function EmptyState() {
  return (
    <div className="mt-12 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
      <FileText className="mx-auto h-10 w-10 text-slate-400" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Nenhuma Ata encontrada</h3>
      <p className="mt-2 text-sm text-slate-600">Ajuste os filtros ou cadastre a primeira Ata.</p>
      <Link href="/contratacoes/nova/ata" className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
        Cadastrar primeira Ata
      </Link>
    </div>
  );
}
