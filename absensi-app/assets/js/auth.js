// === AUTH HELPER (Versi Supabase) ===

// Mengecek apakah user sudah login melalui sesi Supabase
async function isLoggedIn() {
  const { data } = await supabaseClient.auth.getSession();
  return !!data.session;
}

// Redirect ke login jika belum ada sesi aktif
async function requireLogin() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
  }
}

// Fungsi Logout
async function logout() {
  if (confirm("Keluar dari Gabku App?")) {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  }
}