/**
 * Gabku App - Pengaturan Module
 * Encapsulated JS logic for app settings (pengaturan.html)
 */

(async () => {
  await requireLogin();
  loadSettings();
})();

document.getElementById('pingBtn').addEventListener('click', async () => {
  const el = document.getElementById('pingMsg');
  el.textContent = 'Memeriksa koneksi...';
  try {
    const r = await apiGet('ping');
    el.textContent = 'Server aktif: ' + r.ts;
  } catch (e) {
    el.textContent = 'Gagal terhubung: ' + e.message;
  }
});

const timeListEl = document.getElementById("timeList");
const locListEl = document.getElementById("locList");
const pengurusListEl = document.getElementById("pengurusList");
const sysListEl = document.getElementById("sysList");
const msgEl = document.getElementById("msgEl");

let timeOptions = [];
let locOptions = [];
let pengurusOptions = [];
let sysOptions = [];



async function loadSettings() {
  timeListEl.innerHTML = "<p class='muted'>Memuat...</p>";
  locListEl.innerHTML = "<p class='muted'>Memuat...</p>";
  pengurusListEl.innerHTML = "<p class='muted'>Memuat...</p>";
  sysListEl.innerHTML = "<p class='muted'>Memuat...</p>";
  msgEl.textContent = "";

  try {
    const { data, error } = await supabaseClient.from('app_settings').select('*');
    if (error) throw error;

    const timeRow = data.find(r => r.setting_key === 'time_options');
    const locRow = data.find(r => r.setting_key === 'location_options');
    const pengRow = data.find(r => r.setting_key === 'pengurus_options');
    const sysRow = data.find(r => r.setting_key === 'system_options');
    const pointRow = data.find(r => r.setting_key === 'attendance_points');
    const dashActRow = data.find(r => r.setting_key === 'dashboard_activity');

    timeOptions = timeRow ? timeRow.setting_value : [];
    locOptions = locRow ? locRow.setting_value : [];

    if (pengRow && pengRow.setting_value) {
      pengurusOptions = Array.isArray(pengRow.setting_value) ? pengRow.setting_value : (typeof pengRow.setting_value === 'string' ? JSON.parse(pengRow.setting_value) : []);
    } else {
      pengurusOptions = ["Ketua", "Wakil Ketua", "Sekretaris", "Bendahara", "Anggota Divisi"];
    }

    sysOptions = sysRow ? sysRow.setting_value : ["Standard American", "Precision", "Sistem Berdikari", "Two-over-one"];
    document.getElementById('pointInput').value = pointRow ? pointRow.setting_value : 10000;

    const waRow = data.find(r => r.setting_key === 'admin_wa_number');
    document.getElementById('waInput').value = waRow ? waRow.setting_value : '085848477782';

    const monWeightRow = data.find(r => r.setting_key === 'monitoring_weight_absensi');
    document.getElementById('monWeightInput').value = monWeightRow ? monWeightRow.setting_value : 30;

    timeOptions.sort();
    locOptions.sort();
    pengurusOptions.sort();

    renderTimeSettings();
    renderLocSettings();
    renderPengurusSettings();
    renderSysSettings();

    const { data: acts } = await supabaseClient.from('activities').select('name').eq('is_active', true).order('name');
    if (acts) {
      const sel = document.getElementById('dashActivitySel');
      sel.innerHTML = '<option value="">-- Semua Kegiatan --</option>' +
        acts.map(a => `<option value="${escapeHtml(a.name)}" ${dashActRow && dashActRow.setting_value === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
    }
  } catch (e) {
    timeListEl.innerHTML = ""; locListEl.innerHTML = ""; pengurusListEl.innerHTML = ""; sysListEl.innerHTML = "";
    msgEl.style.color = "red"; msgEl.textContent = "Error: " + e.message;
  }
}

async function saveSettingToDb(key, value) {
  msgEl.style.color = "#1590df";
  msgEl.textContent = "Menyimpan...";
  try {
    const { error } = await supabaseClient.from('app_settings').upsert([{
      setting_key: key,
      setting_value: value
    }]);
    if (error) throw error;
    msgEl.style.color = "green";
    msgEl.textContent = "Berhasil disimpan!";
    setTimeout(() => msgEl.textContent = "", 2000);
  } catch (e) {
    msgEl.style.color = "red";
    msgEl.textContent = "Gagal simpan: " + e.message;
  }
}

function renderTimeSettings() {
  if (!timeOptions.length) {
    timeListEl.innerHTML = "<p class='text-xs text-muted'>Belum ada opsi waktu.</p>";
    return;
  }
  timeListEl.innerHTML = timeOptions.map((t, i) => `
    <div class="item-card flex justify-between items-center mb-1.5 py-2.5 px-3">
      <div class="font-bold text-sm text-main">⏰ ${escapeHtml(t)}</div>
      <button class="btn-delete flex items-center justify-center m-0 admin-only" style="width:34px; height:34px; padding:0;" onclick="removeTime(${i})" title="Hapus">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>
      </button>
    </div>
  `).join("");
}

function renderLocSettings() {
  if (!locOptions.length) {
    locListEl.innerHTML = "<p class='text-xs text-muted'>Belum ada opsi lokasi.</p>";
    return;
  }
  locListEl.innerHTML = locOptions.map((l, i) => `
    <div class="item-card flex justify-between items-center mb-1.5 py-2.5 px-3">
      <div class="font-bold text-sm flex-1 pr-2.5 text-main">📍 ${escapeHtml(l)}</div>
      <button class="btn-delete flex items-center justify-center m-0 admin-only" style="width:34px; height:34px; padding:0;" onclick="removeLoc(${i})" title="Hapus">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>
      </button>
    </div>
  `).join("");
}

function renderPengurusSettings() {
  if (!pengurusOptions.length) {
    pengurusListEl.innerHTML = "<p class='text-xs text-muted'>Belum ada opsi kepengurusan.</p>";
    return;
  }
  pengurusListEl.innerHTML = pengurusOptions.map((p, i) => `
    <div class="item-card flex justify-between items-center mb-1.5 py-2.5 px-3">
      <div class="font-bold text-sm flex-1 pr-2.5 text-main">👤 ${escapeHtml(p)}</div>
      <button class="btn-delete flex items-center justify-center m-0 admin-only" style="width:34px; height:34px; padding:0;" onclick="removePengurus(${i})" title="Hapus">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>
      </button>
    </div>
  `).join("");
}

function renderSysSettings() {
  if (!sysOptions.length) {
    sysListEl.innerHTML = "<p class='text-xs text-muted'>Belum ada opsi sistem.</p>";
    return;
  }
  sysListEl.innerHTML = sysOptions.map((s, i) => `
    <div class="item-card flex justify-between items-center mb-1.5 py-2.5 px-3">
      <div class="font-bold text-sm flex-1 pr-2.5 text-main">⚙️ ${escapeHtml(s)}</div>
      <button class="btn-delete flex items-center justify-center m-0 admin-only" style="width:34px; height:34px; padding:0;" onclick="removeSys(${i})" title="Hapus">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>
      </button>
    </div>
  `).join("");
}

// ACTIONS
document.getElementById("addTimeBtn").onclick = async () => {
  const s = document.getElementById("timeStartInput").value;
  const e = document.getElementById("timeEndInput").value;
  if (!s || !e) return alert("Harap isi waktu mulai dan selesai.");
  const val = `${s} - ${e}`;
  if (timeOptions.includes(val)) return alert("Waktu sudah ada dalam daftar.");

  timeOptions.push(val);
  timeOptions.sort();
  renderTimeSettings();
  document.getElementById("timeStartInput").value = "";
  document.getElementById("timeEndInput").value = "";
  await saveSettingToDb('time_options', timeOptions);
};

window.removeTime = async (index) => {
  const t = timeOptions[index];
  if (!confirm("Hapus opsi waktu " + t + "?")) return;
  timeOptions.splice(index, 1);
  renderTimeSettings();
  await saveSettingToDb('time_options', timeOptions);
};

document.getElementById("addLocBtn").onclick = async () => {
  const val = document.getElementById("locInput").value.trim();
  if (!val) return;
  if (locOptions.map(l => l.toLowerCase()).includes(val.toLowerCase())) return alert("Tempat sudah ada dalam daftar.");

  locOptions.push(val);
  locOptions.sort();
  renderLocSettings();
  document.getElementById("locInput").value = "";
  await saveSettingToDb('location_options', locOptions);
};

window.removeLoc = async (index) => {
  const loc = locOptions[index];
  if (!confirm("Hapus opsi tempat " + loc + "?")) return;
  locOptions.splice(index, 1);
  renderLocSettings();
  await saveSettingToDb('location_options', locOptions);
};

document.getElementById("addPengurusBtn").onclick = async () => {
  const val = document.getElementById("pengurusInput").value.trim();
  if (!val) return;
  if (pengurusOptions.map(l => l.toLowerCase()).includes(val.toLowerCase())) return alert("Status sudah ada dalam daftar.");

  pengurusOptions.push(val);
  pengurusOptions.sort();
  renderPengurusSettings();
  document.getElementById("pengurusInput").value = "";
  await saveSettingToDb('pengurus_options', pengurusOptions);
};

window.removePengurus = async (index) => {
  const p = pengurusOptions[index];
  if (!confirm("Hapus opsi status " + p + "?")) return;
  pengurusOptions.splice(index, 1);
  renderPengurusSettings();
  await saveSettingToDb('pengurus_options', pengurusOptions);
};

document.getElementById("addSysBtn").onclick = async () => {
  const val = document.getElementById("sysInput").value.trim();
  if (!val) return;
  if (sysOptions.map(l => l.toLowerCase()).includes(val.toLowerCase())) return alert("Sistem sudah ada dalam daftar.");

  sysOptions.push(val);
  sysOptions.sort();
  renderSysSettings();
  document.getElementById("sysInput").value = "";
  await saveSettingToDb('system_options', sysOptions);
};

document.getElementById("savePointBtn").onclick = async () => {
  const val = parseInt(document.getElementById("pointInput").value);
  if (isNaN(val)) return alert("Masukkan angka point yang valid.");
  await saveSettingToDb('attendance_points', val);
  alert("Point berhasil disimpan.");
};

document.getElementById("saveDashActivityBtn").onclick = async () => {
  const val = document.getElementById("dashActivitySel").value;
  await saveSettingToDb('dashboard_activity', val);
  alert("Pilihan kegiatan dashboard berhasil disimpan.");
};

document.getElementById("saveWaBtn").onclick = async () => {
  const val = document.getElementById("waInput").value.trim();
  if (!val) return alert("Masukkan nomor WA yang valid.");
  await saveSettingToDb('admin_wa_number', val);
  alert("Nomor WA Admin berhasil disimpan.");
};

document.getElementById("saveMonWeightBtn").onclick = async () => {
  const val = parseInt(document.getElementById("monWeightInput").value);
  if (isNaN(val) || val < 0 || val > 100) return alert("Masukkan angka bobot antara 0 - 100.");
  await saveSettingToDb('monitoring_weight_absensi', val);
  alert("Bobot monitoring berhasil disimpan.");
};

window.removeSys = async (index) => {
  const sys = sysOptions[index];
  if (!confirm("Hapus opsi sistem " + sys + "?")) return;
  sysOptions.splice(index, 1);
  renderSysSettings();
  await saveSettingToDb('system_options', sysOptions);
};
