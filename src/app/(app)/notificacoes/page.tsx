import Link from "next/link";
import { Bell, BellOff, Check } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marcarLidaAction, marcarTodasLidasAction, gerarAlertasPrazoAction } from "@/app/actions/notificacoesSistema";
import { PageHeader } from "@/components/ui/SecaoGlass";

const ROTULO_TIPO: Record<string, string> = {
  PRAZO_PROXIMO: "Prazo próximo",
  STATUS_PAGO: "Pagamento confirmado",
  NOVA_EXECUCAO: "Nova execução",
  VINCULO_CRIADO: "Novo vínculo",
  VINCULO_ENCERRADO: "Vínculo encerrado",
  COMISSAO_DISPONIVEL: "Comissão disponível",
  AVISO_VENCIMENTO_FATURA: "Vencimento de fatura",
};

const COR_TIPO: Record<string, string> = {
  PRAZO_PROXIMO: "bg-amber-100 text-amber-800",
  STATUS_PAGO: "bg-emerald-100 text-emerald-800",
  NOVA_EXECUCAO: "bg-blue-100 text-blue-800",
  VINCULO_CRIADO: "bg-violet-100 text-violet-800",
  VINCULO_ENCERRADO: "bg-slate-100 text-slate-700",
  COMISSAO_DISPONIVEL: "bg-emerald-100 text-emerald-800",
  AVISO_VENCIMENTO_FATURA: "bg-red-100 text-red-800",
};

export default async function NotificacoesPage() {
  const usuario = await exigirUsuario();

  const notificacoes = await prisma.notificacaoSistema.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 200,
  });

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Atividade"
        titulo="Notificações"
        subtitulo={naoLidas > 0 ? `${naoLidas} não lida${naoLidas !== 1 ? "s" : ""}.` : "Tudo lido."}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3" />
        <div className="flex gap-2">
          {naoLidas > 0 && (
            <form action={marcarTodasLidasAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Check className="h-3 w-3" /> Marcar todas como lidas
              </button>
            </form>
          )}
          {usuario.perfil === "ADMIN" && (
            <form
              action={async () => {
                "use server";
                await gerarAlertasPrazoAction();
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Gerar alertas de prazo
              </button>
            </form>
          )}
        </div>
      </div>

      {notificacoes.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <BellOff className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-4 text-sm text-slate-600">Sem notificações por enquanto.</p>
          <p className="mt-1 text-xs text-slate-500">
            Você será avisado de prazos próximos, mudanças de status e novos vínculos.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {notificacoes.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border p-4 ${
                n.lida ? "border-slate-200 bg-white opacity-80" : "border-blue-200 bg-blue-50/30"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR_TIPO[n.tipo]}`}>
                      {ROTULO_TIPO[n.tipo]}
                    </span>
                    <span className="text-[11px] text-slate-500">{n.criadoEm.toLocaleString("pt-BR")}</span>
                    {!n.lida && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                  </div>
                  <h3 className="mt-1.5 font-semibold text-slate-900">
                    {n.link ? (
                      <Link href={n.link} className="hover:underline">
                        {n.titulo}
                      </Link>
                    ) : (
                      n.titulo
                    )}
                  </h3>
                  {n.descricao && <p className="mt-1 text-sm text-slate-600">{n.descricao}</p>}
                </div>
                {!n.lida && (
                  <form action={marcarLidaAction}>
                    <input type="hidden" name="notificacaoId" value={n.id} />
                    <button
                      type="submit"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Marcar lida
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
