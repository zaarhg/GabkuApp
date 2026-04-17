(function () {
  function checkStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  }

  // Bypass parameter for debugging
  if (window.location.search.includes('bypass_pwa=1')) return;

  let deferredPrompt;

  // Track if we need to show the UI
  if (!checkStandalone()) {
    // We check if DOM is already loaded or we wait for it
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showPwaBlocker);
    } else {
      showPwaBlocker();
    }
  }

  // Intercept install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('pwa-install-btn');
    const waitText = document.getElementById('pwa-waiting-text');
    if (btn) {
      btn.style.display = 'block';
      if (waitText) waitText.style.display = 'none';
    }
  });

  function showPwaBlocker() {
    // Disable scrolling
    document.body.style.overflow = 'hidden';

    // Prevent duplicate overlays
    if (document.getElementById('pwa-enforcer-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pwa-enforcer-overlay';

    // Check if iOS (iPhone/iPad/iPod)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    let installUI = '';
    if (isIOS) {
      installUI = `
        <p class="pwa-text">Gunakan aplikasi dengan optimal tanpa bar browser!</p>
        <div class="pwa-steps">
          <p>1. Tekan ikon <strong>Share</strong> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:bottom;margin:0 2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> di bawah layar.</p>
          <p>2. Geser dan pilih <strong>"Add to Home Screen"</strong>.</p>
        </div>
      `;
    } else {
      installUI = `
        <p class="pwa-text">Silakan install web ini sebagai Aplikasi ke layar utama HP Anda untuk melanjutkan.</p>
        <button id="pwa-install-btn" class="btn-primary" style="display:none; width: 100%; font-size: 15px; padding: 12px; margin-top:10px;">Install Aplikasi</button>
        <p id="pwa-waiting-text" style="font-size:12px; color:#64748b; margin-top:20px;">Menyiapkan akses instalasi...<br/>(Mohon tunggu atau refresh halaman jika tombol tidak muncul)</p>
      `;
    }

    overlay.innerHTML = `
      <div class="pwa-enforcer-card">
        <div class="pwa-icon">
          <img src="assets/img/icon-192.png" alt="Gabku Logo" style="width: 80px; height: 80px; border-radius: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        </div>
        <h2 class="pwa-title">Akses Diblokir</h2>
        ${installUI}
      </div>
    `;

    document.body.appendChild(overlay);

    // Bind event for Android install
    const btn = document.getElementById('pwa-install-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            console.log('User installed the web app');
          }
          deferredPrompt = null;
        }
      });
    }

    // In case beforeinstallprompt already fired before DOMContentLoaded
    if (!isIOS && deferredPrompt && btn) {
      btn.style.display = 'block';
      const waitText = document.getElementById('pwa-waiting-text');
      if (waitText) waitText.style.display = 'none';
    }
  }
})();
