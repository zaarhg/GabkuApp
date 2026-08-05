# 📘 Panduan & Catatan Pengembangan Lanjutan (Gabku App)

Dokumen ini disusun sebagai **panduan utama dan standar teknis** bagi pengembang untuk memelihara dan menambah fitur baru pada **Gabku App**. Semua aturan dalam dokumen ini wajib diikuti untuk menjaga kerapihan, stabilitas, keamanan, dan keandalan Progressive Web App (PWA).

---

## 📋 1. Ringkasan Arsitektur & Struktur Proyek

Codebase Gabku App menggunakan arsitektur **Vanilla JS & HTML5 terpusat** dengan integrasi **Supabase** (Autentikasi & Database) dan **Google Apps Script** (Backend API Khusus).

### 📁 Struktur File Utama

```text
Gabku App/
├── index.html                 # Dashboard Utama Tim (Admin & Pelatih)
├── dashboard-atlet.html       # Dashboard Atlet
├── presensi.html              # Halaman Presensi / Kehadiran
├── kegiatan.html              # Kelola Kegiatan & Sesi
├── anggota.html               # Kelola Data Anggota
├── rekap.html                 # Rekapitulasi Kehadiran & Nilai
├── monitoring.html            # Input Score Sheet Monitoring Atlet
├── riwayat-monitoring.html    # Log & Riwayat Assessment Monitoring
├── manajemen-user.html        # Kelola Akses & Verification User
├── pengaturan.html            # Pengaturan Dropdown & Sistem
├── profil.html                # Profil User & Pengaturan Akun
├── login.html                 # Halaman Login
├── daftar.html                # Halaman Pendaftaran Akun
├── pending.html               # Halaman Tunggu Persetujuan Admin
├── panduan.html               # Panduan Penilaian & Indikator
├── persetujuan.html           # Persetujuan Akun Pendaftar
├── sw.js                      # Service Worker (PWA Caching Engine)
├── manifest.webmanifest       # Manifest PWA (Metadata & Icon)
└── assets/
    ├── css/
    │   └── app.css            # Styling Terpusat (Design System)
    └── js/
        ├── config.js          # Konfigurasi Supabase & GAS Endpoint
        ├── supabase-client.js # Inisialisasi Supabase SDK Client
        ├── utils.js           # Helper Universal (Modal, Toast, escHtml, Date)
        ├── auth.js            # Autentikasi, Role RBAC & Redirect Session
        ├── api.js             # Helper Endpoint Google Apps Script
        ├── ui.js              # UI Utilities & Bottom Nav
        ├── pwa-enforcer.js    # PWA Standalone Gate & Transition Effect
        └── [modul-spesifik].js# Script Logika Halaman (e.g. index.js, presensi.js)
```

---

## ⚡ 2. Aturan Wajib: Standar Script Loading Order

Setiap file HTML **WAJIB** menyertakan script tag di bagian bawah `<body>` dengan urutan dependency yang seragam. Mengubah urutan ini dapat menyebabkan error *undefined function*.

```html
  <!-- 1. SDK Supabase Client (CDN) -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  
  <!-- 2. Konfigurasi Global & Auto-load PWA Enforcer -->
  <script src="assets/js/config.js"></script>
  
  <!-- 3. Supabase Client Initializer -->
  <script src="assets/js/supabase-client.js"></script>
  
  <!-- 4. Helper Universal (Modal, Toast, Date, escHtml) -->
  <script src="assets/js/utils.js"></script>
  
  <!-- 5. Autentikasi & RBAC Role Restrictions -->
  <script src="assets/js/auth.js"></script>
  
  <!-- 6. API Helper GAS / UI Helper (Opsional sesuai kebutuhan halaman) -->
  <script src="assets/js/api.js"></script>
  <script src="assets/js/ui.js"></script>
  
  <!-- 7. Script Logika Khusus Halaman Ini -->
  <script src="assets/js/[nama-modul-halaman].js"></script>
</body>
```

---

## 🛡️ 3. Konvensi Penulisan Kode (Coding Guidelines)

### A. Proteksi Halaman (Autentikasi & Authorization)
Setiap modul JS untuk halaman terproteksi wajib menyertakan panggilan `requireLogin()` pada event `DOMContentLoaded`:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verifikasi sesi login & status user (Aktif/Approved)
  await requireLogin();
  
  // 2. Jalankan logika inisialisasi halaman
  initHalamanSaya();
});
```

### B. Defensive DOM Checks (Mencegah Null Pointer Error)
Selalu gunakan *null check* sebelum melakukan query DOM atau mengubah properti elemen:

```javascript
// ✅ REKOMENDASI (Aman dari TypeError)
const elList = document.getElementById('myList');
if (elList) {
  elList.innerHTML = '<p>Data berhasil dimuat</p>';
}

// ❌ HINDARI (Dapat menyebabkan error jika elemen tidak ada di DOM)
document.getElementById('myList').innerHTML = '<p>Data</p>';
```

### C. Sanitasi Input (Mencegah XSS Vulnerability)
Gunakan `window.escHtml()` atau `window.escapeHtml()` saat merender teks dari input pengguna/database ke dalam string HTML innerHTML:

```javascript
const name = escHtml(user.full_name);
const html = `<div class="user-card">${name}</div>`;
```

### D. Modal Konfirmasi & Notifikasi Terpusat
Gunakan helper modal dari `utils.js` daripada `alert()` / `confirm()` standar browser:

- **Modal Konfirmasi Async**:
  ```javascript
  const diproses = await asyncConfirm("Yakin ingin menghapus data ini?", "Konfirmasi Hapus");
  if (diproses) {
    // Jalankan eksekusi hapus
  }
  ```
- **Modal Alert Async**:
  ```javascript
  await asyncAlert("Data berhasil diperbarui!", "Informasi");
  ```
- **Toast Notification**:
  ```javascript
  showToastMsg("Berhasil menyimpan perubahan", "success"); // Tipe: 'success', 'error', 'info'
  ```

---

## 🚀 4. Alur Langkah Demi Langkah Menambah Halaman Baru

Bila Anda ingin menambahkan halaman/modul baru ke dalam Gabku App, ikuti 4 langkah ini:

### Langkah 1: Buat File HTML & JS Baru
Buat file `halaman-baru.html` dan `assets/js/halaman-baru.js`. Masukkan struktur HTML standar dan pastikan urutan script tag di bagian bawah sudah sesuai dengan **Pasal 2**.

### Langkah 2: Tambahkan Logika Proteksi & Modul JS
Di dalam `assets/js/halaman-baru.js`:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  await requireLogin();
  console.log("Halaman baru siap digunakan!");
});
```

### Langkah 3: Update Service Worker (`sw.js`) — SANGAT PENTING!
1. **Naikkan Angka Versi Cache**:
   ```javascript
   const CACHE_NAME = "gabku-v1.3.0"; // Naikkan versi cache
   ```
2. **Daftarkan File Baru di `STATIC_ASSETS`**:
   ```javascript
   const STATIC_ASSETS = [
     // ... asset yang sudah ada ...
     "halaman-baru.html",
     "assets/js/halaman-baru.js"
   ];
   ```

### Langkah 4: Uji Coba Lintas Role & Browser
Uji akses halaman dengan login sebagai:
- Role **Admin**
- Role **Pelatih**
- Role **Atlet** (Pastikan pengalihan/hak akses berjalan sesuai ekspektasi)

---

## 🔒 5. Pengelolaan Database & Backend Supabase

### A. Role & Status Pengguna di Tabel `profiles`
Status pengguna dikelola dalam tabel `profiles`:
- **Role**: `admin`, `pelatih`, `atlet`.
- **Status**: `Menunggu` (Pending), `Aktif` / `Approved` (Bisa login).

### B. Menambah Tabel Baru di Supabase
Bila Anda membuat tabel baru (misalnya `jadwal_turnamen`):
1. **Aktifkan RLS (Row Level Security)** pada tabel baru.
2. Buat Policy dasar:
   - `SELECT`: Diizinkan untuk semua authenticated user (`auth.role() = 'authenticated'`).
   - `INSERT / UPDATE / DELETE`: Diizinkan untuk pengguna dengan role `admin` / `pelatih`.
3. **Tambahkan Indeks Database**: Buat indeks pada kolom yang sering di-filter (`member_id`, `created_at`, `status`) untuk menjaga kecepatan query.

---

## 🔧 6. Panduan Troubleshooting & Debugging

| Permasalahan | Kemungkinan Penyebab | Solusi / Cara Penanganan |
| :--- | :--- | :--- |
| **Halaman tidak berubah setelah di-edit** | Service Worker menahan cache lama | Naikkan `CACHE_NAME` di `sw.js` atau lakukan *Hard Refresh* (`Ctrl + Shift + R`). |
| **Error `asyncConfirm is not defined`** | Urutan script di HTML salah | Pastikan `assets/js/utils.js` dipasang **sebelum** `auth.js` / modul halaman. |
| **Pengguna terlempar ke `pending.html`** | Status di tabel `profiles` masih `Menunggu` | Ubah status user menjadi `Aktif` melalui halaman **Manajemen User** atau dashboard Supabase. |
| **Bypass Gate PWA untuk Uji Coba Browser** | PWA Enforcer memblokir browser desktop/laptop | Tambahkan parameter `?bypass_pwa=1` pada URL di browser (misal: `http://localhost:8000/index.html?bypass_pwa=1`). |

---

*Dokumen ini diperbarui secara berkala sesuai dengan evolusi arsitektur Gabku App.*
