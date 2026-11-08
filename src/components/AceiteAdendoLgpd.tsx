"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { aceitarAdendoLgpdAction, type ResultadoLgpd } from "@/app/actions/lgpd";
import { VERSAO_ADENDO_LGPD } from "@/lib/lgpd";

/**
 * Cartão de aceite do adendo LGPD (ESP-007 RN08). Aparece no primeiro acesso
 * ao Módulo Terceirização; o ADMIN aceita, os outros perfis recebem o aviso.
 */
export function AceiteAdendoLgpd({ ehAdmin, compacto = false }: { ehAdmin: boolean; compacto?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ResultadoLgpd | null, FormData>(
    async (prev, fd) => {
      const r = await aceitarAdendoLgpdAction(prev, fd);
      if (r?.ok) router.refresh();
      return r;
    },
    null,
  );
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-violet-950">Módulo Terceirização: aceite do adendo de tratamento de dados pessoais (LGPD)</p>
          <p className="mt-1 text-xs text-violet-900">
            Este módulo guarda dados de empregados da sua empresa (nome, CPF, função, documentos trabalhistas). Antes do primeiro uso, o administrador aceita o adendo em que a CP System atua como <strong>operadora</strong> e a empresa como <strong>controladora</strong> — versão {VERSAO_ADENDO_LGPD}.{" "}
            <Link href="/termos/adendo-lgpd" className="underline" target="_blank">
              Ler o adendo completo
            </Link>
            .
          </p>
          {ehAdmin ? (
            <form action={action} className={`mt-3 flex flex-wrap items-center gap-3 ${compacto ? "" : ""}`}>
              <label className="inline-flex items-center gap-2 text-xs text-violet-950">
                <input type="checkbox" name="li" value="1" required /> Li o adendo e aceito em nome da empresa
              </label>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Registrando…" : "Aceitar e liberar o módulo"}
              </button>
              {state?.erro && <span className="text-xs text-red-700">{state.erro}</span>}
            </form>
          ) : (
            <p className="mt-2 text-xs font-semibold text-violet-950">Peça ao administrador da conta para aceitar o adendo; até lá as abas do módulo ficam fechadas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
