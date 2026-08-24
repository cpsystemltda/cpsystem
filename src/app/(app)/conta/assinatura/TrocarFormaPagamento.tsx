"use client";

import { useActionState, useState } from "react";
import { CreditCard, QrCode, FileText } from "lucide-react";
import { CampoCartao } from "@/components/CampoCartao";
import { trocarFormaPagamentoAction } from "@/app/actions/formaPagamento";

/**
 * Troca da forma de pagamento pelo próprio cliente (Regina 24/08).
 *
 * A tela mostrava o cartão salvo e nenhum caminho pra mudar nada — nem trocar
 * de cartão, nem sair do cartão pro PIX. Agora é auto-serviço.
 */
export function TrocarFormaPagamento({ formaAtual }: { formaAtual: "CARTAO_CREDITO" | "AVULSO" }) {
  const [state, action] = useActionState(trocarFormaPagamentoAction, null);
  const [aberto, setAberto] = useState(false);
  const [forma, setForma] = useState<"PIX" | "BOLETO" | "CARTAO_CREDITO">(
    formaAtual === "CARTAO_CREDITO" ? "PIX" : "CARTAO_CREDITO",
  );
  const e = state?.campos ?? {};

  if (!aberto) {
    return (
      <div className="mt-4">
        {state?.ok && state.mensagem && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            {state.mensagem}
          </p>
        )}
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Trocar forma de pagamento
        </button>
        <p className="mt-2 text-xs text-slate-500">
          {formaAtual === "CARTAO_CREDITO"
            ? "Hoje a cobrança sai automaticamente no cartão salvo."
            : "Hoje você paga cada fatura pelo código PIX ou boleto, aqui na tela."}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <input type="hidden" name="forma" value={forma} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Como você quer pagar a mensalidade
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Opcao ativo={forma === "PIX"} onClick={() => setForma("PIX")} icone={QrCode} titulo="PIX" sub="Código na tela, confirmação em segundos" />
        <Opcao ativo={forma === "BOLETO"} onClick={() => setForma("BOLETO")} icone={FileText} titulo="Boleto" sub="Vence em 2 dias" />
        <Opcao ativo={forma === "CARTAO_CREDITO"} onClick={() => setForma("CARTAO_CREDITO")} icone={CreditCard} titulo="Cartão" sub="Cobrança automática todo mês" />
      </div>

      {forma === "CARTAO_CREDITO" && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          <CampoCartao
            erros={{
              cartaoNumero: e.cartaoNumero,
              cartaoValidade: e.cartaoValidade,
              cartaoCvv: e.cartaoCvv,
              cartaoNome: e.cartaoNome,
            }}
          />
          <label className="col-span-4 text-xs font-semibold text-slate-700 sm:col-span-2">
            CPF do titular do cartão
            <input
              name="cpfTitularCartao"
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
            {e.cpfTitularCartao && (
              <span className="mt-1 block text-[11px] font-semibold text-rose-700">{e.cpfTitularCartao}</span>
            )}
          </label>
        </div>
      )}

      {forma !== "CARTAO_CREDITO" && (
        <p className="mt-3 text-xs text-slate-600">
          A cobrança automática no cartão é encerrada. A cada mês você recebe a fatura aqui na tela
          e paga pelo código — sem nada debitado sem você ver.
        </p>
      )}

      {state?.erro && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{state.erro}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Opcao({
  ativo,
  onClick,
  icone: Icone,
  titulo,
  sub,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ComponentType<{ size?: number; className?: string }>;
  titulo: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        ativo ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Icone size={15} className={ativo ? "text-violet-600" : "text-slate-400"} />
        {titulo}
      </span>
      <span className="mt-0.5 block text-[11px] text-slate-600">{sub}</span>
    </button>
  );
}
