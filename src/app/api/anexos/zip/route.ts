import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { zipSync } from "fflate";
import { prisma } from "@/lib/prisma";
import { getUsuarioAtual } from "@/lib/auth";
import { labelInstrumento } from "@/lib/instrumentoLabel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Baixa de uma vez todos os anexos de uma execução, ata ou contrato (.zip).
 *
 * C2VENDAS, follow-up de 06/11/2026 (Igor): a equipe passa informação por
 * telefone e precisa mandar empenho, ordem de fornecimento, edital e TR para
 * colaboradores e entregadores que estão na rua. Abrir anexo por anexo e
 * salvar um a um não serve para quem vai encaminhar tudo pelo WhatsApp.
 *
 * Mesma regra de dono de /api/arquivo/[id]: sessão + arquivo da própria
 * conta. Anexos do caminho legado (/api/anexos/<nome>, filesystem) não
 * existem mais em produção e são pulados — o nome deles vai num LEIA-ME
 * dentro do zip, para a pessoa saber o que faltou em vez de achar que o
 * sistema esqueceu.
 *
 * Os arquivos entram sem recompressão (`level: 0`): PDF e JPG já vêm
 * comprimidos, e o que importa aqui é um clique só, não o tamanho.
 */
export async function GET(req: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Faça login para baixar os anexos." }, { status: 401 });
  }

  const url = new URL(req.url);
  const empenhoId = url.searchParams.get("empenho");
  const ataId = url.searchParams.get("ata");
  const contratoId = url.searchParams.get("contrato");
  const contaId = usuario.contaId;
  const selecao = { orderBy: { criadoEm: "asc" as const }, select: { nome: true, url: true } };

  let anexos: { nome: string; url: string }[] = [];
  let rotulo = "";
  if (empenhoId) {
    const e = await prisma.empenho.findFirst({
      where: { id: empenhoId, empresa: { contaId } },
      select: { instrumento: true, numero: true, anexos: selecao },
    });
    if (!e) return naoEncontrado();
    anexos = e.anexos;
    rotulo = `${labelInstrumento(e.instrumento)} ${e.numero}`;
  } else if (ataId) {
    const a = await prisma.ata.findFirst({
      where: { id: ataId, empresa: { contaId } },
      select: { numero: true, anexos: selecao },
    });
    if (!a) return naoEncontrado();
    anexos = a.anexos;
    rotulo = `Ata ${a.numero}`;
  } else if (contratoId) {
    const c = await prisma.contrato.findFirst({
      where: { id: contratoId, empresa: { contaId } },
      select: { numero: true, anexos: selecao },
    });
    if (!c) return naoEncontrado();
    anexos = c.anexos;
    rotulo = `Contrato ${c.numero}`;
  } else {
    return NextResponse.json({ erro: "Informe a execução, a ata ou o contrato." }, { status: 400 });
  }

  if (anexos.length === 0) {
    return NextResponse.json({ erro: "Não há anexos para baixar." }, { status: 404 });
  }

  const arquivos: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  const faltaram: string[] = [];
  const usados = new Set<string>();
  for (const a of anexos) {
    const bytes = await lerAnexo(a.url, contaId, !!usuario.superAdmin);
    if (!bytes) {
      faltaram.push(a.nome);
      continue;
    }
    arquivos[nomeUnico(a.nome, usados)] = [bytes, { level: 0 }];
  }

  const incluidos = Object.keys(arquivos).length;
  if (incluidos === 0) {
    return NextResponse.json({ erro: "Nenhum dos anexos pôde ser lido do armazenamento." }, { status: 404 });
  }
  if (faltaram.length) {
    const aviso =
      `Anexos que não puderam ser incluídos neste pacote:\n` +
      faltaram.map((n) => `- ${n}`).join("\n") +
      `\n\nAbra o CP System e baixe cada um pela aba Anexos, ou anexe o arquivo de novo.\n`;
    arquivos["LEIA-ME.txt"] = [new TextEncoder().encode(aviso), { level: 6 }];
  }

  const zip = zipSync(arquivos);
  const nomeZip = `anexos-${rotulo}.zip`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "-");

  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeZip}"`,
      "Content-Length": String(zip.byteLength),
      // Nunca em CDN: o pacote é de quem provou ser dono.
      "Cache-Control": "private, no-store",
    },
  });
}

function naoEncontrado() {
  // 404 e não 403: dizer "existe, mas não é seu" já entrega que existe.
  return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
}

/** "nota.pdf", "nota (2).pdf", "nota (3).pdf" — o zip não aceita nome repetido. */
function nomeUnico(nome: string, usados: Set<string>): string {
  const limpo = nome.replace(/[\\/:*?"<>|]/g, "_").trim() || "arquivo";
  if (!usados.has(limpo)) {
    usados.add(limpo);
    return limpo;
  }
  const ponto = limpo.lastIndexOf(".");
  const base = ponto > 0 ? limpo.slice(0, ponto) : limpo;
  const ext = ponto > 0 ? limpo.slice(ponto) : "";
  for (let n = 2; ; n++) {
    const tentativa = `${base} (${n})${ext}`;
    if (!usados.has(tentativa)) {
      usados.add(tentativa);
      return tentativa;
    }
  }
}

/**
 * Lê os bytes de um anexo pelo mesmo caminho que /api/arquivo/[id] usa para
 * servi-lo — inclusive a conferência de dono, repetida aqui porque o `Anexo`
 * aponta para o `Arquivo` só pela URL.
 */
async function lerAnexo(url: string, contaId: string, superAdmin: boolean): Promise<Uint8Array | null> {
  try {
    const interno = /^\/api\/arquivo\/([\w-]+)$/.exec(url);
    if (interno) {
      const arq = await prisma.arquivo.findUnique({
        where: { id: interno[1] },
        select: { pathname: true, contaId: true, urlPublica: true },
      });
      if (!arq || (arq.contaId !== contaId && !superAdmin)) return null;
      if (arq.urlPublica) {
        const r = await fetch(arq.urlPublica);
        if (!r.ok) return null;
        return new Uint8Array(await r.arrayBuffer());
      }
      const res = await get(arq.pathname, { access: "private" });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      return new Uint8Array(await new Response(res.stream as unknown as BodyInit).arrayBuffer());
    }
    if (/^https?:\/\//.test(url)) {
      // Anexo antigo, gravado com a URL pública do armazenamento.
      const r = await fetch(url);
      if (!r.ok) return null;
      return new Uint8Array(await r.arrayBuffer());
    }
    // Legado /api/anexos/<nome>: filesystem efêmero, não existe em produção.
    return null;
  } catch (e) {
    console.error("[api/anexos/zip] falha ao ler anexo:", url, e);
    return null;
  }
}
