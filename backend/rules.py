"""
Generic Deal Rule Pack: universal pre-deal critique, independent of profession.

Evaluates the fields already produced by ai_service.extract_scope /
extract_scope_heuristic (each carrying value/status/source_quote) into
evidence-backed DealIssue objects -- title, why it matters, severity, rule
category, and the source quote or "not stated in the brief". This is the
layer the product plan calls "critique before calculation": estimation is
gated on these issues, not the other way around.

Severity is a fixed property of the rule, not a model guess -- the same
trigger always produces the same severity. No score, no percentage.
"""
from __future__ import annotations

RULE_VERSION = "1.0.0"

# Only a short-form-video template exists today. Non-video briefs still get
# the Generic Deal Rule Pack (this module) but never a fabricated hour/price
# estimate -- see classify_profession() below.
SUPPORTED_PROFESSION = "short_form_video"

_VIDEO_SIGNALS = ("reel", "reels", "video", "shorts", "tiktok", "edit", "footage", "konten", "cut")
_NON_VIDEO_SIGNALS = (
    "website", "web app", "aplikasi", "toko online", "landing page", "software",
    "sistem", "dashboard", "database", "backend", "frontend", "app mobile",
)


def classify_profession(brief: str) -> dict:
    """Tentative, editable classification -- a keyword heuristic, not a trained
    classifier. Only decides whether the calibrated short-form-video estimator
    is allowed to run; it never blocks the Generic Deal Rule Pack critique."""
    text = brief.lower()
    has_video = any(sig in text for sig in _VIDEO_SIGNALS)
    has_non_video = any(sig in text for sig in _NON_VIDEO_SIGNALS)
    if has_video and not has_non_video:
        return {"profession": "short_form_video", "support_level": "calibrated_estimation"}
    return {"profession": "general", "support_level": "critique_only"}


def _field(fields: list[dict], name: str) -> dict | None:
    return next((f for f in fields if f.get("name") == name), None)


def _missing(f: dict | None) -> bool:
    return f is None or f.get("status") == "missing" or f.get("value") in (None, "")


def _evidence(f: dict | None) -> str | None:
    if f and f.get("status") == "stated" and f.get("source_quote"):
        return f["source_quote"]
    return None


def _issue(rule_id, title, why_it_matters, severity, category, evidence, affected):
    return {
        "rule_id": rule_id,
        "title": title,
        "why_it_matters": why_it_matters,
        "severity": severity,  # "high" | "medium"
        "rule_category": category,
        "evidence": evidence,  # source quote, or None meaning "not stated in the brief"
        "affected_dimensions": affected,
        "status": "open",
        "rule_version": RULE_VERSION,
    }


def _rule_revision_boundary(fields, ambiguities):
    rr = _field(fields, "revision_rounds")
    flagged = any("revision_rounds" in a.get("field_names", []) for a in ambiguities)
    if _missing(rr) or flagged:
        return _issue(
            "revision_boundary", "Revision has no ending condition",
            "Without a round limit and a definition of one round, revision work has no upper bound.",
            "high", "revision_boundary", _evidence(rr), ["effort", "cost"],
        )
    return None


def _rule_deliverable_quantity(fields):
    q = _field(fields, "quantity")
    if _missing(q):
        return _issue(
            "deliverable_quantity", "Deliverable quantity is undefined",
            "Hours and price cannot be scoped without knowing how many items to deliver.",
            "high", "deliverable_clarity", _evidence(q), ["effort", "cost"],
        )
    return None


def _rule_final_duration(fields):
    d = _field(fields, "final_duration")
    if _missing(d):
        return _issue(
            "final_duration", "Final duration per video is not stated",
            "Edit and export time scale with duration; a 15s clip and a 3-minute clip are different jobs.",
            "medium", "deliverable_clarity", _evidence(d), ["effort"],
        )
    return None


def _rule_footage_responsibility(fields):
    avail = _field(fields, "footage_available")
    preselected = _field(fields, "footage_preselected")
    if avail and not _missing(avail) and avail.get("value") and _missing(preselected):
        return _issue(
            "footage_responsibility", "Footage review responsibility is unclear",
            "Sorting raw, unselected footage can add hours the client never sees as \"editing\".",
            "medium", "input_responsibility", _evidence(avail), ["effort", "dependency"],
        )
    return None


def _rule_deadline_dependency(fields):
    dl = _field(fields, "deadline_working_days")
    avail = _field(fields, "footage_available")
    if _missing(dl):
        return _issue(
            "deadline_dependency", "Deadline start condition is undefined",
            "A date without a dependency on asset delivery means effective working time is unknown.",
            "high", "timeline", _evidence(dl), ["timeline"],
        )
    if avail and not _missing(avail) and not avail.get("value"):
        return _issue(
            "deadline_dependency", "Deadline is set before footage has arrived",
            "The clock cannot fairly start until the assets the work depends on are actually delivered.",
            "high", "timeline", _evidence(dl) or _evidence(avail), ["timeline", "dependency"],
        )
    return None


def _rule_approver(fields):
    ap = _field(fields, "approver_count")
    if _missing(ap):
        return _issue(
            "final_approver", "Final approver is not identified",
            "Multiple or unclear approvers add feedback-coordination time that is otherwise invisible.",
            "medium", "approval_flow", _evidence(ap), ["effort", "timeline"],
        )
    return None


def _rule_budget_anchor(fields):
    budget = _field(fields, "client_budget")
    if _missing(budget):
        return None
    unresolved = [n for n in ("quantity", "revision_rounds", "final_duration") if _missing(_field(fields, n))]
    if unresolved:
        return _issue(
            "budget_anchor", "Budget was given before scope is resolved",
            "A number is already anchored in the client's mind while quantity, revisions, or duration are still open -- scope tends to expand quietly to fit it.",
            "high", "commercial_clarity", _evidence(budget), ["cost"],
        )
    return None


GENERIC_RULES = [
    _rule_revision_boundary,
    _rule_deliverable_quantity,
    _rule_final_duration,
    _rule_footage_responsibility,
    _rule_deadline_dependency,
    _rule_approver,
]


def run_generic_deal_rules(fields: list[dict], ambiguities: list[dict]) -> list[dict]:
    """The Generic Deal Rule Pack. Order is priority order (highest-impact first);
    the frontend should not re-sort by severity alone, or budget_anchor -- which
    depends on other fields already being resolved -- would jump ahead of them."""
    issues = []
    for rule in GENERIC_RULES:
        issue = rule(fields, ambiguities) if rule is _rule_revision_boundary else rule(fields)
        if issue:
            issues.append(issue)
    budget_issue = _rule_budget_anchor(fields)
    if budget_issue:
        issues.append(budget_issue)
    return issues


def compute_readiness_state(issues: list[dict], support_level: str) -> str:
    has_high = any(i["severity"] == "high" and i["status"] == "open" for i in issues)
    if has_high:
        return "not_ready_to_quote"
    return "ready_to_estimate" if support_level == "calibrated_estimation" else "ready_scope_only"
