import { NextRequest, NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consultarCnpjsNaReceita } from "@/lib/receitaCnpj";

/**
 * Completa os dados da planilha com o que a Receita ja sabe (opcao B, Regina
 * 18/08). A tela chama em lotes pequenos pra mostrar progresso e nao esbarrar
 * no limite de consultas da BrasilAPI — por isso o teto baixo por requisicao.
 */

export const maxDuration = 60;

const MAX_POR_LOTE = 8;

export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();

  const analista = await prisma.analista.findFirst({
    where: { contaId: usuario.contaId },
    select: { id: true },
  });
  if (!analista) {
    return NextResponse.json({ erro: "Disponível apenas para contas de analista." }, { status: 403 });
  }

  const corpo = await req.json().catch(() => null);
  const lista = Array.isArray(corpo?.cnpjs) ? corpo.cnpjs : null;
  if (!lista) {
    return NextResponse.json({ erro: "Envie a lista de CNPJs." }, { status: 400 });
  }
  if (lista.length > MAX_POR_LOTE) {
    return NextResponse.json({ erro: `Máximo de ${MAX_POR_LOTE} CNPJs por vez.` }, { status: 400 });
  }

  const dados = await consultarCnpjsNaReceita(lista.map((c: unknown) => String(c ?? "")));
  return NextResponse.json({ ok: true, dados });
}
