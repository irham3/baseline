import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  Lock,
  Calculator,
  FileText,
  Sparkles,
  Sliders,
  Layers,
  MessageSquare,
  ChevronRight,
  Clock,
  Video
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { client } from "@/lib/api";

function idr(n) {
  if (n == null || isNaN(n)) return "-";
  return "IDR " + Math.round(n).toLocaleString("en-US");
}

function idrCompact(n) {
  if (n == null || isNaN(n)) return "-";
  return "IDR " + (n / 1_000_000).toFixed(1) + "M";
}

// --- RETRO GRID BACKGROUND ---
function RetroGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden [perspective:200px] opacity-25">
      <div
        className="absolute inset-0 [transform:rotateX(60deg)] [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_0),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_0)] [background-repeat:repeat] [background-size:48px_48px] [height:300vh] [margin-left:-50%] [transform-origin:100%_0_0] [width:200%]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#090b0e] via-transparent to-[#090b0e]" />
    </div>
  );
}

// --- INTERACTIVE CALCULATOR SANDBOX ON LANDING PAGE ---
function InteractiveCalculator({ seed }) {
  const [reels, setReels] = useState(12);
  const [footageOrganized, setFootageOrganized] = useState(false);
  const [isRush, setIsRush] = useState(false);
  const [revisions, setRevisions] = useState("capped"); // 'capped' | 'open'

  const calculation = useMemo(() => {
    const baseHoursPerReel = footageOrganized ? 1.8 : 2.8;
    const revisionHours = revisions === "open" ? reels * 1.5 : reels * 0.5;
    const totalHours = Math.round(reels * baseHoursPerReel + revisionHours);
    const hourlyCost = 140000; // IDR 140k/hr
    const rushMultiplier = isRush ? 1.35 : 1.0;

    const breakEven = Math.round(totalHours * hourlyCost * rushMultiplier);
    const priceFloor = Math.round(breakEven * 1.35); // 35% margin floor
    const clientBudget = 3000000; // IDR 3M
    const floorGap = priceFloor - clientBudget;

    return {
      totalHours,
      breakEven,
      priceFloor,
      clientBudget,
      floorGap,
      isLoss: floorGap > 0
    };
  }, [reels, footageOrganized, isRush, revisions]);

  return (
    <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sliders size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Live Scope & Floor Simulator</h3>
            <p className="text-xs text-zinc-400">Test how unpriced variables impact your actual break-even in real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Deterministic Engine
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Controls */}
        <div className="space-y-5 lg:col-span-7">
          <div>
            <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-2">
              <span className="flex items-center gap-1.5"><Video size={14} className="text-emerald-400" /> Deliverable Volume</span>
              <span className="text-emerald-400 font-mono font-bold">{reels} Short-form Reels</span>
            </div>
            <input
              type="range"
              min="2"
              max="24"
              step="2"
              value={reels}
              onChange={(e) => setReels(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-white/10 rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
              <span>2 Reels</span>
              <span>12 Reels (Demo)</span>
              <span>24 Reels</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setFootageOrganized(!footageOrganized)}
              className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${footageOrganized
                  ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20"
                }`}
            >
              <span className="text-[11px] font-semibold">Raw Footage</span>
              <span className={`text-xs font-bold mt-1 ${footageOrganized ? "text-emerald-400" : "text-amber-400"}`}>
                {footageOrganized ? "✓ Organized" : "⚠️ Unorganized (+1h/reel)"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRevisions(revisions === "capped" ? "open" : "capped")}
              className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${revisions === "capped"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                  : "border-rose-500/40 bg-rose-500/10 text-white"
                }`}
            >
              <span className="text-[11px] font-semibold">Revision Bounds</span>
              <span className={`text-xs font-bold mt-1 ${revisions === "capped" ? "text-emerald-400" : "text-rose-400"}`}>
                {revisions === "capped" ? "✓ Capped (2 rounds)" : "🚨 Unlimited Revisions"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsRush(!isRush)}
              className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${isRush
                  ? "border-amber-500/40 bg-amber-500/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20"
                }`}
            >
              <span className="text-[11px] font-semibold">Timeline</span>
              <span className={`text-xs font-bold mt-1 ${isRush ? "text-amber-400" : "text-zinc-300"}`}>
                {isRush ? "⚡ 48h Rush (+35%)" : "✓ Standard (7-14d)"}
              </span>
            </button>
          </div>
        </div>

        {/* Readout Output */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 flex flex-col justify-between lg:col-span-5">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-white/10 pb-3">
              <span className="flex items-center gap-1.5"><Clock size={13} /> Estimated Effort</span>
              <span className="font-mono font-bold text-white">{calculation.totalHours} Production Hours</span>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Hard Break-Even Cost</span>
                <span className="font-mono font-bold text-zinc-200">{idrCompact(calculation.breakEven)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Target Margin Floor (+35%)</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{idrCompact(calculation.priceFloor)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-zinc-400">Client's Initial Budget</span>
                <span className="font-mono text-zinc-400">{idrCompact(calculation.clientBudget)}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center">
            {calculation.isLoss ? (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">🚨 Hidden Scope Loss Risk</span>
                <p className="text-xs font-semibold text-rose-200 mt-0.5">
                  Client budget is <span className="font-bold underline">{idrCompact(calculation.floorGap)} below</span> your floor!
                </p>
              </div>
            ) : (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">✓ Safe Margin Scope</span>
                <p className="text-xs font-semibold text-emerald-200 mt-0.5">Budget satisfies your minimum rate.</p>
              </div>
            )}
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
      <div className="relative min-h-screen overflow-hidden bg-[#090b0e] text-white selection:bg-emerald-500 selection:text-zinc-950">
        <RetroGrid />

        {/* Ambient Glow Orbs */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[550px] w-[850px] rounded-full bg-emerald-500/15 blur-[140px]" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-teal-500/10 blur-[120px]" />

        {/* ================= 1. HERO SECTION ================= */}
        <section className="relative z-10 mx-auto max-w-7xl px-5 pt-16 pb-24 sm:px-6 md:pt-24 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Sparkles size={13} className="text-emerald-400" />
              <span>Pre-Deal Scope Intelligence for Video Creators</span>
              <ChevronRight size={12} className="opacity-60" />
            </div>

            {/* Main Headline */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl lg:leading-[1.08]">
              Price the scope <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
                before it prices you.
              </span>
            </h1>

            {/* Subheading */}
            <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-lg md:text-xl font-normal leading-relaxed">
              Paste raw client briefs or WhatsApp chats. Baseline Work flags unpriced variables, computes your deterministic price floor, and generates bounded agreements before anyone says yes.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/judge"
                className="group relative inline-flex h-13 items-center justify-center gap-3 rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-bold text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Run Interactive Demo</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/20 transition-transform group-hover:translate-x-1">
                  <ArrowRight size={14} />
                </div>
              </Link>

              <Link
                to="/analyze"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-zinc-200 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
              >
                <span>Analyze Custom Brief</span>
                <ChevronRight size={15} className="text-zinc-500" />
              </Link>
            </div>

            {/* Micro proof line */}
            <p className="mt-4 text-xs text-zinc-500 font-mono">
              100% Client-Side Private • No API keys needed for demo • Instant result
            </p>
          </div>

          {/* ================= HERO TERMINAL MOCKUP ================= */}
          <div className="mt-14 sm:mt-18 mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-[#0e1218]/90 shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-2xl">
              {/* Window Titlebar */}
              <div className="flex h-11 items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-3 hidden text-[11px] font-mono font-medium text-zinc-400 sm:inline-block">
                    Baseline Work — Pre-Deal Scope Inspector
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  <AlertTriangle size={11} /> 4 Hidden Variables Detected
                </div>
              </div>

              {/* Terminal Workspace Body */}
              <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-12">
                {/* Left Pane: WhatsApp Client Brief Simulator */}
                <div className="space-y-3 rounded-2xl border border-white/10 bg-[#07090c] p-4 md:col-span-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <MessageSquare size={13} />
                      </div>
                      <span className="text-xs font-bold text-zinc-200">Incoming Client WhatsApp</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">10:42 AM</span>
                  </div>

                  {/* Chat bubble with highlighted scope tags */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs leading-relaxed text-zinc-300">
                    "Halo bro, mau minta tolong editin <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-emerald-300 border border-emerald-500/30">12 Reels</span> buat campaign bulan depan. Budget kita <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-300 border border-amber-500/30">IDR 3.000.000</span> ya. Raw footage nanti nyusul, minta tolong dibagusin sound design sama <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-semibold text-rose-300 border border-rose-500/30">revisi sampai cocok</span> ya."
                  </div>

                  {/* Extracted Scope Flags */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-2.5 py-1.5 text-[11px]">
                      <span className="text-zinc-400">Volume</span>
                      <span className="font-semibold text-emerald-400">12 Short Reels</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-amber-500/5 border border-amber-500/15 px-2.5 py-1.5 text-[11px]">
                      <span className="text-amber-300/80">Source Footage</span>
                      <span className="font-semibold text-amber-400">⚠️ Unorganized (+8h)</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-rose-500/5 border border-rose-500/15 px-2.5 py-1.5 text-[11px]">
                      <span className="text-rose-300/80">Revision Ceiling</span>
                      <span className="font-semibold text-rose-400">🚨 Open-ended Scope Creep</span>
                    </div>
                  </div>
                </div>

                {/* Right Pane: Baseline Deterministic Floor Readout */}
                <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 via-black/40 to-black/60 p-4 md:col-span-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Baseline Calculation</span>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 font-mono">
                        HOURLY FLOOR: 140k/h
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400">True Break-Even</span>
                        <div className="text-lg font-extrabold text-white mt-1">
                          {seed ? idrCompact(seed.price.break_even_low) : "IDR 4.1M"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-300">Target Floor (+35%)</span>
                        <div className="text-lg font-extrabold text-emerald-400 mt-1">
                          {seed ? idrCompact(seed.price.price_floor_low) : "IDR 5.5M"}
                        </div>
                      </div>
                    </div>

                    {/* Floor Gap Warning */}
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 flex items-center justify-between text-xs">
                      <span className="text-rose-300 font-semibold flex items-center gap-1.5">
                        <AlertTriangle size={13} className="text-rose-400" /> Client Budget Gap:
                      </span>
                      <span className="font-mono font-bold text-rose-400">
                        {seed ? idrCompact(seed.price.price_floor_gap_low) : "-IDR 2.5M Under"}
                      </span>
                    </div>
                  </div>

                  {/* Ready to generate option */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Decision ready:</span>
                    <Link
                      to="/judge"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 underline"
                    >
                      View Option A & B in Demo <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 2. BENTO GRID FEATURES ================= */}
        <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Engineered for Freelancers</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              The output is a clear decision, not a vague quote.
            </h2>
            <p className="mt-4 text-base text-zinc-400">
              Baseline Work separates evidence, hidden assumptions, pricing mathematics, and mutual commitments before you send a WhatsApp message.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Bento Card 1: Hidden Work (Span 8) */}
            <div className="md:col-span-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-md hover:border-emerald-500/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Layers size={18} />
                </div>
                <h3 className="text-xl font-bold text-white">Hidden Work Becomes Explicit</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Most video projects lose money on unpriced variables: messy source footage, multi-track audio cleanup, and unconstrained review rounds. Baseline Work forces these into defined constraints.
              </p>

              {/* Visual Component: Scope Radar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
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
            <div className="md:col-span-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-md hover:border-emerald-500/30 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Calculator size={18} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Deterministic Math</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                  No LLM guessing or hallucinations. Pricing is derived from your real operating overhead, target hourly rate, and task complexity.
                </p>
              </div>

              {/* Visual Component: Formula Gauge */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-center">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">Formula Derived Floor</span>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {seed ? idrCompact(seed.price.price_floor_low) : "IDR 5.5M"}
                </div>
                <span className="text-[11px] text-zinc-400 mt-1 block">Protects minimum 35% margin</span>
              </div>
            </div>

            {/* Bento Card 3: Privacy Shield (Span 4) */}
            <div className="md:col-span-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-md hover:border-emerald-500/30 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Lock size={18} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Private by Architecture</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                  Client links NEVER expose your internal hours, base rates, software subscriptions, or margin calculations.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <ShieldCheck size={14} /> Air-gapped Agreement Links
                </div>
                <div className="text-[11px] text-zinc-400">
                  Clients only see deliverables, timelines, and payment milestones.
                </div>
              </div>
            </div>

            {/* Bento Card 4: Bounded Options (Span 8) */}
            <div className="md:col-span-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-md hover:border-emerald-500/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileText size={18} />
                </div>
                <h3 className="text-xl font-bold text-white">Two Bounded Options Ready to Send</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Never argue price without changing scope. Baseline Work generates two balanced choices: meet their budget with reduced scope, or charge the true floor for the full scope.
              </p>

              {/* Visual Component: Dual Offer Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-bold text-zinc-200">Option A: Fit Client Budget</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {seed ? idr(seed.options[0].price) : "IDR 3.000.000"}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-[11px] text-zinc-400">
                    <li>✓ 6 Reels (Scope adjusted to budget)</li>
                    <li>✓ 2 Review Rounds max</li>
                    <li>✓ 10-day standard delivery</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-bold text-white">Option B: Full Scope Floor</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {seed ? idr(seed.options[1].price) : "IDR 5.500.000"}
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

        {/* ================= 3. INTERACTIVE CALCULATOR SECTION ================= */}
        <section className="relative z-10 mx-auto max-w-5xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Try It Now</span>
            <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              See how scope variables change your price floor
            </h2>
          </div>
          <InteractiveCalculator seed={seed} />
        </section>

        {/* ================= 4. FINAL CTA SECTION ================= */}
        <section className="relative z-10 border-t border-white/10 bg-[#060709] py-24 sm:py-32">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-white sm:text-5xl tracking-tight">
              Test your next client brief before you quote.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400 sm:text-lg">
              Takes 30 seconds. Protect your margins, eliminate scope creep, and send professional agreement sheets.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/judge"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-emerald-500 px-9 py-3.5 text-sm font-bold text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all hover:bg-emerald-400 hover:scale-[1.02]"
              >
                <span>Run Interactive Demo</span>
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/analyze"
                className="inline-flex h-13 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <span>Paste Your Own Brief</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
