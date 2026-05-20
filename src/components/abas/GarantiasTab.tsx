"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { Shield, Plus, AlertTriangle, FileText, X } from "lucide-react";
import { brl } from "@/lib/validators";
import {
  criarGarantiaAction,
  adicionarEndossoAction,
  marcarSemGarantiaAction,
} from "@/app/actions/contratuais";
import { extrairGarantiaPdfAction } from "@/app/actions/iaExtracao";
import type { GarantiaExtraida } from "@/lib/extrairAta";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import { TooltipAjuda } from "@/components/TooltipAjuda";
import { AJUDA } from "@/lib/textosAjuda";

type Endosso = {
  id: string;
  valor: number;
  dataInicio: Date;
  dataFim: Date | null;
  observacoes: string | null;
  arquivoPdfUrl: string | null;
};

type Garantia = {
  id: string;
  modalidade: string;
  seguradora: string | null;
  banco: string | null;
  valor: number;
  dataInicio: Date;
  dataFim: Date | null;
  descricao: string | null;
  arquivoPdfUrl: string | null;
  endossos: Endosso[];
};

type Modalidade = "SEGURO_GARANTIA" | "FIANCA_BANCARIA" | "CAUCAO_DINHEIRO" | "TITULOS_DIVIDA_PUBLICA";

const MODALIDADES: { value: Modalidade; label: string }[] = [
  { value: "SEGURO_GARANTIA", label: "Seguro-garantia" },
  { value: "FIANCA_BANCARIA", label: "Fiança bancária" },
  { value: "CAUCAO_DINHEIRO", label: "Caução em dinheiro" },
  { value: "TITULOS_DIVIDA_PUBLICA", label: "Títulos da dívida pública" },
];

const LABEL: Record<Modalidade, string> = {
  SEGURO_GARANTIA: "Seguro-garantia",
  FIANCA_BANCARIA: "Fiança bancária",
  CAUCAO_DINHEIRO: "Caução em dinheiro",
  TITULOS_DIVIDA_PUBLICA: "Títulos da dívida pública",
};

// ─────────────────────────────────────────────
// Tab principal
// ─────────────────────────────────────────────
export function GarantiasTab({
  garantias,
  contratoId,
  empenhoId,
  temGarantia,
}: {
  garantias: Garantia[];
  contratoId?: string;
  empenhoId?: string;
  // null = ainda não declarado; true = há previsão; false = sem previsão (explícito)
  temGarantia?: boolean | null;
}) {
  const semGarantia = garantias.length === 0;
  const [adicionando, setAdicionando] = useState(false);
  // Submete imediatamente quando user clica "Sim" ou "Não" — um clique só,
  // sem etapa de "confirmar" que era confusa (Igor: "não tem opção de salvar").
  const [stateMarcar, marcarAction, marcarPending] = useActionState(marcarSemGarantiaAction, null);

  return (
    <div className="space-y-4">
      {/* Banner "Sem previsão" quando user declarou explicitamente */}
      {semGarantia && !adicionando && temGarantia === false && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Sem previsão de garantia</h3>
          </div>
          <p className="text-xs text-slate-600">
            Este registro foi marcado como sem garantia contratual. Pode alterar a qualquer momento.
          </p>
          <form action={marcarAction} className="mt-3">
            {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
            {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
            <input type="hidden" name="valor" value="reset" />
            <button
              type="submit"
              disabled={marcarPending}
              className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {marcarPending ? "Alterando…" : "Alterar — passar a ter previsão de garantia"}
            </button>
          </form>
          {stateMarcar?.erro && (
            <p className="mt-2 text-xs text-red-700">{stateMarcar.erro}</p>
          )}
        </div>
      )}

      {/* Pergunta Sim/Não — clique direto salva (sem etapa intermediária) */}
      {semGarantia && !adicionando && temGarantia !== false && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Garantia contratual</h3>
          </div>
          <p className="mb-4 text-sm text-slate-700">Há previsão de garantia contratual?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAdicionando(true)}
              className="rounded-md border border-blue-600 bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Sim, cadastrar garantia
            </button>
            <form action={marcarAction}>
              {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
              {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
              <input type="hidden" name="valor" value="false" />
              <button
                type="submit"
                disabled={marcarPending}
                className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {marcarPending ? "Salvando…" : "Não, sem previsão"}
              </button>
            </form>
          </div>
          {stateMarcar?.erro && (
            <p className="mt-3 text-xs text-red-700">{stateMarcar.erro}</p>
          )}
        </div>
      )}

      {/* Cards das garantias existentes */}
      {garantias.map((g) => (
        <CardGarantia key={g.id} g={g} />
      ))}

      {/* Formulário de nova garantia */}
      {adicionando && (
        <FormNovaGarantia
          contratoId={contratoId}
          empenhoId={empenhoId}
          onCancelar={() => setAdicionando(false)}
          onSucesso={() => setAdicionando(false)}
        />
      )}

      {/* Botão adicionar — só quando já há ao menos uma garantia */}
      {!semGarantia && !adicionando && (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          <Plus className="h-4 w-4" /> Adicionar garantia
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Formulário de criação de garantia
// ─────────────────────────────────────────────
function FormNovaGarantia({
  contratoId,
  empenhoId,
  onCancelar,
  onSucesso,
}: {
  contratoId?: string;
  empenhoId?: string;
  onCancelar: () => void;
  onSucesso: () => void;
}) {
  const [state, formAction] = useActionState(criarGarantiaAction, null);
  const [modalidade, setModalidade] = useState<Modalidade>("SEGURO_GARANTIA");
  // IA — extração via PDF (M5). Usa o UploadPdfPanel padrão (mesmo layout
  // e drag-and-drop usados nos forms de Ata/Contrato/Empenho).
  const [iaDados, setIaDados] = useState<GarantiaExtraida | null>(null);
  const [iaArquivoUrl, setIaArquivoUrl] = useState<string | null>(null);
  const [iaArquivoNome, setIaArquivoNome] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) onSucesso();
  }, [state?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (iaDados?.modalidade) setModalidade(iaDados.modalidade);
  }, [iaDados]);

  const isSeguro = modalidade === "SEGURO_GARANTIA";
  const isFianca = modalidade === "FIANCA_BANCARIA";
  const isCaucao = modalidade === "CAUCAO_DINHEIRO";
  const isTitulo = modalidade === "TITULOS_DIVIDA_PUBLICA";
  const temEndosso = isSeguro || isFianca;
  const temValorDatas = !isTitulo;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">Nova garantia contratual</h3>
        </div>
        <button type="button" onClick={onCancelar} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* IA — extração automática do PDF (M5). Mesmo painel premium das
          outras telas (drag-and-drop + layout consistente). */}
      <div className="mb-4">
        <UploadPdfPanel
          titulo="Preencher automaticamente a partir do PDF"
          descricao="Anexe a apólice (seguro), o contrato de fiança bancária ou o recibo da caução. A IA extrai modalidade, valor, datas e dados específicos. Você confere antes de salvar."
          action={extrairGarantiaPdfAction}
          onSuccess={setIaDados}
          onArquivoSalvo={(info) => {
            setIaArquivoUrl(info.url);
            setIaArquivoNome(info.nome);
          }}
          badgeAposExtracao={() => "Dados preenchidos · revisar"}
        />
        {iaArquivoNome && (
          <p className="mt-2 text-[10px] text-slate-500">
            PDF anexado: <strong>{iaArquivoNome}</strong> (será salvo na aba Anexos)
          </p>
        )}
      </div>

      <form action={formAction} key={iaDados ? `ia-${iaArquivoNome}` : "manual"} className="space-y-4">
        {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
        {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
        {iaArquivoUrl && (
          <>
            <input type="hidden" name="arquivoPdfUrlIa" value={iaArquivoUrl} />
            <input type="hidden" name="arquivoPdfNomeIa" value={iaArquivoNome ?? ""} />
          </>
        )}

        {/* Modalidade */}
        <Campo label="Modalidade *" ajuda={AJUDA.tipoGarantia}>
          <select
            name="modalidade"
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value as Modalidade)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {MODALIDADES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Campo>

        {/* Seguradora */}
        {isSeguro && (
          <CampoInput
            label="Seguradora *"
            name="seguradora"
            required
            placeholder="Nome da seguradora"
            defaultValue={iaDados?.seguradora ?? undefined}
          />
        )}

        {/* Banco */}
        {isFianca && (
          <CampoInput
            label="Banco *"
            name="banco"
            required
            placeholder="Nome do banco"
            defaultValue={iaDados?.banco ?? undefined}
          />
        )}

        {/* Valor + Datas */}
        {temValorDatas && (
          <div className="grid grid-cols-2 gap-3">
            <CampoInput
              label="Valor (R$) *"
              name="valor"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0,00"
              defaultValue={iaDados?.valor != null ? String(iaDados.valor) : undefined}
            />
            <div />
            <CampoInput
              label="Data de início *"
              name="dataInicio"
              type="date"
              required
              defaultValue={iaDados?.dataInicio}
            />
            <CampoInput
              label="Data de fim"
              name="dataFim"
              type="date"
              defaultValue={iaDados?.dataFim ?? undefined}
            />
          </div>
        )}

        {/* Alerta caução */}
        {isCaucao && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle className="mb-0.5 mr-1 inline-block h-3.5 w-3.5" />
            O sistema vai gerar um alerta próximo ao vencimento para você solicitar o resgate da caução ao órgão contratante.
          </div>
        )}

        {/* Descrição (Títulos da dívida pública) */}
        {isTitulo && (
          <CampoInput
            label="Descrição *"
            name="descricao"
            required
            placeholder="Descreva os títulos da dívida pública"
            defaultValue={iaDados?.descricao ?? undefined}
          />
        )}

        {/* Dica endosso */}
        {temEndosso && (
          <p className="text-xs text-slate-500">
            Após salvar, você poderá adicionar endossos diretamente no card da garantia.
          </p>
        )}

        {/* Upload */}
        <Campo label="Arquivo">
          <input
            type="file"
            name="arquivo"
            accept="application/pdf,image/jpeg,image/png"
            className="w-full text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </Campo>

        {state?.erro && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {state.erro}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Salvar garantia
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// Card de garantia existente
// ─────────────────────────────────────────────
function CardGarantia({ g }: { g: Garantia }) {
  const [endossando, setEndossando] = useState(false);
  // Vigência efetiva = max(garantia.dataFim, ...endossos.dataFim). Calcular
  // dinamicamente garante que dados legacy (endosso cadastrado antes do
  // write-through em adicionarEndossoAction) também mostrem a vigência
  // estendida — sem precisar de migração retroativa.
  const datasFim = [
    g.dataFim,
    ...g.endossos.map((e) => e.dataFim),
  ].filter((d): d is Date => d != null);
  const dataFimEfetiva = datasFim.length
    ? new Date(Math.max(...datasFim.map((d) => d.getTime())))
    : null;
  const estendidaPorEndosso =
    dataFimEfetiva != null && g.dataFim != null && dataFimEfetiva.getTime() > g.dataFim.getTime();
  // Conta dias só por dia calendário UTC (igual ao fix do prazo da entrega).
  const diasAteVencer = (() => {
    if (!dataFimEfetiva) return null;
    const dia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const n = new Date();
    const hoje = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
    return Math.round((dia(dataFimEfetiva) - hoje) / 86400000);
  })();
  const venceBreve = diasAteVencer !== null && diasAteVencer <= 30;
  const vencida = diasAteVencer !== null && diasAteVencer < 0;
  const valorTotal = g.valor + g.endossos.reduce((s, e) => s + e.valor, 0);
  const temEndosso = g.modalidade === "SEGURO_GARANTIA" || g.modalidade === "FIANCA_BANCARIA";

  return (
    <div
      className={`rounded-xl border bg-white p-5 ${
        venceBreve ? "border-amber-300 shadow-sm" : "border-slate-200"
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            {LABEL[g.modalidade as Modalidade] ?? g.modalidade}
          </span>
          {venceBreve && !vencida && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3 w-3" />
              Vence em {diasAteVencer}d
            </span>
          )}
          {vencida && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              Vencida há {Math.abs(diasAteVencer!)}d
            </span>
          )}
        </div>
        {g.arquivoPdfUrl && (
          <a
            href={g.arquivoPdfUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <FileText className="h-3.5 w-3.5" /> Arquivo
          </a>
        )}
      </div>

      {/* Dados */}
      <div className="mt-3 grid gap-x-8 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
        {g.seguradora && (
          <span><span className="font-medium text-slate-700">Seguradora:</span> {g.seguradora}</span>
        )}
        {g.banco && (
          <span><span className="font-medium text-slate-700">Banco:</span> {g.banco}</span>
        )}
        {g.valor > 0 && (
          <span><span className="font-medium text-slate-700">Valor base:</span> {brl(g.valor)}</span>
        )}
        {g.endossos.length > 0 && (
          <span className="font-semibold text-slate-800">Total c/ endossos: {brl(valorTotal)}</span>
        )}
        {g.dataInicio && (
          <span>
            <span className="font-medium text-slate-700">Início:</span>{" "}
            {g.dataInicio.toLocaleDateString("pt-BR")}
          </span>
        )}
        {g.dataFim && (
          <span className={venceBreve ? "font-semibold text-amber-700" : ""}>
            <span className="font-medium text-slate-700">Fim:</span>{" "}
            {g.dataFim.toLocaleDateString("pt-BR")}
            {estendidaPorEndosso && dataFimEfetiva && (
              <span className="ml-1 text-slate-500">
                → prorrogada até <strong>{dataFimEfetiva.toLocaleDateString("pt-BR")}</strong> via endosso
              </span>
            )}
          </span>
        )}
        {g.descricao && <span className="col-span-2 mt-1 text-slate-700">{g.descricao}</span>}
      </div>

      {/* Alerta caução próxima ao vencimento */}
      {g.modalidade === "CAUCAO_DINHEIRO" && venceBreve && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mr-1 inline-block h-3.5 w-3.5" />
          Caução em dinheiro próxima ao vencimento — solicite o resgate ao órgão contratante.
        </div>
      )}

      {/* Lista de endossos */}
      {g.endossos.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <h5 className="mb-2 text-xs font-semibold text-slate-700">Endossos</h5>
          <ul className="space-y-1.5">
            {g.endossos.map((e) => (
              <li key={e.id} className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  <span className="font-semibold text-slate-800">+ {brl(e.valor)}</span>
                  {" · "}
                  {e.dataInicio.toLocaleDateString("pt-BR")}
                  {e.dataFim && <> → {e.dataFim.toLocaleDateString("pt-BR")}</>}
                  {e.observacoes && ` · ${e.observacoes}`}
                </span>
                {e.arquivoPdfUrl && (
                  <a href={e.arquivoPdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
                    <FileText className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Endosso — só Seguro-garantia e Fiança bancária */}
      {temEndosso && (
        <div className="mt-4">
          {!endossando ? (
            <button
              type="button"
              onClick={() => setEndossando(true)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              + Adicionar endosso
            </button>
          ) : (
            <FormEndosso garantiaId={g.id} onCancelar={() => setEndossando(false)} />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Formulário de endosso
// ─────────────────────────────────────────────
function FormEndosso({ garantiaId, onCancelar }: { garantiaId: string; onCancelar: () => void }) {
  const [state, formAction] = useActionState(adicionarEndossoAction, null);

  useEffect(() => {
    if (state?.ok) onCancelar();
  }, [state?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h5 className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <span>Novo endosso</span>
        <TooltipAjuda texto={AJUDA.endossoGarantia} />
      </h5>
      <form action={formAction} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="garantiaId" value={garantiaId} />
        <CampoInput label="Valor (R$) *" name="valor" type="number" step="0.01" min="0" required placeholder="0,00" />
        <div />
        <CampoInput label="Data de início *" name="dataInicio" type="date" required />
        <CampoInput label="Data de fim" name="dataFim" type="date" />
        <div className="col-span-2">
          <CampoInput label="Observações" name="observacoes" placeholder="Ex: renovação, ampliação de cobertura…" />
        </div>

        {/* Upload */}
        <Campo label="Arquivo" className="col-span-2">
          <input
            type="file"
            name="arquivo"
            accept="application/pdf,image/jpeg,image/png"
            className="w-full text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </Campo>

        {state?.erro && (
          <div className="col-span-2 text-xs text-red-700">{state.erro}</div>
        )}

        <div className="col-span-2 flex gap-2">
          <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            Salvar endosso
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// Utilitários de campo
// ─────────────────────────────────────────────
function Campo({
  label,
  children,
  className,
  ajuda,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  ajuda?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <span>{label}</span>
        {ajuda && <TooltipAjuda texto={ajuda} />}
      </span>
      {children}
    </div>
  );
}

function CampoInput({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        {...props}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}
