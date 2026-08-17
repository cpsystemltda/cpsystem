"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

type Cliente = {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  responsavel: string | null;
  email: string | null;
  telefone: string | null;
  linha: number;
  pendencias: string[];
  jaCadastrada: string | null;
};

type Resultado = {
  ok: true;
  linhasLidas: number;
  clientes: Cliente[];
  perguntas: string[];
  colunasInterpretadas: Record<string, string>;
};

function formatarCnpj(v: string | null) {
  if (!v || v.length !== 14) return v ?? "—";
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

export function ImportarClientesClient() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviar(arquivo: File) {
    setCarregando(true);
    setErro(null);
    setRes(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await fetch("/api/analista/importar-clientes", { method: "POST", body: fd });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados?.erro || "Falha ao processar a planilha.");
      setRes(dados as Resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  const prontos = res?.clientes.filter((c) => c.pendencias.length === 0 && !c.jaCadastrada) ?? [];
  const comPendencia = res?.clientes.filter((c) => c.pendencias.length > 0) ?? [];
  const duplicadas = res?.clientes.filter((c) => c.jaCadastrada) ?? [];

  return (
    <div className="mt-6 space-y-6">
      {/* Upload */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 text-violet-600" size={22} />
          <div>
            <h2 className="text-base font-bold text-slate-900">Suba a sua planilha</h2>
            <p className="text-xs text-slate-500">
              Do jeito que você já mantém — não precisa arrumar as colunas nem seguir modelo.
              A leitura entende cabeçalhos com nomes diferentes e ignora títulos e totais.
              Aceita .xlsx, .xls ou .csv, até 5 MB.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviar(f);
          }}
        />
        <button
          type="button"
          disabled={carregando}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <UploadCloud size={16} />
          {carregando ? "Lendo a planilha…" : "Escolher planilha"}
        </button>

        {erro && (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertCircle size={15} /> {erro}
          </p>
        )}
      </section>

      {res && (
        <>
          {/* O que a leitura entendeu de cada coluna */}
          {Object.keys(res.colunasInterpretadas).length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Como as colunas foram lidas</h3>
              <p className="mb-3 text-xs text-slate-500">
                Confira antes de confirmar — se algo foi entendido errado, é aqui que aparece.
              </p>
              <ul className="grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
                {Object.entries(res.colunasInterpretadas).map(([col, sig]) => (
                  <li key={col}>
                    <span className="font-semibold">{col}</span> → {sig}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Perguntas: o que ficou ambiguo na planilha inteira */}
          {res.perguntas.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <HelpCircle size={16} /> Preciso confirmar com você
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-amber-900">
                {res.perguntas.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Resumo */}
          <section className="grid gap-4 sm:grid-cols-3">
            <Bloco titulo="Prontos para importar" valor={prontos.length} tom="verde" />
            <Bloco titulo="Precisam de ajuste" valor={comPendencia.length} tom="ambar" />
            <Bloco titulo="Já cadastradas" valor={duplicadas.length} tom="cinza" />
          </section>

          {/* Lista */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-900">
                {res.clientes.length} empresa{res.clientes.length === 1 ? "" : "s"} encontrada
                {res.clientes.length === 1 ? "" : "s"} em {res.linhasLidas} linhas
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Linha</th>
                    <th className="px-4 py-2">Empresa</th>
                    <th className="px-4 py-2">CNPJ</th>
                    <th className="px-4 py-2">Contato</th>
                    <th className="px-4 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {res.clientes.map((c, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-xs text-slate-500">{c.linha || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{c.razaoSocial}</div>
                        {c.nomeFantasia && (
                          <div className="text-xs text-slate-500">{c.nomeFantasia}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-700">
                        {formatarCnpj(c.cnpj)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {c.responsavel && <div>{c.responsavel}</div>}
                        {c.email && <div>{c.email}</div>}
                        {c.telefone && <div>{c.telefone}</div>}
                        {!c.responsavel && !c.email && !c.telefone && "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.jaCadastrada ? (
                          <span className="text-xs font-semibold text-slate-500">
                            já cadastrada
                          </span>
                        ) : c.pendencias.length ? (
                          <span className="text-xs text-amber-700">{c.pendencias.join("; ")}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={13} /> pronta
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            Nada foi gravado ainda — esta é só a leitura. A confirmação que cria as empresas na
            sua carteira entra na próxima etapa.
          </p>
        </>
      )}
    </div>
  );
}

function Bloco({ titulo, valor, tom }: { titulo: string; valor: number; tom: "verde" | "ambar" | "cinza" }) {
  const cores = {
    verde: "border-emerald-200 bg-emerald-50 text-emerald-800",
    ambar: "border-amber-200 bg-amber-50 text-amber-800",
    cinza: "border-slate-200 bg-slate-50 text-slate-700",
  }[tom];
  return (
    <div className={`rounded-2xl border p-5 ${cores}`}>
      <div className="text-3xl font-extrabold tabular-nums">{valor}</div>
      <div className="mt-1 text-xs font-semibold">{titulo}</div>
    </div>
  );
}
