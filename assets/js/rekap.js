/**
 * Gabku App - Rekap Module
 * Encapsulated JS logic for attendance summary & PDF history page (rekap.html)
 */

(async () => {
  await requireLogin();
  init();
})();

const monthSel = document.getElementById('monthSel');
const memberMonthSel = document.getElementById('memberMonthSel');
const sessionMonthSel = document.getElementById('sessionMonthSel');
let lastMonthlyData = [];
let membersCache = [];

function escapeHtml(s) {
  return String(s || '').replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getDateRange(val, startId, endId) {
  if (val === 'last3') {
    const d = new Date(); d.setMonth(d.getMonth() - 2);
    return { start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, end: '2099-12-31' };
  }
  if (val === 'last6') {
    const d = new Date(); d.setMonth(d.getMonth() - 5);
    return { start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, end: '2099-12-31' };
  }
  if (val === 'last12') {
    const d = new Date(); d.setMonth(d.getMonth() - 11);
    return { start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, end: '2099-12-31' };
  }
  if (val === 'custom') {
    const s = document.getElementById(startId).value;
    const e = document.getElementById(endId).value;
    return { start: s || '2000-01-01', end: e || '2099-12-31' };
  }
  return { start: `${val}-01`, end: `${val}-31` };
}

function asyncAlert(msg, title = "Informasi") {
  return new Promise((resolve) => {
    const modal = document.getElementById("customConfirm");
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMsg").textContent = msg;
    document.getElementById("confirmBtnNo").style.display = 'none';
    modal.style.display = 'flex';

    document.getElementById("confirmBtnYes").onclick = () => { modal.style.display = 'none'; resolve(true); };
  });
}

/* ── Member Picker ── */
let pickerPool = [];
async function openRekapPicker() {
  const actFilter = document.getElementById('memberActivitySel').value;
  const { start, end } = getDateRange(document.getElementById('memberMonthSel').value, 'memberStartD', 'memberEndD');

  document.getElementById('rekapPickerSearch').value = '';
  document.getElementById('rekapPickerList').innerHTML = "<p class='muted text-center py-4'>Memuat daftar...</p>";
  document.getElementById('memberPickerModal').classList.add('show');

  try {
    if (actFilter) {
      let query = supabaseClient.from('attendance_detail')
        .select('member_id, member_name_snapshot, member_role_snapshot, attendance_header!inner(date, activity_name_snapshot)')
        .gte('attendance_header.date', start)
        .lte('attendance_header.date', end);

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (actFilter === '[CAT]Latihan') {
        filteredData = filteredData.filter(d => isMatchCategory(d.attendance_header?.activity_name_snapshot, latihanNames));
      } else if (actFilter === '[CAT]Pertandingan') {
        filteredData = filteredData.filter(d => isMatchCategory(d.attendance_header?.activity_name_snapshot, pertandinganNames));
      } else if (actFilter === '[CAT]Lainnya') {
        filteredData = filteredData.filter(d => !isMatchCategory(d.attendance_header?.activity_name_snapshot, latihanNames) && !isMatchCategory(d.attendance_header?.activity_name_snapshot, pertandinganNames));
      } else if (actFilter) {
        filteredData = filteredData.filter(d => isMatchSingle(d.attendance_header?.activity_name_snapshot, actFilter));
      }

      const uniqueMap = new Map();
      filteredData.forEach(d => {
        if (!uniqueMap.has(d.member_id)) {
          uniqueMap.set(d.member_id, { id: d.member_id, name: d.member_name_snapshot, role: d.member_role_snapshot });
        }
      });
      pickerPool = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      pickerPool = membersCache;
    }

    filterRekapPicker('');
    document.getElementById('rekapPickerSearch').focus();
  } catch (e) {
    document.getElementById('rekapPickerList').innerHTML = `<p class='msg text-center py-4'>Gagal memuat: ${e.message}</p>`;
  }
}

function closeRekapPicker() {
  document.getElementById('memberPickerModal').classList.remove('show');
}
window.closeRekapPicker = closeRekapPicker;

function filterRekapPicker(q) {
  const pool = q.trim()
    ? pickerPool.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : pickerPool;

  if (!pool.length) {
    document.getElementById('rekapPickerList').innerHTML = "<p class='muted text-center py-4'>Tidak ada anggota ditemukan.</p>";
    return;
  }

  const currentId = document.getElementById('memberSel').value;
  document.getElementById('rekapPickerList').innerHTML = pool.map(m => {
    const sel = m.id === currentId;
    return `
      <div class="picker-item${sel ? ' selected' : ''}" onclick="selectRekapMember('${m.id}','${escapeHtml(m.name)}',${sel ? 'true' : 'false'},this)">
        <div class="picker-check">${sel ? '\u2713' : ''}</div>
        <div>
          <div class="picker-item-name">${escapeHtml(m.name)}</div>
          <div class="picker-item-role">${escapeHtml(m.role || '')}</div>
        </div>
      </div>`;
  }).join('');
}
window.filterRekapPicker = filterRekapPicker;

function selectRekapMember(id, name, isSame, el) {
  if (isSame === true || isSame === 'true') {
    document.getElementById('memberSel').value = '';
    document.getElementById('memberSelText').textContent = 'Pilih anggota...';
    document.getElementById('memberSelText').style.color = '#999';
    closeRekapPicker();
    return;
  }
  document.getElementById('memberSel').value = id;
  document.getElementById('memberSelText').textContent = name;
  document.getElementById('memberSelText').style.color = '#111827';
  closeRekapPicker();
  if (memberLoaded) document.getElementById('loadMemberBtn').click();
}
window.selectRekapMember = selectRekapMember;

document.getElementById('memberPickerModal').addEventListener('click', e => {
  if (e.target === document.getElementById('memberPickerModal')) closeRekapPicker();
});

let latihanNames = [];
let pertandinganNames = [];

function isMatchCategory(snapshotName, nameList) {
  if (!snapshotName || !nameList) return false;
  return nameList.some(name => snapshotName === name || snapshotName.startsWith(name + ' - '));
}

function isMatchSingle(snapshotName, filterName) {
  if (!snapshotName || !filterName) return false;
  const s = snapshotName.toLowerCase();
  const f = filterName.toLowerCase();
  return s === f || s.startsWith(f + ' - ');
}

let sessionLoaded = true;
let monthlyLoaded = true;
let memberLoaded = true;

async function init() {
  const { data: mems } = await supabaseClient.from('members').select('id, name, role').order('name');
  if (mems) membersCache = mems;

  const { data: headers, error } = await supabaseClient.from('attendance_header').select('date').order('date', { ascending: false });

  const uniqueMonths = new Set();
  if (headers) {
    headers.forEach(h => {
      if (h.date) uniqueMonths.add(h.date.slice(0, 7));
    });
  }

  const months = [
    `<option value="last3">3 Bulan Terakhir</option>`,
    `<option value="last6">6 Bulan Terakhir</option>`,
    `<option value="last12">1 Tahun Terakhir</option>`
  ];

  if (uniqueMonths.size === 0) {
    const d = new Date();
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    months.push(`<option value="${val}">${label}</option>`);
  } else {
    uniqueMonths.forEach(val => {
      const [yyyy, mm] = val.split('-');
      const d = new Date(yyyy, parseInt(mm) - 1, 1);
      const label = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
      months.push(`<option value="${val}">${label}</option>`);
    });
  }
  months.push(`<option value="custom">Custom (Tanggal)</option>`);
  monthSel.innerHTML = memberMonthSel.innerHTML = sessionMonthSel.innerHTML = months.join('');

  const { data: acts } = await supabaseClient.from('activities').select('name, category').eq('is_active', true).order('name');
  if (acts) {
    latihanNames = acts.filter(a => a.category === 'Latihan').map(a => a.name);
    pertandinganNames = acts.filter(a => a.category === 'Pertandingan').map(a => a.name);
    const uniqueActs = [...new Set(acts.map(a => a.name))];
    const actOpts = `
      <option value="">Semua Kegiatan (Gabung)</option>
      <option value="[CAT]Latihan">--- Kategori: Latihan ---</option>
      <option value="[CAT]Pertandingan">--- Kategori: Pertandingan ---</option>
      <option value="[CAT]Lainnya">--- Kategori: Lainnya ---</option>
      <optgroup label="Spesifik Kegiatan Tunggal:">
        ${uniqueActs.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`)}
      </optgroup>
    `;
    document.getElementById('sessionActivitySel').innerHTML = actOpts;
    document.getElementById('monthlyActivitySel').innerHTML = actOpts;
    document.getElementById('memberActivitySel').innerHTML = actOpts;
  }
}

// --- TAB LOGIC ---
document.getElementById('tabMonthly').onclick = () => switchTab('monthly');
document.getElementById('tabSession').onclick = () => switchTab('session');
document.getElementById('tabMember').onclick = () => switchTab('member');

function switchTab(t) {
  document.getElementById('panelMonthly').style.display = t === 'monthly' ? 'block' : 'none';
  document.getElementById('panelSession').style.display = t === 'session' ? 'block' : 'none';
  document.getElementById('panelMember').style.display = t === 'member' ? 'block' : 'none';

  document.getElementById('tabMonthly').classList.toggle('active', t === 'monthly');
  document.getElementById('tabSession').classList.toggle('active', t === 'session');
  document.getElementById('tabMember').classList.toggle('active', t === 'member');
}

document.getElementById('memberSelBtn').onclick = () => openRekapPicker();

// --- 1. LOGIC RIWAYAT SESI & PDF ---
document.getElementById('loadSessionBtn').onclick = async () => {
  sessionLoaded = true;
  const out = document.getElementById('sessionOutput');
  out.innerHTML = "<p class='muted'>Memuat riwayat sesi...</p>";
  const { start, end } = getDateRange(sessionMonthSel.value, 'sessionStartD', 'sessionEndD');
  const actFilter = document.getElementById('sessionActivitySel').value;

  try {
    let query = supabaseClient.from('attendance_header')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });

    const { data: fetchRaw, error } = await query;

    if (error) throw error;
    let data = fetchRaw;

    const headerIds = data.map(h => h.id);
    const statsMap = {};
    if (headerIds.length > 0) {
      const { data: details } = await supabaseClient.from('attendance_detail')
        .select('attendance_id, presence')
        .in('attendance_id', headerIds);

      if (details) {
        details.forEach(d => {
          if (!statsMap[d.attendance_id]) statsMap[d.attendance_id] = { H: 0, I: 0, S: 0, A: 0 };
          const s = statsMap[d.attendance_id];
          if (d.presence === 'Hadir') s.H++;
          else if (d.presence === 'Izin') s.I++;
          else if (d.presence === 'Sakit') s.S++;
          else if (d.presence === 'Alpa') s.A++;
        });
      }
    }

    if (actFilter) {
      if (actFilter === '[CAT]Latihan') {
        data = data.filter(d => isMatchCategory(d.activity_name_snapshot, latihanNames));
      } else if (actFilter === '[CAT]Pertandingan') {
        data = data.filter(d => isMatchCategory(d.activity_name_snapshot, pertandinganNames));
      } else if (actFilter === '[CAT]Lainnya') {
        data = data.filter(d => !isMatchCategory(d.activity_name_snapshot, latihanNames) && !isMatchCategory(d.activity_name_snapshot, pertandinganNames));
      } else {
        data = data.filter(d => isMatchSingle(d.activity_name_snapshot, actFilter));
      }
    }

    if (!data.length) return out.innerHTML = "<p class='muted'>Tidak ada kegiatan di periode ini berdasarkan filter.</p>";

    const countLatihan = data.filter(d => isMatchCategory(d.activity_name_snapshot, latihanNames)).length;
    const countPertandingan = data.filter(d => isMatchCategory(d.activity_name_snapshot, pertandinganNames)).length;
    const countLain = data.length - countLatihan - countPertandingan;

    let recapHtml = '';
    if (actFilter === '[CAT]Pertandingan') {
      recapHtml = `
         <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
           <div class="text-sm text-warning font-bold">Total Pertandingan: <span class="text-base font-extrabold">${countPertandingan}</span> sesi</div>
         </div>
       `;
    } else if (actFilter === '[CAT]Lainnya') {
      recapHtml = `
         <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
           <div class="text-sm text-main font-bold">Total Lainnya: <span class="text-base font-extrabold">${countLain}</span> sesi</div>
         </div>
       `;
    } else if (actFilter === '[CAT]Latihan') {
      recapHtml = `
         <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
           <div class="text-sm text-success font-bold">Total Latihan: <span class="text-base font-extrabold">${countLatihan}</span> sesi</div>
         </div>
       `;
    } else {
      recapHtml = `
         <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
           <div class="text-sm text-main font-bold">Latihan: <span class="text-base font-extrabold">${countLatihan}</span> | Pertandingan: <span class="text-base font-extrabold">${countPertandingan}</span> | Lainnya: <span class="text-base font-extrabold">${countLain}</span> sesi</div>
         </div>
       `;
    }

    out.innerHTML = recapHtml + `<div class="session-card-container">` + data.map((h) => {
      const stats = statsMap[h.id];
      return `
      <div class="session-card-item">
        <div class="session-card-header">
          <div class="session-card-title">${escapeHtml(h.activity_name_snapshot)}</div>
          <div class="session-card-actions">
            ${h.pdf_file_id
          ? `<a href="https://drive.google.com/file/d/${h.pdf_file_id}/view" target="_blank" class="session-action-btn pdf" title="Buka PDF">
               <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
             </a>
             <button onclick="sharePDF('${escapeHtml(h.activity_name_snapshot)}', '${h.date}', '${h.pdf_file_id}', 'Hadir: ${stats?.H || 0}, Izin: ${stats?.I || 0}, Sakit: ${stats?.S || 0}, Alpa: ${stats?.A || 0}')" class="session-action-btn share" title="Bagikan">
               <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92 0-1.61-1.31-2.92-2.92-2.92z"/></svg>
             </button>`
          : `<div class="session-action-btn disabled" title="Tanpa PDF">
               <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2"/></svg>
             </div>`}
            
            <a href="presensi.html?edit=${h.id}" class="admin-only session-action-btn edit" title="Edit Riwayat">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>
            <button onclick="deleteSession('${h.id}', '${escapeHtml(h.activity_name_snapshot)}', '${h.date}')" class="admin-only session-action-btn delete" title="Hapus Riwayat">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </div>

        <div class="session-card-details">
          <span class="session-detail-pill date">📅 ${h.date}</span>
          ${h.location_snapshot ? `<span class="session-detail-pill location">📍 ${escapeHtml(h.location_snapshot)}</span>` : ''}
        </div>

        ${stats ? `
          <div class="session-card-stats">
            <span class="stat-badge hadir">Hadir: ${stats.H}</span>
            <span class="stat-badge izin">Izin: ${stats.I}</span>
            <span class="stat-badge sakit">Sakit: ${stats.S}</span>
            <span class="stat-badge alpa">Alpa: ${stats.A}</span>
          </div>
        ` : ''}
      </div>
    `;
    }).join('') + `</div>`;
  } catch (e) { out.innerHTML = `<p class='msg'>Error: ${e.message}</p>`; }
};

window.sharePDF = async (activityName, date, fileId, stats) => {
  const url = `https://drive.google.com/file/d/${fileId}/view`;
  const text = `Rekap presensi *${activityName}* (${date})\n${stats}\n\nLink: ${url}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Presensi ${activityName}`,
        text: text
      });
    } catch (e) {
      console.log('User cancelled share atau error:', e);
    }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      asyncAlert("Link PDF & Statistik telah disalin ke clipboard! Silakan paste/tempel pesan di chat tujuan Anda.");
    } catch (e) {
      asyncAlert("Gagal menyalin link: " + e.message);
    }
  }
};

window.deleteSession = async (id, activityName, date) => {
  const modal = document.getElementById("customConfirm");
  document.getElementById("confirmTitle").textContent = "Hapus Riwayat Presensi";
  document.getElementById("confirmMsg").innerHTML = `Apakah Anda yakin ingin menghapus data presensi <b>${activityName}</b> tanggal <b>${date}</b> secara permanen?<br><br><small class='text-muted'>Tindakan ini tidak dapat dibatalkan.</small>`;
  document.getElementById("confirmBtnNo").style.display = 'block';
  modal.style.display = 'flex';

  document.getElementById("confirmBtnYes").onclick = async () => {
    modal.style.display = 'none';
    try {
      const { error: errD } = await supabaseClient.from('attendance_detail').delete().eq('attendance_id', id);
      if (errD) throw errD;

      const { error: errH } = await supabaseClient.from('attendance_header').delete().eq('id', id);
      if (errH) throw errH;

      await asyncAlert("Data presensi berhasil dihapus.", "Berhasil");
      document.getElementById('loadSessionBtn').click();
    } catch (e) {
      await asyncAlert("Gagal menghapus data: " + e.message, "Error");
    }
  };
  document.getElementById("confirmBtnNo").onclick = () => { modal.style.display = 'none'; };
};

const autoSession = () => { if (sessionLoaded) document.getElementById('loadSessionBtn').click(); };
document.getElementById('sessionMonthSel').addEventListener('change', autoSession);
document.getElementById('sessionActivitySel').addEventListener('change', autoSession);
document.getElementById('sessionStartD').addEventListener('change', autoSession);
document.getElementById('sessionEndD').addEventListener('change', autoSession);

// --- 2. LOGIC REKAP BULANAN ---
document.getElementById('loadMonthlyBtn').onclick = async () => {
  const out = document.getElementById('monthlyOutput');
  out.innerHTML = "<p class='muted'>Memuat...</p>";
  const { start, end } = getDateRange(monthSel.value, 'monthlyStartD', 'monthlyEndD');
  const actFilter = document.getElementById('monthlyActivitySel').value;

  try {
    let { data: headers, error } = await supabaseClient.from('attendance_header')
      .select('id, activity_name_snapshot, date')
      .gte('date', start)
      .lte('date', end);

    if (error) throw error;

    if (actFilter) {
      if (actFilter === '[CAT]Latihan') {
        headers = headers.filter(h => isMatchCategory(h.activity_name_snapshot, latihanNames));
      } else if (actFilter === '[CAT]Pertandingan') {
        headers = headers.filter(h => isMatchCategory(h.activity_name_snapshot, pertandinganNames));
      } else if (actFilter === '[CAT]Lainnya') {
        headers = headers.filter(h => !isMatchCategory(h.activity_name_snapshot, latihanNames) && !isMatchCategory(h.activity_name_snapshot, pertandinganNames));
      } else {
        headers = headers.filter(h => isMatchSingle(h.activity_name_snapshot, actFilter));
      }
    }

    if (!headers.length) return out.innerHTML = "<p class='muted'>Tidak ada data.</p>";

    const countLatihan = headers.filter(h => isMatchCategory(h.activity_name_snapshot, latihanNames)).length;
    const countPertandingan = headers.filter(h => isMatchCategory(h.activity_name_snapshot, pertandinganNames)).length;
    const countLain = headers.length - countLatihan - countPertandingan;

    const headerIds = headers.map(h => h.id);
    const { data: details } = await supabaseClient.from('attendance_detail')
      .select('*').in('attendance_id', headerIds);

    const recap = {};
    details.forEach(d => {
      if (!recap[d.member_id]) recap[d.member_id] = { name: d.member_name_snapshot, role: d.member_role_snapshot, H: 0, I: 0, S: 0, A: 0, Total: 0 };
      const r = recap[d.member_id];
      if (d.presence === 'Hadir') r.H++;
      else if (d.presence === 'Izin') r.I++;
      else if (d.presence === 'Sakit') r.S++;
      else r.A++;
      r.Total++;
    });

    lastMonthlyData = Object.values(recap).sort((a, b) => a.name.localeCompare(b.name));

    let recapHtml = '';
    if (actFilter === '[CAT]Pertandingan') {
      recapHtml = `
         <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
           <div class="text-sm text-warning font-bold">Pertandingan Berjalan: <span class="text-base font-extrabold">${countPertandingan}</span> sesi</div>
         </div>
       `;
    } else if (actFilter === '[CAT]Lainnya') {
      recapHtml = `
         <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
           <div class="text-sm text-main font-bold">Lainnya Berjalan: <span class="text-base font-extrabold">${countLain}</span> sesi</div>
         </div>
       `;
    } else if (actFilter === '[CAT]Latihan') {
      recapHtml = `
         <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
           <div class="text-sm text-success font-bold">Latihan Berjalan: <span class="text-base font-extrabold">${countLatihan}</span> sesi</div>
         </div>
       `;
    } else {
      recapHtml = `
         <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
           <div class="text-sm text-main font-bold">Latihan: <span class="text-base font-extrabold">${countLatihan}</span> | Pertandingan: <span class="text-base font-extrabold">${countPertandingan}</span> | Lainnya: <span class="text-base font-extrabold">${countLain}</span> sesi</div>
         </div>
       `;
    }

    out.innerHTML = recapHtml;
    renderTable(lastMonthlyData, out);
  } catch (e) { out.innerHTML = "Error: " + e.message; }
};

const autoMonthly = () => { if (monthlyLoaded) document.getElementById('loadMonthlyBtn').click(); };
document.getElementById('monthSel').addEventListener('change', autoMonthly);
document.getElementById('monthlyActivitySel').addEventListener('change', autoMonthly);
document.getElementById('monthlyStartD').addEventListener('change', autoMonthly);
document.getElementById('monthlyEndD').addEventListener('change', autoMonthly);

function renderTable(data, el) {
  el.innerHTML += `
    <div class="table-scroll overflow-x-auto"><table class="data-table w-full text-xs collapse border-spacing-0">
      <thead><tr class="bg-gray-100 text-left">
        <th class="p-2">Nama</th><th class="p-2 text-center">H</th><th class="p-2 text-center">I</th><th class="p-2 text-center">S</th><th class="p-2 text-center">A</th><th class="p-2 text-center">%</th>
      </tr></thead>
      <tbody>${data.map(r => `
        <tr class="border-b border-gray-200">
          <td class="p-2"><b>${escapeHtml(r.name)}</b><br><small class="text-muted">${escapeHtml(r.role)}</small></td>
          <td class="p-2 text-center">${r.H}</td><td class="p-2 text-center">${r.I}</td><td class="p-2 text-center">${r.S}</td><td class="p-2 text-center">${r.A}</td>
          <td class="p-2 text-center font-bold">${Math.round((r.H / r.Total) * 100)}%</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

let memberChartInstance = null;

// --- 3. LOGIC REKAP ANGGOTA ---
document.getElementById('loadMemberBtn').onclick = async () => {
  memberLoaded = true;
  const out = document.getElementById('memberOutput');
  const { start, end } = getDateRange(memberMonthSel.value, 'memberStartD', 'memberEndD');
  const memId = document.getElementById('memberSel').value;
  const actFilter = document.getElementById('memberActivitySel').value;
  const tMonth = memberMonthSel.value;

  if (!memId) {
    return await asyncAlert("Pilih anggota terlebih dahulu.");
  }

  out.innerHTML = "<p class='muted'>Memuat...</p>";

  try {
    const { data: fetchRaw } = await supabaseClient.from('attendance_detail')
      .select('presence, attendance_header(date, activity_name_snapshot, pdf_file_id)')
      .eq('member_id', memId)
      .gte('attendance_header.date', start)
      .lte('attendance_header.date', end)
      .order('attendance_header(date)', { ascending: false });

    let history = fetchRaw.filter(h => h.attendance_header);
    if (actFilter) {
      if (actFilter === '[CAT]Latihan') {
        history = history.filter(h => isMatchCategory(h.attendance_header.activity_name_snapshot, latihanNames));
      } else if (actFilter === '[CAT]Pertandingan') {
        history = history.filter(h => isMatchCategory(h.attendance_header.activity_name_snapshot, pertandinganNames));
      } else if (actFilter === '[CAT]Lainnya') {
        history = history.filter(h => !isMatchCategory(h.attendance_header.activity_name_snapshot, latihanNames) && !isMatchCategory(h.attendance_header.activity_name_snapshot, pertandinganNames));
      } else {
        history = history.filter(h => isMatchSingle(h.attendance_header.activity_name_snapshot, actFilter));
      }
    }

    if (!history.length) return out.innerHTML = "<p class='muted'>Belum ada riwayat kehadiran.</p>";

    let H = 0, I = 0, S = 0, A = 0;
    let countLatihan = 0;
    let countPertandingan = 0;
    history.forEach(h => {
      if (h.presence === 'Hadir') H++;
      else if (h.presence === 'Izin') I++;
      else if (h.presence === 'Sakit') S++;
      else A++;

      if (isMatchCategory(h.attendance_header.activity_name_snapshot, latihanNames)) {
        countLatihan++;
      } else if (isMatchCategory(h.attendance_header.activity_name_snapshot, pertandinganNames)) {
        countPertandingan++;
      }
    });
    const total = H + I + S + A;
    const perc = Math.round((H / total) * 100) || 0;
    const countLain = history.length - countLatihan - countPertandingan;

    let recapHtml = '';
    if (actFilter === '[CAT]Pertandingan') {
      recapHtml = `Terlibat Dalam Pertandingan: <span class="text-base font-extrabold">${countPertandingan}</span> sesi`;
    } else if (actFilter === '[CAT]Latihan') {
      recapHtml = `Terlibat Dalam Latihan: <span class="text-base font-extrabold">${countLatihan}</span> sesi`;
    } else if (actFilter === '[CAT]Lainnya') {
      recapHtml = `Terlibat Dalam Lainnya: <span class="text-base font-extrabold">${countLain}</span> sesi`;
    } else {
      recapHtml = `Sesi Latihan: <span class="text-base font-extrabold">${countLatihan}</span> | Pertandingan: <span class="text-base font-extrabold">${countPertandingan}</span> | Lainnya: <span class="text-base font-extrabold">${countLain}</span>`;
    }

    let html = `
      <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
        <div class="text-sm text-main font-bold">${recapHtml}</div>
        <div class="text-xs text-muted mt-1">Tingkat Kehadiran Keseluruhan: <span class="bg-gray-200 py-0.5 px-2 rounded font-bold">${perc}%</span></div>
      </div>
      
      <div class="info-grid">
        <div class="info-box hadir"><div class="info-val">${H}</div><div class="info-label">Hadir</div></div>
        <div class="info-box izin"><div class="info-val">${I}</div><div class="info-label">Izin</div></div>
        <div class="info-box sakit"><div class="info-val">${S}</div><div class="info-label">Sakit</div></div>
        <div class="info-box alpa"><div class="info-val">${A}</div><div class="info-label">Alpa</div></div>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl p-2.5 mb-4 shadow-sm">
        <canvas id="memberChartCanvas" height="180"></canvas>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        ${history.map((h, i) => `
          <div class="flex justify-between items-center py-4 px-4 ${i === history.length - 1 ? '' : 'border-b border-gray-200'}">
            <div class="flex-1 pr-3">
              <div class="font-bold text-base text-main">${escapeHtml(h.attendance_header.activity_name_snapshot)}</div>
              <div class="text-xs text-muted mt-1.5 flex items-center gap-1.5">
                <span>📅 ${h.attendance_header.date}</span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold py-1.5 px-3 rounded-lg ${h.presence === 'Hadir' ? 'text-success bg-green-50 border border-green-100' :
        h.presence === 'Izin' ? 'text-warning bg-yellow-50 border border-yellow-100' :
          h.presence === 'Sakit' ? 'text-orange-600 bg-orange-50 border border-orange-100' :
            'text-danger bg-red-50 border border-red-100'
      }">${h.presence}</span>
              ${h.attendance_header.pdf_file_id ? `<a href="https://drive.google.com/file/d/${h.attendance_header.pdf_file_id}/view" target="_blank" title="Lihat PDF" class="text-primary hover:text-primary-dark transition-colors"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></a>` : ''}
            </div>
          </div>`).join('')}
      </div>`;

    out.innerHTML = html;

    setTimeout(() => {
      renderMemberChart(history, tMonth);
    }, 50);

  } catch (e) { out.innerHTML = "Error: " + e.message; }
};

const autoMember = () => {
  if (memberLoaded && document.getElementById('memberSel').value) {
    document.getElementById('loadMemberBtn').click();
  }
};
document.getElementById('memberMonthSel').addEventListener('change', autoMember);
document.getElementById('memberActivitySel').addEventListener('change', autoMember);
document.getElementById('memberStartD').addEventListener('change', autoMember);
document.getElementById('memberEndD').addEventListener('change', autoMember);

function renderMemberChart(history, tMonth) {
  if (memberChartInstance) memberChartInstance.destroy();
  const ctx = document.getElementById('memberChartCanvas').getContext('2d');
  let groupBy = 'month';
  if (tMonth.match(/^\d{4}-\d{2}$/) || history.length <= 10) groupBy = 'week';

  const groups = {};
  const sortedHistory = [...history].sort((a, b) => a.attendance_header.date.localeCompare(b.attendance_header.date));

  sortedHistory.forEach(h => {
    const dateStr = h.attendance_header.date;
    let key;
    if (groupBy === 'week') {
      const d = parseInt(dateStr.split('-')[2], 10);
      const w = Math.ceil(d / 7);
      key = `Mg-${w}`;
    } else {
      const [y, m] = dateStr.split('-');
      const dObj = new Date(y, parseInt(m) - 1, 1);
      key = dObj.toLocaleString('id-ID', { month: 'short' });
    }
    if (!groups[key]) groups[key] = { H: 0, Total: 0 };
    groups[key].Total++;
    if (h.presence === 'Hadir') groups[key].H++;
  });

  const labels = Object.keys(groups);
  const dataHadir = labels.map(k => groups[k].H);
  const dataTotal = labels.map(k => groups[k].Total);

  memberChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Hadir',
          data: dataHadir,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Total Sesi',
          data: dataTotal,
          borderColor: '#dc2626',
          borderWidth: 1,
          borderDash: [4, 4],
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: 5, ticks: { stepSize: 1 } }
      }
    }
  });
}

document.getElementById('refreshBtn').onclick = () => {
  init();
  if (document.getElementById('panelSession').style.display !== 'none') document.getElementById('loadSessionBtn').click();
  else if (document.getElementById('panelMonthly').style.display !== 'none') document.getElementById('loadMonthlyBtn').click();
  else if (document.getElementById('panelMember').style.display !== 'none' && document.getElementById('memberSel').value) document.getElementById('loadMemberBtn').click();
};
