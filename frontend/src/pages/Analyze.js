import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Eraser, Sparkles, ArrowRight, TriangleAlert } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Spinner, Badge } from "@/components/ui/primitives";
import CostProfileForm, { DEMO_COST_PROFILE } from "@/components/CostProfileForm";
import { client, apiErrorMessage, track } from "@/lib/api";
import { SEED_BRIEF } from "@/lib/seed";

export default function Analyze() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState("");
  const [costProfile, setCostProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("baseline_cost_profile");
      return saved ? JSON.parse(saved) : { ...DEMO_COST_PROFILE };
    } catch (_) {
      return { ...DEMO_COST_PROFILE };
    }
  });
  const [redactInfo, setRedactInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const persistProfile = (cp) => {
    setCostProfile(cp);
    localStorage.setItem("baseline_cost_profile", JSON.stringify(cp));
  };

  const useSample = () => {
    setBrief(SEED_BRIEF);
    setRedactInfo(null);
  };

  const redact = async () => {
    if (!brief.trim()) return;
    try {
      const { data } = await client.post("/redact", { brief });
      setBrief(data.text);
      setRedactInfo(data);
      track("brief_redacted", { total: data.total });
    } catch (_) {}
  };

  const analyze = async () => {
    setError(null);
    if (brief.trim().length < 15) {
      setError("Brief terlalu pendek. Tempel chat klien yang lebih lengkap (min. 15 karakter).");
      return;
    }
    setLoading(true);
    localStorage.setItem("baseline_cost_profile", JSON.stringify(costProfile));
    try {
      track("brief_pasted", { length: brief.length });
      const { data } = await client.post("/analyze", { brief, redact: false, use_ai: true });
      track("analysis_completed", { analysis_id: data.analysis_id });
      navigate(`/analysis/${data.analysis_id}`);
    } catch (e) {
      setError(apiErrorMessage(e.response?.data?.detail) || "Analisis gagal. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="wrap-narrow py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Analyze a client brief</h1>
        <p className="mt-1 text-ink-soft">Tempel chat klien. Baseline menemukan pekerjaan tersembunyi sebelum kamu kasih harga.</p>

        {/* Cost profile */}
        <section className="card mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink">Cost Profile</h2>
            <Badge tone="neutral">Sekali isi</Badge>
          </div>
          <CostProfileForm value={costProfile} onChange={persistProfile} />
        </section>

        {/* Brief input */}
        <section className="card mt-5 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold text-ink">Client brief</h2>
            <button onClick={useSample} className="btn-ghost btn-sm" data-testid="use-sample">
              <Sparkles size={14} /> Pakai contoh
            </button>
          </div>

          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber/30 bg-amber-soft/60 p-3 text-[13px] text-amber">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <span>Hapus data sensitif sebelum menempel. Nomor telepon & email bisa diredaksi otomatis.</span>
          </div>

          <textarea
            className="textarea min-h-[150px]"
            placeholder="Contoh: “Kak mau edit 12 reels buat campaign bulan depan. Footage nanti aku kirim. Budget 3 juta ya…”"
            value={brief}
            onChange={(e) => { setBrief(e.target.value); setError(null); }}
            data-testid="brief-input"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button onClick={redact} className="btn-secondary btn-sm" data-testid="redact-btn">
              <Eraser size={14} /> Redact nama & nomor
            </button>
            {redactInfo && (
              <span className="text-[12px] font-medium text-green-strong" data-testid="redact-info">
                {redactInfo.total > 0 ? `${redactInfo.total} data sensitif diredaksi.` : "Tidak ada PII terdeteksi."}
              </span>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft/60 p-3 text-[13px] text-danger" data-testid="analyze-error">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <p>{error}</p>
                {error.toLowerCase().includes("ai") && (
                  <a href="/judge" className="mt-1 inline-block font-semibold underline">Coba contoh demo yang selalu tersedia →</a>
                )}
              </div>
            </div>
          )}

          <button onClick={analyze} disabled={loading} className="btn-primary btn-lg mt-4 w-full" data-testid="analyze-submit">
            {loading ? <><Spinner size={18} /> Menganalisis brief…</> : <>Analyze brief <ArrowRight size={18} /></>}
          </button>
        </section>
      </div>
    </Shell>
  );
}
