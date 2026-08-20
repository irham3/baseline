import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Sparkles, Eye, EyeOff } from "lucide-react";
import { client } from "@/lib/api";
import { Spinner } from "@/components/ui/primitives";

const SAMPLE_BRIEF = "Hi, I need 12 Reels for next month's campaign. I will send the footage later. Budget is IDR 3M, ideally finished next week. Revisions until it feels right.";

export default function BriefInputBox() {
  const [brief, setBrief] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [useAi, setUseAi] = useState(true);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const navigate = useNavigate();

  const updateBrief = (value) => {
    setBrief(value);
    if (preview) setPreview(null); // stale once the text changes
  };

  const handlePreviewRedaction = async () => {
    if (!brief.trim()) return;
    setPreviewLoading(true);
    try {
      const res = await client.post("/redact", { brief });
      setPreview(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not preview redaction.");
    } finally {
      setPreviewLoading(false);
    }
  };

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
      const res = await client.post("/analyze", { brief, use_ai: useAi, redact: true });
      navigate(`/analysis/${res.data.analysis_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to connect to AI engine.");
      setAnalyzing(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setBrief(SAMPLE_BRIEF);
    setAnalyzing(true);
    try {
      const res = await client.post("/analyze", {
        brief: SAMPLE_BRIEF,
        use_ai: false,
        redact: false,
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
          onChange={(e) => updateBrief(e.target.value)}
          placeholder="Paste client brief, WhatsApp chat, or voice note transcript here..."
          className="w-full min-h-[160px] bg-transparent text-zinc-200 placeholder-zinc-600 outline-none resize-none text-sm leading-relaxed"
          disabled={analyzing}
          data-testid="brief-textarea"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-zinc-400" data-testid="use-ai-toggle">
            <input
              type="checkbox"
              checked={!useAi}
              onChange={(e) => setUseAi(!e.target.checked)}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            Analyze without AI (deterministic only)
          </label>
          <button
            type="button"
            onClick={preview ? () => setPreview(null) : handlePreviewRedaction}
            disabled={!brief.trim() || previewLoading}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="preview-redaction-toggle"
          >
            {previewLoading ? (
              <><Spinner size={12} /> Checking...</>
            ) : preview ? (
              <><EyeOff size={13} /> Hide redaction preview</>
            ) : (
              <><Eye size={13} /> Preview what gets redacted</>
            )}
          </button>
        </div>

        {preview && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3" data-testid="redaction-preview">
            {preview.total > 0 ? (
              <>
                <p className="text-[11px] font-semibold text-emerald-400">
                  {preview.total} sensitive item{preview.total === 1 ? "" : "s"} will be redacted before this is sent for AI analysis:
                </p>
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-zinc-300">{preview.text}</pre>
              </>
            ) : (
              <p className="text-[11px] text-zinc-500">No emails, phone numbers, links, handles, or account numbers detected. Redaction is best-effort, not a guarantee — remove anything truly confidential yourself before submitting.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-4">
          <p className="text-[11px] text-zinc-500 max-w-sm leading-relaxed">
            {useAi
              ? "Baseline AI automatically extracts deliverable volume, hidden assumptions, requested revisions, and budget constraints. Contact details are redacted before analysis. If the AI is unavailable, a deterministic fallback extracts the same brief without it."
              : "Deterministic extraction only — no AI call is made. Coverage is more limited than AI extraction, but every value is still traceable to a quote in your brief."}
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {error && (
              <span className="text-xs font-semibold text-rose-400 mr-2" data-testid="brief-error">{error}</span>
            )}
            <button
              type="button"
              onClick={handleDemo}
              disabled={analyzing}
              className="flex-1 sm:flex-none text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors px-4 py-2"
              data-testid="brief-sample"
            >
              Run sample brief
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="group relative flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-zinc-950 shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="brief-analyze"
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
