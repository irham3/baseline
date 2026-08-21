import React from "react";
import { motion } from "framer-motion";
import { TriangleAlert, Info, CircleCheck, Quote } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

const READINESS = {
  not_ready_to_quote: {
    label: "Not ready to quote",
    tone: "danger",
    Icon: TriangleAlert,
    copy: "Resolve the issues below before you commit to scope, price, or a deadline.",
  },
  ready_scope_only: {
    label: "Ready for scope baseline",
    tone: "amber",
    Icon: Info,
    copy: "Deep estimation isn't supported for this project type yet, but the scope below is clear enough to send a reply.",
  },
  ready_to_estimate: {
    label: "Now we can estimate it",
    tone: "green",
    Icon: CircleCheck,
    copy: "The scope is clear enough to compute an hour range and price floor from your cost profile.",
  },
};

const CATEGORY_LABEL = {
  revision_boundary: "Revision boundary",
  deliverable_clarity: "Deliverable clarity",
  acceptance_clarity: "Acceptance clarity",
  input_responsibility: "Input responsibility",
  timeline: "Timeline",
  approval_flow: "Approval flow",
  change_boundary: "Change boundary",
  commercial_clarity: "Commercial clarity",
};

export default function BriefCritique({ readinessState, issues }) {
  const readiness = READINESS[readinessState] || READINESS.not_ready_to_quote;
  const sorted = [...(issues || [])].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));

  return (
    <div data-testid="brief-critique">
      <motion.div
        key={readinessState}
        className={`card flex items-start gap-3 p-4 ${readiness.tone === "danger" ? "border-danger/30" : readiness.tone === "green" ? "border-green/30" : "border-amber/30"}`}
        data-testid="readiness-banner"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <readiness.Icon size={20} className={readiness.tone === "danger" ? "text-danger" : readiness.tone === "green" ? "text-green" : "text-amber"} />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-ink">{readiness.label}</h3>
            <Badge tone={readiness.tone}>{sorted.length} issue{sorted.length === 1 ? "" : "s"}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">{readiness.copy}</p>
        </div>
      </motion.div>

      {sorted.length > 0 && (
        <ul className="mt-3 space-y-2.5" data-testid="critique-cards">
          {sorted.map((issue, i) => (
            <motion.li
              key={issue.rule_id}
              className="card p-4"
              data-testid={`issue-${issue.rule_id}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-bold text-ink">{issue.title}</h4>
                <Badge tone={issue.severity === "high" ? "danger" : "amber"}>
                  {issue.severity === "high" ? "High impact" : "Medium impact"}
                </Badge>
              </div>

              <div className="mt-2 flex items-start gap-2 text-[13px]">
                <Quote size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                {issue.evidence ? (
                  <span className="italic text-ink-soft">&ldquo;{issue.evidence}&rdquo;</span>
                ) : (
                  <span className="text-ink-faint">Not stated in the brief</span>
                )}
              </div>

              <p className="mt-2 text-[13px] text-ink-soft"><span className="font-semibold text-ink">Why it matters — </span>{issue.why_it_matters}</p>

              <span className="mt-2.5 inline-block rounded-full bg-raised px-2.5 py-0.5 text-[11px] font-semibold text-ink-faint">
                {CATEGORY_LABEL[issue.rule_category] || issue.rule_category}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
