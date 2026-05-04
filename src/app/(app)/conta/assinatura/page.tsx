import Link from "next/link";
import { CreditCard, Check, AlertTriangle, Lock, Receipt } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { statusGateway } from "@/lib/gateway";
import { CancelarAssinaturaForm } from "./CancelarForm";

const PRECO = { BASICO: 397, PREMIUM: 997 };
const ROTULO_PLANO = { BASICO: "Básico", PREMIUM: "Premium" };

const COR_STATUS: Record<string, string> = {
  TRIAL: "bg-amber-100 text-amber-800",
  ATIVA: "bg-emerald-100 text-emerald-800",
  INADIMPLENTE: "bg-red-100 text-red-800",
  CANCELADA: "bg-slate-100 text-slate-700",
};

const ROTULO_STATUS_COBRANCA: Record<string, string> = {
  PENDENTE: "Pendente",
  PROCESSANDO: "Processando",
  PAGA: "Paga",
  ATRASADA: "Atrasada",
  CANCELADA: "Cancelada",
  ESTORNADA: "Estornada",
};

const COR_STATUS_COBRANCA: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  PROCESSANDO: "bg-blue-100 text-blue-800",
  PAGA: "bg-emerald-100 text-emerald-800",
  ATRASADA: "bg-red-100 text-red-800",
  CANCELADA: "bg-slate-100 text-slate-600",
  ESTORNADA: "bg-violet-100 text-violet-800",
};

export default async function AssinaturaPage() {
  const usuario = await exigirUsuario();
  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    include: {
      cobrancas: { orderBy: { criadaEm: "desc" }, take: 20 },
      metodosPagamento: { where: { ativo: true } },
    },
  });
  if (!conta) return null;

  const gw = await statusGateway();

  const trial = conta.statusAssinatura === "TRIAL" && conta.trialAteEm;
  const diasTrial = trial ? Math.max(0, Math.ceil((conta.trialAteEm!.getTime() - Date.now()) / 86400000)) : 0;
  const cobrancaPendente = conta.cobrancas.find((c) => c.status === "PENDENTE" || c.status === "ATRASADA");

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50">
          <CreditCard className="h-5 w-5 text-blue-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Assinatura e cobrança</h1>
          <p className="mt-1 text-sm text-slate-600">Gerencie seu plano, método de pagamento e histórico de faturas.</p>
        </div>
      </div>

      {gw.provider === "DEMO" && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <span>
            <strong>Modo demo</strong> — nenhuma cobrança real é feita. Configure um gateway em{" "}
            <Link href="/admin/gateway" className="underline">/admin/gateway</Link> pra cobrar de verdade.
          </span>
        </div>
      )}

      {/* Card do plano atual */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Plano atual</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {ROTULO_PLANO[conta.plano as "BASICO" | "PREMIUM"]} — {brl(PRECO[conta.plano as "BASICO" | "PREMIUM"])}/mês
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${COR_STATUS[conta.statusAssinatura]}`}>
                {conta.statusAssinatura}
              </span>
              {trial && <span className="text-xs text-amber-700">{diasTrial} dias restantes de trial</span>}
              {conta.proximoVencimento && (
                <span className="text-xs text-slate-500">
                  Próximo vencimento: {conta.proximoVencimento.toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {conta.statusAssinatura === "TRIAL" && (
              <Link
                href={`/conta/checkout?plano=${conta.plano}`}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Ativar plano agora
              </Link>
            )}
            {conta.statusAssinatura !== "TRIAL" && conta.statusAssinatura !== "CANCELADA" && (
              <Link
                href={`/conta/checkout?plano=${conta.plano === "BASICO" ? "PREMIUM" : "BASICO"}`}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Trocar para {conta.plano === "BASICO" ? "Premium" : "Básico"}
              </Link>
            )}
            {conta.statusAssinatura === "CANCELADA" && (
              <Link
                href="/conta/checkout?plano=BASICO"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Reativar assinatura
              </Link>
            )}
          </div>
        </div>

        {cobrancaPendente && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Cobrança {ROTULO_STATUS_COBRANCA[cobrancaPendente.status]} de {brl(cobrancaPendente.valor)} — vence{" "}
              {cobrancaPendente.vencimento.toLocaleDateString("pt-BR")}.{" "}
              {cobrancaPendente.gatewayInvoiceUrl && (
                <a href={cobrancaPendente.gatewayInvoiceUrl} target="_blank" rel="noreferrer" className="font-medium underline">
                  Ver fatura
                </a>
              )}
            </span>
          </div>
        )}
      </section>

      {/* Métodos de pagamento */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Métodos de pagamento salvos</h2>
        {conta.metodosPagamento.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum método salvo. PIX e boleto são gerados sob demanda.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {conta.metodosPagamento.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="font-medium">{m.apelido}</div>
                    {m.validadeMes && m.validadeAno && (
                      <div className="text-xs text-slate-500">
                        Validade {String(m.validadeMes).padStart(2, "0")}/{m.validadeAno}
                      </div>
                    )}
                  </div>
                </div>
                {m.padrao && (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                    <Check className="mr-1 inline h-3 w-3" /> Padrão
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
          <Lock className="h-3 w-3" /> Em conformidade com PCI-DSS — só armazenamos os 4 últimos dígitos do cartão.
        </p>
      </section>

      {/* Histórico de cobranças */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Histórico de cobranças
        </h2>
        {conta.cobrancas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma cobrança ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Competência</th>
                <th className="px-4 py-2 text-left">Plano</th>
                <th className="px-4 py-2 text-left">Forma</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2 text-left">Vencimento</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {conta.cobrancas.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">{c.competencia}</td>
                  <td className="px-4 py-2">{c.plano}</td>
                  <td className="px-4 py-2 text-xs">{c.forma.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-right font-medium">{brl(c.valor)}</td>
                  <td className="px-4 py-2 text-xs">{c.vencimento.toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR_STATUS_COBRANCA[c.status]}`}>
                      {ROTULO_STATUS_COBRANCA[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {c.gatewayInvoiceUrl && (
                      <a href={c.gatewayInvoiceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        <Receipt className="inline h-3 w-3" /> Fatura
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Cancelar */}
      {conta.statusAssinatura !== "CANCELADA" && (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50/30 p-5">
          <h2 className="text-sm font-semibold text-red-900">Zona de perigo</h2>
          <p className="mt-1 text-xs text-red-700">
            Cancelar a assinatura interrompe a cobrança no próximo ciclo. Seus dados continuam disponíveis por 30 dias antes
            de serem removidos (LGPD art. 16).
          </p>
          <CancelarAssinaturaForm />
        </section>
      )}
    </div>
  );
}
