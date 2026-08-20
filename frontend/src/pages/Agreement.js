import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Clock, Film, RefreshCw, CalendarClock, TriangleAlert, MessageSquare } from "lucide-react";
import { Logo } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { Spinner, Badge } from "@/components/ui/primitives";
import { client, apiErrorMessage, track } from "@/lib/api";
import { idr, revisionPhrase } from "@/lib/format";

const STATUS = {
  SENT: { tone: "neutral", label: "Waiting for response" },
  APPROVED: { tone: "green", label: "Approved" },
  CHANGE_REQUESTED: { tone: "amber", label: "Changes requested" },
  EXPIRED: { tone: "danger", label: "Expired" },
};

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={17} className="mt-0.5 shrink-0 text-green" />
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-ink-faint">{label}</div>
        <div className="text-[15px] font-semibold text-ink">{value}</div>
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
  const answered = done || data.status === "APPROVED" || data.status === "CHANGE_REQUESTED";

  return (
    <div className="min-h-screen bg-page">
      <SEO
        title={`Scope Agreement: ${s.project_title || "Deal Summary"}`}
        description="Pre-deal scope agreement sheet detailing offer price, deliverables, revision terms, and timeline."
        canonical={`/agreement/${token}`}
        noIndex={true}
      />
      <header className="border-b border-line/80 bg-page/85 backdrop-blur">
        <div className="wrap-narrow flex h-16 items-center justify-between">
          <Logo />
          <Badge tone={status.tone} data-testid="agreement-status">{status.label}</Badge>
        </div>
      </header>

      <main className="wrap-narrow py-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
        >
          <p className="text-xs font-bold text-green">Agreement Sheet</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink" data-testid="agreement-title">{s.project_title}</h1>
          {s.is_demo && <Badge tone="amber" className="mt-2">Demo data</Badge>}

          <div className="card mt-5 p-5">
            <div className="text-center">
              <div className="text-[12px] font-medium text-ink-faint">Offer price</div>
              <div className="text-[34px] font-extrabold text-green-strong" data-testid="agreement-price">{idr(s.price)}</div>
            </div>

            <div className="mt-4 divide-y divide-line border-t border-line">
              <Row icon={Film} label="Deliverables" value={<ul className="list-disc space-y-0.5 pl-4">{s.deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul>} />
              <Row icon={Clock} label="Timeline" value={`About ${s.timeline_days} working days after all assets are complete`} />
              <Row icon={RefreshCw} label="Revisions" value={`${revisionPhrase(s.revision_rounds, true)} (one feedback batch per round)`} />
              {s.conditions?.length > 0 && (
                <Row icon={CalendarClock} label="Start conditions" value={<ul className="list-disc space-y-0.5 pl-4">{s.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>} />
              )}
            </div>

            {s.exclusions?.length > 0 && (
              <div className="mt-4 rounded-xl bg-raised p-3.5">
                <div className="text-[12px] font-bold text-ink-faint">Out of scope</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-ink-soft">
                  {s.exclusions.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          {answered ? (
            <div className="card mt-5 flex items-center gap-3 p-5" data-testid="agreement-answered">
              <CheckCircle2 className="text-green" size={22} />
              <p className="font-semibold text-ink">
                {data.status === "APPROVED" ? "Thank you. This offer has been approved." : "Your change request has been sent. The freelancer will contact you."}
              </p>
            </div>
          ) : expired ? (
            <div className="card mt-5 p-5 text-center text-ink-soft" data-testid="agreement-expired">This offer has expired. Contact the freelancer for a new offer.</div>
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
              <div className="grid gap-3 sm:grid-cols-3">
                <button onClick={() => respond("approve")} disabled={sending} className="btn-primary btn-md" data-testid="agreement-approve">
                  {sending ? <Spinner size={16} /> : "Approve"}
                </button>
                <button onClick={() => (showNote === "request_changes" ? respond("request_changes") : setShowNote("request_changes"))} disabled={sending} className="btn-secondary btn-md" data-testid="agreement-change">
                  Request changes
                </button>
                <button onClick={() => (showNote === "ask_question" ? respond("ask_question") : setShowNote("ask_question"))} disabled={sending} className="btn-secondary btn-md" data-testid="agreement-ask">
                  <MessageSquare size={15} /> Ask a question
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-[12px] leading-relaxed text-ink-faint">
            This Agreement Sheet documents scope. It is not a legal contract or legal advice.
            Valid until {new Date(data.expires_at).toLocaleDateString("en-US")}.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
