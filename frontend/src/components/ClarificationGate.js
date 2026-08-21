import React from "react";
import { HelpCircle, Copy, Check, Calculator } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";
import { useClipboard } from "@/components/WhatsAppPreview";

const IMPACT_LABEL = {
  time: "Time",
  cost: "Cost",
  revision: "Revision",
  dependency: "Dependency",
  acceptance: "Acceptance",
};

function Toggle({ label, value, onChange, testid }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <button
        role="switch"
        aria-checked={!!value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-green" : "bg-black/15"}`}
        data-testid={testid}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix, testid, min = 0 }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="relative">
        <input
          type="number"
          name={testid}
          className="input"
          value={value ?? ""}
          min={min}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          data-testid={testid}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">{suffix}</span>}
      </div>
    </label>
  );
}

export default function ClarificationGate({ overrides, setOverrides, questions, onRecalc, recalculating, estimationSupported = true, scopeSchema }) {
  const { state, copy } = useClipboard();
  const set = (k, v) => setOverrides((o) => ({ ...o, [k]: v }));

  const copyQuestions = () => {
    const lines = ["Before I quote, can you help answer these scope questions?"];
    questions.forEach((q, i) => lines.push(`${i + 1}. ${q.question}`));
    lines.push("\nThat keeps the offer accurate and prevents scope drift later. Thank you.");
    copy(lines.join("\n"));
  };

  const renderField = (key, meta) => {
    if (meta.hidden_if) {
      const { field, equals } = meta.hidden_if;
      if (overrides[field] === equals) return null;
    }

    if (meta.type === "integer") {
      return (
        <NumberInput
          key={key}
          label={meta.label}
          value={overrides[key]}
          onChange={(v) => set(key, v)}
          suffix={meta.suffix}
          min={meta.min}
          testid={`ov-${key}`}
        />
      );
    }
    if (meta.type === "boolean") {
      return (
        <Toggle
          key={key}
          label={meta.label}
          value={overrides[key]}
          onChange={(v) => set(key, v)}
          testid={`ov-${key}`}
        />
      );
    }
    if (meta.type === "select") {
      return (
        <label key={key} className="block">
          <span className="field-label">{meta.label}</span>
          <select
            name={`ov-${key}`}
            className="input"
            value={overrides[key] === null ? "unlimited" : overrides[key] ?? ""}
            onChange={(e) => set(key, e.target.value === "unlimited" ? null : Number(e.target.value))}
            data-testid={`ov-${key}`}
          >
            {meta.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      );
    }
    return null;
  };

  const numberFields = [];
  const booleanFields = [];
  if (scopeSchema) {
    for (const [key, meta] of Object.entries(scopeSchema)) {
      if (meta.type === "boolean") booleanFields.push({ key, meta });
      else numberFields.push({ key, meta });
    }
  }

  return (
    <div className="space-y-4" data-testid="clarification-gate">
      {questions?.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 font-bold text-ink">
              <HelpCircle size={16} className="text-amber" />
              Ask this before you quote
            </h4>
            <button onClick={copyQuestions} className="btn-secondary btn-sm" data-testid="copy-questions">
              {state === "ok" ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy questions</>}
            </button>
          </div>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={q.id || i} className="border-l-2 border-amber/40 pl-3" data-testid={`question-${i}`}>
                <p className="text-sm font-semibold text-ink">{i + 1}. {q.question}</p>
                <p className="mt-0.5 text-[13px] text-ink-soft">
                  <span className="font-semibold text-amber">Why this affects price: </span>
                  {q.why}
                </p>
                {q.impact?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.impact.map((im) => (
                      <span key={im} className="chip bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] px-2 py-0.5">{IMPACT_LABEL[im] || im}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {estimationSupported && (
        <div className="card p-5">
          <h4 className="mb-1 font-bold text-ink">Answers &amp; assumptions</h4>
          <p className="mb-4 text-[13px] text-ink-faint">
            Fill what you know. Unknown fields can stay as assumptions, but the range will widen.
          </p>
          
          {scopeSchema ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {numberFields.map(({ key, meta }) => renderField(key, meta))}
              </div>
              {booleanFields.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {booleanFields.map(({ key, meta }) => renderField(key, meta))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-4">
              <Spinner size={24} />
              <p className="mt-2 text-sm text-ink-faint">Loading schema...</p>
            </div>
          )}

          <button
            onClick={onRecalc}
            disabled={recalculating}
            className="btn-primary btn-md mt-4 w-full sm:w-auto"
            data-testid="recalc-btn"
          >
            {recalculating ? <><Spinner size={16} /> Calculating...</> : <><Calculator size={16} /> Calculate estimate</>}
          </button>
        </div>
      )}
    </div>
  );
}
