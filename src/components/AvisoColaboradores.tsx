import Link from "next/link";
import { Users, ArrowUpRight } from "lucide-react";
import { LIMITE_COLABORADORES } from "@/lib/modulosAcesso";

/**
 * Aviso de novidade: acesso por módulo pra colaboradores (Regina 21/08).
 *
 * Aparece pro titular que ainda opera sozinho e some sozinho no instante em que
 * ele cadastra a primeira pessoa — por isso não precisa de "não mostrar de
 * novo" nem de coluna de dispensa: quem já resolveu não vê mais.
 */
export function AvisoColaboradores() {
  return (
    <div
      className="mt-6 flex flex-col gap-4 rounded-[20px] border p-6 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: "rgba(168,137,71,0.4)",
        background: "linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.02))",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: "rgba(212,175,55,0.2)" }}
        >
          <Users className="h-5 w-5" style={{ color: "var(--primary-deep)" }} />
        </div>
        <div>
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.16em", color: "var(--primary-deep)" }}
          >
            Novidade
          </p>
          <h3 className="mt-0.5 text-base font-bold" style={{ color: "var(--text)" }}>
            Divida a operação com a sua equipe
          </h3>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-soft)" }}>
            Agora você cadastra até {LIMITE_COLABORADORES} colaboradores e escolhe, módulo a módulo,
            o que cada um enxerga. Quem acompanha atas e entregas trabalha sozinho, sem passar pelo
            financeiro da empresa.
          </p>
        </div>
      </div>
      <Link
        href="/equipe"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold"
        style={{ background: "var(--primary)", color: "#0A0A0A" }}
      >
        Cadastrar colaborador <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
