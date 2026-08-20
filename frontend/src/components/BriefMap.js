import React from "react";
import { Quote, CircleCheck, CircleHelp, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { idr } from "@/lib/format";

const GROUPS = [
  { key: "stated", label: "Stated", tone: "green", Icon: CircleCheck },
  { key: "inferred", label: "Assumed", tone: "amber", Icon: CircleHelp },
  { key: "missing", label: "Missing", tone: "neutral", Icon: CircleDashed },
];

function valueText(f) {
  if (f.value === null || f.value === undefined || f.value === "") return "-";
  if (typeof f.value === "boolean") return f.value ? "Yes" : "No";
  if (f.name === "client_budget" || f.name === "direct_costs_mentioned") return idr(Number(f.value));
  if (f.name === "final_duration" || f.name === "final_duration_seconds") return `${f.value} sec`;
  if (f.name === "footage_hours" || f.name === "footage_volume_minutes") return `${f.value}h`;
  if (f.name === "deadline_working_days") return `${f.value} days`;
  if (f.value === "unbounded") return "Unbounded";
  if (f.value === "basic") return "Basic";
  if (f.value === "custom") return "Custom";
  if (f.value === "none") return "None";
  return String(f.value);
}

export default function BriefMap({ fields }) {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="brief-map">
      {GROUPS.map(({ key, label, tone, Icon }) => {
        const items = fields.filter((f) => f.status === key);
        return (
          <div key={key} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={16} className={tone === "green" ? "text-green" : tone === "amber" ? "text-amber" : "text-ink-faint"} />
                <h4 className="text-sm font-bold text-ink">{label}</h4>
              </div>
              <Badge tone={tone}>{items.length}</Badge>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-ink-faint">Nothing here yet.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((f) => (
                  <li key={f.name} data-testid={`field-${f.name}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{f.label}</span>
                      <span className="text-sm text-ink-soft text-right">{valueText(f)}</span>
                    </div>
                    {f.status === "stated" && f.source_quote && (
                      <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-[12px] italic text-emerald-300">
                        <Quote size={11} className="mt-0.5 shrink-0 opacity-80" />
                        <span>"{f.source_quote}"</span>
                      </p>
                    )}
                    {f.status === "inferred" && f.inference_explanation && (
                      <p className="mt-1 text-[13px] text-ink-faint">{f.inference_explanation}</p>
                    )}
                    {f.status === "missing" && (
                      <p className="mt-1 text-[13px] text-ink-faint">Ask before quoting.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
