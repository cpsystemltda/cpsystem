import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";

const LIMITE = 4;

function formatarCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default async function EmpresasPage() {
  const usuario = await exigirUsuario();
  const empresas = await prisma.empresa.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
  });

  const podeAdicionar = empresas.length < LIMITE;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        eyebrow="Visão geral · Grupo econômico"
        titulo="Empresas"
        destaque="(CNPJs)"
        subtitulo={`Gerencie os CNPJs do seu grupo. Usando ${empresas.length} de ${LIMITE} CNPJs incluídos no plano.`}
        cta={
          podeAdicionar ? (
            <Link href="/empresas/nova" className="btn-primary">
              <Plus className="h-4 w-4" /> Adicionar CNPJ
            </Link>
          ) : (
            <span
              className="rounded-full px-4 py-2 text-xs font-bold uppercase"
              style={{
                background: "rgba(212,175,55,0.14)",
                color: "var(--primary-bright)",
                border: "0.5px solid rgba(212,175,55,0.3)",
                letterSpacing: "0.08em",
              }}
            >
              Limite atingido — fale com o comercial
            </span>
          )
        }
      />

      <div className="mt-8 grid gap-4">
        {empresas.map((e) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50">
                <Building2 className="h-5 w-5 text-blue-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">
                  {e.nomeFantasia || e.razaoSocial}
                </h3>
                {e.nomeFantasia && (
                  <p className="text-sm text-slate-500">{e.razaoSocial}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
                  <span>CNPJ: {formatarCnpj(e.cnpj)}</span>
                  <span>Porte: {e.porte}</span>
                  <span>CNAE: {e.cnaePrincipal}</span>
                  <span>Resp.: {e.responsavel}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
