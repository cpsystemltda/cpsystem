import "server-only";

/**
 * Regra de edição de documentos (Ata / Contrato / Empenho):
 *   - usuário ADMIN ou superAdmin → sempre pode editar;
 *   - usuário OPERACIONAL → só edita se for o criador do registro.
 *   - VISUALIZADOR → nunca edita.
 *
 * Registros legados (sem criadoPorId) ficam restritos a ADMIN/superAdmin.
 * Tenancy (empresa pertence à conta do usuário) é verificado em outro lugar
 * — aqui assumimos que o documento já passou nesse filtro.
 */
export function podeEditarDocumento(
  usuario: { id: string; perfil: "ADMIN" | "OPERACIONAL" | "VISUALIZADOR"; superAdmin: boolean },
  documento: { criadoPorId: string | null },
): boolean {
  if (usuario.perfil === "VISUALIZADOR") return false;
  if (usuario.superAdmin || usuario.perfil === "ADMIN") return true;
  if (!documento.criadoPorId) return false; // registro legado: só ADMIN
  return documento.criadoPorId === usuario.id;
}

export function mensagemSemPermissao(
  documento: { criadoPorId: string | null },
): string {
  if (!documento.criadoPorId) {
    return "Este registro foi criado antes da feature de rastreio de criador. Só um ADMIN da empresa pode editá-lo.";
  }
  return "Só o criador do registro ou um ADMIN da empresa pode editar.";
}
