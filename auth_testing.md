# Baseline — Auth Testing Playbook

Baseline supports TWO auth methods that share one `users` collection (keyed by `user_id`):
1. Emergent Google OAuth (session_token cookie, stored in `user_sessions`)
2. Custom JWT email/password (access_token + refresh_token cookies)

Guest demo, Judge Mode, and public Lembar Sepakat NEVER require login.

## JWT email/password
```
# register
curl -c cj.txt -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"raka@baseline.app","password":"baseline123","name":"Raka"}'
# me (uses cookie)
curl -b cj.txt http://localhost:8001/api/auth/me
# login
curl -c cj.txt -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"raka@baseline.app","password":"baseline123"}'
```
Cookies are httpOnly, secure, samesite=none. Bearer header also accepted.

## Google OAuth (browser test with seeded session)
```
mongosh --eval "
use('baseline_db');
var userId = 'user_gtest' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({user_id:userId,email:'gtest'+Date.now()+'@example.com',name:'G Test',auth_provider:'google',created_at:new Date().toISOString()});
db.user_sessions.insertOne({user_id:userId,session_token:sessionToken,expires_at:new Date(Date.now()+7*864e5).toISOString(),created_at:new Date().toISOString()});
print('session_token: '+sessionToken);
"
```
Then set cookie `session_token` (domain = preview host, path=/, httpOnly, secure, sameSite=None) and open /app,
or call: `curl http://localhost:8001/api/auth/me -H "Authorization: Bearer <session_token>"`.

## Authorization checks
- Private endpoints requiring `require_user`: GET /api/cost-profile, GET/POST/DELETE /api/calibration.
- Analysis ownership: GET/POST /api/analysis/{id}/* enforce owner match via X-Guest-Id (guest) or auth (user).
  A different guest id / user must get 403.

## Guest survival
- With OAuth unavailable, guest flow (X-Guest-Id header) must still analyze, estimate, and create agreements.
- GET /api/demo/seed and POST /api/demo/agreement never require auth.
