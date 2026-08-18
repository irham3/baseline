import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Trash2, History, ArrowRight, Check } from "lucide-react";
import { Shell } from "@/components/Shell";
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
    try {
      await client.post("/cost-profile", { ...cp, save: true });
      setCpSaved(true);
      flash("Cost profile tersimpan");
      setTimeout(() => setCpSaved(false), 1800);
    } catch (e) { setErr(apiErrorMessage(e.response?.data?.detail)); }
  };

  const saveCal = async () => {
    setErr(null);
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
      flash("Kalibrasi tersimpan");
    } catch (e) { setErr(apiErrorMessage(e.response?.data?.detail)); }
  };

  const deleteCal = async () => {
    await client.delete("/calibration");
    setSavedCal(null);
    setCal(EMPTY_CAL);
    flash("Kalibrasi dihapus");
  };

  if (loading) return <Shell><div className="wrap flex min-h-[60vh] items-center justify-center"><Spinner size={26} /></div></Shell>;

  return (
    <Shell>
      <div className="wrap-narrow py-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Halo, {user?.name || "freelancer"}</h1>
          <Badge tone="green">Signed in</Badge>
        </div>
        <p className="mt-1 text-ink-soft">Simpan cost profile & satu proyek historis. Guest demo tidak pernah butuh login.</p>

        <Link to="/analyze" className="btn-primary btn-md mt-4" data-testid="ws-analyze">Analyze a brief <ArrowRight size={16} /></Link>

        {/* Cost profile */}
        <section className="card mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink">Cost Profile</h2>
            <button onClick={saveCp} className="btn-secondary btn-sm" data-testid="ws-save-cp">
              {cpSaved ? <><Check size={14} /> Tersimpan</> : <><Save size={14} /> Simpan</>}
            </button>
          </div>
          <CostProfileForm value={cp} onChange={setCp} showDemoTag={false} />
        </section>

        {/* One-project calibration */}
        <section className="card mt-5 p-5" data-testid="ws-calibration">
          <div className="mb-2 flex items-center gap-2">
            <History size={17} className="text-amber" />
            <h2 className="font-bold text-ink">Personal Estimation Memory</h2>
            <Badge tone="amber">1 proyek · confidence rendah</Badge>
          </div>
          <p className="mb-4 text-[13px] text-ink-faint">Satu proyek short-form video lama. Ini sinyal kalibrasi, bukan model machine learning.</p>

          {savedCal && (
            <div className="mb-4 rounded-xl bg-amber-soft/60 p-3.5" data-testid="ws-cal-trace">
              <p className="text-[13px] text-ink-soft">
                “{savedCal.project_name}”: estimasi <span className="mono">{savedCal.estimated_hours}j</span> vs aktual{" "}
                <span className="mono">{savedCal.actual_hours}j</span> → faktor{" "}
                <span className="mono font-bold text-amber">×{savedCal.factor}</span>
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="field-label">Nama proyek</span>
              <input className="input" value={cal.project_name} onChange={(e) => setCal({ ...cal, project_name: e.target.value })} data-testid="cal-name" /></label>
            <label className="block"><span className="field-label">Estimasi jam</span>
              <input type="number" className="input" value={cal.estimated_hours} onChange={(e) => setCal({ ...cal, estimated_hours: e.target.value })} data-testid="cal-est" /></label>
            <label className="block"><span className="field-label">Jam aktual</span>
              <input type="number" className="input" value={cal.actual_hours} onChange={(e) => setCal({ ...cal, actual_hours: e.target.value })} data-testid="cal-actual" /></label>
            <label className="block"><span className="field-label">Estimasi revisi</span>
              <input type="number" className="input" value={cal.expected_revisions} onChange={(e) => setCal({ ...cal, expected_revisions: e.target.value })} data-testid="cal-exp-rev" /></label>
            <label className="block"><span className="field-label">Revisi aktual</span>
              <input type="number" className="input" value={cal.actual_revisions} onChange={(e) => setCal({ ...cal, actual_revisions: e.target.value })} data-testid="cal-act-rev" /></label>
            <label className="block sm:col-span-2"><span className="field-label">Penyebab deviasi (opsional)</span>
              <input className="input" value={cal.deviation_reason} onChange={(e) => setCal({ ...cal, deviation_reason: e.target.value })} placeholder="mis. footage buruk + 3 stakeholder" data-testid="cal-reason" /></label>
          </div>
          {err && <p className="mt-3 text-[13px] font-semibold text-danger" data-testid="ws-error">{err}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={saveCal} className="btn-primary btn-md" data-testid="cal-save"><Save size={16} /> Simpan proyek</button>
            {savedCal && <button onClick={deleteCal} className="btn-ghost btn-md" data-testid="cal-delete"><Trash2 size={16} /> Hapus</button>}
          </div>
        </section>
      </div>
      <Toast show={!!toast}>{toast}</Toast>
    </Shell>
  );
}
