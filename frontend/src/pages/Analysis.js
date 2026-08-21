import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { TriangleAlert, Link2, ExternalLink, Copy, Check, ArrowLeft, Ban, Search } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
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
import { idr } from "@/lib/format";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function overridesFromFields(fields) {
  const get = (name) => fields.find((f) => f.name === name);
  const rev = get("revision_rounds");
  const preselected = get("footage_preselected");
  const scripting = get("scripting");
  const rush = get("rush");
  let revision_rounds = null;
  if (rev && typeof rev.value === "number") revision_rounds = rev.value;
  return {
    quantity: toNum(get("quantity")?.value) ?? 1,
    client_budget: toNum(get("client_budget")?.value),
    final_duration: toNum(get("final_duration")?.value),
    deadline_working_days: toNum(get("deadline_working_days")?.value),
    approver_count: toNum(get("approver_count")?.value) ?? 1,
    revision_rounds,
    footage_hours: toNum(get("footage_hours")?.value),
    footage_preselected: typeof preselected?.value === "boolean" ? preselected.value : false,
    footage_available: !!get("footage_available")?.value || get("footage_available")?.status === "stated",
    subtitles: true,
    scripting: typeof scripting?.value === "boolean" ? scripting.value : false,
    motion_level: get("motion_level")?.value || "basic",
    rush: typeof rush?.value === "boolean" ? rush.value : false,
  };
}

export default function Analysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state: copyState, copy } = useClipboard();
  const { state: scopeCopyState, copy: copyScopeReply } = useClipboard();

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
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [polishedDrafts, setPolishedDrafts] = useState(null);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState(null);
  const [scopeCheckText, setScopeCheckText] = useState("");
  const [scopeChecking, setScopeChecking] = useState(false);
  const [scopeCheckResult, setScopeCheckResult] = useState(null);
  const [scopeCheckError, setScopeCheckError] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    client
      .get(`/analysis/${id}`)
      .then((r) => {
        setAnalysis(r.data);
        setOverrides(r.data.scope_used || overridesFromFields(r.data.fields || []));
        if (r.data.estimate) {
          setResult(r.data);
        }
      })
      .catch((e) => setLoadErr(apiErrorMessage(e.response?.data?.detail) || "Failed to load analysis."));
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
      if (!selected && data.options?.length) {
        const defaultOption = data.options.find((opt) => opt.id === "B") || data.options[0];
        setSelected(defaultOption.id);
        setDeclineMode(false);
      }
    } catch (e) {
      setToast(apiErrorMessage(e.response?.data?.detail) || "Calculation failed.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setRecalc(false);
    }
  }, [id, costProfile, overrides, applyCalibration, selected]);

  const selectOption = (opt) => {
    setDeclineMode(false);
    setSelected(opt.id);
    setPolishedDrafts(null); // stale once the underlying option/numbers change
    track("option_selected", { analysis_id: id, option: opt.id });
  };

  const polishWithAi = async () => {
    if (!result?.options || result.options.length < 2) return;
    setPolishing(true);
    setPolishError(null);
    try {
      const { data } = await client.post(`/analysis/${id}/deal-copy`, {
        scope_overrides: overrides,
        options: result.options,
      });
      setPolishedDrafts(data.whatsapp);
      track("whatsapp_polished", { analysis_id: id });
    } catch (e) {
      setPolishError(apiErrorMessage(e.response?.data?.detail) || "Could not polish with AI. The template draft below is still fine to send.");
    } finally {
      setPolishing(false);
    }
  };

  const createAgreement = async () => {
    const opt = result.options.find((o) => o.id === selected);
    if (!opt) return;
    setCreating(true);
    try {
      const { data } = await client.post(`/analysis/${id}/agreement`, {
        option_id: opt.id,
        project_title: projectTitle || "Video offer - Baseline Work",
      });
      setAgreement(data);
      track("agreement_created", { analysis_id: id, option: selected });
    } catch (e) {
      setToast(apiErrorMessage(e.response?.data?.detail) || "Failed to create Agreement Sheet.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setCreating(false);
    }
  };

  const revokeAgreement = async () => {
    if (!agreement) return;
    setRevoking(true);
    try {
      await client.post(`/analysis/${id}/agreement/${agreement.token}/revoke`);
      setAgreement(null);
      setProjectTitle("");
      setConfirmRevoke(false);
      track("agreement_revoked", { analysis_id: id });
      setToast("Link revoked. Clients can no longer respond to it.");
      setTimeout(() => setToast(""), 3000);
    } catch (e) {
      setToast(apiErrorMessage(e.response?.data?.detail) || "Failed to revoke the link.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setRevoking(false);
    }
  };

  const runScopeCheck = async () => {
    if (!scopeCheckText.trim()) return;
    setScopeChecking(true);
    setScopeCheckError(null);
    try {
      const { data } = await client.post(`/analysis/${id}/scope-check`, { new_request: scopeCheckText });
      setScopeCheckResult(data);
      track("scope_check_run", { analysis_id: id });
    } catch (e) {
      setScopeCheckError(apiErrorMessage(e.response?.data?.detail) || "Scope Check failed. Please try again.");
    } finally {
      setScopeChecking(false);
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
          <Link to="/analyze" className="btn-primary btn-md mt-4">Back to Analyze</Link>
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
      <SEO
        title="Brief Map & Scope Analysis"
        description="Detailed scope map, hidden parameters, price floor calculation, and deal options for the analyzed client brief."
        canonical={`/analysis/${id}`}
        noIndex={true}
      />
      <div className="wrap py-8">
        <button onClick={() => navigate("/analyze")} className="btn-ghost btn-sm mb-3" data-testid="analysis-back">
          <ArrowLeft size={14} /> New analysis
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold text-ink">Brief Map</h1>
          {analysis.is_demo && <Badge tone="amber" data-testid="provenance-demo">Demo data</Badge>}
          {!analysis.is_demo && analysis.provenance === "ai" && (
            <Badge tone="green" data-testid="provenance-ai">AI extraction</Badge>
          )}
          {!analysis.is_demo && analysis.provenance === "heuristic_fallback" && (
            <Badge tone="neutral" data-testid="provenance-fallback">Deterministic fallback (no AI)</Badge>
          )}
        </div>

        {/* Redacted brief */}
        <div className="card mt-4 p-4">
          <div className="mb-1 text-xs font-semibold text-ink-faint">Brief input</div>
          <p className="text-[14px] leading-relaxed text-ink-soft">"{analysis.brief}"</p>
          {analysis.redaction?.total > 0 && (
            <p className="mt-1 text-[12px] text-green-strong">{analysis.redaction.total} sensitive items were redacted.</p>
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
                <span className="text-sm font-medium text-ink">Apply one-project calibration</span>
                <input type="checkbox" name="apply-calibration" checked={applyCalibration} onChange={(e) => setApplyCalibration(e.target.checked)} className="h-5 w-5 accent-[var(--green)]" />
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
                <p className="text-ink-soft">Answer the scope fields, then press <span className="font-semibold text-ink">Calculate estimate</span> to see the hour range and price floor.</p>
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
            <h2 className="text-xl font-extrabold text-ink">Three deal options</h2>
            <p className="mt-1 text-ink-soft">All numbers come from the engine. You can edit every draft before sending.</p>
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
              <div>
                {!declineMode && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <button onClick={polishWithAi} disabled={polishing} className="btn-secondary btn-sm" data-testid="polish-with-ai">
                      {polishing ? <><Spinner size={13} /> Polishing...</> : <>✨ Polish with AI</>}
                    </button>
                    {polishedDrafts && (
                      <>
                        <Badge tone="green">AI-polished</Badge>
                        <button onClick={() => setPolishedDrafts(null)} className="text-[12px] font-semibold text-ink-faint hover:text-ink">Use template instead</button>
                      </>
                    )}
                    {polishError && (
                      <span className="text-[12px] font-semibold text-danger" data-testid="polish-error">
                        {polishError} <button onClick={polishWithAi} className="underline underline-offset-2">Retry</button>
                      </span>
                    )}
                  </div>
                )}
                <WhatsAppPreview
                  drafts={polishedDrafts || result.whatsapp}
                  declineMode={declineMode}
                  declineMessage={result.decline_message}
                  onCopy={() => track("whatsapp_copied", { analysis_id: id, decline: declineMode })}
                />
              </div>

              {/* Agreement Sheet creation */}
              {!declineMode && (
                <div className="card p-5" data-testid="create-agreement-panel">
                  <h4 className="flex items-center gap-2 font-bold text-ink"><Link2 size={16} className="text-green" /> Agreement Sheet</h4>
                  {!selectedOption ? (
                    <p className="mt-2 text-[13px] text-ink-faint">Select an option above to create a client-safe shareable snapshot.</p>
                  ) : agreement ? (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl bg-green-soft/60 p-3">
                        <p className="text-[13px] font-semibold text-green-strong">Public link created. No client login required.</p>
                        <p className="mono mt-1 break-all text-[12px] text-ink-soft">{agreementUrl}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => { copy(agreementUrl); setToast("Link copied"); setTimeout(() => setToast(""), 1800); }} className="btn-secondary btn-sm" data-testid="copy-agreement-link">
                          {copyState === "ok" ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
                        </button>
                        <a href={`/s/${agreement.token}`} target="_blank" rel="noreferrer" className="btn-primary btn-sm" data-testid="open-agreement">
                          Open <ExternalLink size={14} />
                        </a>
                        {!confirmRevoke ? (
                          <button onClick={() => setConfirmRevoke(true)} className="btn-ghost btn-sm text-danger" data-testid="revoke-agreement">
                            <Ban size={14} /> Revoke
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-1.5" data-testid="revoke-confirm">
                            <span className="text-[12px] font-medium text-danger">Revoke this link? The client won't be able to respond anymore.</span>
                            <button onClick={revokeAgreement} disabled={revoking} className="btn-danger btn-sm">
                              {revoking ? <Spinner size={13} /> : "Confirm"}
                            </button>
                            <button onClick={() => setConfirmRevoke(false)} disabled={revoking} className="btn-ghost btn-sm">Cancel</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-[13px] text-ink-soft">Snapshot from <span className="font-semibold">Option {selected}</span>: {selectedOption.title}. Internal cost and margin data are not shared.</p>
                      <input
                        name="agreement-title"
                        className="input"
                        placeholder="Project title, e.g. August Reels Campaign"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        data-testid="agreement-title"
                      />
                      <button onClick={createAgreement} disabled={creating} className="btn-primary btn-md w-full" data-testid="create-agreement">
                        {creating ? <><Spinner size={16} /> Creating...</> : <>Create Agreement Sheet</>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {agreement && (
          <div className="mt-8 card p-5" data-testid="scope-check-panel">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-ink"><Search size={18} className="text-green" /> Scope Check</h2>
            <p className="mt-1 text-ink-soft">Client asking for something extra after sending the Agreement Sheet? Paste the request to check whether it's already included, a revision, or new scope.</p>
            <textarea
              name="scope-check-input"
              className="textarea mt-4 min-h-[80px]"
              placeholder={'e.g. "Bisa tambahin 2 video lagi ga? sama warnanya diganti jadi lebih cerah"'}
              value={scopeCheckText}
              onChange={(e) => setScopeCheckText(e.target.value)}
              disabled={scopeChecking}
              data-testid="scope-check-textarea"
            />
            <button onClick={runScopeCheck} disabled={scopeChecking || !scopeCheckText.trim()} className="btn-primary btn-md mt-3" data-testid="scope-check-run">
              {scopeChecking ? <><Spinner size={16} /> Checking...</> : "Check scope"}
            </button>

            {scopeCheckError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3.5 text-[13px] text-danger" data-testid="scope-check-error">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <div>
                  {scopeCheckError}
                  <button onClick={runScopeCheck} className="ml-2 font-bold underline underline-offset-2">Retry</button>
                </div>
              </div>
            )}

            {scopeCheckResult && (
              <div className="mt-4 space-y-3" data-testid="scope-check-result">
                <Badge tone={
                  scopeCheckResult.classification === "included" ? "green" :
                  scopeCheckResult.classification === "revision" ? "amber" :
                  scopeCheckResult.classification === "new_scope" ? "danger" : "neutral"
                }>
                  {{
                    included: "Included in scope",
                    revision: "Covered as a revision",
                    new_scope: "New scope — needs a fee adjustment",
                    unclear: "Unclear — needs clarification",
                  }[scopeCheckResult.classification] || scopeCheckResult.classification}
                </Badge>
                <p className="text-[13px] text-ink-soft">{scopeCheckResult.explanation}</p>
                {scopeCheckResult.delta_result && (
                  <p className="text-[13px] font-semibold text-ink">
                    Adds about {scopeCheckResult.delta_result.price_delta_low != null ? idr(scopeCheckResult.delta_result.price_delta_low) : "-"} to {scopeCheckResult.delta_result.price_delta_high != null ? idr(scopeCheckResult.delta_result.price_delta_high) : "-"}.
                  </p>
                )}
                <div className="rounded-xl bg-raised p-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-ink-faint">Suggested reply</span>
                    <button onClick={() => copyScopeReply(scopeCheckResult.whatsapp)} className="btn-secondary btn-sm">
                      {scopeCopyState === "ok" ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] text-ink-soft">{scopeCheckResult.whatsapp}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Toast show={!!toast}>{toast}</Toast>
    </Shell>
  );
}
