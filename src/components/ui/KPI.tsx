import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type Tone = "primary" | "mint" | "rose" | "lavender" | "sky" | "coral";

const ICON_BG: Record<Tone, string> = {
  primary:  "rgba(212, 175, 55, 0.14)",
  mint:     "rgba(93, 216, 182, 0.14)",
  rose:     "rgba(240, 184, 168, 0.14)",
  lavender: "rgba(197, 180, 255, 0.14)",
  sky:      "rgba(184, 197, 214, 0.14)",
  coral:    "rgba(232, 138, 152, 0.14)",
};

const ICON_COLOR: Record<Tone, string> = {
  primary:  "var(--primary-deep)",
  mint:     "var(--mint-deep)",
  rose:     "#C68E7B",
  lavender: "#8E73E0",
  sky:      "#6F8BAA",
  coral:    "var(--coral-deep)",
};

const VALUE_GRADIENT: Record<Tone, string> = {
  primary:  "linear-gradient(180deg, var(--text) 30%, var(--primary-deep) 110%)",
  mint:     "linear-gradient(180deg, var(--text) 30%, var(--mint-deep) 110%)",
  rose:     "linear-gradient(180deg, var(--text) 30%, #C68E7B 110%)",
  lavender: "linear-gradient(180deg, var(--text) 30%, #8E73E0 110%)",
  sky:      "linear-gradient(180deg, var(--text) 30%, #6F8BAA 110%)",
  coral:    "linear-gradient(180deg, var(--text) 30%, var(--coral-deep) 110%)",
};

export function KPI({
  tone,
  icon: Icon,
  label,
  value,
  meta,
  size = "md",
  href,
  pulse,
}: {
  tone: Tone;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  size?: "md" | "hero";
  /** Quando passado, o card inteiro vira um Link clicável */
  href?: string;
  /** Pulso suave indicando atenção (reajustes, vencimentos críticos) */
  pulse?: boolean;
}) {
  const isHero = size === "hero";
  const RootEl = href ? (Link as React.ElementType) : ("div" as React.ElementType);
  return (
    <RootEl
      {...(href ? { href } : {})}
      className={`glass-tile group relative block overflow-hidden t-${tone} ${isHero ? "rounded-[20px] px-6 py-5" : "rounded-[18px] px-5 py-5"} ${href ? "transition hover:-translate-y-0.5 cursor-pointer" : ""} ${pulse ? "pulse-atencao" : ""}`}
      title={href ? `Abrir ${label.toLowerCase()}` : undefined}
    >
      <div className="kpi-aura" />
      {/* Seta de navegação no canto superior direito (quando o KPI é clicável) */}
      {href && (
        <ArrowRight
          className="absolute right-4 top-4 z-[2] h-5 w-5 transition-transform group-hover:translate-x-0.5"
          style={{ color: ICON_COLOR[tone], strokeWidth: 2.2 }}
        />
      )}
      <div className="relative z-[1]">
        {/* Header: ícone + label na mesma linha */}
        <div className="flex items-center gap-3" style={{ paddingRight: href ? "28px" : "0" }}>
          {Icon && (
            <div
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
              style={{ background: ICON_BG[tone] }}
            >
              <Icon className="h-5 w-5" style={{ color: ICON_COLOR[tone], strokeWidth: 2 }} />
            </div>
          )}
          <h3
            className={`flex-1 leading-tight ${isHero ? "text-[17px]" : "text-[15px]"} font-extrabold`}
            style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
          >
            {label}
          </h3>
        </div>

        {/* Valor */}
        <div
          className={`tabular mt-3 ${isHero ? "text-[44px] leading-[0.95]" : "text-[30px] leading-none"} font-extrabold`}
          style={{
            background: VALUE_GRADIENT[tone],
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.045em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </div>

        {/* Meta */}
        {meta && (
          <div className="mt-2 text-[12px] font-semibold" style={{ color: "var(--text-soft)" }}>
            {meta}
          </div>
        )}
      </div>
    </RootEl>
  );
}

// Helper para formatar valores monetários: 1.847.230,50
// Renderiza R$ pequeno + valor + centavos em cor mais clara
export function CurrencyValue({ amount }: { amount: number }) {
  const formatted = amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [int, dec] = formatted.split(",");
  return (
    <>
      <span
        style={{
          fontSize: "0.4em",
          color: "var(--text-mute)",
          fontWeight: 500,
          marginRight: "5px",
          letterSpacing: 0,
          verticalAlign: "0.2em",
        }}
      >
        R$
      </span>
      {int}
      <span style={{ color: "var(--text-faint)", fontSize: "0.6em", fontWeight: 600 }}>,{dec}</span>
    </>
  );
}
