import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Trash2, History, ArrowRight, Check } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { Spinner, Badge, Toast } from "@/components/ui/primitives";
import CostProfileForm, { DEMO_COST_PROFILE } from "@/components/CostProfileForm";
import { useAuth } from "@/context/AuthContext";
import { client, apiErrorMessage, track } from "@/lib/api";

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

  if (loading) return <Shell><div className="wrap flex min-h-[60vh] items-center justify-center"><Spinner size={26} /></div></Shell>;

  return (
    <Shell>
      <SEO
        title="Freelancer Workspace — Cost Profile & Calibration"
        description="Manage your freelancer baseline cost profile, project calibrations, and rate safeguards."
        canonical="/app"
        noIndex={true}
      />
      <div className="wrap-narrow py-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-ink">Hi, {user?.name || "freelancer"}</h1>
          <Badge tone="green">Signed in</Badge>
        </div>
        <p className="mt-1 text-ink-soft">Save your cost profile and one historical project. Guest demo never requires login.</p>

        <Link to="/analyze" className="btn-primary btn-md mt-4" data-testid="ws-analyze">Analyze a brief <ArrowRight size={16} /></Link>

        {/* Cost profile */}
        <section className="card mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink">Cost Profile</h2>
            <button onClick={saveCp} disabled={savingCp} className="btn-secondary btn-sm" data-testid="ws-save-cp">
              {savingCp ? <Spinner size={14} /> : cpSaved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
            </button>
          </div>
          <CostProfileForm value={cp} onChange={setCp} showDemoTag={false} />
        </section>

        {/* One-project calibration */}
        <section className="card mt-5 p-5" data-testid="ws-calibration">
          <div className="mb-2 flex items-center gap-2">
            <History size={17} className="text-amber" />
            <h2 className="font-bold text-ink">Personal Estimation Memory</h2>
            {savedCal && <Badge tone="amber">1 project, low confidence</Badge>}
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
      </div>
      <Toast show={!!toast}>{toast}</Toast>
    </Shell>
  );
}
