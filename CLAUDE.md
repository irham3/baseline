# Baseline Work — Panduan Project

Pre-deal scope & pricing guard untuk freelancer video short-form Indonesia. Kontes Building Indonesia 2026.
Repo asli: github.com/irham3/baseline. Kerja di branch `contest/product-integrity-and-judge-mode` (belum di-push).

## Cara Menjalankan (Dev)

Jalankan 3 hal ini terpisah:

```bash
# 1. MongoDB (Docker) — sekali jalan, tetap hidup di background
docker start baseline-mongo   # atau kalau belum ada container-nya:
docker run -d --name baseline-mongo -p 27017:27017 -v baseline_mongo_data:/data/db mongo:7

# 2. Backend (FastAPI) — dari folder backend/
cd backend
.venv/Scripts/python.exe -m uvicorn server:app --port 8001 --host 127.0.0.1
# venv sudah ada di backend/.venv, env vars sudah di backend/.env (JWT_SECRET, MONGO_URL, dll)

# 3. Frontend (React/CRA) — dari folder frontend/, terminal terpisah
cd frontend
npm start   # dev server http://localhost:3000, atau:
npm run build && npx serve -s build -l 3000   # mode build statis
```

Buka **http://localhost:3000** (bukan `127.0.0.1:3000` — CORS backend cuma izinkan `localhost:3000`).

## Test

```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/ -q --ignore=tests/backend_test.py   # unit (77 test)
REACT_APP_BACKEND_URL=http://127.0.0.1:8001 .venv/Scripts/python.exe -m pytest tests/backend_test.py -q  # E2E live (17 test), backend harus jalan dulu

cd frontend
CI=true npm run build   # harus "Compiled successfully"
```

## Env Files (gitignored, sudah dibuat)

- `backend/.env` — `JWT_SECRET` (sudah digenerate), `ENVIRONMENT=development`, `MONGO_URL=mongodb://localhost:27017`, `CORS_ORIGINS=http://localhost:3000`. `EMERGENT_LLM_KEY` masih kosong (AI extraction otomatis fallback ke heuristic deterministik, ini sudah benar/diverifikasi).
- `frontend/.env` — `REACT_APP_BACKEND_URL=http://localhost:8001`.

## Status Pengerjaan (per commit terakhir)

5 commit di branch `contest/product-integrity-and-judge-mode`, **belum di-push** (sengaja, atas permintaan user).
Semua sudah dites & verifikasi manual di Chrome (bukan cuma lolos test):

1. **Fix integritas pricing & keamanan Agreement Sheet** — durasi video sekarang memengaruhi jam kerja, timeline dihitung bukan hardcode, Option A tidak lagi memalsukan "sesuai budget" kalau tidak layak, buffer scale-aware, Agreement Sheet tidak bisa ditampering dari browser (server-side option lookup).
2. **Judge Mode nyata** (`/judge`) — 8 step deterministik tanpa login, teruji end-to-end termasuk create+approve Agreement Sheet ke backend live. Plus `/analyze` (route yang sebelumnya broken link).
3. **Transparansi AI + validasi input** — badge provenance (ai/heuristic_fallback/seed), toggle "Analyze without AI", redaksi PII diperluas, ValueError→422 (bukan 500), rate/security headers dasar.
4. **Google OAuth audience verification + CSP** — ditemukan & diperbaiki bug CSP sendiri yang sempat memblokir API call di local dev.
5. **Fix bug nyata dari dogfooding** — regex ekstraksi budget/revisi Bahasa Indonesia yang gagal, durasi hardcode "45 seconds" di WhatsApp draft & Agreement Sheet publik (sekarang ikut brief asli), lebar Judge Mode step yang tadinya sempit di laptop.

### Yang masih perlu dikerjakan (belum selesai)

- **Verifikasi visual "no viable scope"** — lagi diuji pakai budget super kecil (`http://localhost:3000/analyze`), belum sempat lihat hasilnya (kehabisan token sesi).
- **Tombol "Continue with Google"** di `/login`: kalau `GOOGLE_CLIENT_ID` kosong, diam-diam redirect ke `https://auth.emergentagent.com` (lihat `frontend/src/pages/Login.js:96-104`). Ini perilaku lama (bukan saya buat), tapi perlu diputuskan: dipertahankan (arsitektur Emergent legacy) atau dikasih disclosure jelas ke user dulu.
- **Audit visual 375px sungguhan** — automation browser di sesi Claude Code ini viewport-nya tervirtualisasi, tidak bisa di-resize (sudah dicoba lewat tool bawaan & langsung manipulasi window Windows API, tetap gagal). Lebar sudah diaudit lewat kode (semua grid pakai prefix `sm:`/`md:` yang benar), tapi belum ada screenshot HP asli. Cek manual via HP asli atau DevTools browser sendiri.
- **Push ke GitHub + buka PR** — ditahan sesuai permintaan user, tinggal jalankan `git push -u origin contest/product-integrity-and-judge-mode` lalu `gh pr create` kalau sudah oke.
- Item yang sengaja ditunda (lihat `README.md` bagian "Known limitations"): automated Playwright/Cypress E2E, full Bahasa Indonesia di seluruh UI, refactor `scope_overrides` jadi Pydantic model penuh.

### Catatan teknis penting

- Kalau restart backend setelah edit `.py`, harus **kill proses uvicorn lama dulu** (tidak pakai `--reload`), baru jalankan ulang — cek lewat `Get-CimInstance Win32_Process -Filter "Name='python.exe'"` di PowerShell buat cari PID yang benar (jangan asal kill, ada python proses lain yang tidak terkait).
- Test unit (`pytest tests/ --ignore=backend_test.py`) sengaja dipaksa in-memory DB lewat `tests/conftest.py` (biar tidak bentrok event-loop sama MongoDB asli). Test E2E (`backend_test.py`) baru benar-benar pakai MongoDB asli, butuh server live dulu.
- Kalau browser-automation klik meleset: viewport asli halaman itu ~2048px tapi screenshot tool mengompress ke ~1568px, jadi koordinat klik dari screenshot **tidak akurat**. Selalu pakai `find` + klik berdasarkan `ref`, atau `form_input` buat isi form — jangan pakai koordinat mentah dari screenshot.
