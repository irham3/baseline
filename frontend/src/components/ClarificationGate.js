import React from "react";
import { HelpCircle, Copy, Check, Calculator } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";
import { useClipboard } from "@/components/WhatsAppPreview";

const IMPACT_LABEL = {
  time: "Waktu",
  cost: "Biaya",
  revision: "Revisi",
  dependency: "Dependency",
  acceptance: "Acceptance",
};

function Toggle({ label, value, onChange, testid }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <button
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-green" : "bg-black/15"}`}
        data-testid={testid}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix, testid, min = 0 }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="relative">
        <input
          type="number"
          className="input"
          value={value ?? ""}
          min={min}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          data-testid={testid}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">{suffix}</span>}
      </div>
    </label>
  );
}

export default function ClarificationGate({ overrides, setOverrides, questions, onRecalc, recalculating }) {
  const { state, copy } = useClipboard();
  const set = (k, v) => setOverrides((o) => ({ ...o, [k]: v }));

  const copyQuestions = () => {
    const lines = ["Halo, Kak! Sebelum saya kasih penawaran, boleh dibantu jawab ini ya:"];
    questions.forEach((q, i) => lines.push(`${i + 1}. ${q.question}`));
    lines.push("\nBiar penawarannya pas. Makasih, Kak! 🙏");
    copy(lines.join("\n"));
  };

  return (
    <div className="space-y-4" data-testid="clarification-gate">
      {questions?.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 font-bold text-ink">
              <HelpCircle size={16} className="text-amber" />
              Ask this before you quote
            </h4>
            <button onClick={copyQuestions} className="btn-secondary btn-sm" data-testid="copy-questions">
              {state === "ok" ? <><Check size={14} /> Tersalin</> : <><Copy size={14} /> Salin ke WhatsApp</>}
            </button>
          </div>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={q.id || i} className="border-l-2 border-amber/40 pl-3" data-testid={`question-${i}`}>
                <p className="text-sm font-semibold text-ink">{i + 1}. {q.question}</p>
                <p className="mt-0.5 text-[13px] text-ink-soft">
                  <span className="font-semibold text-amber">Mengapa ini memengaruhi harga: </span>
                  {q.why}
                </p>
                {q.impact?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.impact.map((im) => (
                      <span key={im} className="chip bg-amber-soft text-amber">{IMPACT_LABEL[im] || im}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card p-5">
        <h4 className="mb-1 font-bold text-ink">Jawaban &amp; asumsi</h4>
        <p className="mb-4 text-[13px] text-ink-faint">
          Isi yang kamu tahu. Yang belum jelas dibiarkan sebagai asumsi — range akan melebar.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberInput label="Jumlah video" value={overrides.quantity} onChange={(v) => set("quantity", v)} testid="ov-quantity" min={1} />
          <NumberInput label="Budget klien" value={overrides.client_budget} onChange={(v) => set("client_budget", v)} suffix="Rp" testid="ov-budget" />
          <NumberInput label="Durasi final / video" value={overrides.final_duration} onChange={(v) => set("final_duration", v)} suffix="detik" testid="ov-duration" />
          <NumberInput label="Deadline (hari kerja)" value={overrides.deadline_working_days} onChange={(v) => set("deadline_working_days", v)} suffix="hari" testid="ov-deadline" />
          <NumberInput label="Jumlah approver" value={overrides.approver_count} onChange={(v) => set("approver_count", v)} suffix="orang" testid="ov-approvers" min={1} />
          <label className="block">
            <span className="field-label">Putaran revisi</span>
            <select
              className="input"
              value={overrides.revision_rounds === null ? "unlimited" : overrides.revision_rounds ?? ""}
              onChange={(e) => set("revision_rounds", e.target.value === "unlimited" ? null : Number(e.target.value))}
              data-testid="ov-revisions"
            >
              <option value="1">1 putaran</option>
              <option value="2">2 putaran</option>
              <option value="3">3 putaran</option>
              <option value="unlimited">Tidak dibatasi</option>
            </select>
          </label>
          {!overrides.footage_preselected && (
            <NumberInput label="Volume footage mentah" value={overrides.footage_hours} onChange={(v) => set("footage_hours", v)} suffix="jam" testid="ov-footage-hours" />
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Toggle label="Footage sudah dipilih" value={overrides.footage_preselected} onChange={(v) => set("footage_preselected", v)} testid="ov-footage-preselected" />
          <Toggle label="Subtitle termasuk" value={overrides.subtitles} onChange={(v) => set("subtitles", v)} testid="ov-subtitles" />
          <Toggle label="Scripting termasuk" value={overrides.scripting} onChange={(v) => set("scripting", v)} testid="ov-scripting" />
        </div>

        <button
          onClick={onRecalc}
          disabled={recalculating}
          className="btn-primary btn-md mt-4 w-full sm:w-auto"
          data-testid="recalc-btn"
        >
          {recalculating ? <><Spinner size={16} /> Menghitung…</> : <><Calculator size={16} /> Hitung estimasi</>}
        </button>
      </div>
    </div>
  );
}
