import React from "react";
import { Quote, CircleCheck, CircleHelp, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

const GROUPS = [
  { key: "stated", label: "Sudah jelas", en: "Stated", tone: "green", Icon: CircleCheck },
  { key: "inferred", label: "Masih asumsi", en: "Inferred", tone: "amber", Icon: CircleHelp },
  { key: "missing", label: "Belum disebutkan", en: "Missing", tone: "neutral", Icon: CircleDashed },
];

function valueText(f) {
  if (f.value === null || f.value === undefined || f.value === "") return "—";
  if (typeof f.value === "boolean") return f.value ? "Ya" : "Tidak";
  return String(f.value);
}

export default function BriefMap({ fields }) {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="brief-map">
      {GROUPS.map(({ key, label, en, tone, Icon }) => {
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
            <p className="mb-3 -mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">{en}</p>
            {items.length === 0 ? (
              <p className="text-sm text-ink-faint">Tidak ada.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((f) => (
                  <li key={f.name} data-testid={`field-${f.name}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{f.label}</span>
                      <span className="text-sm text-ink-soft text-right">{valueText(f)}</span>
                    </div>
                    {f.status === "stated" && f.source_quote && (
                      <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-green-soft/60 px-2 py-1.5 text-[13px] italic text-green-strong">
                        <Quote size={12} className="mt-0.5 shrink-0" />
                        <span>“{f.source_quote}”</span>
                      </p>
                    )}
                    {f.status === "inferred" && f.inference_explanation && (
                      <p className="mt-1 text-[13px] text-ink-faint">{f.inference_explanation}</p>
                    )}
                    {f.status === "missing" && (
                      <p className="mt-1 text-[13px] text-ink-faint">Perlu ditanyakan sebelum quote.</p>
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
