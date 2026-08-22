import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Save, Trash2, History, ArrowRight, Check, FileText, Wallet, PieChart, Gauge, Clock, Filter } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { Spinner, Badge, Toast } from "@/components/ui/primitives";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import CostProfileForm, { DEMO_COST_PROFILE } from "@/components/CostProfileForm";
import { READINESS_LABEL } from "@/components/BriefCritique";
import { useAuth } from "@/context/AuthContext";
import { client, apiErrorMessage, track } from "@/lib/api";
import { idr, idrCompact } from "@/lib/format";

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
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [readinessFilter, setReadinessFilter] = useState("");
  const [professionFilter, setProfessionFilter] = useState("");
  const [rateCard, setRateCard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCp, setSavingCp] = useState(false);
  const [savingCal, setSavingCal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
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
      client.get("/projects").catch(() => ({ data: { projects: [], summary: null } })),
    ]).then(([cpr, pr]) => {
      if (cpr.data?.mode) setCp({ ...cpr.data, is_demo: false });
      setProjects(pr.data?.projects || []);
      setSummary(pr.data?.summary || null);
      setLoading(false);
    });
    client.get("/rate-card").then((r) => setRateCard(r.data?.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setHistoryLoading(true);
    const params = {};
    if (readinessFilter) params.readiness_state = readinessFilter;
    if (professionFilter) params.profession = professionFilter;
    client.get("/analyses", { params })
      .then((r) => setHistory(r.data?.analyses || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [readinessFilter, professionFilter]);

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

  const reloadProjects = async () => {
    const { data } = await client.get("/projects");
    setProjects(data?.projects || []);
    setSummary(data?.summary || null);
  };

  const saveCal = async () => {
    setErr(null);
    setSavingCal(true);
    try {
      await client.post("/projects", {
        project_name: cal.project_name,
        estimated_hours: Number(cal.estimated_hours),
        actual_hours: Number(cal.actual_hours),
        expected_revisions: Number(cal.expected_revisions) || 0,
        actual_revisions: Number(cal.actual_revisions) || 0,
        scope_note: cal.scope_note,
        deviation_reason: cal.deviation_reason,
      });
      await reloadProjects();
      setCal(EMPTY_CAL);
      track("project_actual_submitted", {});
      flash("Project saved");
    } catch (e) { setErr(apiErrorMessage(e.response?.data?.detail)); }
    finally { setSavingCal(false); }
  };

  const deleteProject = async (projectId) => {
    setDeletingId(projectId);
    try {
      await client.delete(`/projects/${projectId}`);
      await reloadProjects();
      flash("Project deleted");
    } catch (e) { setErr(apiErrorMessage(e.response?.data?.detail)); }
    finally { setDeletingId(null); }
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
              <p className="mt-1.5 text-[13.5px] text-ink-soft">Save your cost profile and up to 5 historical projects. Guest demo never requires login.</p>
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
              {summary && (
                <span className="sticker absolute -top-3 right-3 rounded-full bg-amber px-2.5 py-1 text-[10px] font-extrabold text-ink" style={{ "--r": "6deg" }}>
                  {summary.confidence} confidence
                </span>
              )}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber"><Gauge size={13} /> Personal calibration</div>
              {summary ? (
                <>
                  <div className="mono mt-1.5 text-[27px] font-extrabold tracking-tight text-ink">&times;{summary.median_factor}</div>
                  <span className="text-[11px] text-ink-faint">{summary.count} project{summary.count === 1 ? "" : "s"} &middot; median &middot; {summary.confidence} confidence</span>
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

          {/* Multi-project Personal Estimation Memory (up to 5, median factor) */}
          <section className="card mt-5 p-5 sm:p-7" data-testid="ws-calibration">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[10px] border border-amber/25 bg-gradient-to-br from-amber/[0.16] to-amber/[0.03]">
                <History size={16} className="text-amber" strokeWidth={1.75} />
              </div>
              <h2 className="font-bold text-ink text-[16.5px] tracking-tight">Personal Estimation Memory</h2>
              {projects.length > 0 && (
                <span className="sticker inline-block" style={{ "--r": "3deg" }}>
                  <Badge tone="amber">{projects.length}/5 project{projects.length === 1 ? "" : "s"} &middot; {summary?.confidence} confidence</Badge>
                </span>
              )}
            </div>
            <p className="mb-4 text-[13px] text-ink-faint">
              {projects.length > 0
                ? "Median correction factor across your past short-form video projects. This is a calibration signal, not a machine-learning model."
                : "Save past projects' estimated vs. actual hours (up to 5) to get a personal calibration signal. Confidence rises to medium at 3."}
            </p>

            {projects.length > 0 && (
              <ul className="mb-4 space-y-2.5" data-testid="ws-project-list">
                {projects.map((p) => {
                  const maxH = Math.max(p.estimated_hours, p.actual_hours) || 1;
                  return (
                    <li key={p.project_id} className="rounded-xl bg-amber-soft/60 p-3.5" data-testid={`ws-project-${p.project_id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[13px] text-ink-soft">
                          <span className="font-semibold text-ink">"{p.project_name}"</span> &middot; estimated{" "}
                          <span className="mono">{p.estimated_hours}h</span> vs actual <span className="mono">{p.actual_hours}h</span>{" "}
                          &middot; factor <span className="mono font-bold text-amber">x{p.factor}</span>
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button disabled={deletingId === p.project_id} className="btn-ghost btn-sm text-danger" data-testid={`ws-project-delete-${p.project_id}`}>
                              {deletingId === p.project_id ? <Spinner size={13} /> : <Trash2 size={13} />}
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{p.project_name}" will be removed from your calibration history. The median factor will be recalculated from the rest.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProject(p.project_id)} className={buttonVariants({ variant: "destructive" })}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      {/* Projected vs realized bars */}
                      <div className="mt-2.5 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-16 shrink-0 text-[10px] font-semibold text-ink-faint">Estimated</span>
                          <div className="h-2 flex-1 rounded-full bg-black/10"><div className="h-2 rounded-full bg-ink-faint" style={{ width: `${(p.estimated_hours / maxH) * 100}%` }} /></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-16 shrink-0 text-[10px] font-semibold text-amber">Realized</span>
                          <div className="h-2 flex-1 rounded-full bg-black/10"><div className="h-2 rounded-full bg-amber" style={{ width: `${(p.actual_hours / maxH) * 100}%` }} /></div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {projects.length >= 5 ? (
              <p className="rounded-xl bg-raised p-3.5 text-[13px] text-ink-faint" data-testid="ws-project-limit">
                Maximum 5 projects reached. Delete one above to add another.
              </p>
            ) : (
              <>
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
                </div>
              </>
            )}
          </section>

          {/* Rich analysis history + filter (P1) */}
          <section className="card mt-5 p-5 sm:p-7" data-testid="ws-history">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[10px] border border-green/20 bg-gradient-to-br from-green/[0.14] to-green/[0.03]">
                  <Clock size={16} className="text-green" strokeWidth={1.75} />
                </div>
                <h2 className="font-bold text-ink text-[16.5px] tracking-tight">Analysis History</h2>
              </div>
              <div className="flex items-center gap-2">
                <Filter size={13} className="text-ink-faint" />
                <select
                  className="rounded-full border border-line/60 bg-raised px-2.5 py-1 text-[12px] font-medium text-ink-soft outline-none focus:border-green"
                  value={readinessFilter}
                  onChange={(e) => setReadinessFilter(e.target.value)}
                  data-testid="history-filter-readiness"
                >
                  <option value="">All readiness</option>
                  <option value="ready_to_estimate">Now we can estimate it</option>
                  <option value="ready_scope_only">Ready for scope baseline</option>
                  <option value="not_ready_to_quote">Not ready to quote</option>
                </select>
                <select
                  className="rounded-full border border-line/60 bg-raised px-2.5 py-1 text-[12px] font-medium text-ink-soft outline-none focus:border-green"
                  value={professionFilter}
                  onChange={(e) => setProfessionFilter(e.target.value)}
                  data-testid="history-filter-profession"
                >
                  <option value="">All types</option>
                  <option value="short_form_video">Short-form video</option>
                  <option value="general">Other / general</option>
                </select>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-6"><Spinner size={20} /></div>
            ) : history.length === 0 ? (
              <p className="text-[13px] text-ink-faint">No analyses match this filter yet.</p>
            ) : (
              <ul className="space-y-2" data-testid="history-list">
                {history.map((h) => (
                  <li key={h.analysis_id}>
                    <Link
                      to={`/analysis/${h.analysis_id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line/15 bg-raised px-3.5 py-2.5 transition-colors hover:border-green/40"
                      data-testid={`history-item-${h.analysis_id}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink">{h.brief_snippet}</p>
                        <p className="mt-0.5 text-[11px] text-ink-faint">
                          {h.created_at ? new Date(h.created_at).toLocaleDateString() : ""} &middot; {READINESS_LABEL[h.readiness_state] || h.readiness_state}
                        </p>
                      </div>
                      {h.price?.price_floor_low != null && (
                        <span className="shrink-0 text-[12px] font-semibold text-green">{idrCompact(h.price.price_floor_low)}+</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Rate card from your own sent agreements only -- never external/scraped
              market data (post-contest, safe subset) */}
          {rateCard.length > 0 && (
            <section className="card mt-5 p-5 sm:p-7" data-testid="ws-rate-card">
              <h2 className="font-bold text-ink text-[16.5px] tracking-tight">Your rate card</h2>
              <p className="mb-4 mt-1 text-[13px] text-ink-faint">
                Price per video from your own sent Agreement Sheets — not an external or scraped market rate.
              </p>
              <ul className="divide-y divide-line/10">
                {rateCard.map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="truncate text-ink-soft">{item.project_title}</span>
                    <span className="shrink-0 font-semibold text-ink">{idr(item.price_per_unit)} <span className="font-normal text-ink-faint">/ video</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </motion.div>
      </div>
      <Toast show={!!toast}>{toast}</Toast>
    </Shell>
  );
}
