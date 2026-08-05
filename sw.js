// === GABKU APP SERVICE WORKER ===
// Versi cache: update angka ini setiap kali ada perubahan file statis
const CACHE_NAME = "gabku-v1.2.0";

// Aset statis yang di-cache saat instalasi (App Shell)
const STATIC_ASSETS = [
  "./",
  "index.html",
  "dashboard-atlet.html",
  "login.html",
  "daftar.html",
  "pending.html",
  "presensi.html",
  "kegiatan.html",
  "anggota.html",
  "rekap.html",
  "riwayat-monitoring.html",
  "monitoring.html",
  "manajemen-user.html",
  "pengaturan.html",
  "profil.html",
  "persetujuan.html",
  "panduan.html",
  "assets/css/app.css",
  "assets/js/config.js",
  "assets/js/supabase-client.js",
  "assets/js/auth.js",
  "assets/js/api.js",
  "assets/js/ui.js",
  "assets/js/utils.js",
  "assets/js/pwa-enforcer.js",
  "assets/js/index.js",
  "assets/js/dashboard-atlet.js",
  "assets/js/presensi.js",
  "assets/js/kegiatan.js",
  "assets/js/anggota.js",
  "assets/js/rekap.js",
  "assets/js/riwayat-monitoring.js",
  "assets/js/monitoring.js",
  "assets/js/manajemen-user.js",
  "assets/js/pengaturan.js",
  "assets/js/profil.js",
  "assets/js/persetujuan.js",
  "assets/js/pending.js",
  "assets/js/login.js",
  "assets/js/daftar.js",
  "assets/js/panduan.js",
  "assets/img/logo.png",
  "assets/img/favicon-50.png",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png"
];

// URL yang TIDAK boleh di-cache (panggilan API dinamis)
const NETWORK_ONLY_PATTERNS = [
  "supabase.co",
  "script.googleusercontent.com",
  "script.google.com"
];

// =====================================================================
// INSTALL: Cache semua aset statis (App Shell)
// =====================================================================
self.addEventListener("install", (event) => {
  console.log("[SW] Installing Gabku App...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        // Jangan gagalkan instalasi jika salah satu aset tidak ada
        console.warn("[SW] Some assets failed to cache:", err);
      });
    })
  );
  // Langsung aktif tanpa menunggu tab lama ditutup
  self.skipWaiting();
});

// =====================================================================
// ACTIVATE: Hapus cache lama yang sudah tidak terpakai
// =====================================================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating new version...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    )
  );
  // Klaim semua klien yang sudah terbuka
  self.clients.claim();
});

// =====================================================================
// FETCH: Strategi cache cerdas
//   - API calls (Supabase, GAS) → Network Only (selalu dari server)
//   - Aset statis (CSS, JS, HTML, Img) → Cache First, fallback Network
// =====================================================================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // NETWORK ONLY: Jangan cache panggilan API
  const isNetworkOnly = NETWORK_ONLY_PATTERNS.some((pattern) =>
    url.href.includes(pattern)
  );
  if (isNetworkOnly) {
    return; // Biarkan browser menangani langsung
  }

  // Abaikan request non-GET
  if (req.method !== "GET") return;

  // CACHE FIRST: Coba cache dulu, jika tidak ada, ambil dari network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Perbarui cache di latar belakang (stale-while-revalidate)
        fetch(req)
          .then((freshResp) => {
            if (freshResp && freshResp.status === 200) {
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(req, freshResp.clone())
              );
            }
          })
          .catch(() => { }); // Abaikan error jika offline
        return cached;
      }

      // Tidak ada di cache: ambil dari network dan simpan
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && url.origin === location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});
