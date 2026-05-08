import { Activity, ShieldCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FiltroLista } from "@/components/FiltroLista";
import type { AcaoAuditoria } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/ui/SecaoGlass";

const ROTULO_ACAO: Record<string, string> = {
  CRIAR: "Criou",
  ATUALIZAR: "Atualizou",
  EXCLUIR: "Excluiu",
  LOGIN: "Login",
  LOGOUT: "Logout",
  EXPORTAR: "Exportou",
  UPLOAD: "Enviou arquivo",
  DOWNLOAD: "Baixou arquivo",
};

const COR_ACAO: Record<string, string> = {
  CRIAR: "bg-emerald-100 text-emerald-800",
  ATUALIZAR: "bg-blue-100 text-blue-800",
  EXCLUIR: "bg-red-100 text-red-800",
  LOGIN: "bg-slate-100 text-slate-700",
  LOGOUT: "bg-slate-100 text-slate-700",
  EXPORTAR: "bg-violet-100 text-violet-800",
  UPLOAD: "bg-amber-100 text-amber-800",
  DOWNLOAD: "bg-amber-100 text-amber-800",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; acao?: string }>;
}) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const acao = sp.acao || "";

  const logs = await prisma.logAuditoria.findMany({
    where: {
      contaId: usuario.contaId,
      ...(q && {
        OR: [{ recurso: { contains: q } }, { resumo: { contains: q } }],
      }),
      ...(acao && { acao: acao as AcaoAuditoria }),
    },
    include: { usuario: { select: { nome: true, email: true } } },
    orderBy: { criadoEm: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Compliance"
        titulo="Logs de"
        destaque="auditoria"
        subtitulo="Registro de quem fez o quê na sua conta. Últimos 200 eventos."
      />

      <div className="mt-6">
        <FiltroLista
          placeholderBusca="Buscar recurso ou resumo…"
          filtros={[
            {
              name: "acao",
              label: "Todas as ações",
              opcoes: Object.entries(ROTULO_ACAO).map(([k, v]) => ({ value: k, label: v })),
            },
          ]}
        />
      </div>

      {logs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-4 text-sm text-slate-600">Nenhum log encontrado.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Quando</th>
                <th className="px-4 py-2 text-left">Quem</th>
                <th className="px-4 py-2 text-left">Ação</th>
                <th className="px-4 py-2 text-left">Recurso</th>
                <th className="px-4 py-2 text-left">Resumo</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                    {l.criadoEm.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {l.usuario ? (
                      <>
                        <div className="font-medium">{l.usuario.nome}</div>
                        <div className="text-slate-500">{l.usuario.email}</div>
                      </>
                    ) : (
                      <span className="text-slate-400">Sistema</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR_ACAO[l.acao]}`}>
                      {ROTULO_ACAO[l.acao]}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{l.recurso}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{l.resumo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
