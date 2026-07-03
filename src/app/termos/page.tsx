import Link from "next/link";
import { ScrollText } from "lucide-react";
import { getUsuarioAtual } from "@/lib/auth";
import { aceitarTermosAction } from "@/app/actions/equipe";
import { Logo } from "@/components/Logo";
import {
  ContratoTermosUso,
  VERSAO_TERMOS,
  VIGENCIA_TERMOS,
} from "@/components/legal/ContratoTermosUso";

// Rota unica dos termos (Regina 03/07): mesmo texto pra logado e nao-logado.
// Sem login: CTA "Cadastrar". Logado sem aceite: botao formal de aceite.
// Logado com aceite: mostra timestamp.
export default async function TermosPage() {
  const usuario = await getUsuarioAtual();
  const jaAceito = usuario?.conta?.termosAceitosEm ?? null;

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
          Contrato de Prestação de Serviços & Termos de Uso
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          Versão {VERSAO_TERMOS} · Em vigor desde {VIGENCIA_TERMOS}
        </p>

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
          <ContratoTermosUso />
        </div>

        {/* Rodapé condicional */}
        <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          {!usuario && (
            <div>
              <p className="mb-4 text-sm" style={{ color: "var(--text-soft)" }}>
                Ao criar sua conta no CP System, você aceita este contrato.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                  color: "#0A0A0A",
                  letterSpacing: "0.18em",
                }}
              >
                Cadastrar-se →
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
                <strong>Aceitação formal</strong> — declaro que li integralmente o Contrato de Prestação de
                Serviços & Termos de Uso versão {VERSAO_TERMOS} e concordo com todas as suas cláusulas,
                incluindo autorização para recebimento de comunicações eletrônicas (e-mail e WhatsApp),
                tratamento de dados pessoais conforme LGPD e uso da IAsystem como funcionalidade complementar.
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
