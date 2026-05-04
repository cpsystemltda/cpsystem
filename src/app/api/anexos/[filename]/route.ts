import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { exigirUsuario } from "@/lib/auth";
import { caminhoArquivo } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const usuario = await exigirUsuario();
  const { filename } = await params;

  // Validar que o arquivo está vinculado a algum recurso da conta do usuário
  const url = `/api/anexos/${filename}`;
  const anexo = await prisma.anexo.findFirst({
    where: {
      url,
      OR: [
        { ata: { empresa: { contaId: usuario.contaId } } },
        { contrato: { empresa: { contaId: usuario.contaId } } },
        { empenho: { empresa: { contaId: usuario.contaId } } },
      ],
    },
  });

  if (!anexo) {
    // Pode ser arquivo de PDF principal (ata.arquivoPdfUrl, etc.) — verifica também
    const usadoComoPdfPrincipal = await prisma.ata.findFirst({
      where: { arquivoPdfUrl: url, empresa: { contaId: usuario.contaId } },
    }) || await prisma.contrato.findFirst({
      where: { arquivoPdfUrl: url, empresa: { contaId: usuario.contaId } },
    }) || await prisma.empenho.findFirst({
      where: { arquivoPdfUrl: url, empresa: { contaId: usuario.contaId } },
    });

    if (!usadoComoPdfPrincipal) {
      return new NextResponse("Não autorizado", { status: 403 });
    }
  }

  let path: string;
  try {
    path = caminhoArquivo(filename);
  } catch {
    return new NextResponse("Nome inválido", { status: 400 });
  }

  if (!existsSync(path)) {
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }

  const data = await readFile(path);
  const mime = anexo?.mimeType ||
    (filename.endsWith(".pdf") ? "application/pdf" :
      filename.endsWith(".png") ? "image/png" :
        filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? "image/jpeg" : "application/octet-stream");

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${anexo?.nome || filename}"`,
    },
  });
}
