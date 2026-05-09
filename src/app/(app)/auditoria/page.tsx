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

const BADGE_ACAO: Record<string, string> = {
  CRIAR: "b-entregue",
  ATUALIZAR: "b-pedido",
  EXCLUIR: "b-multa",
  LOGIN: "b-empenhado",
  LOGOUT: "b-empenhado",
  EXPORTAR: "b-nf-emitida",
  UPLOAD: "b-nf-encam",
  DOWNLOAD: "b-nf-encam",
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
        <div
          className="glass-tile mt-8 rounded-[20px] p-12 text-center"
          style={{ border: "0.5px dashed var(--hairline)" }}
        >
          <Activity className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
          <p className="mt-4 text-sm font-semibold" style={{ color: "var(--text-soft)" }}>
            Nenhum log encontrado.
          </p>
        </div>
      ) : (
        <div className="glass mt-6 overflow-hidden rounded-[20px]">
          <table className="table-glass">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Recurso</th>
                <th>Resumo</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="text-xs whitespace-nowrap" style={{ color: "var(--text-soft)" }}>
                    {l.criadoEm.toLocaleString("pt-BR")}
                  </td>
                  <td className="text-xs">
                    {l.usuario ? (
                      <>
                        <div className="strong" style={{ color: "var(--text)" }}>
                          {l.usuario.nome}
                        </div>
                        <div style={{ color: "var(--text-mute)" }}>{l.usuario.email}</div>
                      </>
                    ) : (
                      <span style={{ color: "var(--text-mute)" }}>Sistema</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${BADGE_ACAO[l.acao] ?? "b-empenhado"}`}>
                      {ROTULO_ACAO[l.acao]}
                    </span>
                  </td>
                  <td className="font-mono text-xs strong">{l.recurso}</td>
                  <td className="text-xs" style={{ color: "var(--text-soft)" }}>
                    {l.resumo || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
