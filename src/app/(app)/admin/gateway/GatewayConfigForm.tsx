"use client";

import { useActionState, useState } from "react";
import { Lock, AlertTriangle } from "lucide-react";
import { salvarConfigGatewayAction } from "@/app/actions/configuracao";

type Cfg = {
  provider: string;
  ambiente: string;
  apiKey: string | null;
  webhookToken: string | null;
};

export function GatewayConfigForm({ cfg }: { cfg: Cfg | null }) {
  const [state, formAction] = useActionState(salvarConfigGatewayAction, null);
  const [provider, setProvider] = useState(cfg?.provider || "DEMO");

  return (
    <form action={formAction} className="space-y-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Provider</span>
        <select
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="DEMO">DEMO — sem cobrança real (use enquanto não tiver credencial)</option>
          <option value="ASAAS">ASAAS — gateway brasileiro (PIX, boleto, cartão)</option>
          <option value="STRIPE" disabled>Stripe — em breve</option>
        </select>
      </label>

      {provider !== "DEMO" && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Ambiente</span>
            <select name="ambiente" defaultValue={cfg?.ambiente || "sandbox"} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="sandbox">Sandbox (testes)</option>
              <option value="production">Production (cobra de verdade)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">API Key</span>
            <input
              type="password"
              name="apiKey"
              defaultValue={cfg?.apiKey || ""}
              placeholder="$aas_YourKeyHere..."
              className="rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
            <span className="text-xs text-slate-500">
              Pegue em{" "}
              <a href="https://www.asaas.com/customer/integrations" target="_blank" rel="noreferrer" className="text-blue-700 underline">
                ASAAS → Integrações → Gerar API Key
              </a>
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Webhook Token (opcional)</span>
            <input
              type="text"
              name="webhookToken"
              defaultValue={cfg?.webhookToken || ""}
              placeholder="cp_webhook_secret_2026"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="text-xs text-slate-500">
              Configure o mesmo token em{" "}
              <a href="https://www.asaas.com/customer/myAccount/notifications" target="_blank" rel="noreferrer" className="text-blue-700 underline">
                ASAAS → Notificações → Webhooks
              </a>
              . URL: <code>https://seu-dominio/api/webhooks/asaas</code>
            </span>
          </label>
        </>
      )}

      {state?.erro && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.erro}</div>}
      {state?.ok && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Configuração salva.</div>}

      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        Em produção, a API Key deve ser criptografada no banco. No MVP ela está em texto puro — não use em prod sem criptografia.
      </div>

      <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
        <Lock className="h-4 w-4" /> Salvar configuração
      </button>
    </form>
  );
}
