import React, { useMemo } from "react";
import { idr } from "@/lib/format";
import { DemoTag } from "@/components/ui/primitives";

export const DEMO_COST_PROFILE = {
  mode: "guided",
  target_take_home: 8000000,
  monthly_overhead: 1500000,
  monthly_reserve: 900000,
  total_working_hours: 160,
  billable_utilization: 0.65,
  cost_per_hour: null,
  target_margin: 0.2,
  is_demo: true,
};

function computeCostPerHour(cp) {
  if (cp.mode === "simple") return cp.cost_per_hour || null;
  const rbh = (cp.total_working_hours || 0) * (cp.billable_utilization || 0);
  if (rbh <= 0) return null;
  const total = (cp.target_take_home || 0) + (cp.monthly_overhead || 0) + (cp.monthly_reserve || 0);
  return Math.round(total / rbh);
}

function Money({ label, value, onChange, testid }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-faint">IDR</span>
        <input
          type="number"
          name={testid}
          className="input pl-12"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          data-testid={testid}
        />
      </div>
    </label>
  );
}

export default function CostProfileForm({ value, onChange, showDemoTag = true }) {
  const cp = value;
  const set = (k, v) => onChange({ ...cp, [k]: v, is_demo: false });
  const cph = useMemo(() => computeCostPerHour(cp), [cp]);

  return (
    <div data-testid="cost-profile-form">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex rounded-full border border-line bg-raised p-0.5">
          {["guided", "simple"].map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...cp, mode: m })}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-colors ${cp.mode === m ? "bg-green text-white" : "text-ink-soft"}`}
              data-testid={`cp-mode-${m}`}
            >
                  {m === "guided" ? "Guided" : "Simple"}
            </button>
          ))}
        </div>
        {showDemoTag && cp.is_demo && <DemoTag>Sample profile</DemoTag>}
      </div>

      {cp.mode === "guided" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Money label="Target take-home / month" value={cp.target_take_home} onChange={(v) => set("target_take_home", v)} testid="cp-takehome" />
          <Money label="Overhead & tools / month" value={cp.monthly_overhead} onChange={(v) => set("monthly_overhead", v)} testid="cp-overhead" />
          <Money label="Reserve / self-benefits" value={cp.monthly_reserve} onChange={(v) => set("monthly_reserve", v)} testid="cp-reserve" />
          <label className="block">
            <span className="field-label">Working hours / month</span>
            <input type="number" name="cp-hours" className="input" value={cp.total_working_hours ?? ""} onChange={(e) => set("total_working_hours", Number(e.target.value))} data-testid="cp-hours" />
          </label>
          <label className="block">
            <span className="field-label">Billable utilization (%)</span>
            <input type="number" name="cp-util" className="input" value={Math.round((cp.billable_utilization || 0) * 100)} onChange={(e) => set("billable_utilization", Number(e.target.value) / 100)} data-testid="cp-util" />
          </label>
          <label className="block">
            <span className="field-label">Target margin (%)</span>
            <input type="number" name="cp-margin" className="input" value={Math.round((cp.target_margin || 0) * 100)} onChange={(e) => set("target_margin", Number(e.target.value) / 100)} data-testid="cp-margin" />
          </label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Money label="Productive cost / hour" value={cp.cost_per_hour} onChange={(v) => set("cost_per_hour", v)} testid="cp-cph" />
          <label className="block">
            <span className="field-label">Target margin (%)</span>
            <input type="number" name="cp-margin" className="input" value={Math.round((cp.target_margin || 0) * 100)} onChange={(e) => set("target_margin", Number(e.target.value) / 100)} data-testid="cp-margin" />
          </label>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-xl bg-green-soft/60 px-4 py-2.5">
        <span className="text-[13px] font-medium text-green-strong">Productive cost per hour</span>
        <span className="mono font-bold text-green-strong" data-testid="cp-preview">{cph ? idr(cph) + " / h" : "Incomplete"}</span>
      </div>
    </div>
  );
}
