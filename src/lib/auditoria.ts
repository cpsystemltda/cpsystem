import "server-only";
import { prisma } from "@/lib/prisma";
import { serializarResumo, type Mudanca } from "@/lib/diff";

type Acao = "CRIAR" | "ATUALIZAR" | "EXCLUIR" | "LOGIN" | "LOGOUT" | "EXPORTAR" | "UPLOAD" | "DOWNLOAD";

export async function registrarAuditoria(opts: {
  contaId: string;
  usuarioId?: string | null;
  acao: Acao;
  recurso: string;
  recursoId?: string;
  // Quando passado, o resumo é gravado em formato JSON estruturado pra que o
  // componente HistoricoLista renderize cada mudança "campo X: antes → depois".
  // Se vier vazio (mudancas.length === 0), a entrada é ignorada — não faz
  // sentido registrar "editou" sem nenhuma alteração real.
  mudancas?: Mudanca[];
  titulo?: string;
  // Resumo legado (string livre). Quando só `resumo` é passado, grava como
  // antes — exibido como texto solto na timeline.
  resumo?: string;
  ip?: string;
}) {
  try {
    let resumoFinal: string | null = null;
    if (opts.mudancas && opts.mudancas.length > 0) {
      resumoFinal = serializarResumo({ titulo: opts.titulo, mudancas: opts.mudancas });
    } else if (opts.mudancas && opts.mudancas.length === 0 && opts.acao === "ATUALIZAR") {
      // Sem mudanças efetivas — não vale ocupar uma linha no histórico.
      return;
    } else if (opts.resumo) {
      resumoFinal = opts.resumo;
    }

    await prisma.logAuditoria.create({
      data: {
        contaId: opts.contaId,
        usuarioId: opts.usuarioId || null,
        acao: opts.acao,
        recurso: opts.recurso,
        recursoId: opts.recursoId || null,
        resumo: resumoFinal,
        ip: opts.ip || null,
      },
    });
  } catch {
    // Auditoria nunca pode quebrar a operação principal
  }
}
