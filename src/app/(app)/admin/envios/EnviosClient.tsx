"use client";

import { useActionState, useState } from "react";
import { FileText, Send, ExternalLink, MessageCircle } from "lucide-react";
import {
  enviarContratoAnalistaWaAction,
  enviarMagicLinkMigracaoAction,
  type EnvioResult,
} from "@/app/actions/admin/enviosAvulsos";

type Candidato = {
  contaId: string;
  trialAteEm: string | null;
  razaoSocial: string;
  cnpj: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    telefone: string;
  } | null;
};

export function EnviosClient({
  versaoContratoAnalista,
  candidatosMigracao,
}: {
  versaoContratoAnalista: string;
  candidatosMigracao: Candidato[];
}) {
  const [stateContrato, actionContrato, pendingContrato] = useActionState<EnvioResult | null, FormData>(
    enviarContratoAnalistaWaAction,
    null,
  );
  const [stateMigracao, actionMigracao, pendingMigracao] = useActionState<EnvioResult | null, FormData>(
    enviarMagicLinkMigracaoAction,
    null,
  );

  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>("");

  return (
    <div className="mt-6 space-y-8">
      {/* Bloco 1: contrato analista pro Igor */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <FileText className="mt-0.5 text-violet-600" size={22} />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Enviar contrato de analista via WhatsApp
            </h2>
            <p className="text-xs text-slate-500">
              Versão {versaoContratoAnalista}. Mensagem curta + PDF anexado. Uso típico: Igor revisar.
            </p>
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Preview do PDF:{" "}
          <a
            href="/contratos/analista/pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:underline"
          >
            /contratos/analista/pdf <ExternalLink size={11} />
          </a>
        </div>

        <form action={actionContrato} className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-700 sm:col-span-1">
            Nome do destinatário
            <input
              name="nome"
              type="text"
              defaultValue="Igor"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-1">
            Telefone (com DDD)
            <input
              name="telefone"
              type="tel"
              placeholder="(00) 00000-0000"
              required
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </label>
          <div className="sm:col-span-1 sm:self-end">
            <button
              type="submit"
              disabled={pendingContrato}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <Send size={14} /> {pendingContrato ? "Enviando..." : "Enviar contrato"}
            </button>
          </div>
        </form>

        {stateContrato?.ok && (
          <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
            ✓ {stateContrato.detalhe ?? "Enviado."}
          </div>
        )}
        {stateContrato?.erro && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">✕ {stateContrato.erro}</div>
        )}
      </section>

      {/* Bloco 2: magic link migração pro Léo */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <MessageCircle className="mt-0.5 text-amber-600" size={22} />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Enviar link de migração (contas TRIAL antigas)
            </h2>
            <p className="text-xs text-slate-500">
              Link único de acesso (48h). Ao clicar, entra logado direto em <code>/conta/completar-cadastro</code> — pode
              atualizar razão social / CNPJ / endereço, aceitar contrato v2.2 e cadastrar cartão.
            </p>
          </div>
        </div>

        {candidatosMigracao.length === 0 ? (
          <div className="rounded-md bg-slate-50 px-3 py-3 text-xs text-slate-500">
            Nenhuma conta TRIAL sem subscription no momento.
          </div>
        ) : (
          <form action={actionMigracao} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Conta destino
              <select
                name="usuarioId"
                required
                value={usuarioSelecionado}
                onChange={(e) => setUsuarioSelecionado(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
              >
                <option value="">— Escolha uma conta —</option>
                {candidatosMigracao.map((c) => (
                  <option key={c.contaId} value={c.usuario?.id ?? ""} disabled={!c.usuario}>
                    {c.razaoSocial} — {c.usuario?.nome ?? "(sem admin)"}{" "}
                    {c.trialAteEm && `· trial até ${new Date(c.trialAteEm).toLocaleDateString("pt-BR")}`}
                    {c.usuario?.telefone ? ` · ${c.usuario.telefone}` : " · SEM TELEFONE"}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="motivo" value="migracao_completar_cadastro" />
            <button
              type="submit"
              disabled={pendingMigracao || !usuarioSelecionado}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <Send size={14} /> {pendingMigracao ? "Enviando..." : "Gerar link e enviar por WA"}
            </button>
          </form>
        )}

        {stateMigracao?.ok && (
          <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
            ✓ {stateMigracao.detalhe ?? "Enviado."}
          </div>
        )}
        {stateMigracao?.erro && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">✕ {stateMigracao.erro}</div>
        )}
      </section>
    </div>
  );
}
