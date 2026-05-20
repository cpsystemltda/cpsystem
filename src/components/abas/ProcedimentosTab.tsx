"use client";

/**
 * ProcedimentosTab — M3 (Lei 14.133/2021 art. 157+)
 *
 * Procedimento administrativo apuratório (PAS).
 *
 * Funcionalidades:
 * - Cadastro com IA: upload do PDF (portaria/notificação) preenche os campos.
 * - Comissão de 2+ membros (botão "+" pra adicionar membros).
 * - Timeline visual com todas as fases legais (abertura → decisão final).
 * - Prazos calculados em DIAS ÚTEIS (defesa 15, recurso 15).
 * - Alerta de prazo de defesa quando NOTIFICACAO_DEFESA registrada mas
 *   DEFESA_APRESENTADA ainda não.
 * - Alerta de prazo de recurso após DECISAO_1A_INSTANCIA.
 * - Alerta de prescrição quinquenal (Lei 14.133 art. 158 §4º).
 * - Upload opcional de PDF em cada andamento.
 * - Registro de penalidades (advertência, multa, impedimento, inidoneidade).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  FileText,
  Gavel,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
  Beaker,
  Archive,
  Scale,
} from "lucide-react";
import { brl } from "@/lib/validators";
import { adicionarDiasUteis, diasUteisRestantes } from "@/lib/diasUteis";
import {
  criarProcedimentoAction,
  avancarProcedimentoAction,
  aplicarPenalidadeAction,
} from "@/app/actions/contratuais";
import { extrairProcedimentoPdfAction } from "@/app/actions/iaExtracao";
import { BadgeAuto } from "@/components/forms/glass";
import { BotaoGerarMinuta } from "@/components/MinutaIaPainel";

type FaseKey =
  | "ABERTURA"
  | "NOTIFICACAO_DEFESA"
  | "DEFESA_APRESENTADA"
  | "PEDIDO_PROVAS"
  | "DEFERIMENTO_PROVAS"
  | "NOTIFICACAO_ALEGACOES"
  | "ALEGACOES_FINAIS"
  | "DECISAO_1A_INSTANCIA"
  | "RECURSO"
  | "DECISAO_FINAL"
  | "ARQUIVAMENTO"
  | "PENALIDADE_APLICADA";

type Andamento = {
  id: string;
  fase: string;
  descricao: string;
  dataEvento: Date;
  arquivoPdfUrl?: string | null;
};

type Penalidade = {
  id: string;
  tipo: string;
  valor: number | null;
  duracaoMeses: number | null;
  fundamentacao: string | null;
  dataAplicacao: Date;
};

type Procedimento = {
  id: string;
  numero: string | null;
  notificacaoNumero: string | null;
  assunto: string;
  descricao: string;
  comissao: string | null;
  comissaoMembros: string[];
  autoridade: string | null;
  dataAbertura: Date;
  prazoDefesaDias: number;
  prazoRecursoDias: number;
  arquivado: boolean;
  arquivoPdfUrl: string | null;
  andamentos: Andamento[];
  penalidades: Penalidade[];
};

// Ordem legal das fases (Lei 14.133 art. 157+)
const FASES_ORDEM: FaseKey[] = [
  "ABERTURA",
  "NOTIFICACAO_DEFESA",
  "DEFESA_APRESENTADA",
  "PEDIDO_PROVAS",
  "DEFERIMENTO_PROVAS",
  "NOTIFICACAO_ALEGACOES",
  "ALEGACOES_FINAIS",
  "DECISAO_1A_INSTANCIA",
  "RECURSO",
  "DECISAO_FINAL",
];

const ROTULO_FASE: Record<FaseKey, string> = {
  ABERTURA: "Abertura do procedimento",
  NOTIFICACAO_DEFESA: "Notificação para defesa",
  DEFESA_APRESENTADA: "Defesa administrativa",
  PEDIDO_PROVAS: "Pedido de produção de provas",
  DEFERIMENTO_PROVAS: "Decisão sobre provas",
  NOTIFICACAO_ALEGACOES: "Notificação para alegações finais",
  ALEGACOES_FINAIS: "Alegações finais",
  DECISAO_1A_INSTANCIA: "Decisão administrativa (1ª instância)",
  RECURSO: "Recurso administrativo",
  DECISAO_FINAL: "Decisão final",
  ARQUIVAMENTO: "Arquivamento",
  PENALIDADE_APLICADA: "Penalidade aplicada",
};

const ROTULO_PENALIDADE: Record<string, string> = {
  ADVERTENCIA: "Advertência",
  MULTA: "Multa",
  IMPEDIMENTO_LICITAR: "Impedimento de licitar",
  DECLARACAO_INIDONEIDADE: "Declaração de inidoneidade",
};

function toIsoDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function formatDiasUteis(dias: number): string {
  if (dias === 0) return "Hoje";
  if (dias === 1) return "1 dia útil";
  if (dias === -1) return "1 dia útil em atraso";
  return dias > 0 ? `${dias} dias úteis` : `${-dias} dias úteis em atraso`;
}

export function ProcedimentosTab({
  procedimentos,
  ataId,
  contratoId,
  empenhoId,
}: {
  procedimentos: Procedimento[];
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
}) {
  const [criando, setCriando] = useState(false);

  return (
    <div className="space-y-5">
      {procedimentos.length > 0 && (
        <div className="space-y-4">
          {procedimentos.map((p) => (
            <CardProcedimento key={p.id} p={p} />
          ))}
        </div>
      )}

      {!criando && (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="btn-primary inline-flex"
        >
          <Plus className="h-4 w-4" /> Abrir procedimento apuratório
        </button>
      )}

      {criando && (
        <FormularioNovoProcedimento
          ataId={ataId}
          contratoId={contratoId}
          empenhoId={empenhoId}
          onCancelar={() => setCriando(false)}
          onSalvo={() => setCriando(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// CARD DE PROCEDIMENTO
// ============================================================
function CardProcedimento({ p }: { p: Procedimento }) {
  // Identifica andamentos por fase pra checar progresso
  const fasesRegistradas = new Set(p.andamentos.map((a) => a.fase));
  const ultimoAndamento = p.andamentos[p.andamentos.length - 1];

  // Prazo de defesa: 15 dias úteis a partir da NOTIFICACAO_DEFESA
  const notifDefesa = p.andamentos.find((a) => a.fase === "NOTIFICACAO_DEFESA");
  const prazoDefesaLimite = notifDefesa
    ? adicionarDiasUteis(notifDefesa.dataEvento, p.prazoDefesaDias)
    : null;
  const defesaApresentada = fasesRegistradas.has("DEFESA_APRESENTADA");
  const diasDefesa = prazoDefesaLimite && !defesaApresentada
    ? diasUteisRestantes(prazoDefesaLimite)
    : null;

  // Prazo de recurso: 15 dias úteis após DECISAO_1A_INSTANCIA
  const decisao1 = p.andamentos.find((a) => a.fase === "DECISAO_1A_INSTANCIA");
  const prazoRecursoLimite = decisao1
    ? adicionarDiasUteis(decisao1.dataEvento, p.prazoRecursoDias)
    : null;
  const recursoApresentado = fasesRegistradas.has("RECURSO") || fasesRegistradas.has("DECISAO_FINAL");
  const diasRecurso = prazoRecursoLimite && !recursoApresentado
    ? diasUteisRestantes(prazoRecursoLimite)
    : null;

  // Prescrição quinquenal (art. 158 §4º) - 5 anos = 1826 dias corridos
  const prescricao = new Date(p.dataAbertura.getTime() + 5 * 365.25 * 86400000);
  const diasParaPrescrever = Math.ceil((prescricao.getTime() - Date.now()) / 86400000);
  const mostrarPrescricao = !p.arquivado && diasParaPrescrever <= 365;

  return (
    <article className="glass-tile rounded-[20px] px-5 py-4">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <Gavel className="h-4 w-4" style={{ color: "var(--primary-deep)" }} />
            <h4
              className="text-[15px] font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
            >
              {p.numero ? `Procedimento ${p.numero}` : "Procedimento (sem numeração)"}
            </h4>
            {p.arquivado && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase"
                style={{
                  background: "rgba(127,127,127,0.18)",
                  color: "var(--text-mute)",
                  letterSpacing: "0.08em",
                }}
              >
                <Archive className="h-3 w-3" /> Arquivado
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            {p.assunto}
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-soft)" }}>
            {p.descricao}
          </p>
          <div
            className="mt-2 grid gap-x-4 gap-y-1 text-[11px] md:grid-cols-2"
            style={{ color: "var(--text-mute)" }}
          >
            <span>
              <strong>Aberto em:</strong>{" "}
              {p.dataAbertura.toLocaleDateString("pt-BR")}
            </span>
            {p.notificacaoNumero && (
              <span>
                <strong>Notificação nº:</strong> {p.notificacaoNumero}
              </span>
            )}
            {p.comissaoMembros.length > 0 && (
              <span className="md:col-span-2">
                <strong>Comissão:</strong> {p.comissaoMembros.join(" · ")}
              </span>
            )}
            {!p.comissaoMembros.length && p.comissao && (
              <span className="md:col-span-2">
                <strong>Comissão:</strong> {p.comissao}
              </span>
            )}
            {p.autoridade && (
              <span className="md:col-span-2">
                <strong>Autoridade competente:</strong> {p.autoridade}
              </span>
            )}
          </div>
        </div>
        {p.arquivoPdfUrl && (
          <a
            href={p.arquivoPdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
            style={{
              background: "rgba(63,99,143,0.10)",
              color: "var(--sky-deep, #3F638F)",
              border: "0.5px solid rgba(63,99,143,0.2)",
            }}
          >
            <FileText className="h-3 w-3" /> PDF
          </a>
        )}
      </div>

      {/* ALERTAS DE PRAZO */}
      <div className="mt-3 space-y-2">
        {diasDefesa !== null && (
          <AlertaPrazo
            critico={diasDefesa <= 3}
            atrasado={diasDefesa < 0}
            icone={Clock}
            titulo={
              diasDefesa < 0
                ? `Prazo de defesa em ATRASO (${-diasDefesa} dia(s) úteis)`
                : `Prazo de defesa: ${formatDiasUteis(diasDefesa)}`
            }
            detalhe={`Limite: ${prazoDefesaLimite!.toLocaleDateString("pt-BR")} (${p.prazoDefesaDias} dias úteis após notificação — Lei 14.133 art. 157)`}
            acao={
              <BotaoGerarMinuta
                tipo="DEFESA_PROCEDIMENTO"
                recursoId={p.id}
                rotulo="Gerar defesa com IA"
                variante="ghost"
              />
            }
          />
        )}
        {diasRecurso !== null && (
          <AlertaPrazo
            critico={diasRecurso <= 3}
            atrasado={diasRecurso < 0}
            icone={Scale}
            titulo={
              diasRecurso < 0
                ? `Prazo de recurso em ATRASO (${-diasRecurso} dia(s) úteis)`
                : `Prazo de recurso: ${formatDiasUteis(diasRecurso)}`
            }
            detalhe={`Limite: ${prazoRecursoLimite!.toLocaleDateString("pt-BR")} (${p.prazoRecursoDias} dias úteis após decisão — Lei 14.133 art. 165)`}
            acao={
              <BotaoGerarMinuta
                tipo="RECURSO_PROCEDIMENTO"
                recursoId={p.id}
                rotulo="Gerar recurso com IA"
                variante="ghost"
              />
            }
          />
        )}
        {mostrarPrescricao && (
          <AlertaPrazo
            critico={diasParaPrescrever <= 90}
            atrasado={diasParaPrescrever <= 0}
            icone={Scale}
            titulo={
              diasParaPrescrever > 0
                ? `Prescrição quinquenal em ${diasParaPrescrever} dia(s)`
                : `PRESCRITO há ${-diasParaPrescrever} dia(s)`
            }
            detalhe={`Lei 14.133/2021 art. 158, §4º — prescrição em 5 anos a partir da abertura (${prescricao.toLocaleDateString("pt-BR")})`}
          />
        )}
      </div>

      {/* TIMELINE DE FASES */}
      <Timeline procedimento={p} fasesRegistradas={fasesRegistradas} />

      {/* PENALIDADES */}
      {p.penalidades.length > 0 && (
        <div
          className="mt-4 rounded-2xl px-4 py-3"
          style={{
            background: "rgba(232,138,152,0.06)",
            border: "0.5px solid rgba(232,138,152,0.3)",
          }}
        >
          <h5
            className="mb-2 text-[11px] font-bold uppercase"
            style={{ color: "var(--coral)", letterSpacing: "0.14em" }}
          >
            Penalidades aplicadas
          </h5>
          <ul className="space-y-1 text-[12px]" style={{ color: "var(--coral)" }}>
            {p.penalidades.map((pen) => (
              <li key={pen.id}>
                • <strong>{ROTULO_PENALIDADE[pen.tipo] ?? pen.tipo}</strong>
                {pen.valor != null && ` · ${brl(pen.valor)}`}
                {pen.duracaoMeses != null && ` · ${pen.duracaoMeses} mes(es)`}
                {" · "}
                {pen.dataAplicacao.toLocaleDateString("pt-BR")}
                {pen.fundamentacao && (
                  <p className="ml-3 mt-0.5 text-[11px] italic" style={{ color: "var(--text-mute)" }}>
                    {pen.fundamentacao}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AÇÕES (avançar fase / aplicar penalidade) */}
      {!p.arquivado && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FormularioAvancarFase procedimentoId={p.id} ultimaFase={ultimoAndamento?.fase as FaseKey | undefined} />
          <FormularioPenalidade procedimentoId={p.id} />
        </div>
      )}
    </article>
  );
}

// ============================================================
// TIMELINE
// ============================================================
function Timeline({
  procedimento,
  fasesRegistradas,
}: {
  procedimento: Procedimento;
  fasesRegistradas: Set<string>;
}) {
  // Mapeia última data por fase pra exibir
  const dataPorFase = new Map<string, Date>();
  for (const a of procedimento.andamentos) {
    if (!dataPorFase.has(a.fase)) dataPorFase.set(a.fase, a.dataEvento);
  }
  const descPorFase = new Map<string, string>();
  for (const a of procedimento.andamentos) {
    descPorFase.set(a.fase, a.descricao);
  }
  const pdfPorFase = new Map<string, string>();
  for (const a of procedimento.andamentos) {
    if (a.arquivoPdfUrl) pdfPorFase.set(a.fase, a.arquivoPdfUrl);
  }

  return (
    <ol
      className="mt-5 space-y-2 border-l-2 pl-5"
      style={{ borderColor: "var(--border-soft)" }}
    >
      {FASES_ORDEM.map((fase) => {
        const concluida = fasesRegistradas.has(fase);
        const data = dataPorFase.get(fase);
        const desc = descPorFase.get(fase);
        const pdf = pdfPorFase.get(fase);
        return (
          <li key={fase} className="relative">
            <span
              className="absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full"
              style={{
                background: concluida ? "var(--primary)" : "var(--glass-2)",
                border: `2px solid ${concluida ? "var(--primary)" : "var(--border-soft)"}`,
                boxShadow: concluida ? "0 0 0 3px var(--bg)" : "0 0 0 3px var(--bg)",
              }}
            >
              {concluida && <Check className="h-2.5 w-2.5" style={{ color: "#0A0A0A" }} />}
            </span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span
                className="text-[12px] font-bold"
                style={{
                  color: concluida ? "var(--text)" : "var(--text-mute)",
                  letterSpacing: "-0.005em",
                }}
              >
                {ROTULO_FASE[fase]}
              </span>
              {data && (
                <span className="text-[11px]" style={{ color: "var(--text-mute)" }}>
                  · {data.toLocaleDateString("pt-BR")}
                </span>
              )}
              {pdf && (
                <a
                  href={pdf}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold underline"
                  style={{ color: "var(--sky-deep, #3F638F)" }}
                >
                  <FileText className="h-2.5 w-2.5" /> PDF
                </a>
              )}
            </div>
            {desc && (
              <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>
                {desc}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================
// ALERTAS
// ============================================================
function AlertaPrazo({
  critico,
  atrasado,
  icone: Icone,
  titulo,
  detalhe,
  acao,
}: {
  critico: boolean;
  atrasado: boolean;
  icone: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  titulo: string;
  detalhe: string;
  acao?: React.ReactNode;
}) {
  const cor = atrasado
    ? { bg: "rgba(232,138,152,0.14)", border: "rgba(232,138,152,0.4)", fg: "var(--coral)" }
    : critico
      ? { bg: "rgba(212,175,55,0.14)", border: "rgba(212,175,55,0.4)", fg: "var(--primary-deep)" }
      : { bg: "rgba(63,99,143,0.10)", border: "rgba(63,99,143,0.3)", fg: "var(--sky-deep, #3F638F)" };
  return (
    <div
      className="flex items-start gap-2 rounded-xl px-3 py-2"
      style={{
        background: cor.bg,
        border: `0.5px solid ${cor.border}`,
        color: cor.fg,
      }}
    >
      <Icone className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="text-[12px] font-bold">{titulo}</p>
        <p className="text-[11px] opacity-90">{detalhe}</p>
        {acao && <div className="mt-2">{acao}</div>}
      </div>
    </div>
  );
}

// ============================================================
// FORM: avançar fase
// ============================================================
function FormularioAvancarFase({
  procedimentoId,
  ultimaFase,
}: {
  procedimentoId: string;
  ultimaFase?: FaseKey;
}) {
  const [aberto, setAberto] = useState(false);
  // Sugere a próxima fase razoável
  const indexAtual = ultimaFase ? FASES_ORDEM.indexOf(ultimaFase) : -1;
  const proxima = indexAtual >= 0 && indexAtual < FASES_ORDEM.length - 1 ? FASES_ORDEM[indexAtual + 1] : "NOTIFICACAO_DEFESA";

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition hover:opacity-80"
        style={{
          background: "var(--glass-1)",
          color: "var(--text-soft)",
          border: "0.5px solid var(--border-soft)",
        }}
      >
        <Plus className="h-4 w-4" /> Avançar fase
      </button>
    );
  }

  return (
    <form
      action={avancarProcedimentoAction}
      className="rounded-2xl px-4 py-3 md:col-span-2"
      style={{ background: "var(--glass-1)", border: "0.5px solid var(--border-soft)" }}
    >
      <input type="hidden" name="procedimentoId" value={procedimentoId} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Fase
          </span>
          <select
            name="fase"
            required
            defaultValue={proxima}
            className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
          >
            {(Object.keys(ROTULO_FASE) as FaseKey[]).map((k) => (
              <option key={k} value={k}>
                {ROTULO_FASE[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Data
          </span>
          <input
            type="date"
            name="dataEvento"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
          />
        </label>
        <label className="block">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Arquivo (opcional)
          </span>
          <input
            type="file"
            name="arquivo"
            accept="application/pdf"
            className="w-full text-[11px]"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span
          className="mb-1 flex text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
        >
          Descrição
        </span>
        <input
          name="descricao"
          placeholder="ex.: Notificação encaminhada por AR via correio em 12/05"
          className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
        />
      </label>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" className="btn-primary inline-flex">
          <Check className="h-4 w-4" /> Adicionar
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:opacity-80"
          style={{
            background: "var(--glass-2)",
            color: "var(--text-soft)",
            border: "0.5px solid var(--border-soft)",
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ============================================================
// FORM: aplicar penalidade
// ============================================================
function FormularioPenalidade({ procedimentoId }: { procedimentoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<string>("ADVERTENCIA");

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition hover:opacity-80"
        style={{
          background: "rgba(232,138,152,0.10)",
          color: "var(--coral)",
          border: "0.5px solid rgba(232,138,152,0.3)",
        }}
      >
        <Scale className="h-4 w-4" /> Aplicar penalidade
      </button>
    );
  }

  return (
    <form
      action={aplicarPenalidadeAction}
      className="rounded-2xl px-4 py-3 md:col-span-2"
      style={{
        background: "rgba(232,138,152,0.06)",
        border: "0.5px solid rgba(232,138,152,0.3)",
      }}
    >
      <input type="hidden" name="procedimentoId" value={procedimentoId} />
      <h5
        className="mb-3 text-[11px] font-bold uppercase"
        style={{ color: "var(--coral)", letterSpacing: "0.14em" }}
      >
        Aplicação de penalidade
      </h5>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Tipo
          </span>
          <select
            name="tipo"
            required
            value={tipo}
            onChange={(ev) => setTipo(ev.target.value)}
            className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
          >
            <option value="ADVERTENCIA">Advertência</option>
            <option value="MULTA">Multa</option>
            <option value="IMPEDIMENTO_LICITAR">Impedimento de licitar</option>
            <option value="DECLARACAO_INIDONEIDADE">Declaração de inidoneidade</option>
          </select>
        </label>
        <label className="block">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Data da aplicação
          </span>
          <input
            type="date"
            name="dataAplicacao"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
          />
        </label>
        {tipo === "MULTA" && (
          <label className="block">
            <span
              className="mb-1 flex text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
            >
              Valor (R$)
            </span>
            <input
              type="number"
              step="0.01"
              name="valor"
              className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
            />
          </label>
        )}
        {(tipo === "IMPEDIMENTO_LICITAR" || tipo === "DECLARACAO_INIDONEIDADE") && (
          <label className="block">
            <span
              className="mb-1 flex text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
            >
              Duração (meses)
            </span>
            <input
              type="number"
              name="duracaoMeses"
              className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
            />
          </label>
        )}
        <label className="block md:col-span-2">
          <span
            className="mb-1 flex text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
          >
            Fundamentação
          </span>
          <textarea
            name="fundamentacao"
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-[13px] font-medium"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition hover:opacity-80"
          style={{
            background: "var(--coral)",
            color: "#fff",
            boxShadow: "0 4px 14px rgba(232,138,152,0.4)",
          }}
        >
          <Scale className="h-4 w-4" /> Aplicar
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:opacity-80"
          style={{
            background: "var(--glass-2)",
            color: "var(--text-soft)",
            border: "0.5px solid var(--border-soft)",
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ============================================================
// FORM: NOVO PROCEDIMENTO (com IA + comissão multi-membro)
// ============================================================
function FormularioNovoProcedimento({
  ataId,
  contratoId,
  empenhoId,
  onCancelar,
  onSalvo,
}: {
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const [state, formAction] = useActionState(criarProcedimentoAction, null);

  const [numero, setNumero] = useState("");
  const [notifNumero, setNotifNumero] = useState("");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [autoridade, setAutoridade] = useState("");
  const [dataAbertura, setDataAbertura] = useState(new Date().toISOString().slice(0, 10));
  const [membros, setMembros] = useState<string[]>(["", ""]);
  const [arquivoUrlIa, setArquivoUrlIa] = useState<string | null>(null);
  const [arquivoNomeIa, setArquivoNomeIa] = useState<string | null>(null);
  const [camposAuto, setCamposAuto] = useState<Set<string>>(new Set());

  function aplicarDadosIa(d: {
    numero: string | null;
    notificacaoNumero: string | null;
    assunto: string;
    descricao: string;
    comissaoMembros: string[];
    autoridade: string | null;
    dataAbertura: string;
  }) {
    const auto = new Set<string>();
    if (d.numero) { setNumero(d.numero); auto.add("numero"); }
    if (d.notificacaoNumero) { setNotifNumero(d.notificacaoNumero); auto.add("notificacaoNumero"); }
    if (d.assunto) { setAssunto(d.assunto); auto.add("assunto"); }
    if (d.descricao) { setDescricao(d.descricao); auto.add("descricao"); }
    if (d.autoridade) { setAutoridade(d.autoridade); auto.add("autoridade"); }
    if (d.dataAbertura) { setDataAbertura(d.dataAbertura); auto.add("dataAbertura"); }
    if (d.comissaoMembros && d.comissaoMembros.length > 0) {
      const arr = d.comissaoMembros.length >= 2 ? d.comissaoMembros : [...d.comissaoMembros, ""];
      setMembros(arr);
      auto.add("comissaoMembros");
    }
    setCamposAuto(auto);
  }

  function addMembro() {
    setMembros((arr) => [...arr, ""]);
  }
  function removeMembro(idx: number) {
    setMembros((arr) => (arr.length > 2 ? arr.filter((_, i) => i !== idx) : arr));
  }
  function updateMembro(idx: number, valor: string) {
    setMembros((arr) => arr.map((m, i) => (i === idx ? valor : m)));
  }

  useEffect(() => {
    if (state?.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <div className="space-y-4">
      <PainelIaProcedimento
        onDados={aplicarDadosIa}
        onArquivo={(url, nome) => {
          setArquivoUrlIa(url);
          setArquivoNomeIa(nome);
        }}
      />

      <form
        action={formAction}
        className="glass rounded-[24px] px-7 py-6 space-y-6"
        style={{ background: "var(--glass-2)" }}
      >
        {ataId && <input type="hidden" name="ataId" value={ataId} />}
        {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
        {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
        {arquivoUrlIa && (
          <>
            <input type="hidden" name="arquivoPdfUrl" value={arquivoUrlIa} />
            <input type="hidden" name="arquivoPdfNome" value={arquivoNomeIa ?? ""} />
          </>
        )}

        <h3
          className="text-[12px] font-extrabold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary)" }}
        >
          Abrir procedimento apuratório
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoLabel label="Número (opcional)" auto={camposAuto.has("numero")}>
            <input
              name="numero"
              value={numero}
              onChange={(ev) => setNumero(ev.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              placeholder="ex: PA 042/2026"
            />
          </CampoLabel>
          <CampoLabel label="Notificação (nº)" auto={camposAuto.has("notificacaoNumero")}>
            <input
              name="notificacaoNumero"
              value={notifNumero}
              onChange={(ev) => setNotifNumero(ev.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
              placeholder="ex: NOT 117/2026"
            />
          </CampoLabel>
          <CampoLabel label="Assunto" required span={2} auto={camposAuto.has("assunto")}>
            <input
              name="assunto"
              required
              value={assunto}
              onChange={(ev) => setAssunto(ev.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
            />
          </CampoLabel>
          <CampoLabel label="Descrição" required span={2} auto={camposAuto.has("descricao")}>
            <textarea
              name="descricao"
              required
              rows={3}
              value={descricao}
              onChange={(ev) => setDescricao(ev.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
            />
          </CampoLabel>

          {/* Comissão multi-membro */}
          <div className="md:col-span-2">
            <span
              className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase"
              style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
            >
              Comissão (servidores)
              <span style={{ color: "var(--primary)" }}>*</span>
              {camposAuto.has("comissaoMembros") && <BadgeAuto />}
            </span>
            <p className="mb-2 text-[11px]" style={{ color: "var(--text-mute)" }}>
              Mínimo 2 membros (Lei 14.133 art. 158).
            </p>
            <div className="space-y-2">
              {membros.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    name="comissaoMembros"
                    value={m}
                    onChange={(ev) => updateMembro(i, ev.target.value)}
                    placeholder={`Membro ${i + 1} — nome e matrícula`}
                    required={i < 2}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium"
                  />
                  {membros.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeMembro(i)}
                      className="grid h-9 w-9 place-items-center rounded-lg transition hover:opacity-80"
                      style={{
                        background: "rgba(232,138,152,0.10)",
                        color: "var(--coral)",
                        border: "0.5px solid rgba(232,138,152,0.3)",
                      }}
                      title="Remover membro"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addMembro}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:opacity-80"
                style={{
                  background: "rgba(212,175,55,0.10)",
                  color: "var(--primary-deep)",
                  border: "0.5px dashed rgba(168,137,71,0.4)",
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar membro
              </button>
            </div>
          </div>

          <CampoLabel label="Autoridade competente" span={2} auto={camposAuto.has("autoridade")}>
            <input
              name="autoridade"
              value={autoridade}
              onChange={(ev) => setAutoridade(ev.target.value)}
              placeholder="ex.: Secretário de Administração"
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
            />
          </CampoLabel>

          <CampoLabel label="Data de abertura" required auto={camposAuto.has("dataAbertura")}>
            <input
              type="date"
              name="dataAbertura"
              required
              value={dataAbertura}
              onChange={(ev) => setDataAbertura(ev.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
            />
          </CampoLabel>
          <div />

          <CampoLabel label="Prazo defesa (dias úteis)">
            <input
              type="number"
              name="prazoDefesaDias"
              defaultValue={15}
              min="1"
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
            />
          </CampoLabel>
          <CampoLabel label="Prazo recurso (dias úteis)">
            <input
              type="number"
              name="prazoRecursoDias"
              defaultValue={15}
              min="1"
              className="w-full rounded-xl px-4 py-3 text-sm font-medium"
            />
          </CampoLabel>
        </div>

        {!arquivoUrlIa && (
          <CampoLabel label="Arquivo (PDF — alternativa à IA)" span={2}>
            <input
              type="file"
              name="arquivo"
              accept="application/pdf"
              className="text-[12px]"
            />
          </CampoLabel>
        )}

        {state?.erro && (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{
              background: "rgba(232,138,152,0.10)",
              border: "0.5px solid rgba(232,138,152,0.3)",
              color: "var(--coral)",
            }}
          >
            <AlertCircle className="inline h-4 w-4 mr-1" />
            {state.erro}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary inline-flex">
            <Check className="h-4 w-4" /> Abrir procedimento
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition hover:opacity-80"
            style={{
              background: "var(--glass-2)",
              border: "0.5px solid var(--border-soft)",
              color: "var(--text-soft)",
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function CampoLabel({
  label,
  required,
  children,
  span = 1,
  auto,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  span?: 1 | 2;
  auto?: boolean;
}) {
  const cls = span === 2 ? "md:col-span-2" : "";
  return (
    <label className={`block ${cls}`}>
      <span
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase"
        style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
      >
        {label}
        {required && <span style={{ color: "var(--primary)" }}>*</span>}
        {auto && <BadgeAuto />}
      </span>
      {children}
    </label>
  );
}

// ============================================================
// PAINEL IA
// ============================================================
function PainelIaProcedimento({
  onDados,
  onArquivo,
}: {
  onDados: (dados: {
    numero: string | null;
    notificacaoNumero: string | null;
    assunto: string;
    descricao: string;
    comissaoMembros: string[];
    autoridade: string | null;
    dataAbertura: string;
  }) => void;
  onArquivo: (url: string, nome: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [ok, setOk] = useState(false);

  async function handle(file: File) {
    setExtraindo(true);
    setErro(null);
    setNome(file.name);
    setOk(false);

    const fd = new FormData();
    fd.append("pdf", file);
    const res = await extrairProcedimentoPdfAction(fd);
    setExtraindo(false);

    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    onDados(res.dados);
    if (res.arquivoUrl) onArquivo(res.arquivoUrl, res.nomeArquivo ?? file.name);
    setDemo(res.demo);
    setOk(true);
  }

  return (
    <section
      className="glass-tile overflow-hidden rounded-[20px] px-6 py-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(197,180,255,0.12), rgba(184,197,214,0.04)), var(--glass-2)",
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, var(--lavender), var(--sky))",
            boxShadow: "0 4px 16px rgba(197,180,255,0.4)",
          }}
        >
          <Sparkles className="h-5 w-5" style={{ color: "#0A0A0A" }} />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
            Preencher a partir do PDF do procedimento
          </h3>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-soft)" }}>
            Anexe o PDF da Portaria de Abertura ou Notificação Inicial — a IA extrai
            número, assunto, comissão (servidores) e autoridade competente.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) handle(f);
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={extraindo}
              className="btn-primary inline-flex disabled:cursor-not-allowed disabled:opacity-60"
            >
              {extraindo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Extraindo dados…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> {nome ? "Outro PDF" : "Anexar PDF"}
                </>
              )}
            </button>
            {nome && !extraindo && (
              <span className="max-w-md truncate text-[11px]" style={{ color: "var(--text-mute)" }}>
                {nome}
              </span>
            )}
            {ok && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold"
                style={{
                  background: "rgba(93,216,182,0.18)",
                  color: "var(--mint)",
                  border: "0.5px solid rgba(93,216,182,0.3)",
                }}
              >
                <Check className="h-3 w-3" /> Campos preenchidos
              </span>
            )}
          </div>

          {erro && (
            <div
              className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[12px]"
              style={{
                background: "rgba(232,138,152,0.10)",
                border: "0.5px solid rgba(232,138,152,0.3)",
                color: "var(--coral)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
          {demo && (
            <div
              className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px]"
              style={{
                background: "rgba(212,175,55,0.10)",
                border: "0.5px solid rgba(212,175,55,0.3)",
                color: "var(--primary-deep)",
              }}
            >
              <Beaker className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Modo demonstração</strong> — dados de exemplo. Configure{" "}
                <code>ANTHROPIC_API_KEY</code> pra extração real.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
