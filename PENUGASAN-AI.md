# Penugasan AI — Eksekusi Acceptance Clarity + Change Boundary

**Sumber kebenaran**: `RENCANA-acceptance-change-boundary.md` (di folder yang sama). Dokumen ini cuma daftar tugas mekanis dari situ — kalau ada perbedaan, dokumen RENCANA yang menang.
**Otorisasi**: Rifqi memberi izin eksekusi penuh tanpa konfirmasi lanjutan (22 Aug 2026, sebelum meninggalkan laptop). Cakupan kerja **dibatasi** pada isi `RENCANA-acceptance-change-boundary.md` — tidak melebar ke fitur lain di luar dokumen itu, karena hanya dokumen itu yang sudah melalui proses konsep penuh (riset kode + verifikasi asumsi).
**Push**: diizinkan ke `origin/rifqi` setelah tiap fase besar terverifikasi hijau. **Dilarang** push ke `master` atau merge PR #1 — itu tetap keputusan owner repo.

---

## Checklist tugas (urut, jangan lompat)

### FASE 1 — Rule hidup & tampil benar
- [ ] `backend/rules.py`: tambah `_rule_acceptance_criteria`, `_rule_change_boundary`; update `GENERIC_RULES`
- [ ] `frontend/src/components/BriefCritique.js`: tambah 2 key di `CATEGORY_LABEL`
- [ ] `backend/tests/test_rules.py`: tambah 2 field ke `RESOLVED_FIELDS` + 2 test baru
- [ ] Jalankan `pytest tests/ -q --ignore=tests/backend_test.py` → target 108 passed
- [ ] `npm run build` (CI=true) → harus "Compiled successfully"
- [ ] Cek browser: 2 card baru muncul, label benar, badge "Medium impact"

### FASE 2 — Jalur resolve backend + persistensi (D10)
- [ ] `backend/routers/analysis.py`: `_overrides_to_fields()` tambah 2 nama
- [ ] `backend/routers/analysis.py`: blok `$set` di handler estimate tambah `deal_terms`
- [ ] `backend/tests/test_readiness_gate.py`: tambah test resolve + test persistensi reload
- [ ] Jalankan pytest → target 110 passed

### FASE 3 — Input deklarasi FE (titik "fitur selesai")
- [ ] `frontend/src/components/ClarificationGate.js`: tambah helper `DefinitionSelect`
- [ ] `ClarificationGate.js`: tambah blok "Terms you define" dengan 2 dropdown
- [ ] `frontend/src/pages/Analysis.js`: `overridesFromFields()` tambah 2 field
- [ ] `Analysis.js`: merge `deal_terms` saat load (fix D10)
- [ ] `npm run build` ulang
- [ ] Cek browser: isi dropdown → Update → card hilang → **reload → nilai tetap tersimpan, card tetap hilang** (uji D10 eksplisit, bukan cuma klik Update)

### GATE — sebelum lanjut Fase 4-5
- [ ] Semua test backend hijau (110/110)
- [ ] Build frontend sukses
- [ ] Verifikasi browser Fase 1-3 lolos semua termasuk uji reload
- [ ] Kalau ada yang gagal: perbaiki, ulangi dari fase yang gagal, jangan lanjut sebelum hijau
- [ ] `git add` file yang relevan (bukan `.mcp.json`/`components.json`), commit dengan pesan jelas per fase
- [ ] `git push origin rifqi`

### FASE 4 — Ekstraksi dari brief (opsional, lanjut kalau Fase 1-3 solid)
- [ ] `backend/ai_service.py`: `SYSTEM_PROMPT` tambah field group
- [ ] `ai_service.py`: `FIELD_LABELS` tambah 2 entri
- [ ] `ai_service.py`: `_heuristic_extract_scope()` tambah 2 regex block
- [ ] `backend/scope.py`: `_seed_fields()` tambah 2 entri missing
- [ ] `backend/tests/test_ai_provenance.py`: tambah 2 test
- [ ] pytest → target 112 passed
- [ ] Cek Brief Map di browser: 2 baris baru muncul di kolom Missing

### FASE 5 — Bawa ke Agreement Sheet (opsional)
- [ ] `backend/scope.py`: `agreement_snapshot()` terima param `deal_terms`, masukkan ke return dict
- [ ] `backend/routers/agreement.py`: `create_agreement` teruskan `doc.get("deal_terms")`
- [ ] `frontend/src/pages/Agreement.js`: render 2 nilai kalau ada isinya
- [ ] pytest lagi (pastikan `test_agreement_security.py` tetap hijau)
- [ ] Cek browser: buat agreement dari analisis yang punya deal_terms terisi → nilai tampil di lembar

### PENUTUP
- [ ] Commit + push final ke `origin/rifqi`
- [ ] Update `CLAUDE.md` project: jumlah test terbaru (bukan 88 yang basi), status fitur baru
- [ ] Update memory `project-baseline-work.md`: status akhir, apa yang selesai
- [ ] Laporan akhir ke Rifqi: ringkas apa yang dikerjakan, hasil verifikasi, apa yang masih perlu direview manual olehnya

---

## Batas keras (jangan dilanggar meski "tanpa nanya2 lagi")

- Jangan push ke `master`
- Jangan merge/approve PR #1
- Jangan bangun fitur di luar `RENCANA-acceptance-change-boundary.md` (misal fitur lain dari master plan yang belum dikonsepkan)
- Jangan naikkan severity 2 rule baru jadi `high`
- Jangan tambah ke `REQUIRED_FIELDS` atau `build_scope()`
- Jangan commit `frontend/.mcp.json` / `frontend/components.json`
- Kalau nemu masalah yang butuh keputusan produk (bukan teknis) yang benar-benar di luar cakupan dokumen — stop, catat di laporan akhir, jangan tebak sendiri
