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
  let proceed = true;
  if (typeof asyncConfirm === 'function') {
    proceed = await asyncConfirm("Yakin ingin keluar dari akun ini?", "Konfirmasi Logout");
  } else {
    proceed = confirm("Keluar dari Gabku App?");
  }

  if (proceed) {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  }
}