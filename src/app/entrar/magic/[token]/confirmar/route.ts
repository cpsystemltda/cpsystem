import { NextRequest, NextResponse } from "next/server";
import { consumirMagicLink } from "@/lib/magicLink";
import { criarSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

// POST /entrar/magic/[token]/confirmar — botao "Continuar" da landing page.
// So o POST consome o token + cria sessao. GET nunca consome (evita preview
// do WhatsApp queimar o link).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const consumido = await consumirMagicLink(token);
  if (!consumido) {
    return NextResponse.redirect(new URL(`/entrar/magic/${token}`, req.url), 303);
  }

  await criarSessao(consumido.usuarioId);

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: consumido.usuarioId },
      select: { contaId: true },
    });
    if (usuario) {
      await registrarAuditoria({
        contaId: usuario.contaId,
        usuarioId: consumido.usuarioId,
        acao: "ATUALIZAR",
        recurso: "Sessao",
        resumo: `Login via magic link (motivo: ${consumido.motivo})`,
      });
    }
  } catch {
    // silencioso
  }

  const destino = consumido.motivo.startsWith("migracao")
    ? "/conta/completar-cadastro"
    : "/dashboard";

  return NextResponse.redirect(new URL(destino, req.url), 303);
}
