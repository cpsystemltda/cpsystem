"use client";

import { useActionState, useState, useTransition } from "react";
import { ShieldCheck, ShieldAlert, KeyRound, RefreshCw, X } from "lucide-react";
import {
  iniciar2FAAction,
  confirmar2FAAction,
  regenerarRecoveryCodesAction,
  desativar2FAAction,
} from "@/app/actions/doisFatores";

type Props = {
  ativo: boolean;
  ativadoEm: Date | null;
  emailConta: string;
  recoveryCodesRestantes: number;
};

type Passo =
  | { modo: "off" }
  | { modo: "setup"; secret: string; qrCodeDataUri: string; otpauthUri: string }
  | { modo: "recovery-codes"; codes: string[] };

export function TwoFactorConfig(props: Props) {
  const [passo, setPasso] = useState<Passo>({ modo: "off" });
  const [modalDesativar, setModalDesativar] = useState(false);
  const [modalRegenerar, setModalRegenerar] = useState(false);
  const [iniciarPending, startIniciar] = useTransition();
  const [iniciarErro, setIniciarErro] = useState<string | null>(null);

  const [confirmarState, confirmarAction, confirmarPending] = useActionState(confirmar2FAAction, null);
  const [desativarState, desativarAction, desativarPending] = useActionState(desativar2FAAction, null);
  const [regenerarState, regenerarAction, regenerarPending] = useActionState(regenerarRecoveryCodesAction, null);

  // Se confirmacao ok, mostra os recovery codes
  if (confirmarState?.recoveryCodes && passo.modo !== "recovery-codes") {
    setPasso({ modo: "recovery-codes", codes: confirmarState.recoveryCodes });
  }
  // Se regenerou, tambem mostra os codes novos
  if (regenerarState?.recoveryCodes && passo.modo !== "recovery-codes") {
    setModalRegenerar(false);
    setPasso({ modo: "recovery-codes", codes: regenerarState.recoveryCodes });
  }
  // Se desativou, fecha modal
  if (desativarState?.ok && modalDesativar) {
    setModalDesativar(false);
  }

  function handleIniciar() {
    setIniciarErro(null);
    startIniciar(async () => {
      const r = await iniciar2FAAction();
      if (r.erro) {
        setIniciarErro(r.erro);
      } else if (r.qrCodeDataUri && r.secret && r.otpauthUri) {
        setPasso({ modo: "setup", secret: r.secret, qrCodeDataUri: r.qrCodeDataUri, otpauthUri: r.otpauthUri });
      }
    });
  }

  // === Estado: mostrando recovery codes recem-gerados ===
  if (passo.modo === "recovery-codes") {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Códigos de recuperação — salve agora</h2>
            <p className="mt-2 text-sm text-slate-800">
              Se você perder o celular, use um desses códigos <strong>uma única vez</strong> pra entrar.
              Cada código só serve pra 1 login. <strong>Essa é a única vez que eles aparecem</strong> —
              anote, imprima ou salve num gerenciador de senhas antes de fechar.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
              {passo.codes.map((c) => (
                <code key={c} className="rounded bg-white px-3 py-2 tracking-wider text-slate-900">
                  {c}
                </code>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const texto = `Códigos de recuperação 2FA — CP System\nConta: ${props.emailConta}\n\n${passo.codes.join("\n")}`;
                  navigator.clipboard.writeText(texto);
                  alert("Códigos copiados. Cole num gerenciador de senhas ou arquivo seguro.");
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Copiar códigos
              </button>
              <button
                type="button"
                onClick={() => setPasso({ modo: "off" })}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Já salvei
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // === Estado: em processo de setup (mostra QR + campo de código) ===
  if (passo.modo === "setup") {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Configurar 2FA — escaneie o QR</h2>
          <button type="button" onClick={() => setPasso({ modo: "off" })} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="mt-4 space-y-4 text-sm text-slate-700">
          <li>
            <strong>1.</strong> Instale um app authenticator no celular (Google Authenticator, Authy, 1Password, Microsoft Authenticator).
          </li>
          <li>
            <strong>2.</strong> Abra o app e escaneie esse QR code:
            <div className="mt-3 inline-block rounded-lg border border-slate-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={passo.qrCodeDataUri} alt="QR code 2FA" className="h-56 w-56" />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Se não conseguir escanear, digite este código manualmente no app:
              <code className="ml-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-900">{passo.secret}</code>
            </div>
          </li>
          <li>
            <strong>3.</strong> Digite o código de 6 dígitos que apareceu no app:
            <form action={confirmarAction} className="mt-3 flex gap-3">
              <input
                type="text"
                name="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                required
                className="w-40 rounded-lg border border-slate-300 px-4 py-2 text-center font-mono text-lg tracking-widest text-slate-900"
              />
              <button
                type="submit"
                disabled={confirmarPending}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {confirmarPending ? "Verificando…" : "Confirmar e ativar"}
              </button>
            </form>
            {confirmarState?.erro ? (
              <p className="mt-2 text-xs text-red-700">{confirmarState.erro}</p>
            ) : null}
          </li>
        </ol>
      </section>
    );
  }

  // === Estado: 2FA ativo ===
  if (props.ativo) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Autenticação em 2 fatores (2FA) — ativa</h2>
            <p className="mt-1 text-xs text-slate-700">
              Ativa desde {props.ativadoEm?.toLocaleDateString("pt-BR")}. Você precisa do código do app
              authenticator toda vez que fizer login.
            </p>
            <p className="mt-2 text-xs text-slate-700">
              Códigos de recuperação restantes: <strong>{props.recoveryCodesRestantes}</strong>
              {props.recoveryCodesRestantes <= 2 ? (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">poucos!</span>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModalRegenerar(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerar códigos de recuperação
              </button>
              <button
                type="button"
                onClick={() => setModalDesativar(true)}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Desativar 2FA
              </button>
            </div>
          </div>
        </div>

        {modalRegenerar ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <h3 className="text-sm font-semibold text-slate-900">Regenerar códigos de recuperação</h3>
              <p className="mt-1 text-xs text-slate-600">
                Isso invalida os códigos antigos. Digite o código atual do app pra confirmar.
              </p>
              <form action={regenerarAction} className="mt-4 space-y-3">
                <input
                  type="text"
                  name="codigo"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="Código de 6 dígitos"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-center tracking-widest text-slate-900"
                />
                {regenerarState?.erro ? <p className="text-xs text-red-700">{regenerarState.erro}</p> : null}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={regenerarPending}
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {regenerarPending ? "Gerando…" : "Regenerar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalRegenerar(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {modalDesativar ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <h3 className="text-sm font-semibold text-slate-900">Desativar 2FA</h3>
              <p className="mt-1 text-xs text-slate-600">
                Sua conta fica só com a senha depois disso — recomendamos manter ativo. Confirme com
                senha atual + código 2FA.
              </p>
              <form action={desativarAction} className="mt-4 space-y-3">
                <input
                  type="password"
                  name="senha"
                  placeholder="Senha atual"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900"
                />
                <input
                  type="text"
                  name="codigo"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="Código 2FA de 6 dígitos"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-center tracking-widest text-slate-900"
                />
                {desativarState?.erro ? <p className="text-xs text-red-700">{desativarState.erro}</p> : null}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={desativarPending}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {desativarPending ? "Desativando…" : "Desativar 2FA"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalDesativar(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  // === Estado: 2FA inativo (default) ===
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Autenticação em 2 fatores (2FA)</h2>
          <p className="mt-1 text-xs text-slate-700">
            Bloqueia login mesmo que alguém descubra sua senha — exige um código de 6 dígitos que
            só aparece no seu celular. Recomendado pra qualquer conta com dados financeiros ou
            operacionais.
          </p>
          <button
            type="button"
            onClick={handleIniciar}
            disabled={iniciarPending}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            {iniciarPending ? "Preparando…" : "Ativar 2FA"}
          </button>
          {iniciarErro ? <p className="mt-2 text-xs text-red-700">{iniciarErro}</p> : null}
        </div>
      </div>
    </section>
  );
}
