"use client";

import { useActionState, useState } from "react";
import { Users, UserPlus, Trash2, SlidersHorizontal } from "lucide-react";
import {
  convidarUsuarioAction,
  alterarPerfilAction,
  removerUsuarioAction,
  atualizarAcessoAction,
} from "@/app/actions/equipe";
import { LIMITE_COLABORADORES, MODULOS_PADRAO_COLABORADOR, rotuloDoModulo } from "@/lib/modulosAcesso";
import { CaixaDeAcessos } from "./CaixaDeAcessos";

type Membro = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  criadoEm: Date;
  acessoRestrito: boolean;
  modulosPermitidos: string[];
};

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

function resumoAcesso(m: Membro): string {
  if (!m.acessoRestrito) return "Acesso completo";
  if (m.modulosPermitidos.length === 0) return "Sem módulo liberado";
  return m.modulosPermitidos.map(rotuloDoModulo).join(" · ");
}

export function EquipeClient({
  membros,
  meuId,
  ehAdmin,
  titularId,
}: {
  membros: Membro[];
  meuId: string;
  ehAdmin: boolean;
  titularId: string | null;
}) {
  const [state, formAction] = useActionState(convidarUsuarioAction, null);
  const [editando, setEditando] = useState<string | null>(null);

  const colaboradores = membros.filter((m) => m.id !== titularId).length;
  const vagas = Math.max(0, LIMITE_COLABORADORES - colaboradores);

  return (
    <div className="space-y-6">
      <section className="glass rounded-[20px] px-6 py-5">
        <h2
          className="flex items-center gap-2 text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          <Users className="h-4 w-4" /> Membros da equipe ({membros.length})
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
          Sua conta permite <strong>até {LIMITE_COLABORADORES} colaboradores</strong> além de você.{" "}
          {vagas > 0
            ? `${vagas === 1 ? "Resta 1 vaga" : `Restam ${vagas} vagas`}.`
            : "As vagas estão ocupadas — remova um colaborador para cadastrar outro."}
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">E-mail</th>
                <th className="px-3 py-2 text-left">Perfil</th>
                <th className="px-3 py-2 text-left">Acessos</th>
                <th className="px-3 py-2 text-right">Desde</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => {
                const ehTitular = m.id === titularId;
                return (
                  <FragmentoMembro
                    key={m.id}
                    membro={m}
                    ehTitular={ehTitular}
                    ehEu={m.id === meuId}
                    ehAdmin={ehAdmin}
                    aberto={editando === m.id}
                    onToggle={() => setEditando(editando === m.id ? null : m.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {ehAdmin && vagas > 0 && (
        <section className="glass rounded-[20px] px-6 py-5">
          <h2
            className="flex items-center gap-2 text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            <UserPlus className="h-4 w-4" /> Cadastrar colaborador
          </h2>
          <form action={formAction} className="mt-3 space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>

            <CaixaDeAcessos
              idPrefixo="novo"
              restritoInicial
              modulosIniciais={MODULOS_PADRAO_COLABORADOR}
            />

            {state?.erro && <div className="text-xs font-semibold text-red-700">{state.erro}</div>}
            {state?.ok && <div className="text-xs font-semibold text-emerald-700">Colaborador cadastrado.</div>}
            <button
              type="submit"
              className="rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--primary-deep)" }}
            >
              Cadastrar colaborador
            </button>
          </form>
        </section>
      )}

      <section className="glass-tile rounded-[16px] px-5 py-4 text-xs" style={{ color: "var(--text-soft)" }}>
        <h3 className="font-extrabold" style={{ color: "var(--text)" }}>
          Como os dois controles se combinam
        </h3>
        <ul className="mt-2 space-y-1">
          <li>
            <strong>Perfil</strong> — o que a pessoa faz. Admin gerencia equipe e plano; Operacional cria e
            edita Atas, Contratos e Empenhos; Visualizador só lê.
          </li>
          <li>
            <strong>Acessos</strong> — onde a pessoa entra. Um Operacional sem o módulo Contratos não cria
            contrato, porque nem chega na tela.
          </li>
          <li>
            O titular da conta sempre tem acesso completo — é quem administra os acessos dos demais.
          </li>
        </ul>
      </section>
    </div>
  );
}

function FragmentoMembro({
  membro,
  ehTitular,
  ehEu,
  ehAdmin,
  aberto,
  onToggle,
}: {
  membro: Membro;
  ehTitular: boolean;
  ehEu: boolean;
  ehAdmin: boolean;
  aberto: boolean;
  onToggle: () => void;
}) {
  const [state, formAction] = useActionState(atualizarAcessoAction, null);
  const podeEditarAcesso = ehAdmin && !ehTitular && !ehEu;

  return (
    <>
      <tr className="border-t border-slate-100">
        <td className="px-3 py-2 font-medium">
          {membro.nome}
          {ehEu && <span className="ml-2 text-xs text-slate-400">(você)</span>}
          {ehTitular && <span className="ml-2 text-xs text-slate-400">· titular</span>}
        </td>
        <td className="px-3 py-2 text-xs text-slate-600">{membro.email}</td>
        <td className="px-3 py-2">
          {ehAdmin && !ehEu ? (
            <form action={alterarPerfilAction}>
              <input type="hidden" name="usuarioId" value={membro.id} />
              <select
                name="perfil"
                defaultValue={membro.perfil}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="ADMIN">Admin</option>
                <option value="OPERACIONAL">Operacional</option>
                <option value="VISUALIZADOR">Visualizador</option>
              </select>
            </form>
          ) : (
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR_PERFIL[membro.perfil]}`}>
              {ROTULO_PERFIL[membro.perfil]}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-xs" style={{ color: "var(--text-soft)" }}>
          {ehTitular ? "Acesso completo" : resumoAcesso(membro)}
          {podeEditarAcesso && (
            <button
              type="button"
              onClick={onToggle}
              className="ml-2 inline-flex items-center gap-1 font-semibold underline"
              style={{ color: "var(--primary-deep)" }}
            >
              <SlidersHorizontal className="h-3 w-3" />
              {aberto ? "fechar" : "editar"}
            </button>
          )}
        </td>
        <td className="px-3 py-2 text-right text-xs text-slate-500">
          {membro.criadoEm.toLocaleDateString("pt-BR")}
        </td>
        <td className="px-3 py-2 text-right">
          {ehAdmin && !ehEu && !ehTitular && (
            <form action={removerUsuarioAction}>
              <input type="hidden" name="usuarioId" value={membro.id} />
              <button type="submit" className="text-xs text-red-600 hover:underline">
                <Trash2 className="inline h-3 w-3" /> Remover
              </button>
            </form>
          )}
        </td>
      </tr>

      {aberto && podeEditarAcesso && (
        <tr className="border-t border-slate-100">
          <td colSpan={6} className="px-3 py-3">
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="usuarioId" value={membro.id} />
              <CaixaDeAcessos
                idPrefixo={membro.id}
                restritoInicial={membro.acessoRestrito}
                modulosIniciais={membro.modulosPermitidos}
              />
              {state?.erro && <div className="text-xs font-semibold text-red-700">{state.erro}</div>}
              {state?.ok && <div className="text-xs font-semibold text-emerald-700">Acessos atualizados.</div>}
              <button
                type="submit"
                className="rounded-md px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "var(--primary-deep)" }}
              >
                Salvar acessos de {membro.nome.split(" ")[0]}
              </button>
            </form>
          </td>
        </tr>
      )}
    </>
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
