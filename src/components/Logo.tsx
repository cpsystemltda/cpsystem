type Variant = "xs" | "sm" | "md" | "lg" | "xl";
type Mode = "mark" | "full";

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
  const widthRatio = mode === "mark" ? 1 : 1.7;
  const width = Math.round(height * widthRatio);
  const src =
    mode === "mark"
      ? "/cp-system-logo.png"
      : onDark
      ? "/cp-consultoria-logo-white.png"
      : "/cp-consultoria-logo.png";

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt="Contratos Públicos Consultoria"
      width={width}
      height={height}
      style={{ height, width: "auto", display: "block" }}
      className={className}
    />
  );
}
