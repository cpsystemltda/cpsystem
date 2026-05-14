import "server-only";
import { put } from "@vercel/blob";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const TIPOS_PERMITIDOS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export type ArquivoSalvo = {
  nome: string;
  url: string; // URL pública do Vercel Blob
  mimeType: string;
  tamanhoBytes: number;
};

/**
 * Persiste o arquivo no Vercel Blob (cpsystem-anexos store, public access).
 * Antes usava filesystem local — não funcionava em prod porque Vercel
 * Functions têm filesystem ephemeral.
 *
 * URL retornada é pública, mas com hash de 16 bytes (32 hex chars) ela é
 * essencialmente unguessable. Atas e Contratos são documentos PNCP-públicos
 * por natureza (Lei 14.133), então OK.
 */
export async function salvarArquivo(file: File): Promise<ArquivoSalvo> {
  if (!file || file.size === 0) throw new Error("Arquivo vazio.");
  if (file.size > MAX_BYTES) throw new Error(`Arquivo excede ${MAX_BYTES / 1024 / 1024}MB.`);

  const ext = TIPOS_PERMITIDOS[file.type] || extname(file.name).toLowerCase();
  if (!ext || !Object.values(TIPOS_PERMITIDOS).includes(ext)) {
    throw new Error("Tipo de arquivo não permitido. Use PDF, PNG ou JPG.");
  }

  const id = randomBytes(16).toString("hex");
  const pathname = `anexos/${id}${ext}`;

  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false, // já temos hash random no path
  });

  return {
    nome: file.name,
    url: blob.url,
    mimeType: file.type,
    tamanhoBytes: file.size,
  };
}

// Legacy: arquivos antigos cadastrados antes da migração pro Vercel Blob
// têm URL no formato `/api/anexos/<id>.<ext>`. A rota /api/anexos ainda
// existe e usa este helper. Em prod o filesystem é ephemeral e retorna
// 404; em dev local continua funcionando enquanto não rodar o backfill.
const UPLOAD_DIR_LEGACY = join(process.cwd(), "uploads");
export function caminhoArquivo(filename: string): string {
  if (!/^[a-zA-Z0-9.\-_]+$/.test(filename)) throw new Error("Nome inválido.");
  return join(UPLOAD_DIR_LEGACY, filename);
}
