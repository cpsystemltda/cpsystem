import { NextResponse, type NextRequest } from "next/server";

// Injeta o pathname num header pra o layout poder ler (paywall)
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next|favicon|cp-system-logo).*)"],
};
