# Baseline Work — Panduan Project

Pre-deal scope & pricing guard untuk freelancer video short-form Indonesia. Kontes Building Indonesia 2026.
Repo asli: github.com/irham3/baseline. Kerja di branch **`rifqi`** (sudah di-push, jangan pernah push langsung ke `master`).

**PR #1 sudah dibuka**: https://github.com/irham3/baseline/pull/1 (`rifqi` → `master`), status open, `mergeable_state: clean`, per 2026-08-21 belum ada review/comment dari owner repo. Merge adalah keputusan owner, bukan Claude.

## Cara Menjalankan (Dev)

Jalankan 3 hal ini terpisah:

```bash
# 1. MongoDB (Docker) — sekali jalan, tetap hidup di background
docker start baseline-mongo   # container sudah ada, kalau belum:
docker run -d --name baseline-mongo -p 27017:27017 -v baseline_mongo_data:/data/db mongo:7

# 2. Backend (FastAPI) — dari folder backend/
cd backend
.venv/Scripts/python.exe -m uvicorn server:app --port 8001 --host 127.0.0.1
# venv sudah ada di backend/.venv, env vars sudah di backend/.env (JWT_SECRET, MONGO_URL, dll)

# 3. Frontend — dari folder frontend/, terminal terpisah
npx serve -s build -l 3000
```

Buka **http://localhost:3000** (bukan `127.0.0.1:3000` — CORS backend cuma izinkan `localhost:3000`).

### ⚠️ PENTING: frontend di :3000 adalah STATIC BUILD, bukan dev server

Saat ini yang serve port 3000 adalah `serve -s build` (bundle production, filename ter-hash seperti `main.73bb36f8.js`), **bukan** `npm start`/CRA dev server. Artinya:

- **Edit file di `frontend/src/` TIDAK otomatis muncul di browser.** Tidak ada hot-reload.
- Setiap kali selesai edit frontend, **wajib** jalankan `cd frontend && CI=true npm run build` dulu, baru refresh browser. `serve` otomatis baca file baru dari folder `build/` begitu di-rebuild — tidak perlu restart proses `serve`-nya.
- Ini pernah bikin kebingungan sendiri (fix sudah ditulis di kode tapi browser tetap tampil versi lama) — kalau kejadian lagi, cek dulu: sudah `npm run build`, dan apakah `document.querySelector('script[src]')` di browser nunjuk ke hash bundle yang baru.

## Test

```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/ -q --ignore=tests/backend_test.py   # unit (127 test, per 2026-08-22)
REACT_APP_BACKEND_URL=http://127.0.0.1:8001 .venv/Scripts/python.exe -m pytest tests/backend_test.py -q  # E2E live (17 test), backend harus jalan dulu

cd frontend
CI=true npm run build   # harus "Compiled successfully" — ini JUGA deploy step lokal, lihat catatan di atas
```

## Env Files (gitignored, sudah dibuat — jangan commit ulang)

- `backend/.env` — `JWT_SECRET` (sudah digenerate), `ENVIRONMENT=development`, `MONGO_URL=mongodb://localhost:27017`, `CORS_ORIGINS=http://localhost:3000`. `EMERGENT_LLM_KEY` masih kosong (AI extraction otomatis fallback ke heuristic deterministik — ini expected, sudah diverifikasi berkali-kali, termasuk tombol "Polish with AI" yang gagal graceful dengan pesan jelas + tombol Retry, bukan bug).
- `frontend/.env` — `REACT_APP_BACKEND_URL=http://localhost:8001`.

## Status Pengerjaan

Semua di bawah ini **sudah di-push ke `origin/rifqi`**, sudah lolos 127 unit test, dan sudah diverifikasi manual langsung di Chrome (bukan cuma lolos test — didogfooding sungguhan, klik-klik tiap tombol).

### §17.3 (P1) + subset aman §17.4 (Post-contest) — 22 Aug 2026, commit `99c16afd`..`eb794cab`

Rifqi minta lanjut kerjakan bagian yang tadinya sengaja dilewati. Setelah ditimbang ulang per item (lihat `PENUGASAN-AI-P1.md`), yang dikerjakan:
- **Multi-project Personal Estimation Memory** — backend sudah siap (5 project, median), FE `Workspace.js` yang tadinya cuma bisa 1 project (endpoint lama `/calibration` hapus semua project lain tiap save) sekarang pakai `/projects` list-based penuh, dengan bar projected-vs-realized per project.
- **Rich analysis history + filter** — endpoint baru `GET /api/analyses`, tidak pernah ada sebelumnya.
- **Export proposal PDF** — `window.print()` + CSS isolation, nol dependency baru.
- **Klarifikasi khusus profesi non-video** (auth method, payment, roles, deployment) — tetap critique-only, tidak ada calibrated estimator palsu untuk profesi lain.
- **Client profile reusable + rate card** — dari `scope_agreements` milik user sendiri, bukan data eksternal/scrape (jaga Trust lens §16.6).
- **Bug ditemukan & diperbaiki saat verifikasi**: heuristik ekstraksi dulu selalu menyisipkan field video palsu (aspect ratio, platform, dst) bahkan untuk brief non-video — sekarang digerbang oleh klasifikasi profesi.

**Sengaja TIDAK dikerjakan** (alasan lengkap di `PENUGASAN-AI-P1.md`): payment gateway/escrow/full contract generator/negotiation bot (risiko finansial/legal), CRM penuh/Kanban/full revision management (beda kategori produk), WhatsApp automation resmi/voice transcription/generic PDF parser (butuh infrastruktur eksternal), calibrated estimator profesi lain/arbitrary risk score/market-rate scraper (melanggar Trust lens sendiri), email integration/team workspace/invoice-payment/API agency (infrastruktur eksternal atau redesign multi-tenant besar). Screenshot OCR (P1) di-defer, bukan ditolak — dependency berat, prioritas rendah.

### Audit master plan P0/P0.5 (22 Aug 2026) — semua item yang direncanakan dokumen "sekarang" sudah tuntas

Diaudit sistematis terhadap §17.1 (24 item P0) dan §17.6 (13 acceptance criteria): 21/24 sudah ada sejak sebelumnya, 3 gap ditemukan dan **semuanya sudah dikerjakan** sesi ini (lihat detail commit di bawah): #4 profession classification editable, #24 No-AI-Slop quality bar (§16.6 — ternyata itu checklist audit 6-lensa, bukan fitur kode; diaudit statis, bersih dari pelanggaran), dan 2 item P0.5 (sample unsupported profession, shareable result image). **Sengaja TIDAK dikerjakan**: §17.3 P1 dan §17.4 Post-contest (dokumen sendiri bilang "setelah submission dasar"/"post-contest", bukan sekarang), dan §17.5 "Jangan dibangun sebelum deadline" (payment gateway, escrow, CRM, dll — dokumen eksplisit melarang).

**Keterbatasan yang jujur perlu dicatat**: lensa "Mobile craft" (visual 375px) tidak bisa diverifikasi langsung di browser — `resize_window` tool tidak benar-benar mengecilkan viewport CSS di lingkungan ini (window resize ke 375px tetap menghasilkan `innerWidth` 1022px), dan trik iframe alternatif diblokir CSP `frame-ancestors 'none'` (itu sendiri fitur keamanan yang benar, bukan bug). Audit kode statis (grep Tailwind responsive classes, cek fixed-width overflow) tidak menemukan pelanggaran, tapi ini bukan pengganti verifikasi visual sungguhan.

### Fitur/perbaikan besar (kronologis)

0a. **Generic Deal Rule Pack lengkap — 9/9 kriteria §4.3 master plan** (22 Aug 2026, commit `a7937666` + `4a755053`) — 2 kriteria yang tadinya hilang (**acceptance clarity**, **change boundary**) sekarang diimplementasi penuh, termasuk jalur resolve-nya (bukan cuma card kritik yang muncul selamanya): freelancer bisa deklarasi lewat 2 dropdown preset baru di Clarification Gate ("Terms you define"), atau otomatis ter-ekstrak dari brief kalau klien kebetulan menyebutkannya. Severity `medium` (tidak menggerbang readiness). Nilai bertahan setelah reload (`deal_terms` di dokumen analisis — bug data-loss D10 ditemukan & diperbaiki saat desain, sebelum sempat ke produksi). Tampil juga di Agreement Sheet publik. Detail lengkap: `RENCANA-acceptance-change-boundary.md` (5 fase, semua sudah dieksekusi) dan `PENUGASAN-AI.md`.
0b. **Fix bug parsing budget tanpa spasi** (22 Aug 2026, commit `6cdf9c2a`) — `_currency_to_idr()` di `ai_service.py` gagal parse `"5jt"` (angka+satuan nempel tanpa spasi, pola kasual Indonesia yang umum) karena syaratnya `" jt"` pakai spasi di depan; hasilnya diam-diam jadi `5` bukan `5.000.000`. **Dampak nyata, bukan cuma salah tampilan**: budget yang salah bikin engine estimasi keliru bilang "budget di bawah break-even" dan mematikan Option A (`no_viable_scope`) padahal budgetnya sebenarnya cukup. Ketemu tidak sengaja saat verifikasi browser fitur di atas. Fix: syaratkan digit langsung sebelum satuan (bukan wajib spasi) — tetap aman dari false-positive "rb" di tengah kata seperti "terbaik".
0c. **Profession classification jadi editable** (22 Aug 2026, commit `927782ec`) — master plan P0 item #4 minta klasifikasi profesi "editable", tapi `classify_profession()` (keyword heuristic, docstring-nya sendiri sudah bilang "tentative, editable") tidak pernah punya UI edit. Brief video yang kebetulan menyebut kata non-video (mis. "aplikasi") salah terklasifikasi "general" dan kehilangan pricing terkalibrasi selamanya. Endpoint baru `POST /analysis/{id}/profession` (cuma terima `short_form_video`/`general`, 422 kalau lain) menghitung ulang `support_level`+`readiness_state`, persisten lewat `profession_overridden` flag. FE: dropdown kompak "Project type" di header dekat badge provenance — begitu diganti, form Cost Profile langsung terbuka tanpa reload. Diverifikasi live: brief salah klasifikasi → dikoreksi → langsung dapat price floor nyata.
0d. **Sample unsupported-profession & shareable result image** (22 Aug 2026, commit `0924d822` + `23c63c47`) — 2 item P0.5. Tombol "Try a non-video sample" di landing (brief website/programmer, dikunci dengan regression test karena jadi jalur demo yang mungkin dilihat juri) menunjukkan critique-only honesty gate: 7 issue kritik tetap muncul, tapi tidak ada estimasi harga yang dipalsukan. "Download result image" di halaman analisis — kartu PNG 1200x630 via Canvas API native (tanpa dependency baru), baca CSS custom property tema secara live, ikut kontrak privasi yang sama seperti Agreement Sheet (tidak pernah menampilkan cost/margin internal).

1. **Integritas pricing & keamanan Agreement Sheet** — durasi video memengaruhi jam kerja, timeline dihitung (bukan hardcode 7/10/21 hari), Option A tidak lagi memalsukan "sesuai budget" kalau memang tidak layak (jadi `no_viable_scope` yang jujur), buffer scale-aware (persen dari labor cost, bukan angka tetap), Agreement Sheet tidak bisa ditampering dari browser (server resolve `option_id` sendiri, harga/qty tidak pernah dipercaya dari client).
2. **Judge Mode nyata** (`/judge`) — 8 step deterministik tanpa login, teruji end-to-end termasuk create+approve Agreement Sheet ke backend live. Plus `/analyze` (route yang sebelumnya broken link dari Workspace/Analysis).
3. **Transparansi AI + validasi input** — badge provenance (`ai`/`heuristic_fallback`/`seed`), toggle "Analyze without AI", redaksi PII (nomor HP + email) dengan preview sebelum dikirim ke AI, `ValueError` → 422 (bukan 500), security headers dasar.
4. **Google OAuth audience verification + Content-Security-Policy** header — sempat ada bug CSP buatan sendiri yang memblokir API call di local dev (`connect-src` kurang `http://localhost:*`), sudah diperbaiki.
5. **Rate limiting + CSRF/Origin protection** (in-memory sliding window, tanpa dependency baru; middleware cek `Origin`/`Referer` untuk request cookie-authenticated) — **sudah diverifikasi live** via curl langsung ke server dev (bukan cuma unit test): 5x login salah → `429`; `Origin` asing → `403`; `Origin` sah → lolos.
6. **Endpoint yang tadinya "dead" (tidak ada UI-nya) — semua sudah di-wire**: Revoke agreement, redaction preview, silent session refresh (axios interceptor, 401 → `/auth/refresh` sekali → retry), Scope Check (klien bisa cek "brief nambah dari yang disepakati?"), "Polish with AI" (deal-copy).
7. **Bug nyata ditemukan lewat dogfooding manual, sudah diperbaiki + ada regression test:**
   - `whatsapp_message()` crash 500 kalau Option A jadi `no_viable_scope` (harga `None`)
   - Pesan konfirmasi salah untuk "Ask a question" di Agreement.js (ketuker sama "change request")
   - Badge kalibrasi "1 project, low confidence" di Workspace muncul terus walau belum ada data tersimpan
   - Regex ekstraksi budget/revisi Bahasa Indonesia yang gagal untuk pola seperti "budgetnya" / "revisi maksimal 2x"
   - Durasi hardcode "45 seconds" di draft WhatsApp & Agreement Sheet publik (sekarang ikut brief asli)
   - **Agreement Sheet yang di-revoke freelancer tetap tampil aktif di sisi klien** (`STATUS` map di `Agreement.js` tidak punya entry `REVOKED` → fallback ke "Waiting for response", tombol Approve/dll masih aktif). Backend sudah benar-benar menolak (bukan celah keamanan), tapi UX-nya menyesatkan. *(commit `cca42b28`)*
   - **Pesan error login/register jadi basi (stale)** kalau submit berikutnya diblokir validasi HTML5 native browser (mis. format email salah tanpa `@`) — `setError(null)` cuma jalan di dalam submit handler yang tidak pernah kepanggil. Fix: error di-clear di setiap `onChange` field, bukan cuma di submit. *(commit `09db806b`)*
8. **Polish**: pesan validasi password pendek diganti dari raw teks Pydantic ("String should have at least 6 characters") jadi "Password must be at least 6 characters." — ditawarkan ke user, dikonfirmasi mau, sudah dikerjakan. *(commit `d75ea72a`)*

### Yang sudah didogfooding manual dan TERBUKTI tidak ada bug

Landing, Judge Mode (8 step penuh), Analyze dengan brief custom Bahasa Indonesia, Login/Register (termasuk duplicate email, password lemah, format email salah), Logout (desktop & mobile — session beneran dihapus di server, bukan cuma redirect kosmetik), Workspace (cost profile Guided & Simple mode, kalibrasi CRUD termasuk delete yang persist), Agreement Sheet dari sisi freelancer & klien (semua status: SENT/APPROVED/CHANGE_REQUESTED/EXPIRED/REVOKED — dicek satu-satu setelah reload, bukan cuma langsung setelah aksi), Decline politely, tone WhatsApp (Warm/Firm/Formal), Formula & assumptions drawer, Copy questions, Copy agreement link, Risk Trigger (low & medium), rute invalid/ID salah, ownership guard (analysis milik akun lain → "Not allowed"), "New analysis" reset bersih.

### Yang masih terbuka (bukan bug, murni keputusan)

- **`memory/test_credentials.md` di branch `master`** — masih ada password test dummy plaintext (`raka@baseline.app` / `baseline123`), sudah ada dari commit awal sebelum Claude ikut kerja. **Sengaja ditunda** atas permintaan user ("ini nanti dulu aja", 2026-08-21) — belum disentuh karena itu di `master`, bukan `rifqi`.
- **PR #1 belum di-review owner** — tidak ada aksi yang perlu diambil Claude, tinggal tunggu.

### Catatan teknis penting

- **Frontend di :3000 adalah static build (`serve -s build`), bukan dev server** — lihat bagian ⚠️ di atas. Ini gotcha paling gampang kelupaan.
- Kalau restart backend setelah edit `.py`, harus **kill proses uvicorn lama dulu** (tidak pakai `--reload`), baru jalankan ulang — cek lewat `Get-CimInstance Win32_Process -Filter "Name='python.exe'"` di PowerShell buat cari PID yang benar (jangan asal kill, ada proses python lain yang tidak terkait, mis. `ollama`).
- Test unit (`pytest tests/ --ignore=backend_test.py`) sengaja dipaksa in-memory DB lewat `tests/conftest.py` (biar tidak bentrok event-loop sama MongoDB asli). Test E2E (`backend_test.py`) baru benar-benar pakai MongoDB asli, butuh server live dulu.
- Kalau browser-automation klik meleset: viewport asli halaman itu ~2048px tapi screenshot tool mengompress ke ~1568px, jadi koordinat klik dari screenshot **tidak akurat**, dan **screenshot tidak mengikuti scroll** (selalu nampilin bagian atas halaman). Selalu pakai `find` + klik berdasarkan `ref`, `form_input` buat isi form, atau `document.querySelector(...).click()` lewat `javascript_tool` — jangan andalkan koordinat mentah atau screenshot buat verifikasi konten yang di-scroll.
- Data test lokal (akun QA, kalibrasi dummy, dst di MongoDB dev) **tidak perlu dibersihkan** — cukup dirapikan kalau memang mau deploy ke server produksi nanti.
