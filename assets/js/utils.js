/************************************************
 * GABKU APP - UTILS & HELPERS UNIVERSAL
 * Centralized helper functions used across all pages
 ************************************************/

/**
 * Escapes HTML characters to prevent XSS attacks
 * @param {string} s 
 * @returns {string}
 */
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
window.escHtml = escHtml;
window.escapeHtml = escHtml;

/**
 * Toast Notification Helper
 * @param {string} msg 
 * @param {string} type 'success' | 'error' | 'info'
 * @param {number} duration 
 */
function showToastMsg(msg, type = 'info', duration = 3500) {
  const t = document.getElementById('toast');
  if (!t) {
    alert(msg);
    return;
  }
  t.textContent = msg;
  t.style.display = 'block';
  t.style.background = type === 'error' ? '#dc2626' : type === 'info' ? '#0369a1' : '#16a34a';
  t.style.opacity = '1';

  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  if (window._toastHideTimeout) clearTimeout(window._toastHideTimeout);

  window._toastTimeout = setTimeout(() => {
    t.style.opacity = '0';
    window._toastHideTimeout = setTimeout(() => {
      t.style.display = 'none';
      t.style.opacity = '1';
    }, 400);
  }, duration);
}
window.showToastMsg = showToastMsg;

/**
 * Alias for showToast
 */
function showToast(text, duration = 3000) {
  showToastMsg(text, 'info', duration);
}
window.showToast = showToast;

/**
 * Month Names in Indonesian
 */
const NAMA_BULAN = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
window.NAMA_BULAN = NAMA_BULAN;

/**
 * Format Date to Indonesian Readable Format (e.g. 05 Agustus 2026)
 * @param {string|Date} dateVal 
 * @returns {string}
 */
function formatDateIndo(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = NAMA_BULAN[d.getMonth() + 1] || '';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}
window.formatDateIndo = formatDateIndo;

/**
 * Custom Promise-based Confirm Modal (Supports HTML modal fallback & dynamic creation)
 * @param {string} message 
 * @param {string} title 
 * @returns {Promise<boolean>}
 */
function customConfirm(message, title = 'Konfirmasi', options = {}) {
  return new Promise((resolve) => {
    // Check if HTML has existing #customConfirm modal structure
    const htmlModal = document.getElementById("customConfirm");
    const confirmTitle = document.getElementById("confirmTitle");
    const confirmMsg = document.getElementById("confirmMsg");
    const confirmBtnYes = document.getElementById("confirmBtnYes");
    const confirmBtnNo = document.getElementById("confirmBtnNo");

    let isDanger = options.isDanger || false;
    let yesText = options.yesText || 'Ya, Lanjutkan';
    let noText = options.noText || 'Batal';

    const lowerMsg = (message || '').toLowerCase();
    const lowerTitle = (title || '').toLowerCase();

    if (lowerMsg.includes('hapus') || lowerTitle.includes('hapus') || lowerMsg.includes('keluar') || lowerTitle.includes('keluar')) {
      isDanger = true;
      if (!options.yesText) {
        if (lowerMsg.includes('hapus') || lowerTitle.includes('hapus')) {
          yesText = 'Ya, Hapus';
        } else if (lowerMsg.includes('keluar') || lowerTitle.includes('keluar')) {
          yesText = 'Ya, Keluar';
        }
      }
    }

    if (htmlModal && confirmTitle && confirmMsg && confirmBtnYes && confirmBtnNo) {
      confirmTitle.textContent = title;
      confirmMsg.textContent = message;
      confirmBtnNo.style.display = 'block';

      confirmBtnYes.className = 'btn-danger';
      confirmBtnYes.textContent = yesText;

      confirmBtnNo.className = 'btn-primary';
      confirmBtnNo.textContent = noText;

      htmlModal.style.display = 'flex';
      htmlModal.classList.add('show');

      const onYes = () => { htmlModal.style.display = 'none'; htmlModal.classList.remove('show'); resolve(true); };
      const onNo = () => { htmlModal.style.display = 'none'; htmlModal.classList.remove('show'); resolve(false); };

      confirmBtnYes.onclick = onYes;
      confirmBtnNo.onclick = onNo;
      return;
    }

    // Dynamic Modal fallback
    let modal = document.getElementById('customConfirmModalDynamic');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'customConfirmModalDynamic';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); display:none; align-items:center; justify-content:center; z-index:99999; padding:20px;';
      modal.innerHTML = `
        <div class="modal-card" style="max-width:360px; width:100%; padding:20px; border-radius:16px; background:#fff; box-shadow:0 10px 25px rgba(0,0,0,0.15); text-align:center;">
          <h3 id="customConfirmDynTitle" style="margin:0 0 10px; font-size:16px; font-weight:700; color:#1e293b;">${escHtml(title)}</h3>
          <p id="customConfirmDynMessage" style="margin:0 0 20px; font-size:14px; color:#475569; line-height:1.5;">${escHtml(message)}</p>
          <div style="display:flex; gap:10px; justify-content:center;">
            <button id="customConfirmDynCancelBtn" style="flex:1; padding:10px; border:none; background:#198cda; border-radius:8px; font-weight:600; cursor:pointer; color:#fff;">${escHtml(noText)}</button>
            <button id="customConfirmDynOkBtn" style="flex:1; padding:10px; border:1px solid #fecaca; background:#fef2f2; border-radius:8px; font-weight:600; cursor:pointer; color:#dc2626;">${escHtml(yesText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      document.getElementById('customConfirmDynTitle').textContent = title;
      document.getElementById('customConfirmDynMessage').textContent = message;
      const cancelDynBtn = document.getElementById('customConfirmDynCancelBtn');
      cancelDynBtn.textContent = noText;
      cancelDynBtn.style.background = '#198cda';
      cancelDynBtn.style.color = '#fff';

      const okDynBtn = document.getElementById('customConfirmDynOkBtn');
      okDynBtn.textContent = yesText;
      okDynBtn.style.background = '#fef2f2';
      okDynBtn.style.color = '#dc2626';
      okDynBtn.style.border = '1px solid #fecaca';
    }

    modal.style.display = 'flex';
    modal.classList.add('show');

    const okBtn = document.getElementById('customConfirmDynOkBtn');
    const cancelBtn = document.getElementById('customConfirmDynCancelBtn');

    const cleanup = () => {
      modal.style.display = 'none';
      modal.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}
window.customConfirm = customConfirm;
window.asyncConfirm = customConfirm;

/**
 * Custom Promise-based Alert Modal (Supports HTML modal fallback & dynamic creation)
 * @param {string} message 
 * @param {string} title 
 * @returns {Promise<void>}
 */
function asyncAlert(message, title = 'Informasi') {
  return new Promise((resolve) => {
    const htmlModal = document.getElementById("customConfirm");
    const confirmTitle = document.getElementById("confirmTitle");
    const confirmMsg = document.getElementById("confirmMsg");
    const confirmBtnYes = document.getElementById("confirmBtnYes");
    const confirmBtnNo = document.getElementById("confirmBtnNo");

    if (htmlModal && confirmTitle && confirmMsg && confirmBtnYes) {
      confirmTitle.textContent = title;
      confirmMsg.textContent = message;
      if (confirmBtnNo) confirmBtnNo.style.display = 'none';
      htmlModal.style.display = 'flex';
      htmlModal.classList.add('show');

      const onOk = () => {
        htmlModal.style.display = 'none';
        htmlModal.classList.remove('show');
        confirmBtnYes.onclick = null;
        resolve();
      };
      confirmBtnYes.onclick = onOk;
      return;
    }

    let modal = document.getElementById('customAlertModalDynamic');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'customAlertModalDynamic';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); display:none; align-items:center; justify-content:center; z-index:99999; padding:20px;';
      modal.innerHTML = `
        <div class="modal-card" style="max-width:360px; width:100%; padding:20px; border-radius:16px; background:#fff; box-shadow:0 10px 25px rgba(0,0,0,0.15); text-align:center;">
          <h3 id="customAlertDynTitle" style="margin:0 0 10px; font-size:16px; font-weight:700; color:#1e293b;">${escHtml(title)}</h3>
          <p id="customAlertDynMessage" style="margin:0 0 20px; font-size:14px; color:#475569; line-height:1.5;">${escHtml(message)}</p>
          <button id="customAlertDynOkBtn" style="width:100%; padding:10px; border:none; background:#0284c7; border-radius:8px; font-weight:600; cursor:pointer; color:#fff;">OK</button>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      document.getElementById('customAlertDynTitle').textContent = title;
      document.getElementById('customAlertDynMessage').textContent = message;
    }

    modal.style.display = 'flex';
    modal.classList.add('show');

    const okBtn = document.getElementById('customAlertDynOkBtn');
    const onOk = () => {
      modal.style.display = 'none';
      modal.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      resolve();
    };
    okBtn.addEventListener('click', onOk);
  });
}
window.asyncAlert = asyncAlert;

/**
 * Get User Session Metadata safely
 * @returns {object}
 */
function getUserMeta() {
  try {
    return JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  } catch (_) {
    return {};
  }
}
window.getUserMeta = getUserMeta;
