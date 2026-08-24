"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CreditCard, QrCode, FileText, Lock } from "lucide-react";
import { iniciarCheckoutAction } from "@/app/actions/assinatura";
import { PixPagamento } from "@/components/PixPagamento";
import { brl } from "@/lib/validators";
import type { BreakdownCobranca } from "@/lib/precosConstants";
import { PRECO_CNPJ_ADICIONAL, PRECO_COLABORADOR_ADICIONAL } from "@/lib/precosConstants";

const ROTULO = { BASICO: "Básico", PREMIUM: "Premium" };

// Regina 24/08 (pedido do Igor): boleto voltou — "muita empresa ainda faz
// assim". Entra com vencimento de 2 dias, prazo que a Regina definiu.
type Forma = "PIX" | "BOLETO" | "CARTAO_CREDITO";

export function CheckoutClient({
  planoInicial,
  breakdownBasico,
  breakdownPremium,
}: {
  planoInicial: "BASICO" | "PREMIUM";
  breakdownBasico: BreakdownCobranca;
  breakdownPremium: BreakdownCobranca;
}) {
  const [state, formAction] = useActionState(iniciarCheckoutAction, null);
  const [plano, setPlano] = useState<"BASICO" | "PREMIUM">(planoInicial);
  const [forma, setForma] = useState<Forma>("PIX");
  const breakdownAtivo = plano === "BASICO" ? breakdownBasico : breakdownPremium;
  const valor = breakdownAtivo.valorTotal;

  // Cobranca criada. No PIX, o codigo aparece aqui mesmo: mandar o cliente
  // "acompanhar em Assinatura" era pedir que ele procurasse como pagar.
  if (state?.ok) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-12">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100">
            <Lock className="h-6 w-6 text-emerald-700" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">
            {forma === "PIX" ? "Falta só o pagamento" : "Cobrança criada"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {forma === "PIX"
              ? "Pague o PIX abaixo — a confirmação é automática e a assinatura é liberada em seguida."
              : forma === "BOLETO"
                ? "O boleto está em Assinatura, com vencimento em 2 dias. A compensação leva até 1 dia útil depois do pagamento."
                : "Assim que o cartão for aprovado, a assinatura é liberada automaticamente."}
          </p>
        </div>

        {forma === "PIX" && state.cobrancaId && (
          <div className="mt-6 text-left">
            <PixPagamento cobrancaId={state.cobrancaId} autoCarregar />
          </div>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <Link href="/conta/assinatura" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Ir para minha assinatura
          </Link>
          <Link href="/dashboard" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <Link href="/conta/assinatura" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-slate-900">Ativar assinatura</h1>
      <p className="mt-1 text-sm text-slate-600">Confirme o plano e escolha a forma de pagamento.</p>

      <form action={formAction} className="mt-8 space-y-6">
        <input type="hidden" name="plano" value={plano} />
        <input type="hidden" name="forma" value={forma} />

        {/* Escolha de plano */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Plano</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <PlanoCard
              ativo={plano === "BASICO"}
              onClick={() => setPlano("BASICO")}
              titulo="Básico"
              valor={breakdownBasico.valorTotal}
              bullets={[
                "1 CNPJ incluso + R$ 39,90 por CNPJ adicional",
                "Software completo",
                "Inteligência jurídica embutida",
                "Suporte técnico",
              ]}
            />
            <PlanoCard
              ativo={plano === "PREMIUM"}
              onClick={() => setPlano("PREMIUM")}
              titulo="Premium"
              valor={breakdownPremium.valorTotal}
              bullets={[
                "CNPJs ilimitados",
                "Tudo do Básico",
                "12 consultas jurídicas/ano",
                "2 peças administrativas/ano",
                "Canal VIP SLA 4h",
              ]}
              destaque
            />
          </div>
        </section>

        {/* Forma de pagamento */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Forma de pagamento</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <FormaCard ativo={forma === "PIX"} onClick={() => setForma("PIX")} icone={QrCode} titulo="PIX" sub="Confirmação imediata" />
            <FormaCard ativo={forma === "BOLETO"} onClick={() => setForma("BOLETO")} icone={FileText} titulo="Boleto" sub="Vence em 2 dias" />
            <FormaCard ativo={forma === "CARTAO_CREDITO"} onClick={() => setForma("CARTAO_CREDITO")} icone={CreditCard} titulo="Cartão" sub="Cobrança recorrente" />
          </div>
        </section>

        {/* Cartão (se selecionado) */}
        {forma === "CARTAO_CREDITO" && (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dados do cartão</h2>
            <div className="grid grid-cols-4 gap-3">
              <CampoCartao label="Nome impresso" name="cartaoNome" required colSpan={2} />
              <CampoCartao label="Número do cartão" name="cartaoNumero" required colSpan={2} placeholder="0000 0000 0000 0000" />
              <CampoCartao label="Mês" name="cartaoValidadeMes" type="number" min="1" max="12" placeholder="MM" required />
              <CampoCartao label="Ano" name="cartaoValidadeAno" type="number" min="2026" placeholder="AAAA" required />
              <CampoCartao label="CVV" name="cartaoCvv" required placeholder="123" />
            </div>
            <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
              <Lock className="h-3 w-3" /> Em modo demo, CVV "000" simula recusa. Conformidade PCI-DSS — não armazenamos o número completo.
            </p>
          </section>
        )}

        {/* Resumo */}
        <section className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-700">Total mensal</p>
            <p className="mt-1 text-3xl font-bold text-blue-900">{brl(valor)}</p>
            <p className="mt-1 text-xs text-blue-700">
              Plano {ROTULO[plano]} · {forma.replace("_", " ")}
            </p>
            {breakdownAtivo.cnpjsAdicionais > 0 && (
              <p className="mt-2 text-[11px] text-blue-700">
                {brl(breakdownAtivo.valorBase)} base + {breakdownAtivo.cnpjsAdicionais} CNPJ adicional ×{" "}
                {brl(PRECO_CNPJ_ADICIONAL)} = {brl(breakdownAtivo.valorAdicional)}
              </p>
            )}
            {breakdownAtivo.colaboradoresAdicionais > 0 && (
              <p className="mt-1 text-[11px] text-blue-700">
                {breakdownAtivo.colaboradoresAdicionais} colaborador
                {breakdownAtivo.colaboradoresAdicionais > 1 ? "es" : ""} adicional ×{" "}
                {brl(PRECO_COLABORADOR_ADICIONAL)} = {brl(breakdownAtivo.valorColaboradores)}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Confirmar e pagar
          </button>
        </section>

        {state?.erro && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.erro}</div>
        )}
      </form>
    </div>
  );
}

function PlanoCard({
  ativo,
  onClick,
  titulo,
  valor,
  bullets,
  destaque,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  valor: number;
  bullets: string[];
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border-2 p-5 transition ${
        ativo ? "border-blue-500 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{titulo}</h3>
        {destaque && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
            Mais completo
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold">
        {brl(valor)}
        <span className="text-sm font-normal text-slate-500">/mês</span>
      </p>
      <ul className="mt-3 space-y-1 text-xs text-slate-600">
        {bullets.map((b) => (
          <li key={b}>· {b}</li>
        ))}
      </ul>
    </button>
  );
}

function FormaCard({
  ativo,
  onClick,
  icone: Icone,
  titulo,
  sub,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
        ativo ? "border-blue-500 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <Icone className={`h-6 w-6 ${ativo ? "text-blue-600" : "text-slate-500"}`} />
      <span className="text-sm font-medium">{titulo}</span>
      <span className="text-[11px] text-slate-500">{sub}</span>
    </button>
  );
}

function CampoCartao({
  label,
  colSpan = 1,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; colSpan?: 1 | 2 }) {
  return (
    <label className={`flex flex-col gap-1 ${colSpan === 2 ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input {...props} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
    </label>
  );
}
