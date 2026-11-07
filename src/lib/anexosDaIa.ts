import "server-only";
import { prisma } from "@/lib/prisma";

export type ArquivoDoFormulario = { url: string; nome: string };

/**
 * Os arquivos que a IA leu e já persistiu, trazidos pelo formulário em hidden
 * inputs `arquivosPdf[i][url]` / `arquivosPdf[i][nome]`.
 *
 * Regina, 07/11/2026: *"o sistema deve possibilitar o carregamento de mais de
 * um arquivo para leitura e ambos devem automaticamente ir para a aba
 * Anexos"* — a ata, o edital, o termo de referência, o estudo técnico
 * preliminar, a proposta. A leitura fica mais precisa e a empresa ganha o
 * repositório completo da contratação sem anexar nada à mão.
 *
 * `arquivoPdfUrl`/`arquivoPdfNome` (um arquivo só) continuam aceitos: é o
 * que o prefill do painel (UploadInteligenteCard) ainda manda.
 */
export function lerArquivosDaIa(formData: FormData): ArquivoDoFormulario[] {
  const lista: ArquivoDoFormulario[] = [];
  for (let i = 0; formData.has(`arquivosPdf[${i}][url]`); i++) {
    const url = String(formData.get(`arquivosPdf[${i}][url]`) || "").trim();
    const nome = String(formData.get(`arquivosPdf[${i}][nome]`) || "").trim();
    if (url) lista.push({ url, nome });
  }
  if (lista.length === 0) {
    const url = String(formData.get("arquivoPdfUrl") || "").trim();
    const nome = String(formData.get("arquivoPdfNome") || "").trim();
    if (url) lista.push({ url, nome });
  }
  // O mesmo arquivo não vira dois anexos.
  const vistos = new Set<string>();
  return lista.filter((a) => {
    if (vistos.has(a.url)) return false;
    vistos.add(a.url);
    return true;
  });
}

/**
 * Cria um Anexo por arquivo no registro recém-criado. Falha em um arquivo não
 * derruba o save nem os outros anexos — a pessoa pode re-anexar pela aba.
 */
export async function anexarArquivosDaIa(
  destino: { ataId?: string; contratoId?: string; empenhoId?: string },
  arquivos: ArquivoDoFormulario[],
  nomePadrao: string,
  rotuloLog: string,
): Promise<number> {
  let criados = 0;
  for (const [i, a] of arquivos.entries()) {
    try {
      await prisma.anexo.create({
        data: {
          ...destino,
          categoria: "CONTRATUAL",
          nome: a.nome || (i === 0 ? nomePadrao : `documento-${i + 1}.pdf`),
          url: a.url,
          mimeType: "application/pdf",
        },
      });
      criados++;
    } catch (err) {
      console.warn(`[${rotuloLog}] falha ao criar Anexo de "${a.nome || a.url}":`, err);
    }
  }
  return criados;
}
