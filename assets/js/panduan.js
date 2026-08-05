/**
 * Gabku App - Panduan Module
 * Encapsulated JS logic for panduan.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof requireLogin === 'function') {
    await requireLogin();
  }
  initNavigation();
});

function initNavigation() {
  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  const role = (userMeta.role || 'atlet').toLowerCase();
  const backBtn = document.getElementById('backBtn');
  const bottomNav = document.getElementById('bottomNav');
  const main = document.querySelector('.app-main');

  if (role === 'atlet' || role === 'athlete') {
    // Show Bottom Nav, Hide Back Button
    if (backBtn) backBtn.style.display = 'none';
    if (bottomNav) {
      bottomNav.style.display = 'flex';
      bottomNav.innerHTML = `
        <a href="dashboard-atlet.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Beranda</span>
        </a>
        <a href="panduan.html" class="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span>Panduan</span>
        </a>
        <a href="profil.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Profil</span>
        </a>
      `;
    }
    if (main) main.style.paddingBottom = '100px';
  } else {
    // Show Back Button, Hide Bottom Nav
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

function toggleSection(element) {
  const section = element.parentElement;
  if (section) section.classList.toggle('open');
}
window.toggleSection = toggleSection;

function toggleIndicator(event, element) {
  event.stopPropagation();
  if (element && element.parentElement) {
    element.parentElement.classList.toggle('open');
  }
}
window.toggleIndicator = toggleIndicator;
