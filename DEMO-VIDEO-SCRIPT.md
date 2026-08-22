# Draf Skrip Demo Video — Submission Kontes

Target ~90 detik (sama seperti yang app-nya sendiri sudah janjikan: "90-Second Judge Mode Demo"). Dua opsi, beda tingkat risiko saat rekam:

- **Opsi A (direkomendasikan)** — 100% lewat Judge Mode (`/judge`). Deterministik, tanpa AI live, tanpa ketik manual saat rekam — jadi hasilnya konsisten kalau harus rekam ulang beberapa kali.
- **Opsi B** — buka dengan momen live di `/analyze` (banner merah "Not ready to quote" berubah jadi hijau "Now we can estimate it") karena itu **momen paling dramatis dan paling sesuai "magic moment" yang didefinisikan dokumen sendiri** (Lampiran H) — tapi butuh ketik/klik live saat rekam, risiko typo/lag lebih tinggi.

Cek dulu §16.6 (voice principles) sebelum baca narasinya: hindari kata hype ("seamless", "revolutionize", "next-gen"), pakai kalimat pendek & konkret, jangan janji keuntungan pasti.

---

## Opsi A — Judge Mode penuh (aman, direkomendasikan)

Semua teks di bawah **diambil persis dari kode `Judge.js`**, bukan dikarang — supaya rekaman kamu match 1:1 sama yang muncul di layar.

| Waktu | Layar (klik `/judge`, langkah ke berapa) | Narasi (boleh diedit gaya bicaranya, tapi jaga kontennya) |
|---|---|---|
| 0:00-0:08 | Landing page, sebelum masuk Judge Mode | "Freelancer video sering kasih harga sebelum brief klien benar-benar jelas. Ini Baseline — cek dulu sebelum bilang ya." |
| 0:08-0:20 | **Langkah 1**: brief asli ditampilkan — *"Halo kak, butuh 12 Reels buat campaign bulan depan. Budget 3 juta. Footage menyusul, minggu depan harus jadi, revisi sampai cocok."* | "Ini brief WhatsApp asli — kelihatan lengkap. Budget ada, deadline ada. Tapi coba lihat apa yang sebenarnya masih longgar." |
| 0:20-0:32 | **Langkah 2**: "Stated, assumed, and missing evidence" — tabel 3 kolom | "Baseline pisahkan yang klien beneran bilang, yang diasumsikan, dan yang belum disebut sama sekali — sebelum satu angka pun dihitung." |
| 0:32-0:44 | **Langkah 3**: "The five highest-impact questions" → klik **Apply seeded answers** | "5 pertanyaan yang paling ngubah waktu dan biaya kalau dijawab. Bukan checklist generik — diranking dari yang paling penting." |
| 0:44-0:54 | **Langkah 4**: estimasi jam + risk trigger | "Setelah dijawab, baru dihitung: rentang jam kerja, price floor — semua dari formula deterministik, bukan tebakan AI." |
| 0:54-1:04 | **Langkah 5**: "Three bounded options" | "3 opsi siap kirim: sesuai budget dengan scope dikurangi, sesuai scope dengan harga penuh, atau versi rush. Freelancer yang pilih, bukan sistem yang maksa." |
| 1:04-1:12 | **Langkah 6**: draft WhatsApp | "Draft pesan WhatsApp langsung jadi — tinggal edit dan kirim." |
| 1:12-1:22 | **Langkah 7**: "Client-safe Agreement Sheet" → klik **Create demo Agreement Sheet** | "Link kesepakatan yang aman dikirim ke klien — harga dan scope kelihatan, tapi rate dan margin freelancer nggak pernah bocor." |
| 1:22-1:30 | **Langkah 8**: "How Baseline works" (penutup) | "Semua angka bisa dilacak balik ke asumsi yang kelihatan. Baseline before yes." |

**Total**: ~90 detik kalau dituturkan santai tanpa jeda panjang antar klik.

---

## Opsi B — buka dengan live `/analyze` (lebih dramatis, lebih berisiko)

Ganti 0:00-0:20 di atas dengan urutan ini, sisanya (0:20 dst) boleh lanjut ke Judge Mode atau terus live:

| Waktu | Layar | Narasi |
|---|---|---|
| 0:00-0:05 | Landing, klik "Analyze my brief" | "Ini brief WhatsApp asli dari klien." |
| 0:05-0:12 | Paste brief video (mis. "12 reels, budget 3 juta, revisi sampai cocok, deadline minggu depan"), klik **Analyze Scope** | (diam, biarkan hasilnya yang bicara) |
| 0:12-0:18 | Banner merah **"Not ready to quote"** + daftar issue muncul | "Kelihatan lengkap — tapi Baseline nemu 4 hal yang masih rawan sebelum kasih harga." |
| 0:18-0:28 | Isi 2-3 field di "Answers & assumptions" (durasi, revisi, deadline), klik **Calculate estimate** | "Tinggal jawab beberapa hal ini—" |
| 0:28-0:32 | Banner berubah jadi hijau **"Now we can estimate it"** | "—dan sekarang baru bisa dihitung." |

**Risiko rekam**: kalau brief yang diketik live salah ketik/beda dari yang sudah pernah diverifikasi, hasil klasifikasi/issue bisa beda dari yang diharapkan. **Saran**: latihan dulu 2-3 kali offscreen pakai brief yang sama persis sebelum rekam final, atau pakai brief yang sudah pernah terverifikasi kerja:
```
Need 10 Reels for a campaign, footage ready, budget 6M, deadline 10 hari, revisi 2x, approver 1 orang.
```
(sudah dites berkali-kali sesi ini, hasilnya konsisten: 0 issue setelah field diisi, readiness berubah bersih)

---

## Checklist teknis sebelum rekam

- [ ] Sudah deploy publik (`DEPLOY.md`) — atau kalau demo dari localhost juga oke asal koneksi stabil, tapi cek dulu `render.yaml`/Vercel URL nggak lagi cold-start Render (buka linknya beberapa menit sebelum rekam)
- [ ] Browser di-zoom ke ukuran yang jelas dibaca kalau nanti di-compress jadi video kecil (mis. upload YouTube/submission platform)
- [ ] Matikan notifikasi desktop dulu (WA, email, dll) biar nggak numpang lewat pas rekam
- [ ] Kalau pakai voice-over: rekam narasi terpisah dari screen recording, lebih gampang re-take kalau salah ngomong tanpa harus ulang seluruh klik
- [ ] Preview hasil akhir di device lain sebelum submit — pastikan teks di layar kebaca, bukan cuma kamu yang paham konteksnya

## Yang jangan dilakukan (konsisten sama Trust lens §16.6)

- Jangan klaim angka final/harga sebagai "pasti" — selalu framing "price floor", bukan "harga jadi"
- Jangan tampilkan data pilot asli di video tanpa consent (lihat `pilot-notes/CONSENT-draft.md`) — kalau mau sebut hasil pilot di narasi, pastikan sudah dapat izin dan datanya jujur (bukan dummy)
- Jangan bilang "AI" seolah-olah semua dihitung AI — tegaskan bagian pricing itu deterministik, AI cuma bantu ekstraksi teks (persis kalimat penutup Judge Mode step 8)
