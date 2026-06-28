import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/googleCalendar";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

// Inicia OAuth: gera state random, salva em cookie httpOnly pra
// validar no callback, e redireciona pro Google.
export async function GET() {
  const usuario = await exigirUsuario();

  const state = randomBytes(16).toString("hex");
  const payload = `${state}:${usuario.id}`;

  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", payload, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 min
    path: "/",
  });

  return NextResponse.redirect(buildAuthUrl(payload));
}
