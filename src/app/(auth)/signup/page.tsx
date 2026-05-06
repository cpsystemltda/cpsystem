"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Building2, UserCheck, Search, X, AlertCircle } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { signupAction, signupAnalistaAction, buscarAnalistasPublicos } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { OPCOES_NATUREZA_JURIDICA } from "@/lib/validators";

const PORTES = [
  { value: "MEI", label: "MEI" },
  { value: "ME", label: "Microempresa (ME)" },
  { value: "EPP", label: "Empresa de Pequeno Porte (EPP)" },
  { value: "MEDIA", label: "Média" },
  { value: "GRANDE", label: "Grande" },
];

const ROTULO_CAMPO: Record<string, string> = {
  // Empresa
  nome: "Seu nome",
  email: "E-mail de acesso",
  senha: "Senha",
  razaoSocial: "Razão social",
  porte: "Porte",
  nomeFantasia: "Nome fantasia",
  cnpj: "CNPJ",
  cnaePrincipal: "CNAE principal",
  naturezaJuridica: "Natureza jurídica",
  endereco: "Endereço",
  cep: "CEP",
  emailEmpresa: "E-mail da empresa",
  telefones: "Telefone(s)",
  responsavel: "Responsável",
  // Analista (só os que diferem)
  cpf: "CPF",
  telefone: "Telefone",
  banco: "Banco",
  agencia: "Agência",
  contaCorrente: "Conta corrente",
  pix: "PIX",
  cnaesSecundarios: "CNAEs secundários",
  enderecoPj: "Endereço da PJ",
};

type Tipo = "EMPRESA" | "ANALISTA";

export default function SignupPage() {
  const [tipo, setTipo] = useState<Tipo>("EMPRESA");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 block w-fit">
        <Logo variant="md" priority />
      </Link>

      <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
      <p className="mt-2 text-sm text-slate-600">Escolha o tipo de cadastro:</p>

      {/* Seletor de tipo */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CardTipo
          ativo={tipo === "EMPRESA"}
          onClick={() => setTipo("EMPRESA")}
          icone={Building2}
          titulo="Sou empresa fornecedora"
          texto="Vendo para o governo (B2G) e quero gerenciar meus contratos. Trial 14 dias."
        />
        <CardTipo
          ativo={tipo === "ANALISTA"}
          onClick={() => setTipo("ANALISTA")}
          icone={UserCheck}
          titulo="Sou analista de licitação"
          texto="Atendo empresas fornecedoras. Cadastro gratuito — recebo comissão por execução."
        />
      </div>

      {tipo === "EMPRESA" ? <FormEmpresa /> : <FormAnalista />}

      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem conta? <Link href="/login" className="text-blue-700 hover:underline">Entrar</Link>
      </p>
    </div>
  );
}

function CardTipo({
  ativo,
  onClick,
  icone: Icone,
  titulo,
  texto,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition ${
        ativo ? "border-blue-500 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <Icone className={`h-6 w-6 ${ativo ? "text-blue-600" : "text-slate-500"}`} />
      <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
      <p className="text-xs text-slate-600">{texto}</p>
    </button>
  );
}

function FormEmpresa() {
  const [state, formAction] = useActionState(signupAction, null);
  const e = state?.campos ?? {};
  const v = state?.valores ?? {};
  const errosResumo = Object.entries(e);
  const resumoRef = useRef<HTMLDivElement>(null);

  // Rola até o resumo de erros e dá foco no primeiro campo problemático
  useEffect(() => {
    if (errosResumo.length === 0) return;
    resumoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const primeiro = errosResumo[0]?.[0];
    if (primeiro) {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${primeiro}"]`);
      el?.focus({ preventScroll: true });
    }
  }, [errosResumo]);

  return (
    <form action={formAction} className="mt-8 grid grid-cols-4 gap-4">
      {/* Resumo de erros no topo, com lista clicável */}
      {(state?.erro || errosResumo.length > 0) && (
        <div
          ref={resumoRef}
          className="col-span-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold">{state?.erro ?? "Verifique os campos:"}</p>
              {errosResumo.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {errosResumo.map(([campo, msg]) => (
                    <li key={campo}>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${campo}"]`);
                          el?.focus();
                          el?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className="text-left underline hover:text-red-900"
                      >
                        <strong>{ROTULO_CAMPO[campo] ?? campo}</strong>: {msg}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <h2 className="col-span-4 mt-2 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Seu acesso
      </h2>
      <Field label="Seu nome" name="nome" required defaultValue={v.nome ?? ""} erro={e.nome} span={2} />
      <Field label="E-mail de acesso" name="email" type="email" autoComplete="email" required defaultValue={v.email ?? ""} erro={e.email} span={2} />
      <Field label="Senha (mín. 8 caracteres)" name="senha" type="password" required erro={e.senha} span={2} />
      <div className="col-span-2" />

      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Empresa
      </h2>
      <Field label="Razão social" name="razaoSocial" required defaultValue={v.razaoSocial ?? ""} erro={e.razaoSocial} span={3} />
      <Select label="Porte" name="porte" options={PORTES} required defaultValue={v.porte ?? ""} erro={e.porte} span={1} />
      <Field label="Nome fantasia" name="nomeFantasia" defaultValue={v.nomeFantasia ?? ""} erro={e.nomeFantasia} span={2} />
      <Field label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" required defaultValue={v.cnpj ?? ""} erro={e.cnpj} span={2} />
      <Field label="CNAE principal" name="cnaePrincipal" placeholder="ex.: 6201-5/01" required defaultValue={v.cnaePrincipal ?? ""} erro={e.cnaePrincipal} span={2} />
      <Select
        label="Natureza jurídica"
        name="naturezaJuridica"
        options={OPCOES_NATUREZA_JURIDICA}
        required
        defaultValue={v.naturezaJuridica ?? ""}
        erro={e.naturezaJuridica}
        span={2}
      />
      <Field label="Endereço" name="endereco" required defaultValue={v.endereco ?? ""} erro={e.endereco} span={3} />
      <Field label="CEP" name="cep" placeholder="00000-000" required defaultValue={v.cep ?? ""} erro={e.cep} span={1} />
      <Field label="E-mail da empresa" name="emailEmpresa" type="email" required defaultValue={v.emailEmpresa ?? ""} erro={e.emailEmpresa} span={2} />
      <Field label="Telefone(s)" name="telefones" placeholder="(61) 9 9999-9999" required defaultValue={v.telefones ?? ""} erro={e.telefones} span={2} />
      <Field label="Responsável" name="responsavel" required defaultValue={v.responsavel ?? ""} erro={e.responsavel} span={4} />

      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Analista de licitação <span className="ml-2 font-normal normal-case text-slate-400">(opcional)</span>
      </h2>
      <div className="col-span-4">
        <p className="mb-3 text-xs text-slate-600">
          Veio através de um analista? Vincule agora para que ele acompanhe seus contratos e receba comissão das execuções.
          O percentual e o fixo mensal são definidos depois, em comum acordo.
        </p>
        <SeletorAnalista />
      </div>

      <div className="col-span-4 mt-2">
        <SubmitButton>Criar conta de empresa · Trial 14 dias</SubmitButton>
      </div>
    </form>
  );
}

type AnalistaSugestao = { id: string; nome: string; cpfMascarado: string; email: string };

function SeletorAnalista() {
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<AnalistaSugestao[]>([]);
  const [escolhido, setEscolhido] = useState<AnalistaSugestao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (escolhido || busca.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    let cancel = false;
    setCarregando(true);
    const t = setTimeout(async () => {
      const r = await buscarAnalistasPublicos(busca.trim());
      if (!cancel) {
        setSugestoes(r);
        setCarregando(false);
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [busca, escolhido]);

  if (escolhido) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{escolhido.nome}</p>
          <p className="text-xs text-slate-600">CPF {escolhido.cpfMascarado} · {escolhido.email}</p>
        </div>
        <input type="hidden" name="analistaId" value={escolhido.id} />
        <button
          type="button"
          onClick={() => {
            setEscolhido(null);
            setBusca("");
          }}
          className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-700"
          title="Remover vínculo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 200)}
          placeholder="Digite nome ou CPF do analista (mín. 2 caracteres)"
          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>
      {aberto && (carregando || sugestoes.length > 0 || (busca.trim().length >= 2 && !carregando)) && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {carregando ? (
            <p className="px-3 py-2 text-xs text-slate-500">Buscando…</p>
          ) : sugestoes.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">
              Nenhum analista encontrado. Peça pra ele criar a conta primeiro em <strong>Sou analista de licitação</strong>.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {sugestoes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setEscolhido(a);
                      setAberto(false);
                    }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{a.nome}</span>
                    <span className="text-[11px] text-slate-500">CPF {a.cpfMascarado} · {a.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FormAnalista() {
  const [state, formAction] = useActionState(signupAnalistaAction, null);
  const e = state?.campos ?? {};
  const v = state?.valores ?? {};
  const errosResumo = Object.entries(e);
  const resumoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errosResumo.length === 0) return;
    resumoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const primeiro = errosResumo[0]?.[0];
    if (primeiro) {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${primeiro}"]`);
      el?.focus({ preventScroll: true });
    }
  }, [errosResumo]);

  return (
    <form action={formAction} className="mt-8 grid grid-cols-4 gap-4">
      {(state?.erro || errosResumo.length > 0) && (
        <div
          ref={resumoRef}
          className="col-span-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold">{state?.erro ?? "Verifique os campos:"}</p>
              {errosResumo.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {errosResumo.map(([campo, msg]) => (
                    <li key={campo}>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${campo}"]`);
                          el?.focus();
                          el?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className="text-left underline hover:text-red-900"
                      >
                        <strong>{ROTULO_CAMPO[campo] ?? campo}</strong>: {msg}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <h2 className="col-span-4 mt-2 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Dados pessoais
      </h2>
      <Field label="Nome completo" name="nome" required defaultValue={v.nome ?? ""} erro={e.nome} span={3} />
      <Field label="CPF" name="cpf" placeholder="000.000.000-00" required defaultValue={v.cpf ?? ""} erro={e.cpf} span={1} />
      <Field label="E-mail de acesso" name="email" type="email" autoComplete="email" required defaultValue={v.email ?? ""} erro={e.email} span={2} />
      <Field label="Senha (mín. 8)" name="senha" type="password" required erro={e.senha} span={2} />
      <Field label="Telefone" name="telefone" placeholder="(61) 9 9999-9999" required defaultValue={v.telefone ?? ""} erro={e.telefone} span={2} />
      <Field label="Endereço" name="endereco" required defaultValue={v.endereco ?? ""} erro={e.endereco} span={2} />

      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Dados bancários <span className="ml-2 font-normal normal-case text-slate-400">(pra receber comissões e fixo)</span>
      </h2>
      <Field label="Banco" name="banco" defaultValue={v.banco ?? ""} erro={e.banco} span={2} />
      <Field label="Agência" name="agencia" defaultValue={v.agencia ?? ""} erro={e.agencia} span={1} />
      <Field label="Conta corrente" name="contaCorrente" defaultValue={v.contaCorrente ?? ""} erro={e.contaCorrente} span={1} />
      <Field label="PIX (chave preferencial)" name="pix" defaultValue={v.pix ?? ""} erro={e.pix} span={4} />

      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Pessoa jurídica <span className="ml-2 font-normal normal-case text-slate-400">(opcional — preencha só se emite nota como PJ)</span>
      </h2>
      <Field label="Razão social" name="razaoSocial" defaultValue={v.razaoSocial ?? ""} erro={e.razaoSocial} span={3} />
      <Select label="Porte" name="porte" options={PORTES} defaultValue={v.porte ?? ""} erro={e.porte} span={1} />
      <Field label="Nome fantasia" name="nomeFantasia" defaultValue={v.nomeFantasia ?? ""} erro={e.nomeFantasia} span={2} />
      <Field label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" defaultValue={v.cnpj ?? ""} erro={e.cnpj} span={2} />
      <Field label="CNAE principal" name="cnaePrincipal" placeholder="ex.: 6911-7/01" defaultValue={v.cnaePrincipal ?? ""} erro={e.cnaePrincipal} span={2} />
      <Field label="CNAEs secundários (separar por vírgula)" name="cnaesSecundarios" defaultValue={v.cnaesSecundarios ?? ""} erro={e.cnaesSecundarios} span={2} />
      <Select
        label="Natureza jurídica"
        name="naturezaJuridica"
        options={OPCOES_NATUREZA_JURIDICA}
        defaultValue={v.naturezaJuridica ?? ""}
        erro={e.naturezaJuridica}
        span={2}
      />
      <Field label="Endereço da PJ" name="enderecoPj" defaultValue={v.enderecoPj ?? ""} erro={e.enderecoPj} span={2} />

      <div className="col-span-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        Como analista, você não paga assinatura. Seu painel mostra todas as empresas que vincularem você como responsável,
        com cálculo automático de comissão por execução de contrato.
      </div>

      <div className="col-span-4 mt-2">
        <SubmitButton>Criar conta de analista · gratuito</SubmitButton>
      </div>
    </form>
  );
}
