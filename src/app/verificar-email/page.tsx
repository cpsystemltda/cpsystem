import Link from "next/link";
import { prisma } from "@/lib/prisma";

/**
 * Confirmação de e-mail pelo link enviado nas boas-vindas.
 *
 * Pública de propósito: a pessoa pode abrir o link no celular, onde talvez nem
 * esteja logada. O que autoriza é o token, que vale sete dias e serve uma vez.
 */
export const dynamic = "force-dynamic";

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let estado: "ok" | "expirado" | "invalido" | "ja_feito" = "invalido";
  let nome: string | null = null;

  if (token) {
    const link = await prisma.magicLink.findUnique({
      where: { token },
      select: {
        id: true,
        motivo: true,
        expiraEm: true,
        usadoEm: true,
        usuario: { select: { id: true, nome: true, emailVerificadoEm: true } },
      },
    });

    if (link && link.motivo === "verificar-email") {
      nome = link.usuario.nome.split(" ")[0] || link.usuario.nome;
      if (link.usuario.emailVerificadoEm) {
        estado = "ja_feito";
      } else if (link.usadoEm) {
        estado = "ja_feito";
      } else if (link.expiraEm < new Date()) {
        estado = "expirado";
      } else {
        await prisma.$transaction([
          prisma.usuario.update({
            where: { id: link.usuario.id },
            data: { emailVerificadoEm: new Date() },
          }),
          prisma.magicLink.update({ where: { id: link.id }, data: { usadoEm: new Date() } }),
        ]);
        estado = "ok";
      }
    }
  }

  const textos = {
    ok: {
      titulo: `E-mail confirmado${nome ? `, ${nome}` : ""}!`,
      corpo: "Pronto. Os avisos de prazo, vencimento e cobrança chegam com segurança neste endereço.",
    },
    ja_feito: {
      titulo: "Este e-mail já estava confirmado",
      corpo: "Não precisa fazer mais nada — está tudo certo por aqui.",
    },
    expirado: {
      titulo: "Este link expirou",
      corpo: "Links de confirmação valem sete dias. Fale com a gente que enviamos outro na hora.",
    },
    invalido: {
      titulo: "Link inválido",
      corpo: "Confira se o endereço foi copiado inteiro. Se continuar assim, é só falar com a gente.",
    },
  }[estado];

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl ${
            estado === "ok" || estado === "ja_feito"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
          aria-hidden
        >
          {estado === "ok" || estado === "ja_feito" ? "✓" : "!"}
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{textos.titulo}</h1>
        <p className="mt-2 text-sm text-slate-600">{textos.corpo}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Ir para o sistema
        </Link>
      </div>
    </main>
  );
}
