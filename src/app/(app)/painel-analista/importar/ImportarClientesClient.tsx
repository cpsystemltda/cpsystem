"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Landmark,
  ArrowRight,
} from "lucide-react";
import { OPCOES_NATUREZA_JURIDICA } from "@/lib/validators";

/**
 * Importacao da carteira em tres passos (opcao B, Regina 18/08):
 *
 *  1. a planilha sobe e a IA diz quais linhas sao empresas;
 *  2. o que a planilha nao traz vem da Receita pelo CNPJ — em lotes, pra
 *     mostrar progresso e nao estourar o limite da BrasilAPI;
 *  3. so o que nem a Receita resolve (quase sempre e-mail e telefone de
 *     contato) e perguntado ao analista, campo a campo, antes de gravar.
 *
 * A tela nunca preenche sozinha um campo que ja veio da planilha — o analista
 * conhece o cliente dele melhor que a base da Receita. Quando a razao social
 * oficial diverge da que ele escreveu, mostramos a da Receita ao lado com um
 * botao "usar", em vez de trocar por baixo.
 */

const PORTES = [
  { value: "MEI", label: "MEI" },
  { value: "ME", label: "Microempresa (ME)" },
  { value: "EPP", label: "Empresa de Pequeno Porte (EPP)" },
  { value: "MEDIA", label: "Média" },
  { value: "GRANDE", label: "Grande" },
];

type ClientePrevia = {
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

type Previa = {
  ok: true;
  linhasLidas: number;
  clientes: ClientePrevia[];
  perguntas: string[];
  colunasInterpretadas: Record<string, string>;
};

type DadosReceita = {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  porte: string | null;
  cnaePrincipal: string | null;
  naturezaJuridica: string | null;
  endereco: string | null;
  complemento: string | null;
  cep: string | null;
  email: string | null;
  telefone: string | null;
  responsavel: string | null;
  situacao: string | null;
};

type Campos = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  porte: string;
  cnaePrincipal: string;
  naturezaJuridica: string;
  endereco: string;
  complemento: string;
  cep: string;
  email: string;
  telefones: string;
  responsavel: string;
};

type Linha = {
  id: number;
  linhaPlanilha: number;
  incluir: boolean;
  aberta: boolean;
  jaCadastrada: string | null;
  pendencias: string[];
  receita: "nao_consultada" | "consultando" | "ok" | "sem_dados";
  situacaoReceita: string | null;
  razaoSocialReceita: string | null;
  campos: Campos;
  resultado?: { situacao: "criada" | "ja_existia" | "erro"; detalhe?: string };
};

type ResultadoImport = {
  ok: true;
  criadas: number;
  jaExistiam: number;
  erros: number;
  resultados: { linha: number; cnpj: string; situacao: "criada" | "ja_existia" | "erro"; detalhe?: string }[];
};

const ROTULOS: Record<keyof Campos, string> = {
  razaoSocial: "Razão social",
  nomeFantasia: "Nome fantasia",
  cnpj: "CNPJ",
  porte: "Porte",
  cnaePrincipal: "CNAE principal",
  naturezaJuridica: "Natureza jurídica",
  endereco: "Endereço",
  complemento: "Complemento",
  cep: "CEP",
  email: "E-mail",
  telefones: "Telefone",
  responsavel: "Responsável",
};

function so(v: string) {
  return v.replace(/\D/g, "");
}

function formatarCnpj(v: string) {
  const d = so(v);
  if (d.length !== 14) return v || "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Campos que ainda impedem a gravacao desta empresa. */
function faltando(c: Campos): (keyof Campos)[] {
  const falta: (keyof Campos)[] = [];
  if (c.razaoSocial.trim().length < 2) falta.push("razaoSocial");
  if (so(c.cnpj).length !== 14) falta.push("cnpj");
  if (!c.porte) falta.push("porte");
  if (!c.naturezaJuridica) falta.push("naturezaJuridica");
  if (c.endereco.trim().length < 5) falta.push("endereco");
  if (so(c.cep).length !== 8) falta.push("cep");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) falta.push("email");
  if (so(c.telefones).length < 10) falta.push("telefones");
  if (c.responsavel.trim().length < 2) falta.push("responsavel");
  return falta;
}

function linhaDaPrevia(c: ClientePrevia, id: number): Linha {
  return {
    id,
    linhaPlanilha: c.linha,
    incluir: !c.jaCadastrada,
    aberta: false,
    jaCadastrada: c.jaCadastrada,
    pendencias: c.pendencias,
    receita: "nao_consultada",
    situacaoReceita: null,
    razaoSocialReceita: null,
    campos: {
      razaoSocial: c.razaoSocial ?? "",
      nomeFantasia: c.nomeFantasia ?? "",
      cnpj: c.cnpj ?? "",
      porte: "",
      cnaePrincipal: "",
      naturezaJuridica: "",
      endereco: "",
      complemento: "",
      cep: "",
      email: c.email ?? "",
      telefones: c.telefone ?? "",
      responsavel: c.responsavel ?? "",
    },
  };
}

/** Receita so completa buraco: o que veio da planilha permanece. */
function completarComReceita(linha: Linha, d: DadosReceita | null): Linha {
  if (!d) return { ...linha, receita: "sem_dados" };
  const c = { ...linha.campos };
  const preencher = (campo: keyof Campos, valor: string | null) => {
    if (valor && !c[campo].trim()) c[campo] = valor;
  };
  preencher("razaoSocial", d.razaoSocial);
  preencher("nomeFantasia", d.nomeFantasia);
  preencher("porte", d.porte);
  preencher("cnaePrincipal", d.cnaePrincipal);
  preencher("naturezaJuridica", d.naturezaJuridica);
  preencher("endereco", d.endereco);
  preencher("complemento", d.complemento);
  preencher("cep", d.cep);
  preencher("email", d.email);
  preencher("telefones", d.telefone);
  preencher("responsavel", d.responsavel);

  const divergeRazao =
    !!d.razaoSocial &&
    d.razaoSocial.trim().toLowerCase() !== c.razaoSocial.trim().toLowerCase();

  return {
    ...linha,
    campos: c,
    receita: "ok",
    situacaoReceita: d.situacao,
    razaoSocialReceita: divergeRazao ? d.razaoSocial : null,
  };
}

export function ImportarClientesClient() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviar(arquivo: File) {
    setCarregando(true);
    setErro(null);
    setPrevia(null);
    setLinhas([]);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await fetch("/api/analista/importar-clientes", { method: "POST", body: fd });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados?.erro || "Falha ao processar a planilha.");
      const p = dados as Previa;
      const novas = p.clientes.map(linhaDaPrevia);
      setPrevia(p);
      setLinhas(novas);
      // A consulta a Receita comeca sozinha: e o passo que transforma "nome e
      // CNPJ" em cadastro completo, e ninguem ia querer clicar pra isso.
      void consultarReceita(novas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  async function consultarReceita(base: Linha[]) {
    const alvos = base.filter((l) => so(l.campos.cnpj).length === 14 && !l.jaCadastrada);
    if (alvos.length === 0) return;

    setProgresso({ feitos: 0, total: alvos.length });
    const LOTE = 8;
    for (let i = 0; i < alvos.length; i += LOTE) {
      const fatia = alvos.slice(i, i + LOTE);
      const ids = new Set(fatia.map((l) => l.id));
      setLinhas((atual) =>
        atual.map((l) => (ids.has(l.id) ? { ...l, receita: "consultando" } : l)),
      );
      try {
        const r = await fetch("/api/analista/importar-clientes/receita", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cnpjs: fatia.map((l) => so(l.campos.cnpj)) }),
        });
        const dados = await r.json();
        const mapa: Record<string, DadosReceita | null> = r.ok ? dados.dados ?? {} : {};
        setLinhas((atual) =>
          atual.map((l) =>
            ids.has(l.id) ? completarComReceita(l, mapa[so(l.campos.cnpj)] ?? null) : l,
          ),
        );
      } catch {
        setLinhas((atual) =>
          atual.map((l) => (ids.has(l.id) ? { ...l, receita: "sem_dados" } : l)),
        );
      }
      setProgresso({ feitos: Math.min(i + LOTE, alvos.length), total: alvos.length });
    }
    setProgresso(null);
    // Abre sozinho o que ficou incompleto — e exatamente o que o analista
    // precisa responder pra terminar a importacao.
    setLinhas((atual) =>
      atual.map((l) =>
        !l.jaCadastrada && l.incluir && faltando(l.campos).length > 0 ? { ...l, aberta: true } : l,
      ),
    );
  }

  function editar(id: number, campo: keyof Campos, valor: string) {
    setLinhas((atual) =>
      atual.map((l) => (l.id === id ? { ...l, campos: { ...l.campos, [campo]: valor } } : l)),
    );
  }

  function alternar(id: number, chave: "incluir" | "aberta") {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, [chave]: !l[chave] } : l)));
  }

  async function importar() {
    const prontas = linhas.filter(
      (l) => l.incluir && !l.jaCadastrada && !l.resultado && faltando(l.campos).length === 0,
    );
    if (prontas.length === 0) return;

    setImportando(true);
    setErro(null);
    try {
      const r = await fetch("/api/analista/importar-clientes/confirmar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientes: prontas.map((l) => ({
            ...l.campos,
            cnpj: so(l.campos.cnpj),
            cep: so(l.campos.cep),
            linha: l.linhaPlanilha,
          })),
        }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados?.erro || "Falha ao importar.");
      const res = dados as ResultadoImport;
      setResultado(res);
      // Casa o resultado com a linha pelo CNPJ — a linha da planilha pode se
      // repetir (duas abas, mesma numeracao), o CNPJ nao.
      setLinhas((atual) =>
        atual.map((l) => {
          const achado = res.resultados.find((x) => x.cnpj === so(l.campos.cnpj));
          return achado
            ? { ...l, resultado: { situacao: achado.situacao, detalhe: achado.detalhe }, aberta: false }
            : l;
        }),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setImportando(false);
    }
  }

  const pendentes = linhas.filter((l) => !l.jaCadastrada && !l.resultado);
  const prontas = pendentes.filter((l) => l.incluir && faltando(l.campos).length === 0);
  const incompletas = pendentes.filter((l) => l.incluir && faltando(l.campos).length > 0);
  const jaCadastradas = linhas.filter((l) => l.jaCadastrada);
  const importadas = linhas.filter((l) => l.resultado?.situacao === "criada");

  return (
    <div className="mt-6 space-y-6">
      {/* Passo 1 — upload */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 text-violet-600" size={22} />
          <div>
            <h2 className="text-base font-bold text-slate-900">Suba a sua planilha</h2>
            <p className="text-xs text-slate-500">
              Do jeito que você já mantém — não precisa arrumar as colunas nem seguir modelo. A
              leitura entende cabeçalhos com nomes diferentes e ignora títulos e totais. Aceita
              .xlsx, .xls ou .csv, até 5 MB.
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
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={carregando}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {carregando ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
          {carregando ? "Lendo a planilha…" : previa ? "Trocar planilha" : "Escolher planilha"}
        </button>

        {erro && (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertCircle size={15} /> {erro}
          </p>
        )}
      </section>

      {previa && (
        <>
          {/* O que a leitura entendeu de cada coluna */}
          {Object.keys(previa.colunasInterpretadas).length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Como as colunas foram lidas</h3>
              <p className="mb-3 text-xs text-slate-500">
                Confira antes de confirmar — se algo foi entendido errado, é aqui que aparece.
              </p>
              <ul className="grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
                {Object.entries(previa.colunasInterpretadas).map(([col, sig]) => (
                  <li key={col}>
                    <span className="font-semibold">{col}</span> → {sig}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Perguntas: o que ficou ambiguo na planilha inteira */}
          {previa.perguntas.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <HelpCircle size={16} /> Preciso confirmar com você
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-amber-900">
                {previa.perguntas.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Passo 2 — Receita */}
          {progresso && (
            <section className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-900">
              <Loader2 className="animate-spin" size={18} />
              <div className="flex-1">
                <p className="font-semibold">
                  Completando com os dados da Receita — {progresso.feitos} de {progresso.total}
                </p>
                <p className="text-xs">
                  Porte, natureza jurídica, endereço e CEP vêm do CNPJ. O que não vier de lá fica
                  pra você preencher logo abaixo.
                </p>
              </div>
            </section>
          )}

          {/* Resumo */}
          <section className="grid gap-4 sm:grid-cols-4">
            <Bloco titulo="Prontas para importar" valor={prontas.length} tom="verde" />
            <Bloco titulo="Faltando preencher" valor={incompletas.length} tom="ambar" />
            <Bloco titulo="Já cadastradas" valor={jaCadastradas.length} tom="cinza" />
            <Bloco titulo="Importadas agora" valor={importadas.length} tom="violeta" />
          </section>

          {resultado && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                <CheckCircle2 size={16} />
                {resultado.criadas === 1
                  ? "1 empresa entrou na sua carteira"
                  : `${resultado.criadas} empresas entraram na sua carteira`}
              </h3>
              <p className="mt-1 text-xs text-emerald-900">
                {resultado.jaExistiam > 0 && `${resultado.jaExistiam} já existia(m) na base. `}
                {resultado.erros > 0 && `${resultado.erros} não pôde(ram) ser gravada(s). `}
                Cada empresa entrou com comissão zerada — os termos de cada uma você define no
                painel, empresa por empresa.
              </p>
              <Link
                href="/painel-analista/empresas-vinculadas"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 underline"
              >
                Ver empresas vinculadas <ArrowRight size={14} />
              </Link>
            </section>
          )}

          {/* Passo 3 — conferir e completar */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {linhas.length} empresa{linhas.length === 1 ? "" : "s"} encontrada
                {linhas.length === 1 ? "" : "s"} em {previa.linhasLidas} linhas
              </h3>
              <p className="text-xs text-slate-500">
                Desmarque o que não quiser importar. Clique numa empresa para ver e editar todos os
                campos.
              </p>
            </div>

            {linhas.map((l) => (
              <CartaoEmpresa
                key={l.id}
                linha={l}
                onEditar={editar}
                onAlternar={alternar}
              />
            ))}
          </section>

          {/* Barra de acao. O botao fica a ESQUERDA e a barra reserva espaco no
              fim: o balao do IAsystem e fixo no canto inferior direito da tela
              e cobria exatamente o canto onde um botao de acao costuma ficar —
              no teste o clique era interceptado por ele. */}
          <section className="sticky bottom-4 flex flex-wrap-reverse items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 pe-4 shadow-lg sm:flex-nowrap sm:pe-44">
            <button
              type="button"
              disabled={prontas.length === 0 || importando || !!progresso}
              onClick={importar}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {importando ? <Loader2 className="animate-spin" size={16} /> : <Landmark size={16} />}
              {importando
                ? "Importando…"
                : `Importar ${prontas.length} empresa${prontas.length === 1 ? "" : "s"}`}
            </button>
            <div className="text-sm text-slate-600">
              {prontas.length > 0 ? (
                <>
                  <span className="font-bold text-slate-900">{prontas.length}</span> pronta
                  {prontas.length === 1 ? "" : "s"} para importar
                  {incompletas.length > 0 && (
                    <span className="text-amber-700">
                      {" "}
                      · {incompletas.length} aguardando você preencher
                    </span>
                  )}
                </>
              ) : incompletas.length > 0 ? (
                <span className="text-amber-700">
                  Complete os campos destacados para liberar a importação.
                </span>
              ) : (
                <span>Nada pendente para importar.</span>
              )}
            </div>
          </section>

          <p className="text-xs text-slate-500">
            Cada empresa importada vira um cadastro da sua carteira: ela aparece em “Empresas
            vinculadas”, mas ninguém acessa o sistema por ela até o cliente assinar. Quando ele
            assinar, o cadastro que você criou aqui é aproveitado e o vínculo com você é mantido.
          </p>
        </>
      )}
    </div>
  );
}

function CartaoEmpresa({
  linha,
  onEditar,
  onAlternar,
}: {
  linha: Linha;
  onEditar: (id: number, campo: keyof Campos, valor: string) => void;
  onAlternar: (id: number, chave: "incluir" | "aberta") => void;
}) {
  const falta = faltando(linha.campos);
  const bloqueada = !!linha.jaCadastrada || !!linha.resultado;
  const baixada =
    linha.situacaoReceita && !linha.situacaoReceita.toUpperCase().startsWith("ATIVA");

  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm ${
        linha.resultado?.situacao === "criada"
          ? "border-emerald-200"
          : linha.resultado?.situacao === "erro"
            ? "border-red-200"
            : linha.jaCadastrada
              ? "border-slate-200 opacity-70"
              : linha.incluir && falta.length > 0
                ? "border-amber-300"
                : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={linha.incluir && !bloqueada}
          disabled={bloqueada}
          onChange={() => onAlternar(linha.id, "incluir")}
          className="h-4 w-4 accent-violet-600 disabled:opacity-40"
          aria-label={`Importar ${linha.campos.razaoSocial}`}
        />
        <button
          type="button"
          onClick={() => onAlternar(linha.id, "aberta")}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {linha.aberta ? (
            <ChevronDown size={16} className="shrink-0 text-slate-400" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {linha.campos.razaoSocial || "(sem razão social)"}
            </span>
            <span className="block text-xs tabular-nums text-slate-500">
              {formatarCnpj(linha.campos.cnpj)}
              {linha.linhaPlanilha ? ` · linha ${linha.linhaPlanilha}` : ""}
            </span>
          </span>
        </button>

        <div className="shrink-0 text-right text-xs">
          {linha.resultado ? (
            linha.resultado.situacao === "criada" ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 size={13} /> importada
              </span>
            ) : (
              <span className="font-semibold text-red-700">{linha.resultado.detalhe}</span>
            )
          ) : linha.jaCadastrada ? (
            <span className="font-semibold text-slate-500">
              já cadastrada · {linha.jaCadastrada}
            </span>
          ) : linha.receita === "consultando" ? (
            <span className="inline-flex items-center gap-1 text-violet-700">
              <Loader2 className="animate-spin" size={12} /> Receita
            </span>
          ) : falta.length > 0 ? (
            <span className="font-semibold text-amber-700">
              faltam {falta.length}: {falta.slice(0, 2).map((f) => ROTULOS[f].toLowerCase()).join(", ")}
              {falta.length > 2 ? "…" : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <CheckCircle2 size={13} /> pronta
            </span>
          )}
        </div>
      </div>

      {linha.aberta && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-4">
          {linha.pendencias.length > 0 && (
            <p className="text-xs text-amber-700">
              Da planilha: {linha.pendencias.join("; ")}
            </p>
          )}
          {baixada && (
            <p className="text-xs font-semibold text-red-700">
              Situação na Receita: {linha.situacaoReceita}. Confira antes de importar.
            </p>
          )}
          {linha.receita === "sem_dados" && (
            <p className="text-xs text-slate-500">
              A Receita não respondeu para este CNPJ — preencha os campos abaixo na mão.
            </p>
          )}
          {linha.razaoSocialReceita && (
            <p className="text-xs text-slate-600">
              Na Receita esta empresa é{" "}
              <span className="font-semibold">{linha.razaoSocialReceita}</span>.{" "}
              <button
                type="button"
                onClick={() => onEditar(linha.id, "razaoSocial", linha.razaoSocialReceita!)}
                className="font-semibold text-violet-700 underline"
              >
                usar essa
              </button>
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo l={linha} campo="razaoSocial" falta={falta} onEditar={onEditar} span2 />
            <Campo l={linha} campo="nomeFantasia" falta={falta} onEditar={onEditar} />
            <Campo l={linha} campo="cnpj" falta={falta} onEditar={onEditar} />
            <CampoSelect
              l={linha}
              campo="porte"
              falta={falta}
              onEditar={onEditar}
              opcoes={PORTES}
            />
            <CampoSelect
              l={linha}
              campo="naturezaJuridica"
              falta={falta}
              onEditar={onEditar}
              opcoes={OPCOES_NATUREZA_JURIDICA}
            />
            <Campo l={linha} campo="endereco" falta={falta} onEditar={onEditar} span2 />
            <Campo l={linha} campo="complemento" falta={falta} onEditar={onEditar} />
            <Campo l={linha} campo="cep" falta={falta} onEditar={onEditar} />
            <Campo l={linha} campo="email" falta={falta} onEditar={onEditar} />
            <Campo l={linha} campo="telefones" falta={falta} onEditar={onEditar} />
            <Campo l={linha} campo="responsavel" falta={falta} onEditar={onEditar} span2 />
            <Campo l={linha} campo="cnaePrincipal" falta={falta} onEditar={onEditar} span2 />
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({
  l,
  campo,
  falta,
  onEditar,
  span2,
}: {
  l: Linha;
  campo: keyof Campos;
  falta: (keyof Campos)[];
  onEditar: (id: number, campo: keyof Campos, valor: string) => void;
  span2?: boolean;
}) {
  const ruim = falta.includes(campo);
  return (
    <label className={`block text-xs ${span2 ? "sm:col-span-2" : ""}`}>
      <span className={`font-semibold ${ruim ? "text-amber-700" : "text-slate-600"}`}>
        {ROTULOS[campo]}
        {ruim ? " · falta" : ""}
      </span>
      <input
        value={l.campos[campo]}
        disabled={!!l.resultado}
        onChange={(e) => onEditar(l.id, campo, e.target.value)}
        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 ${
          ruim ? "border-amber-300 bg-amber-50" : "border-slate-200"
        }`}
      />
    </label>
  );
}

function CampoSelect({
  l,
  campo,
  falta,
  onEditar,
  opcoes,
}: {
  l: Linha;
  campo: keyof Campos;
  falta: (keyof Campos)[];
  onEditar: (id: number, campo: keyof Campos, valor: string) => void;
  opcoes: { value: string; label: string }[];
}) {
  const ruim = falta.includes(campo);
  return (
    <label className="block text-xs">
      <span className={`font-semibold ${ruim ? "text-amber-700" : "text-slate-600"}`}>
        {ROTULOS[campo]}
        {ruim ? " · falta" : ""}
      </span>
      <select
        value={l.campos[campo]}
        disabled={!!l.resultado}
        onChange={(e) => onEditar(l.id, campo, e.target.value)}
        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 ${
          ruim ? "border-amber-300 bg-amber-50" : "border-slate-200"
        }`}
      >
        <option value="">Selecione…</option>
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Bloco({
  titulo,
  valor,
  tom,
}: {
  titulo: string;
  valor: number;
  tom: "verde" | "ambar" | "cinza" | "violeta";
}) {
  const cores = {
    verde: "border-emerald-200 bg-emerald-50 text-emerald-800",
    ambar: "border-amber-200 bg-amber-50 text-amber-800",
    cinza: "border-slate-200 bg-slate-50 text-slate-700",
    violeta: "border-violet-200 bg-violet-50 text-violet-800",
  }[tom];
  return (
    <div className={`rounded-2xl border p-5 ${cores}`}>
      <div className="text-3xl font-extrabold tabular-nums">{valor}</div>
      <div className="mt-1 text-xs font-semibold">{titulo}</div>
    </div>
  );
}
