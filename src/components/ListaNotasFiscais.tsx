import { FileText, Download, Clock, CircleAlert } from "lucide-react";

/**
 * As notas fiscais da assinatura — a mesma lista para o cliente e para nós.
 *
 * Regina, 15/10/2026: *"vamos verificar uma área que ele também dentro do
 * sistema consiga ter acesso a todas as notas fiscais, e a gente como
 * administrador e superadministrador também."*
 *
 * Antes disso a nota só existia no WhatsApp: ia uma vez, em PDF, e quem
 * apagasse a conversa ou trocasse de aparelho ficava sem. No painel interno
 * aparecia apenas a última nota de cada cliente, perdida numa coluna de
 * tabela.
 *
 * Um componente só para os dois lugares, de propósito: nota fiscal é documento
 * contábil, e a lista que o cliente vê tem de ser exatamente a que nós vemos.
 * Duas telas separadas divergiriam, e aí a conversa vira a palavra de um
 * contra a do outro.
 */

export type NotaFiscalLinha = {
  id: string;
  competencia: string;
  valor: number;
  pagaEm: Date | null;
  nfseNumero: string | null;
  nfseStatus: string | null;
  nfsePdfUrl: string | null;
  /** Só no painel interno. */
  cliente?: string | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function competenciaPorExtenso(c: string) {
  const [ano, mes] = (c || "").split("-");
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const i = Number(mes) - 1;
  return meses[i] ? `${meses[i]} de ${ano}` : c;
}

/**
 * O estado da nota em português de gente.
 *
 * Os nomes crus do provedor — SCHEDULED, SYNCHRONIZED, AUTHORIZED — não dizem
 * nada a quem está procurando o PDF para a contabilidade.
 */
function situacao(status: string | null, temPdf: boolean) {
  if (temPdf) return { texto: "Emitida", cor: "text-emerald-700 bg-emerald-50", icone: FileText };
  switch ((status || "").toUpperCase()) {
    case "AUTHORIZED":
      return { texto: "Emitida", cor: "text-emerald-700 bg-emerald-50", icone: FileText };
    case "SCHEDULED":
    case "SYNCHRONIZED":
      return { texto: "Em emissão", cor: "text-amber-800 bg-amber-50", icone: Clock };
    case "CANCELED":
      return { texto: "Cancelada", cor: "text-slate-600 bg-slate-100", icone: CircleAlert };
    case "ERROR":
      return { texto: "Falhou", cor: "text-red-700 bg-red-50", icone: CircleAlert };
    default:
      return { texto: "Em emissão", cor: "text-amber-800 bg-amber-50", icone: Clock };
  }
}

export function ListaNotasFiscais({
  linhas,
  mostrarCliente = false,
}: {
  linhas: NotaFiscalLinha[];
  mostrarCliente?: boolean;
}) {
  if (linhas.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        Nenhuma nota fiscal por aqui ainda.
        <p className="mt-2 text-xs text-slate-500">
          A nota é emitida depois que o pagamento é confirmado, e aparece aqui automaticamente —
          junto com o PDF para baixar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {mostrarCliente && <th className="px-4 py-3 font-semibold">Cliente</th>}
            <th className="px-4 py-3 font-semibold">Competência</th>
            <th className="px-4 py-3 font-semibold">Nota</th>
            <th className="px-4 py-3 font-semibold">Pagamento</th>
            <th className="px-4 py-3 text-right font-semibold">Valor</th>
            <th className="px-4 py-3 font-semibold">Situação</th>
            <th className="px-4 py-3 text-right font-semibold">PDF</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((l) => {
            const s = situacao(l.nfseStatus, !!l.nfsePdfUrl);
            const Icone = s.icone;
            return (
              <tr key={l.id} className="hover:bg-slate-50">
                {mostrarCliente && (
                  <td className="px-4 py-3 font-medium text-slate-800">{l.cliente ?? "—"}</td>
                )}
                <td className="px-4 py-3 text-slate-700">{competenciaPorExtenso(l.competencia)}</td>
                <td className="px-4 py-3 tabular-nums text-slate-700">
                  {l.nfseNumero ? `nº ${l.nfseNumero}` : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600">
                  {l.pagaEm
                    ? l.pagaEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-800">{brl(l.valor)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cor}`}>
                    <Icone className="h-3 w-3" /> {s.texto}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {l.nfsePdfUrl ? (
                    <a
                      href={l.nfsePdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
