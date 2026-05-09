import type { ReactNode } from "react";

export function Block({
  numero,
  eyebrow,
  titulo,
  tag,
  children,
}: {
  numero: string;
  eyebrow: string;
  titulo: ReactNode;
  tag?: string;
  children: ReactNode;
}) {
  return (
    <section className="glass mb-4 overflow-hidden rounded-[24px]">
      <header className="relative z-[1] flex items-center justify-between gap-4 px-7 pb-4 pt-5" style={{ borderBottom: "0.5px solid var(--hairline)" }}>
        <div className="flex items-center gap-4">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-extrabold"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.35), rgba(212,175,55,0.10))",
              border: "0.5px solid rgba(168,137,71,0.5)",
              color: "var(--primary-deep)",
              letterSpacing: "-0.04em",
              boxShadow: "0 0 16px rgba(212,175,55,0.12)",
            }}
          >
            {numero}
          </div>
          <div>
            <div
              className="mb-1 text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.24em", color: "var(--primary-deep)" }}
            >
              {eyebrow}
            </div>
            <h2
              className="text-[24px] font-extrabold leading-[1.05]"
              style={{ color: "var(--text)", letterSpacing: "-0.04em" }}
            >
              {titulo}
            </h2>
          </div>
        </div>
        {tag && (
          <span
            className="rounded-full px-3.5 py-1.5 text-[9px] font-extrabold uppercase"
            style={{
              letterSpacing: "0.18em",
              color: "#0A0A0A",
              background: "var(--primary)",
              border: "0.5px solid rgba(168,137,71,0.5)",
              boxShadow: "0 4px 16px rgba(212,175,55,0.25)",
            }}
          >
            {tag}
          </span>
        )}
      </header>
      <div className="relative z-[1] px-7 pb-6 pt-5">{children}</div>
    </section>
  );
}
