import { ScrollText, Download, Lock } from "lucide-react";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { aceitarTermosAction } from "@/app/actions/equipe";
import { PageHeader } from "@/components/ui/SecaoGlass";
import {
  ContratoTermosUso,
  VERSAO_TERMOS,
  VIGENCIA_TERMOS,
} from "@/components/legal/ContratoTermosUso";

// Rota INTERNA (com auth) — mesmo texto contratual da rota publica
// /legal/termos, acrescido do botao de aceite formal.
export default async function TermosPage() {
  const usuario = await exigirUsuario();
  const aceito = usuario.conta.termosAceitosEm;

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Conformidade legal"
        titulo="Termos &"
        destaque="LGPD"
        subtitulo={`Contrato de Prestação de Serviços v${VERSAO_TERMOS} · Em vigor desde ${VIGENCIA_TERMOS}`}
      />

      {aceito ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✓ Você aceitou os termos em {aceito.toLocaleString("pt-BR")}.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ Você ainda não aceitou os termos formais. Leia integralmente e aceite ao final desta página.
        </div>
      )}

      <div className="mt-8">
        <ContratoTermosUso />
      </div>

      <div className="mt-10 rounded-xl px-5 py-4" style={{ background: "rgba(15,14,12,0.04)", border: "0.5px solid var(--hairline)" }}>
        <h3 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
          Ações rápidas — direitos do titular (LGPD)
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Link
            href="/equipe"
            className="flex items-center gap-2 rounded-[12px] px-4 py-3 text-sm transition hover:-translate-y-0.5"
            style={{ background: "rgba(255,255,255,0.7)", border: "0.5px solid var(--hairline)" }}
          >
            <Download className="h-4 w-4" /> Exportar meus dados
          </Link>
          <a
            href="mailto:contato@cpsystem.app.br?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20LGPD"
            className="flex items-center gap-2 rounded-[12px] px-4 py-3 text-sm transition hover:-translate-y-0.5"
            style={{ background: "rgba(255,255,255,0.7)", border: "0.5px solid var(--hairline)" }}
          >
            <Lock className="h-4 w-4" /> Solicitar exclusão da conta
          </a>
        </div>
      </div>

      {!aceito && (
        <form action={aceitarTermosAction} className="mt-8 rounded-xl px-5 py-5" style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.5)" }}>
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
  );
}
