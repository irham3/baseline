# Penugasan AI — §17.3 (P1) + subset aman §17.4 (Post-contest)

**Konteks**: Rifqi minta lanjut kerjakan bagian yang sebelumnya sengaja dilewati. Setelah ditimbang ulang per item (bukan asal ikut), ini cakupan final.

## Riset yang sudah dilakukan (jangan ulang)

- Backend **sudah** mendukung multi-project calibration: `MAX_MEMORY_PROJECTS=5`, endpoint `/api/projects` (GET/POST/DELETE), `calibration_summary()` sudah hitung median + confidence. Frontend `Workspace.js` masih pakai endpoint lama `/api/calibration` (singular) yang **menghapus semua project lain** setiap kali save (`db.projects.delete_many` sebelum insert) — itu sebabnya UI cuma pernah nunjukkan 1 project meski backend sanggup 5.
- Tidak ada endpoint list-analyses sama sekali (`GET /analysis/{id}` butuh ID spesifik). "Rich analysis history" = gap nyata backend+frontend.
- Export PDF: tidak perlu dependency baru — bisa pakai `window.print()` browser native + CSS `@media print`.

## Dikerjakan sekarang

### Batch 1 — Multi-project Personal Estimation Memory (P1 #1, #2, #4)
- Backend: **tidak ada perubahan** (sudah siap).
- FE `Workspace.js`: ganti dari single `cal`/`savedCal` ke list dari `/api/projects`. Form tambah project (field sama seperti sekarang), list project tersimpan dengan delete per-item, tampilkan median factor + confidence + jumlah project, tampilan projected-vs-realized per project.

### Batch 2 — Rich analysis history + filter (P1 #7)
- Backend: endpoint baru `GET /api/analyses` (list milik user, field ringkas: id, brief snippet, profession, readiness_state, price kalau ada, created_at), dukung filter query param (readiness_state, profession).
- FE: bagian baru di Workspace atau halaman `/history` dengan daftar + filter.

### Batch 3 — Export PDF proposal (P1 #8)
- FE only: tombol "Export proposal" di halaman Analysis → `window.print()` + CSS print khusus (deliverables, harga, timeline, revisi — tanpa data cost/margin internal, sama seperti Agreement Sheet).

### Batch 4 — Klarifikasi khusus profesi non-video, tetap critique-only (P1 #5, versi aman)
- HANYA pertanyaan klarifikasi tambahan (auth method, payment method, role, data, deployment) untuk brief yang classify_profession()-nya "general" dan mengandung sinyal software/website.
- TIDAK membangun calibrated price estimator untuk profesi itu — itu butuh validasi nyata dulu (persis kata dokumen), belum ada.

### Batch 5 — Reusable client profile + rate card dari histori sendiri (Post-contest, subset aman)
- Client profile: simpan nama/kontak klien yang pernah dipakai di Agreement Sheet, quick-pick saat bikin agreement baru.
- Rate card: tabel ringkas harga historis **dari project yang sudah dikalibrasi user sendiri** (bukan data eksternal/scrape).

## TIDAK dikerjakan (dengan alasan, sudah dikonfirmasi ke Rifqi)

- Payment gateway, escrow, full contract generator, autonomous negotiation bot — risiko finansial/legal nyata.
- CRM penuh, Kanban, full revision management — beda kategori produk, scope tidak proporsional.
- WhatsApp automation resmi, voice-note transcription, generic PDF parser — butuh infrastruktur/kredensial eksternal yang tidak tersedia.
- Calibrated estimator profesi lain, arbitrary risk score, market-rate scraper — melanggar Trust lens §16.6 dokumen sendiri (fake precision / invented market rate).
- Screenshot OCR (P1 #6) — dependency berat (OCR WASM ~2MB+), risiko akurasi tinggi, prioritas P1 paling rendah nilainya dibanding batch lain. Dicatat sebagai deferred, bukan ditolak permanen.
- Email integration, marketplace export, team workspace, invoice/payment integration, API agency (Post-contest) — butuh infrastruktur eksternal atau redesign multi-tenant besar.
