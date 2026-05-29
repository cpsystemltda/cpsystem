"use server";

import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { salvarArquivo } from "@/lib/uploads";

// Server action genérica pra subir 1 arquivo no Vercel Blob e retornar a URL.
// Usada pelo AnexosAdicionaisEditor (M3.3 — ajuste 6). Não cria registro
// Anexo no banco — quem chama é responsável por persistir a URL retornada
// vinculada ao recurso após o save principal.
export async function salvarAnexoAdicionalAction(
  formData: FormData,
): Promise<{ ok: true; url: string; nome: string } | { ok: false; erro: string }> {
  await exigirUsuario();
  await bloquearEspionagem();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Arquivo vazio." };
  try {
    const salvo = await salvarArquivo(file);
    return { ok: true, url: salvo.url, nome: salvo.nome };
  } catch (err) {
    // Loga o erro completo nos Vercel logs pra diagnostico (a mensagem
    // resumida vai pro UI). Antes a stack trace sumia.
    console.error("[salvarAnexoAdicionalAction] falha ao salvar arquivo:", {
      nome: file.name,
      tipo: file.type,
      tamanhoBytes: file.size,
      erro: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro ao salvar arquivo.",
    };
  }
}
