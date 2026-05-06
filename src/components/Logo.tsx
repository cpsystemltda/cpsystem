type Variant = "xs" | "sm" | "md" | "lg" | "xl";
type Mode = "mark" | "full" | "brand";

const HEIGHT_PX: Record<Variant, number> = {
  xs: 32,
  sm: 56,
  md: 80,
  lg: 120,
  xl: 200,
};

// PNGs já processados em /public com canal alpha real (transparente):
//   /cp-consultoria-logo.png       → versão dourada premium para fundo claro
//   /cp-consultoria-logo-white.png → versão silhueta branca para fundo escuro
//   /cp-system-logo.png            → monograma quadrado original (legacy)
export function Logo({
  variant = "md",
  className = "",
  mode = "full",
  onDark = false,
}: {
  variant?: Variant;
  className?: string;
  priority?: boolean;
  mode?: Mode;
  onDark?: boolean;
}) {
  const height = HEIGHT_PX[variant];

  // mode "brand" = monograma CP dourado + texto "CP System" abaixo na MESMA LINHA
  // (mesma família tipográfica serif romana da logo original)
  if (mode === "brand") {
    const tracking = "0.32em";
    return (
      <div className={`flex flex-col items-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cp-monograma.png"
          alt="CP System"
          style={{ height, width: height, display: "block" }}
        />
        {/* Linha decorativa dourada fina + texto + linha — estilo da logo original */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <span
            className={`h-px w-10 ${onDark ? "bg-[#D4AF37]/60" : "bg-[#9C7A2D]/40"}`}
          />
          <span
            className={`whitespace-nowrap font-[var(--font-brand)] text-[0.8rem] font-medium uppercase ${
              onDark ? "text-[#F4D374]" : "text-[#9C7A2D]"
            }`}
            style={{ letterSpacing: tracking, paddingLeft: tracking }}
          >
            CP System
          </span>
          <span
            className={`h-px w-10 ${onDark ? "bg-[#D4AF37]/60" : "bg-[#9C7A2D]/40"}`}
          />
        </div>
      </div>
    );
  }

  const widthRatio = mode === "mark" ? 1 : 1.7;
  const width = Math.round(height * widthRatio);
  const src =
    mode === "mark"
      ? "/cp-monograma.png"
      : onDark
      ? "/cp-consultoria-logo-white.png"
      : "/cp-consultoria-logo.png";

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={mode === "mark" ? "CP System" : "Contratos Públicos Consultoria"}
      width={width}
      height={height}
      style={{ height, width: "auto", display: "block" }}
      className={className}
    />
  );
}
