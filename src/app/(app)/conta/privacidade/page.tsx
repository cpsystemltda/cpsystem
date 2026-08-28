import { Download, ShieldCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PedirExclusaoForm } from "./PedirExclusaoForm";

/**
 * Direitos do titular sobre os próprios dados (LGPD).
 *
 * Regina 28/08: não existia caminho no sistema para o cliente pedir os dados
 * dele nem o apagamento — seria trabalho manual a cada pedido, e prazo legal
 * correndo.
 */
export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const usuario = await exigirUsuario();
  const ehAdmin = usuario.perfil === "ADMIN";

  const pedidoEmAberto = await prisma.chamadoSuporte.findFirst({
    where: {
      contaId: usuario.contaId,
      titulo: "LGPD — pedido de exclusão de dados",
      status: { notIn: ["RESOLVIDO_ADMIN", "RECUSADO"] },
    },
    select: { criadoEm: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
        Conta · Privacidade
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
        Seus dados
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        A Lei Geral de Proteção de Dados garante que você peça uma cópia dos seus dados e
        o apagamento deles quando quiser. Os dois caminhos ficam aqui, sem precisar abrir
        chamado nem esperar ninguém.
      </p>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">Baixar uma cópia dos dados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Um arquivo com empresas, usuários, atas, contratos, empenhos, notas, cobranças e
              histórico de alterações da conta. Os documentos anexados não entram no arquivo —
              a lista deles vem junto, e cada um continua acessível aqui no sistema.
            </p>
            {ehAdmin ? (
              <a
                href="/api/conta/exportar"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Baixar meus dados
              </a>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Só quem administra a conta pode exportar.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">Apagar meus dados</h2>
            <p className="mt-1 text-sm text-slate-600">
              O pedido é registrado na hora e nossa equipe responde em até 15 dias, como manda a
              lei. A gente fala com você antes de apagar qualquer coisa — apagar leva junto
              contrato, empenho e nota fiscal, e parte disso tem prazo de guarda obrigatório
              que a própria LGPD preserva.
            </p>
            {pedidoEmAberto ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Você já tem um pedido registrado em{" "}
                {pedidoEmAberto.criadoEm.toLocaleDateString("pt-BR")}. Estamos tratando.
              </p>
            ) : ehAdmin ? (
              <PedirExclusaoForm />
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Só quem administra a conta pode pedir o apagamento.
              </p>
            )}
          </div>
        </div>
      </section>

      <p className="mt-6 text-xs text-slate-500">
        Dúvida sobre o que guardamos e por quê? Está no{" "}
        <a href="/termos" className="font-semibold text-violet-700 hover:underline">
          contrato e política de privacidade
        </a>
        .
      </p>
    </div>
  );
}
