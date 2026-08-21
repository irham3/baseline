import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useScroll, useMotionValueEvent } from "framer-motion";
import {
  Sparkles,
  PlayCircle,
  Layers,
  Calculator,
  RotateCcw,
  FileText,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { client } from "@/lib/api";
import BriefInputBox from "@/components/BriefInputBox";

function idr(n) {
  if (n == null || isNaN(n)) return "-";
  return "IDR " + Math.round(n).toLocaleString("en-US");
}

function idrCompact(n) {
  if (n == null || isNaN(n)) return "-";
  return "IDR " + (n / 1_000_000).toFixed(1) + "M";
}

const THEME_KEY = "baseline-landing-theme";

function getTheme(dark) {
  return dark
    ? {
        pageBg: "#08090d",
        ink: "#ffffff",
        inkSoft: "#9aa1ab",
        inkFaint: "#6b7280",
        accent: "#34d399",
        blob1: "#10b981",
        blob2: "#2dd4bf",
        blobOpacity1: 0.16,
        blobOpacity2: 0.13,
        gradPrimary: "linear-gradient(180deg, #3ee0a6 0%, #0ea371 100%)",
        gradPrimaryHover: "linear-gradient(180deg, #55e8b6 0%, #12b57e 100%)",
        btnPrimaryText: "#04140d",
        btnPrimaryShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.12), 0 1px 2px rgba(3,10,7,0.4), 0 10px 24px -8px rgba(16,185,129,0.55)",
        btnSecondaryBg: "rgba(255,255,255,0.04)",
        btnSecondaryBorder: "rgba(255,255,255,0.14)",
        cardBorder: "rgba(255,255,255,0.08)",
        cardBg: "rgba(255,255,255,0.025)",
        cardHoverBorder: "rgba(16,185,129,0.32)",
        gradText: "linear-gradient(180deg, #86efc0 0%, #10b981 100%)",
        badgeBorder: "rgba(16,185,129,0.28)",
        badgeBg: "linear-gradient(180deg, rgba(16,185,129,0.14), rgba(16,185,129,0.05))",
        badgeText: "#5eead4",
        hand: "#fbbf24",
        iconChipBg: "linear-gradient(160deg, rgba(16,185,129,0.22), rgba(16,185,129,0.06))",
        iconChipBorder: "rgba(16,185,129,0.22)",
        iconColor: "#5eead4",
        floorBoxBorder: "rgba(16,185,129,0.22)",
        floorBoxBg: "linear-gradient(160deg, rgba(6,78,59,0.35), rgba(6,78,59,0.1))",
        optionBBorder: "rgba(16,185,129,0.28)",
        optionBBg: "linear-gradient(160deg, rgba(16,185,129,0.12), rgba(16,185,129,0.03))",
        optionBText: "rgba(167,243,208,0.8)",
        amberTipBorder: "rgba(245,158,11,0.2)",
        amberTipBg: "linear-gradient(160deg, rgba(120,53,15,0.25), rgba(120,53,15,0.08))",
        amberTipText: "#fbbf24",
        checkColor: "#34d399",
        xColor: "#fb7185",
        cmpHeaderBg: "rgba(255,255,255,0.03)",
        cmpHeaderBorder: "rgba(255,255,255,0.08)",
        cmpColBorder: "rgba(255,255,255,0.07)",
        cmpRowBorder: "rgba(255,255,255,0.05)",
        cmpRowHighlightBg: "rgba(16,185,129,0.05)",
        cmpLabel: "#6b7280",
        cmpClient: "#e4e8ec",
        cmpWorkspace: "#34d399",
        cmpRowText: "#ccd1d8",
        stickerChipBg: "#12161e",
        stickerChipBorder: "rgba(255,255,255,0.12)",
        stickerChipAccentBorder: "rgba(16,185,129,0.35)",
        stickerChipText: "#e4e8ec",
        agreementBadgeBg: "rgba(16,185,129,0.15)",
        agreementBadgeText: "#a7f3d0",
        blackBoxBg: "rgba(0,0,0,0.35)",
        blackBoxBorder: "rgba(255,255,255,0.07)",
      }
    : {
        pageBg: "#f7f9f6",
        ink: "#0f1712",
        inkSoft: "#435046",
        inkFaint: "#718073",
        accent: "#0f5a40",
        blob1: "#0f5a40",
        blob2: "#0d9488",
        blobOpacity1: 0.09,
        blobOpacity2: 0.07,
        gradPrimary: "linear-gradient(180deg, #14795a 0%, #0a4531 100%)",
        gradPrimaryHover: "linear-gradient(180deg, #178a67 0%, #0d5238 100%)",
        btnPrimaryText: "#ffffff",
        btnPrimaryShadow: "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12), 0 1px 2px rgba(9,61,43,0.25), 0 12px 22px -8px rgba(15,90,64,0.35)",
        btnSecondaryBg: "#ffffff",
        btnSecondaryBorder: "#dce4d9",
        cardBorder: "#dce4d9",
        cardBg: "#ffffff",
        cardHoverBorder: "rgba(15,90,64,0.32)",
        gradText: "linear-gradient(180deg, #14795a 0%, #093d2b 100%)",
        badgeBorder: "rgba(15,90,64,0.22)",
        badgeBg: "linear-gradient(180deg, rgba(15,90,64,0.08), rgba(15,90,64,0.02))",
        badgeText: "#0f5a40",
        hand: "#b45309",
        iconChipBg: "linear-gradient(160deg, rgba(15,90,64,0.14), rgba(15,90,64,0.03))",
        iconChipBorder: "rgba(15,90,64,0.2)",
        iconColor: "#0f5a40",
        floorBoxBorder: "rgba(15,90,64,0.2)",
        floorBoxBg: "linear-gradient(160deg, #e2f2ea, #eef8f2)",
        optionBBorder: "rgba(15,90,64,0.25)",
        optionBBg: "linear-gradient(160deg, #e2f2ea, #f2f8f4)",
        optionBText: "#0f5a40",
        amberTipBorder: "rgba(180,83,9,0.22)",
        amberTipBg: "linear-gradient(160deg, #fef3c7, #fffaf0)",
        amberTipText: "#b45309",
        checkColor: "#0f5a40",
        xColor: "#dc2626",
        cmpHeaderBg: "#eef3ec",
        cmpHeaderBorder: "#dce4d9",
        cmpColBorder: "#dce4d9",
        cmpRowBorder: "#eef3ec",
        cmpRowHighlightBg: "rgba(15,90,64,0.05)",
        cmpLabel: "#718073",
        cmpClient: "#0f1712",
        cmpWorkspace: "#0f5a40",
        cmpRowText: "#435046",
        stickerChipBg: "#ffffff",
        stickerChipBorder: "#dce4d9",
        stickerChipAccentBorder: "rgba(15,90,64,0.3)",
        stickerChipText: "#0f1712",
        agreementBadgeBg: "rgba(15,90,64,0.12)",
        agreementBadgeText: "#0f5a40",
        blackBoxBg: "#f7f9f6",
        blackBoxBorder: "#eef3ec",
      };
}

// Fixed pseudo-random layout so particles don't reshuffle on re-render.
// (left%, top%, size px, drift duration s, delay s)
const PARTICLES = [
  [6, 78, 3, 9, 0], [14, 32, 2, 12, 1.4], [21, 58, 4, 8, 0.6], [29, 88, 2, 14, 2.8],
  [37, 20, 3, 10, 0.2], [44, 68, 2, 13, 3.4], [52, 40, 4, 9, 1.8], [59, 82, 2, 11, 0.9],
  [66, 14, 3, 15, 2.2], [73, 60, 2, 8, 1.1], [80, 30, 4, 12, 3.8], [87, 74, 2, 10, 0.4],
  [92, 46, 3, 14, 2.6], [10, 12, 2, 11, 3.1], [48, 92, 3, 9, 1.6], [78, 90, 2, 13, 0.7],
];

function Particles({ color }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PARTICLES.map(([left, top, size, duration, delay], i) => (
        <span
          key={i}
          className="particle-drift absolute rounded-full"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            background: color,
            boxShadow: `0 0 ${size * 3}px ${size}px ${color}`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// --- BACKGROUND: subtle grid mask + asymmetric blob art + ambient particles ---
function HeroBackdrop({ T, dark }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          opacity: dark ? 0.35 : 0.45,
          backgroundImage: `linear-gradient(to right, ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,18,0.045)"} 1px, transparent 1px), linear-gradient(to bottom, ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,18,0.045)"} 1px, transparent 1px)`,
          backgroundSize: "46px 46px",
          WebkitMaskImage: "radial-gradient(ellipse 60% 45% at 50% 8%, black 0%, transparent 72%)",
          maskImage: "radial-gradient(ellipse 60% 45% at 50% 8%, black 0%, transparent 72%)",
        }}
      />
      {/* Slow-rotating rings, veilpass-style ambient depth — dashed so the
          rotation actually reads (a uniform solid ring looks static). */}
      <div
        className="ring-rotate absolute -right-[220px] -top-[160px] h-[620px] w-[620px] rounded-full"
        style={{ border: `2px dashed ${T.accent}`, opacity: dark ? 0.22 : 0.16 }}
      />
      <div
        className="ring-rotate-reverse absolute -right-[140px] -top-[100px] h-[440px] w-[440px] rounded-full"
        style={{ border: `1.5px dashed ${T.accent}`, opacity: dark ? 0.18 : 0.13 }}
      />
      <svg width="900" height="900" viewBox="-100 -100 200 200" className="blob-float absolute -left-64 -top-80 blur-[6px]" style={{ opacity: T.blobOpacity1 }}>
        <path fill={T.blob1} d="M45.3,-58.5C58.4,-49.7,68.2,-35.6,71.9,-19.9C75.6,-4.2,73.2,13,65.6,27.3C58,41.6,45.2,52.9,30.6,60.6C16,68.3,-0.4,72.4,-16.6,69.8C-32.8,67.2,-48.8,57.9,-59.6,44.5C-70.4,31.1,-76,13.6,-74.9,-3.4C-73.8,-20.4,-66,-36.9,-53.7,-46.6C-41.4,-56.3,-24.6,-59.2,-8.4,-60.9C7.8,-62.6,32.2,-67.3,45.3,-58.5Z" />
      </svg>
      <svg width="560" height="560" viewBox="-100 -100 200 200" className="blob-float-delayed absolute -right-36 top-16 rotate-[35deg] blur-[4px]" style={{ opacity: T.blobOpacity2 }}>
        <path fill={T.blob2} d="M45.3,-58.5C58.4,-49.7,68.2,-35.6,71.9,-19.9C75.6,-4.2,73.2,13,65.6,27.3C58,41.6,45.2,52.9,30.6,60.6C16,68.3,-0.4,72.4,-16.6,69.8C-32.8,67.2,-48.8,57.9,-59.6,44.5C-70.4,31.1,-76,13.6,-74.9,-3.4C-73.8,-20.4,-66,-36.9,-53.7,-46.6C-41.4,-56.3,-24.6,-59.2,-8.4,-60.9C7.8,-62.6,32.2,-67.3,45.3,-58.5Z" />
      </svg>
      <svg width="60" height="60" viewBox="0 0 24 24" className="spin-slow absolute left-[9%] top-[230px] hidden md:block" style={{ opacity: dark ? 0.5 : 0.6 }}>
        <circle cx="12" cy="12" r="9" fill="none" stroke={T.accent} strokeWidth="1.4" strokeDasharray="3 4" />
      </svg>
      <svg width="26" height="26" viewBox="0 0 24 24" className="pulse-soft absolute right-[11%] top-[180px] hidden md:block" style={{ opacity: dark ? 0.6 : 0.7 }}>
        <path d="M12 4v16M4 12h16" stroke={T.accent} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <Particles color={T.accent} />
    </div>
  );
}

// Scroll-triggered fade-up reveal, once per element. Kept restrained (one
// direction, no bounce, no repeat) per the "no idle wobble" motion rule.
const REVEAL_TRANSITION = { duration: 0.7, ease: [0.22, 1, 0.36, 1] };

// framer-motion's whileInView prop didn't reliably fire in testing (elements
// sometimes stayed stuck at their initial state after a reload+scroll), so
// this drives the reveal off a plain native IntersectionObserver instead.
function useInViewOnce(amount = 0.2) {
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

function Reveal({ children, className = "", style, delay = 0, y = 28 }) {
  const [ref, inView] = useInViewOnce(0.2);
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ ...REVEAL_TRANSITION, delay }}
    >
      {children}
    </motion.div>
  );
}

function CardElevated({ T, className = "", accentBorder = false, children }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={`group rounded-2xl transition-all duration-300 ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hover ? T.cardHoverBorder : accentBorder ? T.cardHoverBorder : T.cardBorder}`,
        background: T.cardBg,
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hover
          ? `inset 0 1px 0 rgba(255,255,255,0.07), 0 24px 44px -20px rgba(0,0,0,0.3), 0 0 0 1px ${T.cardHoverBorder}`
          : `inset 0 1px 0 rgba(255,255,255,${accentBorder ? "0.06" : "0.05"}), 0 16px 36px -20px rgba(0,0,0,0.2)`,
      }}
    >
      {children}
    </div>
  );
}

// Mouse-follow 3D tilt for the hero's floating card — subtle, spring-damped,
// resets on pointer leave. This is the "alive" interaction both reference
// sites lean on (veilpass-stellar's stacked card, shuntapp's glow-follow).
function TiltCard({ children, className = "" }) {
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const springRx = useSpring(rx, { stiffness: 150, damping: 18 });
  const springRy = useSpring(ry, { stiffness: 150, damping: 18 });

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * 8);
    rx.set(py * -8);
  };
  const handleLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: springRx, rotateY: springRy, transformPerspective: 900 }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </motion.div>
  );
}

// Persistent condensed CTA that slides in below the header once the hero has
// scrolled past — same pattern as a sticky job-search bar: the primary action
// stays reachable without following the user down the whole page.
function StickyCTA({ T, dark }) {
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setShow(y > 680));

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 top-[64px] z-30 border-b backdrop-blur-xl"
          style={{ borderColor: T.cardBorder, background: dark ? "rgba(9,11,16,0.88)" : "rgba(247,249,246,0.92)" }}
        >
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 py-2.5 sm:px-8 md:px-16 lg:px-24">
            <span className="truncate text-[13px] font-semibold" style={{ color: T.ink }}>Got a client brief to check before you quote?</span>
            <a
              href="#brief-input"
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-[7px] text-[12.5px] font-bold transition-transform hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: T.gradPrimary, color: T.btnPrimaryText }}
            >
              Analyze my brief <ArrowRight size={13} />
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// framer-motion's whileInView + IntersectionObserver didn't reliably re-fire
// on scroll-back-up in testing, so the hero reveal instead watches raw
// scrollY (the same mechanism StickyCTA already uses) and bumps a React key
// once the user leaves the hero and returns to the top — a key change forces
// a real remount, which replays the initial -> animate sequence every time.
function useReplayOnReturnToTop(awayThreshold = 400, backThreshold = 80) {
  const { scrollY } = useScroll();
  const [replayKey, setReplayKey] = useState(0);
  const wasAway = useRef(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    if (y > awayThreshold) wasAway.current = true;
    else if (y < backThreshold && wasAway.current) {
      wasAway.current = false;
      setReplayKey((k) => k + 1);
    }
  });
  return replayKey;
}

// Replays the diagonal clip-path wipe whenever `replayKey` changes, without
// ever unmounting `children` — a plain `key`-driven remount would reset
// BriefInputBox's internal state (typed text, redaction preview) every time
// the user scrolls away from the hero and back, which is a real data-loss
// bug, not just a visual one.
function ClipReveal({ replayKey, className = "", children }) {
  const [revealed, setRevealed] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const t = setTimeout(() => setRevealed(true), 30);
      return () => clearTimeout(t);
    }
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 30);
    return () => clearTimeout(t);
  }, [replayKey]);

  return (
    <motion.div
      className={className}
      animate={{ clipPath: revealed ? "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" : "polygon(0% 0%, -12% 0%, 12% 100%, 0% 100%)" }}
      transition={{ ...REVEAL_TRANSITION, delay: revealed ? 0.15 : 0 }}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const [seed, setSeed] = useState(null);
  const heroReplayKey = useReplayOnReturnToTop();
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    client.get("/demo/seed").then((r) => setSeed(r.data)).catch(() => { });
  }, []);

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

  const CMP_ROWS = [
    { label: "Final price", client: true, workspace: true },
    { label: "Deliverables & timeline", client: true, workspace: true },
    { label: "Revision limit", client: true, workspace: true },
    { label: "Your hourly rate", client: false, workspace: true, highlight: true },
    { label: "Cost profile & overhead", client: false, workspace: true, highlight: true },
    { label: "Target margin %", client: false, workspace: true, highlight: true },
  ];

  return (
    <Shell dark={dark} onToggleDark={toggleDark}>
      <SEO
        title="Baseline before yes"
        description="AI pre-deal critique and pricing workflow for Indonesian freelancers before they say yes. Find what's unclear, understand why it matters, and get transparent effort and price-floor estimates on calibrated work types."
        canonical="/"
      />
      <div className="relative overflow-hidden selection:bg-emerald-500 selection:text-white" style={{ background: T.pageBg, color: T.ink }}>
        <StickyCTA T={T} dark={dark} />
        {/* The canvas was authored at a fixed 1440px artboard width — every
            section's padding/max-width assumes that boundary. Without this
            wrapper, wide monitors stretch the gaps between padding-anchored
            headings and mx-auto-centered grids apart from each other. */}
        <div className="relative mx-auto max-w-[1440px]">
        <HeroBackdrop T={T} dark={dark} />

        {/* ================= HERO (asymmetric) ================= */}
        <section className="relative z-10 px-5 pt-14 pb-4 sm:px-8 md:px-16 lg:px-24">
          <motion.div
            className="max-w-[640px]"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={REVEAL_TRANSITION}
          >
            <div className="relative inline-block">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-[7px] text-xs font-bold"
                style={{ border: `1px solid ${T.badgeBorder}`, background: T.badgeBg, color: T.badgeText, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
              >
                <Sparkles size={13} />
                AI Pre-Deal Decision System
              </div>
              <span className="hand sticker absolute left-[104%] -top-3.5 hidden whitespace-nowrap text-[15px] sm:inline-block" style={{ "--r": "-7deg", color: T.hand }}>
                for video creators &#8599;
              </span>
            </div>

            <h1 className="mt-6 text-[44px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-[74px] lg:leading-[1.04] lg:tracking-[-0.045em]" style={{ color: T.ink }}>
              Baseline before yes.
            </h1>
            <div className="relative inline-block">
              <span
                key={dark ? "grad-dark" : "grad-light"}
                className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-[74px] lg:leading-[1.04] lg:tracking-[-0.045em]"
                style={{ background: T.gradText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
              >
                Critique the brief first.
              </span>
              <svg width="420" height="26" viewBox="0 0 420 26" className="pointer-events-none absolute left-0.5 -bottom-3 hidden w-[80%] max-w-[420px] sm:block">
                <path d="M4,14 C70,3 140,20 210,10 C280,1 350,18 414,8" stroke={T.accent} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.85" />
              </svg>
            </div>

            <p className="mt-8 max-w-[480px] text-[16px] leading-relaxed sm:text-[17.5px]" style={{ color: T.inkSoft }}>
              Find what is unclear, understand why it matters, and ask the right questions before quoting. Calibrated work types also get transparent effort and price-floor estimates.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/judge"
                className="inline-flex items-center gap-2 rounded-[13px] px-[26px] py-[15px] text-[14.5px] font-bold transition-all hover:scale-[1.02] active:scale-[0.97]"
                style={{ background: T.gradPrimary, color: T.btnPrimaryText, boxShadow: T.btnPrimaryShadow }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.gradPrimaryHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = T.gradPrimary)}
                data-testid="cta-judge-mode"
              >
                <PlayCircle size={16} /> Try the 90-second demo
              </Link>
              <a
                href="#brief-input"
                className="inline-flex items-center gap-2 rounded-[13px] px-[26px] py-[15px] text-[14.5px] font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.97]"
                style={{ background: T.btnSecondaryBg, border: `1px solid ${T.btnSecondaryBorder}`, color: T.ink }}
                data-testid="cta-analyze"
              >
                Analyze my brief
              </a>
            </div>

            <p className="mono mt-6 text-xs" style={{ color: T.inkFaint }}>
              Your rate, cost, and margin never appear in a client-facing link
            </p>
          </motion.div>

          {/* Floating AI Scope Extraction card — overlaps the hero on desktop, stacks below on mobile */}
          <motion.div
            id="brief-input"
            className="relative z-20 mt-10 max-w-[600px] scroll-mt-24 text-left lg:-mt-[210px] lg:ml-auto"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...REVEAL_TRANSITION, delay: 0.15 }}
          >
            <div className="pointer-events-none absolute -inset-x-5 -bottom-6 -top-3.5 -z-10 rounded-[20px] blur-[20px]" style={{ background: `radial-gradient(60% 100% at 60% 10%, ${dark ? "rgba(16,185,129,0.18)" : "rgba(15,90,64,0.14)"}, transparent 70%)` }} />

            <div
              className="sticker absolute -right-3 -top-5 z-30 hidden items-center gap-1.5 rounded-xl px-3.5 py-2 sm:flex"
              style={{ "--r": "5deg", background: T.stickerChipBg, border: `1px solid ${T.stickerChipAccentBorder}`, boxShadow: "0 12px 24px -8px rgba(0,0,0,0.25)" }}
            >
              <Check size={13} style={{ color: T.checkColor }} />
              <span className="text-[11.5px] font-bold" style={{ color: T.stickerChipText }}>Redacted before AI sees it</span>
            </div>
            <div
              className="sticker absolute -left-8 bottom-9 z-30 hidden rounded-xl px-3.5 py-2.5 sm:block"
              style={{ "--r": "-8deg", background: T.stickerChipBg, border: `1px solid ${T.stickerChipBorder}`, boxShadow: "0 12px 24px -8px rgba(0,0,0,0.25)" }}
            >
              <span className="mono text-base font-bold" style={{ color: T.stickerChipText }}>IDR <span style={{ color: T.checkColor }}>{seed ? idrCompact(seed.price.price_floor_low).replace("IDR ", "") : "5.5M"}</span></span>
              <div className="mt-0.5 text-[9.5px]" style={{ color: T.inkFaint }}>price floor</div>
            </div>

            <ClipReveal replayKey={heroReplayKey} className="rounded-2xl">
              <TiltCard>
                <BriefInputBox />
              </TiltCard>
            </ClipReveal>
          </motion.div>
        </section>
        <div className="h-16 lg:h-40" />

        {/* ================= COMPARISON ================= */}
        <section id="compare" className="relative z-10 px-5 py-20 sm:px-8 md:px-16 lg:px-24 lg:py-28">
          <svg width="700" height="700" viewBox="-100 -100 200 200" className="pointer-events-none absolute -left-44 top-10 hidden blur-[6px] lg:block" style={{ opacity: dark ? 0.1 : 0.06 }}>
            <path fill={T.blob1} d="M45.3,-58.5C58.4,-49.7,68.2,-35.6,71.9,-19.9C75.6,-4.2,73.2,13,65.6,27.3C58,41.6,45.2,52.9,30.6,60.6C16,68.3,-0.4,72.4,-16.6,69.8C-32.8,67.2,-48.8,57.9,-59.6,44.5C-70.4,31.1,-76,13.6,-74.9,-3.4C-73.8,-20.4,-66,-36.9,-53.7,-46.6C-41.4,-56.3,-24.6,-59.2,-8.4,-60.9C7.8,-62.6,32.2,-67.3,45.3,-58.5Z" />
          </svg>

          <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <Reveal className="lg:sticky lg:top-24 lg:self-start">
              <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: T.accent }}>Private by Architecture</span>
              <h2 className="mt-3.5 text-[28px] font-extrabold leading-[1.16] tracking-[-0.03em] sm:text-[38px]" style={{ color: T.ink }}>
                Two links. Two completely different views.
              </h2>
              <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: T.inkSoft }}>
                The Agreement Sheet you send a client and the Workspace you use yourself show different things — on purpose.
              </p>
              <div className="sticker mt-6 inline-flex items-center gap-2 rounded-xl px-[15px] py-[9px]" style={{ "--r": "-4deg", background: dark ? "rgba(251,191,36,0.08)" : "rgba(180,83,9,0.08)", border: `1px solid ${dark ? "rgba(251,191,36,0.25)" : "rgba(180,83,9,0.25)"}` }}>
                <FileText size={14} style={{ color: T.hand }} />
                <span className="hand text-lg" style={{ color: T.hand }}>never leaves your side &rarr;</span>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
            <CardElevated T={T} className="overflow-hidden !rounded-[20px]">
              <div className="grid grid-cols-[1fr_100px_100px] sm:grid-cols-[1fr_180px_180px]" style={{ borderBottom: `1px solid ${T.cmpHeaderBorder}`, background: T.cmpHeaderBg }}>
                <div className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider sm:px-5" style={{ color: T.cmpLabel }}>What&rsquo;s visible</div>
                <div className="px-2 py-4 text-center text-[13px] font-bold" style={{ borderLeft: `1px solid ${T.cmpColBorder}`, color: T.cmpClient }}>Client link</div>
                <div className="px-2 py-4 text-center text-[13px] font-bold" style={{ borderLeft: `1px solid ${T.cmpColBorder}`, color: T.cmpWorkspace }}>Workspace</div>
              </div>
              {CMP_ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1fr_100px_100px] sm:grid-cols-[1fr_180px_180px]"
                  style={{
                    borderBottom: i < CMP_ROWS.length - 1 ? `1px solid ${T.cmpRowBorder}` : "none",
                    background: row.highlight ? T.cmpRowHighlightBg : "transparent",
                  }}
                >
                  <div className="px-4 py-3.5 text-[13.5px] sm:px-5" style={{ color: row.highlight ? T.ink : T.cmpRowText, fontWeight: row.highlight ? 600 : 400 }}>{row.label}</div>
                  <div className="flex items-center justify-center py-3.5" style={{ borderLeft: `1px solid ${T.cmpRowBorder}` }}>
                    {row.client ? <Check size={16} style={{ color: T.checkColor }} strokeWidth={2.5} /> : <X size={16} style={{ color: T.xColor }} strokeWidth={2.5} />}
                  </div>
                  <div className="flex items-center justify-center py-3.5" style={{ borderLeft: `1px solid ${T.cmpRowBorder}` }}>
                    {row.workspace ? <Check size={16} style={{ color: T.checkColor }} strokeWidth={2.5} /> : <X size={16} style={{ color: T.xColor }} strokeWidth={2.5} />}
                  </div>
                </div>
              ))}
            </CardElevated>
            </Reveal>
          </div>
        </section>

        {/* ================= BENTO FEATURES (staggered) ================= */}
        <section className="relative z-10 px-5 py-16 sm:px-8 md:px-16 lg:px-24 lg:py-20">
          <Reveal className="max-w-[640px]">
            <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: T.accent }}>Engineered for Freelancers</span>
            <h2 className="mt-3.5 text-[28px] font-extrabold leading-[1.18] tracking-[-0.03em] sm:text-[38px]" style={{ color: T.ink }}>
              The output is a decision, not a vague quote.
            </h2>
          </Reveal>

          <div className="mx-auto mt-12 grid max-w-[1180px] grid-cols-1 gap-5 md:grid-cols-12">
            {/* card 1 span 8 */}
            <Reveal className="md:col-span-8">
            <CardElevated T={T} className="p-7 sm:p-8 rounded-[20px]">
              <div className="mb-3.5 flex items-center gap-3">
                <div className="flex h-9.5 w-9.5 items-center justify-center rounded-xl grayscale-[0.85] saturate-[0.25] transition-[filter] duration-300 group-hover:grayscale-0 group-hover:saturate-100" style={{ background: T.iconChipBg, border: `1px solid ${T.iconChipBorder}` }}>
                  <Layers size={18} style={{ color: T.iconColor }} />
                </div>
                <h3 className="text-[19px] font-bold tracking-[-0.01em]" style={{ color: T.ink }}>Hidden Work Becomes Explicit</h3>
              </div>
              <p className="mb-5 max-w-[520px] text-[13.5px] leading-relaxed" style={{ color: T.inkSoft }}>
                Most video projects lose money on unpriced variables: messy footage, audio cleanup, endless reviews. Baseline forces these into hard constraints.
              </p>
              <div className="grid grid-cols-1 gap-2.5 rounded-[14px] p-4 sm:grid-cols-2" style={{ border: `1px solid ${T.blackBoxBorder}`, background: T.blackBoxBg }}>
                <div className="flex items-center justify-between pb-2 text-xs" style={{ borderBottom: `1px solid ${T.cmpRowBorder}`, color: T.cmpRowText }}>Deliverable quantity <span className="mono rounded px-1.5 py-0.5 text-[10.5px]" style={{ background: dark ? "rgba(16,185,129,0.18)" : "rgba(15,90,64,0.14)", color: T.checkColor }}>12 Reels</span></div>
                <div className="flex items-center justify-between pb-2 text-xs sm:border-b-0" style={{ borderBottom: `1px solid ${T.cmpRowBorder}`, color: T.cmpRowText }}>Sound &amp; foley design <span className="mono rounded px-1.5 py-0.5 text-[10.5px]" style={{ background: dark ? "rgba(16,185,129,0.18)" : "rgba(15,90,64,0.14)", color: T.checkColor }}>Included</span></div>
                <div className="flex items-center justify-between text-xs" style={{ color: T.cmpRowText }}>Source footage quality <span className="mono rounded px-1.5 py-0.5 text-[10.5px]" style={{ background: dark ? "rgba(245,158,11,0.18)" : "rgba(180,83,9,0.14)", color: T.amberTipText }}>Assumed raw</span></div>
                <div className="flex items-center justify-between text-xs" style={{ color: T.cmpRowText }}>Revision threshold <span className="mono rounded px-1.5 py-0.5 text-[10.5px]" style={{ background: dark ? "rgba(244,63,94,0.18)" : "rgba(220,38,38,0.12)", color: T.xColor }}>2 rounds</span></div>
              </div>
            </CardElevated>
            </Reveal>

            {/* card 2 span 4, nudged down for stagger */}
            <Reveal className="md:col-span-4 md:mt-8" delay={0.08}>
            <CardElevated T={T} className="flex flex-col justify-between p-7 sm:p-8 rounded-[20px]">
              <div>
                <div className="mb-3.5 flex items-center gap-3">
                  <div className="flex h-9.5 w-9.5 items-center justify-center rounded-xl grayscale-[0.85] saturate-[0.25] transition-[filter] duration-300 group-hover:grayscale-0 group-hover:saturate-100" style={{ background: T.iconChipBg, border: `1px solid ${T.iconChipBorder}` }}>
                    <Calculator size={18} style={{ color: T.iconColor }} />
                  </div>
                  <h3 className="text-[19px] font-bold tracking-[-0.01em]" style={{ color: T.ink }}>Deterministic Math</h3>
                </div>
                <p className="text-[13.5px] leading-relaxed" style={{ color: T.inkSoft }}>No LLM guessing. Your price floor is derived from operating overhead and target rate.</p>
              </div>
              <div className="mt-5 rounded-[14px] p-4 text-center" style={{ border: `1px solid ${T.floorBoxBorder}`, background: T.floorBoxBg }}>
                <span className="mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: T.accent }}>Formula-derived floor</span>
                <div className="mono mt-1 text-[28px] font-extrabold tracking-[-0.01em]" style={{ color: T.ink }}>{seed ? idrCompact(seed.price.price_floor_low) : "IDR 5.5M"}</div>
                <span className="text-[11px]" style={{ color: T.inkSoft }}>Protects your {seed ? Math.round(seed.price.target_margin * 100) : 20}% target margin</span>
              </div>
            </CardElevated>
            </Reveal>

            {/* card 3 span 4 */}
            <Reveal className="md:col-span-4" delay={0.16}>
            <CardElevated T={T} className="flex flex-col justify-between p-7 sm:p-8 rounded-[20px]">
              <div>
                <div className="mb-3.5 flex items-center gap-3">
                  <div className="flex h-9.5 w-9.5 items-center justify-center rounded-xl grayscale-[0.85] saturate-[0.25] transition-[filter] duration-300 group-hover:grayscale-0 group-hover:saturate-100" style={{ background: T.iconChipBg, border: `1px solid ${T.iconChipBorder}` }}>
                    <RotateCcw size={18} style={{ color: T.iconColor }} />
                  </div>
                  <h3 className="text-[19px] font-bold tracking-[-0.01em]" style={{ color: T.ink }}>Learns Your Pace</h3>
                </div>
                <p className="text-[13.5px] leading-relaxed" style={{ color: T.inkSoft }}>Log one past project&rsquo;s estimated vs. actual hours and future estimates adjust automatically.</p>
              </div>
              <div className="mt-5 rounded-[14px] p-3.5" style={{ border: `1px solid ${T.amberTipBorder}`, background: T.amberTipBg }}>
                <p className="text-xs" style={{ color: dark ? "#ccd1d8" : "#6b5a3a" }}>&ldquo;Wedding highlight reel&rdquo;: est. <span className="mono">18h</span> vs actual <span className="mono">24h</span></p>
                <p className="mono mt-1.5 text-[15px] font-extrabold" style={{ color: T.amberTipText }}>&times;1.33 calibration factor</p>
              </div>
            </CardElevated>
            </Reveal>

            {/* card 4 span 8, featured with sticker */}
            <Reveal className="relative md:col-span-8" delay={0.22}>
              <div className="sticker absolute right-5 -top-4 z-10 rounded-full px-3.5 py-[7px] text-[11.5px] font-extrabold" style={{ "--r": "6deg", background: T.gradPrimary, color: T.btnPrimaryText, boxShadow: "0 10px 20px -6px rgba(16,185,129,0.4)" }}>
                Most sent option
              </div>
              <CardElevated T={T} accentBorder className="p-7 sm:p-8 rounded-[20px]">
                <div className="mb-3.5 flex items-center gap-3">
                  <div className="flex h-9.5 w-9.5 items-center justify-center rounded-xl grayscale-[0.85] saturate-[0.25] transition-[filter] duration-300 group-hover:grayscale-0 group-hover:saturate-100" style={{ background: T.iconChipBg, border: `1px solid ${T.iconChipBorder}` }}>
                    <FileText size={18} style={{ color: T.iconColor }} />
                  </div>
                  <h3 className="text-[19px] font-bold tracking-[-0.01em]" style={{ color: T.ink }}>Two Bounded Options, Ready to Send</h3>
                </div>
                <p className="mb-5 max-w-[540px] text-[13.5px] leading-relaxed" style={{ color: T.inkSoft }}>
                  Never argue price without changing scope. Meet their budget with reduced scope, or charge the true floor for full scope.
                </p>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="rounded-[14px] p-4" style={{ border: `1px solid ${T.blackBoxBorder}`, background: T.blackBoxBg }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-bold" style={{ color: T.cmpRowText }}>Option A &middot; Fit Budget</span>
                      <span className="mono text-[12.5px] font-bold" style={{ color: T.checkColor }}>{seed ? idr(seed.options[0].price) : "IDR 3.0M"}</span>
                    </div>
                    <p className="mt-2.5 text-[11.5px] leading-relaxed" style={{ color: T.inkSoft }}>6 Reels &middot; 2 review rounds &middot; 10-day delivery</p>
                  </div>
                  <div className="rounded-[14px] p-4" style={{ border: `1px solid ${T.optionBBorder}`, background: T.optionBBg }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-bold" style={{ color: T.ink }}>Option B &middot; Full Floor</span>
                      <span className="mono text-[12.5px] font-bold" style={{ color: T.checkColor }}>{seed ? idr(seed.options[1].price) : "IDR 5.5M"}</span>
                    </div>
                    <p className="mt-2.5 text-[11.5px] leading-relaxed" style={{ color: T.optionBText }}>12 Reels &middot; audio mastering &middot; priority turnaround</p>
                  </div>
                </div>
              </CardElevated>
            </Reveal>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how" className="relative z-10 px-5 py-16 sm:px-8 md:px-16 lg:px-24 lg:py-20">
          <Reveal className="max-w-[560px]">
            <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: T.accent }}>From Brief to Close</span>
            <h2 className="mt-3.5 text-[28px] font-extrabold leading-[1.18] tracking-[-0.03em] sm:text-[38px]" style={{ color: T.ink }}>Three steps, one WhatsApp reply.</h2>
          </Reveal>

          <div className="relative mx-auto mt-14 grid max-w-[1180px] grid-cols-1 gap-8 md:grid-cols-3">
            <svg viewBox="0 0 1180 60" className="pointer-events-none absolute left-0 top-24 hidden w-full overflow-visible md:block">
              <path d="M 210 8 C 300 -18 480 32 590 6" stroke={T.accent} strokeWidth="2" fill="none" strokeDasharray="1 7" strokeLinecap="round" opacity="0.5" />
              <path d="M 590 6 C 700 -20 860 34 970 4" stroke={T.accent} strokeWidth="2" fill="none" strokeDasharray="1 7" strokeLinecap="round" opacity="0.5" />
            </svg>

            {[
              { n: 1, r: "-4deg", label: "Brief inbox", body: <p className="text-[11.5px] leading-relaxed" style={{ color: T.inkSoft }}>&ldquo;need 12 reels, budget 3M, done next week, revisions until it feels right...&rdquo;</p>, title: "Paste the brief", desc: "Any WhatsApp message, DM, or voice note transcript — as-is, messy included." },
              { n: 2, r: "5deg", label: null, body: (
                <>
                  <div className="mb-1.5 flex items-center justify-between text-[11px]" style={{ color: T.cmpRowText }}><span>Option A</span><span className="mono" style={{ color: T.checkColor }}>IDR 3.0M</span></div>
                  <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: T.ink }}><span>Option B</span><span className="mono" style={{ color: T.checkColor }}>IDR 5.5M</span></div>
                </>
              ), title: "Get your price floor", desc: "Two bounded options computed from your real cost profile — not a guess." },
              { n: 3, r: "-3deg", label: null, body: (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="mono text-[9.5px] uppercase" style={{ color: T.inkFaint }}>Agreement Sheet</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: T.agreementBadgeBg, color: T.agreementBadgeText }}>Waiting</span>
                  </div>
                  <div className="h-2 w-[72%] rounded" style={{ background: `linear-gradient(90deg, ${T.checkColor}, ${T.accent})`, boxShadow: `0 0 12px ${dark ? "rgba(16,185,129,0.5)" : "rgba(15,90,64,0.35)"}` }} />
                </>
              ), title: "Send & get approved", desc: "Client sees price, scope, and terms — never your rate or margin." },
            ].map((step, idx) => (
              <Reveal
                key={step.n}
                className={`relative z-[1] ${idx === 1 ? "md:mt-6" : ""}`}
                delay={idx * 0.08}
              >
                <CardElevated T={T} className="step-card p-6 rounded-[20px]">
                  <div className="sticker mb-4 flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-extrabold" style={{ "--r": step.r, background: T.gradPrimary, color: T.btnPrimaryText, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 14px -4px rgba(16,185,129,0.35)" }}>{step.n}</div>
                  <div className="mb-4 rounded-[14px] p-3.5" style={{ border: `1px solid ${T.blackBoxBorder}`, background: T.blackBoxBg }}>
                    {step.label && (
                      <div className="mono mb-2 flex items-center gap-1.5 text-[9.5px] uppercase" style={{ color: T.inkFaint }}>{step.label}</div>
                    )}
                    {step.body}
                  </div>
                  <h3 className="mb-1.5 text-base font-bold tracking-[-0.01em]" style={{ color: T.ink }}>{step.title}</h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>{step.desc}</p>
                </CardElevated>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="relative z-10 px-5 py-20 text-center sm:px-8 md:px-16 lg:px-24 lg:py-28">
          <svg width="800" height="500" viewBox="-100 -100 200 200" className="pointer-events-none absolute left-1/2 -top-10 hidden -translate-x-1/2 blur-[6px] lg:block" style={{ opacity: dark ? 0.14 : 0.08 }}>
            <path fill={T.blob1} d="M45.3,-58.5C58.4,-49.7,68.2,-35.6,71.9,-19.9C75.6,-4.2,73.2,13,65.6,27.3C58,41.6,45.2,52.9,30.6,60.6C16,68.3,-0.4,72.4,-16.6,69.8C-32.8,67.2,-48.8,57.9,-59.6,44.5C-70.4,31.1,-76,13.6,-74.9,-3.4C-73.8,-20.4,-66,-36.9,-53.7,-46.6C-41.4,-56.3,-24.6,-59.2,-8.4,-60.9C7.8,-62.6,32.2,-67.3,45.3,-58.5Z" />
          </svg>
          <Reveal className="relative mx-auto max-w-[600px]">
            <h2 className="text-[30px] font-extrabold leading-[1.2] tracking-[-0.03em] sm:text-[42px]" style={{ color: T.ink }}>Test your next client brief before you quote.</h2>
            <p className="mt-4 text-base sm:text-[16px]" style={{ color: T.inkSoft }}>Paste your brief. Protect your margin. Send the agreement.</p>
            <div className="relative mt-8 inline-block">
              <a
                href="#brief-input"
                className="inline-flex items-center gap-2 rounded-2xl px-[30px] py-4 text-[15px] font-bold transition-all hover:scale-[1.02] active:scale-[0.97]"
                style={{ background: T.gradPrimary, color: T.btnPrimaryText, boxShadow: T.btnPrimaryShadow }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.gradPrimaryHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = T.gradPrimary)}
              >
                Start your free analysis
                <ArrowRight size={16} />
              </a>
              <span className="hand sticker absolute -right-24 -top-1.5 hidden text-base sm:inline-block" style={{ "--r": "-8deg", color: T.hand }}>free, no card</span>
            </div>
          </Reveal>
        </section>
        </div>
      </div>
    </Shell>
  );
}
