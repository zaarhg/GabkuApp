// === AUTH HELPER (V1 AMAN – Token Input Mode) ===
// Frontend TIDAK tahu token yang benar
// Frontend hanya menyimpan & mengirim token
// Backend (Apps Script) yang memvalidasi token

// Ambil token dari LocalStorage
function getToken() {
  return localStorage.getItem(LS_KEY_TOKEN);
}

// Cek apakah user "sudah login" di sisi frontend
// Validasi sebenarnya tetap dilakukan backend
function isLoggedIn() {
  const t = getToken();
  return !!(t && String(t).trim());
}

// Redirect ke login jika belum ada token
function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
  }
}

// Logout = hapus token
function logout() {
  localStorage.removeItem(LS_KEY_TOKEN);
  window.location.href = "login.html";
}

// Helper untuk header Authorization (kalau mau pakai header)
// Saat ini api.js kamu pakai query string token,
// tapi ini disiapkan untuk upgrade V2 nanti
function authHeaders() {
  const t = getToken();
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + (t || "")
  };
}
