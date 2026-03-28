/******************************
 * GABKU APP - UI HELPERS
 ******************************/

// === SET TITLE OTOMATIS ===
document.addEventListener("DOMContentLoaded", () => {
  if (APP_CONFIG && APP_CONFIG.defaultTitle) {
    const pageTitle = document.title || "";
    if (!pageTitle.includes(APP_CONFIG.name)) {
      document.title = pageTitle
        ? `${pageTitle} - ${APP_CONFIG.name}`
        : APP_CONFIG.name;
    }
  }

  _highlightBottomNav();
});

// === TOAST ===
function showToast(text, duration) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.innerText = text;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, duration || APP_CONFIG.toastDuration);
}

// === LOADING OVERLAY ===
function showLoading() {
  let loader = document.getElementById("globalLoader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "globalLoader";
    loader.innerHTML = `
      <div class="loader-backdrop">
        <div class="loader-box">
          <i class="fas fa-spinner fa-spin"></i>
          <div>Memproses...</div>
        </div>
      </div>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = "flex";
}

function hideLoading() {
  const loader = document.getElementById("globalLoader");
  if (loader) loader.style.display = "none";
}

// === NAV ACTIVE STATE ===
function _highlightBottomNav() {
  const links = document.querySelectorAll(".bottom-nav a");
  const current = window.location.pathname.split("/").pop();

  links.forEach(link => {
    const href = link.getAttribute("href");
    if (href === current) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// === QUICK NAV HELPERS ===
function goHome() {
  window.location.href = "index.html";
}

