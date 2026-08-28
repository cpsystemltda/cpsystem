import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getUsuarioAtual } from "@/lib/auth";

/**
 * Entrega um arquivo do cliente — só para quem tem sessão e é dono dele.
 *
 * Regina 28/08: antes desta rota, todo anexo ficava público no armazenamento.
 * Sem listagem e com caminho aleatório de 32 caracteres, ninguém adivinhava —
 * mas um link repassado por engano abria contrato, nota fiscal ou parecer para
 * qualquer pessoa, sem login.
 *
 * A conferência é de DONO, não só de sessão: estar logado no CP System não dá
 * direito ao documento de outra empresa. Em modo de acompanhamento (super admin
 * "vendo como cliente"), `getUsuarioAtual` já troca a conta e derruba o
 * super admin, então o acesso fica restrito à conta que está sendo acompanhada
 * — que é exatamente o comportamento desejado.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Faça login para abrir o arquivo." }, { status: 401 });
  }

  const arquivo = await prisma.arquivo.findUnique({
    where: { id },
    select: {
      id: true,
      pathname: true,
      contaId: true,
      nomeOriginal: true,
      contentType: true,
      urlPublica: true,
    },
  });
  // 404 (e não 403) quando o arquivo é de outra conta: responder "existe, mas
  // não é seu" já entrega a informação de que ele existe.
  if (!arquivo) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
  const podeVer = arquivo.contaId === usuario.contaId || usuario.superAdmin;
  if (!podeVer) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });

  try {
    // Arquivo guardado antes de o armazenamento aceitar objeto privado: busca
    // pela URL de origem. O navegador segue conhecendo só esta rota.
    let stream: ReadableStream<Uint8Array> | null = null;
    let tipoDoArmazenamento: string | null = null;
    if (arquivo.urlPublica) {
      const r = await fetch(arquivo.urlPublica);
      if (!r.ok || !r.body) {
        return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
      }
      stream = r.body;
      tipoDoArmazenamento = r.headers.get("content-type");
    } else {
      const resultado = await get(arquivo.pathname, { access: "private" });
      if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
        return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
      }
      stream = resultado.stream;
      tipoDoArmazenamento = resultado.headers.get("content-type");
    }

    // Best-effort: serve pra investigar acesso depois sem manter log por download.
    prisma.arquivo
      .update({ where: { id: arquivo.id }, data: { ultimoAcessoEm: new Date() } })
      .catch(() => {});

    const nomeSeguro = arquivo.nomeOriginal.replace(/["\\\r\n]/g, "_");
    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": arquivo.contentType || tipoDoArmazenamento || "application/octet-stream",
        "Content-Disposition": `inline; filename="${nomeSeguro}"`,
        // Cache só no navegador de quem já provou ter acesso — nunca em CDN
        // compartilhada, senão o arquivo volta a circular sem conferência.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[api/arquivo] falha ao ler do armazenamento:", e);
    return NextResponse.json({ erro: "Não consegui abrir este arquivo." }, { status: 500 });
  }
}
