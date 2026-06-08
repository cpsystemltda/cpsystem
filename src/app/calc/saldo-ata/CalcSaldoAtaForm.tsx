"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowRight, CheckCircle2 } from "lucide-react";
import { brl } from "@/lib/validators";

type Item = {
  id: string;
  descricao: string;
  qtdRegistrada: number;
  qtdExecutada: number;
  valorUnit: number;
};

function novoItem(): Item {
  return {
    id: Math.random().toString(36).slice(2, 9),
    descricao: "",
    qtdRegistrada: 0,
    qtdExecutada: 0,
    valorUnit: 0,
  };
}

export function CalcSaldoAtaForm() {
  const [itens, setItens] = useState<Item[]>([novoItem()]);
  const [resultadoVisivel, setResultadoVisivel] = useState(false);
  const [emailCapturado, setEmailCapturado] = useState(false);

  function atualizarItem(id: string, patch: Partial<Item>) {
    setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function adicionar() {
    setItens((prev) => [...prev, novoItem()]);
  }
  function remover(id: string) {
    setItens((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  // Cálculos por item
  const itensComCalc = itens.map((it) => {
    const qtdDisponivel = Math.max(0, it.qtdRegistrada - it.qtdExecutada);
    const valorRegistrado = it.qtdRegistrada * it.valorUnit;
    const valorExecutado = it.qtdExecutada * it.valorUnit;
    const valorDisponivel = qtdDisponivel * it.valorUnit;
    const pctExecutado = it.qtdRegistrada > 0 ? (it.qtdExecutada / it.qtdRegistrada) * 100 : 0;
    return { ...it, qtdDisponivel, valorRegistrado, valorExecutado, valorDisponivel, pctExecutado };
  });

  const totalRegistrado = itensComCalc.reduce((s, it) => s + it.valorRegistrado, 0);
  const totalExecutado = itensComCalc.reduce((s, it) => s + it.valorExecutado, 0);
  const totalDisponivel = itensComCalc.reduce((s, it) => s + it.valorDisponivel, 0);
  const pctTotalExecutado = totalRegistrado > 0 ? (totalExecutado / totalRegistrado) * 100 : 0;

  const podeCalcular = itens.some((it) => it.qtdRegistrada > 0 && it.valorUnit > 0);

  return (
    <div className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-100">
      <h2
        className="text-[20px] font-extrabold text-[#2D3340]"
        style={{ letterSpacing: "-0.02em" }}
      >
        Itens da sua Ata
      </h2>
      <p className="mt-2 text-[13px] text-[#5D6470]">
        Adicione os itens registrados na sua Ata. Para cada item, informe
        quantidade registrada, quantidade já executada e valor unitário.
      </p>

      {/* Tabela de itens */}
      <div className="mt-6 space-y-3">
        {itens.map((it, idx) => (
          <div
            key={it.id}
            className="grid grid-cols-12 gap-3 rounded-xl border border-slate-200 p-4"
          >
            <div className="col-span-12 md:col-span-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#5D6470]">
                Item {idx + 1} — Descrição
              </label>
              <input
                type="text"
                value={it.descricao}
                onChange={(ev) => atualizarItem(it.id, { descricao: ev.target.value })}
                placeholder="Ex: Cadeira giratória executiva"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#5D6470]">
                Qtd. registrada
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={it.qtdRegistrada || ""}
                onChange={(ev) =>
                  atualizarItem(it.id, { qtdRegistrada: Number(ev.target.value) || 0 })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#5D6470]">
                Qtd. executada
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={it.qtdExecutada || ""}
                onChange={(ev) =>
                  atualizarItem(it.id, { qtdExecutada: Number(ev.target.value) || 0 })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </div>
            <div className="col-span-10 md:col-span-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#5D6470]">
                Valor unitário (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={it.valorUnit || ""}
                onChange={(ev) =>
                  atualizarItem(it.id, { valorUnit: Number(ev.target.value) || 0 })
                }
                placeholder="0,00"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </div>
            <div className="col-span-2 md:col-span-1 flex items-end justify-end">
              <button
                type="button"
                onClick={() => remover(it.id)}
                disabled={itens.length === 1}
                className="grid h-9 w-9 place-items-center rounded-lg text-[#5D6470] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                title="Remover item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={adicionar}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-[#B8860B] px-4 py-2 text-sm font-bold text-[#9C7A2D] transition hover:bg-[#FFF8E1]"
      >
        <Plus className="h-4 w-4" /> Adicionar mais um item
      </button>

      {/* Botão calcular */}
      {!resultadoVisivel && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => setResultadoVisivel(true)}
            disabled={!podeCalcular}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Calcular saldo <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Resultado */}
      {resultadoVisivel && (
        <div className="mt-10 rounded-2xl bg-gradient-to-br from-[#FAF6EC] to-[#FFF8E1] p-7">
          <h3
            className="text-[18px] font-extrabold text-[#2D3340]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Resultado do cálculo
          </h3>

          {/* Resumo geral */}
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <ResultadoCard
              titulo="Valor total registrado"
              valor={brl(totalRegistrado)}
              cor="#5D6470"
            />
            <ResultadoCard
              titulo="Já executado"
              valor={brl(totalExecutado)}
              sub={`${pctTotalExecutado.toFixed(1)}% do total`}
              cor="#9C7A2D"
            />
            <ResultadoCard
              titulo="Saldo disponível"
              valor={brl(totalDisponivel)}
              sub="ainda pode executar"
              cor="#047857"
              destaque
            />
          </div>

          {/* Tabela detalhe por item */}
          <div className="mt-7 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-[#5D6470]">
                <tr>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-3 py-3 text-right">Qtd. reg.</th>
                  <th className="px-3 py-3 text-right">Qtd. exec.</th>
                  <th className="px-3 py-3 text-right">Qtd. disp.</th>
                  <th className="px-3 py-3 text-right">Valor disp.</th>
                </tr>
              </thead>
              <tbody>
                {itensComCalc.map((it, idx) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-sm">
                      {it.descricao || `Item ${idx + 1}`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {it.qtdRegistrada.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {it.qtdExecutada.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#047857]">
                      {it.qtdDisponivel.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#047857]">
                      {brl(it.valorDisponivel)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Aviso Lei 14.133 */}
          <div className="mt-5 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="text-[13px] text-amber-900">
              <strong>⚠️ Lembrete Lei 14.133/2021:</strong> esse cálculo é da
              <strong> vigência atual</strong>. Não-executado <strong>não acumula</strong>{" "}
              com a próxima vigência (art. 84). Se sua Ata foi prorrogada, calcule
              cada vigência separadamente.
            </p>
          </div>

          {/* Captura de email */}
          {!emailCapturado ? (
            <div className="mt-7 rounded-2xl bg-[#2D3340] p-6 text-white">
              <h4 className="text-[18px] font-extrabold">
                Quer receber esse resultado por email + dicas sobre Lei 14.133?
              </h4>
              <p className="mt-2 text-[13px] text-white/80">
                Sem spam. 1 email semanal sobre gestão de contratos públicos.
                Descadastra a qualquer hora.
              </p>
              <form
                className="mt-4 flex gap-2"
                onSubmit={async (ev) => {
                  ev.preventDefault();
                  const form = ev.currentTarget;
                  const formData = new FormData(form);
                  const email = formData.get("email")?.toString().trim();
                  if (!email) return;
                  await fetch("/api/leads-calculadora", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email,
                      origem: "calc-saldo-ata",
                      totalRegistrado,
                      totalDisponivel,
                    }),
                  }).catch(() => {});
                  setEmailCapturado(true);
                }}
              >
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="seu@email.com.br"
                  className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm text-[#2D3340] focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
                >
                  Enviar <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-7 flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <p className="text-[14px] text-emerald-900">
                <strong>Email cadastrado!</strong> Você vai receber o resultado +
                dicas sobre Lei 14.133 em breve.
              </p>
            </div>
          )}

          {/* CTA pro sistema */}
          <div className="mt-7 text-center">
            <p className="text-[14px] text-[#5D6470]">
              Quer ver isso pra TODAS as suas Atas, em tempo real, sem precisar
              recalcular manualmente?
            </p>
            <a
              href="/signup"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
            >
              Testar o CP System 14 dias grátis <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultadoCard({
  titulo,
  valor,
  sub,
  cor,
  destaque,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  cor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${destaque ? "shadow-lg" : "shadow"} ${
        destaque ? "bg-white ring-2 ring-emerald-200" : "bg-white ring-1 ring-slate-100"
      }`}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "#5D6470", letterSpacing: "0.16em" }}
      >
        {titulo}
      </p>
      <p
        className="mt-2 text-[26px] font-extrabold tabular-nums leading-none"
        style={{ color: cor, letterSpacing: "-0.025em" }}
      >
        {valor}
      </p>
      {sub && (
        <p className="mt-1 text-[11px]" style={{ color: "#5D6470" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
