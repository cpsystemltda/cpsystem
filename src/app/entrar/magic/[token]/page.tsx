import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Landing page do magic link (Regina 13/07 — fix pos-incidente).
// GET NAO CONSOME — evita queimar o token quando o WhatsApp faz preview do
// link (unfurler dispara GET automatico ao colar link no chat). Ao inves
// disso, essa pagina mostra um botao "Continuar" que envia POST via form
// pra /entrar/magic/[token]/confirmar. So o POST consome + cria sessao.

export default async function MagicLinkLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await prisma.magicLink.findUnique({
    where: { token },
    include: { usuario: { select: { nome: true, email: true } } },
  });

  const agora = new Date();
  const invalido = !link || link.usadoEm || link.expiraEm < agora;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          {invalido ? "Link inválido" : "Continuar login"}
        </h1>

        {invalido ? (
          <>
            <p className="mt-3 text-sm text-slate-600">
              {link?.usadoEm
                ? "Este link já foi utilizado. Peça um novo para o administrador."
                : link
                  ? "Este link expirou. Peça um novo para o administrador."
                  : "Este link não existe ou foi revogado."}
            </p>
            <Link
              href="/entrar"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Ir para login normal
            </Link>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">
              Clique no botão abaixo para entrar como{" "}
              <strong>{link.usuario.nome}</strong> ({link.usuario.email}) e concluir a migração da sua conta.
            </p>
            <form action={`/entrar/magic/${token}/confirmar`} method="POST" className="mt-6">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700"
              >
                Entrar e concluir migração →
              </button>
            </form>
            <p className="mt-4 text-xs text-slate-500">
              Uso único · válido até {link.expiraEm.toLocaleString("pt-BR")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
