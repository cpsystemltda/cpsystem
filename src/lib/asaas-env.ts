import "server-only";

// Helper unico pra saber se estamos em producao Asaas.
// Aceita variacoes: "production", "producao", "PROD", "prod".
export function asaasProducao(ambienteStr?: string | null): boolean {
  const v = String(ambienteStr ?? process.env.ASAAS_AMBIENTE ?? "").toLowerCase().trim();
  return v === "production" || v === "producao" || v === "prod";
}

export function asaasBaseUrl(ambienteStr?: string | null): string {
  return asaasProducao(ambienteStr) ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
}
