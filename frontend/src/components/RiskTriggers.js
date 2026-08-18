import React from "react";
import { TriangleAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

const LEVEL = {
  high: { tone: "danger", label: "HIGH RISK", text: "text-danger" },
  medium: { tone: "amber", label: "MEDIUM RISK", text: "text-amber" },
  low: { tone: "green", label: "LOW RISK", text: "text-green-strong" },
};

export default function RiskTriggers({ risk }) {
  if (!risk) return null;
  const meta = LEVEL[risk.level] || LEVEL.low;
  return (
    <div className="card p-5" data-testid="risk-triggers">
      <div className="mb-3 flex items-center gap-2">
        {risk.level === "low" ? (
          <ShieldCheck size={18} className="text-green" />
        ) : (
          <TriangleAlert size={18} className={meta.text} />
        )}
        <Badge tone={meta.tone} data-testid="risk-level">{meta.label}</Badge>
        <span className="text-sm text-ink-faint">Dipicu oleh aturan, bukan skor.</span>
      </div>
      {risk.triggers.length === 0 ? (
        <p className="text-sm text-ink-soft">Tidak ada pemicu risiko. Scope terlihat sehat.</p>
      ) : (
        <ul className="space-y-2">
          {risk.triggers.map((t) => (
            <li key={t.code} className="flex items-start gap-2.5" data-testid={`trigger-${t.code}`}>
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  t.severity === "high" ? "bg-danger" : "bg-amber"
                }`}
              />
              <div>
                <span className="text-sm font-semibold text-ink">{t.label}</span>
                <p className="text-[13px] text-ink-soft">{t.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
