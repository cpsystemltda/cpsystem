"use client";

import { useEffect, useState } from "react";
import { COOKIE_ATRIBUICAO, desserializar, type Atribuicao } from "@/lib/atribuicao";

/**
 * Hidden inputs que levam a origem da visita (gclid + UTMs) junto com o
 * cadastro. O valor foi gravado num cookie pelo <GoogleTag /> quando a pessoa
 * entrou pela primeira vez — aqui so e lido de volta, porque entre o clique no
 * anuncio e o envio do formulario a querystring original ja se perdeu.
 *
 * Serve tanto pro cadastro de empresa quanto pro de analista.
 */
export function CamposAtribuicao() {
  const [a, setA] = useState<Atribuicao>({});

  useEffect(() => {
    if (typeof document === "undefined") return;
    const alvo = `${COOKIE_ATRIBUICAO}=`;
    const parte = document.cookie.split("; ").find((p) => p.startsWith(alvo));
    if (parte) setA(desserializar(decodeURIComponent(parte.slice(alvo.length))));
  }, []);

  return (
    <>
      <input type="hidden" name="gclid" value={a.gclid ?? ""} />
      <input type="hidden" name="utmSource" value={a.utmSource ?? ""} />
      <input type="hidden" name="utmMedium" value={a.utmMedium ?? ""} />
      <input type="hidden" name="utmCampaign" value={a.utmCampaign ?? ""} />
      <input type="hidden" name="utmTerm" value={a.utmTerm ?? ""} />
    </>
  );
}
