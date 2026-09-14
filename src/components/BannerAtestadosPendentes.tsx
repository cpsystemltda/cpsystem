import Link from "next/link";
import { Award } from "lucide-react";

/**
 * O aviso no topo da lista de Atas e de Contratos (Regina 11/09).
 *
 * É o "alerta dentro do módulo" do pedido: quem abre a lista vê de cara quantas
 * contratações encerraram sem que o Atestado de Capacidade Técnica tenha sido
 * pedido ao órgão — e clica pra ver exatamente quais.
 *
 * Só aparece quando há o que cobrar, e some assim que o filtro está aplicado:
 * repetir o aviso na tela que ele já abriu seria mobília.
 */
export function BannerAtestadosPendentes({
  quantidade,
  href,
  rotuloPlural,
  rotuloSingular,
}: {
  quantidade: number;
  href: string;
  /** "Atas" / "Contratos" */
  rotuloPlural: string;
  /** "Ata" / "Contrato" */
  rotuloSingular: string;
}) {
  if (quantidade <= 0) return null;
  const uma = quantidade === 1;

  return (
    <Link
      href={href}
      className="glass mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-5 py-4 transition hover:-translate-y-0.5"
      style={{
        background: "rgba(212,175,55,0.10)",
        border: "0.5px solid rgba(168,137,71,0.30)",
      }}
    >
      <div className="flex items-start gap-3">
        <Award className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary-deep)" }} />
        <div>
          <p className="text-[14px] font-extrabold" style={{ color: "var(--primary-deep)" }}>
            {uma
              ? `1 ${rotuloSingular} encerrou e ainda não teve o Atestado solicitado`
              : `${quantidade} ${rotuloPlural} encerraram e ainda não tiveram o Atestado solicitado`}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-soft)" }}>
            O Atestado de Capacidade Técnica é o que comprova sua qualificação nas próximas
            licitações. Peça ao órgão enquanto a execução está recente.
          </p>
        </div>
      </div>
      <span
        className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold"
        style={{
          background: "var(--glass-2)",
          border: "0.5px solid var(--border-soft)",
          color: "var(--text)",
        }}
      >
        Ver {uma ? "qual" : "quais"}
      </span>
    </Link>
  );
}
