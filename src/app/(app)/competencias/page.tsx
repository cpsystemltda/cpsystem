import Link from "next/link";
import { CalendarDays, AlertTriangle, ChevronLeft } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { filtroEmpresaWhere } from "@/lib/empresaContexto";
import { listarCompetenciasDaConta } from "@/lib/competenciasServer";
import { ORDEM_STATUS, ROTULO_STATUS, dataBrDia, faturadaOuAlem, rotuloCompetencia, type StatusCompetencia } from "@/lib/competencias";
import { brl } from "@/lib/validators";
import { ChipStatusCompetencia } from "@/components/abas/CompetenciasTab";
import { AvisoModuloTerceirizacao } from "@/components/AvisoModuloTerceirizacao";
import { avisoModuloDaConta } from "@/lib/faixasTerceirizacaoServer";


/**
 * Competências de mão de obra de todos os contratos da conta (ESP-004 —
 * "filtro Competências de mão de obra" do módulo Fornecimento/Execução).
 */
export default async function CompetenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; contrato?: string; mes?: string; atencao?: string }>;
}) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const filtro = await filtroEmpresaWhere(usuario.contaId);
  const aviso = await avisoModuloDaConta(usuario.conta); // ESP-011
  let lista = aviso.acesso === "BLOQUEADO" ? [] : await listarCompetenciasDaConta(filtro);

  const status = ORDEM_STATUS.includes(sp.status as StatusCompetencia) ? (sp.status as StatusCompetencia) : "";
  if (status) lista = lista.filter((c) => c.status === status);
  if (sp.contrato) lista = lista.filter((c) => c.contratoId === sp.contrato);
  if (sp.mes && /^\d{4}-\d{2}$/.test(sp.mes)) lista = lista.filter((c) => c.competencia === sp.mes);
  if (sp.atencao === "1") lista = lista.filter((c) => c.status === "A_CONFIRMAR" || c.empenhoInsuficiente || (c.atrasoDias > 0 && c.status !== "PAGA"));

  const contratos = [...new Map(lista.map((c) => [c.contratoId, c.contratoNumero])).entries()];
  const totais = lista.reduce(
    (t, c) => {
      t.previsto += c.valorPrevisto;
      if (faturadaOuAlem(c.status)) t.faturado += c.valorFaturado;
      if (c.valorRecebido != null) t.recebido += c.valorRecebido;
      return t;
    },
    { previsto: 0, faturado: 0, recebido: 0 },
  );

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <Link href="/execucao" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Fornecimento/Execução
      </Link>
      <AvisoModuloTerceirizacao acesso={aviso.acesso} perdidaEm={aviso.perdidaEm} estimativaTrial={aviso.estimativaTrial} />
      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-50">
          <CalendarDays className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Competências de mão de obra</h1>
          <p className="mt-1 text-sm text-slate-600">Execução mensal dos contratos com dedicação exclusiva ou predominância de mão de obra: previsto, faturado, líquido e pagamento de cada mês.</p>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3 text-xs" method="get">
        <label className="block">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <select name="status" defaultValue={status} className="mt-1">
            <option value="">Todos</option>
            {ORDEM_STATUS.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Contrato</span>
          <select name="contrato" defaultValue={sp.contrato ?? ""} className="mt-1">
            <option value="">Todos</option>
            {contratos.map(([id, numero]) => (
              <option key={id} value={id}>
                {numero}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Mês</span>
          <input name="mes" type="month" defaultValue={sp.mes ?? ""} className="mt-1" />
        </label>
        <label className="inline-flex items-center gap-2 pb-2">
          <input type="checkbox" name="atencao" value="1" defaultChecked={sp.atencao === "1"} /> só as que pedem atenção
        </label>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs sm:max-w-xl">
        {[
          ["Previsto", brl(totais.previsto)],
          ["Faturado", brl(totais.faturado)],
          ["Recebido", brl(totais.recebido)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      {lista.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
          Nenhuma competência com esses filtros. Elas nascem nos contratos de mão de obra com valores mensais confirmados.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Competência</th>
                <th className="px-3 py-2 text-left font-semibold">Contrato</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Previsto</th>
                <th className="px-3 py-2 text-right font-semibold">Faturado</th>
                <th className="px-3 py-2 text-right font-semibold">Líquido</th>
                <th className="px-3 py-2 text-right font-semibold">Recebido</th>
                <th className="px-3 py-2 text-left font-semibold">Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-2">
                    <Link href={`/competencias/${c.id}`} className="font-semibold text-slate-900 hover:underline">
                      {rotuloCompetencia(c.competencia)}
                    </Link>
                    {c.tipo === "COMPLEMENTAR" && <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-800">compl.</span>}
                    {c.empenhoInsuficiente && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                        <AlertTriangle className="h-3 w-3" /> empenho
                      </span>
                    )}
                    <p className="text-[11px] text-slate-500">
                      {dataBrDia(c.periodoInicio)} a {dataBrDia(c.periodoFim)}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Link href={`/contratos/${c.contratoId}?aba=competencias`} className="text-blue-700 hover:underline">
                      {c.contratoNumero}
                    </Link>
                    <p className="truncate text-[11px] text-slate-500" title={c.orgaoNome}>
                      {c.orgaoNome}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <ChipStatusCompetencia status={c.status} atraso={c.atrasoDias} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(c.valorPrevisto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{faturadaOuAlem(c.status) ? brl(c.valorFaturado) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{faturadaOuAlem(c.status) ? brl(c.valorLiquidoEsperado) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.valorRecebido != null ? brl(c.valorRecebido) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.status === "PAGA" ? (
                      <span className={c.pagaComAtraso ? "text-amber-700" : "text-emerald-700"}>{c.pagaComAtraso ? `com ${c.atrasoDias}d de atraso` : "no prazo"}</span>
                    ) : c.prazoPagamento ? (
                      <span className={c.atrasoDias > 0 ? "font-semibold text-red-700" : "text-slate-700"}>{c.atrasoDias > 0 ? `vencido há ${c.atrasoDias}d` : dataBrDia(c.prazoPagamento)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
