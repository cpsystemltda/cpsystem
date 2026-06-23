import Link from "next/link";
import { Building2, Plus, AlertCircle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { brl } from "@/lib/validators";
import { PRECO_CNPJ_ADICIONAL, CNPJS_INCLUSOS_BASICO } from "@/lib/precos";

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

  // Politica de CNPJs (Regina 23/06): BASICO inclui 1 CNPJ + R$ 39,90 por
  // adicional. PREMIUM ilimitado. Sem teto absoluto — cliente decide.
  const plano = usuario.conta.plano;
  const ehBasico = plano === "BASICO";
  const cnpjsAdicionais = ehBasico ? Math.max(0, empresas.length - CNPJS_INCLUSOS_BASICO) : 0;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        eyebrow="Visão geral · Grupo econômico"
        titulo="Empresas"
        destaque="(CNPJs)"
        subtitulo={
          ehBasico
            ? `Plano Básico: 1 CNPJ incluso · cada CNPJ adicional custa ${brl(PRECO_CNPJ_ADICIONAL)}/mês.`
            : `Plano Premium: CNPJs ilimitados sem custo adicional.`
        }
        cta={
          <Link href="/empresas/nova" className="btn-primary">
            <Plus className="h-4 w-4" /> Adicionar CNPJ
          </Link>
        }
      />

      {ehBasico && empresas.length >= CNPJS_INCLUSOS_BASICO && (
        <div
          className="mt-6 flex items-start gap-3 rounded-2xl px-5 py-4"
          style={{
            background: "rgba(212,175,55,0.10)",
            border: "0.5px solid rgba(168,137,71,0.32)",
          }}
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary-deep)" }} />
          <div className="text-sm" style={{ color: "var(--text-soft)" }}>
            Você tem <strong>{empresas.length}</strong> CNPJ{empresas.length > 1 ? "s" : ""} cadastrado{empresas.length > 1 ? "s" : ""}.{" "}
            {cnpjsAdicionais > 0 ? (
              <>
                Sua próxima cobrança incluirá um adicional de{" "}
                <strong>{brl(cnpjsAdicionais * PRECO_CNPJ_ADICIONAL)}</strong> ({cnpjsAdicionais} ×{" "}
                {brl(PRECO_CNPJ_ADICIONAL)}).
              </>
            ) : (
              <>Cada novo CNPJ adicionará {brl(PRECO_CNPJ_ADICIONAL)}/mês à sua fatura.</>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4">
        {empresas.map((e) => (
          <div key={e.id} className="glass-tile rounded-[18px] px-5 py-5">
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
