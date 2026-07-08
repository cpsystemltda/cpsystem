"use client";

import { useActionState } from "react";
import { brl, formatarCpf } from "@/lib/validators";
import {
  cadastrarAnalistaAction,
  vincularEmbaixadorAction,
  calcularComissoesDoMesAction,
  marcarComissaoPagaAction,
} from "@/app/actions/embaixadores";

type Analista = {
  id: string;
  nomeCompleto: string;
  cpf: string;
  telefone: string;
  email: string;
  pix: string | null;
  ativo: boolean;
  totalAtivos: number;
};

type Comissao = {
  id: string;
  competencia: string;
  valor: number;
  paga: boolean;
  pagaEm: Date | null;
  tier: string;
  percentual: number;
  analista: { nomeCompleto: string };
  conta: { plano: string };
};

const COR_TIER: Record<string, string> = {
  BRONZE: "bg-amber-100 text-amber-800",
  PRATA: "bg-slate-200 text-slate-700",
  OURO: "bg-yellow-100 text-yellow-800",
  DIAMOND: "bg-violet-100 text-violet-800",
};

export function EmbaixadoresClient({
  analistas,
  comissoes,
  podeAdministrar,
}: {
  analistas: Analista[];
  comissoes: Comissao[];
  podeAdministrar: boolean;
}) {
  const [stateNovo, actionNovo] = useActionState(cadastrarAnalistaAction, null);
  const [stateVinc, actionVinc] = useActionState(vincularEmbaixadorAction, null);
  const [stateCalc, actionCalc] = useActionState(calcularComissoesDoMesAction, null);

  const totalPagar = comissoes.filter((c) => !c.paga).reduce((s, c) => s + c.valor, 0);
  const totalPago = comissoes.filter((c) => c.paga).reduce((s, c) => s + c.valor, 0);

  return (
    <div className="space-y-8">
      {/* Vincular embaixador na minha conta */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Vincular meu embaixador</h2>
        <p className="mt-1 text-xs text-slate-600">
          Se você foi indicado por um analista de licitação, vincule-o aqui — ele receberá comissão recorrente sobre sua assinatura.
        </p>
        <form action={actionVinc} className="mt-3 flex items-end gap-3">
          <select name="analistaId" className="rounded-md border border-slate-300 px-3 py-2 text-sm flex-1">
            <option value="">— Sem embaixador —</option>
            {analistas.filter((a) => a.ativo).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nomeCompleto} ({formatarCpf(a.cpf)})
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Salvar vínculo
          </button>
        </form>
        {stateVinc?.ok && <p className="mt-2 text-xs text-emerald-700">Vínculo atualizado.</p>}
        {stateVinc?.erro && <p className="mt-2 text-xs text-red-700">{stateVinc.erro}</p>}
      </section>

      {/* Cadastro de analista (admin) */}
      {podeAdministrar && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cadastrar analista parceiro</h2>
          <form action={actionNovo} className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <Campo label="Nome completo" name="nomeCompleto" required />
            <Campo label="CPF" name="cpf" required />
            <Campo label="Telefone" name="telefone" required />
            <Campo label="E-mail" name="email" type="email" required />
            <Campo label="Endereço" name="endereco" required colSpan={2} />
            <Campo label="Banco" name="banco" />
            <Campo label="Agência" name="agencia" />
            <Campo label="Conta" name="contaCorrente" />
            <Campo label="PIX" name="pix" />
            <Campo label="Razão social (se PJ)" name="razaoSocial" />
            <Campo label="CNPJ (se PJ)" name="cnpj" />
            <Campo label="Link de divulgação" name="divulgacaoUrl" colSpan={2} />
            {stateNovo?.erro && <div className="col-span-3 text-xs text-red-700">{stateNovo.erro}</div>}
            {stateNovo?.ok && <div className="col-span-3 text-xs text-emerald-700">Analista cadastrado.</div>}
            <button type="submit" className="col-span-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              Cadastrar
            </button>
          </form>
        </section>
      )}

      {/* Lista de analistas com tier */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Analistas parceiros ({analistas.length})
        </h2>
        {analistas.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum analista parceiro cadastrado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">CPF</th>
                  <th className="px-3 py-2 text-left">Contato</th>
                  <th className="px-3 py-2 text-right">Vínculos ativos</th>
                  <th className="px-3 py-2 text-right">Recorrente/mês</th>
                </tr>
              </thead>
              <tbody>
                {analistas.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{a.nomeCompleto}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatarCpf(a.cpf)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {a.email}
                      <br />
                      {a.telefone}
                    </td>
                    <td className="px-3 py-2 text-right">{a.totalAtivos}</td>
                    <td className="px-3 py-2 text-right font-medium">{brl(a.totalAtivos * 29.9)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Comissões */}
      {podeAdministrar && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Comissões</h2>
              <p className="mt-1 text-xs text-slate-600">
                A pagar: <strong>{brl(totalPagar)}</strong> · Pago: <strong>{brl(totalPago)}</strong>
              </p>
            </div>
            <form action={actionCalc}>
              <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
                Calcular comissões do mês atual
              </button>
            </form>
          </div>
          {stateCalc?.ok && <p className="mt-2 text-xs text-emerald-700">Comissões recalculadas.</p>}

          {comissoes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma comissão calculada.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Competência</th>
                    <th className="px-3 py-2 text-left">Analista</th>
                    <th className="px-3 py-2 text-left">Plano</th>
                    <th className="px-3 py-2 text-left">Tier</th>
                    <th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {comissoes.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs">{c.competencia}</td>
                      <td className="px-3 py-2">{c.analista.nomeCompleto}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{c.conta.plano}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR_TIER[c.tier]}`}>{c.tier}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{c.percentual}%</td>
                      <td className="px-3 py-2 text-right font-medium">{brl(c.valor)}</td>
                      <td className="px-3 py-2">
                        {c.paga ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                            Pago em {c.pagaEm?.toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">A pagar</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!c.paga && (
                          <form action={marcarComissaoPagaAction}>
                            <input type="hidden" name="comissaoId" value={c.id} />
                            <button type="submit" className="text-xs text-blue-600 hover:underline">
                              Marcar como paga
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Campo({
  label,
  colSpan = 1,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; colSpan?: 1 | 2 | 3 }) {
  const cls = colSpan === 1 ? "col-span-1" : colSpan === 2 ? "col-span-2" : "col-span-3";
  return (
    <label className={`flex flex-col gap-1 ${cls}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input {...props} className="rounded border border-slate-300 px-2 py-1 text-sm" />
    </label>
  );
}
