"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, MessageCircle, Check, Loader2, ChevronDown, AlertTriangle, Lightbulb, Pencil, Trash2, Send,
} from "lucide-react";
import { registrarFollowUpAction, atualizarFollowUpAction, excluirFollowUpAction } from "@/app/actions/followUp";
import type { PontoDeAtencao, SituacaoFollowUp, Indicador, TipoCarteira } from "@/lib/followUpClientes";

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
  tipo: TipoCarteira;
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
    indicadores: Indicador[];
    pontos: PontoDeAtencao[];
  };
  tentativasDesdeUltimo: number;
  convite: { em: string; status: "PENDENTE" | "ENVIADA" } | null;
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

/**
 * O mesmo formulário registra um contato novo e corrige um existente — o que
 * muda é só para qual action os campos vão.
 */
function FormularioContato({
  cliente,
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  cliente: ClienteNaTela;
  inicial?: ContatoNaTela;
  aoSalvar: (marco: number) => void;
  aoCancelar: () => void;
}) {
  const editando = !!inicial;
  const [resultado, setResultado] = useState<"REALIZADO" | "TENTATIVA">(
    inicial?.resultado === "TENTATIVA" ? "TENTATIVA" : "REALIZADO",
  );
  const [canal, setCanal] = useState(inicial?.canal ?? "WHATSAPP");
  const [quem, setQuem] = useState(inicial?.contatoNome ?? "");
  const [resumo, setResumo] = useState(inicial?.resumo ?? "");
  const [orientacoes, setOrientacoes] = useState(inicial?.orientacoes ?? "");
  const [feedback, setFeedback] = useState(inicial?.feedback ?? "");
  const [retornarEm, setRetornarEm] = useState(inicial?.retornarEm ? inicial.retornarEm.slice(0, 10) : "");
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const fd = new FormData();
    if (editando) fd.set("id", inicial!.id);
    else fd.set("contaId", cliente.contaId);
    fd.set("resultado", resultado);
    fd.set("canal", canal);
    fd.set("contatoNome", quem);
    fd.set("resumo", resumo);
    fd.set("orientacoes", orientacoes);
    fd.set("feedback", feedback);
    fd.set("retornarEm", retornarEm);
    iniciar(async () => {
      const r = editando ? await atualizarFollowUpAction(null, fd) : await registrarFollowUpAction(null, fd);
      if (r?.erro) setErro(r.erro);
      else aoSalvar(r.marco ?? (inicial?.marcoDias ?? cliente.cadencia.marco));
    });
  }

  const campo =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const pessoa = cliente.tipo === "ANALISTA" ? "o analista" : "o cliente";

  return (
    <form onSubmit={enviar} className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <p className="text-[13px] font-bold text-slate-900">
        {editando
          ? `Corrigir contato de ${data(inicial!.realizadoEm)} · marco de ${inicial!.marcoDias} dias`
          : `Registrar contato · marco de ${cliente.cadencia.marco} dias`}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["REALIZADO", `Falei com ${pessoa}`],
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
        O que {pessoa} disse {resultado === "REALIZADO" && <span className="text-red-600">*</span>}
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

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pendente}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {editando ? "Salvar correção" : "Salvar contato"}
        </button>
        <button type="button" onClick={aoCancelar} className="text-[13px] font-semibold text-slate-500 hover:text-slate-700">
          Cancelar
        </button>
        {!editando && (
          <span className="text-[12px] text-slate-500">
            {resultado === "REALIZADO" ? "Cumpre o marco e agenda o próximo." : "Fica registrado; o marco continua na vez."}
          </span>
        )}
      </div>
    </form>
  );
}

function ItemHistorico({
  cliente,
  contato,
  aoMudar,
}: {
  cliente: ClienteNaTela;
  contato: ContatoNaTela;
  aoMudar: (msg: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  function apagar() {
    if (!window.confirm(`Apagar o contato de ${data(contato.realizadoEm)}? Se ele cumpria o marco de ${contato.marcoDias} dias, o marco volta a ficar na vez.`)) return;
    iniciar(async () => {
      const r = await excluirFollowUpAction(contato.id);
      if (r?.erro) setErro(r.erro);
      else aoMudar("Contato apagado.");
    });
  }

  if (editando) {
    return (
      <li>
        <FormularioContato
          cliente={cliente}
          inicial={contato}
          aoSalvar={() => { setEditando(false); aoMudar("Contato corrigido."); }}
          aoCancelar={() => setEditando(false)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[12px] text-slate-500">
          {data(contato.realizadoEm)} · marco {contato.marcoDias} · {ROTULO_CANAL[contato.canal] ?? contato.canal}
          {contato.resultado === "TENTATIVA" ? " · tentativa sem sucesso" : ""}
          {contato.contatoNome ? ` · com ${contato.contatoNome}` : ""}
          {contato.realizadoPorNome ? ` · por ${contato.realizadoPorNome}` : ""}
          {contato.retornarEm ? ` · voltar em ${data(contato.retornarEm)}` : ""}
        </p>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => setEditando(true)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-blue-700 hover:underline">
            <Pencil className="h-3 w-3" /> Corrigir
          </button>
          <button type="button" onClick={apagar} disabled={pendente} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-red-600 hover:underline disabled:opacity-60">
            {pendente ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Apagar
          </button>
        </span>
      </div>
      <p className="mt-0.5 whitespace-pre-line">{contato.resumo}</p>
      {contato.orientacoes && <p className="mt-1 whitespace-pre-line text-slate-600"><strong>Orientado:</strong> {contato.orientacoes}</p>}
      {contato.feedback && <p className="mt-1 whitespace-pre-line text-violet-800"><strong>Feedback:</strong> {contato.feedback}</p>}
      {erro && <p className="mt-1 text-[12px] font-semibold text-red-600">{erro}</p>}
    </li>
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
  const analista = cliente.tipo === "ANALISTA";

  function mudou(msg: string) {
    setConfirmacao(msg);
    router.refresh();
  }

  return (
    <div className={`rounded-xl border bg-white p-4 ${naVez ? "border-l-4 border-l-amber-500 border-slate-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`rounded-md px-2 py-1 text-[11px] font-bold tabular-nums ${s.cor}`}>{s.texto}</span>
        <span className="text-[15px] font-bold text-slate-900">{cliente.nome}</span>
        {analista ? (
          <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">analista parceiro</span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
            {PLANO[cliente.plano] ?? cliente.plano}
          </span>
        )}
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
        {analista ? "Parceiro desde" : "Cliente desde"} <strong className="text-slate-800">{data(cliente.cadencia.clienteDesde)}</strong> ({cliente.cadencia.diasComoCliente} dias)
        {" · "}marco atual: <strong className="text-slate-800">{cliente.cadencia.marco} dias</strong>, previsto {data(cliente.cadencia.previstoPara)}
        {cliente.titular && (
          <>
            {" · "}{analista ? "contato" : "titular"} <strong className="text-slate-800">{cliente.titular.nome}</strong>
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
      {cliente.convite && (
        <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-blue-700">
          <Send className="h-3 w-3" />
          {cliente.convite.status === "ENVIADA"
            ? `Convite automático para este marco enviado em ${data(cliente.convite.em)} — se responder, é por aqui que marca.`
            : `Convite automático para este marco na fila de envio desde ${data(cliente.convite.em)}.`}
        </p>
      )}

      {/* Uso em números */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {d.indicadores.map((i) => (
          <div key={i.rotulo} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{i.rotulo}</p>
            <p className="text-[14px] font-bold tabular-nums text-slate-800">{i.valor}</p>
          </div>
        ))}
      </div>

      {/* Pontos de atenção */}
      {d.pontos.length === 0 ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[13px] text-emerald-900">
          Uso saudável: nada parado, nada incompleto e os recursos em uso. A conversa é de relacionamento e feedback.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5" /> {analista ? "Onde a carteira está falhando" : "Onde está falhando no uso"} ({uso.length})
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
              <p className="text-[12.5px] text-slate-500">Usa tudo que está disponível.</p>
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
              <ItemHistorico key={h.id} cliente={cliente} contato={h} aoMudar={mudou} />
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
          aoSalvar={(marco) => { setAberto(false); mudou(`Contato registrado no marco de ${marco} dias.`); }}
          aoCancelar={() => setAberto(false)}
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
  const [filtro, setFiltro] = useState<"na-vez" | "em-dia" | "empresas" | "analistas" | "todos">(naVez.length ? "na-vez" : "todos");
  const [busca, setBusca] = useState("");

  const visiveis = clientes
    .filter((c) => {
      if (filtro === "na-vez") return c.cadencia.situacao !== "EM_DIA";
      if (filtro === "em-dia") return c.cadencia.situacao === "EM_DIA";
      if (filtro === "empresas") return c.tipo === "EMPRESA";
      if (filtro === "analistas") return c.tipo === "ANALISTA";
      return true;
    })
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
        {botao("empresas", "Empresas", clientes.filter((c) => c.tipo === "EMPRESA").length)}
        {botao("analistas", "Analistas", clientes.filter((c) => c.tipo === "ANALISTA").length)}
        {botao("todos", "Todos", clientes.length)}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar…"
          className="ml-auto w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {clientes.length === 0
            ? "Ninguém na carteira ainda. Empresa entra quando paga a primeira fatura; analista, quando tem o primeiro cliente vinculado."
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
