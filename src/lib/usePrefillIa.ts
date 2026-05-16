"use client";

/**
 * Hook que lê o payload de prefill salvo no sessionStorage pelo
 * UploadInteligenteCard, devolve os dados extraídos pra que o form
 * pré-popule estados (setDados, arquivoUrl, etc.).
 *
 * Uso típico:
 *   const prefill = usePrefillIa<AtaExtraida>("ATA");
 *   useEffect(() => {
 *     if (prefill?.dados) setDados(prefill.dados);
 *     if (prefill?.arquivoUrl) setArquivoPdfUrl(prefill.arquivoUrl);
 *   }, [prefill]);
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TipoDocumento } from "@/app/actions/iaClassificar";

export type PrefillPayload<T> = {
  tipo: TipoDocumento;
  dados?: T;
  arquivoUrl?: string;
  arquivoNome?: string;
};

export function usePrefillIa<T>(tipoEsperado: TipoDocumento): PrefillPayload<T> | null {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<PrefillPayload<T> | null>(null);

  useEffect(() => {
    const key = searchParams.get("prefill");
    if (!key) return;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PrefillPayload<T>;
      if (parsed.tipo !== tipoEsperado) return;
      setPayload(parsed);
      // Limpa imediatamente — evita re-popular se o usuário navegar pra trás
      window.sessionStorage.removeItem(key);
    } catch (err) {
      console.warn("[usePrefillIa] falha ao ler prefill:", err);
    }
  }, [searchParams, tipoEsperado]);

  return payload;
}
