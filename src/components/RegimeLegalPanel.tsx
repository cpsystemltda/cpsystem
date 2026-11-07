"use client";

import { useActionState, useState } from "react";
import { Scale, Sparkles, AlertTriangle, Loader2, Check } from "lucide-react";
import { sugerirRegimeIaAction, definirRegimeLegalAction } from "@/app/actions/regimeLegal";
import { REGIMES_LEGAIS, ROTULO_REGIME, DICA_REGIME_VAZIO, type RegimeLegal } from "@/lib/regimeLegal";

function dataBr(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
}

/**
 * Regime legal no detalhe do contrato (ESP-001, Igor 07/11/2026).
 *
 * Com regime definido: cabeçalho com a lei, o prazo máximo de vigência (RN07)
 * e as prorrogações restantes estimadas. Sem regime (contrato anterior ao
 * campo): banner "Regime pendente" (RN04) que não bloqueia a tela — pede a
 * definição, com a IA lendo os anexos já enviados e mostrando o trecho que
 * justifica a sugestão. O campo só é salvo com confirmação da pessoa.
 */
export function RegimeLegalPanel({
  contratoId,
  regimeLegal,
  regimeLegalOutro,
  regimeSugerido,
  regimeSugeridoTrecho,
  prazoMaximo,
  limiteMeses,
  inicioContagem,
  avisoLimite,
  prorrogacoesRestantes,
  vigenciaFim,
  podeEditar,
}: {
  contratoId: string;
  regimeLegal: RegimeLegal | null;
  regimeLegalOutro: string | null;
  regimeSugerido: RegimeLegal | null;
  regimeSugeridoTrecho: string | null;
  prazoMaximo: string | null;
  limiteMeses: number | null;
  inicioContagem: string | null;
  avisoLimite: string | null;
  prorrogacoesRestantes: number | null;
  vigenciaFim: string;
  podeEditar: boolean;
}) {
  if (regimeLegal) {
    const vigenciaPassaDoLimite = !!prazoMaximo && new Date(vigenciaFim) > new Date(prazoMaximo);
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
          <Scale className="h-4 w-4 text-slate-500" />
          Regime legal: {ROTULO_REGIME[regimeLegal]}
          {regimeLegal === "OUTRO" && regimeLegalOutro ? ` — ${regimeLegalOutro}` : ""}
        </span>
        {prazoMaximo && (
          <>
            <span className="text-slate-700">
              Prazo máximo de vigência: <strong>{dataBr(prazoMaximo)}</strong>
              <span className="text-xs text-slate-500"> ({limiteMeses} meses desde {dataBr(inicioContagem)})</span>
            </span>
            <span className="text-slate-700">
              Prorrogações restantes estimadas: <strong>{prorrogacoesRestantes ?? 0}</strong>
            </span>
          </>
        )}
        {avisoLimite && <span className="w-full text-xs text-slate-500">{avisoLimite}</span>}
        {vigenciaPassaDoLimite && (
          <span className="inline-flex w-full items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" /> A vigência atual ({dataBr(vigenciaFim)}) já ultrapassa o limite ordinário do regime. Confira o fundamento da prorrogação.
          </span>
        )}
      </div>
    );
  }
  return (
    <BannerRegimePendente
      contratoId={contratoId}
      regimeSugerido={regimeSugerido}
      regimeSugeridoTrecho={regimeSugeridoTrecho}
      podeEditar={podeEditar}
    />
  );
}

function BannerRegimePendente({
  contratoId,
  regimeSugerido,
  regimeSugeridoTrecho,
  podeEditar,
}: {
  contratoId: string;
  regimeSugerido: RegimeLegal | null;
  regimeSugeridoTrecho: string | null;
  podeEditar: boolean;
}) {
  const [sugState, sugerir, sugerindo] = useActionState(sugerirRegimeIaAction, null);
  const [defState, definir, definindo] = useActionState(definirRegimeLegalAction, null);
  const sugerido = (sugState?.sugerido as RegimeLegal | null | undefined) ?? regimeSugerido;
  const trecho = sugState?.trecho ?? regimeSugeridoTrecho;
  const [escolha, setEscolha] = useState<string>(sugerido ?? "");
  const [confirmado, setConfirmado] = useState(false);
  const escolhaEfetiva = escolha || sugerido || "";

  return (
    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Regime legal pendente</p>
          <p className="mt-0.5 text-xs text-amber-900">
            Este contrato foi cadastrado antes de o sistema registrar o regime legal. Ele decide o limite de prorrogação
            (Lei 8.666: 60 meses; Lei 14.133: 10 anos) e o fundamento dos alertas e pedidos. {DICA_REGIME_VAZIO}
          </p>

          {sugerido ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                <Sparkles className="h-3 w-3" /> Sugerido pela IA — confirme
              </span>
              <p className="mt-1 font-semibold text-slate-800">{ROTULO_REGIME[sugerido]}</p>
              {trecho && <p className="mt-1 italic text-slate-600">“{trecho}”</p>}
            </div>
          ) : (
            sugState?.erro && <p className="mt-2 text-xs text-amber-800">{sugState.erro}</p>
          )}

          {podeEditar && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {!sugerido && (
                <form action={sugerir}>
                  <input type="hidden" name="contratoId" value={contratoId} />
                  <button
                    type="submit"
                    disabled={sugerindo}
                    className="inline-flex items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
                  >
                    {sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {sugerindo ? "Lendo os anexos…" : "Sugerir pela IA (lê contrato e aditivos anexados)"}
                  </button>
                </form>
              )}
              <form action={definir} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="contratoId" value={contratoId} />
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium">Regime legal</span>
                  <select
                    name="regimeLegal"
                    value={escolhaEfetiva}
                    onChange={(ev) => {
                      setEscolha(ev.target.value);
                      setConfirmado(true);
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {REGIMES_LEGAIS.map((r) => (
                      <option key={r} value={r}>{ROTULO_REGIME[r]}</option>
                    ))}
                  </select>
                </label>
                {escolhaEfetiva === "OUTRO" && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Qual?</span>
                    <input name="regimeLegalOutro" required className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" />
                  </label>
                )}
                {sugerido && escolhaEfetiva === sugerido && (
                  <label className="inline-flex items-center gap-1.5 pb-2 text-xs">
                    <input type="checkbox" checked={confirmado} onChange={(ev) => setConfirmado(ev.target.checked)} />
                    Confirmo o regime sugerido
                  </label>
                )}
                <button
                  type="submit"
                  disabled={definindo || !escolhaEfetiva || (!!sugerido && escolhaEfetiva === sugerido && !confirmado)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {definindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Salvar regime
                </button>
              </form>
            </div>
          )}
          {defState?.erro && <p className="mt-2 text-xs text-rose-700">{defState.erro}</p>}
        </div>
      </div>
    </div>
  );
}
