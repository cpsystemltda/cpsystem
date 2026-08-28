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
  /** Endereço interno servido por /api/arquivo/<id> — exige sessão. */
  url: string;
  mimeType: string;
  tamanhoBytes: number;
};

/**
 * Guarda o arquivo do cliente — PRIVADO, servido só por rota autenticada.
 *
 * Regina 28/08, na revisão de segurança: até aqui todo anexo subia como
 * público. Não havia listagem e o caminho tem 32 caracteres aleatórios, então
 * ninguém adivinhava — mas quem recebesse o link abria o documento sem login
 * nenhum. O comentário antigo dizia que "ata e contrato são públicos por
 * natureza (Lei 14.133)", e isso é verdade para o INSTRUMENTO, não para o que
 * o cliente anexa: nota fiscal, parecer jurídico, comprovante de pagamento e
 * documento interno da empresa dele não são públicos por natureza nenhuma.
 *
 * Agora: o arquivo sobe privado, entra no registro `Arquivo` amarrado à conta
 * de quem enviou, e o que vai pro banco é `/api/arquivo/<id>` — a rota confere
 * sessão e dono antes de entregar um byte.
 *
 * A conta vem da sessão de propósito, não por parâmetro: assim nenhum dos
 * chamadores precisou mudar, e não existe caminho onde alguém "esqueça" de
 * informar o dono do arquivo.
 */
export async function salvarArquivo(file: File): Promise<ArquivoSalvo> {
  if (!file || file.size === 0) throw new Error("Arquivo vazio.");
  if (file.size > MAX_BYTES) throw new Error(`Arquivo excede ${MAX_BYTES / 1024 / 1024}MB.`);

  const ext = TIPOS_PERMITIDOS[file.type] || extname(file.name).toLowerCase();
  if (!ext || !Object.values(TIPOS_PERMITIDOS).includes(ext)) {
    throw new Error("Tipo de arquivo não permitido. Use PDF, PNG ou JPG.");
  }

  const { getUsuarioAtual } = await import("@/lib/auth");
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Faça login novamente para enviar arquivos.");

  const id = randomBytes(16).toString("hex");
  const pathname = `anexos/${id}${ext}`;

  await put(pathname, file, {
    access: "private",
    contentType: file.type,
    addRandomSuffix: false, // já temos hash random no path
  });

  const { prisma } = await import("@/lib/prisma");
  const registro = await prisma.arquivo.create({
    data: {
      pathname,
      contaId: usuario.contaId,
      nomeOriginal: file.name.slice(0, 255),
      contentType: file.type,
      tamanhoBytes: file.size,
      criadoPorId: usuario.id,
    },
    select: { id: true },
  });

  return {
    nome: file.name,
    url: `/api/arquivo/${registro.id}`,
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
