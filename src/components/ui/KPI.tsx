import type { ReactNode } from "react";

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
}: {
  tone: Tone;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  size?: "md" | "hero";
}) {
  const isHero = size === "hero";
  return (
    <div
      className={`glass-tile relative overflow-hidden t-${tone} ${isHero ? "rounded-[22px] px-6 py-6" : "rounded-[18px] px-5 py-5"}`}
    >
      <div className="kpi-aura" />
      <div className="relative z-[1]">
        {Icon && (
          <div
            className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: ICON_BG[tone] }}
          >
            <Icon className="h-[18px] w-[18px]" style={{ color: ICON_COLOR[tone], strokeWidth: 2 }} />
          </div>
        )}
        <div
          className="text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
        >
          {label}
        </div>
        <div
          className={`tabular mt-2 ${isHero ? "text-[64px] leading-[0.9]" : "text-[36px] leading-none"} font-extrabold`}
          style={{
            background: VALUE_GRADIENT[tone],
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: isHero ? "-0.06em" : "-0.045em",
          }}
        >
          {value}
        </div>
        {meta && (
          <div className="mt-3 text-[13px] font-semibold" style={{ color: "var(--text-soft)" }}>
            {meta}
          </div>
        )}
      </div>
    </div>
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
