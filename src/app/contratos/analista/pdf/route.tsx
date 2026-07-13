import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ContratoAnalistaPdfDoc } from "@/lib/pdf/contratoAnalistaPdf";
import { VERSAO_CONTRATO_ANALISTA } from "@/components/legal/ContratoAnalistaParceiro";
import { prisma } from "@/lib/prisma";
import { getUsuarioAtual } from "@/lib/auth";

// Serve o PDF do Contrato do Analista Parceiro (Regina 13/07).
// - Publico (sem auth) por padrao — assim a Z-API consegue baixar do URL pra
//   enviar via WA.
// - Se ?analistaId= for passado E o solicitante estiver logado como super
//   admin, personaliza com os dados do analista (nome, CPF, endereco).
// - Regina pediu que o contrato de analista seja enviado pro Igor revisar —
//   sem parametro, sai versao com placeholders.
//
// Runtime: nodejs (renderToBuffer nao roda em Edge).
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const analistaIdParam = url.searchParams.get("analistaId");

  let analista: {
    nomeCompleto?: string | null;
    cpf?: string | null;
    endereco?: string | null;
    email?: string | null;
    telefone?: string | null;
  } | undefined = undefined;

  if (analistaIdParam) {
    // Personalizacao so pra super admin (nao vazar dados de analista pra
    // quem tiver o link).
    const usuario = await getUsuarioAtual();
    if (usuario?.superAdmin) {
      const encontrado = await prisma.analista.findUnique({
        where: { id: analistaIdParam },
        select: { nomeCompleto: true, cpf: true, endereco: true, email: true, telefone: true },
      });
      if (encontrado) analista = encontrado;
    }
  }

  const buffer = await renderToBuffer(<ContratoAnalistaPdfDoc analista={analista} />);

  const nomeArquivo = `Contrato-Analista-Parceiro-CP-System-v${VERSAO_CONTRATO_ANALISTA}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivo}"`,
      // Cache curto — texto do contrato pode mudar mas com bump de versao
      // o nome do arquivo muda; 5min protege contra rederizacoes repetidas
      // no mesmo minuto.
      "Cache-Control": "public, max-age=300",
    },
  });
}
