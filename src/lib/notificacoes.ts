import "server-only";
import { prisma } from "@/lib/prisma";

type Tipo =
  | "PRAZO_PROXIMO"
  | "STATUS_PAGO"
  | "NOVA_EXECUCAO"
  | "VINCULO_CRIADO"
  | "VINCULO_ENCERRADO"
  | "COMISSAO_DISPONIVEL"
  | "AVISO_VENCIMENTO_FATURA";

export async function notificar(opts: {
  usuarioId: string;
  tipo: Tipo;
  titulo: string;
  descricao?: string;
  link?: string;
  recursoTipo?: string;
  recursoId?: string;
}) {
  try {
    await prisma.notificacaoSistema.create({
      data: {
        usuarioId: opts.usuarioId,
        tipo: opts.tipo,
        titulo: opts.titulo,
        descricao: opts.descricao || null,
        link: opts.link || null,
        recursoTipo: opts.recursoTipo || null,
        recursoId: opts.recursoId || null,
      },
    });
  } catch {
    // Notificação não pode quebrar a operação principal
  }
}

// Helper: quando uma execução muda status, notifica o(s) usuário(s) do(s) analista(s) vinculado(s)
export async function notificarAnalistasDaEmpresa(opts: {
  empresaId: string;
  tipo: Tipo;
  titulo: string;
  descricao?: string;
  link?: string;
  recursoTipo?: string;
  recursoId?: string;
}) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: opts.empresaId },
    select: { contaId: true },
  });
  if (!empresa) return;

  const vinculos = await prisma.vinculoAnalista.findMany({
    where: { contaId: empresa.contaId, status: "ATIVO" },
    include: { analista: { include: { conta: { include: { usuarios: { select: { id: true } } } } } } },
  });

  for (const v of vinculos) {
    const conta = v.analista.conta;
    if (!conta) continue;
    for (const u of conta.usuarios) {
      await notificar({ ...opts, usuarioId: u.id });
    }
  }
}

export async function contarNaoLidas(usuarioId: string): Promise<number> {
  return prisma.notificacaoSistema.count({ where: { usuarioId, lida: false } });
}
