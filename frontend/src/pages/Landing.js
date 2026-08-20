import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  Calculator,
  FileText,
  Sparkles,
  Layers,
  MessageSquare,
  ChevronRight
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { client } from "@/lib/api";
import { Spinner } from "@/components/ui/primitives";

function idr(n) {
  if (n == null || isNaN(n)) return "-";
  return "IDR " + Math.round(n).toLocaleString("en-US");
}

function idrCompact(n) {
  if (n == null || isNaN(n)) return "-";
  return "IDR " + (n / 1_000_000).toFixed(1) + "M";
}

// --- SUBTLE GRID BACKGROUND ---
function SubtleGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.18]">
      <div
        className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_0),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_0)] [background-repeat:repeat] [background-size:40px_40px]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#090b10] via-transparent to-[#090b10]" />
    </div>
  );
}

// --- AI INPUT SANDBOX ---
function AIInputBox() {
  const [brief, setBrief] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    if (!brief.trim()) {
      setError("Please paste a client brief first.");
      return;
    }
    if (brief.length < 15) {
      setError("Brief is too short. Please provide more context.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const res = await client.post("/analyze", { brief, use_ai: true, redact: true });
      navigate(`/analysis/${res.data.analysis_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to connect to AI engine.");
      setAnalyzing(false);
    }
  };

  const SAMPLE_BRIEF = "Hi, I need 12 Reels for next month's campaign. I will send the footage later. Budget is IDR 3M, ideally finished next week. Revisions until it feels right.";

  const handleDemo = async () => {
    setError(null);
    setBrief(SAMPLE_BRIEF);
    setAnalyzing(true);
    try {
      const res = await client.post("/analyze", { 
        brief: SAMPLE_BRIEF, 
        use_ai: false, 
        redact: false 
      });
      navigate(`/analysis/${res.data.analysis_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load sample analysis.");
      setAnalyzing(false);
    }
  };

  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#0d1117]/80 p-2 backdrop-blur-xl shadow-2xl focus-within:border-emerald-500/50 transition-colors">
      <div className="flex h-10 items-center justify-between border-b border-white/5 bg-transparent px-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-emerald-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            AI Scope Extraction Engine
          </span>
        </div>
      </div>
      
      <div className="p-3 sm:p-5">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Paste client brief, WhatsApp chat, or voice note transcript here..."
          className="w-full min-h-[160px] bg-transparent text-zinc-200 placeholder-zinc-600 outline-none resize-none text-sm leading-relaxed"
          disabled={analyzing}
        />
        
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-4">
          <p className="text-[11px] text-zinc-500 max-w-sm leading-relaxed">
            Baseline AI automatically extracts deliverable volume, hidden assumptions, requested revisions, and budget constraints.
            Contact details are redacted before analysis. If the AI is unavailable, a deterministic fallback extracts the same brief without it.
          </p>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {error && (
              <span className="text-xs font-semibold text-rose-400 mr-2">{error}</span>
            )}
            <button
              type="button"
              onClick={handleDemo}
              disabled={analyzing}
              className="flex-1 sm:flex-none text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors px-4 py-2"
            >
              Run sample brief
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="group relative flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-zinc-950 shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <><Spinner size={16} /> Analyzing...</>
              ) : (
                <>Analyze Scope <Sparkles size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [seed, setSeed] = useState(null);

  useEffect(() => {
    client.get("/demo/seed").then((r) => setSeed(r.data)).catch(() => { });
  }, []);

  return (
    <Shell dark={true}>
      <SEO
        title="Pre-deal Scope Checks & Price Floor for Freelancers"
        description="Pre-deal scope check and pricing floor calculator for short-form video freelancers. Paste a client brief, find hidden work, compute unassailable price floors, and send clean pre-deal agreements."
        canonical="/"
      />
      <div className="relative min-h-screen overflow-hidden bg-[#090b10] text-white selection:bg-emerald-500 selection:text-zinc-950">
        <SubtleGrid />

        {/* Ambient subtle glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[750px] rounded-full bg-emerald-500/10 blur-[130px]" />

        {/* ================= 1. HERO SECTION ================= */}
        <section className="relative z-10 mx-auto max-w-7xl px-5 pt-16 pb-20 sm:px-6 md:pt-24 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 backdrop-blur-md">
              <Sparkles size={13} className="text-emerald-400" />
              <span>Pre-Deal Scope Intelligence for Video Creators</span>
              <ChevronRight size={12} className="opacity-60" />
            </div>

            {/* Main Headline */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl leading-[1.08]">
              Price the scope <br />
              <span className="text-emerald-400">
                before it prices you.
              </span>
            </h1>

            {/* Subheading */}
            <p className="mx-auto mt-6 max-w-lg text-base text-zinc-300 sm:text-lg font-normal leading-relaxed">
              Paste the brief. Baseline AI extracts hidden scope, calculates your hard price floor, and generates the agreement.
            </p>

            {/* Micro proof line */}
            <p className="mt-8 text-xs text-zinc-500 font-mono">
              Your rate, cost, and margin never appear in a client-facing link
            </p>
          </div>

          {/* ================= HERO AI INPUT ================= */}
          <div className="mt-12 sm:mt-16 mx-auto max-w-3xl">
            <AIInputBox />
          </div>
        </section>

        {/* ================= 2. BENTO GRID FEATURES ================= */}
        <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-6 lg:px-8 border-t border-white/10 bg-[#07080c]">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">Engineered for Freelancers</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              The output is a clear decision, not a vague quote.
            </h2>
            <p className="mt-4 text-base text-zinc-400">
              Baseline Work separates evidence, hidden assumptions, pricing mathematics, and mutual commitments before you send a WhatsApp message.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Bento Card 1: Hidden Work (Span 8) */}
            <div className="md:col-span-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-md hover:border-emerald-500/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Layers size={18} />
                </div>
                <h3 className="text-xl font-bold text-white">Hidden Work Becomes Explicit</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Most video projects lose money on unpriced variables: messy footage, audio cleanup, and endless reviews. Baseline forces these into hard constraints.
              </p>

              {/* Visual Component: Scope Radar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                    <span className="text-zinc-300">Deliverable Quantity</span>
                    <span className="rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] px-2 py-0.5">12 Reels</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                    <span className="text-zinc-300">Source Footage Quality</span>
                    <span className="rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] px-2 py-0.5">Assumed Raw</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                    <span className="text-zinc-300">Sound & Foley Design</span>
                    <span className="rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] px-2 py-0.5">Included</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                    <span className="text-zinc-300">Revision Threshold</span>
                    <span className="rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] px-2 py-0.5">2 Bounded Rounds</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Deterministic Math (Span 4) */}
            <div className="md:col-span-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-md hover:border-emerald-500/30 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Calculator size={18} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Deterministic Math</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                  No LLM guessing. Your price floor is mathematically derived from your operating overhead and target hourly rate.
                </p>
              </div>

              {/* Visual Component: Formula Gauge */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-center">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">Formula Derived Floor</span>
                <div className="text-3xl font-extrabold text-white mt-1 font-mono">
                  {seed ? idrCompact(seed.price.price_floor_low) : "IDR 5.5M"}
                </div>
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Protects your {seed ? Math.round(seed.price.target_margin * 100) : 20}% target margin
                </span>
              </div>
            </div>

            {/* Bento Card 3: Privacy Shield (Span 4) */}
            <div className="md:col-span-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-md hover:border-emerald-500/30 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Lock size={18} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Private by Architecture</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                  Client links NEVER expose your internal hours, base rates, or margin calculations.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <ShieldCheck size={14} /> Cost data stays out of the link
                </div>
                <div className="text-[11px] text-zinc-400">
                  Clients only see deliverables, timeline, and revision terms — never your internal cost, rate, or margin.
                </div>
              </div>
            </div>

            {/* Bento Card 4: Bounded Options (Span 8) */}
            <div className="md:col-span-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-md hover:border-emerald-500/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileText size={18} />
                </div>
                <h3 className="text-xl font-bold text-white">Two Bounded Options Ready to Send</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Never argue price without changing scope. We generate two choices: meet their budget with reduced scope, or charge the true floor for full scope.
              </p>

              {/* Visual Component: Dual Offer Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-bold text-zinc-200">Option A: Fit Client Budget</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {seed ? idr(seed.options[0].price) : "IDR 3,000,000"}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-[11px] text-zinc-400">
                    <li>✓ 6 Reels (Scope adjusted to budget)</li>
                    <li>✓ 2 Review Rounds max</li>
                    <li>✓ 10-day standard delivery</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-bold text-white">Option B: Full Scope Floor</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {seed ? idr(seed.options[1].price) : "IDR 5,500,000"}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-[11px] text-emerald-200/80">
                    <li>✓ 12 Reels (Full campaign scope)</li>
                    <li>✓ Audio mastering + raw footage sorting</li>
                    <li>✓ Priority turnaround</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* ================= 4. FINAL CTA SECTION ================= */}
        <section className="relative z-10 border-t border-white/10 bg-[#06070a] py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-white sm:text-5xl tracking-tight">
              Test your next client brief before you quote.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400 sm:text-lg">
              Paste your brief. Protect your margins. Send the agreement.
            </p>
            {/* Footer Form CTA */}
            <div className="mt-12 mx-auto max-w-2xl text-left">
              <AIInputBox />
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
