import { NextRequest, NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lerPlanilha, interpretarPlanilha } from "@/lib/importarPlanilhaClientes";

/**
 * Recebe a planilha do analista e devolve o que a IA entendeu — sem gravar
 * nada. A gravacao so acontece depois, quando ele confere a previa e confirma:
 * cadastrar empresa errada suja cobranca e nota fiscal, entao o passo de
 * revisao e obrigatorio por design.
 */

const LIMITE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();

  // So analista importa carteira propria.
  const analista = await prisma.analista.findFirst({
    where: { contaId: usuario.contaId },
    select: { id: true },
  });
  if (!analista) {
    return NextResponse.json({ erro: "Disponível apenas para contas de analista." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Envie a planilha no campo 'arquivo'." }, { status: 400 });
  }
  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json({ erro: "A planilha passa de 5 MB." }, { status: 400 });
  }
  if (!/\.(xlsx|xls|csv)$/i.test(arquivo.name)) {
    return NextResponse.json({ erro: "Formato aceito: .xlsx, .xls ou .csv." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const grade = lerPlanilha(buffer);
    if (grade.length === 0) {
      return NextResponse.json({ erro: "A planilha está vazia." }, { status: 400 });
    }
    const resultado = await interpretarPlanilha(grade);

    // Marca quem ja existe na base: evita o analista criar duplicata de uma
    // empresa que outro analista (ou ele mesmo) ja cadastrou.
    const cnpjs = resultado.clientes.map((c) => c.cnpj).filter((c): c is string => !!c);
    const existentes = cnpjs.length
      ? await prisma.empresa.findMany({
          where: { cnpj: { in: cnpjs } },
          select: { cnpj: true, razaoSocial: true },
        })
      : [];
    const mapa = new Map(existentes.map((e) => [e.cnpj, e.razaoSocial]));

    return NextResponse.json({
      ok: true,
      linhasLidas: grade.length,
      ...resultado,
      clientes: resultado.clientes.map((c) => ({
        ...c,
        jaCadastrada: c.cnpj ? mapa.get(c.cnpj) ?? null : null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { erro: err instanceof Error ? err.message : "Falha ao ler a planilha." },
      { status: 500 },
    );
  }
}
