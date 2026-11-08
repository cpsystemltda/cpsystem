import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { gerarModeloXlsx } from "@/lib/colaboradoresServer";

// ESP-008 RN02: planilha-modelo para importar colaboradores.
export const runtime = "nodejs";

export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new NextResponse("Não autorizado", { status: 401 });
  const buf = gerarModeloXlsx();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-colaboradores-cp-system.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
