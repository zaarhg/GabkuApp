const CACHE_NAME = "gabku-v1.0.0";
const ASSETS = [
  "./",
  "login.html",
  "index.html",
  "presensi.html",
  "kegiatan.html",
  "anggota.html",
  "rekap.html",
  "assets/css/app.css",
  "assets/img/logo.png",
  "assets/img/favicon-50.png",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png"
];

// Install: cache aset inti
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: bersihkan cache lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first untuk file statis
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Hanya handle file yang berasal dari origin yang sama
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // Simpan ke cache jika request GET dan response OK
        if (req.method === "GET" && resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});
