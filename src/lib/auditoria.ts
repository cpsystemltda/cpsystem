import "server-only";
import { prisma } from "@/lib/prisma";

type Acao = "CRIAR" | "ATUALIZAR" | "EXCLUIR" | "LOGIN" | "LOGOUT" | "EXPORTAR" | "UPLOAD" | "DOWNLOAD";

export async function registrarAuditoria(opts: {
  contaId: string;
  usuarioId?: string | null;
  acao: Acao;
  recurso: string;
  recursoId?: string;
  resumo?: string;
  ip?: string;
}) {
  try {
    await prisma.logAuditoria.create({
      data: {
        contaId: opts.contaId,
        usuarioId: opts.usuarioId || null,
        acao: opts.acao,
        recurso: opts.recurso,
        recursoId: opts.recursoId || null,
        resumo: opts.resumo || null,
        ip: opts.ip || null,
      },
    });
  } catch {
    // Auditoria nunca pode quebrar a operação principal
  }
}
