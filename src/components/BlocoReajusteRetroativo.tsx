"use client";

import { useState, useTransition } from "react";
import { Sparkles, AlertCircle, Loader2, Check, Undo2 } from "lucide-react";
import { brl } from "@/lib/validators";
import {
  calcularPreviaReajusteRetroativoAction,
  aplicarReajusteRetroativoAction,
  desfazerReajusteRetroativoAction,
} from "@/app/actions/reajusteRetroativo";
import { AvancarStatusReajuste } from "@/components/AvancarStatusReajuste";

// Aparece na timeline de execução APÓS o passo "Pago", quando o empenho
// está pago. Dois estados:
//   1. Sem reajuste aplicado ainda: mostra botão seletor "Sim/Não"
//      - "Sim" → calcula prévia + botão "Aplicar reajuste retroativo"
//   2. Com reajuste aplicado: mostra valores + 3 sub-passos da NF
//      complementar (NF Emitida, NF Encaminhada, Pago) + botão Desfazer
//      (quando ainda não emitiu NF)

export type ReajusteRetroativoData = {
  id: string;
  valorOriginal: number;
  valorReajustado: number;
  diferenca: number;
  observacao: string | null;
  dataAplicacao: Date;
  dataNfEmitida: Date | null;
  arquivoNfEmitida: string | null;
  dataNfEncaminhada: Date | null;
  arquivoNfEncaminhada: string | null;
  dataPagamento: Date | null;
  arquivoPagamento: string | null;
};

export function BlocoReajusteRetroativo({
  empenhoId,
  reajuste,
  podeAplicar,
}: {
  empenhoId: string;
  reajuste: ReajusteRetroativoData | null;
  // false quando empenho ainda não está PAGO ou usuário não pode editar
  podeAplicar: boolean;
}) {
  // Já aplicado: mostra os passos da NF complementar
  if (reajuste) {
    return <BlocoAplicado empenhoId={empenhoId} reajuste={reajuste} />;
  }
  // Não aplicado ainda: pergunta sim/não
  return <BlocoPergunta empenhoId={empenhoId} podeAplicar={podeAplicar} />;
}

function BlocoPergunta({
  empenhoId,
  podeAplicar,
}: {
  empenhoId: string;
  podeAplicar: boolean;
}) {
  const [resposta, setResposta] = useState<"NAO" | "SIM" | null>(null);
  const [previa, setPrevia] = useState<{
    valorOriginal: number;
    valorReajustado: number;
    diferenca: number;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [carregandoPrevia, startPrevia] = useTransition();
  const [aplicando, startAplicar] = useTransition();

  function escolherSim() {
    if (!podeAplicar) {
      setErro("A execução precisa estar paga antes de aplicar reajuste retroativo.");
      return;
    }
    setResposta("SIM");
    setErro(null);
    startPrevia(async () => {
      const r = await calcularPreviaReajusteRetroativoAction(empenhoId);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setPrevia({
        valorOriginal: r.valorOriginal,
        valorReajustado: r.valorReajustado,
        diferenca: r.diferenca,
      });
    });
  }

  function aplicar() {
    setErro(null);
    startAplicar(async () => {
      const r = await aplicarReajusteRetroativoAction(empenhoId, observacao || undefined);
      if (!r.ok) setErro(r.erro);
      // OK → revalidatePath na server action; UI re-renderiza com o reajuste aplicado
    });
  }

  return (
    <li className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Houve reajuste retroativo nesta execução?
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Se o órgão deferiu reajuste de preços APÓS o pagamento desta execução,
            marque "Sim" — o sistema calcula a diferença e gera a NF complementar.
          </p>

          {resposta === null && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={escolherSim}
                disabled={!podeAplicar}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sim, houve reajuste
              </button>
              <button
                type="button"
                onClick={() => setResposta("NAO")}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Não
              </button>
            </div>
          )}

          {resposta === "NAO" && (
            <p className="mt-3 text-xs italic text-slate-500">
              Sem reajuste retroativo nesta execução. Você pode mudar de ideia
              clicando em{" "}
              <button
                type="button"
                onClick={() => setResposta(null)}
                className="font-semibold text-violet-700 underline"
              >
                voltar
              </button>
              .
            </p>
          )}

          {resposta === "SIM" && (
            <div className="mt-3 space-y-3">
              {carregandoPrevia && (
                <p className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Calculando diferença…
                </p>
              )}

              {previa && (
                <div className="rounded-lg bg-white px-4 py-3 ring-1 ring-violet-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    Prévia do reajuste
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500">Valor original</p>
                      <p className="font-bold text-slate-900">{brl(previa.valorOriginal)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Valor reajustado</p>
                      <p className="font-bold text-slate-900">{brl(previa.valorReajustado)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Diferença (NF complementar)</p>
                      <p
                        className="font-extrabold"
                        style={{ color: previa.diferenca >= 0 ? "#047857" : "#b91c1c" }}
                      >
                        {brl(previa.diferenca)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Observação (opcional)
                    </label>
                    <input
                      type="text"
                      value={observacao}
                      onChange={(ev) => setObservacao(ev.target.value)}
                      placeholder="Ex: Apostilamento 03/2026 — IPCA-E 12m"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={aplicar}
                      disabled={aplicando || Math.abs(previa.diferenca) < 0.01}
                      className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
                    >
                      {aplicando ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" /> Aplicando…
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3" /> Aplicar reajuste retroativo
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResposta(null);
                        setPrevia(null);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Ao aplicar: valor unitário dos itens desta execução é atualizado +
                    comissão do analista é recalculada + 3 passos novos aparecem na timeline
                    pra acompanhar a NF complementar.
                  </p>
                </div>
              )}
            </div>
          )}

          {erro && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {erro}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function BlocoAplicado({
  empenhoId,
  reajuste,
}: {
  empenhoId: string;
  reajuste: ReajusteRetroativoData;
}) {
  const [desfazendo, startDesfazer] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function desfazer() {
    if (!confirm("Desfazer o reajuste retroativo? Isso apaga o registro mas mantém os valores dos itens atualizados — você precisará ajustar manualmente se quiser voltar.")) return;
    setErro(null);
    startDesfazer(async () => {
      const r = await desfazerReajusteRetroativoAction(empenhoId);
      if (!r.ok) setErro(r.erro);
    });
  }

  const podeDesfazer = !reajuste.dataNfEmitida;

  return (
    <>
      {/* Header: reajuste aplicado */}
      <li className="rounded-xl border border-violet-300 bg-violet-50/60 p-4">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Reajuste retroativo aplicado
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                {reajuste.dataAplicacao.toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Valor original</p>
                <p className="font-semibold text-slate-700">{brl(reajuste.valorOriginal)}</p>
              </div>
              <div>
                <p className="text-slate-500">Valor reajustado</p>
                <p className="font-semibold text-slate-900">{brl(reajuste.valorReajustado)}</p>
              </div>
              <div>
                <p className="text-slate-500">Diferença · NF complementar</p>
                <p
                  className="font-extrabold"
                  style={{ color: reajuste.diferenca >= 0 ? "#047857" : "#b91c1c" }}
                >
                  {brl(reajuste.diferenca)}
                </p>
              </div>
            </div>
            {reajuste.observacao && (
              <p className="mt-2 text-[11px] italic text-slate-600">{reajuste.observacao}</p>
            )}
            {podeDesfazer && (
              <button
                type="button"
                onClick={desfazer}
                disabled={desfazendo}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-red-700"
              >
                <Undo2 className="h-3 w-3" />
                {desfazendo ? "Desfazendo…" : "Desfazer reajuste"}
              </button>
            )}
            {erro && (
              <p className="mt-2 text-[11px] font-semibold text-red-700">{erro}</p>
            )}
          </div>
        </div>
      </li>

      {/* 3 passos da NF complementar */}
      <li className="rounded-xl border border-slate-200 bg-white p-4">
        <PassoNfComplementar
          empenhoId={empenhoId}
          marco="REAJUSTE_NF_EMITIDA"
          label="NF complementar emitida"
          ordem={8}
          ja={reajuste.dataNfEmitida}
          jaArquivo={reajuste.arquivoNfEmitida}
          bloqueado={false}
        />
      </li>
      <li className="rounded-xl border border-slate-200 bg-white p-4">
        <PassoNfComplementar
          empenhoId={empenhoId}
          marco="REAJUSTE_NF_ENCAMINHADA"
          label="NF complementar encaminhada"
          ordem={9}
          ja={reajuste.dataNfEncaminhada}
          jaArquivo={reajuste.arquivoNfEncaminhada}
          bloqueado={!reajuste.dataNfEmitida}
        />
      </li>
      <li className="rounded-xl border border-slate-200 bg-white p-4">
        <PassoNfComplementar
          empenhoId={empenhoId}
          marco="REAJUSTE_PAGO"
          label="NF complementar paga"
          ordem={10}
          ja={reajuste.dataPagamento}
          jaArquivo={reajuste.arquivoPagamento}
          bloqueado={!reajuste.dataNfEncaminhada}
        />
      </li>
    </>
  );
}

function PassoNfComplementar({
  empenhoId,
  marco,
  label,
  ordem,
  ja,
  jaArquivo,
  bloqueado,
}: {
  empenhoId: string;
  marco: string;
  label: string;
  ordem: number;
  ja: Date | null;
  jaArquivo: string | null;
  bloqueado: boolean;
}) {
  const concluido = !!ja;
  return (
    <div className="flex items-start gap-4">
      <div
        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
          concluido
            ? "bg-emerald-600 text-white"
            : bloqueado
              ? "border border-slate-300 bg-white text-slate-400"
              : "bg-blue-600 text-white"
        }`}
      >
        {concluido ? "✓" : ordem}
      </div>
      <div className="flex-1">
        <span
          className={`text-sm font-semibold ${concluido ? "text-slate-800" : bloqueado ? "text-slate-400" : "text-slate-900"}`}
        >
          {label}
        </span>
        <div className="mt-2">
          <AvancarStatusReajuste
            empenhoId={empenhoId}
            marco={marco}
            ja={ja}
            jaArquivo={jaArquivo}
            bloqueado={bloqueado && !concluido}
          />
        </div>
      </div>
    </div>
  );
}
