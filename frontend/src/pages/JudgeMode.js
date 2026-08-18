import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Quote, FastForward, ExternalLink, Check, History, PartyPopper } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, DemoTag, Spinner } from "@/components/ui/primitives";
import { client, track } from "@/lib/api";
import { idr, idrJuta, hoursRange } from "@/lib/format";

const STEPS = ["Brief", "Hidden work", "Clarification", "Price floor", "Decision"];

export default function JudgeMode() {
  const [seed, setSeed] = useState(null);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState("B");
  const [tokenState, setTokenState] = useState({ loading: false, token: null });
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    track("demo_started", { mode: "judge" });
    client.get("/demo/seed").then((r) => setSeed(r.data)).catch(() => {});
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (step === 3) track("estimate_viewed", { mode: "judge" });
  }, [step]);

  const hidden = useMemo(
    () => (seed ? seed.fields.filter((f) => f.status !== "stated") : []),
    [seed]
  );

  const createLink = async () => {
    setTokenState({ loading: true, token: null });
    try {
      const { data } = await client.post("/demo/agreement", { option_id: selected });
      setTokenState({ loading: false, token: data.token });
      track("agreement_created", { mode: "judge", option: selected });
    } catch (_) {
      setTokenState({ loading: false, token: null });
    }
  };

  if (!seed) {
    return (
      <Shell>
        <div className="wrap flex min-h-[60vh] items-center justify-center">
          <Spinner size={26} />
        </div>
      </Shell>
    );
  }

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const skip = () => setStep(STEPS.length - 1);

  return (
    <Shell>
      <div className="wrap-narrow py-8">
        {/* Progress + timer */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge tone="ink">Judge Mode</Badge>
              <DemoTag />
            </div>
            <span className="mono text-sm text-ink-faint" data-testid="judge-timer">{elapsed}s</span>
          </div>
          <div className="flex gap-1.5" role="progressbar" aria-valuenow={step + 1} aria-valuemax={STEPS.length}>
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? "bg-green" : "bg-black/10"}`} />
                <span className={`mt-1 hidden text-[11px] font-medium sm:block ${i === step ? "text-ink" : "text-ink-faint"}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* STEP 1 */}
            {step === 0 && (
              <div className="space-y-4" data-testid="judge-step-0">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">Kelihatannya jelas.</h2>
                <div className="card p-5">
                  <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-raised px-4 py-3 text-[15px] leading-relaxed text-ink">
                    “{seed.brief}”
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4">
                    <div><div className="text-xs text-ink-faint">Deliverable</div><div className="font-bold text-ink">12 Reels</div></div>
                    <div><div className="text-xs text-ink-faint">Budget klien</div><div className="font-bold text-ink">{idrJuta(3000000)}</div></div>
                    <div><div className="text-xs text-ink-faint">Deadline</div><div className="font-bold text-ink">Minggu depan</div></div>
                  </div>
                </div>
                <p className="text-ink-soft">Sebenarnya ada banyak pekerjaan yang belum dihargai. Lanjut untuk melihatnya.</p>
              </div>
            )}

            {/* STEP 2 */}
            {step === 1 && (
              <div className="space-y-4" data-testid="judge-step-1">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">
                  {hidden.length} hidden variables found.
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {hidden.map((f) => (
                    <div key={f.name} className="card p-4" data-testid={`judge-hidden-${f.name}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-ink">{f.label}</span>
                        <Badge tone={f.status === "inferred" ? "amber" : "neutral"}>
                          {f.status === "inferred" ? "Asumsi" : "Belum disebut"}
                        </Badge>
                      </div>
                      {f.source_quote ? (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] italic text-green-strong">
                          <Quote size={12} className="mt-0.5 shrink-0" /> “{f.source_quote}”
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[13px] text-ink-faint">{f.inference_explanation || "Tidak ditemukan di chat."}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 2 && (
              <div className="space-y-4" data-testid="judge-step-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">Ask this before you quote.</h2>
                <div className="card divide-y divide-line">
                  {seed.clarifications.map((q, i) => (
                    <div key={q.id} className="p-4">
                      <p className="text-sm font-semibold text-ink">{i + 1}. {q.question}</p>
                      <p className="mt-0.5 text-[13px] text-amber"><span className="font-semibold">Mengapa: </span>{q.why}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-green-strong">
                        <Check size={13} /> {q.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {step === 3 && (
              <div className="space-y-4" data-testid="judge-step-3">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">Not enough budget for an honest price yet.</h2>
                <div className="card p-5">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-xl bg-raised p-3"><div className="text-[12px] text-ink-faint">Estimasi jam</div><div className="text-lg font-extrabold text-ink">{hoursRange(seed.estimate.low, seed.estimate.high)}</div></div>
                    <div className="rounded-xl bg-raised p-3"><div className="text-[12px] text-ink-faint">Break-even</div><div className="text-lg font-extrabold text-ink">{idrJuta(seed.price.break_even_low)}</div><div className="text-[11px] text-ink-faint">s/d {idrJuta(seed.price.break_even_high)}</div></div>
                    <div className="rounded-xl bg-raised p-3"><div className="text-[12px] text-ink-faint">Price floor</div><div className="text-lg font-extrabold text-green-strong">{idrJuta(seed.price.price_floor_low)}</div><div className="text-[11px] text-ink-faint">s/d {idrJuta(seed.price.price_floor_high)}</div></div>
                    <div className="rounded-xl bg-raised p-3"><div className="text-[12px] text-ink-faint">Budget klien</div><div className="text-lg font-extrabold text-danger">{idrJuta(seed.price.client_budget)}</div><div className="text-[11px] text-ink-faint">Gap {idrJuta(seed.price.price_floor_gap_low)}</div></div>
                  </div>
                  <p className="mt-3 text-[12px] text-ink-faint">Cost per hour {idr(seed.cost_profile.cost_per_hour)} · target margin {Math.round(seed.cost_profile.target_margin * 100)}%. Harga aman belum berarti harga pasti.</p>
                </div>
                <div className="card border-amber/40 p-5" data-testid="judge-calibration">
                  <div className="mb-1 flex items-center gap-2">
                    <History size={16} className="text-amber" />
                    <span className="font-bold text-ink">Sinyal kalibrasi satu proyek</span>
                    <Badge tone="amber">Confidence rendah</Badge>
                  </div>
                  <p className="text-[13px] text-ink-soft">Proyek lama serupa: estimasi <span className="mono">24 jam</span> vs aktual <span className="mono">37 jam</span> → faktor <span className="mono font-semibold">×1,54</span>. Hanya satu riwayat, jadi diperlakukan sebagai sinyal awal.</p>
                </div>
              </div>
            )}

            {/* STEP 5 */}
            {step === 4 && (
              <div className="space-y-4" data-testid="judge-step-4">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">Three decisions, ready to send.</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {seed.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => { setSelected(o.id); track("option_selected", { mode: "judge", option: o.id }); }}
                      className={`card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${selected === o.id ? "border-green ring-2 ring-green/25" : ""}`}
                      data-testid={`judge-option-${o.id}`}
                    >
                      <div className="text-[11px] font-bold uppercase text-ink-faint">Opsi {o.id}</div>
                      <div className="text-sm font-bold text-ink">{o.title}</div>
                      <div className="mt-1 text-xl font-extrabold text-green-strong">{idr(o.price)}</div>
                      <div className="text-[12px] text-ink-faint">{o.quantity} video · {o.revision_rounds} revisi · {o.timeline_days}h</div>
                    </button>
                  ))}
                </div>

                <div className="card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-ink">Lembar Sepakat</h3>
                      <p className="text-[13px] text-ink-faint">Link publik, tanpa login klien, token acak.</p>
                    </div>
                    {tokenState.token ? (
                      <a href={`/s/${tokenState.token}`} target="_blank" rel="noreferrer" className="btn-primary btn-md" data-testid="judge-open-agreement">
                        Buka Lembar Sepakat <ExternalLink size={16} />
                      </a>
                    ) : (
                      <button onClick={createLink} disabled={tokenState.loading} className="btn-primary btn-md" data-testid="judge-create-agreement">
                        {tokenState.loading ? <><Spinner size={16} /> Membuat…</> : <>Buat link Lembar Sepakat <ArrowRight size={16} /></>}
                      </button>
                    )}
                  </div>
                </div>

                {/* Outcome card */}
                <div className="card bg-ink p-6 text-white" data-testid="judge-outcome">
                  <div className="flex items-center gap-2">
                    <PartyPopper size={18} className="text-green-soft" />
                    <span className="text-sm font-bold uppercase tracking-wide text-white/70">Outcome card · demo</span>
                  </div>
                  <p className="mt-2 text-[17px] font-semibold leading-snug">
                    Baseline surfaced {hidden.length} unpriced variables and a price floor of {idrJuta(seed.price.price_floor_low)}–{idrJuta(seed.price.price_floor_high)} against a {idrJuta(seed.price.client_budget)} budget.
                  </p>
                  <p className="mt-2 text-[14px] text-white/70">
                    The freelancer can keep the budget with Option A ({idr(seed.options[0].price)}, 6 Reels) or hold full scope with Option B ({idr(seed.options[1].price)}). All numbers are illustrative demo data — not market truth, not realized savings.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to="/analyze" className="btn btn-md bg-white text-ink hover:bg-white/90" data-testid="judge-try-own">Analyze your own brief</Link>
                    <span className="mono self-center text-sm text-white/50" data-testid="judge-final-time">Completed in {elapsed}s</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="mt-6 flex items-center justify-between">
          <button onClick={back} disabled={step === 0} className="btn-ghost btn-md" data-testid="judge-back">
            <ArrowLeft size={16} /> Kembali
          </button>
          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 && (
              <button onClick={skip} className="btn-ghost btn-sm" data-testid="judge-skip">
                <FastForward size={14} /> Skip to result
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button onClick={next} className="btn-primary btn-md" data-testid="judge-next">
                Lanjut <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
