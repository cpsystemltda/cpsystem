import type { StatusProcessamentoExtrato, FonteExtrato } from "@/generated/prisma/client";

type ExtratoItem = {
  id: string;
  nomeArquivo: string;
  status: StatusProcessamentoExtrato;
  fonte: FonteExtrato;
  bancoDetectado: string | null;
  periodoInicio: Date | null;
  periodoFim: Date | null;
  totalCreditos: number;
  totalDebitos: number;
  totalTransacoes: number;
  qtdMatchAlto: number;
  qtdMatchMedio: number;
  qtdSemMatch: number;
  criadoEm: Date;
  erroMsg: string | null;
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dt(d: Date | null) {
  return d ? d.toLocaleDateString("pt-BR") : "-";
}
function statusLabel(s: StatusProcessamentoExtrato): { texto: string; cor: string } {
  switch (s) {
    case "RECEBIDO":    return { texto: "Recebido",     cor: "bg-slate-100 text-slate-700" };
    case "EXTRAINDO":   return { texto: "Extraindo…",   cor: "bg-blue-100 text-blue-800" };
    case "EXTRAIDO":    return { texto: "Extraído",     cor: "bg-blue-100 text-blue-800" };
    case "CONCILIANDO": return { texto: "Conciliando…", cor: "bg-blue-100 text-blue-800" };
    case "CONCLUIDO":   return { texto: "Concluído",    cor: "bg-emerald-100 text-emerald-800" };
    case "ERRO":        return { texto: "Erro",         cor: "bg-red-100 text-red-800" };
  }
}
function fonteLabel(f: FonteExtrato): string {
  switch (f) {
    case "WEB_UPLOAD":       return "Upload web";
    case "WHATSAPP_INBOUND": return "Via WhatsApp";
    case "MANUAL_ADMIN":     return "Admin";
  }
}

export function ListaExtratos({ extratos }: { extratos: ExtratoItem[] }) {
  if (extratos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Nenhum extrato importado ainda. Suba um PDF acima pra começar.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-4 py-3">Arquivo</th>
            <th className="px-4 py-3">Banco</th>
            <th className="px-4 py-3">Período</th>
            <th className="px-4 py-3">Créditos</th>
            <th className="px-4 py-3">Match</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {extratos.map((e) => {
            const st = statusLabel(e.status);
            return (
              <tr key={e.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{e.nomeArquivo}</div>
                  <div className="text-xs text-slate-500">
                    {fonteLabel(e.fonte)} · {e.criadoEm.toLocaleString("pt-BR")}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{e.bancoDetectado ?? "-"}</td>
                <td className="px-4 py-3 text-slate-700">
                  {dt(e.periodoInicio)} → {dt(e.periodoFim)}
                </td>
                <td className="px-4 py-3 text-emerald-700">{brl(e.totalCreditos)}</td>
                <td className="px-4 py-3 text-xs text-slate-700">
                  <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">✓ {e.qtdMatchAlto}</span>
                  <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">? {e.qtdMatchMedio}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">– {e.qtdSemMatch}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${st.cor}`}>
                    {st.texto}
                  </span>
                  {e.erroMsg ? <div className="mt-1 text-xs text-red-600">{e.erroMsg.slice(0, 80)}</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
