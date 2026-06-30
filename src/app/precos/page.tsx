import { redirect } from "next/navigation";

// Igor 28/06: pagina /precos foi embutida na home como ancora #planos.
// Mantemos esta rota como redirect 308 pra nao quebrar links antigos
// (anuncios, prints, indexacao do Google).
export default function PrecosRedirect() {
  redirect("/#planos");
}
