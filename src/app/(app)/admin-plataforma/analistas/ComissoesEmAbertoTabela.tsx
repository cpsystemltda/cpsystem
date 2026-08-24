"use client";

import { useActionState } from "react";
import { brl } from "@/lib/validators";
import { pagarComissaoAgoraAction } from "@/app/actions/comissaoManual";

/**
 * Comissões do programa ainda não repassadas, com o botão de pagar na hora.
 *
 * Regina 24/08: o repasse automático espera o dinheiro do cliente ser liberado
 * pelo gateway (cartão leva ~32 dias). Quando ela decide antecipar — foi o caso
 * do Igor, que ficou sem receber porque o cliente pagou um dia depois da data de
 * repasse — o PIX sai daqui, com registro em auditoria.
 */
export function ComissoesEmAbertoTabela({
  comissoes,
}: {
  comissoes: { id: string; competencia: string; valor: number; analista: string; cliente: string }[];
}) {
  const [state, action] = useActionState(pagarComissaoAgoraAction, null);

  if (comissoes.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-xs" style={{ color: "var(--text-mute)" }}>
        Nenhuma comissão em aberto — está tudo repassado.
      </p>
    );
  }

  return (
    <>
      {state?.erro && (
        <p className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm font-semibold text-red-800">
          {state.erro}
        </p>
      )}
      {state?.ok && (
        <p className="border-b border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-800">
          PIX de {brl(state.valor ?? 0)} enviado ao analista.
        </p>
      )}
      <table className="table-glass">
        <thead>
          <tr>
            <th>Competência</th>
            <th>Analista</th>
            <th>Cliente que gerou</th>
            <th className="num">Valor</th>
            <th className="num">Repasse</th>
          </tr>
        </thead>
        <tbody>
          {comissoes.map((c) => (
            <tr key={c.id}>
              <td className="strong">{c.competencia}</td>
              <td>{c.analista}</td>
              <td className="text-xs" style={{ color: "var(--text-soft)" }}>{c.cliente}</td>
              <td className="num strong">{brl(c.valor)}</td>
              <td className="num">
                <form action={action}>
                  <input type="hidden" name="comissaoId" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                    title="Envia o PIX agora para a chave do analista"
                  >
                    Pagar agora (PIX)
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
