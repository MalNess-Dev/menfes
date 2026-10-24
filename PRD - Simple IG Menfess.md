# PRD — Simple IG Menfess

## 1. Deskripsi

Simple IG Menfess adalah website untuk mengirim pesan menfess melalui formulir sederhana. Pesan disimpan ke database lokal, dibuat menjadi gambar dengan template yang telah ditentukan, lalu diposting ke Instagram secara otomatis oleh worker di latar belakang.

Keputusan produk: **tidak ada filter konten**. Isi pesan tidak disensor atau ditolak berdasarkan kata, link, atau topik. Proteksi yang ada hanya bersifat teknis (lihat bagian 6).

## 2. Teknologi

- **Fullstack:** Next.js (App Router)
- **Backend:** Next.js Route Handlers
- **Worker:** proses Node.js terpisah (`worker.ts`), dijalankan dengan PM2
- **Database:** SQLite (mode WAL)
- **ORM:** Prisma
- **Instagram:** instagram-private-api, dibungkus modul dengan satu fungsi `publishImage(buffer, caption)`
- **Image Generator:** satori + @resvg/resvg-js untuk render template, Sharp untuk konversi akhir ke JPEG
- **Styling:** Tailwind CSS
- **CAPTCHA:** Cloudflare Turnstile

Frontend, backend, dan worker berada dalam satu repositori.

## 3. Fitur Utama

### A. Form Menfess

Satu halaman utama dengan tiga input:

- **To:** penerima pesan (opsional).
- **From:** pengirim atau nama samaran (opsional).
- **Message:** isi pesan (wajib, maksimal 3.000 karakter).

Tombol **Kirim Menfess** dinonaktifkan sesudah diklik agar tidak terkirim dua kali. Di bawah form ada teks: *"Pesan bersifat publik dan pengirim bertanggung jawab atas isinya."*

Di bawah kolom pesan ada penghitung karakter dan indikator jumlah slide (misalnya "pesan ini akan jadi 3 slide"), supaya pengirim tahu hasilnya sebelum mengirim. Batas 3.000 karakter (sekitar 6 slide) adalah batas teknis, bukan filter konten.

### B. Penyimpanan Lokal

Setiap pesan disimpan ke SQLite dengan status `pending`. Route Handler langsung membalas "berhasil dikirim" tanpa menunggu proses posting.

### C. Generate Template

Worker memecah pesan menjadi slide, lalu membuat satu gambar template per slide. Satu slide menampung sekitar 500 karakter (angka final diuji setelah template jadi). Pesan yang muat dalam satu slide menjadi satu gambar; pesan lebih panjang menjadi carousel, maksimal 10 slide sesuai batas Instagram.

- Pemecahan dilakukan per kalimat atau per kata, tidak memotong di tengah kata.
- Ukuran font sama di semua slide agar konsisten.
- Penanda halaman kecil di tiap slide (misalnya 1/3).
- To dan From tampil di slide pertama.
- Output berupa JPEG rasio 1:1 (1080×1080) atau 4:5 (1080×1350).

### D. Auto-post Instagram

Worker mengambil pesan `pending` satu per satu, merender semua slide, lalu memposting lewat `instagram-private-api`: `publish.photo` untuk satu slide dan `publish.album` untuk carousel. Caption berformat tetap. Status dan hasil publikasi dicatat. Bila carousel gagal, seluruh postingan diulang dari awal (maksimal 3 kali), dan file gambar sementara dihapus setelah selesai.

### E. Pengendalian Operasional (tanpa dashboard)

- Variabel `.env` `BOT_PAUSED=true` untuk menghentikan worker.
- Skrip CLI sederhana untuk melihat antrean, menandai pesan sebagai `rejected`, dan mencoba ulang pesan `failed`.
- Postingan yang sudah terbit dihapus manual lewat aplikasi Instagram.

## 4. Alur Sistem

1. Pengguna membuka website dan mengisi To, From, Message.
2. Pengguna lolos CAPTCHA lalu menekan Kirim.
3. Next.js memvalidasi panjang pesan dan rate limit.
4. Pesan disimpan ke SQLite dengan status `pending`.
5. Pengguna mendapat konfirmasi berhasil terkirim.
6. Worker mengambil pesan `pending` (setelah jeda minimum antar posting terpenuhi) dan mengubah status ke `processing`.
7. Worker memecah pesan menjadi satu atau beberapa slide dan membuat gambar template untuk tiap slide.
8. Worker memposting satu gambar, atau carousel bila slide lebih dari satu, ke Instagram.
9. Status diperbarui menjadi `published` atau `failed`.

## 5. Struktur Database

Tabel `Menfess`:

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | INTEGER | Primary key |
| recipient | TEXT | Penerima (hindari nama `to`, kata kunci SQL) |
| sender | TEXT | Pengirim (hindari nama `from`) |
| message | TEXT | Isi pesan |
| status | TEXT | Status publikasi |
| errorMessage | TEXT | Pesan error terakhir (nullable) |
| retryCount | INTEGER | Jumlah percobaan, default 0 |
| igMediaId | TEXT | ID media Instagram (nullable) |
| createdAt | DATETIME | Waktu dibuat |
| publishedAt | DATETIME | Waktu terbit (nullable) |
| slideCount | INTEGER | Jumlah slide (1 sampai 10), default 1 |

Status yang digunakan:

- `pending`
- `processing`
- `published`
- `failed`
- `rejected` (hanya lewat CLI, bukan filter otomatis)

Tabel `IgSession`: menyimpan hasil serialisasi session/cookie Instagram agar tidak login ulang setiap posting.

IP pengirim tidak disimpan mentah. Untuk rate limit, gunakan hash dengan salt dan retensi singkat.

## 6. Proteksi Teknis (bukan filter konten)

Tujuannya menjaga sistem dan akun tetap berjalan, tanpa menyensor isi pesan:

- **Batas panjang pesan** (3.000 karakter, sekitar 6 slide) dan validasi input dasar.
- **Rate limit per IP** (misalnya maksimal 3 pesan per 10 menit).
- **CAPTCHA** (Turnstile) di form untuk menahan bot spam.
- **Jeda antar posting:** minimal 5 sampai 15 menit dengan variasi acak.
- **Batas posting harian** yang konservatif.
- **Retry terbatas:** maksimal 3 kali, setelah itu status `failed` dan tidak diulang otomatis.
- **Pemulihan status:** pesan `processing` yang menggantung lebih dari 10 menit dikembalikan ke `pending` saat worker restart.
- **Penghentian otomatis:** bila muncul `IgCheckpointError` atau `IgLoginRequiredError`, worker berhenti total dan mengirim notifikasi ke pemilik (WhatsApp atau Telegram). Tidak ada percobaan login berulang.

## 7. Struktur Folder

```text
ig-menfess/
├── prisma/
│   └── schema.prisma
├── public/
│   └── templates/
│       └── menfess-bg.png
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   └── api/
│   │       └── menfess/
│   │           └── route.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── template.ts
│   │   ├── instagram.ts
│   │   ├── queue.ts
│   │   └── ratelimit.ts
│   └── worker/
│       └── index.ts
├── scripts/
│   └── admin.ts
├── generated/
├── .env
├── .gitignore
├── package.json
└── next.config.ts
```

`generated/`, file database, dan data session Instagram masuk `.gitignore`.

## 8. Batasan MVP

- Hanya satu akun Instagram.
- Hanya satu template menfess (dipakai untuk semua slide).
- Tidak ada dashboard admin.
- Tidak ada registrasi atau login pengguna.
- Tidak ada fitur komentar atau balasan.
- Tidak ada pengaturan template melalui website.
- **Tidak ada filter atau moderasi konten.**
- Pesan diproses worker secara berurutan dengan jeda, bukan langsung saat dikirim.
- Database disimpan secara lokal di server.

## 9. Risiko

| Risiko | Dampak | Penanganan |
| --- | --- | --- |
| Tanpa filter konten, postingan bisa melanggar Pedoman Komunitas Instagram | Strike, pembatasan, atau akun di-banned | Teks tanggung jawab di form, tombol `BOT_PAUSED`, hapus postingan manual dengan cepat |
| Pesan berisi pencemaran nama baik, ancaman, atau data pribadi orang lain | Masalah hukum bagi pemilik akun (misalnya UU ITE) dan kerugian bagi pihak yang disebut | Siapkan proses hapus cepat saat ada laporan; pemilik akun sadar bahwa ia yang bertanggung jawab |
| `instagram-private-api` tidak resmi dan melanggar ToS | Akun checkpoint atau banned, atau library rusak saat Instagram berubah | Jeda posting, volume rendah, IP stabil, simpan session, bungkus modul agar bisa diganti ke Graph API resmi |
| Spam atau banjir pesan dari bot | Antrean penuh, akun kena limit | CAPTCHA, rate limit, batas harian |
| Kebocoran kredensial atau session Instagram | Akun diambil alih | Simpan di `.env`, 2FA di akun, file session tidak masuk repositori |
| Server serverless tanpa penyimpanan persisten | Database dan session hilang | Gunakan VPS |
| Carousel gagal di tengah proses atau memakan waktu lebih lama dari satu foto | Posting tertunda atau gagal | Retry terbatas, jeda antar posting tetap berlaku, file sementara dibersihkan setelah selesai |

## 10. Catatan Deployment

SQLite lokal berarti database disimpan sebagai file di server, misalnya `prisma/dev.db`. Gunakan VPS atau server Node.js dengan penyimpanan persisten. Hosting serverless dengan filesystem sementara tidak cocok.

Jalankan dua proses: aplikasi Next.js dan `worker`, keduanya dikelola PM2 agar otomatis restart. Aktifkan WAL mode pada SQLite dan backup file `.db` secara berkala.

Jika publikasi gagal, pesan tetap tersimpan di SQLite dengan status `failed` beserta `errorMessage`.

## 11. Kriteria Selesai

- Form To, From, dan Message dapat digunakan dengan CAPTCHA dan rate limit.
- Pesan tersimpan di SQLite dan form langsung memberi konfirmasi.
- Worker memproses antrean dengan jeda antar posting.
- Pesan panjang dipecah menjadi slide (maksimal 10) dan diposting sebagai carousel; gambar template tiap slide berhasil dibuat dalam format JPEG.
- Gambar berhasil diposting ke Instagram memakai session yang tersimpan.
- Status publikasi tersimpan dan dapat ditelusuri, termasuk error dan jumlah retry.
- Worker berhenti otomatis dan memberi notifikasi saat terjadi checkpoint.
- `BOT_PAUSED=true` menghentikan pemrosesan.
