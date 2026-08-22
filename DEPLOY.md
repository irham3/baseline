# Deploy Baseline ke Publik — Panduan

**Status kode**: sudah cukup siap production (CORS, cookie secure, koneksi Mongo semuanya sudah env-var driven, bukan hardcode localhost). Satu blocker nyata sudah diperbaiki: `emergentintegrations` di `requirements.txt` bukan paket PyPI publik — sudah dihapus (lihat komentar di file itu), efeknya cuma AI extraction live tetap fallback ke heuristic deterministik seperti yang memang sudah expected & terdokumentasi.

**Yang TIDAK saya kerjakan** (harus kamu sendiri): bikin akun di layanan hosting, generate/paste secret, klik tombol deploy. Ini affects shared/public system — bukan sesuatu yang pantas saya lakukan otomatis.

Estimasi waktu: 30-45 menit kalau lancar. Semua opsi di bawah free tier.

---

## Arsitektur deploy

```
Browser klien
     │
     ▼
Vercel (frontend, static build)  ──HTTPS──▶  Render (backend, FastAPI)  ──▶  MongoDB Atlas
```

3 layanan terpisah, semua free tier:
- **MongoDB Atlas** (M0, gratis selamanya) — database
- **Render** (Free Web Service) — backend FastAPI
- **Vercel** (Hobby, gratis) — frontend static

---

## Langkah 1 — MongoDB Atlas

1. Buka https://www.mongodb.com/cloud/atlas/register, daftar (boleh pakai Google).
2. Buat cluster baru, pilih **M0 Free**, region terdekat (Singapore biasanya paling dekat).
3. **Database Access** → Add New Database User → user/password (catat, nanti dipakai di connection string).
4. **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`).
   - Kenapa: Render free tier tidak punya IP statis, jadi tidak bisa di-allowlist per-IP. Ini standar untuk setup gratis, bukan celah keamanan besar — akses tetap butuh username/password.
5. **Connect** → **Drivers** → copy connection string, bentuknya:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
   Simpan ini — dipakai sebagai `MONGO_URL` di Langkah 2.

---

## Langkah 2 — Backend di Render

1. Buka https://dashboard.render.com, daftar/login (boleh connect ke akun GitHub kamu langsung).
2. **New** → **Blueprint** → pilih repo `irham3/baseline`, branch **`rifqi`**.
   - Render akan baca `render.yaml` di root repo otomatis (sudah disiapkan).
3. Saat diminta isi environment variables (yang `sync: false` di `render.yaml`), isi:
   - `JWT_SECRET` — generate baru, **jangan pakai yang di `backend/.env` lokal**. Cara generate cepat lewat PowerShell:
     ```powershell
     -join ((48..57)+(65..90)+(97..122)|Get-Random -Count 48|%{[char]$_})
     ```
   - `MONGO_URL` — connection string dari Langkah 1 (tambahkan nama database di path kalau perlu, mis. `.../baseline_prod?retryWrites=true...`)
   - `CORS_ORIGINS` — **isi sementara dengan placeholder** `https://placeholder.vercel.app`, nanti diupdate di Langkah 4 setelah tahu URL Vercel asli (Render dan Vercel saling butuh URL satu sama lain, jadi wajar bolak-balik sedikit).
   - `GOOGLE_CLIENT_ID` — kosongkan dulu (opsional, lihat Langkah 5).
4. Deploy. Tunggu build selesai (~2-3 menit). Render kasih URL publik bentuknya `https://baseline-api-xxxx.onrender.com`.
5. Cek hidup: buka `https://baseline-api-xxxx.onrender.com/api/health` di browser — harus muncul JSON `{"status":"ok",...}`.

> ⚠️ **Catatan free tier Render**: web service gratis "tidur" setelah 15 menit tanpa traffic, request pertama setelah itu bisa lambat (~30-50 detik cold start). Kalau demo kontes butuh responsif instan, siap-siap buka linknya beberapa menit sebelum demo biar "bangun" dulu.

---

## Langkah 3 — Frontend di Vercel

1. Buka https://vercel.com, daftar/login (connect GitHub).
2. **Add New** → **Project** → pilih repo `irham3/baseline`.
3. **Root Directory** → set ke `frontend` (penting, karena app-nya ada di subfolder, bukan root repo).
4. Framework Preset: Vercel biasanya auto-detect "Create React App" — kalau tidak, set manual: Build Command `npm run build`, Output Directory `build`.
5. **Environment Variables** → tambah:
   - `REACT_APP_BACKEND_URL` = `https://baseline-api-xxxx.onrender.com` (URL Render dari Langkah 2, **tanpa** `/api` di akhir — kode yang nambahin sendiri)
6. Deploy. Vercel kasih URL bentuknya `https://baseline-xxxx.vercel.app`.

---

## Langkah 4 — Sambungkan balik CORS

Sekarang sudah tahu URL Vercel asli:

1. Balik ke Render dashboard → service `baseline-api` → **Environment** → update `CORS_ORIGINS` jadi URL Vercel asli, persis (termasuk `https://`, tanpa trailing slash):
   ```
   CORS_ORIGINS=https://baseline-xxxx.vercel.app
   ```
2. Render akan auto-redeploy setelah env var diubah. Tunggu selesai.

---

## Langkah 5 — Google OAuth (opsional, boleh dilewati)

Guest demo sudah jalan penuh tanpa ini (syarat P0 dokumen: "Judge Mode tanpa login"). Kalau mau login Google beneran aktif di production:

1. https://console.cloud.google.com → buat project baru (atau pakai yang ada) → **APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID** → Application type: **Web application**.
3. **Authorized JavaScript origins** → tambahkan `https://baseline-xxxx.vercel.app` (URL Vercel asli).
4. Copy Client ID, isi di:
   - Vercel → env var `REACT_APP_GOOGLE_CLIENT_ID` → redeploy frontend.
   - Render → env var `GOOGLE_CLIENT_ID` (nilai sama) → auto-redeploy.

> Catatan: ada satu jalur login Google alternatif di kode (`/api/google/session`, dipakai untuk skenario tertentu) yang bergantung pada backend Emergent (`demobackend.emergentagent.com`) — itu spesifik platform Emergent dan kemungkinan **tidak** akan berfungsi di luar sana. Bukan masalah: jalur utama (Google Identity Services langsung via `GOOGLE_CLIENT_ID` di atas) tidak bergantung pada itu sama sekali.

---

## Checklist verifikasi akhir (Lampiran G "Contest" di master plan)

- [ ] Buka `https://baseline-xxxx.vercel.app` — landing muncul, tidak ada CORS error di console
- [ ] `Try the 90-second demo` (Judge Mode) jalan penuh 8 langkah tanpa login
- [ ] `Analyze Scope` dengan brief asli → dapat hasil kritik
- [ ] Buka di **jendela incognito** — pastikan tidak ada state/login yang bocor dari sesi dev kamu
- [ ] Cek Network tab browser — pastikan tidak ada request ke `localhost` yang nyangkut
- [ ] Cek tidak ada secret/data pribadi ke-expose di response API (`/api/health` tidak boleh bocorkan `MONGO_URL` mentah dll — ini sudah ditest di `test_infra.py`)
- [ ] Share link ke satu orang lain, minta mereka coba dari device/jaringan berbeda (bukan cuma laptopmu)

---

## Kalau ada masalah

- **CORS error di browser console** → cek `CORS_ORIGINS` di Render persis sama dengan URL Vercel (termasuk https://, tanpa trailing slash), lalu tunggu redeploy Render selesai.
- **Backend 502/timeout pertama kali** → free tier Render cold start, tunggu ~30-50 detik lalu refresh.
- **MongoDB connection error** → cek Network Access di Atlas sudah `0.0.0.0/0`, dan password di connection string tidak mengandung karakter spesial yang belum di-URL-encode (`@`, `#`, dll perlu di-encode kalau ada di password).
