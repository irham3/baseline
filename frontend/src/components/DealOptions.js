import React from "react";
import { Check, Clock, RefreshCw, Film, Ban } from "lucide-react";
import { idr } from "@/lib/format";

function Line({ icon: Icon, children }) {
  return (
    <li className="flex items-start gap-2 text-[13px] text-ink-soft">
      <Icon size={14} className="mt-0.5 shrink-0 text-green" />
      <span>{children}</span>
    </li>
  );
}

function OptionCard({ opt, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(opt)}
      className={`card flex flex-col p-5 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-lift ${
        selected ? "border-green ring-2 ring-green/25" : ""
      }`}
      data-testid={`option-${opt.id}`}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Opsi {opt.id}</span>
        {selected && (
          <span className="flex items-center gap-1 rounded-full bg-green px-2 py-0.5 text-[11px] font-bold text-white">
            <Check size={11} /> Dipilih
          </span>
        )}
      </div>
      <h4 className="mt-1 text-[15px] font-bold text-ink">{opt.title}</h4>
      <div className="mt-2 text-[26px] font-extrabold tracking-tight text-green-strong">{idr(opt.price)}</div>
      <ul className="mt-3 space-y-1.5">
        <Line icon={Film}>{opt.quantity} video{opt.subtitles ? " + subtitle" : ""}{opt.footage_selection_included ? " + pemilihan footage" : ""}</Line>
        <Line icon={Clock}>± {opt.timeline_days} hari kerja setelah aset lengkap</Line>
        <Line icon={RefreshCw}>{opt.revision_rounds} putaran revisi terkonsolidasi</Line>
      </ul>
      {opt.note && <p className="mt-3 rounded-lg bg-raised px-2.5 py-2 text-[12px] text-ink-faint">{opt.note}</p>}
    </button>
  );
}

export default function DealOptions({ options, selectedId, onSelect, onDecline, declineActive }) {
  return (
    <div data-testid="deal-options">
      <div className="grid gap-4 md:grid-cols-3">
        {options.map((opt) => (
          <OptionCard key={opt.id} opt={opt} selected={selectedId === opt.id} onSelect={onSelect} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-line bg-raised px-4 py-3">
        <p className="text-[13px] text-ink-faint">Tidak ingin mengambil project ini?</p>
        <button
          onClick={onDecline}
          className={`btn-sm ${declineActive ? "btn-danger" : "btn-ghost"} inline-flex items-center gap-1.5`}
          data-testid="option-decline"
        >
          <Ban size={14} /> Tolak dengan sopan
        </button>
      </div>
    </div>
  );
}
