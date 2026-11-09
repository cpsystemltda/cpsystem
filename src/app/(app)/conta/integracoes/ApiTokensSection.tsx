"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { criarApiTokenAction, revogarApiTokenAction, type ResultadoToken } from "@/app/actions/apiTokens";

type TokenDto = { id: string; nome: string; prefixo: string; escopos: string[]; criadoEm: string; ultimoUsoEm: string | null; usos: number };

const ROTULO: Record<string, string> = { leitura: "leitura", "pagamentos:escrita": "baixa de pagamento" };

/**
 * API do CP System em Conta › Integrações: o admin gera o token que o
 * sistema interno da empresa usa para puxar execuções e a agenda e para
 * registrar pagamentos.
 */
export function ApiTokensSection({ tokens, ehAdmin }: { tokens: TokenDto[]; ehAdmin: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ResultadoToken, FormData>(async (p, fd) => {
    const r = await criarApiTokenAction(p, fd);
    if (r?.ok) router.refresh();
    return r;
  }, null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revogando, start] = useTransition();
  const fmt = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="glass mt-6 rounded-[20px] px-6 py-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-1 h-5 w-5 shrink-0 text-violet-700" />
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-900">API do CP System</h2>
          <p className="mt-1 text-sm text-slate-600">
            Para o sistema interno da sua empresa conversar com o CP System: puxar as execuções e a agenda de eventos, e informar o que foi pago.{" "}
            <Link href="/desenvolvedores" className="font-semibold text-violet-700 underline" target="_blank">
              Documentação da API
            </Link>
          </p>

          {state?.ok && state.token && (
            <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Token “{state.nome}” criado. Copie agora: ele não aparece de novo.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-3 py-2 font-mono text-xs text-slate-900">{state.token}</code>
                <button
                  type="button"
                  className="btn-secondary inline-flex"
                  onClick={() => {
                    navigator.clipboard.writeText(state.token!).then(() => setCopiado(true));
                  }}
                >
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="mt-2 text-xs text-emerald-900">Guarde no sistema que vai usar a API. Quem tiver este token lê os dados da sua conta: não envie por e-mail aberto nem cole em grupo.</p>
            </div>
          )}

          {tokens.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {tokens.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>
                    <strong className="text-slate-900">{t.nome}</strong> <code className="ml-1 font-mono text-xs text-slate-500">{t.prefixo}…</code>
                    <span className="ml-2 text-xs text-slate-500">
                      {t.escopos.map((e) => ROTULO[e] ?? e).join(" + ")} · criado {fmt(t.criadoEm)} · {t.ultimoUsoEm ? `último uso ${fmt(t.ultimoUsoEm)} (${t.usos} chamada${t.usos === 1 ? "" : "s"})` : "nunca usado"}
                    </span>
                  </span>
                  {ehAdmin && (
                    <button
                      type="button"
                      disabled={revogando}
                      className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
                      onClick={() =>
                        confirm(`Revogar o token "${t.nome}"? O sistema que usa este token para de acessar na hora.`) &&
                        start(async () => {
                          const r = await revogarApiTokenAction(t.id);
                          if (r.erro) setErro(r.erro);
                          else router.refresh();
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Revogar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}

          {ehAdmin ? (
            <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block text-xs">
                <span className="font-semibold uppercase tracking-wide text-slate-500">Nome do token</span>
                <input name="nome" required className="mt-1 block w-64" placeholder="Ex.: Sistema interno Green" />
              </label>
              <label className="inline-flex items-center gap-2 pb-2 text-xs text-slate-700">
                <input type="checkbox" name="escopos" value="leitura" defaultChecked disabled /> Leitura
              </label>
              <label className="inline-flex items-center gap-2 pb-2 text-xs text-slate-700">
                <input type="checkbox" name="escopos" value="pagamentos:escrita" defaultChecked /> Registrar pagamentos
              </label>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Gerando…" : "Gerar token"}
              </button>
              {state?.erro && <span className="text-xs text-red-700">{state.erro}</span>}
            </form>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Só o administrador da conta gera tokens.</p>
          )}
        </div>
      </div>
    </section>
  );
}
