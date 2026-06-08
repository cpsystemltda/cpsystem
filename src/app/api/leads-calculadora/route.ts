// Endpoint pra captura de email das calculadoras publicas.
// Por enquanto, apenas loga no servidor (visivel via Vercel logs).
// Depois conectar com Resend/Mailchimp/etc quando a Regina configurar.
//
// Nao afeta nada no banco — captura simples sem schema novo.

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, origem, ...resto } = body || {};

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ ok: false, erro: "Email inválido." }, { status: 400 });
    }

    // Loga estruturado pra Vercel — Regina pode exportar via dashboard.
    // Quando ela configurar Resend/Mailchimp, substituir aqui.
    console.log("[lead-calculadora]", JSON.stringify({
      timestamp: new Date().toISOString(),
      email,
      origem: origem || "desconhecido",
      ip: request.headers.get("x-forwarded-for") || "—",
      userAgent: request.headers.get("user-agent") || "—",
      payload: resto,
    }));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[lead-calculadora] erro:", e);
    return NextResponse.json(
      { ok: false, erro: "Erro interno." },
      { status: 500 },
    );
  }
}
