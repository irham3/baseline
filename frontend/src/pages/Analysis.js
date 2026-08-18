import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { TriangleAlert, Link2, ExternalLink, Copy, Check, ArrowLeft } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Spinner, Badge, Toast } from "@/components/ui/primitives";
import BriefMap from "@/components/BriefMap";
import ClarificationGate from "@/components/ClarificationGate";
import EstimateResult from "@/components/EstimateResult";
import RiskTriggers from "@/components/RiskTriggers";
import DealOptions from "@/components/DealOptions";
import WhatsAppPreview, { useClipboard } from "@/components/WhatsAppPreview";
import CostProfileForm, { DEMO_COST_PROFILE } from "@/components/CostProfileForm";
import { useAuth } from "@/context/AuthContext";
import { client, apiErrorMessage, track } from "@/lib/api";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function overridesFromFields(fields) {
  const get = (name) => fields.find((f) => f.name === name);
  const rev = get("revision_rounds");
  let revision_rounds = null;
  if (rev && typeof rev.value === "number") revision_rounds = rev.value;
  return {
    quantity: toNum(get("quantity")?.value) ?? 1,
    client_budget: toNum(get("client_budget")?.value),
    final_duration: toNum(get("final_duration")?.value),
    deadline_working_days: null,
    approver_count: toNum(get("approver_count")?.value) ?? 1,
    revision_rounds,
    footage_hours: null,
    footage_preselected: false,
    footage_available: !!get("footage_available")?.value || get("footage_available")?.status === "stated",
    subtitles: true,
    scripting: false,
    motion_level: "basic",
    rush: false,
  };
}

export default function Analysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state: copyState, copy } = useClipboard();

  const [analysis, setAnalysis] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [overrides, setOverrides] = useState(null);
  const [costProfile, setCostProfile] = useState(() => {
    try {
      const s = localStorage.getItem("baseline_cost_profile");
      return s ? JSON.parse(s) : { ...DEMO_COST_PROFILE };
    } catch (_) {
      return { ...DEMO_COST_PROFILE };
    }
  });
  const [result, setResult] = useState(null);
  const [recalc, setRecalc] = useState(false);
  const [selected, setSelected] = useState(null);
  const [declineMode, setDeclineMode] = useState(false);
  const [hasCalibration, setHasCalibration] = useState(false);
  const [applyCalibration, setApplyCalibration] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [agreement, setAgreement] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    client
      .get(`/analysis/${id}`)
      .then((r) => {
        setAnalysis(r.data);
        setOverrides(overridesFromFields(r.data.fields || []));
        if (r.data.scope_used) {
          // already estimated previously
        }
      })
      .catch((e) => setLoadErr(apiErrorMessage(e.response?.data?.detail) || "Gagal memuat analisis."));
  }, [id]);

  useEffect(() => {
    if (user) {
      client.get("/calibration").then((r) => setHasCalibration(!!r.data?.project_name)).catch(() => {});
    }
  }, [user]);

  const runEstimate = useCallback(async () => {
    setRecalc(true);
    try {
      localStorage.setItem("baseline_cost_profile", JSON.stringify(costProfile));
      const { data } = await client.post(`/analysis/${id}/estimate`, {
        cost_profile: costProfile,
        scope_overrides: overrides,
        apply_calibration: applyCalibration,
      });
      setResult(data);
      track("estimate_viewed", { analysis_id: id });
      if (!selected && data.options?.length) setSelected(null);
    } catch (e) {
      setToast(apiErrorMessage(e.response?.data?.detail) || "Perhitungan gagal.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setRecalc(false);
    }
  }, [id, costProfile, overrides, applyCalibration, selected]);

  const selectOption = (opt) => {
    setDeclineMode(false);
    setSelected(opt.id);
    track("option_selected", { analysis_id: id, option: opt.id });
  };

  const createAgreement = async () => {
    const opt = result.options.find((o) => o.id === selected);
    if (!opt) return;
    setCreating(true);
    try {
      const { data } = await client.post(`/analysis/${id}/agreement`, {
        option: opt,
        project_title: projectTitle || "Penawaran video — Baseline",
      });
      setAgreement(data);
      track("agreement_created", { analysis_id: id, option: selected });
    } catch (e) {
      setToast(apiErrorMessage(e.response?.data?.detail) || "Gagal membuat Lembar Sepakat.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setCreating(false);
    }
  };

  const agreementUrl = agreement ? `${window.location.origin}/s/${agreement.token}` : "";
  const selectedOption = result?.options?.find((o) => o.id === selected);

  if (loadErr) {
    return (
      <Shell>
        <div className="wrap-narrow py-16 text-center">
          <TriangleAlert className="mx-auto text-amber" size={30} />
          <p className="mt-3 font-semibold text-ink">{loadErr}</p>
          <Link to="/analyze" className="btn-primary btn-md mt-4">Kembali ke Analyze</Link>
        </div>
      </Shell>
    );
  }

  if (!analysis || !overrides) {
    return (
      <Shell>
        <div className="wrap flex min-h-[60vh] items-center justify-center"><Spinner size={26} /></div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="wrap py-8">
        <button onClick={() => navigate("/analyze")} className="btn-ghost btn-sm mb-3" data-testid="analysis-back">
          <ArrowLeft size={14} /> Analyze lain
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Brief Map</h1>
          {analysis.is_demo && <Badge tone="amber">Demo</Badge>}
        </div>

        {/* Redacted brief */}
        <div className="card mt-4 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Brief (input kamu)</div>
          <p className="text-[14px] leading-relaxed text-ink-soft">“{analysis.brief}”</p>
          {analysis.redaction?.total > 0 && (
            <p className="mt-1 text-[12px] text-green-strong">{analysis.redaction.total} data sensitif telah diredaksi.</p>
          )}
        </div>

        {/* Brief map */}
        <div className="mt-5"><BriefMap fields={analysis.fields} /></div>

        {/* Two-column: clarification + result */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="mb-3 font-bold text-ink">Cost Profile</h3>
              <CostProfileForm value={costProfile} onChange={(cp) => setCostProfile(cp)} />
            </div>

            {user && hasCalibration && (
              <label className="card flex items-center justify-between p-4" data-testid="apply-calibration">
                <span className="text-sm font-medium text-ink">Terapkan kalibrasi 1 proyek</span>
                <input type="checkbox" checked={applyCalibration} onChange={(e) => setApplyCalibration(e.target.checked)} className="h-5 w-5 accent-[var(--green)]" />
              </label>
            )}

            <ClarificationGate
              overrides={overrides}
              setOverrides={setOverrides}
              questions={analysis.clarifications}
              onRecalc={runEstimate}
              recalculating={recalc}
            />
          </div>

          <div className="space-y-4">
            {!result ? (
              <div className="card flex min-h-[240px] flex-col items-center justify-center p-8 text-center" data-testid="estimate-empty">
                <p className="text-ink-soft">Isi jawaban di kiri lalu tekan <span className="font-semibold text-ink">Hitung estimasi</span> untuk melihat rentang jam & price floor.</p>
              </div>
            ) : (
              <>
                <EstimateResult
                  estimate={result.estimate}
                  price={result.price}
                  completeness={result.scope_completeness}
                  confidence={result.confidence}
                  calibrationTrace={result.calibration_trace}
                  costProfile={result.price ? { cost_per_hour: costProfile.cost_per_hour || (result.price && result.price.cost_per_hour) } : null}
                  isDemo={costProfile.is_demo}
                  onFormulaOpen={() => track("formula_opened", { analysis_id: id })}
                />
                <RiskTriggers risk={result.risk} />
              </>
            )}
          </div>
        </div>

        {/* Options + WhatsApp */}
        {result?.options && (
          <div className="mt-8">
            <h2 className="text-xl font-extrabold tracking-tight text-ink">Three deal options</h2>
            <p className="mt-1 text-ink-soft">Semua angka dari engine. Kamu bisa edit setiap pesan sebelum kirim.</p>
            <div className="mt-4">
              <DealOptions
                options={result.options}
                selectedId={declineMode ? null : selected}
                onSelect={selectOption}
                onDecline={() => { setDeclineMode(true); setSelected(null); }}
                declineActive={declineMode}
              />
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <WhatsAppPreview
                drafts={result.whatsapp}
                declineMode={declineMode}
                declineMessage={result.decline_message}
                onCopy={() => track("whatsapp_copied", { analysis_id: id, decline: declineMode })}
              />

              {/* Lembar Sepakat creation */}
              {!declineMode && (
                <div className="card p-5" data-testid="create-agreement-panel">
                  <h4 className="flex items-center gap-2 font-bold text-ink"><Link2 size={16} className="text-green" /> Lembar Sepakat</h4>
                  {!selectedOption ? (
                    <p className="mt-2 text-[13px] text-ink-faint">Pilih salah satu opsi di atas untuk membuat snapshot yang bisa dibagikan ke klien.</p>
                  ) : agreement ? (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl bg-green-soft/60 p-3">
                        <p className="text-[13px] font-semibold text-green-strong">Link publik dibuat. Tanpa login klien.</p>
                        <p className="mono mt-1 break-all text-[12px] text-ink-soft">{agreementUrl}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => { copy(agreementUrl); setToast("Link tersalin"); setTimeout(() => setToast(""), 1800); }} className="btn-secondary btn-sm" data-testid="copy-agreement-link">
                          {copyState === "ok" ? <><Check size={14} /> Tersalin</> : <><Copy size={14} /> Salin link</>}
                        </button>
                        <a href={`/s/${agreement.token}`} target="_blank" rel="noreferrer" className="btn-primary btn-sm" data-testid="open-agreement">
                          Buka <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-[13px] text-ink-soft">Snapshot dari <span className="font-semibold">Opsi {selected}</span> — {selectedOption.title}. Data internal (biaya/margin) tidak ikut dibagikan.</p>
                      <input
                        className="input"
                        placeholder="Judul project (mis. Campaign Reels Brand X)"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        data-testid="agreement-title"
                      />
                      <button onClick={createAgreement} disabled={creating} className="btn-primary btn-md w-full" data-testid="create-agreement">
                        {creating ? <><Spinner size={16} /> Membuat…</> : <>Buat Lembar Sepakat</>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Toast show={!!toast}>{toast}</Toast>
    </Shell>
  );
}
