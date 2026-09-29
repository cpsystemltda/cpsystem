import Link from "next/link";
import { Landmark, CircleCheck, CircleAlert, FileWarning } from "lucide-react";

/**
 * O que o órgão publica sobre o cliente, dentro da conciliação.
 *
 * Regina, 28/09/2026: *"eu quero que exista, dentro da conciliação bancária,
 * para os clientes intermediário e premium."*
 *
 * A conciliação por extrato responde "o dinheiro entrou?". Esta metade
 * responde "o órgão reconhece que deve, e mandou pagar?" — que é a pergunta
 * que hoje só se responde ligando para o órgão.
 *
 * As duas etiquetas que fazem o trabalho:
 *
 * · **nota publicada e não cadastrada** — o órgão registrou uma nota que não
 *   está no sistema. É trabalho que o cliente já fez e ainda não lançou.
 * · **pagamento sem empenho reconhecido** — o órgão pagou contra um empenho
 *   que o sistema não conhece. É dinheiro entrando sem controle do lado dele.
 */

type NotaPortal = {
  id: string;
  numero: string;
  serie: string | null;
  valor: number;
  dataEmissao: Date;
  orgaoDestinatario: string | null;
  ultimoEvento: string | null;
  notaFiscalId: string | null;
};

type PagamentoPortal = {
  id: string;
  codigoResumido: string | null;
  data: Date;
  valor: number;
  orgao: string | null;
  observacao: string | null;
  empenhoId: string | null;
  empenhoNumero: string | null;
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Data do portal é DIA. Sem `timeZone: "UTC"` volta um dia — ver diaVigencia.ts. */
function dia(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * Os totais vêm somados no banco, não da lista exibida.
 *
 * A tela mostra as 40 mais recentes; contar o array faria o cartão dizer "40
 * notas" para quem tem 57. Número errado na cara do cliente é pior do que
 * número nenhum.
 */
type TotaisPortal = {
  notas: number;
  notasValor: number;
  naoCadastradas: number;
  naoCadastradasValor: number;
  pagamentos: number;
  pagamentosValor: number;
};

export function PainelPortal({
  notas,
  pagamentos,
  atualizadoEm,
  totais,
}: {
  notas: NotaPortal[];
  pagamentos: PagamentoPortal[];
  atualizadoEm: Date | null;
  totais: TotaisPortal;
}) {
  const semEmpenho = pagamentos.filter((p) => !p.empenhoId);

  if (totais.notas === 0 && totais.pagamentos === 0) {
    return (
      <section className="mt-10">
        <Cabecalho atualizadoEm={atualizadoEm} />
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Ainda não encontramos registros desta empresa no Portal da Transparência federal.
          <p className="mt-2 text-xs text-slate-500">
            A leitura roda todo dia de madrugada. Vale lembrar que o portal federal cobre
            órgãos da União — compras de prefeitura, governo estadual ou do sistema S não
            aparecem por aqui, e continuam pelo extrato bancário.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <Cabecalho atualizadoEm={atualizadoEm} />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Cartao
          titulo="Notas publicadas pelo órgão"
          valor={`${totais.notas}`}
          detalhe={brl(totais.notasValor)}
          icone={<Landmark className="h-4 w-4 text-slate-500" />}
        />
        <Cartao
          titulo="Ainda não cadastradas aqui"
          valor={`${totais.naoCadastradas}`}
          detalhe={totais.naoCadastradas > 0 ? brl(totais.naoCadastradasValor) : "tudo em dia"}
          alerta={totais.naoCadastradas > 0}
          icone={<FileWarning className="h-4 w-4 text-amber-600" />}
        />
        <Cartao
          titulo="Pagamentos registrados"
          valor={`${totais.pagamentos}`}
          detalhe={brl(totais.pagamentosValor)}
          icone={<CircleCheck className="h-4 w-4 text-emerald-600" />}
        />
      </div>

      {notas.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-800">Notas fiscais no portal</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2">Emissão</th>
                  <th className="px-3 py-2">Órgão</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">No sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notas.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {n.numero}
                      {n.serie ? <span className="text-slate-400">/{n.serie}</span> : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{dia(n.dataEmissao)}</td>
                    <td className="px-3 py-2 text-slate-600">{n.orgaoDestinatario ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">{brl(n.valor)}</td>
                    <td className="px-3 py-2">
                      {n.notaFiscalId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CircleCheck className="h-3 w-3" /> cadastrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <CircleAlert className="h-3 w-3" /> não cadastrada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totais.notas > notas.length && (
            <p className="mt-2 text-xs text-slate-500">
              Mostrando as {notas.length} mais recentes de {totais.notas}.
            </p>
          )}
        </div>
      )}

      {pagamentos.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-800">Pagamentos registrados pelo órgão</h3>
          <p className="mt-1 text-xs text-slate-500">
            É o que o órgão declara ter pago. Cruze com o extrato para confirmar que entrou na conta.
          </p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Órgão</th>
                  <th className="px-3 py-2">Empenho</th>
                  <th className="px-3 py-2 text-right">Valor pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagamentos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 tabular-nums text-slate-600">{dia(p.data)}</td>
                    <td className="px-3 py-2 text-slate-600">{p.orgao ?? "—"}</td>
                    <td className="px-3 py-2">
                      {p.empenhoId ? (
                        <Link
                          href={`/execucao/${p.empenhoId}`}
                          className="font-medium text-slate-800 underline decoration-slate-300 hover:decoration-slate-600"
                        >
                          {p.empenhoNumero}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <CircleAlert className="h-3 w-3" /> fora do sistema
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">{brl(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {semEmpenho.length > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              {semEmpenho.length} pagamento(s) sem empenho correspondente aqui. Pode ser contratação
              que ainda não foi lançada no sistema.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Cabecalho({ atualizadoEm }: { atualizadoEm: Date | null }) {
  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900">Conferência pelo órgão</h2>
      <p className="mt-1 text-sm text-slate-600">
        O que o Portal da Transparência federal publica sobre o seu CNPJ — notas reconhecidas e
        pagamentos registrados. Atualizamos todo dia de madrugada
        {atualizadoEm ? `; última leitura em ${atualizadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}.
      </p>
    </>
  );
}

function Cartao({
  titulo,
  valor,
  detalhe,
  icone,
  alerta,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  icone: React.ReactNode;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${alerta ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icone}
        {titulo}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>
    </div>
  );
}
