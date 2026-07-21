import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contaTemAcessoConciliacao } from "@/lib/conciliacao/planoGuard";
import { UploadDropzone } from "./_components/upload-dropzone";
import { ListaExtratos } from "./_components/lista-extratos";
import { ConfigJanela } from "./_components/config-janela";

export const dynamic = "force-dynamic";

export default async function ConciliacaoPage() {
  const usuario = await exigirUsuario();

  if (!contaTemAcessoConciliacao(usuario.conta.plano)) {
    // Não redireciona à força — mostra tela de upgrade
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold text-slate-900">Conciliação bancária</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm text-amber-900">
            A conciliação bancária automática é uma feature dos planos{" "}
            <strong>Intermediário</strong> e <strong>Premium</strong>. Você está no plano{" "}
            <strong>{usuario.conta.plano}</strong>.
          </p>
          <a
            href="/conta/assinatura"
            className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Ver planos
          </a>
        </div>
      </div>
    );
  }

  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    select: { conciliacaoDiaMes: true, conciliacaoOptIn: true },
  });

  const extratos = await prisma.extrato.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "desc" },
    take: 20,
    select: {
      id: true, nomeArquivo: true, status: true, fonte: true,
      bancoDetectado: true, periodoInicio: true, periodoFim: true,
      totalCreditos: true, totalDebitos: true, totalTransacoes: true,
      qtdMatchAlto: true, qtdMatchMedio: true, qtdSemMatch: true,
      criadoEm: true, erroMsg: true,
    },
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Conciliação bancária</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sobe o PDF do extrato e a gente concilia automaticamente com seus empenhos.
        </p>
      </header>

      <ConfigJanela
        diaMes={conta?.conciliacaoDiaMes ?? null}
        optIn={conta?.conciliacaoOptIn ?? true}
      />

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Importar extrato</h2>
        <p className="mt-1 text-sm text-slate-600">
          Aceita PDF de qualquer banco brasileiro. Extraímos e casamos com empenhos abertos automaticamente.
        </p>
        <div className="mt-4">
          <UploadDropzone />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Extratos importados</h2>
        <div className="mt-4">
          <ListaExtratos extratos={extratos} />
        </div>
      </section>
    </div>
  );
}
