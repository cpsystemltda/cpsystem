import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, ROTULO_TIPO } from "@/lib/validators";
import { calcularSaldoAta } from "@/lib/saldo";
import { FiltroLista } from "@/components/FiltroLista";

export default async function AtasPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; orgao?: string }> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const status = sp.status || "";
  const orgao = sp.orgao || "";

  const hoje = new Date();
  const atas = await prisma.ata.findMany({
    where: {
      empresa: { contaId: usuario.contaId },
      ...(q && {
        OR: [
          { numero: { contains: q } },
          { objeto: { contains: q } },
          { processoAdministrativo: { contains: q } },
          { orgaoNome: { contains: q } },
          { idAtaPncp: { contains: q } },
        ],
      }),
      ...(status === "vigentes" && { vigenciaFim: { gte: hoje } }),
      ...(status === "vencidas" && { vigenciaFim: { lt: hoje } }),
      ...(orgao && { orgaoNome: orgao }),
    },
    orderBy: { criadoEm: "desc" },
    include: { empresa: { select: { nomeFantasia: true, razaoSocial: true } } },
  });
  const saldos = await Promise.all(atas.map((a) => calcularSaldoAta(a.id)));

  // Lista de órgãos únicos pra filtro
  const orgaosDistintos = await prisma.ata.groupBy({
    by: ["orgaoNome"],
    where: { empresa: { contaId: usuario.contaId } },
    orderBy: { orgaoNome: "asc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Atas de Registro de Preços</h1>
          <p className="mt-1 text-sm text-slate-600">{atas.length} ata(s) {q && `correspondendo a "${q}"`}.</p>
        </div>
        <Link
          href="/contratacoes/nova/ata"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Nova Ata
        </Link>
      </div>

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

      {atas.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 grid gap-4">
          {atas.map((a, idx) => {
            const s = saldos[idx];
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
