import { NextRequest, NextResponse } from "next/server";
import { consumirMagicLink } from "@/lib/magicLink";
import { criarSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

// GET /entrar/magic/[token] — clique no link enviado por WA. Consome o token
// (uso unico), cria sessao, e redireciona pra destino conforme o motivo.
// Regina 13/07: fluxo pra migracao do Leo.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const consumido = await consumirMagicLink(token);
  if (!consumido) {
    // Token invalido/expirado/usado — redireciona pra /entrar com aviso
    return NextResponse.redirect(new URL("/entrar?motivo=link_invalido", _req.url));
  }

  // Cria sessao regular
  await criarSessao(consumido.usuarioId);

  // Auditoria (nao bloqueia login se falhar)
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

  // Destino conforme motivo. "migracao_leo" e afins vao pra completar-cadastro.
  const destino = consumido.motivo.startsWith("migracao")
    ? "/conta/completar-cadastro"
    : "/dashboard";

  return NextResponse.redirect(new URL(destino, _req.url));
}
