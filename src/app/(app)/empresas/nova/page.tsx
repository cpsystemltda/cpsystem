"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useActionState } from "react";
import { ChevronLeft, FileText, Loader2, Plus, Sparkles, X } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { criarEmpresaAction } from "@/app/actions/empresas";
import { OPCOES_NATUREZA_JURIDICA } from "@/lib/validators";

const PORTES = [
  { value: "MEI", label: "MEI" },
  { value: "ME", label: "Microempresa (ME)" },
  { value: "EPP", label: "Empresa de Pequeno Porte (EPP)" },
  { value: "MEDIA", label: "Média" },
  { value: "GRANDE", label: "Grande" },
];

type Campos = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  porte: string;
  cnaePrincipal: string;
  cnaesSecundarios: string;
  naturezaJuridica: string;
  endereco: string;
  cep: string;
  email: string;
  telefones: string;
  responsavel: string;
};

const VAZIO: Campos = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  porte: "",
  cnaePrincipal: "",
  cnaesSecundarios: "",
  naturezaJuridica: "",
  endereco: "",
  cep: "",
  email: "",
  telefones: "",
  responsavel: "",
};

export default function NovaEmpresaPage() {
  const [state, formAction] = useActionState(criarEmpresaAction, null);
  const e = state?.campos ?? {};

  const [vals, setVals] = useState<Campos>(VAZIO);
  const set = (k: keyof Campos) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setVals((v) => ({ ...v, [k]: ev.target.value }));

  // Upload / IA state
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [camposPreenchidos, setCamposPreenchidos] = useState<number | null>(null);

  function selecionarArquivo(f: File) {
    setArquivo(f);
    setErroUpload(null);
    setCamposPreenchidos(null);
  }

  async function extrairComIA() {
    if (!arquivo) return;
    setCarregando(true);
    setErroUpload(null);
    setCamposPreenchidos(null);

    const form = new FormData();
    form.append("arquivo", arquivo);

    try {
      const res = await fetch("/api/extrair-empresa", { method: "POST", body: form });
      const dados = await res.json();

      if (!res.ok) {
        setErroUpload(dados.erro ?? "Erro ao processar arquivo.");
        return;
      }

      const novos = { ...vals };
      let count = 0;
      const mapa: [keyof Campos, unknown][] = [
        ["razaoSocial", dados.razaoSocial],
        ["nomeFantasia", dados.nomeFantasia],
        ["cnpj", dados.cnpj],
        ["porte", dados.porte],
        ["cnaePrincipal", dados.cnaePrincipal],
        ["cnaesSecundarios", dados.cnaesSecundarios],
        ["naturezaJuridica", dados.naturezaJuridica],
        ["endereco", dados.endereco],
        ["cep", dados.cep],
        ["email", dados.email],
        ["telefones", dados.telefones],
        ["responsavel", dados.responsavel],
      ];
      for (const [k, v] of mapa) {
        if (v && typeof v === "string") {
          novos[k] = v;
          count++;
        }
      }
      setVals(novos);
      setCamposPreenchidos(count);
    } catch {
      setErroUpload("Erro de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  function removerArquivo() {
    setArquivo(null);
    setErroUpload(null);
    setCamposPreenchidos(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <Link
        href="/empresas"
        className="inline-flex items-center gap-1 text-sm font-semibold transition hover:opacity-70"
        style={{ color: "var(--text-soft)" }}
      >
        <ChevronLeft className="h-4 w-4" /> Voltar para Empresas
      </Link>

      <h1
        className="mt-4 flex items-center gap-3 text-[32px] font-extrabold leading-none"
        style={{ color: "var(--text)", letterSpacing: "-0.04em" }}
      >
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-[12px]"
          style={{ background: "rgba(212,175,55,0.18)", color: "var(--primary-deep)" }}
        >
          <Plus className="h-5 w-5" />
        </span>
        Adicionar CNPJ
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
        Inclua mais uma empresa do seu grupo econômico. A assinatura cobre até 4 CNPJs;
        a partir do 5º há cobrança adicional.
      </p>

      {/* Upload zone — IA */}
      <div className="glass-tile t-lavender mt-6 rounded-[20px] px-5 py-5">
        <div className="kpi-aura" />
        <div className="relative z-[1]">
          <div className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: "var(--text)", letterSpacing: "-0.015em" }}>
            <Sparkles className="h-4 w-4" style={{ color: "#8E73E0" }} />
            Preencher automaticamente com IA
          </div>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-soft)" }}>
            Envie o <strong>cartão CNPJ</strong>, <strong>comprovante de inscrição</strong> ou{" "}
            <strong>contrato social</strong> — documentos com dados cadastrais. A IA extrai os campos;
            você revisa e completa.
          </p>

        {!arquivo ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={(ev) => {
              ev.preventDefault();
              const f = ev.dataTransfer.files[0];
              if (f) selecionarArquivo(f);
            }}
            className="mt-3 flex w-full cursor-pointer flex-col items-center gap-2 rounded-[14px] py-6 text-center transition hover:bg-white/30"
            style={{
              background: "rgba(255,255,255,0.4)",
              border: "1.5px dashed rgba(142,115,224,0.4)",
            }}
          >
            <FileText className="h-8 w-8" style={{ color: "#8E73E0" }} />
            <span className="text-sm" style={{ color: "var(--text-soft)" }}>
              Arraste um arquivo ou{" "}
              <span className="font-bold" style={{ color: "#8E73E0" }}>clique para selecionar</span>
            </span>
            <span className="text-xs" style={{ color: "var(--text-mute)" }}>
              PDF, JPG, PNG ou WEBP · máx. 10 MB
            </span>
          </button>
        ) : (
          <div
            className="mt-3 flex items-center gap-3 rounded-[12px] px-4 py-3"
            style={{
              background: "rgba(255,255,255,0.6)",
              border: "0.5px solid var(--hairline)",
            }}
          >
            <FileText className="h-5 w-5 shrink-0" style={{ color: "#8E73E0" }} />
            <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text)" }}>{arquivo.name}</span>
            <button
              type="button"
              onClick={removerArquivo}
              className="shrink-0 transition hover:opacity-70"
              style={{ color: "var(--text-mute)" }}
              aria-label="Remover arquivo"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={extrairComIA}
              disabled={carregando}
              className="btn-primary flex shrink-0 items-center gap-1.5 disabled:opacity-60"
              style={{ height: "36px", padding: "0 14px", fontSize: "13px" }}
            >
              {carregando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Preencher com IA
                </>
              )}
            </button>
          </div>
        )}

        {erroUpload && (
          <div
            className="mt-3 rounded-[12px] px-4 py-3 text-sm font-semibold"
            style={{
              background: "rgba(232,138,152,0.18)",
              border: "0.5px solid rgba(198,103,112,0.5)",
              color: "var(--coral-deep)",
            }}
          >
            {erroUpload}
          </div>
        )}

        {camposPreenchidos !== null && camposPreenchidos > 0 && (
          <div
            className="mt-3 rounded-[12px] px-4 py-3 text-sm font-semibold"
            style={{
              background: "rgba(93,216,182,0.18)",
              border: "0.5px solid rgba(46,171,133,0.5)",
              color: "var(--mint-deep)",
            }}
          >
            ✓ {camposPreenchidos} campo{camposPreenchidos !== 1 ? "s" : ""} preenchido
            {camposPreenchidos !== 1 ? "s" : ""} automaticamente. Revise e complete os campos em branco.
          </div>
        )}

        {camposPreenchidos === 0 && (
          <div
            className="mt-3 rounded-[12px] px-4 py-3 text-sm font-semibold"
            style={{
              background: "rgba(212,175,55,0.18)",
              border: "0.5px solid rgba(168,137,71,0.5)",
              color: "var(--primary-deep)",
            }}
          >
            A IA não encontrou dados cadastrais nesse documento. Tente um <strong>cartão CNPJ</strong>{" "}
            (Receita Federal), <strong>comprovante de inscrição</strong> ou <strong>contrato social</strong> —
            contratos administrativos não trazem CNAE, e-mail e telefone da empresa.
          </div>
        )}

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) selecionarArquivo(f);
            }}
          />
        </div>
      </div>

      <form action={formAction} noValidate className="mt-6 grid grid-cols-4 gap-4">
        <Field label="Razão social" name="razaoSocial" required erro={e.razaoSocial} span={3}
          value={vals.razaoSocial} onChange={set("razaoSocial")} />
        <Select label="Porte" name="porte" options={PORTES} required erro={e.porte} span={1}
          value={vals.porte} onChange={set("porte")} />
        <Field label="Nome fantasia" name="nomeFantasia" erro={e.nomeFantasia} span={2}
          value={vals.nomeFantasia} onChange={set("nomeFantasia")} />
        <Field label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" required erro={e.cnpj} span={2}
          value={vals.cnpj} onChange={set("cnpj")} />
        <Field label="CNAE principal" name="cnaePrincipal" required erro={e.cnaePrincipal} span={2}
          value={vals.cnaePrincipal} onChange={set("cnaePrincipal")} />
        <Field label="CNAEs secundários (separar por vírgula)" name="cnaesSecundarios" erro={e.cnaesSecundarios} span={2}
          value={vals.cnaesSecundarios} onChange={set("cnaesSecundarios")} />
        <Select
          label="Natureza jurídica"
          name="naturezaJuridica"
          options={OPCOES_NATUREZA_JURIDICA}
          required
          erro={e.naturezaJuridica}
          span={2}
          value={vals.naturezaJuridica}
          onChange={set("naturezaJuridica")}
        />
        <Field label="Endereço" name="endereco" required erro={e.endereco} span={2}
          value={vals.endereco} onChange={set("endereco")} />
        <Field label="CEP" name="cep" placeholder="00000-000" required erro={e.cep} span={1}
          value={vals.cep} onChange={set("cep")} />
        <Field label="E-mail" name="email" type="email" required erro={e.email} span={3}
          value={vals.email} onChange={set("email")} />
        <Field label="Telefone(s)" name="telefones" placeholder="(61) 9 9999-9999" required erro={e.telefones} span={2}
          value={vals.telefones} onChange={set("telefones")} />
        <Field label="Responsável" name="responsavel" required erro={e.responsavel} span={2}
          value={vals.responsavel} onChange={set("responsavel")} />

        <div className="glass-tile col-span-4 mt-4 rounded-[18px] px-5 py-5">
          <h2 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
            Acesso do responsável{" "}
            <span className="ml-2 font-semibold" style={{ color: "var(--text-mute)" }}>(opcional)</span>
          </h2>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-soft)" }}>
            Se preencher senha + confirmação, o sistema cria um usuário operacional
            com o e-mail acima — esse responsável poderá entrar e ver somente esta empresa.
            Deixe em branco se você mesmo (titular da conta) for operar.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Field
              label="Senha (mín. 8 caracteres)"
              name="senha"
              type="password"
              autoComplete="new-password"
              erro={e.senha}
            />
            <Field
              label="Confirmação de senha"
              name="confirmacaoSenha"
              type="password"
              autoComplete="new-password"
              erro={e.confirmacaoSenha}
            />
          </div>
        </div>

        {state?.erro && (
          <div
            className="col-span-4 rounded-[12px] px-4 py-3 text-sm font-semibold"
            style={{
              background: "rgba(232,138,152,0.18)",
              border: "0.5px solid rgba(198,103,112,0.5)",
              color: "var(--coral-deep)",
            }}
          >
            {state.erro}
          </div>
        )}

        <div className="col-span-4 mt-2 flex gap-3">
          <SubmitButton>Cadastrar empresa</SubmitButton>
          <Link href="/empresas" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
