import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProvedorFiscal } from "@/lib/fiscal";
import { aplicarResultado } from "@/app/actions/notaFiscal";

/**
 * Aviso da casa fiscal de que a nota mudou de estado.
 *
 * O corpo que chega aqui NÃO é fonte de verdade — serve só de gatilho. A gente
 * pega a referência, consulta o provedor com a nossa própria credencial e grava
 * o que ELE responder. Assim, mesmo que alguém descubra a URL e poste um aviso
 * falso de "autorizada", o resultado gravado continua sendo o que a prefeitura
 * de fato registrou.
 *
 * É o mesmo raciocínio que já vale pro webhook de pagamento: aviso externo abre
 * a consulta, nunca escreve direto.
 */
export async function POST(req: Request) {
  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, erro: "Corpo inválido" }, { status: 400 });
  }

  const referencia = String(corpo.ref ?? corpo.referencia ?? "").trim();
  if (!referencia) {
    return NextResponse.json({ ok: false, erro: "Sem referência" }, { status: 400 });
  }

  const nota = await prisma.notaFiscal.findUnique({
    where: { referencia },
    select: { id: true, empresaId: true, status: true },
  });
  // 200 mesmo sem encontrar: o provedor reenvia em loop quando recebe erro, e
  // referência desconhecida não vai passar a existir por insistência.
  if (!nota) {
    console.warn("[webhook-fiscal] referência desconhecida:", referencia);
    return NextResponse.json({ ok: true, ignorado: true });
  }

  try {
    const { provedor } = await getProvedorFiscal(nota.empresaId);
    const r = await provedor.consultar(referencia);
    await aplicarResultado(nota.id, r);
    return NextResponse.json({ ok: true, status: r.status });
  } catch (e) {
    console.error("[webhook-fiscal] falha ao consultar:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
