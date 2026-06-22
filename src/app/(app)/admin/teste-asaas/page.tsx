"use client";

import { useState } from "react";
import {
  criarCobrancaTesteAsaasAction,
  type ResultadoTesteAsaas,
} from "@/app/actions/testeAsaas";

// Pagina admin pra validar integracao Asaas (Regina 22/06).
// Acessivel apenas pra super admin. Cria uma cobranca PIX de R$ 10
// pra testar o ciclo completo: criar -> pagar -> webhook -> processar.

export default function TesteAsaasPage() {
  const [resultado, setResultado] = useState<ResultadoTesteAsaas | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function gerar() {
    setCarregando(true);
    setResultado(null);
    try {
      const r = await criarCobrancaTesteAsaasAction();
      setResultado(r);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1
        className="text-3xl font-extrabold"
        style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
      >
        Teste de integração Asaas
      </h1>
      <p className="mt-3 text-sm" style={{ color: "var(--text-soft)" }}>
        Cria uma cobrança PIX avulsa de R$ 10,00 na sua conta Asaas pra validar a integração
        end-to-end. Após pagar, o webhook deve disparar e o status da cobrança no banco vai mudar pra
        PAGA automaticamente.
      </p>

      <div className="mt-8 glass rounded-2xl px-8 py-7">
        <button
          type="button"
          onClick={gerar}
          disabled={carregando}
          className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
            color: "#0A0A0A",
            letterSpacing: "0.2em",
            boxShadow:
              "0 12px 32px -6px rgba(168,137,71,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
          }}
        >
          {carregando ? "Gerando..." : "Gerar cobrança PIX R$ 10"}
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
          <div className="mt-6">
            <div className="mb-4 text-[11px] uppercase" style={{ letterSpacing: "0.2em", color: "var(--text-mute)" }}>
              Cobrança gerada · ID {resultado.chargeId}
            </div>

            {resultado.pixQrCode && (
              <div className="mb-5 flex justify-center">
                <img
                  src={resultado.pixQrCode}
                  alt="QR Code PIX"
                  className="rounded-2xl"
                  style={{ width: 240, height: 240, border: "0.5px solid var(--hairline)" }}
                />
              </div>
            )}

            {resultado.pixCopiaCola && (
              <div>
                <div
                  className="text-[10px] uppercase"
                  style={{ letterSpacing: "0.2em", color: "var(--text-mute)" }}
                >
                  PIX Copia e Cola
                </div>
                <div
                  className="mt-2 break-all rounded-xl px-4 py-3 text-xs"
                  style={{
                    background: "rgba(255,255,255,0.7)",
                    border: "0.5px solid var(--hairline)",
                    color: "var(--text-soft)",
                    fontFamily: "monospace",
                  }}
                >
                  {resultado.pixCopiaCola}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resultado.pixCopiaCola || "");
                  }}
                  className="mt-3 text-xs font-bold"
                  style={{ color: "var(--primary-deep)" }}
                >
                  📋 Copiar código
                </button>
              </div>
            )}

            {resultado.invoiceUrl && (
              <div className="mt-5">
                <a
                  href={resultado.invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold"
                  style={{ color: "var(--primary-deep)" }}
                >
                  → Abrir fatura no Asaas
                </a>
              </div>
            )}

            <p className="mt-6 text-xs" style={{ color: "var(--text-mute)" }}>
              Pague o PIX pelo seu app do banco. Em segundos o webhook chega e atualiza o status no
              banco. Acompanhe em <code>/admin/gateway</code> ou no painel do Asaas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
