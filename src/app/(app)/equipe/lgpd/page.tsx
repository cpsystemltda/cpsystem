import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HistoricoLista } from "@/components/abas/HistoricoLista";

/**
 * ESP-007 RN05: registro de acessos e alterações em dados de colaboradores
 * (quem, quando, o quê), consultável pelo Admin da empresa.
 */
export default async function AuditoriaLgpdPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  if (usuario.perfil !== "ADMIN") {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Só para o administrador</h1>
        <p className="mt-3 text-sm text-slate-600">O registro de acessos a dados pessoais é consultado pelo Admin da empresa.</p>
      </div>
    );
  }
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const porPagina = 100;
  const where = { contaId: usuario.contaId, recurso: { in: ["Colaborador", "ColaboradoresLista", "ColaboradorDocumento", "Alocacao", "AceiteAdendoLgpd"] } };
  const [total, entradas] = await Promise.all([
    prisma.logAuditoria.count({ where }),
    prisma.logAuditoria.findMany({ where, orderBy: { criadoEm: "desc" }, skip: (pagina - 1) * porPagina, take: porPagina, include: { usuario: { select: { nome: true, email: true } } } }),
  ]);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link href="/equipe" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Equipe
      </Link>
      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-violet-50">
          <ShieldCheck className="h-6 w-6 text-violet-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Acessos a dados de colaboradores</h1>
          <p className="mt-1 text-sm text-slate-600">Quem consultou ou alterou dados pessoais de colaboradores, quando e o quê (LGPD, art. 37). {total} registro(s).</p>
        </div>
      </div>
      <div className="mt-6">
        <HistoricoLista entradas={entradas} />
      </div>
      {paginas > 1 && (
        <p className="mt-4 flex gap-3 text-sm">
          {pagina > 1 && (
            <Link href={`/equipe/lgpd?pagina=${pagina - 1}`} className="text-blue-700 hover:underline">
              ← mais recentes
            </Link>
          )}
          <span className="text-slate-500">
            página {pagina} de {paginas}
          </span>
          {pagina < paginas && (
            <Link href={`/equipe/lgpd?pagina=${pagina + 1}`} className="text-blue-700 hover:underline">
              mais antigos →
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
