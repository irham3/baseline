import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play, Calculator, Pencil, ShieldOff } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, DemoTag } from "@/components/ui/primitives";
import { client } from "@/lib/api";
import { idrJuta } from "@/lib/format";

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } }),
};

function HeroVisual({ seed }) {
  const hidden = seed ? seed.fields.filter((f) => f.status === "missing" || f.status === "inferred").length : 5;
  return (
    <div className="relative">
      <div className="card p-4 sm:p-5" data-testid="hero-brief">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-ink-faint">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-soft text-green-strong">K</span>
          Chat klien
          <DemoTag className="ml-auto" />
        </div>
        <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-raised px-4 py-3 text-[14px] leading-relaxed text-ink">
          “Kak mau edit 12 reels buat campaign bulan depan. Footage nanti aku kirim. Budget 3 juta ya,
          kalau bisa minggu depan selesai. Revisi sampai cocok.”
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="card relative z-10 -mt-3 ml-6 mr-2 p-4 sm:ml-10 sm:p-5"
        data-testid="hero-baseline"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">Baseline</span>
          <Badge tone="danger">Budget di bawah break-even</Badge>
        </div>
        <p className="mt-2 text-[15px] font-semibold text-ink">
          {hidden} hidden variables found in this brief.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-raised p-3">
            <div className="text-[12px] text-ink-faint">Price floor</div>
            <div className="text-lg font-extrabold text-green-strong">
              {seed ? `${idrJuta(seed.price.price_floor_low)}` : "Rp5,1 juta"}
            </div>
            <div className="text-[11px] text-ink-faint">s/d {seed ? idrJuta(seed.price.price_floor_high) : "Rp5,8 juta"}</div>
          </div>
          <div className="rounded-xl bg-raised p-3">
            <div className="text-[12px] text-ink-faint">Budget klien</div>
            <div className="text-lg font-extrabold text-danger">{seed ? idrJuta(seed.price.client_budget) : "Rp3,0 juta"}</div>
            <div className="text-[11px] text-ink-faint">Belum aman</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  const [seed, setSeed] = useState(null);
  useEffect(() => {
    client.get("/demo/seed").then((r) => setSeed(r.data)).catch(() => {});
  }, []);

  return (
    <Shell>
      {/* Hero */}
      <section className="wrap grid items-center gap-10 pb-8 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-16">
        <div>
          <motion.p variants={fade} initial="hidden" animate="show" custom={0} className="eyebrow">
            AI pre-deal baseline check
          </motion.p>
          <motion.h1
            variants={fade}
            initial="hidden"
            animate="show"
            custom={1}
            className="mt-3 text-[42px] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-[56px]"
            data-testid="hero-headline"
          >
            Baseline<br />before yes.
          </motion.h1>
          <motion.p
            variants={fade}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-soft"
          >
            Paste a client brief, find hidden work, and quote from a price floor you can explain.
          </motion.p>
          <motion.div
            variants={fade}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <Link to="/judge" className="btn-primary btn-lg" data-testid="cta-judge">
              <Play size={18} /> See why Rp3 million is not safe yet
            </Link>
            <Link to="/analyze" className="btn-secondary btn-lg" data-testid="cta-analyze">
              Analyze my brief <ArrowRight size={18} />
            </Link>
          </motion.div>
          <motion.ul
            variants={fade}
            initial="hidden"
            animate="show"
            custom={4}
            className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-ink-faint"
          >
            <li className="flex items-center gap-1.5"><Calculator size={14} className="text-green" /> Transparent calculations</li>
            <li className="flex items-center gap-1.5"><Pencil size={14} className="text-green" /> Editable output</li>
            <li className="flex items-center gap-1.5"><ShieldOff size={14} className="text-green" /> No automatic message sending</li>
          </motion.ul>
        </div>
        <HeroVisual seed={seed} />
      </section>

      {/* Problem line */}
      <section className="border-y border-line/70 bg-surface/50">
        <div className="wrap py-10">
          <p className="max-w-3xl text-[22px] font-semibold leading-snug tracking-tight text-ink sm:text-[26px]">
            Freelancers quote before the whole job is visible. Hidden footage work, vague revisions,
            rushed deadlines, and extra approvers then turn into <span className="text-green-strong">unpaid hours</span>.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="wrap py-14">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink-faint">From messy chat to a baseline you can send</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            { n: "01", t: "Evidence-backed scope", d: "Every stated field carries the exact quote from the chat. Inferred and missing work is separated, not guessed." },
            { n: "02", t: "Deterministic price floor", d: "Hours, break-even, and price floor come from your own cost profile and named buffers — not AI guesswork." },
            { n: "03", t: "Three deal options", d: "Keep the budget with less scope, hold scope at a fair price, or add a rush premium. Every option is editable." },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="border-l-2 border-green/30 pl-4"
            >
              <span className="mono text-sm font-semibold text-green">{s.n}</span>
              <h3 className="mt-1 text-[17px] font-bold text-ink">{s.t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="wrap pb-4">
        <div className="card flex flex-col items-start gap-4 bg-ink p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div>
            <h3 className="text-[22px] font-extrabold tracking-tight">Run the 90-second Judge Mode</h3>
            <p className="mt-1 text-white/70">One synthetic brief, from hidden work to a public Lembar Sepakat. No login.</p>
          </div>
          <Link to="/judge" className="btn btn-lg bg-white text-ink hover:bg-white/90" data-testid="cta-judge-bottom">
            Start Judge Mode <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </Shell>
  );
}
