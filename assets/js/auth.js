// === AUTH HELPER (Versi RBAC Gabku) ===

// Mengecek apakah user sudah login melalui sesi Supabase
async function isLoggedIn() {
  const { data } = await supabaseClient.auth.getSession();
  return !!data.session;
}

// Redirect ke login/pending berdasarkan status profil
async function requireLogin() {
  const { data: sessionData } = await supabaseClient.auth.getSession();

  if (!sessionData.session) {
    // Abaikan redirect jika sedang di halaman login atau daftar
    if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('daftar.html')) {
      window.location.href = "login.html";
    }
    return;
  }

  const userId = sessionData.session.user.id;
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error("Auth Error:", error);
    return;
  }

  // Cek status secara Case-Insensitive
  const currentStatus = (profile?.status || "").toLowerCase();

  if (!profile || (currentStatus !== 'aktif' && currentStatus !== 'approved')) {
    if (!window.location.pathname.includes('pending.html') &&
      !window.location.pathname.includes('login.html') &&
      !window.location.pathname.includes('daftar.html')) {
      window.location.href = "pending.html";
    }
    return;
  }

  // Jika sudah aktif, simpan metadata
  const userMeta = {
    id: userId,
    email: sessionData.session.user.email,
    full_name: profile.full_name,
    role: (profile.role || 'atlet').toLowerCase(),
    status: currentStatus,
    member_id: profile.member_id // Tambahan untuk Dashboard Atlet
  };
  localStorage.setItem('gabku_user_meta', JSON.stringify(userMeta));

  // Jalankan pembatasan UI secara otomatis
  applyRolePermissions();
}

/**
 * Menyembunyikan elemen berdasarkan Role (Admin/Pelatih/Atlet)
 * .admin-only    -> Hanya terlihat oleh Admin
 * .coach-hidden  -> Disembunyikan untuk Pelatih & Atlet
 */
function applyRolePermissions() {
  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  const role = (userMeta.role || 'atlet').toLowerCase();

  // 1. Set role attribute on body for CSS-based restrictions
  document.body.dataset.userRole = role;

  // 2. Jika Atlet mencoba akses dashboard tim (index.html), lempar ke dashboard atlet
  if (role === 'atlet' && window.location.pathname.includes('index.html')) {
    window.location.href = "dashboard-atlet.html";
    return;
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
    localStorage.removeItem('gabku_user_meta');
    window.location.href = "login.html";
  }
}
