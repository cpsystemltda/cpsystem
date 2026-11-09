"use client";

import { useActionState } from "react";
import { salvarFaixasAction, type ResultadoFaixas } from "@/app/actions/faixasTerceirizacao";
import type { Faixa } from "@/lib/faixasTerceirizacao";

export function FormFaixas({ faixas, nomePacote, cobrancaAtiva }: { faixas: Faixa[]; nomePacote: string; cobrancaAtiva: boolean }) {
  const [state, action, pending] = useActionState<ResultadoFaixas, FormData>(salvarFaixasAction, null);
  const linhas = [...faixas, { ate: null, valor: 0 }, { ate: null, valor: 0 }];
  return (
    <form action={action} className="glass rounded-[20px] px-6 py-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="pb-2">Faixa</th>
            <th className="pb-2">Até (colaboradores ativos)</th>
            <th className="pb-2">Adicional mensal (R$)</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((f, i) => (
            <tr key={i}>
              <td className="py-1 text-slate-500">{i + 1}</td>
              <td className="py-1">
                <input name="ate" defaultValue={i < faixas.length && f.ate != null ? String(f.ate) : ""} inputMode="numeric" className="w-32" placeholder={i < faixas.length ? "" : "nova faixa"} />
              </td>
              <td className="py-1">
                <input name="valor" defaultValue={i < faixas.length ? String(f.valor).replace(".", ",") : ""} inputMode="decimal" className="w-32" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">Para apagar uma faixa, deixe os dois campos em branco. Acima da última faixa, o valor é combinado caso a caso.</p>

      <label className="mt-4 block text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Nome comercial do pacote (RN09)</span>
        <input name="nomePacote" defaultValue={nomePacote} className="mt-1 block w-80" />
      </label>

      <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <input type="checkbox" name="cobrancaAtiva" defaultChecked={cobrancaAtiva} className="mt-1" />
        <span>
          <strong>Mostrar a faixa e o preço aos clientes e enviar os avisos de 90% e de mudança de faixa.</strong> Ligar só depois da aprovação do Igor (Anexo B.1) e da
          cláusula nos Termos. Nenhuma cobrança é criada no Asaas por esta chave: o lançamento na fatura ainda depende da decisão da Regina.
        </span>
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {state?.erro && <span className="text-xs text-red-700">{state.erro}</span>}
        {state?.mensagem && <span className="text-xs text-emerald-800">{state.mensagem}</span>}
      </div>
    </form>
  );
}
