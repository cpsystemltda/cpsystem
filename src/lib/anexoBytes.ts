import "server-only";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

/**
 * Lê os bytes de um anexo pelo mesmo caminho que /api/arquivo/[id] usa para
 * servi-lo — inclusive a conferência de dono, repetida aqui porque o `Anexo`
 * aponta para o `Arquivo` só pela URL.
 *
 * Usado pelo pacote .zip da aba Anexos e pela IA que relê os anexos de um
 * contrato já cadastrado (regime legal, ESP-001). Devolve `null` para o
 * caminho legado (/api/anexos/<nome>, filesystem efêmero) e para arquivo de
 * outra conta.
 */
export async function lerBytesDoAnexo(
  url: string,
  contaId: string,
  superAdmin: boolean,
): Promise<{ bytes: Uint8Array; contentType: string | null } | null> {
  try {
    const interno = /^\/api\/arquivo\/([\w-]+)$/.exec(url);
    if (interno) {
      const arq = await prisma.arquivo.findUnique({
        where: { id: interno[1] },
        select: { pathname: true, contaId: true, urlPublica: true, contentType: true },
      });
      if (!arq || (arq.contaId !== contaId && !superAdmin)) return null;
      if (arq.urlPublica) {
        const r = await fetch(arq.urlPublica);
        if (!r.ok) return null;
        return { bytes: new Uint8Array(await r.arrayBuffer()), contentType: arq.contentType || r.headers.get("content-type") };
      }
      const res = await get(arq.pathname, { access: "private" });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      const bytes = new Uint8Array(await new Response(res.stream as unknown as BodyInit).arrayBuffer());
      return { bytes, contentType: arq.contentType || res.headers.get("content-type") };
    }
    if (/^https?:\/\//.test(url)) {
      // Anexo antigo, gravado com a URL pública do armazenamento.
      const r = await fetch(url);
      if (!r.ok) return null;
      return { bytes: new Uint8Array(await r.arrayBuffer()), contentType: r.headers.get("content-type") };
    }
    return null;
  } catch (e) {
    console.error("[anexoBytes] falha ao ler anexo:", url, e);
    return null;
  }
}
