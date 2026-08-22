# Rencana Eksekusi — Melengkapi 2 Kriteria Generic Deal Rule Pack

**Status**: konsep **FINAL**. Tidak ada keputusan yang menggantung. Belum ada satu baris kode pun ditulis.
**Dibuat**: 22 Agustus 2026 · **Branch**: `rifqi`
**Konteks**: `BASELINE_MASTER_PLAN_v1.3_REVISED.md` §4.3 mendefinisikan **9 kriteria universal**; `backend/rules.py` baru mengimplementasi **7**.

---

## 0. Jawaban langsung atas 3 pertanyaan

| Pertanyaan | Jawaban | Bukti |
|---|---|---|
| **Perlu page baru?** | **TIDAK.** Nol halaman baru. | Alur analisis sudah lengkap: `BriefInputBox` → `POST /analyze` → `/analysis/{id}` (`Analysis.js`) yang sudah merender `BriefCritique` + `ClarificationGate`. |
| **Perlu component file baru?** | **TIDAK.** Satu helper `DefinitionSelect` ditulis **di dalam** `ClarificationGate.js`. | Mengikuti gaya file itu sendiri — `Toggle` dan `NumberInput` juga helper lokal di file yang sama, bukan file terpisah. |
| **Perlu endpoint/model BE baru?** | **TIDAK.** Nol route baru, nol Pydantic model baru, nol koleksi DB baru, nol migrasi, nol dependency baru. | `EstimateBody.scope_overrides` bertipe `dict` bebas (models.py:53) — menambah 2 key tidak butuh perubahan model. `deal_issues` sudah tersimpan di dokumen analisis. |

**Yang benar-benar berubah**: 5 file inti + 2 file test (Fase 1–3). Ditambah 4 file lagi kalau Fase 4–5 dikerjakan.

---

## 0.1 Tingkat keyakinan — apa yang terbukti vs apa yang masih risiko

Supaya jujur: tidak semua isi dokumen ini punya derajat kepastian yang sama.

### Terbukti dengan membaca/menjalankan kode (keyakinan tinggi)

| Klaim | Cara diverifikasi |
|---|---|
| Tidak perlu endpoint/model baru | `EstimateBody.scope_overrides: dict` bebas (models.py:53) |
| Tidak perlu page baru | Alur `/analysis/{id}` sudah merender kedua komponen |
| Hanya `Analysis.js` yang membangun overrides | `grep -rn "scope_overrides" frontend/src/` → 1 file |
| Judge Mode tidak terpengaruh | Semua panggilan API-nya sudah dienumerasi; tidak ada `/api/analyze` |
| Baseline 106 test | `pytest` dijalankan langsung |
| Tak ada test yang mengunci jumlah issue / `snapshot_hash` | grep seluruh `backend/tests/` |
| `severity="medium"` tidak menggerbang readiness | Baca `compute_readiness_state()` |
| `REQUIRED_FIELDS` list eksplisit → completeness aman | Baca scope.py:22, 47 |
| Token CSS (`field-label`, `input`, `border-line/15`) ada | grep `index.css` + pemakaian existing |
| `clean()` tidak membuang `deal_terms` | Baca core.py:268 |
| `React.useState` tersedia di ClarificationGate.js | Baris 1 mengimpor `React` default |

### Dirancang tapi belum pernah dikompilasi/dijalankan (risiko sisa)

| Item | Risiko | Mitigasi |
|---|---|---|
| Potongan JSX `DefinitionSelect` | Typo/JSX error tidak akan ketahuan sampai `npm run build` | Build wajib sebelum cek browser; error-nya eksplisit dan cepat diperbaiki |
| Regex Fase 4 | Regex paling gampang meleset — belum pernah dijalankan sama sekali | Sudah ada test khusus; Fase 4 opsional dan terisolasi |
| Nomor baris di dokumen ini | Bergeser begitu fase sebelumnya diterapkan | Pakai sebagai petunjuk arah, cari anchor-nya (nama fungsi), jangan telan mentah |
| Rendering Fase 5 di `Agreement.js` | Satu-satunya bagian yang belum saya tetapkan penempatan persisnya | Fase 5 opsional; tetapkan saat mengerjakannya |

**Kesimpulan jujur**: keputusan arsitektur (API, page, komponen, jalur data) — **yakin, karena diverifikasi ke kode**. Detail sintaks kode — **belum bisa 100% sebelum dikompilasi**, dan itu memang normal; yang penting kegagalannya cepat ketahuan lewat `pytest` + `npm run build`, bukan diam-diam.

---

## 1. Verifikasi kelengkapan — benar hanya 2 yang hilang

Pemetaan 9 kriteria §4.3 ke kode aktual, dicek satu per satu:

| # | Kriteria §4.3 | Fungsi di `rules.py` | `rule_category` | Status |
|---|---|---|---|---|
| 1 | Deliverable clarity | `_rule_deliverable_quantity`, `_rule_final_duration` | `deliverable_clarity` | ✅ |
| 2 | **Acceptance clarity** | — | — | ❌ **HILANG** |
| 3 | Input responsibility | `_rule_footage_responsibility` | `input_responsibility` | ✅ |
| 4 | Dependency | `_rule_deadline_dependency` (cabang footage) | `timeline` | ✅ |
| 5 | Timeline condition | `_rule_deadline_dependency` (cabang deadline) | `timeline` | ✅ |
| 6 | Approver | `_rule_approver` | `approval_flow` | ✅ |
| 7 | Revision boundary | `_rule_revision_boundary` | `revision_boundary` | ✅ |
| 8 | **Change boundary** | — | — | ❌ **HILANG** |
| 9 | Commercial clarity | `_rule_budget_anchor` | `commercial_clarity` | ✅ |

**Terkonfirmasi 7/9.** Tidak ada kriteria lain yang terlewat.

---

## 2. Insight utama — kenapa 2 kriteria ini beda dari 7 lainnya

Baca ini dulu; semua keputusan di bawah berakar di sini.

**7 rule yang ada bertanya: _"apakah KLIEN menyebut X?"_**
Quantity, revision rounds, deadline, approver, footage — wajar muncul di brief WhatsApp. Kalau tidak disebut, freelancer tinggal **bertanya**.

**2 rule baru bertanya: _"apakah KAMU sudah mendefinisikan X?"_**
Klien nyaris tidak pernah menulis definisi "selesai" atau batas perubahan konsep. Itu memang bukan tugasnya — **itu tugas freelancer untuk menetapkan.**

Konsekuensi langsung:

> Kalau hanya rule-nya yang ditambahkan (rencana lama), kedua card **muncul selamanya di setiap analisis dan tidak akan pernah bisa hilang** — tidak ada field yang bisa mengisinya. Itu hiasan, bukan alat.

Karena itu pekerjaannya bukan "tambah 2 rule", tapi **menutup loop**: rule muncul → user mendeklarasikan → issue resolved → card hilang. Persis seperti 7 rule lain. Inilah asal-usul pekerjaan FE-nya.

---

## 3. Sembilan keputusan desain — semua sudah final

| # | Keputusan | Nilai final | Alasan singkat |
|---|---|---|---|
| **D1** | Severity kedua rule | `medium` | `high` membekukan readiness gate permanen |
| **D2** | Cara resolve | Deklarasi user + ekstraksi opsional | Pakai ulang mekanisme `_overrides_to_fields` yang sudah ada |
| **D3** | Bentuk input FE | Dropdown preset + Custom | Preset mengajari; textarea kosong memindahkan PR ke user |
| **D4** | Masuk `REQUIRED_FIELDS`? | **Tidak** | Itu daftar input estimasi; ini bukan input estimasi |
| **D5** | Masuk `build_scope()`? | **Tidak** | `scope` dikonsumsi `estimate_hours()`; nol pengaruh ke jam |
| **D6** | Bikin clarification question baru? | **Tidak** | Ini bukan pertanyaan untuk klien; juga menjaga assert `3 ≤ len(clars) ≤ 6` di E2E |
| **D7** | Mode custom di FE | State lokal terpisah | Menghindari hack nilai `" "`; nilai tetap jujur `null` sampai diketik |
| **D8** | Ubah `_seed_fields()`? | Hanya di Fase 4 | Supaya Brief Map & ekstraksi berubah bersamaan, tidak sepotong |
| **D9** | Jalur data ke Agreement | `doc["deal_terms"]` terpisah | Menjaga D5 — `scope` tetap murni input pricing |
| **D10** | **Persistensi setelah reload** | **`deal_terms` ditulis di Fase 2, di-merge di Fase 3** | **Wajib — tanpa ini nilainya hilang saat reload. Lihat §3.1** |

### D10 — lubang persistensi yang WAJIB ditutup (ditemukan saat verifikasi ulang)

`Analysis.js:115` memulihkan overrides begini:

```js
setOverrides(r.data.scope_used || overridesFromFields(r.data.fields || []));
```

`scope_used` diisi dari `build_scope()` (analysis.py:48-71) yang mengembalikan **dict dengan key tetap** — dan karena D5 melarang menambah kedua field ke sana, `acceptance_criteria` & `change_boundary` **tidak ikut tersimpan di `scope_used`**.

**Akibatnya kalau ini tidak ditangani:**

1. User isi kedua dropdown → klik Update → card hilang ✅ (backend benar, `deal_issues` tersimpan resolved)
2. User **reload halaman** → `overrides` dipulihkan dari `scope_used` → **kedua nilai hilang diam-diam**, dropdown balik ke "Not defined yet"
3. Card tetap tersembunyi (karena `deal_issues` tersimpan di server sudah resolved) → **tampilan jadi bohong**: dropdown kosong tapi card bilang beres
4. User klik Update sekali lagi → **kedua card muncul lagi** tanpa sebab yang jelas

Ini bug data-loss, bukan kosmetik. Solusinya: tulis `deal_terms` di handler estimate (Fase 2) dan merge saat load (Fase 3). Mekanisme yang sama nantinya dipakai ulang oleh Fase 5, jadi tidak ada pekerjaan terbuang.

> Catatan: `runEstimate` di `Analysis.js` **tidak** memanggil `setOverrides`, jadi selama sesi berjalan nilainya aman. Masalahnya murni muncul saat reload. Ini yang bikin lubangnya gampang lolos kalau verifikasinya cuma "klik Update, card hilang, selesai".

### D1 — kenapa `medium`, bukan `high`

`compute_readiness_state()` hanya menggerbang `severity == "high"`:

```python
has_high = any(i["severity"] == "high" and i["status"] == "open" for i in issues)
```

Kalau `high`, **setiap analisis baru langsung `not_ready_to_quote`** sampai user menulis definition of done. Tiga alasan menolak:

1. **Substansi** — keduanya tidak mengubah perhitungan jam. Yang mengubah jam: quantity, durasi, revision rounds. Readiness gate di app ini spesifik menggerbang *estimasi*.
2. **Konsistensi internal** — `final_approver`, yang di Lampiran B master plan berada di grup **Acceptance** yang sama, sudah `medium`. Menaruh saudaranya di `high` tidak konsisten.
3. **Sinyal** — kalau hampir semua analisis merah, banner "Not ready to quote" kehilangan arti.

**Sudah diverifikasi**: `test_readiness_gate.py` hanya meng-assert `readiness_state`, dan **tidak ada satu pun test** di seluruh `backend/tests/` yang mengunci jumlah issue. Dengan `medium`, semua test existing tetap hijau.

### D2 — alur resolusi dua jalur

```
Klien kebetulan menyebut ──► ai_service ekstrak ──► status "stated" + quote asli ──► rule diam
                                                                                      (Fase 4)
Klien tidak menyebut (normal)
        │
        └─► status "missing" ──► card kritik muncul                                   (Fase 1)
                                       │
                                       └─► user pilih preset di Clarification Gate    (Fase 3)
                                             └─► masuk `overrides`
                                                   └─► `_overrides_to_fields()`        (Fase 2)
                                                         └─► rule di-run ulang ──► card hilang ✅
```

Tidak ada arsitektur baru. Semuanya memakai ulang jalur yang sudah berjalan untuk 7 rule lain.

---

## 4. Peta dampak — apa yang tersentuh dan apa yang TIDAK

### Tersentuh

| File | Perubahan | Fase |
|---|---|---|
| `backend/rules.py` | 2 fungsi rule + 2 entri `GENERIC_RULES` | 1 |
| `frontend/src/components/BriefCritique.js` | `CATEGORY_LABEL` + 2 key | **1** |
| `backend/tests/test_rules.py` | 2 field ke `RESOLVED_FIELDS` + 2 test | 1 |
| `backend/routers/analysis.py` | `_overrides_to_fields()` + 2 nama, **dan `deal_terms` di `$set` (D10)** | 2 |
| `backend/tests/test_readiness_gate.py` | 2 test: loop resolve + persistensi | 2 |
| `frontend/src/components/ClarificationGate.js` | helper `DefinitionSelect` + blok baru | 3 |
| `frontend/src/pages/Analysis.js` | `overridesFromFields()` + 2 field, **dan merge `deal_terms` (D10)** | 3 |
| `backend/ai_service.py` | prompt, labels, regex heuristik | 4 (opsional) |
| `backend/scope.py` | `_seed_fields()`, `agreement_snapshot()` | 4, 5 (opsional) |
| `backend/routers/agreement.py` | teruskan `deal_terms` | 5 (opsional) |
| `frontend/src/pages/Agreement.js` | render 2 baris | 5 (opsional) |

### TIDAK tersentuh — sudah diverifikasi, bukan asumsi

| Komponen | Kenapa aman |
|---|---|
| `frontend/src/pages/Judge.js` | Judge Mode **hanya** memanggil `/demo/seed`, `/demo/agreement`, `/agreement/{token}/respond`. **Tidak pernah** memanggil `/api/analyze`, dan **tidak merender `BriefCritique`**. Narasinya hardcoded. → **Judge Mode tidak berubah sama sekali di Fase 1–3.** |
| `frontend/src/pages/Analyze.js` | Halaman penjelasan/marketing. Nol panggilan API, nol render critique. |
| `frontend/src/pages/Workspace.js` | Tidak merender critique maupun clarification gate. |
| `backend/models.py` | `scope_overrides: dict` bebas — tidak butuh field baru. |
| `pricing.py`, `estimate_hours()` | Kedua field nol pengaruh ke jam (D5). |
| `compute_scope_completeness()` | `REQUIRED_FIELDS` adalah list eksplisit; menambah key ke `overrides` tidak mengubah persentase (D4). |
| `run_generic_deal_rules()` | Loop-nya sudah generic. |
| `compute_readiness_state()` | `medium` tidak menyentuh gerbangnya. |
| Database | `deal_issues` sudah tersimpan; tidak ada skema/migrasi. |

> ⚠️ **`BriefCritique.js` WAJIB ikut Fase 1, tidak boleh ditunda.** `CATEGORY_LABEL` belum punya key `acceptance_clarity` / `change_boundary`, dan fallback-nya `issue.rule_category` mentah — card akan menampilkan tulisan `acceptance_clarity` apa adanya di UI.

### Satu efek yang memang disengaja

Brief seed (`SEED_BRIEF` / `SEED_BRIEF_ID`) yang dijalankan lewat `POST /api/analyze` **akan** mendapat 2 card kritik baru. Itu **benar** — brief seed memang tidak menyebut acceptance criteria maupun change boundary. Ini terjadi di halaman `/analysis/{id}`, **bukan** di Judge Mode.

---

## 5. FASE 1 — Rule hidup & tampil benar

**Tujuan**: 2 card kritik baru muncul dengan label benar. Belum bisa dihilangkan — itu *expected*.

### 1a. `backend/rules.py` — taruh setelah `_rule_approver` (baris 142), sebelum `_rule_budget_anchor`

```python
def _rule_acceptance_criteria(fields):
    ac = _field(fields, "acceptance_criteria")
    if _missing(ac):
        return _issue(
            "acceptance_criteria", "Definition of done is not agreed",
            "Without a stated condition for what counts as accepted, sign-off can be withheld indefinitely and every further request still looks reasonable.",
            "medium", "acceptance_clarity", _evidence(ac), ["acceptance", "timeline"],
        )
    return None


def _rule_change_boundary(fields):
    cb = _field(fields, "change_boundary")
    if _missing(cb):
        return _issue(
            "change_boundary", "Concept change is not separated from revision",
            "Without a line between fixing the agreed cut and asking for something new, concept, format, or feature changes get absorbed as free revisions.",
            "medium", "change_boundary", _evidence(cb), ["cost", "effort", "revision"],
        )
    return None
```

### 1b. `backend/rules.py` — ganti `GENERIC_RULES` (baris 159)

Urutan = prioritas tampil, mengikuti urutan kategori §4.3:

```python
GENERIC_RULES = [
    _rule_revision_boundary,
    _rule_deliverable_quantity,
    _rule_acceptance_criteria,   # BARU
    _rule_final_duration,
    _rule_footage_responsibility,
    _rule_deadline_dependency,
    _rule_approver,
    _rule_change_boundary,       # BARU
]
```

`run_generic_deal_rules()` **tidak diubah** — loop-nya sudah generic dan `_rule_budget_anchor` tetap di-append terpisah di luar loop.

### 1c. `frontend/src/components/BriefCritique.js` — `CATEGORY_LABEL` (baris 27)

```js
const CATEGORY_LABEL = {
  revision_boundary: "Revision boundary",
  deliverable_clarity: "Deliverable clarity",
  acceptance_clarity: "Acceptance clarity",   // BARU
  input_responsibility: "Input responsibility",
  timeline: "Timeline",
  approval_flow: "Approval flow",
  change_boundary: "Change boundary",         // BARU
  commercial_clarity: "Commercial clarity",
};
```

### 1d. `backend/tests/test_rules.py`

Tambah ke `RESOLVED_FIELDS` (baris 9–18) — **tanpa ini `test_no_issues_when_everything_resolved()` gagal**:

```python
    _field("acceptance_criteria", "approved once the final cut is delivered",
           quote="approved once the final cut is delivered"),
    _field("change_boundary", "concept changes after approval are new scope",
           quote="concept changes after approval are new scope"),
```

Tambah 2 test:

```python
def test_missing_acceptance_criteria_is_medium_severity():
    fields = [f for f in RESOLVED_FIELDS if f["name"] != "acceptance_criteria"]
    issues = rules.run_generic_deal_rules(fields, [])
    issue = _by_rule(issues, "acceptance_criteria")
    assert issue is not None
    assert issue["severity"] == "medium"
    assert issue["evidence"] is None


def test_missing_change_boundary_is_medium_severity():
    fields = [f for f in RESOLVED_FIELDS if f["name"] != "change_boundary"]
    issues = rules.run_generic_deal_rules(fields, [])
    issue = _by_rule(issues, "change_boundary")
    assert issue is not None
    assert issue["severity"] == "medium"
```

### Verifikasi Fase 1

```powershell
cd C:\Users\ASUS\Projects\baseline-app\backend
.venv\Scripts\python.exe -m pytest tests\ -q --ignore=tests\backend_test.py
```
**Target: 108 passed** (baseline terukur hari ini = **106**, bukan 88 seperti tertulis di CLAUDE.md — angka itu sudah basi).

```powershell
cd C:\Users\ASUS\Projects\baseline-app\frontend
$env:CI="true"; npm run build
```

Lalu di browser (`http://localhost:3000`), analisis brief apa pun → halaman `/analysis/{id}`:
- 2 card baru muncul, label **"Acceptance clarity"** & **"Change boundary"** (bukan snake_case)
- Badge **"Medium impact"**
- Evidence: "Not stated in the brief"
- Banner readiness **tidak** berubah jadi merah

---

## 6. FASE 2 — Jalur resolve di backend

**Tujuan**: backend siap menerima jawaban. Belum ada perubahan visual.

### 2a. `backend/routers/analysis.py` — `_overrides_to_fields()` (baris 200)

```python
    names = ("quantity", "revision_rounds", "final_duration", "footage_available",
             "footage_preselected", "deadline_working_days", "approver_count", "client_budget",
             "acceptance_criteria", "change_boundary")
```

Hanya itu. Logika `status: "missing" if value in (None, "")` sudah cocok untuk nilai string.

### 2b. `backend/routers/analysis.py` — handler `estimate`, blok `$set` (baris 256) — **wajib (D10)**

Tambahkan satu key supaya kedua nilai bertahan setelah reload:

```python
            "deal_terms": {
                "acceptance_criteria": body.scope_overrides.get("acceptance_criteria"),
                "change_boundary": body.scope_overrides.get("change_boundary"),
            },
```

`GET /analysis/{id}` mengembalikan `clean(doc)`, dan `clean()` hanya membuang `_id` + `password_hash` (core.py:268) — jadi `deal_terms` otomatis ikut terkirim ke frontend. Tidak perlu endpoint atau serializer baru.

### 2c. `backend/tests/test_readiness_gate.py`

```python
def test_acceptance_and_change_boundary_resolve_from_overrides():
    headers = _guest_headers()
    doc = _analyze("Need 10 Reels for a campaign, footage ready, budget 6M.", headers)

    overrides = {
        **FULLY_RESOLVED_OVERRIDES,
        "acceptance_criteria": "approved once the final cut is delivered",
        "change_boundary": "concept changes after approval are new scope",
    }
    r = client.post(f"/api/analysis/{doc['analysis_id']}/estimate", headers=headers, json={
        "cost_profile": COST_PROFILE, "scope_overrides": overrides,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    rule_ids = [i["rule_id"] for i in data["deal_issues"]]
    assert "acceptance_criteria" not in rule_ids
    assert "change_boundary" not in rule_ids
    # Kedua field ini medium -> tidak boleh mengubah gerbang readiness.
    assert data["readiness_state"] == "ready_to_estimate"


def test_deal_terms_survive_reload(headers=None):
    """D10: nilai yang dideklarasikan user harus bertahan di GET setelah estimate,
    karena build_scope() sengaja tidak membawanya di scope_used."""
    headers = _guest_headers()
    doc = _analyze("Need 10 Reels for a campaign, footage ready, budget 6M.", headers)
    overrides = {
        **FULLY_RESOLVED_OVERRIDES,
        "acceptance_criteria": "approved once the final cut is delivered",
        "change_boundary": "concept changes after approval are new scope",
    }
    client.post(f"/api/analysis/{doc['analysis_id']}/estimate", headers=headers, json={
        "cost_profile": COST_PROFILE, "scope_overrides": overrides,
    })
    r = client.get(f"/api/analysis/{doc['analysis_id']}", headers=headers)
    assert r.status_code == 200, r.text
    terms = r.json().get("deal_terms") or {}
    assert terms.get("acceptance_criteria") == "approved once the final cut is delivered"
    assert terms.get("change_boundary") == "concept changes after approval are new scope"
```

### Verifikasi Fase 2

```powershell
cd C:\Users\ASUS\Projects\baseline-app\backend
.venv\Scripts\python.exe -m pytest tests\ -q --ignore=tests\backend_test.py
```
**Target: 110 passed.**

---

## 7. FASE 3 — Input deklarasi di frontend ← **titik "fitur selesai"**

### 3a. `frontend/src/components/ClarificationGate.js` — helper baru setelah `NumberInput` (baris 52)

```jsx
function DefinitionSelect({ label, hint, value, onChange, presets, testid }) {
  const [custom, setCustom] = React.useState(() => !!value && !presets.includes(value));

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === "__custom") {
      setCustom(true);
      onChange(null);
      return;
    }
    setCustom(false);
    onChange(v === "" ? null : v);
  };

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select
        name={testid}
        className="input"
        value={custom ? "__custom" : value ?? ""}
        onChange={handleSelect}
        data-testid={testid}
      >
        <option value="">Not defined yet</option>
        {presets.map((p) => <option key={p} value={p}>{p}</option>)}
        <option value="__custom">Custom&hellip;</option>
      </select>
      {custom && (
        <input
          type="text"
          className="input mt-2"
          value={value ?? ""}
          placeholder={hint}
          onChange={(e) => onChange(e.target.value || null)}
          data-testid={`${testid}-custom`}
        />
      )}
    </label>
  );
}
```

> **Kenapa state lokal (D7)**: nilai tetap `null` sampai user benar-benar mengetik, jadi tidak ada nilai palsu yang lolos `_missing()` di backend. Aman terhadap load async — `Analysis.js` baru merender gate setelah `overrides` terisi (baris 245), jadi inisialisasi `useState` melihat nilai asli.

### 3b. `ClarificationGate.js` — blok baru, taruh **setelah** grid Toggle (baris 133) dan **sebelum** tombol `onRecalc`

```jsx
        <div className="mt-4 border-t border-line/15 pt-4">
          <h5 className="text-sm font-bold text-ink">Terms you define</h5>
          <p className="mb-3 mt-0.5 text-[13px] text-ink-faint">
            Clients rarely state these. Setting them now is what stops silent scope creep later.
          </p>
          <div className="grid gap-3">
            <DefinitionSelect
              label="Definition of done"
              hint="e.g. approved in writing by the marketing lead"
              value={overrides.acceptance_criteria}
              onChange={(v) => set("acceptance_criteria", v)}
              testid="ov-acceptance"
              presets={[
                "Approved when the final cut matches the agreed brief",
                "Approved in writing by the named final approver",
                "Auto-approved if no consolidated feedback arrives in 3 working days",
              ]}
            />
            <DefinitionSelect
              label="Change boundary"
              hint="e.g. a new platform or aspect ratio is new scope"
              value={overrides.change_boundary}
              onChange={(v) => set("change_boundary", v)}
              testid="ov-change-boundary"
              presets={[
                "Concept, script, or format changes after approval are new scope",
                "Only fixes to the agreed cut count as a revision",
                "Adding videos, platforms, or aspect ratios is new scope",
              ]}
            />
          </div>
        </div>
```

> Ditaruh di blok terpisah dengan judul sendiri, bukan diselipkan di antara NumberInput, karena secara makna beda: grid atas = *jawaban tentang brief klien*, blok ini = *syarat yang kamu tetapkan sendiri*.

### 3c. `frontend/src/pages/Analysis.js` — `overridesFromFields()` (baris 40–54)

Tambahkan di objek return:

```js
    acceptance_criteria: get("acceptance_criteria")?.value ?? null,
    change_boundary: get("change_boundary")?.value ?? null,
```

### 3d. `frontend/src/pages/Analysis.js` — pemulihan overrides (baris 115) — **wajib (D10)**

Ganti:

```js
        setOverrides(r.data.scope_used || overridesFromFields(r.data.fields || []));
```

menjadi:

```js
        const base = r.data.scope_used || overridesFromFields(r.data.fields || []);
        setOverrides({ ...base, ...(r.data.deal_terms || {}) });
```

`scope_used` sengaja tidak membawa kedua field (D5), jadi `deal_terms` yang memulihkannya. Kalau `deal_terms` belum ada (analisis lama, atau belum pernah di-estimate), spread objek kosong tidak mengubah apa pun — **aman mundur untuk semua analisis yang sudah tersimpan**.

### Verifikasi Fase 3 — wajib di browser, bukan cuma test

1. `$env:CI="true"; npm run build` — **wajib**, port 3000 itu static build (lihat CLAUDE.md).
2. Buka `http://localhost:3000`, analisis brief apa pun.
3. Konfirmasi 2 card kritik muncul.
4. Scroll ke "Terms you define" → pilih preset di kedua dropdown → klik **"Calculate estimate"** / **"Update scope critique"**.
5. **Kriteria sukses: kedua card hilang**, hitungan issue di banner berkurang 2.
6. Uji "Custom…" → field teks muncul → ketik → Update → card tetap hilang.
7. Reload halaman → pilihan masih tersimpan (datang dari `scope_used`).

> Ikuti gotcha browser automation yang sudah tercatat: pakai `find` + `ref` atau `form_input`; jangan andalkan koordinat screenshot mentah, dan verifikasi hover/animasi lewat screenshot langsung sebelum `getComputedStyle`.

**Setelah Fase 3 lolos, fitur ini utuh dan layak di-push.**

---

## 8. FASE 4 — Ekstraksi dari brief *(opsional)*

**Tujuan**: kalau klien kebetulan menyebutkan, card membawa evidence quote asli dan langsung tidak muncul. Sekaligus kedua dimensi ini tampil di Brief Map.

### 4a. `backend/ai_service.py` — `SYSTEM_PROMPT`, blok FIELDS (setelah baris 53)

```
Acceptance & change: acceptance_criteria, change_boundary
```

### 4b. `FIELD_LABELS` (baris 94)

```python
    "acceptance_criteria": "Definition of done",
    "change_boundary": "Change boundary",
```

`FIELD_ALIASES` dan `_normalize_field_value()` **tidak perlu diubah** — nilainya string bebas, jatuh ke `return value` di akhir fungsi.

### 4c. `_heuristic_extract_scope()` — sebelum blok `return` (baris 509)

```python
    acc_match = re.search(
        r"\b(?:dianggap\s+)?(?:selesai|beres|acc|approve\w*|fix|final)\s+"
        r"(?:kalau|kalo|jika|apabila|setelah|begitu)\s+[^.,;\n]{3,80}",
        brief, re.IGNORECASE)
    if acc_match:
        quote = acc_match.group(0).strip()
        fields.append({"name": "acceptance_criteria", "value": quote, "status": "stated",
                       "source_quote": quote, "confidence": 0.75, "inference_explanation": None})
    else:
        fields.append({"name": "acceptance_criteria", "value": None, "status": "missing",
                       "source_quote": None, "confidence": 0.5})

    cb_match = re.search(
        r"\b(?:ganti|ubah|perubahan|revisi)\s+(?:konsep|concept|format|storyboard|ide)\b[^.,;\n]{0,60}",
        brief, re.IGNORECASE)
    if cb_match:
        quote = cb_match.group(0).strip()
        fields.append({"name": "change_boundary", "value": quote, "status": "stated",
                       "source_quote": quote, "confidence": 0.70, "inference_explanation": None})
    else:
        fields.append({"name": "change_boundary", "value": None, "status": "missing",
                       "source_quote": None, "confidence": 0.5})
```

> **Regex ini sengaja recall-nya rendah.** Aturan evidence app ini menganggap `stated` palsu jauh lebih berbahaya daripada `missing`. `.strip()` aman terhadap assert verbatim di E2E (`backend_test.py:88`) karena hanya membuang spasi tepi — hasilnya tetap substring dari brief.

### 4d. `backend/scope.py` — `_seed_fields()` (D8)

Tambahkan 2 entri missing supaya Brief Map demo konsisten dengan card kritiknya:

```python
        {"name": "acceptance_criteria", "label": "Definition of done", "value": None,
         "status": "missing", "source_quote": None, "confidence": 1.0},
        {"name": "change_boundary", "label": "Change boundary", "value": None,
         "status": "missing", "source_quote": None, "confidence": 1.0},
```

### 4e. `backend/tests/test_ai_provenance.py`

```python
def test_heuristic_extracts_acceptance_criteria_when_stated():
    result = ai_service.extract_scope_heuristic(
        "Butuh 5 video, dianggap selesai kalau sudah di-approve tim marketing")
    f = _field(result, "acceptance_criteria")
    assert f["status"] == "stated"
    assert f["source_quote"] in "Butuh 5 video, dianggap selesai kalau sudah di-approve tim marketing"


def test_heuristic_leaves_acceptance_and_change_boundary_missing_by_default():
    result = ai_service.extract_scope_heuristic("Butuh 10 reels, budget 5jt, revisi 2x")
    assert _field(result, "acceptance_criteria")["status"] == "missing"
    assert _field(result, "change_boundary")["status"] == "missing"
```

### Verifikasi Fase 4

`pytest tests\ -q --ignore=tests\backend_test.py` → **111 passed**. Lalu cek Brief Map di browser: 2 baris baru muncul di kolom "Missing".

> Catatan kosmetik opsional: `BriefMap.js` baris 60 menulis "Ask before quoting." untuk semua field missing. Untuk 2 field ini kalimat yang tepat sebenarnya "Define before quoting." Mengubahnya menyentuh semua field missing, jadi **jangan** dikerjakan kecuali diminta.

---

## 9. FASE 5 — Bawa ke Agreement Sheet *(opsional, paling invasif)*

Master plan (baris 888, Lampiran B) menghendaki acceptance criteria muncul di lembar kesepakatan. Tanpa fase ini kedua field hanya hidup di layar kritik dan tidak pernah sampai ke klien.

**Jalur datanya (D9)**: `agreement_snapshot()` dibangun dari `opt`, bukan dari `scope`. Karena D5 melarang mengotori `scope`, nilainya dititipkan di `doc["deal_terms"]`.

> ✅ **Penulisan `deal_terms` sudah dikerjakan di Fase 2b** (dibutuhkan lebih awal untuk D10), jadi fase ini tinggal *mengonsumsi*-nya. Tidak ada pekerjaan terbuang.

### 5a. `backend/scope.py` — `agreement_snapshot()` (baris 473)

Tambah parameter opsional dan 2 key. Default `None` menjaga pemanggilan demo (`agreement.py:103`) tetap jalan tanpa diubah:

```python
def agreement_snapshot(opt: dict, project_title: str, client_name: Optional[str] = None,
                       is_demo: bool = False, deal_terms: Optional[dict] = None) -> dict:
    ...
    terms = deal_terms or {}
    return {
        ...
        "acceptance_criteria": terms.get("acceptance_criteria"),
        "change_boundary": terms.get("change_boundary"),
    }
```

### 5b. `backend/routers/agreement.py` — `create_agreement` (baris 58)

```python
    snapshot = scope_mod.agreement_snapshot(
        opt, body.project_title.strip(), (body.client_name or "").strip() or None,
        deal_terms=doc.get("deal_terms"),
    )
```

### 5c. `frontend/src/pages/Agreement.js`

Render kedua nilai di kartu conditions/deliverables yang sudah ada, **hanya kalau ada isinya** (agreement lama tidak punya key ini → harus tetap tampil normal).

### Catatan keamanan Fase 5

- `_snapshot_hash()` ikut berubah untuk agreement **baru**. Agreement lama menyimpan hash-nya sendiri per dokumen, jadi tetap valid.
- **Sudah diverifikasi**: `test_agreement_security.py` tidak mengunci nilai hash mana pun. Aman.
- Kerjakan **setelah** Fase 1–3 di-push dan terverifikasi. Jangan digabung.

---

## 10. Yang TIDAK boleh dikerjakan

- ❌ Menambah ke `REQUIRED_FIELDS` (scope.py:22) — merusak angka completeness semua analisis (D4)
- ❌ Menambah ke `build_scope()` / `estimate_hours()` — mengotori struktur input pricing (D5)
- ❌ Mengubah `compute_readiness_state()` — `medium` sudah cukup, logikanya tidak perlu disentuh
- ❌ Mengubah `run_generic_deal_rules()` — loop-nya sudah generic
- ❌ Menaikkan severity jadi `high` "biar kelihatan penting" — membekukan readiness gate
- ❌ Menambah clarification question untuk kedua field — ini bukan pertanyaan untuk klien (D6), dan bisa melanggar assert `3 ≤ len(clars) ≤ 6` di E2E
- ❌ Mengubah copy "Ask before quoting." di `BriefMap.js` — menyentuh semua field missing
- ❌ Membuat page baru, component file baru, atau endpoint baru — tidak ada yang butuh
- ❌ Push ke `master`, merge PR #1 — keputusan owner repo
- ❌ `git add` file `frontend/.mcp.json` & `frontend/components.json` — sengaja untracked

---

## 11. Checklist verifikasi akhir (sebelum minta izin push)

**Backend**
- [ ] `pytest tests\ -q --ignore=tests\backend_test.py` → **110 passed** (Fase 1–3), nol gagal
- [ ] `test_readiness_gate.py` semua hijau — bukti keputusan `medium` benar
- [ ] Backend restart bersih (kill uvicorn lama dulu, tidak pakai `--reload`)

**Frontend**
- [ ] `$env:CI="true"; npm run build` → "Compiled successfully"
- [ ] Sudah build ulang sebelum cek browser (port 3000 = static build)

**Perilaku nyata di browser**
- [ ] `/analysis/{id}`: 2 card muncul, label bukan snake_case, badge "Medium impact"
- [ ] Blok "Terms you define" tampil di bawah toggle
- [ ] Pilih preset di keduanya → Update → **kedua card hilang**, hitungan banner berkurang 2
- [ ] Opsi "Custom…" memunculkan input teks dan tetap bisa me-resolve
- [ ] **Uji D10 secara eksplisit**: setelah Update, **reload halaman** → kedua dropdown **masih menampilkan pilihan yang tadi** (bukan "Not defined yet") → klik Update lagi → **card tetap tidak muncul**. Ini titik paling gampang lolos dari pengujian sambil lalu.
- [ ] Banner readiness tidak berubah merah gara-gara 2 issue ini
- [ ] `/judge` masih jalan penuh 8 step **dan tampilannya tidak berubah** (memang tidak boleh berubah)
- [ ] Halaman `/analyze` dan `/workspace` tidak berubah

**Kebersihan**
- [ ] `git status` → hanya file yang direncanakan; `.mcp.json` & `components.json` tetap untracked
- [ ] Tidak ada import/variabel jadi orphan akibat perubahan ini

---

## 12. Fakta terukur (hasil verifikasi 22 Agustus 2026)

| Fakta | Nilai | Catatan |
|---|---|---|
| Baseline unit test | **106 passed** | CLAUDE.md menulis 88 — **sudah basi**, perlu dikoreksi saat push |
| Target setelah Fase 1 | 108 | +2 |
| Target setelah Fase 2 | 110 | +2 (termasuk test persistensi D10) |
| Target setelah Fase 4 | 112 | +2 |
| Kriteria §4.3 terimplementasi | 7 dari 9 | → 9 dari 9 setelah Fase 1 |
| Endpoint/model/koleksi baru | **0** | |
| Dependency baru | **0** | |
| Page baru | **0** | |
| File component baru | **0** | `DefinitionSelect` lokal di `ClarificationGate.js` |

### Estimasi ukuran perubahan

| Fase | File | ~Baris |
|---|---|---|
| 1 | rules.py, BriefCritique.js, test_rules.py | 55 |
| 2 | analysis.py, test_readiness_gate.py | 45 |
| 3 | ClarificationGate.js, Analysis.js | 68 |
| **Inti (1–3)** | **7 file** | **~168** |
| 4 | ai_service.py, scope.py, test_ai_provenance.py | 50 |
| 5 | scope.py, agreement.py, Agreement.js | 30 |

---

## 13. Urutan kerja yang disarankan

```
Fase 1  ──►  test hijau + cek browser  ──►  commit
Fase 2  ──►  test hijau                ──►  commit
Fase 3  ──►  test hijau + cek browser  ──►  commit  ──►  minta izin push  ◄── FITUR SELESAI
                                                            │
                                              (opsional, sesi terpisah)
                                                            ▼
Fase 4  ──►  test hijau + cek Brief Map ──►  commit
Fase 5  ──►  test hijau + cek Agreement ──►  commit  ──►  minta izin push
```

Push hanya ke `origin/rifqi`, tidak pernah ke `master`.
