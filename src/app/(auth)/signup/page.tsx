"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Building2, UserCheck, Search, X, AlertCircle } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { AJUDA } from "@/lib/textosAjuda";
import { SubmitButton } from "@/components/SubmitButton";
import { CampoCnpj } from "@/components/CampoCnpj";
import { CampoCpf } from "@/components/CampoCpf";
import { CampoTelefone } from "@/components/CampoTelefone";
import { CampoCep } from "@/components/CampoCep";
import { CampoCartao } from "@/components/CampoCartao";
import { CampoBanco } from "@/components/CampoBanco";
import { CampoMultiplo } from "@/components/CampoMultiplo";
import { signupAction, signupAnalistaAction, buscarAnalistasPublicos } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { OPCOES_NATUREZA_JURIDICA } from "@/lib/validators";

const PORTES = [
  { value: "MEI", label: "MEI" },
  { value: "ME", label: "Microempresa (ME)" },
  { value: "EPP", label: "Empresa de Pequeno Porte (EPP)" },
  { value: "GRANDE", label: "Grande porte" },
  // "Média" removida a pedido do PO (Igor) — tabela do enum mantém pra compat
];

const PIX_TIPOS = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "TELEFONE", label: "Telefone" },
  { value: "ALEATORIA", label: "Chave aleatória" },
];

const ROTULO_CAMPO: Record<string, string> = {
  // Empresa
  plano: "Plano",
  cartaoNumero: "Número do cartão",
  cartaoNome: "Nome no cartão",
  cartaoValidade: "Validade do cartão",
  cartaoCvv: "CVV do cartão",
  nome: "Seu nome",
  email: "E-mail de acesso",
  senha: "Senha",
  confirmacaoSenha: "Confirmação de senha",
  razaoSocial: "Razão social",
  porte: "Porte",
  nomeFantasia: "Nome fantasia",
  cnpj: "CNPJ",
  cnaePrincipal: "CNAE principal",
  naturezaJuridica: "Natureza jurídica",
  endereco: "Endereço",
  complemento: "Complemento",
  cep: "CEP",
  emailEmpresa: "E-mail da empresa",
  telefones: "Telefone(s)",
  responsavel: "Nome completo",
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

  // Lê ?tipo=ANALISTA da URL no mount pra abrir já no card certo
  // (evita useSearchParams que exige Suspense boundary no Next 15+)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tipo") === "ANALISTA") setTipo("ANALISTA");
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#FAF6EC] via-white to-[#FFF8E1] px-6 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-[#9C7A2D]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl">
        <Link href="/" className="mx-auto mb-6 block w-fit">
          <Logo variant="md" mode="brand" priority />
        </Link>

        <h1 className="text-center text-2xl font-bold text-slate-900">Criar conta</h1>
      <p className="mt-2 text-sm text-slate-600">Escolha o tipo de cadastro:</p>

      {/* Seletor de tipo */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CardTipo
          ativo={tipo === "EMPRESA"}
          onClick={() => setTipo("EMPRESA")}
          icone={Building2}
          titulo="Sou empresa fornecedora"
          texto="Vendo para o governo e quero gerenciar meus contratos. Teste grátis 14 dias."
        />
        <CardTipo
          ativo={tipo === "ANALISTA"}
          onClick={() => setTipo("ANALISTA")}
          icone={UserCheck}
          titulo="Sou analista de licitação"
          texto="Atendo empresas fornecedoras. Cadastro gratuito."
        />
      </div>

      {tipo === "EMPRESA" ? <FormEmpresa /> : <FormAnalista />}

        <p className="mt-6 text-center text-sm text-slate-600">
          Já tem conta? <Link href="/login" className="text-blue-700 hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

function CardPlano({
  value,
  ativo,
  onClick,
  titulo,
  preco,
  sub,
  descricao,
  features,
  destaque,
}: {
  value: "BASICO" | "PREMIUM";
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  preco: string;
  sub: string;
  descricao: string;
  features: string[];
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-plano={value}
      className={`relative col-span-4 flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition md:col-span-2 ${
        ativo
          ? "border-blue-500 bg-blue-50/40 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {destaque && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-[#B8860B] to-[#F4D374] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#1A1206]">
          Recomendado
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-extrabold text-slate-900">{preco}</span>
          <span className="text-xs text-slate-500">{sub}</span>
        </div>
      </div>
      <p className="text-xs text-slate-600">{descricao}</p>
      <ul className="mt-1 space-y-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-slate-700">
            <span className={`mt-0.5 ${ativo ? "text-blue-600" : "text-emerald-600"}`}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div
        className={`mt-2 rounded-md px-3 py-1.5 text-center text-xs font-semibold ${
          ativo ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        {ativo ? "Plano selecionado" : "Selecionar este plano"}
      </div>
    </button>
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
  // Plano começa SEM seleção (Regina: usuário precisa escolher ativamente,
  // e a forma de pagamento só aparece depois que ele clica num plano).
  const [plano, setPlano] = useState<"BASICO" | "PREMIUM" | null>(
    v.plano === "PREMIUM" ? "PREMIUM" : v.plano === "BASICO" ? "BASICO" : null
  );

  // Programa de Embaixador: link pessoal /signup?ref=ANALISTA_ID grava o
  // analista que indicou como embaixadorId da conta nova. Comissao
  // mensal (3-6% MRR) flui pra esse analista enquanto a conta paga.
  const [embaixadorIdRef, setEmbaixadorIdRef] = useState<string>("");
  // Cupom (Regina 09/07) — pode vir via ?cupom=XXX ou digitado no form
  const [cupomCodigo, setCupomCodigo] = useState<string>(String(v.cupomCodigo ?? ""));
  const [cupomInfo, setCupomInfo] = useState<
    | null
    | { ok: true; codigo: string; diasTrial: number; analistaNome: string | null; descricao: string | null }
    | { ok: false; motivo: string }
  >(null);
  const [validandoCupom, setValidandoCupom] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || "";
    if (ref) setEmbaixadorIdRef(ref);
    const cupomUrl = params.get("cupom") || "";
    if (cupomUrl) setCupomCodigo(cupomUrl.toUpperCase());
  }, []);
  // Valida cupom on-blur (chama server action publica)
  async function validarCupomAgora() {
    const cod = cupomCodigo.trim().toUpperCase();
    if (!cod) {
      setCupomInfo(null);
      return;
    }
    setValidandoCupom(true);
    try {
      const { validarCupomPublico } = await import("@/app/actions/cupom");
      const r = await validarCupomPublico(cod);
      setCupomInfo(r);
    } catch {
      setCupomInfo({ ok: false, motivo: "Erro ao validar" });
    } finally {
      setValidandoCupom(false);
    }
  }

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
      {/* Hidden: id do analista que indicou (link /signup?ref=ID). A
          server action valida + grava em Conta.embaixadorId. */}
      <input type="hidden" name="embaixadorIdRef" value={embaixadorIdRef} />
      {embaixadorIdRef && !cupomInfo?.ok && (
        <div className="col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          ✓ Indicação registrada. O analista que te trouxe ganha comissão automática enquanto sua conta estiver ativa.
        </div>
      )}

      {/* Cupom (Regina 09/07) — pode vir via ?cupom= ou digitado */}
      <input type="hidden" name="cupomCodigo" value={cupomCodigo} />
      <div className="col-span-4">
        <details open={!!cupomCodigo} className="group rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">
            🎟️ Tem um código promocional?
          </summary>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
            <input
              type="text"
              value={cupomCodigo}
              onChange={(ev) => {
                setCupomCodigo(ev.target.value.toUpperCase());
                setCupomInfo(null);
              }}
              onBlur={validarCupomAgora}
              placeholder="Ex: IGOR60"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:max-w-xs"
              maxLength={32}
            />
            <button
              type="button"
              onClick={validarCupomAgora}
              disabled={validandoCupom || !cupomCodigo.trim()}
              className="rounded-md bg-slate-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-900 disabled:opacity-40"
            >
              {validandoCupom ? "Validando…" : "Aplicar"}
            </button>
          </div>
          {cupomInfo?.ok && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              ✓ Cupom <strong>{cupomInfo.codigo}</strong> aplicado — <strong>{cupomInfo.diasTrial} dias grátis</strong> em vez dos 14 padrão.
              {cupomInfo.analistaNome && (
                <> Analista responsável: <strong>{cupomInfo.analistaNome}</strong>.</>
              )}
              {cupomInfo.descricao && <div className="mt-1 opacity-80">{cupomInfo.descricao}</div>}
            </div>
          )}
          {cupomInfo && !cupomInfo.ok && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              ✗ {cupomInfo.motivo}
            </div>
          )}
        </details>
      </div>

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

      {/* 1) DADOS DA EMPRESA */}
      <h2 className="col-span-4 mt-2 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Empresa
      </h2>
      <Field
        label="Nome completo"
        name="responsavel"
        required
        placeholder="Nome do responsável pela empresa"
        defaultValue={v.responsavel ?? ""}
        erro={e.responsavel}
        span={4}
      />
      <CampoCnpj defaultValue={v.cnpj ?? ""} erro={e.cnpj} />
      <Field label="Razão social" name="razaoSocial" required defaultValue={v.razaoSocial ?? ""} erro={e.razaoSocial} span={2} />
      <Field label="Nome fantasia" name="nomeFantasia" defaultValue={v.nomeFantasia ?? ""} erro={e.nomeFantasia} span={4} />
      <Select label="Porte" name="porte" options={PORTES} required defaultValue={v.porte ?? ""} erro={e.porte} span={2} ajuda={AJUDA.porte} />
      <Select
        label="Natureza jurídica"
        name="naturezaJuridica"
        options={OPCOES_NATUREZA_JURIDICA}
        required
        defaultValue={v.naturezaJuridica ?? ""}
        erro={e.naturezaJuridica}
        span={2}
        ajuda={AJUDA.naturezaJuridica}
      />
      <Field label="CNAE principal (opcional)" name="cnaePrincipal" placeholder="ex.: 6201-5/01" defaultValue={v.cnaePrincipal ?? ""} erro={e.cnaePrincipal} span={4} ajuda={AJUDA.cnaePrincipal} />
      <CampoCep defaultValue={v.cep ?? ""} erro={e.cep} span={1} />
      <Field label="Endereço" name="endereco" required defaultValue={v.endereco ?? ""} erro={e.endereco} span={3} />
      <Field label="Complemento" name="complemento" placeholder="Loja, sala, andar…" defaultValue={v.complemento ?? ""} erro={e.complemento} span={4} />
      <CampoMultiplo
        name="emailEmpresa"
        label="E-mail da empresa"
        tipo="email"
        required
        placeholder="contato@empresa.com.br"
        defaultValues={v.emailEmpresa ? [v.emailEmpresa] : []}
        erro={e.emailEmpresa}
        span={2}
      />
      <CampoMultiplo
        name="telefones"
        label="Telefone(s)"
        tipo="telefone"
        required
        placeholder="(61) 9 9999-9999"
        defaultValues={v.telefones ? [v.telefones] : []}
        erro={e.telefones}
        span={2}
      />
      {/* 2) ACESSO (sem redundância: nome do usuário = responsável; e-mail de acesso = primeiro e-mail da empresa) */}
      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Seu acesso
      </h2>
      <p className="col-span-4 -mt-2 text-xs text-slate-500">
        Você vai usar o <strong>e-mail da empresa</strong> e o <strong>seu nome completo</strong> que preencheu acima
        pra entrar no sistema. Defina aqui só uma senha:
      </p>
      <Field label="Senha (mín. 6 caracteres)" name="senha" type="password" required erro={e.senha} span={2} />
      <Field label="Confirmação de senha" name="confirmacaoSenha" type="password" required erro={e.confirmacaoSenha} span={2} />
      <Field
        label="Seu WhatsApp (com DDD)"
        name="telefoneWhatsApp"
        type="tel"
        required
        placeholder="(21) 99999-9999"
        defaultValue={v.telefoneWhatsApp ?? ""}
        erro={e.telefoneWhatsApp}
        span={4}
        helper="Você vai receber prazos, avanços de execução e resumo semanal aqui — direto no WhatsApp. Pode desligar depois em Conta → Notificações."
      />

      {/* 3) ANALISTA VINCULADO (opcional) */}
      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Possui analista de licitação? <span className="ml-2 font-normal normal-case text-slate-400">(opcional)</span>
      </h2>
      <div className="col-span-4">
        <p className="mb-3 text-xs text-slate-600">
          Vincule agora para que o analista acompanhe seus contratos e receba comissão das execuções.
          O percentual e o fixo mensal são definidos depois, em comum acordo.
        </p>
        <SeletorAnalista />
      </div>

      {/* 4) PLANO + PAGAMENTO no fim — pagamento só aparece após escolha do plano */}
      {plano && <input type="hidden" name="plano" value={plano} />}
      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Escolha seu plano <span className="text-red-500">*</span>
      </h2>
      <CardPlano
        value="BASICO"
        ativo={plano === "BASICO"}
        onClick={() => setPlano("BASICO")}
        titulo="Básico"
        preco="R$ 397"
        sub="/mês"
        descricao="Tudo que sua empresa precisa pra profissionalizar a gestão de contratos públicos."
        features={[
          "Multi-CNPJ até 4",
          "8 módulos integrados",
          "Extração de PDF via IA ilimitada",
          "Dashboard com mapa interativo",
          "Notificações no app",
          "Suporte por chat",
        ]}
      />
      <CardPlano
        value="PREMIUM"
        ativo={plano === "PREMIUM"}
        onClick={() => setPlano("PREMIUM")}
        titulo="Premium"
        preco="R$ 997"
        sub="/mês"
        destaque
        descricao="Software + força jurídica de uma das maiores escolas de Direito Administrativo do Brasil."
        features={[
          "Tudo do Básico, sem limites",
          "12 consultas jurídicas/ano com especialistas",
          "2 peças jurídicas/ano (defesa, recurso, parecer)",
          "Notificações via WhatsApp",
          "Suporte prioritário com SLA",
          "Onboarding assistido",
        ]}
      />
      <p className="col-span-4 -mt-2 text-xs text-slate-500">
        Ambos os planos começam com <strong>14 dias grátis</strong>. A cobrança só acontece após o trial — você
        pode trocar de plano ou cancelar a qualquer momento.
      </p>

      {/* Forma de pagamento aparece SÓ depois que o plano foi escolhido */}
      {plano && (
        <>
          <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Forma de pagamento <span className="text-red-500">*</span>
          </h2>
          <CampoCartao
            erros={{
              cartaoNumero: e.cartaoNumero,
              cartaoValidade: e.cartaoValidade,
              cartaoCvv: e.cartaoCvv,
              cartaoNome: e.cartaoNome,
            }}
          />
        </>
      )}

      {/* Aceite obrigatório do contrato — Regina 03/07 */}
      <div className="col-span-4 mt-4 rounded-xl px-4 py-3" style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.4)" }}>
        <label className="flex items-start gap-2.5 text-[13px]" style={{ color: "#2D3340" }}>
          <input
            type="checkbox"
            name="aceiteTermos"
            value="1"
            required
            className="mt-0.5"
          />
          <span>
            Li e aceito o{" "}
            <a href="/termos" target="_blank" rel="noreferrer" className="font-bold underline" style={{ color: "#9C7A2D" }}>
              Contrato de Prestação de Serviços & Termos de Uso
            </a>
            , incluindo autorização para recebimento de notificações por e-mail e WhatsApp
            e tratamento de dados pessoais conforme LGPD.
          </span>
        </label>
        {e.aceiteTermos && (
          <p className="mt-2 text-[11px] font-semibold" style={{ color: "#BE123C" }}>
            {e.aceiteTermos}
          </p>
        )}
      </div>

      <div className="col-span-4 mt-2">
        {plano ? (
          <SubmitButton>Criar conta de empresa · Trial 14 dias</SubmitButton>
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500"
          >
            Selecione um plano pra continuar ↑
          </button>
        )}
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
      <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
        <div className="flex items-center justify-between gap-3">
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
        {/* Condições da comissão (opcional). Se vazios, ficam 0 e voce ajusta
            depois em /vinculos. Se preenchidos, ja entram com o valor. */}
        <div className="grid grid-cols-2 gap-3 border-t border-emerald-200 pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">
              Comissão variável (%) <span className="text-slate-400">— opcional</span>
            </span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              name="vinculoPercentual"
              placeholder="Ex: 5"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">
              Fixo mensal (R$) <span className="text-slate-400">— opcional</span>
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="vinculoFixo"
              placeholder="Ex: 1500"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">
          Pode deixar em branco e ajustar depois em comum acordo com o analista.
        </p>
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
  const [temPj, setTemPj] = useState<"sim" | "nao">(v.temPj === "sim" ? "sim" : "nao");
  const [pixTipo, setPixTipo] = useState<string>(v.pixTipo ?? "");

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
      <CampoCpf defaultValue={v.cpf ?? ""} erro={e.cpf} span={1} />
      <Field label="E-mail de acesso" name="email" type="email" autoComplete="email" required defaultValue={v.email ?? ""} erro={e.email} span={2} />
      <CampoTelefone defaultValue={v.telefone ?? ""} erro={e.telefone} span={2} />
      <Field label="Senha (mín. 6 caracteres)" name="senha" type="password" required erro={e.senha} span={2} />
      <Field label="Confirmação de senha" name="confirmacaoSenha" type="password" required erro={e.confirmacaoSenha} span={2} />

      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Endereço <span className="ml-2 font-normal normal-case text-slate-400">(para mapearmos onde estão os analistas)</span>
      </h2>
      <CampoCep defaultValue={v.cep ?? ""} erro={e.cep} span={1} />
      <Field label="Endereço" name="endereco" required defaultValue={v.endereco ?? ""} erro={e.endereco} span={3} />
      <Field label="Complemento" name="complemento" placeholder="Loja, sala, andar…" defaultValue={v.complemento ?? ""} erro={e.complemento} span={4} />

      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Pessoa jurídica <span className="ml-2 font-normal normal-case text-slate-400">(emite nota como PJ?)</span>
      </h2>
      <div className="col-span-4 flex items-center gap-3">
        <input type="hidden" name="temPj" value={temPj} />
        <button
          type="button"
          onClick={() => setTemPj("sim")}
          className={`rounded-full border-2 px-5 py-2 text-sm font-semibold transition ${
            temPj === "sim" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
        >
          Sim, emito como PJ
        </button>
        <button
          type="button"
          onClick={() => setTemPj("nao")}
          className={`rounded-full border-2 px-5 py-2 text-sm font-semibold transition ${
            temPj === "nao" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
        >
          Não, sou autônomo
        </button>
      </div>

      {temPj === "sim" && (
        <>
          <CampoCnpj defaultValue={v.cnpj ?? ""} erro={e.cnpj} required={false} />
          <Field label="Razão social" name="razaoSocial" defaultValue={v.razaoSocial ?? ""} erro={e.razaoSocial} span={3} />
          <Field label="Nome fantasia" name="nomeFantasia" defaultValue={v.nomeFantasia ?? ""} erro={e.nomeFantasia} span={1} />
          <Select label="Porte" name="porte" options={PORTES} defaultValue={v.porte ?? ""} erro={e.porte} span={2} ajuda={AJUDA.porte} />
          <Select
            label="Natureza jurídica"
            name="naturezaJuridica"
            options={OPCOES_NATUREZA_JURIDICA}
            defaultValue={v.naturezaJuridica ?? ""}
            erro={e.naturezaJuridica}
            span={2}
            ajuda={AJUDA.naturezaJuridica}
          />
          <Field label="CNAE principal (opcional)" name="cnaePrincipal" placeholder="ex.: 6911-7/01" defaultValue={v.cnaePrincipal ?? ""} erro={e.cnaePrincipal} span={2} ajuda={AJUDA.cnaePrincipal} />
          <Field label="CNAEs secundários" name="cnaesSecundarios" placeholder="separar por vírgula" defaultValue={v.cnaesSecundarios ?? ""} erro={e.cnaesSecundarios} span={2} ajuda={AJUDA.cnaesSecundarios} />
          <Field label="Endereço da PJ" name="enderecoPj" defaultValue={v.enderecoPj ?? ""} erro={e.enderecoPj} span={4} />
          <Field label="E-mail da PJ" name="emailPj" type="email" placeholder="contato@empresa.com" defaultValue={v.emailPj ?? ""} erro={e.emailPj} span={2} />
          <Field label="Telefone da PJ" name="telefonePj" placeholder="(61) 9 9999-9999" defaultValue={v.telefonePj ?? ""} erro={e.telefonePj} span={2} />
        </>
      )}

      <h2 className="col-span-4 mt-6 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Dados bancários
      </h2>
      <p className="col-span-4 -mt-2 text-xs text-slate-500">
        {temPj === "sim"
          ? "Use a conta da PJ que você acabou de cadastrar."
          : "Conta de pessoa física (CPF do analista)."}
      </p>
      <CampoBanco defaultValue={v.banco ?? ""} erro={e.banco} span={2} />
      <Field label="Agência (com dígito, se houver)" name="agencia" placeholder="0000-0" defaultValue={v.agencia ?? ""} erro={e.agencia} span={1} />
      <Field label="Conta corrente (com dígito)" name="contaCorrente" placeholder="00000-0" defaultValue={v.contaCorrente ?? ""} erro={e.contaCorrente} span={1} />
      <Select label="Tipo de chave PIX" name="pixTipo" options={PIX_TIPOS} defaultValue={pixTipo} erro={e.pixTipo} span={2} onChange={(ev) => setPixTipo((ev.target as HTMLSelectElement).value)} />
      <Field label="Chave PIX" name="pix" placeholder={pixTipo === "EMAIL" ? "voce@dominio.com" : pixTipo === "TELEFONE" ? "(61) 9 9999-9999" : pixTipo === "CPF" ? "000.000.000-00" : pixTipo === "CNPJ" ? "00.000.000/0000-00" : "chave"} defaultValue={v.pix ?? ""} erro={e.pix} span={2} ajuda={AJUDA.pixAnalista} />

      <div className="col-span-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Prezado analista, no <strong>CP System</strong> você <strong>não paga assinatura</strong>. Seu painel mostrará os dados de
        todas as empresas que o vincularem como analista de licitação, mostrando todos os dados de forma consolidada,
        facilitando sua gestão e controle no recebimento de comissões.
      </div>

      <div className="col-span-4 mt-2">
        <SubmitButton>Criar conta de analista · gratuito</SubmitButton>
      </div>
    </form>
  );
}
