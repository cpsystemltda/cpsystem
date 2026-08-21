import Link from "next/link";
import { Lock } from "lucide-react";
import { rotuloDoModulo } from "@/lib/modulosAcesso";

/**
 * Tela mostrada quando o colaborador abre um módulo que o titular não liberou
 * pra ele (Regina 21/08). Não é erro nem paywall: é uma restrição que outra
 * pessoa da mesma empresa configurou, então o texto aponta pra quem resolve —
 * o titular da conta — em vez de sugerir upgrade ou suporte.
 */
export function SemAcessoModulo({ chave }: { chave: string }) {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20 text-center">
      <div
        className="mx-auto grid h-12 w-12 place-items-center rounded-full"
        style={{ background: "rgba(212,175,55,0.14)" }}
      >
        <Lock className="h-5 w-5" style={{ color: "var(--primary-deep)" }} />
      </div>
      <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--text)" }}>
        {rotuloDoModulo(chave)} não está liberado pra você
      </h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-soft)" }}>
        O seu acesso ao CP System foi configurado por módulos. Se você precisa deste aqui pra
        trabalhar, peça ao titular da conta — ele libera em <strong>Conta › Equipe</strong>, marcando
        a caixa correspondente no seu cadastro.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold"
        style={{ background: "var(--primary-deep)", color: "#fff" }}
      >
        Voltar ao início
      </Link>
    </div>
  );
}
