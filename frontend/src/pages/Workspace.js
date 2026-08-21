import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Save, Trash2, History, ArrowRight, Check, FileText, Wallet, PieChart, Gauge } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { Spinner, Badge, Toast } from "@/components/ui/primitives";
import CostProfileForm, { DEMO_COST_PROFILE } from "@/components/CostProfileForm";
import { useAuth } from "@/context/AuthContext";
import { client, apiErrorMessage, track } from "@/lib/api";
import { idr } from "@/lib/format";

const THEME_KEY = "baseline-landing-theme";

function computeCostPerHour(cp) {
  if (cp.mode === "simple") return cp.cost_per_hour || null;
  const rbh = (cp.total_working_hours || 0) * (cp.billable_utilization || 0);
  if (rbh <= 0) return null;
  const total = (cp.target_take_home || 0) + (cp.monthly_overhead || 0) + (cp.monthly_reserve || 0);
  return Math.round(total / rbh);
}

const EMPTY_CAL = {
  project_name: "",
  estimated_hours: "",
  actual_hours: "",
  expected_revisions: 1,
  actual_revisions: 1,
  scope_note: "",
  deviation_reason: "",
};

export default function Workspace() {
  const { user } = useAuth();
  const [cp, setCp] = useState({ ...DEMO_COST_PROFILE });
  const [cpSaved, setCpSaved] = useState(false);
  const [cal, setCal] = useState(EMPTY_CAL);
  const [savedCal, setSavedCal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingCp, setSavingCp] = useState(false);
  const [savingCal, setSavingCal] = useState(false);
  const [deletingCal, setDeletingCal] = useState(false);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState(null);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) !== "light";
    } catch {
      return true;
    }
  });
  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch { /* ignore storage failures */ }
      return next;
    });
  };

  useEffect(() => {
    Promise.all([
      client.get("/cost-profile").catch(() => ({ data: {} })),
      client.get("/calibration").catch(() => ({ data: {} })),
    ]).then(([cpr, calr]) => {
      if (cpr.data?.mode) setCp({ ...cpr.data, is_demo: false });
      if (calr.data?.project_name) { setSavedCal(calr.data); setCal({ ...EMPTY_CAL, ...calr.data }); }
      setLoading(false);
    });
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2000); };

  const saveCp = async () => {
    setSavingCp(true);
    try {
      await client.post("/cost-profile", { ...cp, save: true });
      setCpSaved(true);
      flash("Cost profile saved");
      setTimeout(() => setCpSaved(false), 1800);
    } catch (e) { setErr(apiErrorMessage(e.response?.data?.detail)); }
    finally { setSavingCp(false); }
  };

  const saveCal = async () => {
    setErr(null);
    setSavingCal(true);
    try {
      const { data } = await client.post("/calibration", {
        project_name: cal.project_name,
        estimated_hours: Number(cal.estimated_hours),
        actual_hours: Number(cal.actual_hours),
        expected_revisions: Number(cal.expected_revisions) || 0,
        actual_revisions: Number(cal.actual_revisions) || 0,
        scope_note: cal.scope_note,
        deviation_reason: cal.deviation_reason,
      });
      setSavedCal(data);
      track("project_actual_submitted", {});
      flash("Calibration saved");
    } catch (e) { setErr(apiErrorMessage(e.response?.data?.detail)); }
    finally { setSavingCal(false); }
  };

  const deleteCal = async () => {
    setDeletingCal(true);
    try {
      await client.delete("/calibration");
      setSavedCal(null);
      setCal(EMPTY_CAL);
      flash("Calibration deleted");
    } catch (e) { setErr(apiErrorMessage(e.response?.data?.detail)); }
    finally { setDeletingCal(false); }
  };

  if (loading) return <Shell dark={dark} onToggleDark={toggleDark}><div className="wrap flex min-h-[60vh] items-center justify-center"><Spinner size={26} /></div></Shell>;

  const cph = computeCostPerHour(cp);
  const marginPct = Math.round((cp.target_margin || 0) * 100);
  const DONUT_R = 19;
  const DONUT_C = 2 * Math.PI * DONUT_R;
  const donutOffset = DONUT_C * (1 - Math.min(Math.max(marginPct, 0), 100) / 100);

  return (
    <Shell dark={dark} onToggleDark={toggleDark}>
      <SEO
        title="Freelancer Workspace — Cost Profile & Calibration"
        description="Manage your freelancer baseline cost profile, project calibrations, and rate safeguards."
        canonical="/app"
        noIndex={true}
      />
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg width="560" height="560" viewBox="-100 -100 200 200" className="absolute -right-44 -top-24 -rotate-[20deg] blur-[5px] opacity-[0.08]">
            <path fill="#10b981" d="M45.3,-58.5C58.4,-49.7,68.2,-35.6,71.9,-19.9C75.6,-4.2,73.2,13,65.6,27.3C58,41.6,45.2,52.9,30.6,60.6C16,68.3,-0.4,72.4,-16.6,69.8C-32.8,67.2,-48.8,57.9,-59.6,44.5C-70.4,31.1,-76,13.6,-74.9,-3.4C-73.8,-20.4,-66,-36.9,-53.7,-46.6C-41.4,-56.3,-24.6,-59.2,-8.4,-60.9C7.8,-62.6,32.2,-67.3,45.3,-58.5Z" />
          </svg>
        </div>
        <motion.div
          className="relative mx-auto w-full max-w-[1020px] px-5 py-8 sm:px-6 lg:px-10"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-ink sm:text-[29px]">Hi, {user?.name || "freelancer"}</h1>
                <Badge tone="green">Signed in</Badge>
              </div>
              <p className="mt-1.5 text-[13.5px] text-ink-soft">Save your cost profile and one historical project. Guest demo never requires login.</p>
            </div>
            <Link to="/analyze" className="btn-primary btn-md flex-shrink-0" data-testid="ws-analyze">Analyze a brief <ArrowRight size={16} /></Link>
          </div>

          {/* Stat summary row */}
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card rounded-[18px] p-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><Wallet size={13} /> Productive cost / hour</div>
              <div className="mono mt-1.5 text-[27px] font-extrabold tracking-tight text-green">{cph ? idr(cph) : "—"}</div>
              <span className="text-[11px] text-ink-faint">From take-home, overhead &amp; reserve</span>
            </div>
            <div className="card rounded-[18px] p-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><PieChart size={13} /> Target margin</div>
              <div className="mt-2 flex items-center gap-3">
                <svg width="46" height="46" viewBox="0 0 46 46">
                  <circle cx="23" cy="23" r={DONUT_R} fill="none" stroke="currentColor" className="text-line" strokeWidth="5" />
                  <circle cx="23" cy="23" r={DONUT_R} fill="none" stroke="currentColor" className="text-green" strokeWidth="5" strokeLinecap="round" strokeDasharray={DONUT_C} strokeDashoffset={donutOffset} transform="rotate(-90 23 23)" />
                </svg>
                <div className="mono text-[27px] font-extrabold text-ink">{marginPct}%</div>
              </div>
            </div>
            <div className="relative card rounded-[18px] border-amber/25 bg-gradient-to-br from-amber/[0.14] to-amber/[0.04] p-5">
              {savedCal && (
                <span className="sticker absolute -top-3 right-3 rounded-full bg-amber px-2.5 py-1 text-[10px] font-extrabold text-ink" style={{ "--r": "6deg" }}>
                  {savedCal.confidence} confidence
                </span>
              )}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber"><Gauge size={13} /> Personal calibration</div>
              {savedCal ? (
                <>
                  <div className="mono mt-1.5 text-[27px] font-extrabold tracking-tight text-ink">&times;{savedCal.factor}</div>
                  <span className="text-[11px] text-ink-faint">{savedCal.count} project{savedCal.count === 1 ? "" : "s"} &middot; {savedCal.confidence} confidence</span>
                </>
              ) : (
                <>
                  <div className="mono mt-1.5 text-[27px] font-extrabold tracking-tight text-ink-faint">&times;1.00</div>
                  <span className="text-[11px] text-ink-faint">No calibration yet — save one below</span>
                </>
              )}
            </div>
          </div>

          {/* Cost profile */}
          <section className="card mt-6 p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[10px] border border-green/20 bg-gradient-to-br from-green/[0.14] to-green/[0.03]">
                  <FileText size={16} className="text-green" strokeWidth={1.75} />
                </div>
                <h2 className="font-bold text-ink text-[16.5px] tracking-tight">Cost Profile</h2>
              </div>
              <button onClick={saveCp} disabled={savingCp} className="btn-secondary btn-sm" data-testid="ws-save-cp">
                {savingCp ? <Spinner size={14} /> : cpSaved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
              </button>
            </div>
            <CostProfileForm value={cp} onChange={setCp} showDemoTag={false} />
          </section>

          {/* One-project calibration */}
          <section className="card mt-5 p-5 sm:p-7" data-testid="ws-calibration">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[10px] border border-amber/25 bg-gradient-to-br from-amber/[0.16] to-amber/[0.03]">
                <History size={16} className="text-amber" strokeWidth={1.75} />
              </div>
              <h2 className="font-bold text-ink text-[16.5px] tracking-tight">Personal Estimation Memory</h2>
              {savedCal && <span className="sticker inline-block" style={{ "--r": "3deg" }}><Badge tone="amber">1 project, low confidence</Badge></span>}
            </div>
          <p className="mb-4 text-[13px] text-ink-faint">
            {savedCal
              ? "One past short-form video project. This is a calibration signal, not a machine-learning model."
              : "Save one past project's estimated vs. actual hours to get a personal calibration signal."}
          </p>

          {savedCal && (
            <div className="mb-4 rounded-xl bg-amber-soft/60 p-3.5" data-testid="ws-cal-trace">
              <p className="text-[13px] text-ink-soft">
                "{savedCal.project_name}": estimated <span className="mono">{savedCal.estimated_hours}h</span> vs actual{" "}
                <span className="mono">{savedCal.actual_hours}h</span> produced a factor{" "}
                <span className="mono font-bold text-amber">x{savedCal.factor}</span>
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="field-label">Project name</span>
              <input name="cal-project-name" className="input" value={cal.project_name} onChange={(e) => setCal({ ...cal, project_name: e.target.value })} data-testid="cal-name" /></label>
            <label className="block"><span className="field-label">Estimated hours</span>
              <input type="number" name="cal-estimated-hours" className="input" value={cal.estimated_hours} onChange={(e) => setCal({ ...cal, estimated_hours: e.target.value })} data-testid="cal-est" /></label>
            <label className="block"><span className="field-label">Actual hours</span>
              <input type="number" name="cal-actual-hours" className="input" value={cal.actual_hours} onChange={(e) => setCal({ ...cal, actual_hours: e.target.value })} data-testid="cal-actual" /></label>
            <label className="block"><span className="field-label">Expected revisions</span>
              <input type="number" name="cal-expected-revisions" className="input" value={cal.expected_revisions} onChange={(e) => setCal({ ...cal, expected_revisions: e.target.value })} data-testid="cal-exp-rev" /></label>
            <label className="block"><span className="field-label">Actual revisions</span>
              <input type="number" name="cal-actual-revisions" className="input" value={cal.actual_revisions} onChange={(e) => setCal({ ...cal, actual_revisions: e.target.value })} data-testid="cal-act-rev" /></label>
            <label className="block sm:col-span-2"><span className="field-label">Deviation reason (optional)</span>
              <input name="cal-deviation-reason" className="input" value={cal.deviation_reason} onChange={(e) => setCal({ ...cal, deviation_reason: e.target.value })} placeholder="e.g. weak footage + 3 stakeholders" data-testid="cal-reason" /></label>
          </div>
          {err && <p className="mt-3 text-[13px] font-semibold text-danger" data-testid="ws-error" aria-live="polite">{err}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={saveCal} disabled={savingCal} className="btn-primary btn-md" data-testid="cal-save">
              {savingCal ? <><Spinner size={16} /> Saving...</> : <><Save size={16} /> Save project</>}
            </button>
            {savedCal && (
              <button onClick={deleteCal} disabled={deletingCal} className="btn-ghost btn-md" data-testid="cal-delete">
                {deletingCal ? <Spinner size={16} /> : <><Trash2 size={16} /> Delete</>}
              </button>
            )}
          </div>
          </section>
        </motion.div>
      </div>
      <Toast show={!!toast}>{toast}</Toast>
    </Shell>
  );
}
