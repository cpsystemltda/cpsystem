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
    <section className="glass mb-[18px] overflow-hidden rounded-[28px]">
      <header className="relative z-[1] flex items-center justify-between gap-4 border-b border-white/10 px-9 pb-5 pt-7">
        <div className="flex items-center gap-4">
          <div
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[14px] font-extrabold"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.06))",
              border: "0.5px solid rgba(212,175,55,0.4)",
              color: "var(--primary-bright)",
              letterSpacing: "-0.04em",
              boxShadow: "0 0 16px rgba(212,175,55,0.18)",
            }}
          >
            {numero}
          </div>
          <div>
            <div
              className="mb-1 text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.24em", color: "var(--primary)" }}
            >
              {eyebrow}
            </div>
            <h2
              className="text-[28px] font-extrabold leading-[1.05]"
              style={{ color: "var(--text)", letterSpacing: "-0.04em" }}
            >
              {titulo}
            </h2>
          </div>
        </div>
        {tag && (
          <span
            className="rounded-full border border-white/10 px-3.5 py-1.5 text-[9px] font-extrabold uppercase"
            style={{
              letterSpacing: "0.18em",
              color: "#0A0A0A",
              background: "var(--primary)",
              boxShadow: "0 4px 16px var(--primary-glow)",
            }}
          >
            {tag}
          </span>
        )}
      </header>
      <div className="relative z-[1] px-9 pb-8 pt-6">{children}</div>
    </section>
  );
}
