"use client";

import { useActionState } from "react";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { convidarUsuarioAction, alterarPerfilAction, removerUsuarioAction } from "@/app/actions/equipe";

type Membro = { id: string; nome: string; email: string; perfil: string; criadoEm: Date };

const ROTULO_PERFIL: Record<string, string> = {
  ADMIN: "Admin",
  OPERACIONAL: "Operacional",
  VISUALIZADOR: "Visualizador",
};

const COR_PERFIL: Record<string, string> = {
  ADMIN: "bg-blue-100 text-blue-800",
  OPERACIONAL: "bg-emerald-100 text-emerald-800",
  VISUALIZADOR: "bg-slate-200 text-slate-700",
};

export function EquipeClient({ membros, meuId, ehAdmin }: { membros: Membro[]; meuId: string; ehAdmin: boolean }) {
  const [state, formAction] = useActionState(convidarUsuarioAction, null);

  return (
    <div className="space-y-6">
      <section className="glass rounded-[20px] px-6 py-5">
        <h2
          className="flex items-center gap-2 text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          <Users className="h-4 w-4" /> Membros da equipe ({membros.length})
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">E-mail</th>
              <th className="px-3 py-2 text-left">Perfil</th>
              <th className="px-3 py-2 text-right">Desde</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {membros.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  {m.nome}
                  {m.id === meuId && <span className="ml-2 text-xs text-slate-400">(você)</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{m.email}</td>
                <td className="px-3 py-2">
                  {ehAdmin && m.id !== meuId ? (
                    <form action={alterarPerfilAction}>
                      <input type="hidden" name="usuarioId" value={m.id} />
                      <select
                        name="perfil"
                        defaultValue={m.perfil}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="OPERACIONAL">Operacional</option>
                        <option value="VISUALIZADOR">Visualizador</option>
                      </select>
                    </form>
                  ) : (
                    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR_PERFIL[m.perfil]}`}>
                      {ROTULO_PERFIL[m.perfil]}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">{m.criadoEm.toLocaleDateString("pt-BR")}</td>
                <td className="px-3 py-2 text-right">
                  {ehAdmin && m.id !== meuId && (
                    <form action={removerUsuarioAction}>
                      <input type="hidden" name="usuarioId" value={m.id} />
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        <Trash2 className="inline h-3 w-3" /> Remover
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {ehAdmin && (
        <section className="glass rounded-[20px] px-6 py-5">
          <h2
            className="flex items-center gap-2 text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            <UserPlus className="h-4 w-4" /> Convidar membro
          </h2>
          <form action={formAction} className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Campo label="Nome" name="nome" required />
            <Campo label="E-mail" name="email" type="email" required />
            <Campo label="Senha provisória (mín. 8)" name="senha" type="password" required />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Perfil</span>
              <select name="perfil" required className="rounded border border-slate-300 px-2 py-1.5 text-sm">
                <option value="OPERACIONAL">Operacional (cria/edita)</option>
                <option value="VISUALIZADOR">Visualizador (somente leitura)</option>
                <option value="ADMIN">Admin (todos os poderes)</option>
              </select>
            </label>
            {state?.erro && <div className="col-span-2 text-xs text-red-700">{state.erro}</div>}
            {state?.ok && <div className="col-span-2 text-xs text-emerald-700">Membro adicionado.</div>}
            <button type="submit" className="col-span-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">
              Convidar
            </button>
          </form>
        </section>
      )}

      <section
        className="glass-tile rounded-[16px] px-5 py-4 text-xs"
        style={{ color: "var(--text-soft)" }}
      >
        <h3 className="font-extrabold" style={{ color: "var(--text)" }}>Sobre os perfis</h3>
        <ul className="mt-2 space-y-1">
          <li>
            <strong>Admin:</strong> acesso completo · gerencia equipe, planos, embaixadores, audita logs.
          </li>
          <li>
            <strong>Operacional:</strong> cria, edita e exclui Atas, Contratos, Empenhos e marcos · não pode mudar plano nem gerenciar equipe.
          </li>
          <li>
            <strong>Visualizador:</strong> somente leitura · ideal pra equipe contábil, jurídica externa e auditores.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Campo({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input {...props} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
  );
}
