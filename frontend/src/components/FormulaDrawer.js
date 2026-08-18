import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Sigma } from "lucide-react";
import { idr, hoursRange } from "@/lib/format";
import { DemoTag } from "@/components/ui/primitives";

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{label}</span>
      <span className={`mono text-right ${strong ? "font-semibold text-ink" : "text-ink-soft"}`}>{value}</span>
    </div>
  );
}

export default function FormulaDrawer({ estimate, price, costProfile, isDemo, onOpen }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  if (!price) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && onOpen) onOpen();
  };

  return (
    <div className="card overflow-hidden" data-testid="formula-drawer">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-raised"
        aria-expanded={open}
        data-testid="formula-toggle"
      >
        <span className="flex items-center gap-2 font-semibold text-ink">
          <Sigma size={16} className="text-green" />
          Formula &amp; assumptions
          {isDemo && <DemoTag />}
        </span>
        <ChevronDown size={18} className={`text-ink-faint transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { height: "auto", opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-t border-line px-5 py-4">
              {costProfile && (
                <section className="mb-4">
                  <h5 className="mb-1 text-xs font-bold text-green">Productive cost per hour</h5>
                  <p className="mb-2 text-xs text-ink-faint">
                    (Target take-home + overhead + reserve) / (working hours x billable utilization)
                  </p>
                  <Row label="Cost per hour" value={idr(costProfile.cost_per_hour) + " / h"} strong />
                </section>
              )}

              <section className="mb-4">
                <h5 className="mb-1 text-xs font-bold text-green">Hour breakdown</h5>
                {estimate.breakdown?.map((b, i) => (
                  <Row key={i} label={b.label} value={`${b.low}-${b.high}h`} />
                ))}
                <div className="mt-1 border-t border-line pt-1">
                  <Row label="Total hours" value={hoursRange(estimate.low, estimate.high)} strong />
                </div>
              </section>

              <section>
                <h5 className="mb-1 text-xs font-bold text-green">From hours to price floor</h5>
                <Row label="Labor cost" value={`${idr(price.labor_cost_low)} to ${idr(price.labor_cost_high)}`} />
                {price.buffers?.map((b, i) => (
                  <Row key={i} label={b.label} value={idr(b.amount)} />
                ))}
                <Row label="Direct costs" value={idr(price.direct_costs)} />
                <Row label="Break-even" value={`${idr(price.break_even_low)} to ${idr(price.break_even_high)}`} strong />
                <Row label={`Target margin (${Math.round(price.target_margin * 100)}%)`} value={`/ (1 - ${price.target_margin})`} />
                <Row label="Price floor" value={`${idr(price.price_floor_low)} to ${idr(price.price_floor_high)}`} strong />
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
