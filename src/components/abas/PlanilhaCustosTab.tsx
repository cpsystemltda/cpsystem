"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  X,
  Pencil,
  Layers,
} from "lucide-react";
import { brl } from "@/lib/validators";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import {
  excluirPlanilhaCustosAction,
  lerPlanilhasCustosAction,
  salvarPlanilhaCustosAction,
  type SalvarPlanilhaInput,
} from "@/app/actions/planilhaCustos";
import type { PlanilhaCustosExtraida } from "@/lib/extrairAta";
import {
  MODULOS,
  ROTULO_ORIGEM,
  TOLERANCIA_DIVERGENCIA,
  dataBr,
  derivadosDaPlanilha,
  divergencia,
  subtotalPorModulo,
  sugerirItemParaFuncao,
  templateLinhas,
  type CodigoModulo,
  type ItemFuncao,
  type LinhaPlanilha,
  type PlanilhaDto,
} from "@/lib/planilhaCustos";

/**
 * Aba "Planilha de custos" do contrato de mão de obra (ESP-003, Igor
 * 07/11/2026). Fluxo: ler o PDF/Excel da proposta → conferir função por
 * função (RN04, obrigatório) → salvar versionado (RN06). Cadastro manual usa
 * o mesmo formulário (RN08).
 */

type Origem = "PROPOSTA" | "REPACTUACAO" | "REAJUSTE" | "MANUAL";
const ORIGENS: Origem[] = ["PROPOSTA", "REPACTUACAO", "REAJUSTE", "MANUAL"];

type LinhaForm = {
  key: string;
  modulo: CodigoModulo;
  descricao: string;
  percentual: string;
  valor: string;
  aRevisar: boolean;
};

type Rascunho = {
  id?: string;
  versaoEditando?: number;
  funcao: string;
  contratoItemId: string | null;
  dataEfeito: string;
  origem: Origem;
  origemRef: string;
  cct: string;
  justificativaDivergencia: string;
  arquivoUrl: string | null;
  linhas: LinhaForm[];
  /** Vínculo sugerido automaticamente (a pessoa confirma ou troca). */
  itemSugerido?: boolean;
};

type Modo =
  | { tipo: "lista" }
  | { tipo: "upload" }
  | { tipo: "conferencia"; fila: Rascunho[]; idx: number; arquivos: { url: string; nome: string }[] }
  | { tipo: "form"; rascunho: Rascunho; titulo: string };

let seq = 0;
const novaKey = () => `l${++seq}`;

function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s|R\$|%/g, "");
  if (!t) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
}
function fmtNum(n: number | null | undefined): string {
  if (n == null) return "";
  return (Math.round(n * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function linhaForm(l: LinhaPlanilha): LinhaForm {
  return { key: novaKey(), modulo: l.modulo, descricao: l.descricao, percentual: fmtNum(l.percentual), valor: fmtNum(l.valor), aRevisar: !!l.aRevisar };
}
function linhasDoForm(ls: LinhaForm[]): LinhaPlanilha[] {
  return ls.map((l) => ({ modulo: l.modulo, descricao: l.descricao, percentual: parseNum(l.percentual), valor: parseNum(l.valor) ?? 0, aRevisar: l.aRevisar }));
}
function totalForm(ls: LinhaForm[]): number {
  return Math.round(ls.reduce((s, l) => s + (parseNum(l.valor) ?? 0), 0) * 100) / 100;
}

export function PlanilhaCustosTab({
  contratoId,
  itens,
  planilhas,
  podeEditar,
  hojeIso,
  dataEfeitoPadrao,
}: {
  contratoId: string;
  itens: ItemFuncao[];
  planilhas: PlanilhaDto[];
  podeEditar: boolean;
  hojeIso: string;
  dataEfeitoPadrao: string;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>({ tipo: "lista" });
  const [aviso, setAviso] = useState<string | null>(null);

  const itensSelecionaveis = useMemo(() => {
    const atuais = itens.filter((i) => i.atual);
    return atuais.length > 0 ? atuais : itens;
  }, [itens]);

  function rascunhoVazio(base?: Partial<Rascunho>): Rascunho {
    return {
      funcao: "",
      contratoItemId: null,
      dataEfeito: dataEfeitoPadrao,
      origem: planilhas.length === 0 ? "PROPOSTA" : "MANUAL",
      origemRef: "",
      cct: "",
      justificativaDivergencia: "",
      arquivoUrl: null,
      linhas: templateLinhas().map(linhaForm),
      ...base,
    };
  }

  function iniciarConferencia(dados: PlanilhaCustosExtraida[]) {
    const fila: Rascunho[] = dados.map((p) => {
      const sugerido = sugerirItemParaFuncao(p.funcao, itensSelecionaveis);
      return {
        funcao: p.funcao,
        contratoItemId: sugerido?.id ?? null,
        itemSugerido: !!sugerido,
        dataEfeito: dataEfeitoPadrao,
        origem: "PROPOSTA",
        origemRef: "",
        cct: p.cct ?? "",
        justificativaDivergencia: "",
        arquivoUrl: null,
        linhas: p.linhas.map(linhaForm),
      };
    });
    setModo({ tipo: "conferencia", fila, idx: 0, arquivos: [] });
  }

  function aplicarArquivos(arquivos: { url: string; nome: string }[]) {
    setModo((m) => {
      if (m.tipo !== "conferencia") return m;
      const pdf = arquivos.find((a) => /\.pdf$/i.test(a.nome)) ?? arquivos[0];
      return { ...m, arquivos, fila: m.fila.map((r) => ({ ...r, arquivoUrl: pdf?.url ?? null })) };
    });
  }

  function concluirSalvamento(msg: string) {
    setAviso(msg);
    router.refresh();
  }

  // ── Conferência (fila após a leitura) ─────────────────────────────
  if (modo.tipo === "conferencia") {
    const atual = modo.fila[modo.idx];
    if (!atual) {
      setModo({ tipo: "lista" });
      return null;
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-violet-900">
            <Sparkles className="h-4 w-4" />
            <strong>Conferência</strong> · planilha {modo.idx + 1} de {modo.fila.length}
            <span className="text-violet-700">· confira os valores lidos antes de salvar; nada foi gravado ainda.</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md p-1.5 text-violet-800 hover:bg-violet-100 disabled:opacity-40"
              disabled={modo.idx === 0}
              onClick={() => setModo({ ...modo, idx: modo.idx - 1 })}
              aria-label="Planilha anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md p-1.5 text-violet-800 hover:bg-violet-100 disabled:opacity-40"
              disabled={modo.idx >= modo.fila.length - 1}
              onClick={() => setModo({ ...modo, idx: modo.idx + 1 })}
              aria-label="Próxima planilha"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
              onClick={() => {
                if (confirm("Descartar as planilhas ainda não salvas?")) setModo({ tipo: "lista" });
              }}
            >
              <X className="h-3.5 w-3.5" /> Descartar o restante
            </button>
          </div>
        </div>
        <FormPlanilha
          key={`${modo.idx}-${atual.funcao}`}
          contratoId={contratoId}
          inicial={atual}
          itens={itensSelecionaveis}
          hojeIso={hojeIso}
          arquivos={modo.arquivos}
          rotuloSalvar={modo.fila.length > 1 ? "Salvar e ir para a próxima" : "Salvar planilha"}
          onCancelar={() => {
            // "Pular" esta função: sai da fila sem salvar.
            const fila = modo.fila.filter((_, i) => i !== modo.idx);
            if (fila.length === 0) setModo({ tipo: "lista" });
            else setModo({ ...modo, fila, idx: Math.min(modo.idx, fila.length - 1) });
          }}
          rotuloCancelar="Pular esta função"
          onSalvo={() => {
            const fila = modo.fila.filter((_, i) => i !== modo.idx);
            if (fila.length === 0) {
              setModo({ tipo: "lista" });
              concluirSalvamento(`${modo.fila.length} planilha${modo.fila.length === 1 ? "" : "s"} salva${modo.fila.length === 1 ? "" : "s"}.`);
            } else {
              setModo({ ...modo, fila, idx: Math.min(modo.idx, fila.length - 1) });
              router.refresh();
            }
          }}
        />
      </div>
    );
  }

  // ── Formulário avulso (manual, nova versão, correção) ─────────────
  if (modo.tipo === "form") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">{modo.titulo}</p>
          <button type="button" className="text-xs text-slate-600 hover:underline" onClick={() => setModo({ tipo: "lista" })}>
            Voltar sem salvar
          </button>
        </div>
        <FormPlanilha
          contratoId={contratoId}
          inicial={modo.rascunho}
          itens={itensSelecionaveis}
          hojeIso={hojeIso}
          arquivos={[]}
          rotuloSalvar={modo.rascunho.id ? "Salvar correção" : "Salvar planilha"}
          onCancelar={() => setModo({ tipo: "lista" })}
          rotuloCancelar="Cancelar"
          onSalvo={(r) => {
            setModo({ tipo: "lista" });
            concluirSalvamento(modo.rascunho.id ? "Planilha corrigida." : `Planilha salva como versão ${r.versao}.`);
          }}
        />
      </div>
    );
  }

  // ── Upload ────────────────────────────────────────────────────────
  if (modo.tipo === "upload") {
    return (
      <div className="space-y-4">
        <UploadPdfPanel<PlanilhaCustosExtraida[]>
          titulo="Ler a planilha de custos com IA"
          descricao="Envie o PDF da proposta (ou a planilha em Excel). A leitura separa uma planilha por função, no modelo da IN 5/2017, e abre a conferência antes de salvar."
          multiplos
          extensoes={[".pdf", ".xlsx", ".xls"]}
          rotuloLista="Pode ser um PDF com todas as funções ou um arquivo por função; planilhas em Excel com uma aba por função também valem."
          action={(fd) => {
            fd.append("contratoId", contratoId);
            return lerPlanilhasCustosAction(fd);
          }}
          onSuccess={(dados) => iniciarConferencia(dados)}
          onArquivosSalvos={(arquivos) => aplicarArquivos(arquivos)}
          badgeAposExtracao={(dados) => `${dados.length} ${dados.length === 1 ? "função encontrada" : "funções encontradas"}`}
        />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Planilha consolidada (várias funções num total só)? Cadastre manualmente, uma função por vez.</span>
          <button type="button" className="text-slate-700 hover:underline" onClick={() => setModo({ tipo: "lista" })}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────
  return (
    <ListaPlanilhas
      planilhas={planilhas}
      itens={itens}
      podeEditar={podeEditar}
      aviso={aviso}
      onFecharAviso={() => setAviso(null)}
      onImportar={() => setModo({ tipo: "upload" })}
      onManual={(item) =>
        setModo({
          tipo: "form",
          titulo: item ? `Cadastro manual · ${item.descricao}` : "Cadastro manual de planilha de custos",
          rascunho: rascunhoVazio(item ? { funcao: item.descricao, contratoItemId: item.id, itemSugerido: true } : {}),
        })
      }
      onNovaVersao={(p) =>
        setModo({
          tipo: "form",
          titulo: `Nova versão · ${p.funcao} (a partir da versão ${p.versao})`,
          rascunho: {
            funcao: p.funcao,
            contratoItemId: p.contratoItemId,
            dataEfeito: hojeIso,
            origem: "REPACTUACAO",
            origemRef: "",
            cct: p.cct ?? "",
            justificativaDivergencia: "",
            arquivoUrl: null,
            linhas: p.linhas.map(linhaForm),
          },
        })
      }
      onCorrigir={(p) =>
        setModo({
          tipo: "form",
          titulo: `Corrigir · ${p.funcao} · versão ${p.versao}`,
          rascunho: {
            id: p.id,
            versaoEditando: p.versao,
            funcao: p.funcao,
            contratoItemId: p.contratoItemId,
            dataEfeito: p.dataEfeito.slice(0, 10),
            origem: (ORIGENS.includes(p.origem as Origem) ? p.origem : "MANUAL") as Origem,
            origemRef: p.origemRef ?? "",
            cct: p.cct ?? "",
            justificativaDivergencia: p.justificativaDivergencia ?? "",
            arquivoUrl: p.arquivoUrl,
            linhas: p.linhas.map(linhaForm),
          },
        })
      }
      onExcluido={() => concluirSalvamento("Planilha excluída.")}
    />
  );
}

// ─────────────────────────────────────────────
// Lista: seletor de função e de versão + leitura
// ─────────────────────────────────────────────
function ListaPlanilhas({
  planilhas,
  itens,
  podeEditar,
  aviso,
  onFecharAviso,
  onImportar,
  onManual,
  onNovaVersao,
  onCorrigir,
  onExcluido,
}: {
  planilhas: PlanilhaDto[];
  itens: ItemFuncao[];
  podeEditar: boolean;
  aviso: string | null;
  onFecharAviso: () => void;
  onImportar: () => void;
  onManual: (item: ItemFuncao | null) => void;
  onNovaVersao: (p: PlanilhaDto) => void;
  onCorrigir: (p: PlanilhaDto) => void;
  onExcluido: () => void;
}) {
  const grupos = useMemo(() => {
    const map = new Map<string, { chave: string; rotulo: string; item: ItemFuncao | null; versoes: PlanilhaDto[] }>();
    for (const p of planilhas) {
      const chave = p.contratoItemId ?? `funcao:${p.funcao}`;
      const item = p.contratoItemId ? itens.find((i) => i.id === p.contratoItemId) ?? null : null;
      const g = map.get(chave) ?? { chave, rotulo: item?.descricao ?? p.funcao, item, versoes: [] };
      g.versoes.push(p);
      map.set(chave, g);
    }
    for (const g of map.values()) g.versoes.sort((a, b) => b.versao - a.versao);
    return [...map.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [planilhas, itens]);

  const [grupoSel, setGrupoSel] = useState<string>(grupos[0]?.chave ?? "");
  const grupo = grupos.find((g) => g.chave === grupoSel) ?? grupos[0] ?? null;
  const [versaoSel, setVersaoSel] = useState<string>("");
  const planilha = grupo ? grupo.versoes.find((v) => v.id === versaoSel) ?? grupo.versoes[0] : null;

  const semPlanilha = itens.filter((i) => i.atual && !planilhas.some((p) => p.contratoItemId === i.id));
  const [excluindo, startExcluir] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function excluir(p: PlanilhaDto) {
    if (!confirm(`Excluir a versão ${p.versao} da planilha "${p.funcao}"? Esta ação não pode ser desfeita.`)) return;
    startExcluir(async () => {
      const r = await excluirPlanilhaCustosAction(p.id);
      if (!r.ok) setErro(r.erro);
      else onExcluido();
    });
  }

  return (
    <div className="space-y-4">
      {aviso && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" /> {aviso}
          </span>
          <button type="button" onClick={onFecharAviso} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{erro}</p>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Planilha de custos e formação de preços</h3>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-600">
            Uma planilha por função, no modelo da IN SEGES/MP 5/2017 (Anexo VII-D). A da proposta é a versão 1; repactuações e
            reajustes geram novas versões com data de efeito. É a base da conta vinculada, da repactuação e dos relatórios.
          </p>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onImportar} className="btn-primary inline-flex">
              <Sparkles className="h-4 w-4" /> Ler planilha (PDF ou Excel)
            </button>
            <button type="button" onClick={() => onManual(null)} className="btn-secondary inline-flex">
              <Plus className="h-4 w-4" /> Cadastrar manualmente
            </button>
          </div>
        )}
      </div>

      {planilhas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-800">Nenhuma planilha de custos cadastrada</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">
            Envie o PDF da proposta vencedora: a leitura separa uma planilha por função e você confere os valores antes de salvar.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_200px]">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Função</span>
              <select
                className="input mt-1 w-full"
                value={grupo?.chave ?? ""}
                onChange={(e) => {
                  setGrupoSel(e.target.value);
                  setVersaoSel("");
                }}
              >
                {grupos.map((g) => (
                  <option key={g.chave} value={g.chave}>
                    {g.rotulo}
                    {g.item ? "" : " (sem vínculo com item)"} · {g.versoes.length} {g.versoes.length === 1 ? "versão" : "versões"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Versão</span>
              <select className="input mt-1 w-full" value={planilha?.id ?? ""} onChange={(e) => setVersaoSel(e.target.value)}>
                {grupo?.versoes.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versao} · {dataBr(v.dataEfeito)} · {ROTULO_ORIGEM[v.origem] ?? v.origem}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {planilha && (
            <LeituraPlanilha
              planilha={planilha}
              item={grupo?.item ?? null}
              ehAtual={grupo?.versoes[0]?.id === planilha.id}
              podeEditar={podeEditar}
              excluindo={excluindo}
              onNovaVersao={() => onNovaVersao(planilha)}
              onCorrigir={() => onCorrigir(planilha)}
              onExcluir={() => excluir(planilha)}
            />
          )}
        </>
      )}

      {semPlanilha.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-900">
            {semPlanilha.length === 1 ? "Função sem planilha de custos" : `${semPlanilha.length} funções sem planilha de custos`}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {semPlanilha.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  disabled={!podeEditar}
                  onClick={() => onManual(i)}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-900 hover:bg-amber-100 disabled:cursor-default disabled:hover:bg-white"
                  title={podeEditar ? "Cadastrar manualmente" : undefined}
                >
                  {i.descricao}
                  {podeEditar && <Plus className="h-3 w-3" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LeituraPlanilha({
  planilha: p,
  item,
  ehAtual,
  podeEditar,
  excluindo,
  onNovaVersao,
  onCorrigir,
  onExcluir,
}: {
  planilha: PlanilhaDto;
  item: ItemFuncao | null;
  ehAtual: boolean;
  podeEditar: boolean;
  excluindo: boolean;
  onNovaVersao: () => void;
  onCorrigir: () => void;
  onExcluir: () => void;
}) {
  const sub = subtotalPorModulo(p.linhas);
  const dif = divergencia(p.totalMensal, item?.valorUnitario);
  const divergente = dif != null && Math.abs(dif) > TOLERANCIA_DIVERGENCIA;
  const der = derivadosDaPlanilha(p.linhas);
  const pct = (n: number | null) => (n == null ? "—" : `${fmtNum(n)}%`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${ehAtual ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          Versão {p.versao}
          {ehAtual ? " · vigente" : " · consulta"}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Efeito a partir de {dataBr(p.dataEfeito)}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          {ROTULO_ORIGEM[p.origem] ?? p.origem}
          {p.origemRef ? ` · ${p.origemRef}` : ""}
        </span>
        {p.cct && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700" title={p.cct}>
            CCT: {p.cct.length > 60 ? `${p.cct.slice(0, 60)}…` : p.cct}
          </span>
        )}
        {p.mapeamentoARevisar && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900">
            <AlertTriangle className="h-3 w-3" /> Mapeamento a revisar
          </span>
        )}
        {p.arquivoUrl && (
          <a href={p.arquivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
            <FileText className="h-3.5 w-3.5" /> Documento original
          </a>
        )}
        <span className="ml-auto flex flex-wrap gap-1.5">
          <a href={`/api/planilha-custos/${p.id}?formato=xlsx`} className="btn-secondary inline-flex !px-2.5 !py-1 text-xs">
            <Download className="h-3.5 w-3.5" /> Excel
          </a>
          <a href={`/api/planilha-custos/${p.id}?formato=pdf`} target="_blank" rel="noreferrer" className="btn-secondary inline-flex !px-2.5 !py-1 text-xs">
            <Download className="h-3.5 w-3.5" /> PDF
          </a>
          {podeEditar && (
            <>
              <button type="button" onClick={onNovaVersao} className="btn-secondary inline-flex !px-2.5 !py-1 text-xs">
                <Layers className="h-3.5 w-3.5" /> Nova versão
              </button>
              <button type="button" onClick={onCorrigir} className="btn-secondary inline-flex !px-2.5 !py-1 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Corrigir
              </button>
              <button
                type="button"
                onClick={onExcluir}
                disabled={excluindo}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            </>
          )}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Descrição</th>
              <th className="w-24 px-3 py-2 text-right font-semibold">%</th>
              <th className="w-36 px-3 py-2 text-right font-semibold">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((m) => {
              const ls = p.linhas.filter((l) => l.modulo === m.codigo);
              if (ls.length === 0) return null;
              return (
                <ModuloLeitura key={m.codigo} titulo={m.titulo} linhas={ls} subtotal={sub[m.codigo] ?? 0} />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white">
              <td className="px-3 py-2.5 font-semibold">Total mensal por posto</td>
              <td />
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{brl(p.totalMensal)}</td>
            </tr>
            {item && dif != null && (
              <tr className={divergente ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}>
                <td className="px-3 py-2 text-xs" colSpan={2}>
                  {divergente ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Difere {brl(Math.abs(dif))} do valor mensal unitário do item ({brl(item.valorUnitario)})
                      {p.justificativaDivergencia ? ` — justificativa: ${p.justificativaDivergencia}` : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Bate com o valor mensal unitário do item ({brl(item.valorUnitario)})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{dif === 0 ? "—" : `${dif > 0 ? "+" : "−"}${brl(Math.abs(dif))}`}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dados derivados (base da conta vinculada e da repactuação)</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Salário-base", der.salarioBase == null ? "—" : brl(der.salarioBase)],
            ["Remuneração (mód. 1)", brl(der.remuneracao)],
            ["13º", pct(der.pct13)],
            ["Férias + 1/3", pct(der.pctFerias)],
            ["Multa do FGTS", pct(der.pctMultaFgts)],
            ["Incidência 2.2", pct(der.pctIncidencia22)],
            ["Insumos (mód. 5)", brl(der.insumos)],
            ["Custos indiretos", pct(der.pctCustosIndiretos)],
            ["Lucro", pct(der.pctLucro)],
            ["Tributos", pct(der.pctTributos)],
            ["Mão de obra (1 a 4)", brl(der.totalMaoDeObra)],
            ["Módulo 6", brl(der.totalModulo6)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">{k}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function ModuloLeitura({ titulo, linhas, subtotal }: { titulo: string; linhas: PlanilhaDto["linhas"]; subtotal: number }) {
  return (
    <>
      <tr className="bg-amber-50/60">
        <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold text-slate-800">
          {titulo}
        </td>
      </tr>
      {linhas.map((l) => (
        <tr key={l.id} className="border-t border-slate-100">
          <td className="px-3 py-1.5 text-slate-800">
            {l.descricao}
            {l.aRevisar && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900" title="Classificação por aproximação — confira">
                a revisar
              </span>
            )}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{l.percentual == null ? "" : `${fmtNum(l.percentual)}%`}</td>
          <td className="px-3 py-1.5 text-right tabular-nums text-slate-900">{brl(l.valor)}</td>
        </tr>
      ))}
      <tr className="border-t border-slate-200 bg-slate-50">
        <td className="px-3 py-1.5 text-xs text-slate-500" colSpan={2}>
          Subtotal
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-800">{brl(subtotal)}</td>
      </tr>
    </>
  );
}

// ─────────────────────────────────────────────
// Formulário de conferência / cadastro (RN04, RN08)
// ─────────────────────────────────────────────
function FormPlanilha({
  contratoId,
  inicial,
  itens,
  hojeIso,
  arquivos,
  rotuloSalvar,
  rotuloCancelar,
  onCancelar,
  onSalvo,
}: {
  contratoId: string;
  inicial: Rascunho;
  itens: ItemFuncao[];
  hojeIso: string;
  arquivos: { url: string; nome: string }[];
  rotuloSalvar: string;
  rotuloCancelar: string;
  onCancelar: () => void;
  onSalvo: (r: { id: string; versao: number }) => void;
}) {
  const [r, setR] = useState<Rascunho>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  const item = itens.find((i) => i.id === r.contratoItemId) ?? null;
  const total = totalForm(r.linhas);
  const dif = divergencia(total, item?.valorUnitario);
  const divergente = dif != null && Math.abs(dif) > TOLERANCIA_DIVERGENCIA;
  const sub = subtotalPorModulo(linhasDoForm(r.linhas));
  const previewPdf = r.arquivoUrl && arquivos.some((a) => a.url === r.arquivoUrl && /\.pdf$/i.test(a.nome)) ? r.arquivoUrl : r.arquivoUrl && /\.pdf/i.test(r.arquivoUrl) ? r.arquivoUrl : null;
  const temLadoEsquerdo = arquivos.length > 0 || !!r.arquivoUrl;

  function setLinha(key: string, patch: Partial<LinhaForm>) {
    setR((x) => ({ ...x, linhas: x.linhas.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  }
  function addLinha(modulo: CodigoModulo) {
    setR((x) => {
      // Insere depois da última linha do módulo, para manter o agrupamento.
      const idx = x.linhas.map((l) => l.modulo).lastIndexOf(modulo);
      const nova: LinhaForm = { key: novaKey(), modulo, descricao: "", percentual: "", valor: "", aRevisar: false };
      const linhas = [...x.linhas];
      linhas.splice(idx < 0 ? linhas.length : idx + 1, 0, nova);
      return { ...x, linhas };
    });
  }
  function removerLinha(key: string) {
    setR((x) => ({ ...x, linhas: x.linhas.filter((l) => l.key !== key) }));
  }

  function salvar() {
    setErro(null);
    if (!r.funcao.trim()) return setErro("Informe o nome da função.");
    const linhas = r.linhas.filter((l) => l.descricao.trim() || l.valor.trim());
    if (linhas.length === 0) return setErro("A planilha precisa de ao menos uma linha com valor.");
    const semDescricao = linhas.find((l) => !l.descricao.trim());
    if (semDescricao) return setErro("Há linha com valor e sem descrição.");
    const valorInvalido = linhas.find((l) => l.valor.trim() && parseNum(l.valor) == null);
    if (valorInvalido) return setErro(`Valor inválido em "${valorInvalido.descricao}".`);
    if (divergente && !r.justificativaDivergencia.trim()) {
      return setErro("O total difere do valor mensal do item em mais de R$ 0,05. Informe a justificativa para salvar mesmo assim.");
    }
    const input: SalvarPlanilhaInput = {
      id: r.id,
      contratoId,
      contratoItemId: r.contratoItemId,
      funcao: r.funcao.trim(),
      dataEfeito: r.dataEfeito,
      origem: r.origem,
      origemRef: r.origemRef.trim() || null,
      cct: r.cct.trim() || null,
      justificativaDivergencia: divergente ? r.justificativaDivergencia.trim() : null,
      arquivoUrl: r.arquivoUrl,
      linhas: linhasDoForm(linhas),
    };
    startSalvar(async () => {
      const res = await salvarPlanilhaCustosAction(input);
      if (!res.ok) setErro(res.erro);
      else onSalvo({ id: res.id, versao: res.versao });
    });
  }

  const form = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Função (como está na planilha)</span>
          <input className="input mt-1 w-full" value={r.funcao} onChange={(e) => setR({ ...r, funcao: e.target.value })} placeholder="Ex.: Auxiliar administrativo" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Item (posto) do contrato
            {r.itemSugerido && r.contratoItemId && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-violet-800">sugerido pela leitura — confirme</span>}
          </span>
          <select
            className="input mt-1 w-full"
            value={r.contratoItemId ?? ""}
            onChange={(e) => {
              const it = itens.find((i) => i.id === e.target.value) ?? null;
              // Função em branco herda o nome do item escolhido (cadastro manual).
              setR({ ...r, contratoItemId: it?.id ?? null, itemSugerido: false, funcao: r.funcao.trim() ? r.funcao : it?.descricao ?? r.funcao });
            }}
          >
            <option value="">Sem vínculo por enquanto</option>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>
                {i.descricao} · {brl(i.valorUnitario)}/mês · {i.quantidade} {i.unidade.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Efeito a partir de</span>
          <input type="date" className="input mt-1 w-full" value={r.dataEfeito} max={r.origem === "PROPOSTA" ? undefined : undefined} onChange={(e) => setR({ ...r, dataEfeito: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Origem</span>
          <select className="input mt-1 w-full" value={r.origem} onChange={(e) => setR({ ...r, origem: e.target.value as Origem, dataEfeito: e.target.value === "PROPOSTA" ? r.dataEfeito : r.dataEfeito || hojeIso })}>
            {ORIGENS.map((o) => (
              <option key={o} value={o}>
                {ROTULO_ORIGEM[o]}
              </option>
            ))}
          </select>
        </label>
        {r.origem !== "PROPOSTA" && r.origem !== "MANUAL" && (
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Instrumento que originou (apostila ou aditivo)</span>
            <input className="input mt-1 w-full" value={r.origemRef} onChange={(e) => setR({ ...r, origemRef: e.target.value })} placeholder="Ex.: Apostila nº 02/2026" />
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Convenção coletiva (CCT) citada na planilha</span>
          <input className="input mt-1 w-full" value={r.cct} onChange={(e) => setR({ ...r, cct: e.target.value })} placeholder="Ex.: CCT SEAC-RR / SINTRAL 2025-2026" />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">Descrição</th>
              <th className="w-24 px-2 py-2 text-right font-semibold">%</th>
              <th className="w-32 px-2 py-2 text-right font-semibold">Valor (R$)</th>
              <th className="w-28 px-2 py-2 text-left font-semibold">Módulo</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((m) => {
              const ls = r.linhas.filter((l) => l.modulo === m.codigo);
              if (ls.length === 0 && m.codigo === "OUTROS") return null;
              return (
                <ModuloForm
                  key={m.codigo}
                  titulo={m.titulo}
                  linhas={ls}
                  subtotal={sub[m.codigo] ?? 0}
                  onAdd={() => addLinha(m.codigo)}
                  onChange={setLinha}
                  onRemove={removerLinha}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white">
              <td className="px-2 py-2.5 font-semibold" colSpan={2}>
                Total mensal por posto
              </td>
              <td className="px-2 py-2.5 text-right font-bold tabular-nums">{brl(total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {item && dif != null && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${divergente ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {divergente ? (
            <>
              <p className="inline-flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> O total ({brl(total)}) difere {brl(Math.abs(dif))} do valor mensal unitário do item ({brl(item.valorUnitario)}).
              </p>
              <p className="mt-1 text-xs">Confira os valores lidos. Se a diferença é real (arredondamento, item cadastrado com outro valor), explique abaixo para salvar mesmo assim.</p>
              <textarea
                className="input mt-2 w-full"
                rows={2}
                value={r.justificativaDivergencia}
                onChange={(e) => setR({ ...r, justificativaDivergencia: e.target.value })}
                placeholder="Justificativa da divergência"
              />
            </>
          ) : (
            <p className="inline-flex items-center gap-2 font-medium">
              <Check className="h-4 w-4" /> O total bate com o valor mensal unitário do item ({brl(item.valorUnitario)}).
            </p>
          )}
        </div>
      )}

      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{erro}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onCancelar} className="btn-secondary" disabled={salvando}>
          {rotuloCancelar}
        </button>
        <button type="button" onClick={salvar} className="btn-primary inline-flex" disabled={salvando}>
          {salvando ? "Salvando…" : rotuloSalvar}
        </button>
      </div>
    </div>
  );

  if (!temLadoEsquerdo) return form;

  // RN04: documento original ao lado dos valores extraídos.
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,45%)_1fr]">
      <div className="min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {previewPdf ? (
          <iframe src={previewPdf} title="Documento original" className="h-[75vh] min-h-[420px] w-full" />
        ) : (
          <div className="p-4 text-sm text-slate-700">
            <p className="font-semibold">Arquivos lidos</p>
            <ul className="mt-2 space-y-1">
              {(arquivos.length ? arquivos : r.arquivoUrl ? [{ url: r.arquivoUrl, nome: "Documento original" }] : []).map((a) => (
                <li key={a.url}>
                  <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                    <FileText className="h-3.5 w-3.5" /> {a.nome}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Planilha em Excel não tem pré-visualização aqui; abra o arquivo ao lado para conferir.</p>
          </div>
        )}
      </div>
      {form}
    </div>
  );
}

function ModuloForm({
  titulo,
  linhas,
  subtotal,
  onAdd,
  onChange,
  onRemove,
}: {
  titulo: string;
  linhas: LinhaForm[];
  subtotal: number;
  onAdd: () => void;
  onChange: (key: string, patch: Partial<LinhaForm>) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <>
      <tr className="bg-amber-50/60">
        <td colSpan={4} className="px-2 py-1.5 text-xs font-semibold text-slate-800">
          {titulo}
        </td>
        <td className="px-1 py-1 text-right">
          <button type="button" onClick={onAdd} className="rounded p-1 text-slate-600 hover:bg-amber-100" title="Adicionar linha neste módulo" aria-label={`Adicionar linha em ${titulo}`}>
            <Plus className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
      {linhas.map((l) => (
        <tr key={l.key} className={`border-t border-slate-100 ${l.aRevisar ? "bg-amber-50/40" : ""}`}>
          <td className="px-1 py-1">
            <input
              className="input w-full !py-1 text-sm"
              value={l.descricao}
              onChange={(e) => onChange(l.key, { descricao: e.target.value, aRevisar: false })}
              placeholder="Descrição"
              title={l.aRevisar ? "Classificação por aproximação — confira" : undefined}
            />
          </td>
          <td className="px-1 py-1">
            <input className="input w-full !py-1 text-right text-sm tabular-nums" inputMode="decimal" value={l.percentual} onChange={(e) => onChange(l.key, { percentual: e.target.value })} placeholder="—" />
          </td>
          <td className="px-1 py-1">
            <input className="input w-full !py-1 text-right text-sm tabular-nums" inputMode="decimal" value={l.valor} onChange={(e) => onChange(l.key, { valor: e.target.value, aRevisar: false })} placeholder="0,00" />
          </td>
          <td className="px-1 py-1">
            <select className="input w-full !py-1 text-xs" value={l.modulo} onChange={(e) => onChange(l.key, { modulo: e.target.value as CodigoModulo, aRevisar: false })}>
              {MODULOS.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.codigo === "OUTROS" ? "Outros" : m.codigo}
                </option>
              ))}
            </select>
          </td>
          <td className="px-1 py-1 text-right">
            <button type="button" onClick={() => onRemove(l.key)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover linha">
              <X className="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      ))}
      <tr className="border-t border-slate-200 bg-slate-50">
        <td className="px-2 py-1 text-xs text-slate-500" colSpan={2}>
          Subtotal
        </td>
        <td className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-800">{brl(subtotal)}</td>
        <td colSpan={2} />
      </tr>
    </>
  );
}
