import React from "react";
import clsx from "clsx";
import { Info } from "lucide-react";

export function Badge({ tone = "neutral", children, className, ...rest }) {
  const tones = {
    green: "bg-green-soft text-green-strong border border-green/30",
    amber: "bg-amber-soft text-amber border border-amber/30",
    danger: "bg-danger-soft text-danger border border-danger/30",
    neutral: "bg-raised text-ink-soft border border-line/60",
    ink: "bg-raised text-ink border border-line/60",
  };
  return (
    <span className={clsx("chip", tones[tone], className)} {...rest}>
      {children}
    </span>
  );
}

export function DemoTag({ className, children = "Demo data" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400",
        className
      )}
      data-testid="demo-tag"
    >
      <Info size={11} /> {children}
    </span>
  );
}

export function Field({ label, hint, children, testid }) {
  return (
    <label className="block" data-testid={testid}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div>
      <div className="text-[13px] font-medium text-ink-faint">{label}</div>
      <div className={clsx("mt-0.5 text-lg font-bold", tone === "danger" && "text-danger", tone === "green" && "text-green-strong")}>
        {value}
      </div>
      {sub && <div className="text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Toast({ show, children }) {
  return (
    <div
      className={clsx(
        "pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center transition-all duration-300",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lift">
        {children}
      </div>
    </div>
  );
}

export function SpotlightCard({ as: Component = "div", className, children, ...rest }) {
  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return (
    <Component
      className={clsx("spotlight-card", className)}
      onPointerMove={handleMove}
      {...rest}
    >
      {children}
    </Component>
  );
}
