import Link from "next/link";
import { Users2, Upload, ShieldAlert } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { podeEditarColaboradores, podeVerDadosColaboradores } from "@/lib/lgpd";
import { avisoRetencao, contagemColaboradores, listarColaboradores } from "@/lib/colaboradoresServer";
import { adendoAceito } from "@/lib/lgpdServer";
import { registrarAcessoDadosPessoais } from "@/lib/lgpdServer";
import { AceiteAdendoLgpd } from "@/components/AceiteAdendoLgpd";
import { ColaboradoresClient } from "./ColaboradoresClient";

/**
 * Módulo Colaboradores (ESP-008): empregados dos contratos de mão de obra.
 * Sem a permissão "Dados de colaboradores" a pessoa vê só quantidades.
 */
export default async function ColaboradoresPage({ searchParams }: { searchParams: Promise<{ q?: string; situacao?: string }> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const podeVer = podeVerDadosColaboradores(usuario);
  const podeEditar = podeEditarColaboradores(usuario);
  const adendoOk = adendoAceito(usuario.conta);
  const contagem = await contagemColaboradores(usuario.contaId);
  const lista = adendoOk && podeVer ? await listarColaboradores(usuario.contaId, { busca: sp.q, situacao: sp.situacao }, true) : [];
  if (adendoOk && podeVer && lista.length > 0) {
    await registrarAcessoDadosPessoais({ contaId: usuario.contaId, usuarioId: usuario.id, recurso: "ColaboradoresLista", resumo: `Listou ${lista.length} colaborador(es)${sp.q ? ` (busca "${sp.q}")` : ""}` });
  }
  const retencao = await avisoRetencao(usuario.contaId);
  const hojeIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-violet-50">
            <Users2 className="h-6 w-6 text-violet-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Colaboradores</h1>
            <p className="mt-1 text-sm text-slate-600">Empregados alocados nos contratos de mão de obra. Quem ocupa cada posto, desde quando, e quem está descoberto.</p>
          </div>
        </div>
        {adendoOk && podeEditar && (
          <Link href="/colaboradores/importar" className="btn-secondary inline-flex">
            <Upload className="h-4 w-4" /> Importar planilha
          </Link>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {[
          ["Ativos", contagem.ativos],
          ["Alocados em posto", contagem.alocados],
          ["Afastados", contagem.afastados],
          ["Desligados", contagem.desligados],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      {!adendoOk ? (
        <div className="mt-6">
          <AceiteAdendoLgpd ehAdmin={usuario.perfil === "ADMIN"} />
        </div>
      ) : !podeVer ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Você vê só as quantidades. Nome, CPF e documentos dos colaboradores exigem a permissão <strong>“Dados de colaboradores”</strong>, que o administrador concede na tela Equipe (LGPD).
          </p>
        </div>
      ) : (
        <>
          {(retencao.emAviso > 0 || retencao.vencidos > 0) && (
            <p className="mt-4 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-xs text-slate-800">
              Retenção ({retencao.anos} anos após o desligamento): {retencao.emAviso > 0 ? `${retencao.emAviso} colaborador(es) serão anonimizados nos próximos 30 dias` : ""}
              {retencao.emAviso > 0 && retencao.vencidos > 0 ? " · " : ""}
              {retencao.vencidos > 0 ? `${retencao.vencidos} com prazo vencido (anonimização na próxima rotina diária)` : ""}. Prazo em Conta › Privacidade.
            </p>
          )}
          <ColaboradoresClient lista={lista} podeEditar={podeEditar} busca={sp.q ?? ""} situacao={sp.situacao ?? ""} hojeIso={hojeIso} />
        </>
      )}
    </div>
  );
}
