import type { ReactNode } from "react";

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-tile relative overflow-hidden rounded-[22px] px-7 py-6 ${className}`}>
      <div className="relative z-[1]">
        <h3
          className="text-[18px] font-bold leading-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--text-mute)" }}>
            {subtitle}
          </p>
        )}
        <div
          className="my-4 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--hairline), transparent)" }}
        />
        {children}
      </div>
    </div>
  );
}
