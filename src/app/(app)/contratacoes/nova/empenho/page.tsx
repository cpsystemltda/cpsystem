import { redirect } from "next/navigation";

// Rota legada — usuários e bookmarks antigos caem aqui. Redireciona pra
// nova rota de "Nota de Empenho" dentro do agrupador Fornecimento/Execução.
export default function Page() {
  redirect("/contratacoes/nova/fornecimento/nota-empenho");
}
