"""Unit tests for the Generic Deal Rule Pack (rules.py)."""
import rules


def _field(name, value, status="stated", quote=None):
    return {"name": name, "value": value, "status": status, "source_quote": quote}


RESOLVED_FIELDS = [
    _field("quantity", 12, quote="12 reels"),
    _field("revision_rounds", 2, quote="2 revisions"),
    _field("final_duration", 30),
    _field("footage_available", True, quote="footage ready"),
    _field("footage_preselected", True),
    _field("deadline_working_days", 5),
    _field("approver_count", 1),
    _field("client_budget", 3_000_000),
]


def _by_rule(issues, rule_id):
    return next((i for i in issues if i["rule_id"] == rule_id), None)


def test_no_issues_when_everything_resolved():
    issues = rules.run_generic_deal_rules(RESOLVED_FIELDS, [])
    assert issues == []


def test_missing_revision_rounds_is_high_severity_with_evidence_none():
    fields = [f for f in RESOLVED_FIELDS if f["name"] != "revision_rounds"]
    issues = rules.run_generic_deal_rules(fields, [])
    issue = _by_rule(issues, "revision_boundary")
    assert issue is not None
    assert issue["severity"] == "high"
    assert issue["evidence"] is None


def test_ambiguous_revision_rounds_flags_even_when_stated():
    issues = rules.run_generic_deal_rules(
        RESOLVED_FIELDS, [{"field_names": ["revision_rounds"], "reason": "revisi sampai cocok"}]
    )
    assert _by_rule(issues, "revision_boundary") is not None


def test_missing_quantity_is_high_severity():
    fields = [f for f in RESOLVED_FIELDS if f["name"] != "quantity"]
    issues = rules.run_generic_deal_rules(fields, [])
    issue = _by_rule(issues, "deliverable_quantity")
    assert issue["severity"] == "high"


def test_budget_anchor_only_fires_when_scope_still_unresolved():
    # Budget stated but everything else resolved -> no budget_anchor issue.
    issues = rules.run_generic_deal_rules(RESOLVED_FIELDS, [])
    assert _by_rule(issues, "budget_anchor") is None

    # Budget stated while quantity is still missing -> issue fires.
    fields = [f for f in RESOLVED_FIELDS if f["name"] != "quantity"]
    issues = rules.run_generic_deal_rules(fields, [])
    assert _by_rule(issues, "budget_anchor") is not None


def test_budget_anchor_silent_when_budget_itself_not_given():
    fields = [f for f in RESOLVED_FIELDS if f["name"] not in ("client_budget", "quantity")]
    issues = rules.run_generic_deal_rules(fields, [])
    assert _by_rule(issues, "budget_anchor") is None


def test_footage_available_but_not_preselected_flags_medium():
    fields = [f for f in RESOLVED_FIELDS if f["name"] != "footage_preselected"]
    issues = rules.run_generic_deal_rules(fields, [])
    issue = _by_rule(issues, "footage_responsibility")
    assert issue is not None
    assert issue["severity"] == "medium"


def test_deadline_before_footage_delivered_is_high():
    fields = [f for f in RESOLVED_FIELDS if f["name"] != "footage_available"]
    fields.append(_field("footage_available", False, quote="footage nanti dikirim"))
    issues = rules.run_generic_deal_rules(fields, [])
    issue = _by_rule(issues, "deadline_dependency")
    assert issue is not None
    assert issue["severity"] == "high"


def test_readiness_not_ready_when_high_issue_open():
    issues = [{"severity": "high", "status": "open"}]
    assert rules.compute_readiness_state(issues, "calibrated_estimation") == "not_ready_to_quote"


def test_readiness_ready_to_estimate_when_clean_and_calibrated():
    assert rules.compute_readiness_state([], "calibrated_estimation") == "ready_to_estimate"


def test_readiness_ready_scope_only_when_clean_but_unsupported():
    assert rules.compute_readiness_state([], "critique_only") == "ready_scope_only"


def test_readiness_ignores_resolved_or_medium_issues():
    issues = [
        {"severity": "high", "status": "resolved"},
        {"severity": "medium", "status": "open"},
    ]
    assert rules.compute_readiness_state(issues, "calibrated_estimation") == "ready_to_estimate"


def test_classify_profession_video_signal():
    result = rules.classify_profession("Butuh 12 Reels buat campaign, footage nanti dikirim.")
    assert result == {"profession": "short_form_video", "support_level": "calibrated_estimation"}


def test_classify_profession_non_video_signal():
    result = rules.classify_profession("Bikin website toko online simpel, ada login dan dashboard admin.")
    assert result == {"profession": "general", "support_level": "critique_only"}


def test_classify_profession_mixed_signal_prefers_non_video():
    result = rules.classify_profession("Video profil untuk landing page company kami.")
    assert result["support_level"] == "critique_only"
