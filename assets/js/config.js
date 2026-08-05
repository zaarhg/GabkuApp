// === KONFIGURASI SUPABASE ===
const SUPABASE_URL = "https://tgibueuvvefnhtceqrnl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnaWJ1ZXV2dmVmbmh0Y2Vxcm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjc0NzEsImV4cCI6MjA4OTk0MzQ3MX0.mswoNtmfMxXzeevK-b-F7tGzVS1pSGQWDfXWVhf_usk";

// SCRIPT_URL (Gunakan nama ini agar sesuai dengan yang dipanggil di api.js)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhOGtUzUSU6gnwrEpOT-HdzErUASXJCAlJx8tHiGwSg7bw-zcNtKJrpt82dWuteEmn/exec";

// Key Token (Pastikan sama dengan ACCESS_TOKEN di Script Properties GAS)
const LS_KEY_TOKEN = "jendralgabku";

// APP_CONFIG (Required by ui.js)
const APP_CONFIG = {
  name: "Gabku App",
  defaultTitle: true,
  toastDuration: 3000
};

// =====================================
// AUTO-LOAD PWA ENFORCER & SERVICE WORKER
// =====================================
(function () {
  const script = document.createElement('script');
  script.src = 'assets/js/pwa-enforcer.js';
  document.head.appendChild(script);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    });
  }
})();