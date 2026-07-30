import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  contaTemAcessoConciliacao,
  cortesiaConciliacaoAtiva,
} from "@/lib/conciliacao/planoGuard";
import { UploadDropzone } from "./_components/upload-dropzone";
import { ListaExtratos } from "./_components/lista-extratos";
import { ConfigJanela } from "./_components/config-janela";
import { SugestoesPendentes } from "./_components/sugestoes-pendentes";

export const dynamic = "force-dynamic";

export default async function ConciliacaoPage() {
  const usuario = await exigirUsuario();

  if (!contaTemAcessoConciliacao(usuario.conta)) {
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
    select: {
      conciliacaoDiaMes: true,
      conciliacaoOptIn: true,
      conciliacaoCortesiaAte: true,
      plano: true,
    },
  });
  const cortesiaAtiva =
    !!conta && conta.plano === "BASICO" && cortesiaConciliacaoAtiva(conta);
  const diasRestantesCortesia = cortesiaAtiva
    ? Math.ceil((conta!.conciliacaoCortesiaAte!.getTime() - Date.now()) / 86400000)
    : 0;

  // Sugestoes pendentes: score 50-85 que a maquina nao teve certeza suficiente
  // pra auto-conciliar. Regina 30/07: antes ficavam presas no banco sem UI.
  const sugestoesRaw = await prisma.conciliacao.findMany({
    where: {
      status: "SUGERIDA",
      transacao: { extrato: { contaId: usuario.contaId } },
    },
    orderBy: [{ score: "desc" }, { criadoEm: "desc" }],
    take: 50,
    select: {
      id: true,
      score: true,
      empenhoId: true,
      transacao: {
        select: { data: true, valor: true, descricao: true, nomeContraparte: true },
      },
    },
  });
  const empenhoIds = Array.from(new Set(sugestoesRaw.map((s) => s.empenhoId)));
  const empenhos = empenhoIds.length
    ? await prisma.empenho.findMany({
        where: { id: { in: empenhoIds } },
        select: {
          id: true,
          numero: true,
          orgaoNome: true,
          itens: { select: { valorTotal: true } },
        },
      })
    : [];
  const empenhoMap = new Map(
    empenhos.map((e) => [
      e.id,
      {
        id: e.id,
        numero: e.numero,
        orgaoNome: e.orgaoNome,
        valorEmpenho: e.itens.reduce((s, i) => s + i.valorTotal, 0),
      },
    ]),
  );
  const sugestoes = sugestoesRaw
    .map((s) => {
      const emp = empenhoMap.get(s.empenhoId);
      if (!emp) return null;
      return { id: s.id, score: s.score, transacao: s.transacao, empenho: emp };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // DEBITOS: sugestoes de contrapartida (Cobranca, Fixo, Comissao)
  const sugestoesDebitoRaw = await prisma.conciliacaoDebito.findMany({
    where: {
      status: "SUGERIDA",
      transacao: { extrato: { contaId: usuario.contaId } },
    },
    orderBy: [{ score: "desc" }, { criadoEm: "desc" }],
    take: 50,
    select: {
      id: true,
      score: true,
      tipoContrapartida: true,
      contrapartidaId: true,
      transacao: {
        select: { data: true, valor: true, descricao: true, nomeContraparte: true },
      },
    },
  });

  const cobIds = sugestoesDebitoRaw.filter((s) => s.tipoContrapartida === "COBRANCA_CP").map((s) => s.contrapartidaId);
  const fixIds = sugestoesDebitoRaw.filter((s) => s.tipoContrapartida === "FIXO_ANALISTA").map((s) => s.contrapartidaId);
  const comIds = sugestoesDebitoRaw.filter((s) => s.tipoContrapartida === "COMISSAO_ANALISTA").map((s) => s.contrapartidaId);
  const [cobList, fixList, comList] = await Promise.all([
    cobIds.length ? prisma.cobranca.findMany({ where: { id: { in: cobIds } }, select: { id: true, valor: true, competencia: true, plano: true } }) : Promise.resolve([]),
    fixIds.length
      ? prisma.pagamentoFixoMensal.findMany({
          where: { id: { in: fixIds } },
          select: {
            id: true,
            valor: true,
            competencia: true,
            vinculo: { select: { analista: { select: { nomeCompleto: true } } } },
          },
        })
      : Promise.resolve([]),
    comIds.length
      ? prisma.comissaoExecucao.findMany({
          where: { id: { in: comIds } },
          select: {
            id: true,
            valorCalculado: true,
            valorRecebido: true,
            analista: { select: { nomeCompleto: true } },
            empenho: { select: { numero: true, instrumento: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const cobMap = new Map(cobList.map((c) => [c.id, c]));
  const fixMap = new Map(fixList.map((f) => [f.id, f]));
  const comMap = new Map(comList.map((c) => [c.id, c]));

  const sugestoesDebito = sugestoesDebitoRaw
    .map((s) => {
      if (s.tipoContrapartida === "COBRANCA_CP") {
        const c = cobMap.get(s.contrapartidaId);
        if (!c) return null;
        return {
          id: s.id,
          score: s.score,
          transacao: s.transacao,
          contrapartida: {
            tipo: "COBRANCA_CP" as const,
            titulo: `Mensalidade ${c.plano} — ${c.competencia}`,
            detalhe: "Assinatura CP System",
            valorEsperado: c.valor,
          },
        };
      }
      if (s.tipoContrapartida === "FIXO_ANALISTA") {
        const f = fixMap.get(s.contrapartidaId);
        if (!f) return null;
        return {
          id: s.id,
          score: s.score,
          transacao: s.transacao,
          contrapartida: {
            tipo: "FIXO_ANALISTA" as const,
            titulo: `Fixo mensal ${f.competencia}`,
            detalhe: `Analista: ${f.vinculo.analista.nomeCompleto}`,
            valorEsperado: f.valor,
          },
        };
      }
      const c = comMap.get(s.contrapartidaId);
      if (!c) return null;
      return {
        id: s.id,
        score: s.score,
        transacao: s.transacao,
        contrapartida: {
          tipo: "COMISSAO_ANALISTA" as const,
          titulo: `Comissão — ${c.empenho.instrumento} ${c.empenho.numero}`,
          detalhe: `Analista: ${c.analista.nomeCompleto}`,
          valorEsperado: c.valorCalculado - c.valorRecebido,
        },
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

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

      {cortesiaAtiva && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 h-6 w-6 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-slate-900">
                Você tem conciliação bancária cortesia — expira em {diasRestantesCortesia} {diasRestantesCortesia === 1 ? "dia" : "dias"}
              </p>
              <p className="mt-1 text-xs text-slate-700">
                Aproveite pra subir seus extratos e ver o CP System conciliando pagamentos automaticamente
                com seus empenhos, mensalidades e comissões. Após{" "}
                {conta?.conciliacaoCortesiaAte?.toLocaleDateString("pt-BR")} a feature só continua
                disponível nos planos Intermediário e Premium.
              </p>
              <a
                href="/conta/assinatura"
                className="mt-3 inline-block text-xs font-medium text-amber-700 hover:underline"
              >
                Ver planos →
              </a>
            </div>
          </div>
        </div>
      )}

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

      <SugestoesPendentes sugestoes={sugestoes} sugestoesDebito={sugestoesDebito} />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Extratos importados</h2>
        <div className="mt-4">
          <ListaExtratos extratos={extratos} />
        </div>
      </section>
    </div>
  );
}
