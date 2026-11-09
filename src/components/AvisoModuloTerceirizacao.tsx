import Link from "next/link";
import { Lock, Eye, Users } from "lucide-react";
import type { AcessoModulo } from "@/lib/faixasTerceirizacao";

/**
 * ESP-011 — o que a conta vê no lugar (ou acima) do Módulo Terceirização:
 * - BLOQUEADO (RN01): convite de upgrade; o cadastro básico do contrato segue;
 * - SOMENTE_LEITURA (RN07): aviso dos 90 dias;
 * - trial no fim (RN06): faixa estimada — só quando a cobrança por faixa
 *   estiver ativa (valores aguardam aprovação).
 */
export function AvisoModuloTerceirizacao({
  acesso,
  perdidaEm,
  estimativaTrial,
}: {
  acesso: AcessoModulo;
  perdidaEm?: Date | null;
  estimativaTrial?: { dias: number; pico: number; rotulo: string; valor: number; nomePacote: string } | null;
}) {
  if (acesso === "BLOQUEADO") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
        <div className="text-sm text-violet-950">
          <p className="font-bold">Módulo Terceirização · plano Premium</p>
          <p className="mt-1">
            Competências mensais automáticas, planilha de custos, glosas e IMR, conta vinculada, colaboradores alocados, checklist de documentos e dossiê do fiscal
            fazem parte do Premium. O cadastro do contrato continua disponível no seu plano.
          </p>
          <Link href="/conta/assinatura" className="mt-2 inline-block font-semibold text-violet-800 underline">
            Conhecer o Premium
          </Link>
        </div>
      </div>
    );
  }
  if (acesso === "SOMENTE_LEITURA") {
    const ate = perdidaEm ? new Date(perdidaEm.getTime() + 90 * 86_400_000) : null;
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
        <Eye className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="text-sm text-amber-950">
          <p className="font-bold">Módulo Terceirização em somente leitura</p>
          <p className="mt-1">
            A conta saiu do plano Premium. Os dados continuam disponíveis para consulta e exportação
            {ate ? ` até ${ate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : " por 90 dias"}. Para voltar a editar, reative o Premium.
          </p>
          <Link href="/conta/assinatura" className="mt-2 inline-block font-semibold text-amber-900 underline">
            Reativar o Premium
          </Link>
        </div>
      </div>
    );
  }
  if (estimativaTrial) {
    const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <div className="text-sm text-sky-950">
          <p className="font-bold">
            Seu período de teste termina {estimativaTrial.dias <= 0 ? "hoje" : estimativaTrial.dias === 1 ? "amanhã" : `em ${estimativaTrial.dias} dias`}
          </p>
          <p className="mt-1">
            Com {estimativaTrial.pico} colaborador(es) ativo(s), a conta fica na faixa de {estimativaTrial.rotulo} do {estimativaTrial.nomePacote}:{" "}
            {estimativaTrial.valor > 0 ? `adicional de ${brl(estimativaTrial.valor)} por mês, além do plano Premium.` : "incluída no plano Premium, sem adicional."}
          </p>
        </div>
      </div>
    );
  }
  return null;
}
