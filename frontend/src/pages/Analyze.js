import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { PlayCircle, ArrowDown, ShieldCheck, RotateCcw, CircleCheck, TriangleAlert } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import BriefInputBox from "@/components/BriefInputBox";

const THEME_KEY = "baseline-landing-theme";

function getTheme(dark) {
  return dark
    ? {
        pageBg: "#08090d",
        ink: "#ffffff",
        inkSoft: "#9aa1ab",
        inkFaint: "#6b7280",
        accent: "#34d399",
        blob: "#10b981",
        cardBorder: "rgba(255,255,255,0.08)",
        cardBg: "rgba(255,255,255,0.025)",
        rowText: "#ccd1d8",
        proofBorder: "rgba(16,185,129,0.25)",
        proofBg: "linear-gradient(160deg, rgba(6,78,59,0.28), rgba(6,78,59,0.08))",
        proofDivider: "rgba(255,255,255,0.08)",
        gradPrimary: "linear-gradient(180deg, #3ee0a6 0%, #0ea371 100%)",
        btnPrimaryText: "#04140d",
        warnBorder: "rgba(245,158,11,0.2)",
        warnBg: "rgba(245,158,11,0.1)",
        warnText: "#fde68a",
      }
    : {
        pageBg: "#f7f9f6",
        ink: "#0f1712",
        inkSoft: "#435046",
        inkFaint: "#718073",
        accent: "#0f5a40",
        blob: "#0f5a40",
        cardBorder: "#dce4d9",
        cardBg: "#ffffff",
        rowText: "#435046",
        proofBorder: "rgba(15,90,64,0.25)",
        proofBg: "linear-gradient(160deg, #e2f2ea, #eef8f2)",
        proofDivider: "#dce4d9",
        gradPrimary: "linear-gradient(180deg, #14795a 0%, #0a4531 100%)",
        btnPrimaryText: "#ffffff",
        warnBorder: "rgba(180,83,9,0.22)",
        warnBg: "#fef3c7",
        warnText: "#7a4c0a",
      };
}

// framer-motion's whileInView prop didn't reliably fire in testing (the
// element stayed clipped at its initial state), so this drives the reveal
// off a plain native IntersectionObserver instead — no framer-motion
// internals involved, just a boolean that flips animate() on and off.
function useInViewOnce(amount = 0.4) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setInView(true);
    }, { threshold: amount });
    obs.observe(el);
    return () => obs.disconnect();
  }, [amount]);
  return [ref, inView];
}

export default function Analyze() {
  const [scopeRef, scopeInView] = useInViewOnce(0.4);
  const reduceMotion = useReducedMotion();
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
  const T = getTheme(dark);

  return (
    <Shell dark={dark} onToggleDark={toggleDark}>
      <SEO
        title="Analyze a Client Brief"
        description="Paste a client brief and get evidence-backed scope, clarification questions, an hour range, and a transparent price floor."
        canonical="/analyze"
      />
      <div className="relative mx-auto max-w-[1440px] overflow-hidden px-5 py-14 sm:px-8 md:px-16 lg:px-24 lg:py-20" style={{ background: T.pageBg, color: T.ink }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              opacity: dark ? 0.4 : 0.45,
              backgroundImage: `linear-gradient(to right, ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,18,0.045)"} 1px, transparent 1px), linear-gradient(to bottom, ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,18,0.045)"} 1px, transparent 1px)`,
              backgroundSize: "46px 46px",
              WebkitMaskImage: "radial-gradient(ellipse 55% 40% at 50% 4%, black 0%, transparent 72%)",
              maskImage: "radial-gradient(ellipse 55% 40% at 50% 4%, black 0%, transparent 72%)",
            }}
          />
          <svg width="640" height="640" viewBox="-100 -100 200 200" className="absolute -left-40 -top-36 blur-[5px]" style={{ opacity: dark ? 0.14 : 0.08 }}>
            <path fill={T.blob} d="M45.3,-58.5C58.4,-49.7,68.2,-35.6,71.9,-19.9C75.6,-4.2,73.2,13,65.6,27.3C58,41.6,45.2,52.9,30.6,60.6C16,68.3,-0.4,72.4,-16.6,69.8C-32.8,67.2,-48.8,57.9,-59.6,44.5C-70.4,31.1,-76,13.6,-74.9,-3.4C-73.8,-20.4,-66,-36.9,-53.7,-46.6C-41.4,-56.3,-24.6,-59.2,-8.4,-60.9C7.8,-62.6,32.2,-67.3,45.3,-58.5Z" />
          </svg>
        </div>

        <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1fr_460px] lg:gap-16">
          {/* LEFT: form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: T.accent }}>Step 1 of 3</span>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[46px]" style={{ color: T.ink }}>Analyze a client brief.</h1>
            <p className="mt-4 max-w-[480px] text-[15.5px] leading-relaxed" style={{ color: T.inkSoft }}>
              Paste the WhatsApp message, DM, or brief as-is. Baseline extracts scope evidence, flags what&rsquo;s missing, and computes an hour range and price floor from your cost profile.
            </p>
            <p className="mt-3.5 text-[13px]" style={{ color: T.inkFaint }}>
              Not sure yet? <Link to="/judge" className="font-semibold" style={{ color: T.accent }}>
                <PlayCircle size={12} className="inline -mt-0.5" /> See the 90-second guided demo
              </Link> instead.
            </p>

            <div className="relative mt-8">
              <div className="pointer-events-none absolute -inset-x-3.5 -bottom-4.5 -top-3.5 -z-10 rounded-[20px] blur-[16px]" style={{ background: `radial-gradient(60% 100% at 30% 0%, ${dark ? "rgba(16,185,129,0.14)" : "rgba(15,90,64,0.1)"}, transparent 70%)` }} />
              <BriefInputBox />
            </div>
          </motion.div>

          {/* RIGHT: visual proof, messy -> structured */}
          <motion.div
            className="flex flex-col gap-3.5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
          >
            <motion.div
              className="rounded-2xl p-4.5"
              style={{ borderWidth: 1, borderStyle: "solid", borderColor: T.cardBorder, background: T.cardBg }}
              whileHover={reduceMotion ? undefined : { y: -4, borderColor: T.accent, boxShadow: "0 20px 40px -20px rgba(0,0,0,0.28)" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: T.inkFaint }}>Messy brief in</span>
              <p className="mt-2 text-[13px] italic leading-relaxed" style={{ color: T.inkSoft }}>&ldquo;need 12 reels, budget 3M, done next week, revisions until it feels right, I&rsquo;ll send footage later&rdquo;</p>
            </motion.div>

            <div className="flex justify-center">
              <ArrowDown size={20} style={{ color: T.accent }} strokeWidth={1.75} />
            </div>

            <div className="relative" ref={scopeRef}>
              <div className="sticker absolute right-3.5 -top-3.5 z-10 rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold" style={{ "--r": "-4deg", background: T.gradPrimary, color: T.btnPrimaryText, boxShadow: "0 8px 16px -6px rgba(16,185,129,0.35)" }}>
                auto-flagged &darr;
              </div>
              <motion.div
                initial={{ clipPath: "polygon(0% 0%, -10% 0%, 10% 100%, 0% 100%)" }}
                animate={scopeInView ? { clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" } : undefined}
                whileHover={reduceMotion ? undefined : { y: -4, borderColor: T.accent, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 44px -20px rgba(0,0,0,0.28)", transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="relative rounded-2xl p-5" style={{ borderWidth: 1, borderStyle: "solid", borderColor: T.proofBorder, background: T.proofBg, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 36px -20px rgba(0,0,0,0.2)" }}>
                <span className="mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: T.accent }}>Structured scope out</span>
                <div className="mt-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[12.5px]" style={{ color: T.rowText }}>Deliverables <span className="mono font-bold" style={{ color: T.ink }}>12 Reels</span></div>
                  <div className="flex items-center justify-between text-[12.5px]" style={{ color: T.rowText }}>Revision limit <span className="mono font-bold" style={{ color: T.ink }}>2 rounds (bounded)</span></div>
                  <div className="flex items-center justify-between text-[12.5px]" style={{ color: T.rowText }}>Hour range <span className="mono font-bold" style={{ color: T.ink }}>14&ndash;18h</span></div>
                  <div className="flex items-center justify-between pt-2.5 text-[12.5px] font-bold" style={{ borderTop: `1px solid ${T.proofDivider}`, color: T.ink }}>Price floor <span className="mono" style={{ color: T.accent }}>IDR 5.5M</span></div>
                </div>
                <div className="mt-3.5 flex items-start gap-1.5 rounded-[10px] px-3 py-2.5" style={{ background: T.warnBg, border: `1px solid ${T.warnBorder}` }}>
                  <TriangleAlert size={14} className="mt-0.5 flex-shrink-0" style={{ color: dark ? "#fbbf24" : "#b45309" }} strokeWidth={1.75} />
                  <span className="text-[11.5px] leading-relaxed" style={{ color: T.warnText }}>Footage quality not stated — assumed raw. Flagged for clarification.</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* trust strip */}
        <div className="relative mt-14 grid grid-cols-1 gap-3.5 sm:grid-cols-3 lg:mt-16">
          {[
            { Icon: CircleCheck, text: "Every value traces to a quote in your brief" },
            { Icon: ShieldCheck, text: "Contact details redacted before AI sees it" },
            { Icon: RotateCcw, text: "Deterministic fallback if AI is unavailable" },
          ].map(({ Icon, text }) => (
            <motion.div
              key={text}
              className="flex items-center gap-3 rounded-2xl px-5 py-4.5"
              style={{ borderWidth: 1, borderStyle: "solid", borderColor: T.cardBorder, background: T.cardBg }}
              whileHover={reduceMotion ? undefined : { y: -4, borderColor: T.accent, boxShadow: "0 20px 40px -20px rgba(0,0,0,0.28)" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Icon size={20} className="flex-shrink-0" style={{ color: T.accent }} strokeWidth={1.75} />
              <span className="text-[13px]" style={{ color: T.rowText }}>{text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
