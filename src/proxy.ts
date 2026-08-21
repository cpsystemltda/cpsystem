import { NextResponse, type NextRequest } from "next/server";

// Injeta o pathname num header pra o layout poder ler. Sustenta duas travas:
// o paywall de conta bloqueada e o acesso por modulo do colaborador — os dois
// decidem a partir da rota atual. Se este header parar de chegar, as duas falham
// ABRINDO, entao qualquer mexida aqui pede teste de acesso depois.
//
// Renomeado de `middleware` pra `proxy` no Next 16 (mesma funcionalidade; o
// nome antigo ainda funciona, mas com aviso de descontinuado no build).
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next|favicon|cp-system-logo).*)"],
};
