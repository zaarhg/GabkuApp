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
  if (val === 'current') {
    const d = new Date();
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    return { start, end: '2099-12-31' };
  }
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
  if (val === 'all') {
    return { start: '2000-01-01', end: '2099-12-31' };
  }
  if (val === 'custom') {
    const s = document.getElementById(startId)?.value;
    const e = document.getElementById(endId)?.value;
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

let _periodOptions = [
  { val: 'current', label: 'Bulan Ini' },
  { val: 'last3', label: '3 Bulan Terakhir' },
  { val: 'last6', label: '6 Bulan Terakhir' },
  { val: 'last12', label: '1 Tahun Terakhir' },
  { val: 'all', label: 'Semua Periode' },
  { val: 'custom', label: 'Custom (Tanggal)' }
];

let _activityOptions = [
  { val: '', label: 'Semua Kegiatan (Gabung)' },
  { val: '[CAT]Latihan', label: 'Kategori: Latihan' },
  { val: '[CAT]Pertandingan', label: 'Kategori: Pertandingan' },
  { val: '[CAT]Lainnya', label: 'Kategori: Lainnya' }
];

async function init() {
  const { data: mems } = await supabaseClient.from('members').select('id, name, role').order('name');
  if (mems) membersCache = mems;

  _periodOptions = [
    { val: 'current', label: 'Bulan Ini' },
    { val: 'last3', label: '3 Bulan Terakhir' },
    { val: 'last6', label: '6 Bulan Terakhir' },
    { val: 'last12', label: '1 Tahun Terakhir' },
    { val: 'all', label: 'Semua Periode' },
    { val: 'custom', label: 'Custom (Tanggal)' }
  ];

  const { data: acts } = await supabaseClient.from('activities').select('name, category').eq('is_active', true).order('name');
  if (acts) {
    latihanNames = acts.filter(a => a.category === 'Latihan').map(a => a.name);
    pertandinganNames = acts.filter(a => a.category === 'Pertandingan').map(a => a.name);
    const uniqueActs = [...new Set(acts.map(a => a.name))];
    _activityOptions = [
      { val: '', label: 'Semua Kegiatan (Gabung)' },
      { val: '[CAT]Latihan', label: 'Kategori: Latihan' },
      { val: '[CAT]Pertandingan', label: 'Kategori: Pertandingan' },
      { val: '[CAT]Lainnya', label: 'Kategori: Lainnya' }
    ];
    uniqueActs.forEach(a => {
      _activityOptions.push({ val: a, label: a });
    });
  }
}

/* ── Period Picker Modal Logic ── */
let _currentPeriodTarget = 'session';
let _tempSelectedPeriod = 'last3';

function openRekapPeriodPicker(target) {
  _currentPeriodTarget = target;
  const inputId = target === 'session' ? 'sessionMonthSel' : target === 'monthly' ? 'monthSel' : 'memberMonthSel';
  const curVal = document.getElementById(inputId)?.value || 'last3';
  _tempSelectedPeriod = curVal;

  renderRekapPeriodList();

  const customWrap = document.getElementById('rekapCustomDateWrap');
  if (customWrap) customWrap.style.display = (curVal === 'custom') ? 'flex' : 'none';

  const startId = target === 'session' ? 'sessionStartD' : target === 'monthly' ? 'monthlyStartD' : 'memberStartD';
  const endId = target === 'session' ? 'sessionEndD' : target === 'monthly' ? 'monthlyEndD' : 'memberEndD';
  const curS = document.getElementById(startId)?.value || '';
  const curE = document.getElementById(endId)?.value || '';
  if (document.getElementById('rekapCustomStartD')) document.getElementById('rekapCustomStartD').value = curS;
  if (document.getElementById('rekapCustomEndD')) document.getElementById('rekapCustomEndD').value = curE;

  const modal = document.getElementById('rekapPeriodModal');
  if (modal) modal.style.display = 'flex';
}
window.openRekapPeriodPicker = openRekapPeriodPicker;

function closeRekapPeriodPicker() {
  const modal = document.getElementById('rekapPeriodModal');
  if (modal) modal.style.display = 'none';
}
window.closeRekapPeriodPicker = closeRekapPeriodPicker;

function selectRekapPeriodOption(val) {
  _tempSelectedPeriod = val;
  renderRekapPeriodList();
  const customWrap = document.getElementById('rekapCustomDateWrap');
  if (customWrap) customWrap.style.display = (val === 'custom') ? 'flex' : 'none';
}
window.selectRekapPeriodOption = selectRekapPeriodOption;

function renderRekapPeriodList() {
  const listEl = document.getElementById('rekapPeriodList');
  if (!listEl) return;

  listEl.innerHTML = _periodOptions.map(opt => {
    const isSel = opt.val === _tempSelectedPeriod;
    return `
      <div class="picker-item${isSel ? ' selected' : ''}" onclick="selectRekapPeriodOption('${opt.val}')" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; background:${isSel ? '#eff6ff' : '#f8fafc'}; border:1.5px solid ${isSel ? '#3b82f6' : 'transparent'};">
        <div class="picker-check" style="width:18px; height:18px; border-radius:50%; border:2px solid ${isSel ? '#3b82f6' : '#cbd5e1'}; background:${isSel ? '#3b82f6' : '#fff'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800;">${isSel ? '✓' : ''}</div>
        <div style="font-size:13px; font-weight:${isSel ? '700' : '500'}; color:#1e293b;">${escapeHtml(opt.label)}</div>
      </div>`;
  }).join('');
}

function confirmRekapPeriodPicker() {
  const target = _currentPeriodTarget;
  const inputId = target === 'session' ? 'sessionMonthSel' : target === 'monthly' ? 'monthSel' : 'memberMonthSel';
  const textId = target === 'session' ? 'sessionPeriodText' : target === 'monthly' ? 'monthlyPeriodText' : 'memberPeriodText';
  const startId = target === 'session' ? 'sessionStartD' : target === 'monthly' ? 'monthlyStartD' : 'memberStartD';
  const endId = target === 'session' ? 'sessionEndD' : target === 'monthly' ? 'monthlyEndD' : 'memberEndD';

  const hiddenInput = document.getElementById(inputId);
  if (hiddenInput) hiddenInput.value = _tempSelectedPeriod;

  const opt = _periodOptions.find(o => o.val === _tempSelectedPeriod);
  let labelText = opt ? opt.label : 'Pilih Periode';

  if (_tempSelectedPeriod === 'custom') {
    const s = document.getElementById('rekapCustomStartD')?.value || '';
    const e = document.getElementById('rekapCustomEndD')?.value || '';
    if (document.getElementById(startId)) document.getElementById(startId).value = s;
    if (document.getElementById(endId)) document.getElementById(endId).value = e;
    labelText = (s && e) ? `Kustom (${s} - ${e})` : 'Kustom (Tanggal)';
  }

  const textEl = document.getElementById(textId);
  if (textEl) textEl.textContent = labelText;

  closeRekapPeriodPicker();
}
window.confirmRekapPeriodPicker = confirmRekapPeriodPicker;

/* ── Activity Picker Modal Logic ── */
let _currentActivityTarget = 'session';

function openRekapActivityPicker(target) {
  _currentActivityTarget = target;
  const inputId = target === 'session' ? 'sessionActivitySel' : target === 'monthly' ? 'monthlyActivitySel' : 'memberActivitySel';
  const curVal = document.getElementById(inputId)?.value || '';

  document.getElementById('rekapActPickerSearch').value = '';
  filterRekapActivityPicker('', curVal);

  const modal = document.getElementById('rekapActivityModal');
  if (modal) modal.style.display = 'flex';
}
window.openRekapActivityPicker = openRekapActivityPicker;

function closeRekapActivityPicker() {
  const modal = document.getElementById('rekapActivityModal');
  if (modal) modal.style.display = 'none';
}
window.closeRekapActivityPicker = closeRekapActivityPicker;

function filterRekapActivityPicker(q, activeVal) {
  const target = _currentActivityTarget;
  const inputId = target === 'session' ? 'sessionActivitySel' : target === 'monthly' ? 'monthlyActivitySel' : 'memberActivitySel';
  const curVal = activeVal !== undefined ? activeVal : (document.getElementById(inputId)?.value || '');

  const filtered = q.trim()
    ? _activityOptions.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    : _activityOptions;

  const listEl = document.getElementById('rekapActivityList');
  if (!listEl) return;

  if (!filtered.length) {
    listEl.innerHTML = "<p class='muted text-center py-4' style='font-size:13px;'>Tidak ada kegiatan ditemukan.</p>";
    return;
  }

  listEl.innerHTML = filtered.map(opt => {
    const isSel = opt.val === curVal;
    return `
      <div class="picker-item${isSel ? ' selected' : ''}" onclick="selectRekapActivityOption('${escapeHtml(opt.val)}','${escapeHtml(opt.label)}')" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; background:${isSel ? '#eff6ff' : '#f8fafc'}; border:1.5px solid ${isSel ? '#3b82f6' : 'transparent'};">
        <div class="picker-check" style="width:18px; height:18px; border-radius:50%; border:2px solid ${isSel ? '#3b82f6' : '#cbd5e1'}; background:${isSel ? '#3b82f6' : '#fff'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800;">${isSel ? '✓' : ''}</div>
        <div style="font-size:13px; font-weight:${isSel ? '700' : '500'}; color:#1e293b;">${escapeHtml(opt.label)}</div>
      </div>`;
  }).join('');
}
window.filterRekapActivityPicker = filterRekapActivityPicker;

function selectRekapActivityOption(val, label) {
  const target = _currentActivityTarget;
  const inputId = target === 'session' ? 'sessionActivitySel' : target === 'monthly' ? 'monthlyActivitySel' : 'memberActivitySel';
  const textId = target === 'session' ? 'sessionActivityText' : target === 'monthly' ? 'monthlyActivityText' : 'memberActivityText';

  const hiddenInput = document.getElementById(inputId);
  if (hiddenInput) hiddenInput.value = val;

  const textEl = document.getElementById(textId);
  if (textEl) textEl.textContent = label;

  closeRekapActivityPicker();
}
window.selectRekapActivityOption = selectRekapActivityOption;

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

    let sessionsCacheMap = {};
    data.forEach(h => {
      sessionsCacheMap[h.id] = { ...h, stats: statsMap[h.id] || { H: 0, I: 0, S: 0, A: 0 } };
    });
    window.sessionsCacheMap = sessionsCacheMap;

    out.innerHTML = recapHtml + `<div class="session-card-container">` + data.map((h) => {
      const stats = statsMap[h.id] || { H: 0, I: 0, S: 0, A: 0 };
      return `
      <div class="session-card-item clickable" onclick="openSessionPdfModal('${h.id}')">
        <div class="session-card-header">
          <div class="session-card-title">${escapeHtml(h.activity_name_snapshot)}</div>
          <div class="session-card-arrow">›</div>
        </div>

        <div class="session-card-details">
          <span class="session-detail-pill date">📅 ${h.date}</span>
          <span class="session-detail-pill stats-capsule">📊 H:${stats.H} | I:${stats.I} | S:${stats.S} | A:${stats.A}</span>
          ${h.location_snapshot ? `<span class="session-detail-pill location">📍 ${escapeHtml(h.location_snapshot)}</span>` : ''}
        </div>
      </div>
    `;
    }).join('') + `</div>`;
  } catch (e) { out.innerHTML = `<p class='msg'>Error: ${e.message}</p>`; }
};

window.openSessionPdfModal = (id) => {
  const h = window.sessionsCacheMap ? window.sessionsCacheMap[id] : null;
  if (!h) return;

  const modal = document.getElementById('pdfPreviewModal');
  const title = document.getElementById('pdfModalTitle');
  const sub = document.getElementById('pdfModalSub');
  const body = document.getElementById('pdfModalBody');
  const actions = document.getElementById('pdfModalActions');

  if (title) title.textContent = h.activity_name_snapshot || 'Detail Presensi';
  if (sub) sub.innerHTML = `📅 ${h.date}`;

  const statsStr = `Hadir: ${h.stats?.H || 0}, Izin: ${h.stats?.I || 0}, Sakit: ${h.stats?.S || 0}, Alpa: ${h.stats?.A || 0}`;

  if (body) {
    if (h.pdf_file_id) {
      body.innerHTML = `<iframe class="pdf-modal-iframe" src="https://drive.google.com/file/d/${h.pdf_file_id}/preview" allow="autoplay"></iframe>`;
    } else {
      body.innerHTML = `
        <div class="pdf-modal-empty">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          <div class="font-extrabold text-base text-main">Dokumen PDF Belum Tersedia</div>
          <div class="text-xs text-muted mt-1">Sesi ini disimpan tanpa file PDF.</div>
          <div class="mt-3 text-xs font-bold text-main bg-white py-1.5 px-3 rounded-lg border border-gray-200">${statsStr}</div>
        </div>
      `;
    }
  }

  if (actions) {
    actions.innerHTML = `
      ${h.pdf_file_id ? `
        <a href="https://drive.google.com/file/d/${h.pdf_file_id}/view" target="_blank" class="pdf-btn pdf-btn-main" style="flex:1;">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> Buka PDF
        </a>
        <button onclick="sharePDF('${escapeHtml(h.activity_name_snapshot)}', '${h.date}', '${h.pdf_file_id}', '${statsStr}')" class="pdf-btn pdf-btn-secondary pdf-btn-icon" title="Bagikan Sesi">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92 0-1.61-1.31-2.92-2.92-2.92z"/></svg>
        </button>
      ` : `
        <div class="pdf-btn pdf-btn-disabled" style="flex:1;">Tanpa PDF</div>
      `}
      <a href="presensi.html?edit=${h.id}" class="admin-only pdf-btn pdf-btn-secondary pdf-btn-icon" title="Edit Presensi">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </a>
      <button onclick="closePdfPreviewModal(); deleteSession('${h.id}', '${escapeHtml(h.activity_name_snapshot)}', '${h.date}')" class="admin-only pdf-btn pdf-btn-danger pdf-btn-icon" title="Hapus Presensi">
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;
  }

  if (modal) {
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }
};

window.closePdfPreviewModal = () => {
  const modal = document.getElementById('pdfPreviewModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    const body = document.getElementById('pdfModalBody');
    if (body) body.innerHTML = '';
  }
};

// Prevent pinch-zoom bleed on modal backdrop
document.addEventListener('DOMContentLoaded', () => {
  const pdfModalEl = document.getElementById('pdfPreviewModal');
  if (pdfModalEl) {
    pdfModalEl.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 1 && !e.target.closest('#pdfModalBody')) {
        e.preventDefault();
      }
    }, { passive: false });
  }
});

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
  const yesBtn = document.getElementById("confirmBtnYes");
  const noBtn = document.getElementById("confirmBtnNo");
  if (yesBtn) { yesBtn.className = 'btn-danger'; yesBtn.textContent = 'Ya, Hapus'; }
  if (noBtn) { noBtn.className = 'btn-primary'; noBtn.textContent = 'Batal'; noBtn.style.display = 'block'; }
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
      if (!recap[d.member_id]) recap[d.member_id] = { id: d.member_id, name: d.member_name_snapshot, role: d.member_role_snapshot, H: 0, I: 0, S: 0, A: 0, Total: 0 };
      const r = recap[d.member_id];
      if (d.presence === 'Hadir') r.H++;
      else if (d.presence === 'Izin') r.I++;
      else if (d.presence === 'Sakit') r.S++;
      else r.A++;
      r.Total++;
    });

    window.lastMonthlyData = Object.values(recap).sort((a, b) => a.name.localeCompare(b.name));
    currentSortCol = 'name';
    currentSortDir = 'asc';

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

    window.lastMonthlySummaryHtml = recapHtml;
    out.innerHTML = recapHtml;
    renderTable(window.lastMonthlyData, out);
  } catch (e) { out.innerHTML = "Error: " + e.message; }
};

const autoMonthly = () => { if (monthlyLoaded) document.getElementById('loadMonthlyBtn').click(); };
document.getElementById('monthSel').addEventListener('change', autoMonthly);
document.getElementById('monthlyActivitySel').addEventListener('change', autoMonthly);
document.getElementById('monthlyStartD').addEventListener('change', autoMonthly);
document.getElementById('monthlyEndD').addEventListener('change', autoMonthly);

let currentSortCol = 'name';
let currentSortDir = 'asc';

window.switchToMemberTab = (memberId, memberName) => {
  if (!memberId) return;

  const tabMember = document.getElementById('tabMember');
  if (tabMember) tabMember.click();

  const monthSel = document.getElementById('monthSel');
  const monthlyActivitySel = document.getElementById('monthlyActivitySel');
  const monthlyStartD = document.getElementById('monthlyStartD');
  const monthlyEndD = document.getElementById('monthlyEndD');

  const memberMonthSel = document.getElementById('memberMonthSel');
  const memberActivitySel = document.getElementById('memberActivitySel');
  const memberStartD = document.getElementById('memberStartD');
  const memberEndD = document.getElementById('memberEndD');

  if (memberMonthSel && monthSel) memberMonthSel.value = monthSel.value;
  if (memberActivitySel && monthlyActivitySel) memberActivitySel.value = monthlyActivitySel.value;
  if (memberStartD && monthlyStartD) memberStartD.value = monthlyStartD.value;
  if (memberEndD && monthlyEndD) memberEndD.value = monthlyEndD.value;

  if (memberMonthSel && memberMonthSel.value === 'custom') {
    document.getElementById('memberCustomDates')?.classList.remove('hidden');
  } else {
    document.getElementById('memberCustomDates')?.classList.add('hidden');
  }

  const memberSel = document.getElementById('memberSel');
  if (memberSel) {
    memberSel.value = memberId;
  }

  const memberSelText = document.getElementById('memberSelText');
  if (memberSelText && memberName) {
    memberSelText.textContent = memberName;
    memberSelText.style.color = '#111827';
  }

  const loadMemberBtn = document.getElementById('loadMemberBtn');
  if (loadMemberBtn) {
    loadMemberBtn.click();
  }
};

window.sortMonthlyTable = (col) => {
  const dataList = window.lastMonthlyData;
  if (!dataList || !dataList.length) return;

  if (currentSortCol === col) {
    currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortCol = col;
    currentSortDir = (col === 'name' ? 'asc' : 'desc');
  }

  const sortedData = [...dataList].sort((a, b) => {
    let valA, valB;
    if (col === 'name') {
      valA = (a.name || '').toLowerCase();
      valB = (b.name || '').toLowerCase();
      return currentSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (col === 'pct') {
      valA = a.Total > 0 ? (a.H / a.Total) : 0;
      valB = b.Total > 0 ? (b.H / b.Total) : 0;
    } else {
      valA = a[col] || 0;
      valB = b[col] || 0;
    }
    return currentSortDir === 'asc' ? valA - valB : valB - valA;
  });

  const out = document.getElementById('monthlyOutput');
  out.innerHTML = window.lastMonthlySummaryHtml || '';
  renderTable(sortedData, out);
};

function renderTable(data, el) {
  const getSortIcon = (col) => {
    if (currentSortCol !== col) return '<span style="opacity:0.3; font-size:10px; margin-left:2px; display:inline-block;">↕</span>';
    return currentSortDir === 'asc'
      ? '<span style="color:#0284c7; font-weight:800; font-size:11px; margin-left:2px; display:inline-block;">▲</span>'
      : '<span style="color:#0284c7; font-weight:800; font-size:11px; margin-left:2px; display:inline-block;">▼</span>';
  };

  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-scroll overflow-x-auto mt-2';
  tableContainer.innerHTML = `
    <table class="data-table w-full text-xs collapse border-spacing-0">
      <thead>
        <tr class="bg-gray-100 text-left" style="user-select:none;">
          <th class="p-2 cursor-pointer hover:bg-gray-200" onclick="sortMonthlyTable('name')" title="Urutkan nama" style="white-space:nowrap; border-bottom: 2px solid #cbd5e1;">Nama ${getSortIcon('name')}</th>
          <th class="p-2 text-center cursor-pointer hover:bg-gray-200" onclick="sortMonthlyTable('H')" title="Urutkan Hadir" style="white-space:nowrap; border-bottom: 2px solid #cbd5e1;">H ${getSortIcon('H')}</th>
          <th class="p-2 text-center cursor-pointer hover:bg-gray-200" onclick="sortMonthlyTable('I')" title="Urutkan Izin" style="white-space:nowrap; border-bottom: 2px solid #cbd5e1;">I ${getSortIcon('I')}</th>
          <th class="p-2 text-center cursor-pointer hover:bg-gray-200" onclick="sortMonthlyTable('S')" title="Urutkan Sakit" style="white-space:nowrap; border-bottom: 2px solid #cbd5e1;">S ${getSortIcon('S')}</th>
          <th class="p-2 text-center cursor-pointer hover:bg-gray-200" onclick="sortMonthlyTable('A')" title="Urutkan Alpa" style="white-space:nowrap; border-bottom: 2px solid #cbd5e1;">A ${getSortIcon('A')}</th>
          <th class="p-2 text-center cursor-pointer hover:bg-gray-200" onclick="sortMonthlyTable('pct')" title="Urutkan Persentase" style="white-space:nowrap; border-bottom: 2px solid #cbd5e1;">% ${getSortIcon('pct')}</th>
        </tr>
      </thead>
      <tbody>${data.map(r => `
        <tr onclick="switchToMemberTab('${r.id}', '${escapeHtml(r.name).replace(/'/g, "\\'")}')" class="border-b border-gray-200 hover:bg-sky-50 cursor-pointer transition-colors" title="Klik untuk lihat detail rekap ${escapeHtml(r.name)}">
          <td class="p-2"><b>${escapeHtml(r.name)}</b><br><small class="text-muted">${escapeHtml(r.role)}</small></td>
          <td class="p-2 text-center font-semibold">${r.H}</td>
          <td class="p-2 text-center font-semibold">${r.I}</td>
          <td class="p-2 text-center font-semibold">${r.S}</td>
          <td class="p-2 text-center font-semibold">${r.A}</td>
          <td class="p-2 text-center font-bold text-main">${Math.round((r.H / (r.Total || 1)) * 100)}%</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  el.appendChild(tableContainer);
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
      .select('presence, attendance_header(id, date, activity_name_snapshot, pdf_file_id, location_snapshot)')
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

    window.sessionsCacheMap = window.sessionsCacheMap || {};
    history.forEach(item => {
      const head = item.attendance_header;
      if (head && head.id) {
        if (!window.sessionsCacheMap[head.id]) {
          window.sessionsCacheMap[head.id] = {
            id: head.id,
            activity_name_snapshot: head.activity_name_snapshot,
            date: head.date,
            location_snapshot: head.location_snapshot,
            pdf_file_id: head.pdf_file_id,
            stats: null
          };
        }
      }
    });

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

      <div class="flex flex-col gap-2.5 mt-4">
        ${history.map(item => {
          const head = item.attendance_header;
          const badgeClass = item.presence === 'Hadir' ? 'presence-badge-hadir' :
                             item.presence === 'Izin' ? 'presence-badge-izin' :
                             item.presence === 'Sakit' ? 'presence-badge-sakit' : 'presence-badge-alpa';
          return `
            <div onclick="openSessionPdfModal('${head.id}')" class="member-activity-card">
              <div class="member-activity-info">
                <div class="member-activity-title">${escapeHtml(head.activity_name_snapshot)}</div>
                <div class="member-activity-date">📅 ${head.date}</div>
              </div>
              <div class="member-activity-right">
                <span class="presence-badge ${badgeClass}">${item.presence}</span>
                <span class="member-activity-arrow">›</span>
              </div>
            </div>
          `;
        }).join('')}
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
