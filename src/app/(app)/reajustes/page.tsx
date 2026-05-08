import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { filtroEmpresaWhere } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { PageHeader } from "@/components/ui/SecaoGlass";

export default async function ReajustesPage() {
  const usuario = await exigirUsuario();
  const filtroEmpresa = await filtroEmpresaWhere(usuario.contaId);

  const reajustes = await prisma.reajuste.findMany({
    where: {
      OR: [
        { contrato: { empresa: filtroEmpresa } },
        { empenho: { empresa: filtroEmpresa } },
      ],
    },
    include: {
      contrato: { select: { id: true, numero: true, objeto: true, orgaoNome: true } },
      empenho: { select: { id: true, numero: true, objeto: true, orgaoNome: true } },
    },
    orderBy: { dataPedido: "desc" },
  });

  // Janelas de reajuste: contratos/atas/empenhos com marcoOrcamentoEstimado entre -60d e +60d da virada do ano
  const hoje = Date.now();
  const atasComMarco = await prisma.ata.findMany({
    where: { empresa: filtroEmpresa, marcoOrcamentoEstimado: { not: null } },
    select: { id: true, numero: true, objeto: true, marcoOrcamentoEstimado: true },
  });
  const contratosComMarco = await prisma.contrato.findMany({
    where: { empresa: filtroEmpresa, marcoOrcamentoEstimado: { not: null } },
    select: { id: true, numero: true, objeto: true, marcoOrcamentoEstimado: true },
  });

  type Janela = { id: string; titulo: string; objeto: string; janela: Date; diasFaltam: number; tipo: "ata" | "contrato"; href: string };
  const janelas: Janela[] = [
    ...atasComMarco.map((a) => {
      const janela = new Date(a.marcoOrcamentoEstimado!.getTime() + 365 * 86400000);
      return {
        id: a.id,
        titulo: `Ata ${a.numero}`,
        objeto: a.objeto,
        janela,
        diasFaltam: Math.ceil((janela.getTime() - hoje) / 86400000),
        tipo: "ata" as const,
        href: `/atas/${a.id}`,
      };
    }),
    ...contratosComMarco.map((c) => {
      const janela = new Date(c.marcoOrcamentoEstimado!.getTime() + 365 * 86400000);
      return {
        id: c.id,
        titulo: `Contrato ${c.numero}`,
        objeto: c.objeto,
        janela,
        diasFaltam: Math.ceil((janela.getTime() - hoje) / 86400000),
        tipo: "contrato" as const,
        href: `/contratos/${c.id}`,
      };
    }),
  ]
    .filter((j) => j.diasFaltam <= 90)
    .sort((a, b) => a.diasFaltam - b.diasFaltam);

  const totalReajustado = reajustes.reduce((s, r) => s + (r.valorNovo - r.valorAnterior), 0);

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <BannerEmpresaEmFoco contaId={usuario.contaId} />
      <PageHeader
        eyebrow="Insights · Janelas de reajuste"
        titulo="Reajustes de"
        destaque="preços"
        subtitulo="Inteligência jurídica nativa — janelas fatais, histórico consolidado e cálculo automático."
      />

      {janelas.length > 0 && (
        <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Janelas fatais próximas ({janelas.length})
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            Após 1 ano da data do orçamento estimado, abre-se a janela legal para pedido de reajuste contratual.
          </p>
          <ul className="mt-4 space-y-2">
            {janelas.map((j) => (
              <li key={`${j.tipo}-${j.id}`}>
                <Link
                  href={j.href}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-3 hover:border-amber-400"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{j.titulo}</p>
                    <p className="text-xs text-slate-600">{j.objeto.slice(0, 80)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Janela em</p>
                    <p
                      className={`text-sm font-bold ${
                        j.diasFaltam <= 0 ? "text-emerald-700" : j.diasFaltam <= 30 ? "text-red-700" : "text-amber-700"
                      }`}
                    >
                      {j.diasFaltam <= 0 ? "Aberta" : `${j.diasFaltam}d`}
                    </p>
                    <p className="text-[10px] text-slate-500">{j.janela.toLocaleDateString("pt-BR")}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Histórico ({reajustes.length})</h2>
          <p className="text-sm text-slate-600">
            Acumulado: <span className="font-semibold text-emerald-700">+{brl(totalReajustado)}</span>
          </p>
        </div>

        {reajustes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <p className="text-sm text-slate-600">
              Nenhum reajuste registrado ainda. Use a aba "Reajustes" no detalhe de cada Contrato/Empenho.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Pedido</th>
                  <th className="px-4 py-2 text-left">Contratação</th>
                  <th className="px-4 py-2 text-left">Órgão</th>
                  <th className="px-4 py-2 text-left">Índice</th>
                  <th className="px-4 py-2 text-right">%</th>
                  <th className="px-4 py-2 text-right">Anterior</th>
                  <th className="px-4 py-2 text-right">Novo</th>
                  <th className="px-4 py-2 text-left">Instrumento</th>
                </tr>
              </thead>
              <tbody>
                {reajustes.map((r) => {
                  const c = r.contrato || r.empenho;
                  if (!c) return null;
                  const tipo = r.contrato ? "Contrato" : "Empenho";
                  const href = r.contrato ? `/contratos/${r.contrato.id}` : `/execucao/${r.empenho!.id}`;
                  return (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{r.dataPedido.toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-2">
                        <Link href={href} className="text-blue-700 hover:underline">
                          {tipo} {c.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">{c.orgaoNome}</td>
                      <td className="px-4 py-2">{r.indice}</td>
                      <td className="px-4 py-2 text-right">{r.percentual.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{brl(r.valorAnterior)}</td>
                      <td className="px-4 py-2 text-right font-medium">{brl(r.valorNovo)}</td>
                      <td className="px-4 py-2 text-xs">
                        {r.instrumento.replace("_", " ")} {r.instrumentoNumero}
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
