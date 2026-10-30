"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageCircle, Check, Loader2, ChevronDown, AlertTriangle, Lightbulb } from "lucide-react";
import { registrarFollowUpAction } from "@/app/actions/followUp";
import type { PontoDeAtencao, SituacaoFollowUp } from "@/lib/followUpClientes";

export type ContatoNaTela = {
  id: string;
  marcoDias: number;
  resultado: string;
  canal: string;
  contatoNome: string | null;
  resumo: string;
  orientacoes: string | null;
  feedback: string | null;
  retornarEm: string | null;
  realizadoEm: string;
  realizadoPorNome: string | null;
};

export type ClienteNaTela = {
  contaId: string;
  nome: string;
  plano: string;
  statusAssinatura: string;
  titular: { nome: string; email: string; telefoneWhatsApp: string | null } | null;
  cadencia: {
    clienteDesde: string;
    diasComoCliente: number;
    marco: number;
    previstoPara: string;
    situacao: SituacaoFollowUp;
    diasDeDesvio: number;
    retornarEm: string | null;
  };
  diagnostico: {
    documentos: { atas: number; contratos: number; empenhos: number };
    ultimaMovimentacaoEm: string | null;
    ultimoAcessoEm: string | null;
    usuarios: number;
    pontos: PontoDeAtencao[];
  };
  tentativasDesdeUltimo: number;
  historico: ContatoNaTela[];
};

const CANAIS: [string, string][] = [
  ["WHATSAPP", "WhatsApp"],
  ["TELEFONE", "Telefone"],
  ["VIDEOCHAMADA", "Videochamada"],
  ["EMAIL", "E-mail"],
  ["PRESENCIAL", "Presencial"],
];
const ROTULO_CANAL = Object.fromEntries(CANAIS);

const PLANO: Record<string, string> = { BASICO: "Básico", INTERMEDIARIO: "Intermediário", PREMIUM: "Premium" };

function data(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function selo(c: ClienteNaTela["cadencia"]): { cor: string; texto: string } {
  if (c.situacao === "RETORNO_PEDIDO") return { cor: "bg-violet-100 text-violet-800", texto: `retorno pedido · ${data(c.retornarEm)}` };
  if (c.situacao === "ATRASADO") return { cor: "bg-red-100 text-red-800", texto: `atrasado ${c.diasDeDesvio} dias` };
  if (c.situacao === "NA_JANELA")
    return { cor: "bg-amber-100 text-amber-800", texto: c.diasDeDesvio >= 0 ? "na vez · esta semana" : `em ${-c.diasDeDesvio} dias` };
  return { cor: "bg-emerald-100 text-emerald-800", texto: `em dia · próximo em ${-c.diasDeDesvio} dias` };
}

const COR_GRAVIDADE: Record<PontoDeAtencao["gravidade"], string> = {
  alta: "bg-red-500",
  media: "bg-amber-500",
  baixa: "bg-slate-400",
};

function Ponto({ p }: { p: PontoDeAtencao }) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-start gap-2.5 px-3 py-2.5">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${COR_GRAVIDADE[p.gravidade]}`} />
        <span className="flex-1">
          <span className="block text-[13.5px] font-semibold text-slate-900">{p.titulo}</span>
          <span className="block text-[12.5px] text-slate-600">{p.detalhe}</span>
        </span>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="mx-3 mb-3 rounded-md border-l-4 border-blue-400 bg-blue-50/60 px-3 py-2 text-[13px] leading-relaxed text-slate-800">
        <span className="mb-0.5 block font-mono text-[10.5px] font-bold uppercase tracking-wider text-blue-700">
          Como orientar
        </span>
        {p.orientacao}
      </div>
    </details>
  );
}

function FormularioContato({ cliente, aoRegistrar }: { cliente: ClienteNaTela; aoRegistrar: (marco: number) => void }) {
  const [resultado, setResultado] = useState<"REALIZADO" | "TENTATIVA">("REALIZADO");
  const [canal, setCanal] = useState("WHATSAPP");
  const [quem, setQuem] = useState("");
  const [resumo, setResumo] = useState("");
  const [orientacoes, setOrientacoes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [retornarEm, setRetornarEm] = useState("");
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const fd = new FormData();
    fd.set("contaId", cliente.contaId);
    fd.set("resultado", resultado);
    fd.set("canal", canal);
    fd.set("contatoNome", quem);
    fd.set("resumo", resumo);
    fd.set("orientacoes", orientacoes);
    fd.set("feedback", feedback);
    fd.set("retornarEm", retornarEm);
    iniciar(async () => {
      const r = await registrarFollowUpAction(null, fd);
      if (r?.erro) setErro(r.erro);
      else aoRegistrar(r.marco ?? cliente.cadencia.marco);
    });
  }

  const campo =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <form onSubmit={enviar} className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <p className="text-[13px] font-bold text-slate-900">
        Registrar contato · marco de {cliente.cadencia.marco} dias
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["REALIZADO", "Falei com o cliente"],
            ["TENTATIVA", "Tentei, não consegui falar"],
          ] as const
        ).map(([v, rot]) => (
          <button
            key={v}
            type="button"
            onClick={() => setResultado(v)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              resultado === v ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-blue-400"
            }`}
          >
            {rot}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-[12px] font-semibold text-slate-600">
          Por onde
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`${campo} mt-1 py-1.5`}>
            {CANAIS.map(([v, rot]) => (
              <option key={v} value={v}>{rot}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-semibold text-slate-600">
          Com quem falei
          <input value={quem} onChange={(e) => setQuem(e.target.value)} placeholder="Nome e função" className={`${campo} mt-1 py-1.5`} />
        </label>
        <label className="text-[12px] font-semibold text-slate-600">
          Voltar a falar em
          <input type="date" value={retornarEm} onChange={(e) => setRetornarEm(e.target.value)} className={`${campo} mt-1 py-1.5`} />
        </label>
      </div>

      <label className="mt-3 block text-[12px] font-semibold text-slate-600">
        O que o cliente disse {resultado === "REALIZADO" && <span className="text-red-600">*</span>}
        <textarea
          value={resumo}
          onChange={(e) => setResumo(e.target.value)}
          rows={3}
          placeholder={
            resultado === "REALIZADO"
              ? "Como está usando, o que mudou na operação, onde trava, o que achou do sistema…"
              : "Ligou e caiu na caixa postal, mandou WhatsApp e não respondeu…"
          }
          className={`${campo} mt-1`}
        />
      </label>

      {resultado === "REALIZADO" && (
        <>
          <label className="mt-3 block text-[12px] font-semibold text-slate-600">
            O que orientei
            <textarea
              value={orientacoes}
              onChange={(e) => setOrientacoes(e.target.value)}
              rows={2}
              placeholder="Ex.: registrar as duas entregas de setembro e anexar as notas; ligar o WhatsApp do financeiro."
              className={`${campo} mt-1`}
            />
          </label>
          <label className="mt-3 block text-[12px] font-semibold text-slate-600">
            Feedback para o sistema <span className="font-normal text-slate-500">(pedidos, críticas, ideias — vira lista de melhoria)</span>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              placeholder="Ex.: queria exportar o saldo da ata em PDF; a tela de empenho demora a abrir no celular."
              className={`${campo} mt-1`}
            />
          </label>
        </>
      )}

      {erro && <p className="mt-2 text-[12.5px] font-semibold text-red-600">{erro}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pendente}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar contato
        </button>
        <span className="text-[12px] text-slate-500">
          {resultado === "REALIZADO" ? "Cumpre o marco e agenda o próximo." : "Fica registrado; o marco continua na vez."}
        </span>
      </div>
    </form>
  );
}

function CardCliente({ cliente }: { cliente: ClienteNaTela }) {
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const router = useRouter();
  const s = selo(cliente.cadencia);
  const d = cliente.diagnostico;
  const uso = d.pontos.filter((p) => p.tipo === "uso");
  const ociosos = d.pontos.filter((p) => p.tipo === "ocioso");
  const graves = d.pontos.filter((p) => p.gravidade === "alta").length;
  const fone = cliente.titular?.telefoneWhatsApp?.replace(/\D/g, "") ?? "";
  const ultimo = cliente.historico.find((h) => h.resultado === "REALIZADO");
  const naVez = cliente.cadencia.situacao !== "EM_DIA";

  return (
    <div className={`rounded-xl border bg-white p-4 ${naVez ? "border-l-4 border-l-amber-500 border-slate-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`rounded-md px-2 py-1 text-[11px] font-bold tabular-nums ${s.cor}`}>{s.texto}</span>
        <span className="text-[15px] font-bold text-slate-900">{cliente.nome}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
          {PLANO[cliente.plano] ?? cliente.plano}
        </span>
        {cliente.statusAssinatura === "INADIMPLENTE" && (
          <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">inadimplente</span>
        )}
        {graves > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800">
            <AlertTriangle className="h-3 w-3" /> {graves} {graves === 1 ? "ponto grave" : "pontos graves"}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {fone && (
            <>
              <a href={`tel:+${fone}`} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 font-mono text-xs font-bold text-white hover:bg-blue-700">
                <Phone className="h-3 w-3" /> {fone}
              </a>
              <a
                href={`https://wa.me/${fone}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </a>
            </>
          )}
        </span>
      </div>

      <p className="mt-2 text-[13px] text-slate-600">
        Cliente desde <strong className="text-slate-800">{data(cliente.cadencia.clienteDesde)}</strong> ({cliente.cadencia.diasComoCliente} dias)
        {" · "}marco atual: <strong className="text-slate-800">{cliente.cadencia.marco} dias</strong>, previsto {data(cliente.cadencia.previstoPara)}
        {cliente.titular && (
          <>
            {" · "}titular <strong className="text-slate-800">{cliente.titular.nome}</strong>
            {" "}<span className="font-mono text-[11.5px] text-slate-500">{cliente.titular.email}</span>
          </>
        )}
      </p>
      <p className="mt-1 text-[12.5px] text-slate-500">
        {ultimo
          ? <>Último contato em {data(ultimo.realizadoEm)} ({ROTULO_CANAL[ultimo.canal] ?? ultimo.canal}{ultimo.contatoNome ? `, com ${ultimo.contatoNome}` : ""}{ultimo.realizadoPorNome ? `, por ${ultimo.realizadoPorNome}` : ""})</>
          : <>Nenhum contato de follow-up registrado ainda.</>}
        {cliente.tentativasDesdeUltimo > 0 && <> · {cliente.tentativasDesdeUltimo} {cliente.tentativasDesdeUltimo === 1 ? "tentativa" : "tentativas"} sem sucesso desde então</>}
      </p>

      {/* Uso em números */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Atas", String(d.documentos.atas)],
          ["Contratos", String(d.documentos.contratos)],
          ["Empenhos", String(d.documentos.empenhos)],
          ["Última movimentação", d.ultimaMovimentacaoEm ? `há ${diasDesde(d.ultimaMovimentacaoEm)}d` : "nunca"],
          ["Último acesso", d.ultimoAcessoEm ? `há ${diasDesde(d.ultimoAcessoEm)}d` : "sem registro"],
        ].map(([rot, v]) => (
          <div key={rot} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{rot}</p>
            <p className="text-[14px] font-bold tabular-nums text-slate-800">{v}</p>
          </div>
        ))}
      </div>

      {/* Pontos de atenção */}
      {d.pontos.length === 0 ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[13px] text-emerald-900">
          Uso saudável: nada parado, nada incompleto e os recursos do plano em uso. A conversa é de relacionamento e feedback.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5" /> Onde está falhando no uso ({uso.length})
            </p>
            {uso.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">Nada parado nem incompleto.</p>
            ) : (
              <div className="space-y-1.5">{uso.map((p) => <Ponto key={p.chave} p={p} />)}</div>
            )}
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Lightbulb className="h-3.5 w-3.5" /> Funcionalidades ociosas ({ociosos.length})
            </p>
            {ociosos.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">Usa tudo que o plano oferece.</p>
            ) : (
              <div className="space-y-1.5">{ociosos.map((p) => <Ponto key={p.chave} p={p} />)}</div>
            )}
          </div>
        </div>
      )}

      {/* Histórico */}
      {cliente.historico.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-semibold text-slate-600">
            <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
            Histórico de contatos ({cliente.historico.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {cliente.historico.map((h) => (
              <li key={h.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                <p className="text-[12px] text-slate-500">
                  {data(h.realizadoEm)} · marco {h.marcoDias} · {ROTULO_CANAL[h.canal] ?? h.canal}
                  {h.resultado === "TENTATIVA" ? " · tentativa sem sucesso" : ""}
                  {h.contatoNome ? ` · com ${h.contatoNome}` : ""}
                  {h.realizadoPorNome ? ` · por ${h.realizadoPorNome}` : ""}
                  {h.retornarEm ? ` · voltar em ${data(h.retornarEm)}` : ""}
                </p>
                <p className="mt-0.5 whitespace-pre-line">{h.resumo}</p>
                {h.orientacoes && <p className="mt-1 whitespace-pre-line text-slate-600"><strong>Orientado:</strong> {h.orientacoes}</p>}
                {h.feedback && <p className="mt-1 whitespace-pre-line text-violet-800"><strong>Feedback:</strong> {h.feedback}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Registro */}
      {confirmacao ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">
          <Check className="h-4 w-4" /> {confirmacao}
        </p>
      ) : aberto ? (
        <FormularioContato
          cliente={cliente}
          aoRegistrar={(marco) => {
            setAberto(false);
            setConfirmacao(`Contato registrado no marco de ${marco} dias.`);
            router.refresh();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-3 rounded-lg border border-blue-300 bg-white px-3.5 py-2 text-[13px] font-bold text-blue-700 hover:bg-blue-50"
        >
          Registrar contato
        </button>
      )}
    </div>
  );
}

export function ListaFollowUp({ clientes }: { clientes: ClienteNaTela[] }) {
  const naVez = clientes.filter((c) => c.cadencia.situacao !== "EM_DIA");
  const [filtro, setFiltro] = useState<"na-vez" | "em-dia" | "todos">(naVez.length ? "na-vez" : "todos");
  const [busca, setBusca] = useState("");

  const visiveis = clientes
    .filter((c) => (filtro === "na-vez" ? c.cadencia.situacao !== "EM_DIA" : filtro === "em-dia" ? c.cadencia.situacao === "EM_DIA" : true))
    .filter((c) => (busca.trim() ? c.nome.toLowerCase().includes(busca.trim().toLowerCase()) : true));

  const botao = (v: typeof filtro, rotulo: string, n: number) => (
    <button
      key={v}
      type="button"
      onClick={() => setFiltro(v)}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        filtro === v ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-blue-400"
      }`}
    >
      {rotulo} ({n})
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {botao("na-vez", "Na vez de conversar", naVez.length)}
        {botao("em-dia", "Em dia", clientes.length - naVez.length)}
        {botao("todos", "Todos", clientes.length)}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente…"
          className="ml-auto w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {clientes.length === 0
            ? "Nenhum cliente pagante na carteira ainda. Quando a primeira fatura for paga, a empresa entra aqui sozinha."
            : "Ninguém neste filtro. Troque o filtro para ver os outros."}
        </p>
      ) : (
        <div className="space-y-3">
          {visiveis.map((c) => <CardCliente key={c.contaId} cliente={c} />)}
        </div>
      )}
    </div>
  );
}
