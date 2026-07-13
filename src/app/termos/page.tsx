import Link from "next/link";
import { ScrollText } from "lucide-react";
import { getUsuarioAtual } from "@/lib/auth";
import { aceitarTermosAction } from "@/app/actions/equipe";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";
import {
  ContratoTermosUso,
  VERSAO_TERMOS,
  VIGENCIA_TERMOS,
  type DadosContratante,
} from "@/components/legal/ContratoTermosUso";
import {
  ContratoAnalistaParceiro,
  VERSAO_CONTRATO_ANALISTA,
  VIGENCIA_CONTRATO_ANALISTA,
  type DadosAnalista,
} from "@/components/legal/ContratoAnalistaParceiro";

// Rota unica dos termos: /termos = contrato empresa, /termos?tipo=analista
// = contrato analista. Se logado, detecta automaticamente pelo tipo da conta.
// Logado sem aceite: botao formal de aceite. Logado com aceite: mostra timestamp.
export default async function TermosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const sp = await searchParams;
  const usuario = await getUsuarioAtual();

  // Determina qual contrato mostrar. Prioridade: (1) tipo do usuario logado,
  // (2) ?tipo=analista na URL, (3) default = empresa.
  const tipoContrato: "EMPRESA" | "ANALISTA" =
    usuario?.conta?.tipo === "ANALISTA"
      ? "ANALISTA"
      : sp?.tipo === "analista"
        ? "ANALISTA"
        : "EMPRESA";

  // Só considera "já aceito" se o usuario aceitou a versao atual do contrato
  // do tipo dele. Bump de versao (2.1 → 2.2) volta o botao.
  const versaoAceita = usuario?.conta?.termosAceitosVersao ?? null;
  const versaoContratoAtual = tipoContrato === "ANALISTA" ? VERSAO_CONTRATO_ANALISTA : VERSAO_TERMOS;
  const jaAceito = usuario?.conta?.termosAceitosEm && versaoAceita === versaoContratoAtual
    ? usuario.conta.termosAceitosEm
    : null;

  // Carrega dados do CONTRATANTE (empresa) ou do ANALISTA pra personalizar.
  let contratante: DadosContratante | undefined;
  let analistaDados: DadosAnalista | undefined;

  if (usuario) {
    const dadosUsuario = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { nome: true, email: true, cpf: true, telefoneWhatsApp: true },
    });

    if (tipoContrato === "EMPRESA") {
      const empresa = await prisma.empresa.findFirst({
        where: { contaId: usuario.contaId },
        orderBy: { criadoEm: "asc" },
        select: { razaoSocial: true, cnpj: true, endereco: true },
      });
      contratante = {
        razaoSocial: empresa?.razaoSocial ?? null,
        cnpj: empresa?.cnpj ?? null,
        enderecoEmpresa: empresa?.endereco ?? null,
        nomeRepresentante: dadosUsuario?.nome ?? null,
        cpfRepresentante: dadosUsuario?.cpf ?? null,
        emailRepresentante: dadosUsuario?.email ?? null,
      };
    } else {
      const analista = await prisma.analista.findUnique({
        where: { contaId: usuario.contaId },
        select: { nomeCompleto: true, cpf: true, endereco: true, email: true, telefone: true },
      });
      analistaDados = {
        nomeCompleto: analista?.nomeCompleto ?? dadosUsuario?.nome ?? null,
        cpf: analista?.cpf ?? dadosUsuario?.cpf ?? null,
        endereco: analista?.endereco ?? null,
        email: analista?.email ?? dadosUsuario?.email ?? null,
        telefone: analista?.telefone ?? dadosUsuario?.telefoneWhatsApp ?? null,
      };
    }
  }

  const versao = tipoContrato === "ANALISTA" ? VERSAO_CONTRATO_ANALISTA : VERSAO_TERMOS;
  const vigencia = tipoContrato === "ANALISTA" ? VIGENCIA_CONTRATO_ANALISTA : VIGENCIA_TERMOS;
  const titulo = tipoContrato === "ANALISTA"
    ? "Contrato de Adesão ao Programa de Analista Parceiro"
    : "Contrato de Prestação de Serviços & Termos de Uso";

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <header className="border-b py-5" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6">
          <Logo variant="md" />
          <Link
            href={usuario ? "/dashboard" : "/"}
            className="text-xs font-semibold transition hover:opacity-70"
            style={{ color: "var(--text-soft)" }}
          >
            ← {usuario ? "Voltar ao painel" : "Voltar ao site"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1
          className="text-3xl font-extrabold"
          style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
        >
          {titulo}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          Versão {versao} · Em vigor desde {vigencia}
        </p>
        {/* Alternador entre os 2 contratos pra usuarios nao logados */}
        {!usuario && (
          <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            <Link
              href="/termos"
              className={`rounded px-3 py-1.5 font-semibold transition ${
                tipoContrato === "EMPRESA" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Contrato Empresa
            </Link>
            <Link
              href="/termos?tipo=analista"
              className={`rounded px-3 py-1.5 font-semibold transition ${
                tipoContrato === "ANALISTA" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Contrato Analista
            </Link>
          </div>
        )}

        {/* Status de aceite pra usuário logado */}
        {usuario && jaAceito && (
          <div
            className="mt-6 rounded-lg px-4 py-3 text-sm"
            style={{ background: "rgba(63,168,95,0.1)", color: "#2F8F4C", border: "0.5px solid rgba(63,168,95,0.3)" }}
          >
            ✓ Você aceitou estes termos em {jaAceito.toLocaleString("pt-BR")}.
          </div>
        )}
        {usuario && !jaAceito && (
          <div
            className="mt-6 rounded-lg px-4 py-3 text-sm"
            style={{ background: "rgba(251,113,133,0.08)", color: "#BE123C", border: "0.5px solid rgba(251,113,133,0.3)" }}
          >
            ⚠ Você ainda não aceitou os termos formais. Leia integralmente e aceite ao final desta página.
          </div>
        )}

        <div className="mt-10">
          {tipoContrato === "ANALISTA" ? (
            <ContratoAnalistaParceiro analista={analistaDados} />
          ) : (
            <ContratoTermosUso contratante={contratante} />
          )}
        </div>

        {/* Rodapé condicional */}
        <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          {!usuario && (
            <div>
              <p className="mb-4 text-sm" style={{ color: "var(--text-soft)" }}>
                Ao criar sua conta no CP System, você aceita este contrato.
              </p>
              <Link
                href={tipoContrato === "ANALISTA" ? "/signup?tipo=ANALISTA" : "/signup"}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                  color: "#0A0A0A",
                  letterSpacing: "0.18em",
                }}
              >
                {tipoContrato === "ANALISTA" ? "Cadastrar-se como analista →" : "Cadastrar-se →"}
              </Link>
            </div>
          )}
          {usuario && !jaAceito && (
            <form
              action={aceitarTermosAction}
              className="rounded-xl px-5 py-5"
              style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.5)" }}
            >
              <p className="text-sm" style={{ color: "var(--text)" }}>
                <strong>Aceitação formal</strong> — declaro que li integralmente o{" "}
                {tipoContrato === "ANALISTA" ? "Contrato de Adesão ao Programa de Analista Parceiro" : "Contrato de Prestação de Serviços & Termos de Uso"}{" "}
                versão {versao} e concordo com todas as suas cláusulas,
                {tipoContrato === "ANALISTA"
                  ? " incluindo obrigações de conduta, regime de comissão vitalícia por R$ 29,90 por vínculo ativo (dia 20 do mês seguinte via PIX automático), vedações e sigilo."
                  : " incluindo autorização para recebimento de comunicações eletrônicas (e-mail e WhatsApp), tratamento de dados pessoais conforme LGPD e uso da IAsystem como funcionalidade complementar."}
              </p>
              <button
                type="submit"
                className="mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                  color: "#0A0A0A",
                  letterSpacing: "0.18em",
                }}
              >
                <ScrollText size={14} /> Li e aceito os termos
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
