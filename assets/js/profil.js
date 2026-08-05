/**
 * Gabku App - Profile Module
 * Encapsulated JS logic for profil.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  await requireLogin();
  initNavigation();
  loadProfileData();
});

function initNavigation() {
  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  const role = (userMeta.role || 'atlet').toLowerCase();
  const backBtn = document.getElementById('backBtn');
  const bottomNav = document.getElementById('bottomNav');
  const main = document.querySelector('.app-main');

  if (role === 'atlet' || role === 'athlete') {
    if (backBtn) backBtn.style.display = 'none';
    if (bottomNav) {
      bottomNav.style.display = 'flex';
      bottomNav.innerHTML = `
        <a href="dashboard-atlet.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Beranda</span>
        </a>
        <a href="panduan.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span>Panduan</span>
        </a>
        <a href="profil.html" class="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Profil</span>
        </a>
      `;
    }
    if (main) main.style.paddingBottom = '100px';
  } else {
    if (backBtn) {
      backBtn.style.display = 'flex';
      if (role === 'admin' || role === 'pelatih') {
        backBtn.href = "index.html";
      }
    }
    if (bottomNav) bottomNav.style.display = 'none';
    if (main) main.style.paddingBottom = '0';
  }
}

async function loadProfileData() {
  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  const email = userMeta.email || '—';
  const role = userMeta.role || 'atlet';

  const valEmail = document.getElementById('valEmail');
  const profileRole = document.getElementById('profileRole');

  if (valEmail) valEmail.textContent = email;
  if (profileRole) profileRole.textContent = role.toUpperCase();

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*, members(*)')
    .eq('id', userMeta.id)
    .single();

  if (profile) {
    const fullName = profile.full_name || 'Tanpa Nama';
    const profileName = document.getElementById('profileName');
    const profileInit = document.getElementById('profileInit');
    const valPhone = document.getElementById('valPhone');
    const valBirth = document.getElementById('valBirth');
    const valAddress = document.getElementById('valAddress');
    const linkWA = document.getElementById('linkWA');

    if (profileName) profileName.textContent = fullName;
    if (profileInit) profileInit.textContent = fullName.charAt(0).toUpperCase();

    const phone = profile.members?.phone || '—';
    if (valPhone) valPhone.textContent = phone;

    if (profile.members?.birth_date) {
      const d = new Date(profile.members.birth_date);
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      if (valBirth) valBirth.textContent = d.toLocaleDateString('id-ID', options);
    } else {
      if (valBirth) valBirth.textContent = '—';
    }

    if (valAddress) valAddress.textContent = profile.members?.address || 'Belum diisi';

    if (linkWA) {
      const waMsg = encodeURIComponent(`Halo Admin, saya ${fullName} ingin meminta reset/ubah kata sandi untuk akun Gabku App saya.`);
      linkWA.href = `https://wa.me/6281226162261?text=${waMsg}`;
    }
  }
}

async function handleLogout() {
  await logout();
}
window.handleLogout = handleLogout;

