import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { trocarCodePorTokens, emailDoIdToken } from "@/lib/googleCalendar";

// Callback OAuth Google. Valida state (anti-CSRF), troca code por
// tokens, salva GoogleAccount. Redireciona pra /conta/integracoes.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/conta/integracoes?erro=${encodeURIComponent(errorParam)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/conta/integracoes?erro=resposta_invalida", req.url),
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("google_oauth_state")?.value;
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(
      new URL("/conta/integracoes?erro=state_invalido", req.url),
    );
  }
  cookieStore.delete("google_oauth_state");

  // state = "<random>:<usuarioId>"
  const usuarioId = state.split(":")[1];
  if (!usuarioId) {
    return NextResponse.redirect(
      new URL("/conta/integracoes?erro=usuario_invalido", req.url),
    );
  }

  try {
    const tokens = await trocarCodePorTokens(code);
    const email = emailDoIdToken(tokens.idToken);

    await prisma.googleAccount.upsert({
      where: { usuarioId },
      create: {
        usuarioId,
        googleEmail: email || "(desconhecido)",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + (tokens.expiresIn - 60) * 1000),
      },
      update: {
        googleEmail: email || "(desconhecido)",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + (tokens.expiresIn - 60) * 1000),
      },
    });

    return NextResponse.redirect(new URL("/conta/integracoes?conectado=1", req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_desconhecido";
    return NextResponse.redirect(
      new URL(`/conta/integracoes?erro=${encodeURIComponent(msg.slice(0, 100))}`, req.url),
    );
  }
}
