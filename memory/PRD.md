# Baseline — PRD & Build Log

**Descriptor:** AI pre-deal baseline check for Indonesian freelancers · **Tagline:** Baseline before yes.

## Problem / Promise
Freelance short-form video editors in Indonesia quote before all work is visible. Baseline turns a
pasted client chat into evidence-backed scope, prioritized clarification questions, transparent
deterministic hour/break-even/price-floor ranges, three editable deal options, an editable WhatsApp
reply, and a public Lembar Sepakat — before the freelancer says yes.

## Locked decisions (P0)
- LLM: **Gemini 3 Flash** via Emergent Universal LLM key (extraction + clarification only; NEVER pricing).
- Auth: **both** Emergent Google OAuth + JWT email/password. Guest demo & public pages never require login.
- Stack: React (CRA + CRACO + Tailwind) + FastAPI + MongoDB. Font: Plus Jakarta Sans.
- Deterministic pricing engine is the single source of truth for all numbers.

## Architecture
- **Backend** `/app/backend`
  - `pricing.py` — deterministic engine: `productive_cost_per_hour`, `estimate_hours` (named task units),
    `price_estimate` (labor → break-even → price floor), `scope_completeness`, `risk_triggers`, `confidence_level`.
  - `scope.py` — required fields, PII redaction, named buffers, `build_options` (A/B/C), Indonesian copy
    templates, seeded 12-Reels fixture `compute_seed_analysis()`.
  - `ai_service.py` — Gemini extraction with verbatim-quote validation + prompt-injection hardening.
  - `auth.py` — bcrypt + PyJWT. `server.py` — all `/api` routes.
- **Frontend** `/app/frontend/src`
  - pages: Landing, JudgeMode, Analyze, Analysis, Agreement (public), Login, Workspace.
  - components: BriefMap, ClarificationGate, EstimateResult, FormulaDrawer, DealOptions, WhatsAppPreview,
    RiskTriggers, CostProfileForm, Shell.

## Formula location
All math in `/app/backend/pricing.py`. Options/buffers/copy in `/app/backend/scope.py`. LLM output is
validated in `/app/backend/ai_service.py` and can never inject monetary values into the engine.

## Seed reproduction (verified, locked)
cost/hour Rp100,000 · hours 37–42 · break-even Rp4.1–4.6M · price floor Rp5.125–5.75M · budget Rp3M ·
completeness 87% · risk HIGH · options A=6 Reels @Rp3.0M / B=12 @Rp5.5M / C=12 @Rp6.5M.

## Data model (MongoDB, string UUID ids)
users, user_sessions, cost_profiles, brief_analyses (embedded fields/clarifications/estimate/options),
scope_agreements (immutable snapshot + unguessable token), project_actuals (one-project calibration),
analytics_events.

## Status — P0 COMPLETE (2026-08-18)
Backend 17/17 unit tests + full E2E suite pass (100%). Frontend E2E 100%. Verified: no-login sample &
Judge Mode, live Gemini extraction with valid evidence quotes, prompt-injection safe (no price/no prompt
leak), deterministic estimate reacts to clarification changes, incomplete cost profile → hours only,
3 options + decline, editable WhatsApp copy, immutable public Lembar Sepakat with no cost/margin/brief
leak, JWT + Google auth, one-project calibration factor + trace, mobile 375px overflow-free.

## Intentionally NOT built (per lock)
Voice/OCR/PDF, contract generator, payments/escrow, WhatsApp auto-send, CRM/kanban, full revision
tracking, marketplace, market-rate scraping, multiple professions, autonomous negotiation, billing,
arbitrary risk score. P0.5 (Scope Check, multi-project median calibration, Impact Board) deferred.

## Backlog (post-submit)
P0.5: Minimal Scope Check (Prompt 6), multi-project Personal Estimation Memory (Prompt 7).
P1: contest UX hardening pass (Prompt 5), pilot analytics dashboard.
