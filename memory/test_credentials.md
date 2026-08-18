# Baseline — Test Credentials

## JWT email/password test user (created via /api/auth/register)
- Email: `raka@baseline.app`
- Password: `baseline123`
- Role: standard user

## Google OAuth
- Emergent-managed Google Auth. No app-managed password.
- To test in browser without real Google, seed a session token per `/app/auth_testing.md`
  (insert into `users` + `user_sessions` in DB `baseline_db`, then set `session_token` cookie).

## Auth endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/refresh
- POST /api/auth/google/session   (body: {session_id})

## Notes
- DB name: `baseline_db`
- Guest identity: frontend sends `X-Guest-Id` header (localStorage `baseline_guest_id`).
- Public Lembar Sepakat token route: /s/:token (also /agreement/:token). No login required.
