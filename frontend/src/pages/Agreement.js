import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Film, RefreshCw, CalendarClock, TriangleAlert, MessageSquare } from "lucide-react";
import { Logo } from "@/components/Shell";
import { Spinner, Badge } from "@/components/ui/primitives";
import { client, apiErrorMessage, track } from "@/lib/api";
import { idr } from "@/lib/format";

const STATUS = {
  SENT: { tone: "neutral", label: "Menunggu respons" },
  APPROVED: { tone: "green", label: "Disetujui" },
  CHANGE_REQUESTED: { tone: "amber", label: "Minta perubahan" },
  EXPIRED: { tone: "danger", label: "Kedaluwarsa" },
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

  const load = () => {
    client
      .get(`/agreement/${token}`)
      .then((r) => { setData(r.data); track("agreement_viewed", { token }); })
      .catch((e) => setErr(apiErrorMessage(e.response?.data?.detail) || "Lembar Sepakat tidak ditemukan."));
  };

  useEffect(load, [token]);

  const respond = async (action) => {
    setSending(true);
    try {
      await client.post(`/agreement/${token}/respond`, { action, message: note || null });
      setDone(action);
      if (action === "setuju") track("agreement_approved", { token });
      if (action === "minta_perubahan") track("agreement_change_requested", { token });
      load();
    } catch (e) {
      setErr(apiErrorMessage(e.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  if (err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-page bg-grain px-6 text-center">
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
    <div className="min-h-screen bg-page bg-grain">
      <header className="border-b border-line/80 bg-page/85 backdrop-blur">
        <div className="wrap-narrow flex h-16 items-center justify-between">
          <Logo />
          <Badge tone={status.tone} data-testid="agreement-status">{status.label}</Badge>
        </div>
      </header>

      <main className="wrap-narrow py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="eyebrow">Lembar Sepakat</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink" data-testid="agreement-title">{s.project_title}</h1>
          {s.is_demo && <Badge tone="amber" className="mt-2">Ilustrasi demo</Badge>}

          <div className="card mt-5 p-5">
            <div className="text-center">
              <div className="text-[12px] font-medium text-ink-faint">Harga penawaran</div>
              <div className="text-[34px] font-extrabold tracking-tight text-green-strong" data-testid="agreement-price">{idr(s.price)}</div>
            </div>

            <div className="mt-4 divide-y divide-line border-t border-line">
              <Row icon={Film} label="Deliverables" value={<ul className="space-y-0.5">{s.deliverables.map((d, i) => <li key={i}>• {d}</li>)}</ul>} />
              <Row icon={Clock} label="Timeline" value={`± ${s.timeline_days} hari kerja setelah semua aset lengkap`} />
              <Row icon={RefreshCw} label="Revisi" value={`${s.revision_rounds} putaran terkonsolidasi (satu kumpulan feedback per putaran)`} />
              {s.conditions?.length > 0 && (
                <Row icon={CalendarClock} label="Syarat mulai" value={<ul className="space-y-0.5">{s.conditions.map((c, i) => <li key={i}>• {c}</li>)}</ul>} />
              )}
            </div>

            {s.exclusions?.length > 0 && (
              <div className="mt-4 rounded-xl bg-raised p-3.5">
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Di luar scope</div>
                <ul className="mt-1 space-y-0.5 text-[13px] text-ink-soft">
                  {s.exclusions.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          {answered ? (
            <div className="card mt-5 flex items-center gap-3 p-5" data-testid="agreement-answered">
              <CheckCircle2 className="text-green" size={22} />
              <p className="font-semibold text-ink">
                {data.status === "APPROVED" ? "Terima kasih! Penawaran ini sudah kamu setujui." : "Permintaan perubahan sudah terkirim. Freelancer akan menghubungi kamu."}
              </p>
            </div>
          ) : expired ? (
            <div className="card mt-5 p-5 text-center text-ink-soft" data-testid="agreement-expired">Penawaran ini sudah kedaluwarsa. Hubungi freelancer untuk penawaran baru.</div>
          ) : (
            <div className="mt-5" data-testid="agreement-actions">
              {showNote && (
                <textarea
                  className="textarea mb-3 min-h-[90px]"
                  placeholder={showNote === "minta_perubahan" ? "Bagian mana yang ingin diubah?" : "Apa yang ingin ditanyakan?"}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  data-testid="agreement-note"
                />
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <button onClick={() => respond("setuju")} disabled={sending} className="btn-primary btn-md" data-testid="agreement-approve">
                  {sending ? <Spinner size={16} /> : "Setuju"}
                </button>
                <button onClick={() => (showNote === "minta_perubahan" ? respond("minta_perubahan") : setShowNote("minta_perubahan"))} className="btn-secondary btn-md" data-testid="agreement-change">
                  Minta perubahan
                </button>
                <button onClick={() => (showNote === "tanyakan_detail" ? respond("tanyakan_detail") : setShowNote("tanyakan_detail"))} className="btn-secondary btn-md" data-testid="agreement-ask">
                  <MessageSquare size={15} /> Tanyakan detail
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-[12px] leading-relaxed text-ink-faint">
            Lembar Sepakat ini adalah dokumentasi scope, bukan kontrak hukum atau nasihat hukum.
            Berlaku sampai {new Date(data.expires_at).toLocaleDateString("id-ID")}.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
