import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Clock, Film, RefreshCw, CalendarClock, TriangleAlert, MessageSquare, ShieldCheck, Sun, Moon } from "lucide-react";
import { Logo } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { Spinner, Badge } from "@/components/ui/primitives";
import { client, apiErrorMessage, track } from "@/lib/api";
import { idr, revisionPhrase } from "@/lib/format";

const THEME_KEY = "baseline-landing-theme";

const STATUS = {
  SENT: { tone: "neutral", label: "Waiting for response" },
  APPROVED: { tone: "green", label: "Approved" },
  CHANGE_REQUESTED: { tone: "amber", label: "Changes requested" },
  EXPIRED: { tone: "danger", label: "Expired" },
  REVOKED: { tone: "danger", label: "Revoked" },
};

function getTheme(dark) {
  return dark
    ? {
        pageBg: "#08090d",
        ink: "#ffffff",
        inkSoft: "#9aa1ab",
        inkFaint: "#718073",
        accent: "#34d399",
        accentStrong: "#0ea371",
        blob: "#10b981",
        cardBorder: "rgba(255,255,255,0.08)",
        cardBg: "rgba(255,255,255,0.025)",
        gradApprove: "linear-gradient(180deg, #3ee0a6 0%, #0ea371 100%)",
        approveText: "#04140d",
        outlineBg: "rgba(255,255,255,0.05)",
        outlineBorder: "rgba(255,255,255,0.14)",
        raisedBg: "rgba(255,255,255,0.04)",
        pillBg: "rgba(16,185,129,0.12)",
        pillBorder: "rgba(16,185,129,0.25)",
      }
    : {
        pageBg: "#f7f9f6",
        ink: "#0f1712",
        inkSoft: "#435046",
        inkFaint: "#718073",
        accent: "#0f5a40",
        accentStrong: "#093d2b",
        blob: "#0f5a40",
        cardBorder: "#dce4d9",
        cardBg: "#ffffff",
        gradApprove: "linear-gradient(180deg, #17966e 0%, #0a4531 100%)",
        approveText: "#ffffff",
        outlineBg: "#ffffff",
        outlineBorder: "#dce4d9",
        raisedBg: "#eef3ec",
        pillBg: "#e2f2ea",
        pillBorder: "rgba(15,90,64,0.15)",
      };
}

function StatCard({ T, Icon, value, label, reduceMotion }) {
  return (
    <motion.div
      className="rounded-2xl px-2.5 py-3.5 text-center"
      style={{ borderWidth: 1, borderStyle: "solid", borderColor: T.cardBorder, background: T.cardBg }}
      whileHover={reduceMotion ? undefined : { y: -4, borderColor: T.accent, boxShadow: "0 20px 40px -20px rgba(0,0,0,0.28)" }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Icon size={18} className="mx-auto" style={{ color: T.accent }} strokeWidth={1.75} />
      <div className="mt-2 text-sm font-extrabold" style={{ color: T.ink }}>{value}</div>
      <div className="text-[10px]" style={{ color: T.inkFaint }}>{label}</div>
    </motion.div>
  );
}

function Row({ T, icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={17} className="mt-0.5 shrink-0" style={{ color: T.accent }} />
      <div className="min-w-0">
        <div className="text-[12px] font-medium" style={{ color: T.inkFaint }}>{label}</div>
        <div className="text-[15px] font-semibold" style={{ color: T.ink }}>{value}</div>
      </div>
    </div>
  );
}

export default function Agreement() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(null);
  const reduceMotion = useReducedMotion();
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark";
    } catch {
      return false;
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

  const load = useCallback(() => {
    client
      .get(`/agreement/${token}`)
      .then((r) => { setData(r.data); track("agreement_viewed", { token }); })
      .catch((e) => setErr(apiErrorMessage(e.response?.data?.detail) || "Agreement Sheet not found."));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (action) => {
    setSending(true);
    try {
      await client.post(`/agreement/${token}/respond`, { action, message: note || null });
      setDone(action);
      if (action === "approve") track("agreement_approved", { token });
      if (action === "request_changes") track("agreement_change_requested", { token });
      load();
    } catch (e) {
      setErr(apiErrorMessage(e.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  if (err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-page px-6 text-center">
        <TriangleAlert className="text-amber" size={30} />
        <p className="mt-3 max-w-sm font-semibold text-ink" data-testid="agreement-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="flex min-h-screen items-center justify-center bg-page"><Spinner size={26} /></div>;
  }

  const s = data.snapshot;
  const status = STATUS[data.status] || STATUS.SENT;
  const expired = data.status === "EXPIRED";
  const revoked = data.status === "REVOKED";
  const answered = done || data.status === "APPROVED" || data.status === "CHANGE_REQUESTED";

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: T.pageBg, color: T.ink }}>
      <SEO
        title={`Scope Agreement: ${s.project_title || "Deal Summary"}`}
        description="Pre-deal scope agreement sheet detailing offer price, deliverables, revision terms, and timeline."
        canonical={`/agreement/${token}`}
        noIndex={true}
      />
      <svg width="420" height="420" viewBox="-100 -100 200 200" className="pointer-events-none absolute -right-36 top-36 rotate-[20deg] blur-[4px]" style={{ opacity: dark ? 0.12 : 0.1 }}>
        <path fill={T.blob} d="M45.3,-58.5C58.4,-49.7,68.2,-35.6,71.9,-19.9C75.6,-4.2,73.2,13,65.6,27.3C58,41.6,45.2,52.9,30.6,60.6C16,68.3,-0.4,72.4,-16.6,69.8C-32.8,67.2,-48.8,57.9,-59.6,44.5C-70.4,31.1,-76,13.6,-74.9,-3.4C-73.8,-20.4,-66,-36.9,-53.7,-46.6C-41.4,-56.3,-24.6,-59.2,-8.4,-60.9C7.8,-62.6,32.2,-67.3,45.3,-58.5Z" />
      </svg>

      <header className="relative flex h-16 items-center justify-between border-b" style={{ borderColor: T.cardBorder }}>
        <div className="wrap-narrow flex w-full items-center justify-between">
          <Logo dark={dark} />
          <div className="flex items-center gap-2.5">
            <Badge tone={status.tone} data-testid="agreement-status">{status.label}</Badge>
            <button
              type="button"
              onClick={toggleDark}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{ border: `1px solid ${T.cardBorder}`, background: T.raisedBg, color: T.inkSoft }}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              data-testid="theme-toggle"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </header>

      <main className="wrap-narrow relative py-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
        >
          <span className="mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: T.accent }}>Agreement Sheet</span>
          <h1 className="mt-1.5 text-2xl font-extrabold" style={{ color: T.ink }} data-testid="agreement-title">{s.project_title}</h1>
          {s.is_demo && <Badge tone="amber" className="mt-2">Demo data</Badge>}

          {/* price hero */}
          <motion.div
            className="relative mt-5 rounded-[20px] px-5 py-7 text-center"
            style={{ borderWidth: 1, borderStyle: "solid", borderColor: T.cardBorder, background: T.cardBg, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 34px -20px rgba(0,0,0,0.2)" }}
            whileHover={reduceMotion ? undefined : { y: -4, borderColor: T.accent, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 46px -20px rgba(0,0,0,0.28)" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="sticker absolute left-3.5 -top-3.5 rounded-full px-2.5 py-[5px] text-[10px] font-extrabold" style={{ "--r": "-6deg", background: T.gradApprove, color: T.approveText, boxShadow: "0 8px 16px -8px rgba(15,90,64,0.35)" }}>
              deterministic, not guessed
            </div>
            <span className="text-[11.5px] font-semibold" style={{ color: T.inkFaint }}>Final price</span>
            <div className="relative inline-block">
              <div className="mono mt-1 text-[34px] font-extrabold tracking-[-0.015em]" style={{ color: T.accentStrong }} data-testid="agreement-price">{idr(s.price)}</div>
              <svg width="230" height="16" viewBox="0 0 230 16" className="pointer-events-none absolute left-1 -bottom-2">
                <path d="M3,9 C40,2 78,13 115,7 C152,1 190,12 227,6" stroke={T.accent} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.55" />
              </svg>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-[7px]" style={{ background: T.pillBg, border: `1px solid ${T.pillBorder}` }}>
              <ShieldCheck size={12} style={{ color: T.accent }} />
              <span className="text-[11.5px] font-bold" style={{ color: T.accent }}>Fixed price — no hidden costs after approval</span>
            </div>
          </motion.div>

          {/* stat row: timeline + revisions */}
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <StatCard T={T} Icon={Clock} value={`${s.timeline_days} days`} label="Timeline" reduceMotion={reduceMotion} />
            <StatCard T={T} Icon={RefreshCw} value={revisionPhrase(s.revision_rounds, true)} label="Revisions" reduceMotion={reduceMotion} />
          </div>

          <motion.div
            className="mt-3.5 rounded-2xl p-5"
            style={{ borderWidth: 1, borderStyle: "solid", borderColor: T.cardBorder, background: T.cardBg }}
            whileHover={reduceMotion ? undefined : { y: -4, borderColor: T.accent, boxShadow: "0 20px 40px -20px rgba(0,0,0,0.28)" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="divide-y" style={{ borderColor: T.cardBorder }}>
              <Row T={T} icon={Film} label="Deliverables" value={<ul className="list-disc space-y-0.5 pl-4">{s.deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul>} />
              {s.conditions?.length > 0 && (
                <Row T={T} icon={CalendarClock} label="Start conditions" value={<ul className="list-disc space-y-0.5 pl-4">{s.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>} />
              )}
            </div>

            {s.exclusions?.length > 0 && (
              <div className="mt-3 rounded-xl p-3.5" style={{ background: T.raisedBg }}>
                <div className="text-[12px] font-bold" style={{ color: T.inkFaint }}>Out of scope</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px]" style={{ color: T.inkSoft }}>
                  {s.exclusions.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </motion.div>

          {/* trust / honesty box */}
          <motion.div
            className="mt-3.5 flex gap-2.5 rounded-2xl px-4 py-3.5"
            style={{ borderWidth: 1, borderStyle: "solid", borderColor: T.cardBorder }}
            whileHover={reduceMotion ? undefined : { y: -4, borderColor: T.accent }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" style={{ color: T.inkFaint }} strokeWidth={1.75} />
            <p className="text-[11.5px] leading-relaxed" style={{ color: T.inkFaint }}>This Agreement Sheet documents scope only — not a legal contract. The freelancer&rsquo;s rate, cost, and margin are never shared through this link.</p>
          </motion.div>

          {/* Actions */}
          {answered ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl p-5" style={{ border: `1px solid ${T.cardBorder}`, background: T.cardBg }} data-testid="agreement-answered">
              <CheckCircle2 style={{ color: T.accent }} size={22} />
              <p className="font-semibold" style={{ color: T.ink }}>
                {data.status === "APPROVED"
                  ? "Thank you. This offer has been approved."
                  : done === "ask_question"
                  ? "Your question has been sent. The freelancer will get back to you."
                  : "Your change request has been sent. The freelancer will contact you."}
              </p>
            </div>
          ) : expired ? (
            <div className="mt-5 rounded-2xl p-5 text-center" style={{ border: `1px solid ${T.cardBorder}`, background: T.cardBg, color: T.inkSoft }} data-testid="agreement-expired">This offer has expired. Contact the freelancer for a new offer.</div>
          ) : revoked ? (
            <div className="mt-5 rounded-2xl p-5 text-center" style={{ border: `1px solid ${T.cardBorder}`, background: T.cardBg, color: T.inkSoft }} data-testid="agreement-revoked">This offer has been withdrawn by the freelancer. Contact them for a new offer.</div>
          ) : (
            <div className="mt-5" data-testid="agreement-actions">
              {showNote && (
                <textarea
                  name="agreement-note"
                  className="textarea mb-3 min-h-[90px]"
                  placeholder={showNote === "request_changes" ? "What needs to change?" : "What would you like to ask?"}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  data-testid="agreement-note"
                />
              )}
              <button
                onClick={() => respond("approve")}
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-extrabold transition-all disabled:opacity-60"
                style={{ background: T.gradApprove, color: T.approveText, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 16px 30px -12px rgba(15,90,64,0.3)" }}
                data-testid="agreement-approve"
              >
                {sending ? <Spinner size={16} /> : <><CheckCircle2 size={17} /> Approve this offer</>}
              </button>
              <button
                onClick={() => (showNote === "request_changes" ? respond("request_changes") : setShowNote("request_changes"))}
                disabled={sending}
                className="mt-2.5 flex w-full items-center justify-center rounded-2xl py-3.5 text-[13.5px] font-bold transition-colors"
                style={{ background: T.outlineBg, border: `1px solid ${T.outlineBorder}`, color: T.ink }}
                data-testid="agreement-change"
              >
                Request changes
              </button>
              <button
                onClick={() => (showNote === "ask_question" ? respond("ask_question") : setShowNote("ask_question"))}
                disabled={sending}
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12.5px] font-bold"
                style={{ color: T.inkFaint }}
                data-testid="agreement-ask"
              >
                <MessageSquare size={13} /> Ask a question
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-[12px] leading-relaxed" style={{ color: T.inkFaint }}>
            This Agreement Sheet documents scope. It is not a legal contract or legal advice.
            Valid until {new Date(data.expires_at).toLocaleDateString("en-US")}.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
