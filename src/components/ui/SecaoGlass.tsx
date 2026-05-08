import type { ReactNode } from "react";

export function SecaoGlass({
  numero,
  titulo,
  subtitulo,
  icone: Icone,
  children,
}: {
  numero: string;
  titulo: string;
  subtitulo?: string;
  icone?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  return (
    <section className="glass overflow-hidden rounded-[24px]">
      <header
        className="relative z-[1] flex items-center gap-4 px-8 py-5"
        style={{ borderBottom: "0.5px solid var(--hairline)" }}
      >
        <div
          className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-extrabold"
          style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.06))",
            border: "0.5px solid rgba(212,175,55,0.4)",
            color: "var(--primary-bright)",
            letterSpacing: "-0.04em",
          }}
        >
          {numero}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {Icone && <Icone className="h-4 w-4" style={{ color: "var(--primary)" }} />}
            <h2
              className="text-[20px] font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              {titulo}
            </h2>
          </div>
          {subtitulo && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-mute)" }}>
              {subtitulo}
            </p>
          )}
        </div>
      </header>
      <div className="relative z-[1] px-8 py-6">{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  titulo,
  destaque,
  subtitulo,
  cta,
}: {
  eyebrow?: string;
  titulo: string;
  destaque?: string;
  subtitulo?: string;
  cta?: ReactNode;
}) {
  return (
    <header className="glass mb-6 flex items-end justify-between gap-6 rounded-[28px] px-9 py-7">
      <div className="relative z-[1]">
        {eyebrow && (
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--primary)" }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-2 text-[40px] font-extrabold leading-none"
          style={{ color: "var(--text)", letterSpacing: "-0.045em" }}
        >
          {titulo}{" "}
          {destaque && (
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {destaque}
            </em>
          )}
        </h1>
        {subtitulo && (
          <p
            className="mt-3 max-w-[640px] text-[14px]"
            style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
          >
            {subtitulo}
          </p>
        )}
      </div>
      {cta && <div className="relative z-[1]">{cta}</div>}
    </header>
  );
}
