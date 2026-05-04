import "server-only";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";

const UPLOAD_DIR = join(process.cwd(), "uploads");
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const TIPOS_PERMITIDOS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export type ArquivoSalvo = {
  nome: string;
  url: string; // /api/anexos/<id>
  mimeType: string;
  tamanhoBytes: number;
};

export async function salvarArquivo(file: File): Promise<ArquivoSalvo> {
  if (!file || file.size === 0) throw new Error("Arquivo vazio.");
  if (file.size > MAX_BYTES) throw new Error(`Arquivo excede ${MAX_BYTES / 1024 / 1024}MB.`);

  const ext = TIPOS_PERMITIDOS[file.type] || extname(file.name).toLowerCase();
  if (!ext || !Object.values(TIPOS_PERMITIDOS).includes(ext)) {
    throw new Error("Tipo de arquivo não permitido. Use PDF, PNG ou JPG.");
  }

  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  const id = randomBytes(16).toString("hex");
  const filename = `${id}${ext}`;
  const fullPath = join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  return {
    nome: file.name,
    url: `/api/anexos/${filename}`,
    mimeType: file.type,
    tamanhoBytes: file.size,
  };
}

export function caminhoArquivo(filename: string): string {
  // sanitize: só alfanum + ponto + hífen
  if (!/^[a-zA-Z0-9.\-_]+$/.test(filename)) throw new Error("Nome inválido.");
  return join(UPLOAD_DIR, filename);
}
