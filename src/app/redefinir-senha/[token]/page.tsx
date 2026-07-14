import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RedefinirSenhaForm } from "./RedefinirSenhaForm";

// Landing do link de reset de senha (Regina 14/07).
// GET nao consome — igual ao magic link de migracao. Preview WA nao queima.
// Consumo acontece via POST na server action `salvarNovaSenhaAction`.

export default async function RedefinirSenhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await prisma.magicLink.findUnique({
    where: { token },
    select: { motivo: true, expiraEm: true, usuario: { select: { nome: true, email: true } } },
  });

  const invalido = !link || link.expiraEm < new Date() || link.motivo !== "redefinir_senha";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FAF6EB 60%, #F2E9CF 100%)" }}>
      <div className="w-full rounded-2xl bg-white p-8 shadow-sm" style={{ border: "0.5px solid rgba(168,137,71,0.25)" }}>
        {invalido ? (
          <>
            <h1 className="text-xl font-bold text-slate-900">Link inválido ou expirado</h1>
            <p className="mt-3 text-sm text-slate-600">
              Este link de redefinição não é mais válido. Solicite um novo — o link tem validade curta (30
              minutos) por segurança.
            </p>
            <Link
              href="/esqueci-senha"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Solicitar novo link
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">Definir nova senha</h1>
            <p className="mt-2 text-sm text-slate-600">
              Você está redefinindo a senha da conta{" "}
              <strong>{link.usuario.email}</strong> ({link.usuario.nome}).
            </p>
            <RedefinirSenhaForm token={token} />
          </>
        )}
      </div>
    </div>
  );
}
