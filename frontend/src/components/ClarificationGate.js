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

export default function ClarificationGate({ overrides, setOverrides, questions, onRecalc, recalculating, hideRecalc = false }) {
  const { state, copy } = useClipboard();
  const set = (k, v) => setOverrides((o) => ({ ...o, [k]: v }));

  const copyQuestions = () => {
    const lines = ["Before I quote, can you help answer these scope questions?"];
    questions.forEach((q, i) => lines.push(`${i + 1}. ${q.question}`));
    lines.push("\nThat keeps the offer accurate and prevents scope drift later. Thank you.");
    copy(lines.join("\n"));
  };

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

      <div className="card p-5">
        <h4 className="mb-1 font-bold text-ink">Answers &amp; assumptions</h4>
        <p className="mb-4 text-[13px] text-ink-faint">
          Fill what you know. Unknown fields can stay as assumptions, but the range will widen.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberInput label="Video count" value={overrides.quantity} onChange={(v) => set("quantity", v)} testid="ov-quantity" min={1} />
          <NumberInput label="Client budget" value={overrides.client_budget} onChange={(v) => set("client_budget", v)} suffix="IDR" testid="ov-budget" />
          <NumberInput label="Final duration / video" value={overrides.final_duration} onChange={(v) => set("final_duration", v)} suffix="sec" testid="ov-duration" />
          <NumberInput label="Deadline (working days)" value={overrides.deadline_working_days} onChange={(v) => set("deadline_working_days", v)} suffix="days" testid="ov-deadline" />
          <NumberInput label="Approver count" value={overrides.approver_count} onChange={(v) => set("approver_count", v)} suffix="people" testid="ov-approvers" min={1} />
          <label className="block">
            <span className="field-label">Revision rounds</span>
            <select
              name="ov-revisions"
              className="input"
              value={overrides.revision_rounds === null ? "unlimited" : overrides.revision_rounds ?? ""}
              onChange={(e) => set("revision_rounds", e.target.value === "unlimited" ? null : Number(e.target.value))}
              data-testid="ov-revisions"
            >
              <option value="1">1 round</option>
              <option value="2">2 rounds</option>
              <option value="3">3 rounds</option>
              <option value="unlimited">Unbounded</option>
            </select>
          </label>
          {!overrides.footage_preselected && (
            <NumberInput label="Raw footage volume" value={overrides.footage_hours} onChange={(v) => set("footage_hours", v)} suffix="hours" testid="ov-footage-hours" />
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Toggle label="Footage already selected" value={overrides.footage_preselected} onChange={(v) => set("footage_preselected", v)} testid="ov-footage-preselected" />
          <Toggle label="Subtitles included" value={overrides.subtitles} onChange={(v) => set("subtitles", v)} testid="ov-subtitles" />
          <Toggle label="Scripting included" value={overrides.scripting} onChange={(v) => set("scripting", v)} testid="ov-scripting" />
        </div>

        <button
          onClick={onRecalc}
          disabled={recalculating}
          className="btn-primary btn-md mt-4 w-full sm:w-auto"
          data-testid="recalc-btn"
        >
          {recalculating ? (
            <><Spinner size={16} /> {hideRecalc ? "Updating..." : "Calculating..."}</>
          ) : hideRecalc ? (
            <><Calculator size={16} /> Update scope critique</>
          ) : (
            <><Calculator size={16} /> Calculate estimate</>
          )}
        </button>
      </div>
    </div>
  );
}
