import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check, ChevronRight, ChevronLeft, RotateCcw, ExternalLink, TriangleAlert,
  MessageSquareText, Sparkles, Wand2, ListChecks, Calculator, HandCoins,
  MessageCircle, FileSignature, PartyPopper, WifiOff,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { Spinner, Badge } from "@/components/ui/primitives";
import BriefMap from "@/components/BriefMap";
import EstimateResult from "@/components/EstimateResult";
import RiskTriggers from "@/components/RiskTriggers";
import DealOptions from "@/components/DealOptions";
import WhatsAppPreview from "@/components/WhatsAppPreview";
import { idr } from "@/lib/format";
import { client, apiErrorMessage } from "@/lib/api";

const DEMO_BRIEF_ID =
  "Halo kak, butuh 12 Reels buat campaign bulan depan. Budget 3 juta. Footage menyusul, minggu depan harus jadi, revisi sampai cocok.";
const DEMO_BRIEF_EN =
  "\"Hi, need 12 Reels for next month's campaign. Budget 3 million. Footage to follow, needs to be done next week, revisions until it's right.\"";

// Bundled fallback fixture (Phase 7.3): the landing/judge experience must never blank
// out just because the API is briefly unreachable. This mirrors the shape of
// GET /api/demo/seed, computed by the same deterministic engine at snapshot time.
const FALLBACK_SEED = {
  is_demo: true,
  cost_profile: {
    mode: "guided", target_take_home: 8000000, monthly_overhead: 1500000, monthly_reserve: 900000,
    total_working_hours: 160, billable_utilization: 0.65, target_margin: 0.2, is_demo: true, cost_per_hour: 100000,
  },
  fields: [
    { name: "quantity", label: "Video count", value: 12, status: "stated", source_quote: "12 Reels", confidence: 0.99 },
    { name: "platform", label: "Platform", value: "Reels", status: "stated", source_quote: "12 Reels", confidence: 0.95 },
    { name: "client_budget", label: "Client budget", value: 3000000, status: "stated", source_quote: "Budget is IDR 3M", confidence: 0.98 },
    { name: "deadline", label: "Deadline", value: "next week (ambiguous)", status: "stated", source_quote: "finished next week", confidence: 0.8 },
    { name: "footage_available", label: "Footage", value: "client will send it later", status: "stated", source_quote: "I will send the footage later", confidence: 0.9 },
    { name: "revision_rounds", label: "Revision rounds", value: "unbounded", status: "stated", source_quote: "Revisions until it feels right", confidence: 0.9,
      inference_explanation: "\"Revisions until it feels right\" means revision exposure is not bounded." },
    { name: "aspect_ratio", label: "Aspect ratio", value: "9:16", status: "inferred", source_quote: null, confidence: 0.7,
      inference_explanation: "Reels usually use a vertical 9:16 format." },
    { name: "motion_level", label: "Motion graphics", value: "basic", status: "inferred", source_quote: null, confidence: 0.5,
      inference_explanation: "Not stated, so the estimate assumes basic motion." },
    { name: "final_duration", label: "Final duration", value: null, status: "missing", source_quote: null, confidence: 1.0 },
    { name: "footage_preselected", label: "Footage already selected?", value: null, status: "missing", source_quote: null, confidence: 1.0 },
    { name: "footage_hours", label: "Footage volume", value: null, status: "missing", source_quote: null, confidence: 1.0 },
    { name: "scripting", label: "Scripting", value: null, status: "missing", source_quote: null, confidence: 1.0 },
    { name: "subtitles", label: "Subtitles", value: null, status: "missing", source_quote: null, confidence: 1.0 },
    { name: "approver_count", label: "Approver count", value: null, status: "missing", source_quote: null, confidence: 1.0 },
  ],
  clarifications: [
    { id: "q1", question: "What is the final duration for each video?", why: "Final duration changes editing and subtitle time.", impact: ["time", "cost"], answer: "30-45 seconds per video" },
    { id: "q2", question: "Is the footage already selected, or should the editor review all raw footage?", why: "Footage selection can add significant working hours.", impact: ["time", "cost", "dependency"], answer: "3 hours of raw footage, not selected" },
    { id: "q3", question: "Is scripting included? What about subtitles?", why: "Scripting and subtitles change the work scope.", impact: ["time", "acceptance"], answer: "Scripting is excluded, subtitles are included" },
    { id: "q4", question: "How many people approve the work?", why: "More approvers add communication time and revision risk.", impact: ["time", "revision"], answer: "2 approvers" },
    { id: "q5", question: "Are two consolidated revision rounds enough?", why: "Revision limits define the largest time exposure.", impact: ["revision", "cost"], answer: "Yes, the client accepts 2 consolidated rounds" },
  ],
  estimate: {
    low: 45.4, high: 52.8,
    breakdown: [
      { label: "Intake & asset management", low: 1.5, high: 1.5 },
      { label: "Footage review & selection (3h raw, not pre-selected)", low: 5.0, high: 6.0 },
      { label: "Editing x 12 videos (rough cut, fine cut, export/QC, subtitle, audio, color; duration band 31-60s, x1.35-1.4)", low: 32.4, high: 37.8 },
      { label: "Communication & approval (2 approvers)", low: 2.0, high: 2.5 },
      { label: "Revision rounds x 2", low: 4.5, high: 5.0 },
    ],
  },
  price: {
    cost_per_hour: 100000, labor_cost_low: 4540000, labor_cost_high: 5280000, direct_costs: 0,
    buffers: [
      { label: "Footage dependency buffer (8% of labor, min IDR 150,000, cap IDR 750,000)", amount: 150000 },
      { label: "Multi-approver buffer (5% of labor, min IDR 100,000, cap IDR 500,000)", amount: 100000 },
    ],
    buffer_total: 250000, break_even_low: 4790000, break_even_high: 5530000, target_margin: 0.2,
    price_floor_low: 5987500, price_floor_high: 6912500, client_budget: 3000000,
    price_floor_gap_low: 2987500, price_floor_gap_high: 3912500,
  },
  scope_completeness: { resolved: 13, total: 13, ratio: 1.0, percent: 100 },
  risk: {
    level: "high",
    triggers: [
      { code: "budget_below_break_even", severity: "high", label: "Budget below break-even", detail: "Client budget (IDR 3,000,000) is below break-even (from IDR 4,790,000)." },
      { code: "rush_deadline", severity: "high", label: "Deadline shorter than capacity", detail: "The low estimate needs about 8 working days, but the deadline is 5 days." },
      { code: "asset_dependency", severity: "medium", label: "Start depends on assets", detail: "Footage is not selected yet; selection adds time and can move the start date." },
      { code: "multiple_approvers", severity: "medium", label: "2 approvers", detail: "Multiple approvers add communication time and revision risk." },
    ],
  },
  confidence: { level: "medium", reason: "Most fields are answered, but dependencies or history are still limited." },
  options: [
    { id: "A", type: "budget_fixed", title: "Keep budget, reduce scope", price: 3000000, quantity: 4, timeline_days: 6,
      revision_rounds: 1, footage_selection_included: false, subtitles: true,
      exclusions: ["Scripting", "Custom motion graphics", "Footage selection", "Additional formats"],
      price_floor_low: 2262500, price_floor_high: 2637500,
      note: "Keeps the client budget by reducing to 4 videos and 1 revision round." },
    { id: "B", type: "scope_fixed_normal", title: "Keep scope, normal timeline", price: 7000000, quantity: 12, timeline_days: 13,
      revision_rounds: 2, footage_selection_included: true, subtitles: true,
      exclusions: ["Concept changes after storyboard approval", "Additional videos", "Additional aspect-ratio formats"],
      price_floor_low: 6472875, price_floor_high: 7397875,
      note: "Price sits inside the explainable floor range (IDR 6.5M to IDR 7.4M)." },
    { id: "C", type: "scope_fixed_rush", title: "Keep scope, rush premium", price: 9000000, quantity: 12, timeline_days: 12,
      revision_rounds: 1, footage_selection_included: true, subtitles: true, rush_premium: 2000000,
      conditions: ["Client feedback within 12 hours", "Complete assets before start", "Priority scheduling"],
      exclusions: ["Additional revision rounds", "Concept changes after approval"],
      price_floor_low: 7022000, price_floor_high: 7922000,
      note: "Adds an IDR 2,000,000 rush premium for compressed scheduling and faster approval." },
  ],
  whatsapp: {
    warm: "Thanks for the brief. I broke down the scope first. For 12 Reels, a few items still affect the quote: final duration, footage selection, subtitles, approvers, and revision limits.\n\nWith an IDR 3,000,000 budget, the safest option is 4 vertical videos (up to 45 seconds each), subtitles (IDR 3,000,000, about 6 working days after all assets are complete). It includes 1 revision round.\n\nIf you want to keep all 12 Reels with footage selection and 2 revision rounds, the estimate is IDR 7,000,000, about 13 working days after all assets are complete.\n\nI summarized the options in this link so we can choose the cleanest scope before production starts.",
    firm: "I reviewed the brief and need to protect the scope before quoting. For 12 Reels, a few items still affect the quote: final duration, footage selection, subtitles, approvers, and revision limits.\n\nWith an IDR 3,000,000 budget, the safest option is 4 vertical videos (up to 45 seconds each), subtitles (IDR 3,000,000, about 6 working days after all assets are complete). It includes 1 revision round.\n\nIf you want to keep all 12 Reels with footage selection and 2 revision rounds, the estimate is IDR 7,000,000, about 13 working days after all assets are complete.\n\nI summarized the options in this link so we can choose the cleanest scope before production starts.",
    formal: "Thank you for the brief. I have reviewed the scope and pricing assumptions. For 12 Reels, a few items still affect the quote: final duration, footage selection, subtitles, approvers, and revision limits.\n\nWith an IDR 3,000,000 budget, the safest option is 4 vertical videos (up to 45 seconds each), subtitles (IDR 3,000,000, about 6 working days after all assets are complete). It includes 1 revision round.\n\nIf you want to keep all 12 Reels with footage selection and 2 revision rounds, the estimate is IDR 7,000,000, about 13 working days after all assets are complete.\n\nI summarized the options in this link so we can choose the cleanest scope before production starts.",
  },
  decline_message: "Thanks for trusting me with this project. After reviewing the scope and timeline, I cannot take it on under the current terms while still protecting the quality of the work. If the timeline or scope becomes more flexible, I would be happy to revisit it.",
  formula_version: "1.1.0",
};

const STEPS = [
  { key: "brief", label: "Brief", Icon: MessageSquareText },
  { key: "map", label: "Evidence", Icon: ListChecks },
  { key: "clarify", label: "Clarify", Icon: Wand2 },
  { key: "estimate", label: "Estimate", Icon: Calculator },
  { key: "options", label: "Options", Icon: HandCoins },
  { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { key: "agreement", label: "Agreement", Icon: FileSignature },
  { key: "done", label: "Done", Icon: PartyPopper },
];

function Stepper({ index }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="judge-stepper" aria-label="Judge Mode progress">
      {STEPS.map((s, i) => {
        const state = i < index ? "done" : i === index ? "active" : "todo";
        return (
          <div key={s.key} className="flex shrink-0 items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${
                state === "done" ? "border-emerald-500 bg-emerald-500 text-zinc-950" :
                state === "active" ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" :
                "border-white/15 bg-white/5 text-zinc-500"
              }`}
              aria-current={state === "active" ? "step" : undefined}
              title={s.label}
            >
              {state === "done" ? <Check size={14} /> : i + 1}
            </div>
            <span className={`hidden text-[11px] font-semibold sm:inline ${state === "todo" ? "text-zinc-500" : "text-zinc-200"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight size={12} className="text-zinc-700" />}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ children }) {
  return <div className="mx-auto w-full max-w-2xl">{children}</div>;
}

function NavRow({ onBack, onNext, nextLabel = "Next", nextDisabled = false, backHidden = false }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {!backHidden ? (
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/10" data-testid="judge-back">
          <ChevronLeft size={15} /> Back
        </button>
      ) : <span />}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="judge-next"
        >
          {nextLabel} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

export default function Judge() {
  const [seed, setSeed] = useState(null);
  const [source, setSource] = useState(null); // "live" | "fallback"
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(0);
  const [answersApplied, setAnswersApplied] = useState(false);
  const [selectedOption, setSelectedOption] = useState("B");
  const [agreement, setAgreement] = useState(null);
  const [agreeErr, setAgreeErr] = useState(null);
  const [creatingAgreement, setCreatingAgreement] = useState(false);
  const [approving, setApproving] = useState(false);

  const loadSeed = () => {
    setLoading(true);
    client
      .get("/demo/seed", { timeout: 6000 })
      .then((r) => { setSeed(r.data); setSource("live"); setLoading(false); })
      .catch(() => { setSeed(FALLBACK_SEED); setSource("fallback"); setLoading(false); });
  };

  useEffect(() => { loadSeed(); }, []);

  const restart = () => {
    setStep(0);
    setAnswersApplied(false);
    setSelectedOption("B");
    setAgreement(null);
    setAgreeErr(null);
  };

  const createAgreement = async () => {
    setCreatingAgreement(true);
    setAgreeErr(null);
    try {
      const { data } = await client.post("/demo/agreement", {
        option_id: selectedOption, project_title: "Judge Mode demo — 12 Reels campaign",
      }, { timeout: 8000 });
      setAgreement({ token: data.token, status: data.status });
    } catch (e) {
      setAgreeErr(apiErrorMessage(e.response?.data?.detail) || "Could not create the demo Agreement Sheet. Check your connection and retry.");
    } finally {
      setCreatingAgreement(false);
    }
  };

  const approveAsClient = async () => {
    if (!agreement) return;
    setApproving(true);
    setAgreeErr(null);
    try {
      const { data } = await client.post(`/agreement/${agreement.token}/respond`, { action: "approve" }, { timeout: 8000 });
      setAgreement((a) => ({ ...a, status: data.status }));
    } catch (e) {
      setAgreeErr(apiErrorMessage(e.response?.data?.detail) || "Could not simulate approval. Retry, or continue to the next step.");
    } finally {
      setApproving(false);
    }
  };

  const opt = useMemo(() => seed?.options?.find((o) => o.id === selectedOption), [seed, selectedOption]);

  if (loading) {
    return (
      <Shell dark={true}>
        <SEO title="90-Second Judge Mode Demo" description="A deterministic, no-login guided demo of Baseline's pre-deal scope and pricing workflow." canonical="/judge" noIndex />
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-white">
          <Spinner size={26} />
          <p className="text-sm text-zinc-400">Loading the seeded demo...</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell dark={true}>
      <SEO
        title="90-Second Judge Mode Demo"
        description="A deterministic, no-login guided demo of Baseline's pre-deal scope and pricing workflow: brief -> evidence -> clarification -> price floor -> deal options -> Agreement Sheet."
        canonical="/judge"
        noIndex
      />
      <div className="min-h-screen bg-[#090b10] px-5 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                <Sparkles size={12} /> Judge Mode — no login, ~90 seconds
              </div>
              <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">See the pre-deal workflow end to end</h1>
            </div>
            <button type="button" onClick={restart} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10" data-testid="judge-restart">
              <RotateCcw size={13} /> Restart
            </button>
          </div>

          {source === "fallback" && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-300" data-testid="judge-fallback-notice">
              <WifiOff size={14} /> Using bundled demo data — the live API didn't respond in time.
              <button type="button" onClick={loadSeed} className="ml-auto font-bold underline underline-offset-2">Retry live data</button>
            </div>
          )}

          <div className="mt-6"><Stepper index={step} /></div>
        </div>

        <div className="mt-8">
          {/* Step 0: Brief */}
          {step === 0 && (
            <StepCard>
              <div className="card p-5">
                <h2 className="font-bold text-ink">The messy brief a client actually sent</h2>
                <div className="mt-3 rounded-xl bg-raised p-4 text-sm leading-relaxed text-ink" data-testid="judge-brief-id">
                  "{DEMO_BRIEF_ID}"
                </div>
                <p className="mt-2 text-xs text-ink-faint" data-testid="judge-brief-en">{DEMO_BRIEF_EN}</p>
                <p className="mt-4 text-sm text-ink-soft">
                  This is a real pattern: quantity and budget are stated, but duration, footage readiness,
                  approvers, and revision limits are missing or unbounded. Baseline runs the same deterministic
                  engine used in production — no live AI call is required for this demo.
                </p>
              </div>
              <NavRow backHidden onNext={() => setStep(1)} nextLabel="Run the analysis" />
            </StepCard>
          )}

          {/* Step 1: Evidence map */}
          {step === 1 && (
            <StepCard>
              <div className="card p-5">
                <h2 className="mb-1 font-bold text-ink">Stated, assumed, and missing evidence</h2>
                <p className="mb-4 text-sm text-ink-soft">
                  Deterministic extraction separates what the client actually said from what Baseline assumed —
                  before any number is calculated.
                </p>
              </div>
              <div className="mt-4"><BriefMap fields={seed.fields} /></div>
              <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="See the clarification questions" />
            </StepCard>
          )}

          {/* Step 2: Clarification questions */}
          {step === 2 && (
            <StepCard>
              <div className="card p-5">
                <h2 className="mb-1 font-bold text-ink">The five highest-impact questions</h2>
                <p className="mb-4 text-sm text-ink-soft">Ranked by how much they change time, cost, or revision exposure.</p>
                <ol className="space-y-3">
                  {seed.clarifications.map((q, i) => (
                    <li key={q.id || i} className="border-l-2 border-amber/40 pl-3" data-testid={`judge-question-${i}`}>
                      <p className="text-sm font-semibold text-ink">{i + 1}. {q.question}</p>
                      <p className="mt-0.5 text-[13px] text-ink-soft"><span className="font-semibold text-amber">Why: </span>{q.why}</p>
                      {answersApplied && (
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-green-strong" data-testid={`judge-answer-${i}`}>
                          <Check size={13} /> {q.answer}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                {!answersApplied ? (
                  <button
                    type="button"
                    onClick={() => setAnswersApplied(true)}
                    className="btn-primary btn-md mt-5 w-full sm:w-auto"
                    data-testid="judge-apply-answers"
                  >
                    <Wand2 size={15} /> Apply seeded answers
                  </button>
                ) : (
                  <p className="mt-5 text-[13px] font-semibold text-green-strong">Answers applied. The estimate below reflects them.</p>
                )}
              </div>
              <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Calculate the price floor" nextDisabled={!answersApplied} />
            </StepCard>
          )}

          {/* Step 3: Estimate + risk */}
          {step === 3 && (
            <StepCard>
              <EstimateResult
                estimate={seed.estimate}
                price={seed.price}
                completeness={seed.scope_completeness}
                confidence={seed.confidence}
                calibrationTrace={null}
                costProfile={{ cost_per_hour: seed.cost_profile.cost_per_hour }}
                isDemo
              />
              <div className="mt-4"><RiskTriggers risk={seed.risk} /></div>
              <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="See the deal options" />
            </StepCard>
          )}

          {/* Step 4: Options */}
          {step === 4 && (
            <StepCard>
              <div className="card p-5">
                <h2 className="mb-1 font-bold text-ink">Three bounded options</h2>
                <p className="mb-4 text-sm text-ink-soft">Pick the one you would send. Every number here comes from the deterministic engine, not AI.</p>
              </div>
              <div className="mt-4">
                <DealOptions
                  options={seed.options}
                  selectedId={selectedOption}
                  onSelect={(o) => setSelectedOption(o.id)}
                  onDecline={() => {}}
                  declineActive={false}
                />
              </div>
              <NavRow onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Draft the WhatsApp message" />
            </StepCard>
          )}

          {/* Step 5: WhatsApp copy */}
          {step === 5 && (
            <StepCard>
              <WhatsAppPreview drafts={seed.whatsapp} declineMode={false} declineMessage={seed.decline_message} onCopy={() => {}} />
              <NavRow onBack={() => setStep(4)} onNext={() => setStep(6)} nextLabel="Create the Agreement Sheet" />
            </StepCard>
          )}

          {/* Step 6: Agreement */}
          {step === 6 && (
            <StepCard>
              <div className="card p-5" data-testid="judge-agreement-panel">
                <h2 className="mb-1 font-bold text-ink">Client-safe Agreement Sheet</h2>
                <p className="mb-4 text-sm text-ink-soft">
                  Selected: <span className="font-semibold">Option {opt?.id}</span> — {opt?.title} ({idr(opt?.price)}).
                  The link below never exposes your internal cost, rate, or margin.
                </p>

                {!agreement ? (
                  <button type="button" onClick={createAgreement} disabled={creatingAgreement} className="btn-primary btn-md w-full sm:w-auto" data-testid="judge-create-agreement">
                    {creatingAgreement ? <><Spinner size={16} /> Creating...</> : <><FileSignature size={16} /> Create demo Agreement Sheet</>}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-green-soft/60 p-3">
                      <Check size={15} className="text-green" />
                      <span className="text-[13px] font-semibold text-green-strong">Agreement Sheet created.</span>
                      <Badge tone={agreement.status === "APPROVED" ? "green" : "neutral"} data-testid="judge-agreement-status">{agreement.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={`/agreement/${agreement.token}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm" data-testid="judge-open-agreement">
                        Open Agreement Sheet <ExternalLink size={14} />
                      </a>
                      {agreement.status !== "APPROVED" && (
                        <button type="button" onClick={approveAsClient} disabled={approving} className="btn-primary btn-sm" data-testid="judge-simulate-approve">
                          {approving ? <><Spinner size={14} /> Approving...</> : <>Simulate client approval</>}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {agreeErr && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-[13px] text-danger" data-testid="judge-agreement-error">
                    <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                    <div>
                      {agreeErr}
                      <button type="button" onClick={agreement ? approveAsClient : createAgreement} className="ml-2 font-bold underline underline-offset-2">Retry</button>
                    </div>
                  </div>
                )}
              </div>
              <NavRow
                onBack={() => setStep(5)}
                onNext={() => setStep(7)}
                nextLabel={agreement?.status === "APPROVED" ? "Finish" : "Skip / continue"}
              />
            </StepCard>
          )}

          {/* Step 7: Explanation */}
          {step === 7 && (
            <StepCard>
              <div className="card p-6 text-center">
                <PartyPopper className="mx-auto text-green" size={28} />
                <h2 className="mt-3 text-lg font-extrabold text-ink">How Baseline works</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                  AI only extracts evidence from the brief and helps phrase client-facing copy — it never touches a
                  number. Every hour, price floor, timeline, and deal option came from deterministic, versioned
                  application code (formula v{seed.formula_version}), so the same inputs always produce the same
                  output and every figure can be traced back to a visible assumption.
                </p>
                <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <Link to="/analyze" className="btn-primary btn-md" data-testid="judge-try-own-brief">Analyze your own brief</Link>
                  <button type="button" onClick={restart} className="btn-secondary btn-md" data-testid="judge-restart-bottom">
                    <RotateCcw size={15} /> Run the demo again
                  </button>
                </div>
              </div>
              <NavRow onBack={() => setStep(6)} onNext={null} />
            </StepCard>
          )}
        </div>
      </div>
    </Shell>
  );
}
