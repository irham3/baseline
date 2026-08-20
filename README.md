# Baseline Work

A pre-deal scope and pricing guard for Indonesian freelance short-form video editors and
small creative studios — built for **Building Indonesia 2026**.

- **Live app:** https://baselinework.app
- **90-second guided demo (no login):** https://baselinework.app/judge

## The problem

A short-form video editor gets a brief over WhatsApp: *"Butuh 12 Reels buat campaign
bulan depan, budget 3 juta, revisi sampai cocok."* Quantity and budget are stated;
final duration, footage readiness, approver count, and revision limits are not. Most
freelancers quote from gut feel, absorb the missing scope as unpaid work, and find out
mid-project that the client's budget was never going to cover the job.

Baseline turns that brief into: extracted evidence (stated / assumed / missing), the
five highest-impact clarification questions, a deterministic hour range, a transparent
break-even and price floor, three bounded deal options, ready-to-send WhatsApp copy,
and a client-safe Agreement Sheet — before the freelancer says yes.

## Who it's for

Freelance short-form video editors and small creative studios in Indonesia who receive
ambiguous Reels/TikTok/Shorts briefs through WhatsApp, Instagram, referrals, or
community groups, and who currently quote without a repeatable way to price hidden
scope.

## Core workflow

```
messy WhatsApp/client brief
  -> stated / inferred / missing evidence
  -> five highest-impact clarification questions
  -> deterministic hour estimate
  -> transparent break-even and price floor
  -> bounded deal options (keep budget / keep scope / rush)
  -> WhatsApp-ready response
  -> client-safe Agreement Sheet
  -> client response (approve / request changes / expire / revoke)
```

## Why AI extracts, but never prices

AI (an LLM, with a deterministic heuristic extractor as an automatic fallback) reads
the brief and proposes: which fields are stated verbatim, which are inferred, which are
missing, and what to ask about. It also helps phrase client-facing copy.

**AI never calculates an hour, a cost, a margin, a price, or a deal term.** Every
number the product shows is produced by pure, versioned Python functions in
`backend/pricing.py` and `backend/scope.py` (`FORMULA_VERSION`) — the same inputs
always produce the same output, and every figure traces back to a named, visible
assumption. AI-drafted WhatsApp copy is validated to preserve every price/quantity/
timeline token verbatim before it's shown; if a draft alters a locked number, it's
rejected rather than shown to the user.

Every analysis and Agreement Sheet is also tagged with a **provenance**: `ai`
(live extraction), `heuristic_fallback` (deterministic, no LLM call — used
automatically when the LLM is unavailable, or explicitly via the "Analyze without AI"
toggle), or `seed` (the fixed demo fixture). The UI shows which one produced the
result you're looking at.

## Architecture

```
frontend/   React 18 (Create React App + craco), Tailwind, React Router, Framer Motion
backend/    FastAPI + Motor (async MongoDB driver), Pydantic v2
            - pricing.py    deterministic hour/price/timeline math (no I/O, no LLM)
            - scope.py      task template, deal-option builder, PII redaction,
                             copy templates, seeded demo fixture
            - ai_service.py LLM scope extraction + deterministic heuristic fallback
            - core.py       Mongo/in-memory DB proxy, auth resolution
            - routers/      auth, analysis, agreement, account
```

In development/test, the backend runs on an in-memory store when `MONGO_URL` is unset.
In production (`ENVIRONMENT=production`), it refuses to start or silently keep serving
if MongoDB is unreachable — it fails fast instead of quietly losing data on restart.

### Emergent platform capabilities used

This app was originally scaffolded on Emergent and still uses two of its integrations,
both optional and gracefully degraded when absent:
- `emergentintegrations` for LLM scope extraction (falls back to the deterministic
  heuristic extractor when the package or `EMERGENT_LLM_KEY` isn't available).
- An Emergent-hosted Google OAuth session proxy, as one of three supported Google
  sign-in paths (alongside direct Google Identity Services ID tokens and OAuth access
  tokens).

## Deterministic formula principles

- **Named, versioned assumptions.** Duration bands, daily capacity, buffer
  percentages/minimums/caps are constants with comments explaining what they represent
  and that they're configurable operational assumptions, not universal market truth.
- **Every option is priced at or above its own floor**, or the app says so explicitly.
  If no quantity (down to a single video) fits the client's budget, the product returns
  a typed "no viable scope at this budget" result instead of fabricating a budget-fit
  option.
- **Timelines are derived**, not hardcoded — from estimated hours, daily capacity,
  asset readiness, review/approval turnaround, and rush conditions. Every option
  carries a `timeline_trace` explaining the day count.
- **Buffers scale with the job.** Each named buffer (footage dependency, multi-approver,
  rush, base contingency) is a percentage of labor cost with a floor and a cap, not a
  flat constant regardless of project size.

## Privacy limitations (accurate, not "100% private")

- The brief you paste is sent to this app's backend, and — unless you use "Analyze
  without AI" — to an LLM provider for extraction. It is **not** processed entirely
  client-side.
- Contact-adjacent details (emails, Indonesian phone numbers, URLs, @handles, and
  long bank-account-like digit runs) are redacted before AI processing when redaction
  is enabled, and this is disclosed in the UI. Redaction is best-effort, not a
  guarantee of complete anonymization — remove anything truly confidential yourself
  before pasting.
- Your internal cost, hourly rate, break-even, target margin, and calibration history
  are **never** included in a public Agreement Sheet response or link.
- Baseline is an estimation and scope-documentation tool. It is not legal, tax, or
  financial advice, and nothing it produces is a legally binding contract.

## Local setup

Prerequisites: Python 3.11+, Node 18+, npm.

```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/activate        # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt   # emergentintegrations is optional/private; the app
                                   # runs fine without it (heuristic fallback only)
# create backend/.env, see the table below
uvicorn server:app --reload --port 8001

# Frontend (separate terminal)
cd frontend
npm install
npm start   # http://localhost:3000
```

### Environment variables (no secrets committed)

`backend/.env`:

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | yes | Signs auth tokens. Any random string in dev. |
| `ENVIRONMENT` | no (default `development`) | Set to `production` to require a working `MONGO_URL` and disable the in-memory fallback. |
| `MONGO_URL` | no in dev/test | Falls back to in-memory storage when unset (dev/test only). |
| `DB_NAME` | no (default `baseline_dev`) | |
| `CORS_ORIGINS` | no | Comma-separated origins allowed to call the API with credentials. |
| `EMERGENT_LLM_KEY`, `LLM_PROVIDER`, `LLM_MODEL` | no | Live AI extraction; heuristic fallback is used when absent. |
| `COOKIE_SECURE` | no | Set `true` behind HTTPS in production. |

`frontend/.env`:

| Variable | Required | Notes |
|---|---|---|
| `REACT_APP_BACKEND_URL` | no (default `http://localhost:8001`) | |

## Tests

```bash
# Backend: deterministic pricing, agreement security, AI provenance, validation
cd backend && python -m pytest tests/ -q --ignore=tests/backend_test.py

# Backend: live E2E against a running server
uvicorn server:app --port 8001 &
REACT_APP_BACKEND_URL=http://127.0.0.1:8001 python -m pytest tests/backend_test.py -q

# Frontend production build
cd frontend && npm run build
```

## Screenshots

See `frontend/public/assets/` for the current brand mark and hero image
(`baseline-logo-512.png`, `baseline-hero-workspace.png`) used in the app's Open Graph
tags and landing page.

## Known limitations

- Redaction and provenance detection are heuristic/best-effort, not guarantees.
- The pricing model covers short-form video editing only (by design — see
  `PRODUCT.md`); it does not generalize to other creative professions.
- Automated browser end-to-end coverage for Judge Mode is currently manual
  (verified interactively); no Playwright/Cypress suite is checked in yet.
- A full Indonesian-language pass across the entire UI has not been done; some
  system-level copy (e.g. generic error fallbacks) is Indonesian while most product
  UI is English. See `DESIGN.md` for the current language policy.

## Roadmap

- Automated browser E2E test for the Judge Mode happy path.
- Full bilingual (ID/EN) UI toggle for client-facing copy and the Agreement Sheet.
- Broader Pydantic-typed scope-override validation (currently validated at the
  pricing-engine layer with 4xx responses, not fully typed at the API boundary).

## Contest context

Built for the **Building Indonesia 2026** contest. No fabricated users, testimonials,
pilot results, or revenue figures appear anywhere in this app or its documentation —
where an impact section exists, it explicitly waits for verified data rather than
inventing it.
