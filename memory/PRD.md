# Baseline — PRD

## Original Problem Statement
Improve the landing page copywriting of the existing "Baseline" baseline project (English), then publish via Emergent.

## Product
Baseline is an AI pre-deal baseline check for freelancers (video editors/creators). Paste a client chat/brief → it surfaces hidden work, computes a defensible price floor from the user's own cost profile, and produces three deal options plus a shareable agreement sheet. Pricing shown in IDR (Indonesian freelancer market).

## Tech Stack
- Frontend: React (CRA + craco), Tailwind, framer-motion, react-router
- Backend: FastAPI + Motor (MongoDB), JWT + Emergent Google OAuth
- DB: MongoDB

## Work Done (2026-06 session)
- Rewrote landing page copywriting in English: hero headline/subhead, CTAs, trust chips, problem line, "how it works" cards, bottom CTA, and translated hero-visual labels. Verified via screenshot. (`frontend/src/pages/Landing.js`, `components/ui/primitives.js` DemoTag default)
- Fixed corrupted baseline blocking startup:
  - Restored missing body of `resolved_seed_scope()` and removed orphaned dict in `backend/scope.py` (IndentationError).
  - Fixed pydantic_core version mismatch (pinned pydantic_core==2.27.2 for pydantic 2.10.4).
  - Created missing env files: `backend/.env` (MONGO_URL, DB_NAME, CORS_ORIGINS, JWT_SECRET), `frontend/.env` (REACT_APP_BACKEND_URL).
- Deployment readiness: passed after adding JWT_SECRET and setting CORS_ORIGINS=*. Backend health = ok.

## Deployment
- Not yet deployed. User must click Deploy → Deploy Now in Emergent UI (user action; agent cannot trigger).

## Backlog / Next
- P1: End-to-end QA of Analyze → Analysis → Agreement flows (auth, guest analyses).
- P2: Optional English/ID localization toggle for the app body (currently app UI is Indonesian, landing is English).
