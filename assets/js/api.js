// === API HELPER (V1 AMAN – Token Input Mode) ===
// Backend Apps Script tetap memvalidasi token (Script Properties APP_TOKEN)
// Frontend hanya menyimpan token di LocalStorage dan mengirimkannya ke API

function _getTokenSafe() {
  // Pakai helper dari auth.js kalau ada, kalau tidak fallback ke localStorage
  try {
    if (typeof getToken === "function") return getToken() || "";
  } catch (_) {}
  return localStorage.getItem(LS_KEY_TOKEN) || "";
}

function _handleAuthProblem(message) {
  // Kalau token kosong / invalid / unauthorized, arahkan ke login biar jelas
  // Jangan terlalu agresif: hanya jika memang indikasinya auth
  const msg = String(message || "").toLowerCase();

  const looksAuth =
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("invalid token") ||
    msg.includes("token") ||
    msg.includes("auth");

  if (looksAuth) {
    // hapus token yang mungkin salah
    try {
      localStorage.removeItem(LS_KEY_TOKEN);
    } catch (_) {}
    // redirect
    window.location.href = "login.html";
    return true;
  }
  return false;
}

async function _parseJsonSafe(res) {
  // GAS biasanya return JSON, tapi kalau error kadang HTML
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error("Response bukan JSON. Status: " + res.status);
  }
}

async function apiGet(action, params = {}) {
  const token = _getTokenSafe();
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("token", token);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length > 0) {
      url.searchParams.set(k, v);
    }
  });

  const res = await fetch(url.toString());
  const data = await _parseJsonSafe(res);

  if (!data || !data.ok) {
    const errMsg = (data && data.error) ? data.error : "API error";
    if (_handleAuthProblem(errMsg)) return; // redirect sudah dilakukan
    throw new Error(errMsg);
  }

  return data.data;
}

async function apiPost(action, bodyObj = {}) {
  const token = _getTokenSafe();
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("token", token);

  // PENTING: gunakan text/plain agar tidak kena CORS preflight
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(bodyObj),
  });

  const data = await _parseJsonSafe(res);

  if (!data || !data.ok) {
    const errMsg = (data && data.error) ? data.error : "API error";
    if (_handleAuthProblem(errMsg)) return; // redirect sudah dilakukan
    throw new Error(errMsg);
  }

  return data.data;
}
