"use client";

import { useState, useTransition } from "react";
import { Phone, Check, Loader2 } from "lucide-react";
import { atualizarLeadAction } from "@/app/actions/prospeccao";

export type LeadNaTela = {
  id: string;
  empresa: string;
  uf: string;
  telefone: string | null;
  email: string | null;
  venceEm: string;
  valorDoContrato: number;
  valorTotal: number;
  qtdContratos: number;
  perfil: string | null;
  alvoIdeal: boolean;
  situacao: string;
  anotacoes: string | null;
  atualizadoPorNome: string | null;
  atualizadoEm: string | null;
  dataPrimeiroContato: string | null;
  dataUltimoContato: string | null;
  teveRetorno: boolean;
  retornarEm: string | null;
  contatoNome: string | null;
  /** Cruzado pelo CNPJ: a empresa já entrou no CP System? */
  noSistema: "TRIAL" | "CLIENTE" | "OUTRO" | null;
};

const SITUACOES: [string, string][] = [
  ["NAO_CONTATADO", "Não contatado"],
  ["TENTOU_NAO_FALOU", "Tentei, não falei"],
  ["FALOU_COM_DECISOR", "Falei com o decisor"],
  ["DEMONSTRACAO_MARCADA", "Demonstração marcada"],
  ["CLIENTE", "Fechou — é cliente"],
  ["RETORNAR_DEPOIS", "Retornar depois"],
  ["NAO_E_CLIENTE", "Não é cliente"],
  ["NAO_PERTURBAR", "Não perturbar"],
];

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function diasAte(iso: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
}

function selo(dias: number): { cor: string; texto: string } {
  if (dias < 0) return { cor: "bg-red-100 text-red-800", texto: `venceu há ${-dias}d` };
  if (dias === 0) return { cor: "bg-red-100 text-red-800", texto: "vence HOJE" };
  if (dias <= 7) return { cor: "bg-red-100 text-red-800", texto: `${dias} dias` };
  if (dias <= 15) return { cor: "bg-amber-100 text-amber-800", texto: `${dias} dias` };
  return { cor: "bg-emerald-100 text-emerald-800", texto: `${dias} dias` };
}

/**
 * Um card por empresa: o dado que abre a ligação, o telefone clicável, a
 * situação e as anotações.
 *
 * Salva no banco a cada mudança — sem botão de salvar, porque closer no meio de
 * uma ligação não clica em salvar, e anotação perdida é ligação perdida.
 */
function CardLead({ lead }: { lead: LeadNaTela }) {
  const [situacao, setSituacao] = useState(lead.situacao);
  const [nota, setNota] = useState(lead.anotacoes ?? "");
  const [retorno, setRetorno] = useState(lead.teveRetorno);
  const [retornarEm, setRetornarEm] = useState(lead.retornarEm ? lead.retornarEm.slice(0, 10) : "");
  const [quem, setQuem] = useState(lead.contatoNome ?? "");
  const [marca, setMarca] = useState<string>("");
  const [pendente, iniciar] = useTransition();

  function salvar(campos: {
    situacao?: string; anotacoes?: string; teveRetorno?: boolean;
    retornarEm?: string; contatoNome?: string;
  }) {
    const fd = new FormData();
    fd.set("id", lead.id);
    if (campos.situacao !== undefined) fd.set("situacao", campos.situacao);
    if (campos.anotacoes !== undefined) fd.set("anotacoes", campos.anotacoes);
    if (campos.teveRetorno !== undefined) fd.set("teveRetorno", campos.teveRetorno ? "1" : "0");
    if (campos.retornarEm !== undefined) fd.set("retornarEm", campos.retornarEm);
    if (campos.contatoNome !== undefined) fd.set("contatoNome", campos.contatoNome);
    iniciar(async () => {
      const r = await atualizarLeadAction(null, fd);
      setMarca(r?.erro ? r.erro : "salvo");
      if (!r?.erro) setTimeout(() => setMarca(""), 2200);
    });
  }

  const dias = diasAte(lead.venceEm);
  const s = selo(dias);
  const feito = situacao !== "NAO_CONTATADO";

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        feito ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
      } ${dias <= 7 ? "border-l-4 border-l-red-500" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`rounded-md px-2 py-1 text-[11px] font-bold tabular-nums ${s.cor}`}>
          {s.texto}
        </span>
        <span className="text-[15px] font-bold text-slate-900">{lead.empresa}</span>
        {lead.alvoIdeal && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            alvo ideal
          </span>
        )}
        <span className="font-mono text-xs font-semibold text-slate-500">{lead.uf}</span>
        {lead.noSistema === "TRIAL" && (
          <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
            já está no teste
          </span>
        )}
        {lead.noSistema === "CLIENTE" && (
          <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            já é cliente
          </span>
        )}
        {lead.telefone && (
          <a
            href={`tel:+55${lead.telefone.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 font-mono text-xs font-bold text-white hover:bg-blue-700"
          >
            <Phone className="h-3 w-3" /> {lead.telefone}
          </a>
        )}
      </div>

      <p className="mt-2 text-[13px] text-slate-600">
        Contrato vencendo: <strong className="text-slate-800">{brl(lead.valorDoContrato)}</strong>
        {lead.valorTotal !== lead.valorDoContrato && <> · total contratado {brl(lead.valorTotal)}</>}
        {" · "}
        {lead.qtdContratos} {lead.qtdContratos === 1 ? "contrato" : "contratos"}
        {lead.perfil && <> · {lead.perfil}</>}
        {lead.email && <> · <span className="font-mono text-[11.5px] text-slate-500">{lead.email}</span></>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={situacao}
          onChange={(e) => {
            setSituacao(e.target.value);
            salvar({ situacao: e.target.value });
          }}
          aria-label={`Situação de ${lead.empresa}`}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          {SITUACOES.map(([v, rot]) => (
            <option key={v} value={v}>
              {rot}
            </option>
          ))}
        </select>
        {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
        {marca === "salvo" && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
            <Check className="h-3 w-3" /> salvo
          </span>
        )}
        {marca && marca !== "salvo" && (
          <span className="text-[11.5px] font-semibold text-red-600">{marca}</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] text-slate-600">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={retorno}
            onChange={(e) => {
              setRetorno(e.target.checked);
              salvar({ teveRetorno: e.target.checked });
            }}
            className="h-3.5 w-3.5 rounded border-slate-400"
          />
          Teve retorno
        </label>
        <label className="inline-flex items-center gap-1.5">
          Retornar em
          <input
            type="date"
            value={retornarEm}
            onChange={(e) => {
              setRetornarEm(e.target.value);
              salvar({ retornarEm: e.target.value });
            }}
            className="rounded-md border border-slate-300 px-1.5 py-1 text-[12.5px]"
          />
        </label>
        <input
          value={quem}
          onChange={(e) => setQuem(e.target.value)}
          onBlur={() => { if (quem !== (lead.contatoNome ?? "")) salvar({ contatoNome: quem }); }}
          placeholder="Falei com quem?"
          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-[12.5px]"
        />
        {lead.dataPrimeiroContato && (
          <span className="text-slate-400">
            1º contato em {new Date(lead.dataPrimeiroContato).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onBlur={() => {
          if (nota !== (lead.anotacoes ?? "")) salvar({ anotacoes: nota });
        }}
        placeholder="Com quem falou, em que pergunta travou, o que usa hoje, quando retornar…"
        rows={2}
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      {lead.atualizadoPorNome && lead.atualizadoEm && (
        <p className="mt-1.5 text-[11.5px] text-slate-400">
          Última atualização por {lead.atualizadoPorNome} em{" "}
          {new Date(lead.atualizadoEm).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}

export function ListaProspeccao({ leads }: { leads: LeadNaTela[] }) {
  const [filtro, setFiltro] = useState<
    "quentes" | "pendentes" | "retornar" | "andamento" | "todos"
  >("quentes");
  const [busca, setBusca] = useState("");

  const hojeIso = new Date().toISOString().slice(0, 10);
  const visiveis = leads
    .filter((l) => {
      if (filtro === "pendentes") return l.situacao === "NAO_CONTATADO";
      if (filtro === "quentes") return diasAte(l.venceEm) <= 15 && l.situacao === "NAO_CONTATADO";
      if (filtro === "retornar") return !!l.retornarEm && l.retornarEm.slice(0, 10) <= hojeIso;
      if (filtro === "andamento")
        return ["FALOU_COM_DECISOR", "DEMONSTRACAO_MARCADA", "RETORNAR_DEPOIS"].includes(l.situacao);
      return true;
    })
    .filter((l) =>
      busca.trim()
        ? (l.empresa + " " + (l.perfil ?? "") + " " + l.uf).toLowerCase().includes(busca.toLowerCase())
        : true,
    )
    .slice(0, filtro === "todos" && !busca.trim() ? 120 : 500);

  const botao = (v: typeof filtro, rotulo: string, n: number) => (
    <button
      key={v}
      type="button"
      onClick={() => setFiltro(v)}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        filtro === v
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:border-blue-400"
      }`}
    >
      {rotulo} ({n})
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {botao(
          "quentes",
          "Ligar hoje",
          leads.filter((l) => diasAte(l.venceEm) <= 15 && l.situacao === "NAO_CONTATADO").length,
        )}
        {botao(
          "retornar",
          "Retorno vencido",
          leads.filter((l) => !!l.retornarEm && l.retornarEm.slice(0, 10) <= hojeIso).length,
        )}
        {botao(
          "andamento",
          "Em andamento",
          leads.filter((l) =>
            ["FALOU_COM_DECISOR", "DEMONSTRACAO_MARCADA", "RETORNAR_DEPOIS"].includes(l.situacao),
          ).length,
        )}
        {botao("pendentes", "Nunca contatadas", leads.filter((l) => l.situacao === "NAO_CONTATADO").length)}
        {botao("todos", "Todas", leads.length)}
      </div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por empresa, estado ou perfil…"
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Nada aqui. Troque o filtro para ver as outras.
        </p>
      ) : (
        <div className="space-y-2.5">
          {visiveis.map((l) => (
            <CardLead key={l.id} lead={l} />
          ))}
        </div>
      )}
    </div>
  );
}
