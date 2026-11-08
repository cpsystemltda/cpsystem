import { Crown } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHAVE_PARAMETRO_PERCENTUAIS, PERCENTUAIS_ANEXO_XII, totalPct } from "@/lib/contaVinculada";
import { percentuaisPadrao } from "@/lib/contaVinculadaServer";
import { FormPercentuaisPadrao } from "./FormPercentuaisPadrao";

const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * Tabela-padrão da conta vinculada (ESP-006 RN02, decisão do Igor de
 * 07/11/2026): percentuais do Anexo XII da IN SEGES/MP 5/2017 editáveis
 * pelo gestor da plataforma, para acompanhar alterações da IN sem deploy.
 */
export default async function AdminContaVinculadaPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">Esta área é exclusiva para gestores da plataforma.</p>
      </div>
    );
  }
  const [p, meta, contratosProprios] = await Promise.all([
    percentuaisPadrao(),
    prisma.parametroPlataforma.findUnique({ where: { chave: CHAVE_PARAMETRO_PERCENTUAIS }, select: { atualizadoEm: true } }),
    prisma.contrato.count({ where: { percentuaisContaVinculada: { not: { equals: null } } } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-50">
          <Crown className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Conta vinculada · tabela-padrão</h1>
          <p className="mt-1 text-sm text-slate-600">
            Percentuais das rubricas retidas pelo órgão (Anexo XII da IN SEGES/MP 5/2017). Valem para todo contrato de mão de obra que não tenha percentuais próprios
            {contratosProprios > 0 ? ` (${contratosProprios} contrato(s) usam percentuais próprios)` : ""}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {meta ? `Última alteração em ${meta.atualizadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` : "Ainda com os valores originais da IN."} Totais atuais: RAT 1% = {pct(totalPct(p, 1))} · RAT 2% = {pct(totalPct(p, 2))} · RAT 3% = {pct(totalPct(p, 3))}.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <FormPercentuaisPadrao atual={p} original={PERCENTUAIS_ANEXO_XII} />
      </div>
    </div>
  );
}
