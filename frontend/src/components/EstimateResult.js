import React from "react";
import { motion } from "framer-motion";
import { History } from "lucide-react";
import { idrJuta, idr, hoursRange } from "@/lib/format";
import { Badge, DemoTag } from "@/components/ui/primitives";
import FormulaDrawer from "@/components/FormulaDrawer";

const CONF = {
  low: { tone: "amber", label: "Confidence rendah" },
  medium: { tone: "amber", label: "Confidence sedang" },
  high: { tone: "green", label: "Confidence tinggi" },
};

function Metric({ label, value, sub, tone, testid }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-3.5" data-testid={testid}>
      <div className="text-[12px] font-medium text-ink-faint">{label}</div>
      <div
        className={`mt-1 text-[19px] font-extrabold leading-tight tracking-tight ${
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
              className="h-full rounded-full bg-green"
              initial={{ width: 0 }}
              animate={{ width: `${completeness.percent}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="mono text-sm font-bold text-ink" data-testid="completeness-pct">{completeness.percent}%</span>
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          {completeness.resolved} dari {completeness.total} required field selesai. {confidence?.reason}
        </p>
      </div>

      {/* Numbers */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-bold text-ink">Estimasi transparan</h4>
          {isDemo && <DemoTag />}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Estimasi jam" value={hoursRange(estimate.low, estimate.high)} testid="metric-hours" />
          {price ? (
            <>
              <Metric label="Break-even" value={idrJuta(price.break_even_low).replace("Rp", "Rp")} sub={`s/d ${idrJuta(price.break_even_high)}`} testid="metric-breakeven" />
              <Metric label="Price floor" value={idrJuta(price.price_floor_low)} sub={`s/d ${idrJuta(price.price_floor_high)}`} tone="green" testid="metric-pricefloor" />
              {price.client_budget != null && (
                <Metric
                  label="Budget klien"
                  value={idrJuta(price.client_budget)}
                  sub={price.price_floor_gap_low > 0 ? `Gap ${idrJuta(price.price_floor_gap_low)}–${idrJuta(price.price_floor_gap_high)}` : "Di atas price floor"}
                  tone={price.price_floor_gap_low > 0 ? "danger" : "green"}
                  testid="metric-budget"
                />
              )}
            </>
          ) : (
            <div className="col-span-2 flex items-center rounded-xl border border-dashed border-amber/50 bg-amber-soft/50 p-3.5 text-[13px] text-amber lg:col-span-3" data-testid="price-unavailable">
              Cost Profile belum lengkap. Kami tampilkan rentang jam, tapi belum menghitung price floor — lengkapi profil biaya dulu supaya harga jujur.
            </div>
          )}
        </div>
        {price && (
          <p className="mt-3 text-[12px] text-ink-faint">
            Harga aman belum berarti harga pasti. Cek asumsi dulu.
          </p>
        )}
      </div>

      {/* Calibration trace */}
      {calibrationTrace && (
        <div className="card border-amber/40 p-5" data-testid="calibration-trace">
          <div className="mb-2 flex items-center gap-2">
            <History size={16} className="text-amber" />
            <h4 className="font-bold text-ink">Kalibrasi satu proyek</h4>
            <Badge tone="amber">Confidence rendah</Badge>
          </div>
          <p className="text-[13px] text-ink-soft">
            Proyek “{calibrationTrace.project_name}”: estimasi {calibrationTrace.estimated_hours} jam vs aktual{" "}
            {calibrationTrace.actual_hours} jam → faktor koreksi{" "}
            <span className="mono font-semibold">×{calibrationTrace.factor}</span>.
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">
            Rentang dasar {calibrationTrace.base_low}–{calibrationTrace.base_high} jam disesuaikan menjadi{" "}
            <span className="font-semibold">{calibrationTrace.adjusted_low}–{calibrationTrace.adjusted_high} jam</span>.
          </p>
          {calibrationTrace.extreme && (
            <p className="mt-1 text-[12px] font-semibold text-amber">
              Rasio ekstrem — perlakukan sebagai sinyal awal, bukan patokan.
            </p>
          )}
          <p className="mt-1 text-[12px] text-ink-faint">{calibrationTrace.note}</p>
        </div>
      )}

      <FormulaDrawer estimate={estimate} price={price} costProfile={costProfile} isDemo={isDemo} onOpen={onFormulaOpen} />
    </div>
  );
}
