import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { History } from "lucide-react";
import { idrCompact, hoursRange } from "@/lib/format";
import { Badge, DemoTag } from "@/components/ui/primitives";
import FormulaDrawer from "@/components/FormulaDrawer";

const CONF = {
  low: { tone: "amber", label: "Low confidence" },
  medium: { tone: "amber", label: "Medium confidence" },
  high: { tone: "green", label: "High confidence" },
};

function Metric({ label, value, sub, tone, testid }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-3.5" data-testid={testid}>
      <div className="text-[12px] font-medium text-ink-faint">{label}</div>
      <div
        className={`mt-1 text-[19px] font-extrabold leading-tight ${
          tone === "danger" ? "text-danger" : tone === "green" ? "text-green-strong" : "text-ink"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-faint">{sub}</div>}
    </div>
  );
}

export default function EstimateResult({ estimate, price, completeness, confidence, calibrationTrace, costProfile, isDemo, onFormulaOpen }) {
  const conf = CONF[confidence?.level] || CONF.low;
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-4" data-testid="estimate-result">
      {/* Scope completeness + confidence */}
      <div className="card p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-ink">Scope completeness</h4>
          <Badge tone={conf.tone} data-testid="confidence-badge">{conf.label}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
            <motion.div
              className="h-full origin-left rounded-full bg-green"
              style={{ width: `${completeness.percent}%` }}
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="mono text-sm font-bold text-ink" data-testid="completeness-pct">{completeness.percent}%</span>
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          {completeness.resolved} of {completeness.total} required fields are resolved. {confidence?.reason}
        </p>
      </div>

      {/* Numbers */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-bold text-ink">Transparent estimate</h4>
          {isDemo && <DemoTag />}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Estimated hours" value={hoursRange(estimate.low, estimate.high)} testid="metric-hours" />
          {price ? (
            <>
              <Metric label="Break-even" value={idrCompact(price.break_even_low)} sub={`to ${idrCompact(price.break_even_high)}`} testid="metric-breakeven" />
              <Metric label="Price floor" value={idrCompact(price.price_floor_low)} sub={`to ${idrCompact(price.price_floor_high)}`} tone="green" testid="metric-pricefloor" />
              {price.client_budget != null && (
                <Metric
                  label="Client budget"
                  value={idrCompact(price.client_budget)}
                  sub={price.price_floor_gap_low > 0 ? `Gap ${idrCompact(price.price_floor_gap_low)} to ${idrCompact(price.price_floor_gap_high)}` : "Above price floor"}
                  tone={price.price_floor_gap_low > 0 ? "danger" : "green"}
                  testid="metric-budget"
                />
              )}
            </>
          ) : (
            <div className="col-span-2 flex items-center rounded-xl border border-dashed border-amber/50 bg-amber-soft/50 p-3.5 text-[13px] text-amber lg:col-span-3" data-testid="price-unavailable">
              Cost Profile is incomplete. Baseline can show hours, but the price floor needs your cost data.
            </div>
          )}
        </div>
        {price && (
          <p className="mt-3 text-[12px] text-ink-faint">
            A safe floor is not the final price. Check the assumptions first.
          </p>
        )}
      </div>

      {/* Calibration trace */}
      {calibrationTrace && (
        <div className="card border-amber/40 p-5" data-testid="calibration-trace">
          <div className="mb-2 flex items-center gap-2">
            <History size={16} className="text-amber" />
            <h4 className="font-bold text-ink">One-project calibration</h4>
            <Badge tone="amber">Low confidence</Badge>
          </div>
          <p className="text-[13px] text-ink-soft">
            Project "{calibrationTrace.project_name}": estimated {calibrationTrace.estimated_hours}h vs actual{" "}
            {calibrationTrace.actual_hours}h produced correction factor{" "}
            <span className="mono font-semibold">x{calibrationTrace.factor}</span>.
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">
            Base range {calibrationTrace.base_low}-{calibrationTrace.base_high}h adjusts to{" "}
            <span className="font-semibold">{calibrationTrace.adjusted_low}-{calibrationTrace.adjusted_high}h</span>.
          </p>
          {calibrationTrace.extreme && (
            <p className="mt-1 text-[12px] font-semibold text-amber">
              Extreme ratio. Treat it as an early signal, not a rule.
            </p>
          )}
          <p className="mt-1 text-[12px] text-ink-faint">{calibrationTrace.note}</p>
        </div>
      )}

      <FormulaDrawer estimate={estimate} price={price} costProfile={costProfile} isDemo={isDemo} onOpen={onFormulaOpen} />
    </div>
  );
}
