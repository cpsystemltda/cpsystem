import { NextResponse } from "next/server";

/**
 * Recebe os avisos da Content-Security-Policy em modo observação.
 *
 * Enquanto a política roda como Report-Only, o navegador não bloqueia nada —
 * só avisa aqui o que bloquearia. É esta lista que diz quando a política pode
 * passar a valer de verdade sem quebrar tela de cliente.
 *
 * Aberta de propósito (o navegador posta sem sessão), e sem gravar nada em
 * banco: só log, para não dar a ninguém um jeito fácil de encher tabela nossa.
 */
export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const r = corpo?.["csp-report"] ?? corpo;
    const violado = r?.["violated-directive"] ?? r?.effectiveDirective ?? "?";
    const bloqueado = r?.["blocked-uri"] ?? r?.blockedURL ?? "?";
    const pagina = r?.["document-uri"] ?? r?.documentURL ?? "?";
    console.warn(`[csp] ${violado} bloquearia ${String(bloqueado).slice(0, 200)} em ${String(pagina).slice(0, 200)}`);
  } catch {
    // Relatório malformado não merece 500.
  }
  return new NextResponse(null, { status: 204 });
}
