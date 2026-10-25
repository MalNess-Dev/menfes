# Workflow Turso + Drizzle + Vercel

Panduan ini memakai arsitektur:

```text
Browser -> Next.js Route Handler di Vercel -> Turso (libSQL)
                                      ^
                                      |
Worker Instagram di host proses persisten terpisah
```

Vercel cocok untuk frontend dan API yang singkat. Worker Instagram yang berjalan
terus-menerus, memakai `setInterval`/loop panjang, dan membutuhkan session tidak
boleh dijalankan sebagai loop tak berujung di Vercel Function. Jalankan worker di
VPS, Railway, Fly.io, Render background worker, atau layanan proses persisten lain.

## 0. Prasyarat dan aturan secret

- Node.js sesuai versi yang dipakai proyek, npm, Git, dan akun GitHub.
- Akun Turso serta Turso CLI.
- Akun Vercel yang terhubung ke repositori GitHub.
- Jangan commit `.env`, token Turso, password Instagram, atau session cookie.
- Jika token pernah masuk ke chat, log, screenshot, atau repositori, revoke lalu buat
  token baru sebelum production.

Next.js hanya memuat `.env*` dari root proyek (bukan dari `src/`). Variabel tanpa
prefix `NEXT_PUBLIC_` hanya tersedia di server. Jangan pernah memberi prefix itu
pada `TURSO_AUTH_TOKEN`.

## 1. Membuat database Turso

### Opsi A — CLI

Login dan buat database:

```bash
turso auth login
turso db create menfes-prod
```

Lihat URL database dan buat token database:

```bash
turso db show menfes-prod --url
turso db tokens create menfes-prod
```

Simpan hasilnya sebagai:

```env
TURSO_DATABASE_URL="libsql://<database>-<organization>.aws-<region>.turso.io"
TURSO_AUTH_TOKEN="<token>"
```

Gunakan token terpisah untuk development, staging, dan production. Jangan
menaruh token permanen di command history jika mesin dipakai bersama.

### Opsi B — Dashboard

1. Buka Turso Dashboard dan login.
2. Pilih **Create database**, beri nama database, lalu pilih region yang dekat
   dengan Vercel project.
3. Buka database tersebut dan salin **LibSQL URL**.
4. Buat database auth token dari menu token dan salin sekali saja.
5. Simpan URL/token di password manager atau Vercel Environment Variables.

## 2. Jika sudah punya file SQLite lokal

Pastikan aplikasi berhenti dan file tidak sedang ditulis. Untuk database WAL,
checkpoint dulu:

```bash
sqlite3 ./prisma/dev.db
```

```sql
PRAGMA wal_checkpoint(TRUNCATE);
.exit
```

Import melalui CLI Turso:

```bash
turso db import ./prisma/dev.db
```

Jika CLI meminta target atau Anda ingin memastikan nama/group, ikuti opsi versi
CLI yang terpasang:

```bash
turso db import --group <group-name> ./prisma/dev.db
```

Setelah import, verifikasi tabel dan jumlah baris:

```bash
turso db shell menfes-prod
```

```sql
.tables
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
SELECT COUNT(*) FROM Menfess;
```

> **Penting:** perlakukan import sebagai bootstrap satu kali. Jangan mengimpor
> database yang sama berulang kali ke database production tanpa backup dan rencana
> rekonsiliasi. Alternatif yang lebih aman untuk database kosong adalah menerapkan
> migration Drizzle pada bagian 4.

## 3. Konfigurasi lokal

Salin template environment dan isi nilai lokal:

```bash
cp .env.example .env.local
```

Untuk development lokal tanpa Turso:

```env
DATABASE_URL="file:./prisma/dev.db"
TURSO_DATABASE_URL=""
TURSO_AUTH_TOKEN=""
```

Untuk development langsung ke database Turso:

```env
TURSO_DATABASE_URL="libsql://..."
TURSO_AUTH_TOKEN="..."
```

Kode koneksi proyek berada di [`src/lib/db.ts`](../src/lib/db.ts) dan schema
Drizzle berada di [`src/lib/schema.ts`](../src/lib/schema.ts). Koneksi memakai
`@libsql/client`, sehingga URL `file:` dan `libsql://` dapat dipakai dengan
interface yang sama:

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

Drizzle dipilih karena ringan untuk Route Handler dan worker. `@libsql/client`
menggunakan HTTP/libSQL untuk Turso; tidak ada file SQLite persisten yang perlu
ditulis oleh Vercel.

## 4. Schema dan migrasi

Schema sumber ada di [`src/lib/schema.ts`](../src/lib/schema.ts). Setelah
mengubah schema:

```bash
npm run db:generate
```

Review SQL di folder `drizzle/`, commit migration tersebut, lalu terapkan ke
database target:

```bash
npm run db:migrate
```

Untuk database baru, ini membuat tabel dan index sesuai schema. Untuk perubahan
destruktif, backup/export dahulu dan review SQL hasil generator.

### Push cepat untuk prototyping

```bash
npm run db:push
```

Gunakan hanya untuk development atau database disposable. Production sebaiknya
memakai migration yang direview dan disimpan di Git.

### Menjalankan migration ke Turso secara eksplisit

Buat file environment khusus yang tidak di-commit, misalnya `.env.turso.local`,
lalu jalankan command dengan environment tersebut:

```bash
set -a
source .env.turso.local
set +a
npm run db:migrate
```

Pastikan `TURSO_DATABASE_URL` benar sebelum menjalankan command. Jangan
mengandalkan `DATABASE_URL` lama yang menunjuk file lokal.

## 5. Verifikasi lokal sebelum deploy

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Smoke test API:

1. Jalankan `npm run dev`.
2. Kirim satu request valid ke endpoint menfess.
3. Pastikan row masuk dengan status `pending`.
4. Jalankan `npm run admin` dan pastikan jumlah antrean bertambah.
5. Untuk uji worker tanpa posting, gunakan mock Instagram yang memang tersedia
   di environment proyek; jangan memakai kredensial production.

## 6. Hubungkan GitHub ke Vercel

1. Push branch yang sudah berisi migration dan dokumentasi ke GitHub.
2. Di Vercel pilih **Add New Project** → pilih repositori GitHub.
3. Pastikan framework terdeteksi sebagai Next.js.
4. Biarkan Build Command `npm run build`, kecuali ada alasan khusus.
5. Tambahkan Environment Variables untuk **Production**, **Preview**, dan
   **Development** sesuai kebutuhan:

   ```text
   TURSO_DATABASE_URL
   TURSO_AUTH_TOKEN
   NEXT_PUBLIC_TURNSTILE_SITE_KEY
   TURNSTILE_SECRET_KEY
   RATE_LIMIT_SALT
   ```

6. Tambahkan credential Instagram hanya pada environment worker, bukan Vercel,
   kecuali ada endpoint server yang memang membutuhkannya.
7. Deploy. Setiap push ke branch production akan membuat deployment baru;
   Preview deployment memakai environment Preview.

`TURSO_AUTH_TOKEN`, password, session cookie, dan salt harus **tanpa**
`NEXT_PUBLIC_`. Variabel `NEXT_PUBLIC_*` dibundel ke browser saat build dan tidak
boleh berisi secret.

## 7. Runtime Vercel dan worker

- Biarkan Route Handler memakai Node.js default; jangan memindahkan kode yang
  bergantung pada Node API/native package ke Edge.
- Jangan mengandalkan `*.db`, WAL file, atau `/tmp` sebagai storage persisten
  di Vercel.
- Jangan menjalankan `while (true)`, PM2, atau worker Instagram sebagai bagian
  dari request Vercel.
- Turso menangani durability; Vercel Function hanya membuat request database
  melalui libSQL.
- Worker membaca antrean yang sama dari Turso. Jalankan satu worker aktif atau
  tambahkan locking/claim atomik sebelum menjalankan lebih dari satu replika.
- Simpan session Instagram di Turso atau secret manager worker, bukan di
  filesystem deployment Vercel.
- Pilih region Turso dekat region function utama untuk mengurangi latency.

## 8. Checklist go-live

- [ ] Token Turso production baru sudah dibuat dan tidak ada di Git.
- [ ] URL Turso production sudah diverifikasi.
- [ ] Migration sudah di-apply dan tabel/index sudah diverifikasi.
- [ ] Environment Variables Vercel diisi pada scope yang benar.
- [ ] `npm run build`, lint, dan type-check berhasil.
- [ ] Endpoint menfess berhasil membuat row `pending` di Turso.
- [ ] Worker dijalankan di host persisten, bukan Vercel.
- [ ] Rate limit, Turnstile, batas harian, jeda posting, dan `BOT_PAUSED` diuji.
- [ ] Backup/export dan prosedur rollback terdokumentasi.

## Pitfall yang sering terjadi

| Pitfall | Dampak | Pencegahan |
| --- | --- | --- |
| Memakai `file:./dev.db` di Vercel | Data hilang atau function tidak bisa menulis persisten | Gunakan `libsql://` + token Turso |
| Menaruh auth token sebagai `NEXT_PUBLIC_*` | Token bocor ke browser | Simpan sebagai variable server-only |
| Menjalankan `db:push` ke production | Perubahan schema sulit direview/rollback | Commit dan apply migration |
| Import file WAL tanpa checkpoint | Data terakhir bisa tidak ikut terunggah | Stop writer lalu `wal_checkpoint(TRUNCATE)` |
| Menjalankan worker di Serverless Function | Timeout, duplikasi job, dan proses diputus | Gunakan background worker persisten |
| Satu token untuk semua environment | Blast radius besar saat token bocor | Buat token terpisah per environment |
| Migration lokal diam-diam memakai URL Turso | Schema production berubah tanpa review | Cek environment dan gunakan file env target secara eksplisit |
