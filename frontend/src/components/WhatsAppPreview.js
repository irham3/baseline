import React, { useState, useEffect } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";

const TONES = [
  { key: "warm", label: "Warm" },
  { key: "firm", label: "Firm" },
  { key: "formal", label: "Formal" },
];

export function useClipboard() {
  const [state, setState] = useState("idle"); // idle | ok | error
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setState("ok");
      } catch (e) {
        setState("error");
      }
    }
    setTimeout(() => setState("idle"), 2200);
    return state;
  };
  return { state, copy };
}

export default function WhatsAppPreview({ drafts, declineMode, declineMessage, onCopy }) {
  const [tone, setTone] = useState("warm");
  const [text, setText] = useState("");
  const { state, copy } = useClipboard();

  useEffect(() => {
    if (declineMode) setText(declineMessage || "");
    else setText(drafts?.[tone] || "");
  }, [tone, drafts, declineMode, declineMessage]);

  const handleCopy = async () => {
    await copy(text);
    if (onCopy) onCopy();
  };

  return (
    <div className="card p-5" data-testid="whatsapp-preview">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-bold text-ink">
          <MessageCircle size={16} className="text-green" />
          {declineMode ? "Polite decline draft" : "WhatsApp draft"}
        </h4>
        {!declineMode && (
          <div className="flex rounded-full border border-line bg-raised p-0.5" role="tablist">
            {TONES.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tone === t.key}
                onClick={() => setTone(t.key)}
                className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
                  tone === t.key ? "bg-green text-white" : "text-ink-soft hover:text-ink"
                }`}
                data-testid={`tone-${t.key}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <textarea
        name="whatsapp-draft"
        className="textarea min-h-[190px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="whatsapp-textarea"
        aria-label="WhatsApp message draft"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-faint">Editable. Baseline Work never sends automatically.</p>
        <button
          onClick={handleCopy}
          className="btn-primary btn-sm"
          data-testid="whatsapp-copy"
        >
          {state === "ok" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy draft</>}
        </button>
      </div>
      {state === "error" && (
        <p className="mt-2 text-[12px] font-semibold text-danger" data-testid="clipboard-error">
          Automatic copy failed. Select the text above and copy it manually.
        </p>
      )}
    </div>
  );
}
