"use client";

import { useActionState } from "react";
import {
  testarCobrancaCartaoAction,
  type ResultadoTesteCartao,
} from "@/app/actions/testeAsaasCartao";

// Pagina admin pra validar cobranca via CARTAO DE CREDITO no Asaas com
// valor reduzido (R$ 10) simulando assinatura Premium (Regina 23/06).
// PCI-DSS: numero do cartao NAO eh salvo localmente — vai direto pro Asaas.

export default function TesteAsaasCartaoPage() {
  const [resultado, formAction, pending] = useActionState<ResultadoTesteCartao | null, FormData>(
    testarCobrancaCartaoAction,
    null,
  );

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1
        className="text-3xl font-extrabold"
        style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
      >
        Teste de cobrança CARTÃO — Premium R$ 10
      </h1>
      <p className="mt-3 text-sm" style={{ color: "var(--text-soft)" }}>
        Simula uma assinatura <strong>Premium</strong> com valor reduzido de <strong>R$ 10</strong>{" "}
        pra validar a integração de cartão de crédito com Asaas. Se o cartão for aprovado, a conta
        é ativada como PREMIUM automaticamente.
      </p>
      <p
        className="mt-3 rounded-2xl px-4 py-3 text-xs"
        style={{
          background: "rgba(212,175,55,0.10)",
          border: "0.5px solid rgba(168,137,71,0.30)",
          color: "var(--text-soft)",
        }}
      >
        🔒 PCI-DSS: o número do cartão vai <strong>direto</strong> pro Asaas via API. Não fica salvo
        no nosso banco. Salvamos apenas últimos 4 dígitos + bandeira.
      </p>

      <form action={formAction} className="mt-8 glass rounded-2xl px-8 py-7">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
              Número do cartão
            </label>
            <input
              name="numero"
              type="text"
              placeholder="0000 0000 0000 0000"
              required
              autoComplete="cc-number"
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm"
              style={{ border: "1px solid var(--hairline)", background: "white" }}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
              Nome do titular (como impresso)
            </label>
            <input
              name="nome"
              type="text"
              placeholder="REGINA LUIZA FERNANDES"
              required
              autoComplete="cc-name"
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm uppercase"
              style={{ border: "1px solid var(--hairline)", background: "white" }}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
              Mês validade
            </label>
            <input
              name="validadeMes"
              type="number"
              min={1}
              max={12}
              placeholder="MM"
              required
              autoComplete="cc-exp-month"
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm"
              style={{ border: "1px solid var(--hairline)", background: "white" }}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
              Ano validade
            </label>
            <input
              name="validadeAno"
              type="number"
              min={2026}
              max={2050}
              placeholder="AAAA"
              required
              autoComplete="cc-exp-year"
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm"
              style={{ border: "1px solid var(--hairline)", background: "white" }}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}>
              CVV
            </label>
            <input
              name="cvv"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="000"
              required
              autoComplete="cc-csc"
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm"
              style={{ border: "1px solid var(--hairline)", background: "white" }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 text-[13px] font-bold uppercase transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
            color: "#0A0A0A",
            letterSpacing: "0.2em",
            boxShadow: "0 12px 32px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
          }}
        >
          {pending ? "Processando cartão..." : "Cobrar R$ 10 no cartão"}
        </button>

        {resultado && !resultado.ok && (
          <div
            className="mt-6 rounded-2xl px-5 py-4 text-sm"
            style={{
              background: "rgba(232,138,152,0.14)",
              border: "0.5px solid rgba(198,103,112,0.5)",
              color: "var(--coral-deep)",
            }}
          >
            <strong>Erro:</strong> {resultado.erro}
          </div>
        )}

        {resultado && resultado.ok && (
          <div
            className="mt-6 rounded-2xl px-5 py-4 text-sm"
            style={{
              background: "rgba(93, 216, 182, 0.14)",
              border: "0.5px solid rgba(46, 171, 133, 0.5)",
              color: "var(--text)",
            }}
          >
            <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.2em" }}>
              Cobrança processada
            </div>
            <ul className="mt-3 space-y-1.5">
              <li>
                <strong>Status:</strong> {resultado.status}
              </li>
              <li>
                <strong>Charge ID Asaas:</strong> {resultado.chargeId}
              </li>
              <li>
                <strong>Cartão:</strong> {resultado.cartaoBandeira} final {resultado.cartaoUltimos}
              </li>
              <li>
                <strong>Conta ativada como PREMIUM:</strong>{" "}
                {resultado.contaAtivada ? "✅ Sim (PREMIUM por +1 mês)" : "⏳ Aguardando confirmação"}
              </li>
            </ul>
            {resultado.invoiceUrl && (
              <a
                href={resultado.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold"
                style={{ color: "var(--primary-deep)" }}
              >
                → Abrir fatura no Asaas
              </a>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
