"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Award, Check, Clock, X } from "lucide-react";
import {
  dispensarAtestadoAction,
  marcarAtestadoSolicitadoAction,
  reabrirAtestadoAction,
} from "@/app/actions/atestados";
import type { SituacaoAtestado } from "@/lib/atestados";

/**
 * Formata a data SEMPRE em UTC, e não no fuso de quem está olhando.
 *
 * Estas datas são marcos de calendário, não instantes: a vigência é gravada em
 * 00:00 UTC e a solicitação em 12:00 UTC. Num componente client, o
 * `toLocaleDateString` padrão roda duas vezes — no servidor (UTC) e no
 * navegador (BRT, três horas atrás) — e uma vigência que termina em 11/09
 * apareceria como 10/09 pro cliente, além de quebrar a hidratação por
 * divergir do HTML que o servidor mandou.
 */
function dataBr(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * O alerta de Atestado de Capacidade Técnica no detalhe da Ata/Contrato.
 *
 * Regina 11/09: encerrada a contratação, avisar que é hora de pedir o atestado
 * ao órgão. O que o desenho acrescenta ao pedido é a saída: o banner traz as
 * três respostas possíveis ali mesmo ("já pedi", "não vou pedir", "anexar"),
 * porque um alerta que só avisa e não deixa responder fica na tela pra sempre.
 *
 * Dispensar não apaga nada nem impede voltar atrás — é um "não agora" com
 * registro em auditoria e um botão de reabrir.
 */
export function AlertaAtestado({
  situacao,
  ataId,
  contratoId,
  rotulo,
  hrefAnexar,
}: {
  situacao: SituacaoAtestado;
  ataId?: string;
  contratoId?: string;
  /** "Ata" ou "Contrato" — entra no texto pra mensagem não ficar genérica. */
  rotulo: "Ata" | "Contrato";
  /** Rota que abre a aba de anexo (`?aba=atestados`). */
  hrefAnexar?: string;
}) {
  const [formAberto, setFormAberto] = useState<"solicitado" | "dispensar" | null>(null);

  if (situacao.estado === "VIGENTE" || situacao.estado === "ANEXADO") return null;

  const idsOcultos = (
    <>
      {ataId && <input type="hidden" name="ataId" value={ataId} />}
      {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
    </>
  );

  if (situacao.estado === "DISPENSADO") {
    return (
      <Caixa tom="neutro">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Atestado de Capacidade Técnica dispensado em {dataBr(situacao.em)}
            {situacao.motivo ? ` — ${situacao.motivo}` : ""}.
          </span>
          <FormBotao
            action={reabrirAtestadoAction}
            idsOcultos={idsOcultos}
            label="Voltar a cobrar"
            titulo="Reabre a pendência e o alerta volta a aparecer"
          />
        </div>
      </Caixa>
    );
  }

  if (situacao.estado === "AGUARDANDO_ORGAO") {
    const { diasDeEspera, solicitadoEm } = situacao;
    // 45 dias é onde a espera deixa de ser normal: a essa altura o processo
    // saiu da mesa de quem executou e vale insistir com o fiscal do contrato.
    const demorou = diasDeEspera >= 45;
    return (
      <Caixa tom={demorou ? "atencao" : "neutro"} icone={<Clock className="h-4 w-4 shrink-0" />}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Atestado solicitado ao órgão em {dataBr(solicitadoEm)} —{" "}
            {diasDeEspera === 0 ? "hoje" : `há ${diasDeEspera} dia${diasDeEspera > 1 ? "s" : ""}`}
            {demorou ? ". Vale cobrar o fiscal do contrato." : ", aguardando emissão."}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {hrefAnexar && <LinkSecundario href={hrefAnexar}>Já recebi, anexar</LinkSecundario>}
            <FormBotao
              action={reabrirAtestadoAction}
              idsOcultos={idsOcultos}
              label="Não cheguei a pedir"
              titulo="Desfaz a marcação de solicitado"
            />
          </div>
        </div>
      </Caixa>
    );
  }

  // PENDENTE — o caso que o pedido da Regina descreve.
  const { diasDesdeEncerramento, encerradaEm } = situacao;
  return (
    <Caixa tom="atencao" icone={<Award className="h-4 w-4 shrink-0" />}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {rotulo === "Ata" ? "Esta Ata encerrou" : "Este Contrato encerrou"} em{" "}
          {dataBr(encerradaEm)}
          {diasDesdeEncerramento > 1 ? ` (há ${diasDesdeEncerramento} dias)` : ""}. Solicite ao
          órgão o <strong>Atestado de Capacidade Técnica</strong> — é ele que comprova sua
          qualificação técnica nas próximas licitações.
        </span>
        {formAberto === null && (
          <div className="flex flex-wrap items-center gap-2">
            {hrefAnexar && <LinkSecundario href={hrefAnexar}>Anexar atestado</LinkSecundario>}
            <BotaoSecundario onClick={() => setFormAberto("solicitado")}>
              Já solicitei
            </BotaoSecundario>
            <BotaoSecundario onClick={() => setFormAberto("dispensar")}>
              Não vou solicitar
            </BotaoSecundario>
          </div>
        )}
      </div>

      {formAberto === "solicitado" && (
        <FormAcao
          action={marcarAtestadoSolicitadoAction}
          idsOcultos={idsOcultos}
          onFechar={() => setFormAberto(null)}
          enviar="Confirmar solicitação"
        >
          <label className="flex items-center gap-2">
            <span className="text-[12px] font-semibold">Data em que pediu ao órgão</span>
            <input
              type="date"
              name="solicitadoEm"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
              style={{ border: "0.5px solid var(--border-soft)", background: "var(--glass-2)" }}
            />
          </label>
        </FormAcao>
      )}

      {formAberto === "dispensar" && (
        <FormAcao
          action={dispensarAtestadoAction}
          idsOcultos={idsOcultos}
          onFechar={() => setFormAberto(null)}
          enviar="Dispensar atestado"
        >
          <input
            name="motivo"
            placeholder="Motivo (opcional) — ex: nada foi executado"
            className="min-w-[260px] flex-1 rounded-lg px-3 py-1.5 text-[12px] font-medium"
            style={{ border: "0.5px solid var(--border-soft)", background: "var(--glass-2)" }}
          />
        </FormAcao>
      )}
    </Caixa>
  );
}

// ============================================================
// Peças de UI
// ============================================================

function Caixa({
  tom,
  icone,
  children,
}: {
  tom: "atencao" | "neutro";
  icone?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cores =
    tom === "atencao"
      ? { bg: "rgba(212,175,55,0.10)", border: "rgba(168,137,71,0.30)", fg: "var(--primary-deep)" }
      : { bg: "var(--glass-2)", border: "var(--border-soft)", fg: "var(--text-soft)" };
  return (
    <div
      className="glass rounded-[14px] px-5 py-3 text-sm"
      style={{ background: cores.bg, border: `0.5px solid ${cores.border}`, color: cores.fg }}
    >
      <div className="flex items-start gap-2" style={{ fontWeight: 600 }}>
        {icone ?? <Award className="h-4 w-4 shrink-0" />}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

function BotaoSecundario({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition hover:opacity-80"
      style={{
        background: "var(--glass-2)",
        border: "0.5px solid var(--border-soft)",
        color: "var(--text)",
      }}
    >
      {children}
    </button>
  );
}

/** Mesmo visual do botão, mas navega — leva pra aba onde o PDF é anexado. */
function LinkSecundario({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition hover:opacity-80"
      style={{
        background: "var(--glass-2)",
        border: "0.5px solid var(--border-soft)",
        color: "var(--text)",
      }}
    >
      {children}
    </Link>
  );
}

type ResultadoAction = { ok: true } | { ok: false; erro: string };

/** Botão único que dispara uma action sem campos extras. */
function FormBotao({
  action,
  idsOcultos,
  label,
  titulo,
}: {
  action: (prev: ResultadoAction | null, fd: FormData) => Promise<ResultadoAction>;
  idsOcultos: React.ReactNode;
  label: string;
  titulo?: string;
}) {
  const [state, formAction, pendente] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      {idsOcultos}
      <button
        type="submit"
        disabled={pendente}
        title={titulo}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition hover:opacity-80 disabled:opacity-50"
        style={{
          background: "var(--glass-2)",
          border: "0.5px solid var(--border-soft)",
          color: "var(--text)",
        }}
      >
        {label}
      </button>
      {state && !state.ok && (
        <span className="text-[11px] font-semibold" style={{ color: "var(--coral-deep)" }}>
          {state.erro}
        </span>
      )}
    </form>
  );
}

/** Formulário inline com um campo + confirmar/cancelar. */
function FormAcao({
  action,
  idsOcultos,
  onFechar,
  enviar,
  children,
}: {
  action: (prev: ResultadoAction | null, fd: FormData) => Promise<ResultadoAction>;
  idsOcultos: React.ReactNode;
  onFechar: () => void;
  enviar: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pendente] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2 pl-6">
      {idsOcultos}
      {children}
      <button
        type="submit"
        disabled={pendente}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition hover:opacity-80 disabled:opacity-50"
        style={{
          background: "rgba(63,99,143,0.12)",
          border: "0.5px solid rgba(63,99,143,0.25)",
          color: "var(--sky-deep, #3F638F)",
        }}
      >
        <Check className="h-3.5 w-3.5" /> {enviar}
      </button>
      <button
        type="button"
        onClick={onFechar}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition hover:opacity-80"
        style={{ color: "var(--text-mute)" }}
      >
        <X className="h-3.5 w-3.5" /> Cancelar
      </button>
      {state && !state.ok && (
        <span className="text-[11px] font-semibold" style={{ color: "var(--coral-deep)" }}>
          {state.erro}
        </span>
      )}
    </form>
  );
}
