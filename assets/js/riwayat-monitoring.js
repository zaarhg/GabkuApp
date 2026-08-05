/**
 * Gabku App - Riwayat Monitoring Module
 * Encapsulated JS logic for riwayat-monitoring.html
 */

/* ── Konstanta ── */
const NB = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const PILAR_LABEL = {
  b1: "Bidding", b2: "Play (Declarer)", b3: "Defense", b4: "Mental & Kemitraan",
  hadir: "Persentase Kehadiran (%)", vo2max: "Skor VO₂max"
};
const PILAR_ITEMS = {
  b1: ["Akurasi Penentuan Kontrak", "Pemahaman Sistem & Konvensi", "Konsistensi Interpretasi Bid", "Kepatuhan Sistem & Kesepakatan", "Penanganan Bid Kompetitif & Preemp"],
  b2: ["Perencanaan Play Awal", "Teknik Declarer", "Analisis Peluang & Distribusi", "Timing & Entry Management", "Konsistensi Rencana Main (Line of Play)"],
  b3: ["Ketepatan Opening Lead", "Kejelasan Signaling", "Akurasi Switching & Discard", "Membaca Permainan Partner", "Defense Planning (2 trik awal)"],
  b4: ["Konsistensi Fokus & Stamina", "Respon Papan Buruk", "Komunikasi & Harmonisasi Partner", "Manajemen Waktu (Tempo Permainan)", "Diskusi Pasca Latihan & Error Awareness"]
};
const CHART_COLORS = ["#1590df", "#16a34a", "#ca8a04", "#dc2626", "#8b5cf6", "#0891b2", "#db2777"];

/* ── State ── */
let _allMembers = [];   // [{id, name, role}]
let _allActivities = [];   // [{id, name, start_date, end_date, default_participants}]
let _pickerPool = [];   // subset of _allMembers shown in picker (filtered by event)
let _pickerTemp = new Set(); // IDs selected in picker (before confirm)
let _selectedAtlets = [];  // [{id, name}] confirmed selection
let _chartInst = null;
let _pilarChartInst = null;
let _activePilarKey = null;
let _fisikChartInst = null;
let _activeFisikKey = null;
let _lastData = [];       // cache hasil query untuk pilar chart
let _pointMultiplier = 10000; // default point per kehadiran
let _monWeightAbsensi = 30;   // % bobot kehadiran
let _selectedEvents = [];    // state kegiatan terpilih
let _eventPickerTemp = new Set();

/* ── localStorage PDF helpers ── */
const _PDF = 'mon_pdf_';
const _pdfSave = (id, url) => { try { localStorage.setItem(_PDF + id, url); } catch (_) { } };
const _pdfLoad = (id) => { try { return localStorage.getItem(_PDF + id) || ''; } catch (_) { return ''; } };

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', async () => {
  await requireLogin();

  const now = new Date();
  const curM = now.getMonth() + 1;
  const curY = now.getFullYear();

  ['startTahun', 'endTahun'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    for (let y = curY; y >= 2024; y--)
      sel.innerHTML += `<option value="${y}">${y}</option>`;
  });
  const startBulan = document.getElementById('startBulan');
  const startTahun = document.getElementById('startTahun');
  const endBulan = document.getElementById('endBulan');
  const endTahun = document.getElementById('endTahun');

  if (startBulan) startBulan.value = 1;
  if (startTahun) startTahun.value = 2025;
  if (endBulan) endBulan.value = curM;
  if (endTahun) endTahun.value = curY;

  const [{ data: acts }, { data: mems }, { data: settings }] = await Promise.all([
    supabaseClient.from('activities').select('id,name,start_date,end_date,default_participants').eq('is_active', true).order('name'),
    supabaseClient.from('members').select('id,name,role').eq('is_active', true).order('name'),
    supabaseClient.from('app_settings').select('*')
  ]);
  if (acts) {
    _allActivities = acts;
  }
  if (mems) {
    _allMembers = mems;
    _pickerPool = [...mems];
  }
  if (settings) {
    const pRow = settings.find(r => r.setting_key === 'attendance_points');
    if (pRow) _pointMultiplier = parseInt(pRow.setting_value) || 10000;

    const wRow = settings.find(r => r.setting_key === 'monitoring_weight_absensi');
    if (wRow) _monWeightAbsensi = parseInt(wRow.setting_value) ?? 30;
  }

  // Close modal on backdrop click
  const atletModal = document.getElementById('atletPickerModal');
  if (atletModal) {
    atletModal.addEventListener('click', e => {
      if (e.target === atletModal) closeAtletPicker();
    });
  }
});

/* ── Event Picker Modal ── */
function openEventPicker() {
  _eventPickerTemp = new Set(_selectedEvents.map(a => a.id));
  document.getElementById('eventPickerSearch').value = '';
  filterEventPicker('');
  document.getElementById('eventPickerModal').classList.add('show');
}
window.openEventPicker = openEventPicker;

function closeEventPicker() {
  document.getElementById('eventPickerModal').classList.remove('show');
}
window.closeEventPicker = closeEventPicker;

function filterEventPicker(q) {
  const filtered = q.trim()
    ? _allActivities.filter(a => a.name.toLowerCase().includes(q.toLowerCase()))
    : _allActivities;
  renderEventPickerList(filtered);
}
window.filterEventPicker = filterEventPicker;

function renderEventPickerList(pool) {
  const el = document.getElementById('eventPickerList');
  if (!el) return;
  el.innerHTML = pool.map(a => {
    const sel = _eventPickerTemp.has(a.id);
    return `
      <div class="picker-item${sel ? ' selected' : ''}" onclick="toggleEventPickerItem('${a.id}','${escHtml(a.name)}',this)">
        <div class="picker-check">${sel ? '✓' : ''}</div>
        <div class="picker-item-name">${escHtml(a.name)}</div>
      </div>`;
  }).join('');
}

function toggleEventPickerItem(id, name, el) {
  if (_eventPickerTemp.has(id)) {
    _eventPickerTemp.delete(id);
    el.classList.remove('selected');
    el.querySelector('.picker-check').textContent = '';
  } else {
    _eventPickerTemp.add(id);
    el.classList.add('selected');
    el.querySelector('.picker-check').textContent = '✓';
  }
}
window.toggleEventPickerItem = toggleEventPickerItem;

function confirmEventPicker() {
  const chosenIds = Array.from(_eventPickerTemp);
  _selectedEvents = _allActivities.filter(a => chosenIds.includes(a.id));
  renderEventChips();
  closeEventPicker();
  syncSelectionSettings();
}
window.confirmEventPicker = confirmEventPicker;

function renderEventChips() {
  const container = document.getElementById('eventChips');
  if (!container) return;
  container.innerHTML = _selectedEvents.map(a => `
    <div class="chip">
      <span>${escHtml(a.name)}</span>
      <button class="chip-del" onclick="removeEventChip('${a.id}')">✕</button>
    </div>
  `).join('');
}

function removeEventChip(id) {
  _selectedEvents = _selectedEvents.filter(a => a.id !== id);
  renderEventChips();
  syncSelectionSettings();
}
window.removeEventChip = removeEventChip;

/* ── Sync selection: auto-fill tanggal + filter atlet ── */
function syncSelectionSettings() {
  _pickerPool = [..._allMembers];
  _selectedAtlets = [];
  renderChips();

  if (_selectedEvents.length === 0) return;

  let minStart = Infinity;
  let maxEnd = -Infinity;
  let combinedParticipants = new Set();
  let hasParticipants = false;

  _selectedEvents.forEach(act => {
    if (act.start_date) {
      const [y, m] = act.start_date.split('-').map(Number);
      const val = y * 100 + m;
      if (val < minStart) minStart = val;
    }
    if (act.end_date) {
      const [y, m] = act.end_date.split('-').map(Number);
      const val = y * 100 + m;
      if (val > maxEnd) maxEnd = val;
    }

    if (act.default_participants && act.default_participants.length > 0) {
      hasParticipants = true;
      act.default_participants.forEach(p => combinedParticipants.add(p.member_id));
    }
  });

  if (minStart !== Infinity) {
    document.getElementById('startTahun').value = Math.floor(minStart / 100);
    document.getElementById('startBulan').value = minStart % 100;
  }
  if (maxEnd !== -Infinity) {
    const ey = Math.floor(maxEnd / 100);
    const em = maxEnd % 100;
    const now = new Date();
    const curOrd = now.getFullYear() * 100 + (now.getMonth() + 1);

    if (maxEnd > curOrd) {
      document.getElementById('endTahun').value = now.getFullYear();
      document.getElementById('endBulan').value = now.getMonth() + 1;
    } else {
      document.getElementById('endTahun').value = ey;
      document.getElementById('endBulan').value = em;
    }
  }

  if (hasParticipants) {
    _pickerPool = _allMembers.filter(m => combinedParticipants.has(m.id));
  }
}

/* ── Atlet Picker Modal ── */
function openAtletPicker() {
  _pickerTemp = new Set(_selectedAtlets.map(a => a.id));
  document.getElementById('pickerSearch').value = '';
  filterPickerList('');
  document.getElementById('atletPickerModal').classList.add('show');
}
window.openAtletPicker = openAtletPicker;

function closeAtletPicker() {
  document.getElementById('atletPickerModal').classList.remove('show');
}
window.closeAtletPicker = closeAtletPicker;

function filterPickerList(q) {
  const filtered = q.trim()
    ? _pickerPool.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : _pickerPool;
  renderPickerList(filtered);
}
window.filterPickerList = filterPickerList;

function renderPickerList(pool) {
  const el = document.getElementById('pickerList');
  if (!el) return;
  el.innerHTML = pool.map(m => {
    const sel = _pickerTemp.has(m.id);
    return `
      <div class="picker-item${sel ? ' selected' : ''}" onclick="togglePickerItem('${m.id}','${escHtml(m.name)}',this)">
        <div class="picker-check">${sel ? '✓' : ''}</div>
        <div>
          <div class="picker-item-name">${escHtml(m.name)}</div>
          <div class="picker-item-role">${escHtml(m.role || '')}</div>
        </div>
      </div>`;
  }).join('');
}

function togglePickerItem(id, name, el) {
  if (_pickerTemp.has(id)) { _pickerTemp.delete(id); }
  else { _pickerTemp.add(id); }
  el.classList.toggle('selected');
  el.querySelector('.picker-check').textContent = _pickerTemp.has(id) ? '✓' : '';
}
window.togglePickerItem = togglePickerItem;

function confirmAtletPicker() {
  _selectedAtlets = _allMembers.filter(m => _pickerTemp.has(m.id));
  renderChips();
  closeAtletPicker();
}
window.confirmAtletPicker = confirmAtletPicker;

function renderChips() {
  const wrap = document.getElementById('atletChips');
  if (!wrap) return;
  wrap.innerHTML = _selectedAtlets.map(a => `
    <span class="chip">
      ${escHtml(a.name)}
      <button class="chip-del" onclick="removeAtlet('${a.id}')" title="Hapus">✕</button>
    </span>`).join('');
}

function removeAtlet(id) {
  _selectedAtlets = _selectedAtlets.filter(a => a.id !== id);
  renderChips();
}
window.removeAtlet = removeAtlet;

/* ── Load Riwayat ── */
async function loadRiwayat() {
  const container = document.getElementById('listContainer');
  const hasil = document.getElementById('hasilSection');
  const pill = document.getElementById('countPill');

  if (hasil) hasil.style.display = 'none';
  if (container) container.innerHTML = '<div class="empty-state">Memuat data…</div>';

  const startB = parseInt(document.getElementById('startBulan').value);
  const startY = parseInt(document.getElementById('startTahun').value);
  const endB = parseInt(document.getElementById('endBulan').value);
  const endY = parseInt(document.getElementById('endTahun').value);
  const startOrd = startY * 100 + startB;
  const endOrd = endY * 100 + endB;

  if (startOrd > endOrd) {
    showToastMsg('Waktu mulai tidak boleh lebih besar dari waktu selesai.', 'error');
    return;
  }

  try {
    const actIds = _selectedEvents.map(e => e.id);
    const participantIds = [];
    _selectedEvents.forEach(act => {
      if (act.default_participants) {
        act.default_participants.forEach(p => participantIds.push(p.member_id));
      }
    });

    let query = supabaseClient
      .from('monitoring_atlet')
      .select('id,member_id,bulan,tahun,rata_rata_total,sistem_utama,vo2max,catatan_pelatih,data_b1,data_b2,data_b3,data_b4,created_at,members(name,role)')
      .gte('tahun', startY)
      .lte('tahun', endY)
      .order('tahun', { ascending: true })
      .order('bulan', { ascending: true });

    if (actIds.length > 0) {
      if (_selectedAtlets.length > 0) {
        query = query.in('activity_id', actIds).in('member_id', _selectedAtlets.map(a => a.id));
      } else if (participantIds.length > 0) {
        query = query.or(`activity_id.in.(${actIds.join(',')}),member_id.in.(${participantIds.join(',')})`);
      } else {
        query = query.in('activity_id', actIds);
      }
    } else if (_selectedAtlets.length > 0) {
      query = query.in('member_id', _selectedAtlets.map(a => a.id));
    }

    const { data, error } = await query;
    if (error) throw error;

    const filtered = (data || []).filter(item => {
      const ord = item.tahun * 100 + item.bulan;
      return ord >= startOrd && ord <= endOrd;
    });

    if (hasil) hasil.style.display = 'block';

    _lastData = [];
    _activePilarKey = null;
    _activeFisikKey = null;
    if (_pilarChartInst) { _pilarChartInst.destroy(); _pilarChartInst = null; }
    if (_fisikChartInst) { _fisikChartInst.destroy(); _fisikChartInst = null; }
    const pilarArea = document.getElementById('pilarChartArea');
    const fisikArea = document.getElementById('fisikChartArea');
    if (pilarArea) pilarArea.classList.remove('open');
    if (fisikArea) fisikArea.classList.remove('open');
    document.querySelectorAll('.pilar-tab-btn').forEach(b => b.classList.remove('active'));

    if (!filtered.length) {
      if (pill) pill.textContent = '0 data';
      if (container) container.innerHTML = '<div class="empty-state">Tidak ada data monitoring pada rentang waktu ini.</div>';
      if (_chartInst) { _chartInst.destroy(); _chartInst = null; }
      return;
    }

    const dateFrom = `${startY}-${String(startB).padStart(2, '0')}-01`;
    const lastDay = new Date(endY, endB, 0).getDate();
    const dateTo = `${endY}-${String(endB).padStart(2, '0')}-${lastDay}`;

    const { data: attendanceData } = await supabaseClient
      .from('attendance_detail')
      .select('member_id, presence, attendance_header!inner(date)')
      .gte('attendance_header.date', dateFrom)
      .lte('attendance_header.date', dateTo);

    let attendanceMap = {};
    let totalSessionsMap = {};

    if (attendanceData && attendanceData.length > 0) {
      attendanceData.forEach(row => {
        if (!row.attendance_header || !row.attendance_header.date) return;
        const pts = row.attendance_header.date.split('-');
        const y = parseInt(pts[0]);
        const m = parseInt(pts[1]);
        const key = `${y}-${m}`;
        const mid = row.member_id;

        if (!totalSessionsMap[mid]) totalSessionsMap[mid] = {};
        totalSessionsMap[mid][key] = (totalSessionsMap[mid][key] || 0) + 1;

        if (row.presence === 'Hadir') {
          if (!attendanceMap[mid]) attendanceMap[mid] = {};
          attendanceMap[mid][key] = (attendanceMap[mid][key] || 0) + 1;
        }
      });
    }

    filtered.forEach(item => {
      const key = `${item.tahun}-${item.bulan}`;
      const mid = item.member_id;
      item.hadir_count = (attendanceMap[mid] && attendanceMap[mid][key]) || 0;
      item.total_sesi = (totalSessionsMap[mid] && totalSessionsMap[mid][key]) || 0;

      let pAvg = item.rata_rata_total || 0;
      let pilarNormalized = pAvg * 20;
      if (pAvg > 5) {
        pilarNormalized = pAvg;
        item.rata_rata_total = parseFloat((pAvg / 20).toFixed(2));
      }

      const attendancePct = item.total_sesi > 0 ? (item.hadir_count / item.total_sesi) * 100 : 0;
      const weightPilar = 1 - (_monWeightAbsensi / 100);
      const weightAbsensi = _monWeightAbsensi / 100;

      item.skor_performa_total = parseFloat(((pilarNormalized * weightPilar) + (attendancePct * weightAbsensi)).toFixed(1));
    });

    _lastData = filtered;
    if (pill) pill.textContent = filtered.length + ' data';
    renderChart(filtered);
    renderList(filtered, container);

  } catch (err) {
    console.error(err);
    if (hasil) hasil.style.display = 'block';
    if (container) container.innerHTML = `<div class="empty-state text-danger">Gagal memuat: ${err.message}</div>`;
  }
}
window.loadRiwayat = loadRiwayat;

/* ── Chart ── */
function renderChart(data) {
  if (_chartInst) { _chartInst.destroy(); _chartInst = null; }
  const periodeSet = new Set();
  data.forEach(i => periodeSet.add(`${i.tahun}-${String(i.bulan).padStart(2, '0')}`));
  const allP = [...periodeSet].sort();

  const labels = allP.map(p => {
    const [y, m] = p.split('-');
    return `${NB[parseInt(m)].slice(0, 3)} '${y.slice(2)}`;
  });

  const inner = document.getElementById('trendChartInner');
  if (inner) inner.style.width = '100%';

  const byAtlet = {};
  data.forEach(item => {
    const name = item.members?.name || item.member_id;
    if (!byAtlet[name]) byAtlet[name] = {};
    const key = `${item.tahun}-${String(item.bulan).padStart(2, '0')}`;
    byAtlet[name][key] = item.skor_performa_total ?? null;
  });

  const datasets = Object.entries(byAtlet).map(([name, pMap], idx) => ({
    label: name,
    data: allP.map(p => pMap[p] ?? null),
    borderColor: CHART_COLORS[idx % CHART_COLORS.length],
    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] + '22',
    borderWidth: 2, pointRadius: 5, pointHoverRadius: 7,
    tension: 0.3, fill: false, spanGaps: true
  }));

  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  _chartInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw ?? '—'}` } }
      },
      scales: {
        y: { min: 0, max: 100, ticks: { stepSize: 20, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
        x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } }
      }
    }
  });
}

function togglePilarChart(key, btnEl) {
  const area = document.getElementById('pilarChartArea');
  const allBtns = document.querySelector('.pilar-tab-row').querySelectorAll('.pilar-tab-btn');

  if (_activePilarKey === key) {
    _activePilarKey = null;
    if (area) area.classList.remove('open');
    allBtns.forEach(b => b.classList.remove('active'));
    if (_pilarChartInst) { _pilarChartInst.destroy(); _pilarChartInst = null; }
    return;
  }

  _activePilarKey = key;
  allBtns.forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  if (area) area.classList.add('open');
  renderPilarChart(key, _lastData);
}
window.togglePilarChart = togglePilarChart;

function toggleFisikChart(key, btnEl) {
  const area = document.getElementById('fisikChartArea');
  const container = btnEl.closest('.pilar-tab-row');
  const allBtns = container.querySelectorAll('.pilar-tab-btn');

  if (_activeFisikKey === key) {
    _activeFisikKey = null;
    if (area) area.classList.remove('open');
    allBtns.forEach(b => b.classList.remove('active'));
    if (_fisikChartInst) { _fisikChartInst.destroy(); _fisikChartInst = null; }
    return;
  }

  _activeFisikKey = key;
  allBtns.forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  if (area) area.classList.add('open');
  renderFisikChart(key, _lastData);
}
window.toggleFisikChart = toggleFisikChart;

function renderPilarChart(key, data) {
  if (_pilarChartInst) { _pilarChartInst.destroy(); _pilarChartInst = null; }
  const canvas = document.getElementById('pilarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  _pilarChartInst = _createBaseChart(key, data, ctx, 'pilarChartInner');
}

function renderFisikChart(key, data) {
  if (_fisikChartInst) { _fisikChartInst.destroy(); _fisikChartInst = null; }
  const canvas = document.getElementById('fisikChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  _fisikChartInst = _createBaseChart(key, data, ctx, 'fisikChartInner');
}

function _createBaseChart(key, data, ctx, innerId) {
  const periodeSet = new Set();
  data.forEach(i => periodeSet.add(`${i.tahun}-${String(i.bulan).padStart(2, '0')}`));
  const allP = [...periodeSet].sort();
  const labels = allP.map(p => {
    const [y, m] = p.split('-');
    return `${NB[parseInt(m)].slice(0, 3)} '${y.slice(2)}`;
  });

  const inner = document.getElementById(innerId);
  if (inner) inner.style.width = '100%';

  const byAtlet = {};
  data.forEach(item => {
    const name = item.members?.name || item.member_id;
    if (!byAtlet[name]) byAtlet[name] = {};
    const k = `${item.tahun}-${String(item.bulan).padStart(2, '0')}`;

    if (key === 'hadir') {
      const pct = item.total_sesi > 0 ? Math.round((item.hadir_count / item.total_sesi) * 100) : null;
      byAtlet[name][k] = pct;
    } else if (key === 'vo2max') {
      byAtlet[name][k] = item.vo2max ?? null;
    } else {
      byAtlet[name][k] = item[`data_${key}`]?.rata_rata ?? null;
    }
  });

  const datasets = Object.entries(byAtlet).map(([name, pMap], idx) => ({
    label: name,
    data: allP.map(p => pMap[p] ?? null),
    borderColor: CHART_COLORS[idx % CHART_COLORS.length],
    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] + '22',
    borderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
    tension: 0.3, fill: false, spanGaps: true
  }));

  const stepSize = (key === 'hadir') ? 20 : (key === 'vo2max' ? 10 : 0.5);
  const yMax = (key === 'hadir') ? 100 : (key === 'vo2max' ? undefined : 5);

  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw ?? '—'}` } },
        title: {
          display: true,
          text: (key.startsWith('b')) ? `B${key.slice(1)}. ${PILAR_LABEL[key]}` : PILAR_LABEL[key],
          font: { size: 12, weight: 'bold' }, color: '#475569', padding: { bottom: 8 }
        }
      },
      scales: {
        y: {
          min: 0,
          max: yMax,
          suggestedMax: (key === 'vo2max' ? 60 : undefined),
          ticks: { stepSize, font: { size: 9 } },
          grid: { color: '#f1f5f9' }
        },
        x: { ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45 } }
      }
    }
  });
}

/* ── Fullscreen Logic ── */
let _fsChartInst = null;
function openFs(type) {
  let sourceChart = null;
  let activeKey = null;

  if (type === 'trend') {
    sourceChart = _chartInst;
  } else if (type === 'pilar') {
    sourceChart = _pilarChartInst;
    activeKey = _activePilarKey;
  } else if (type === 'fisik') {
    sourceChart = _fisikChartInst;
    activeKey = _activeFisikKey;
  }

  if (!sourceChart) {
    showToastMsg('Grafik belum dimuat atau tidak ada data.', 'info');
    return;
  }

  const titleEl = document.getElementById('fsTitle');
  if (titleEl) titleEl.textContent = (type === 'trend') ? 'Tren Perkembangan Total' : PILAR_LABEL[activeKey] || 'Tren Detail';
  const fsOverlay = document.getElementById('fsOverlay');
  if (fsOverlay) fsOverlay.classList.add('show');

  const points = sourceChart.data.labels.length;
  const wrap = document.getElementById('fsChartWrapper');
  if (wrap) wrap.style.width = Math.max(window.innerWidth, points * 80) + 'px';

  const canvas = document.getElementById('fsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (_fsChartInst) _fsChartInst.destroy();

  const sourceConfig = sourceChart.config;
  const fsConfig = {
    type: sourceConfig.type,
    data: {
      labels: [...sourceConfig.data.labels],
      datasets: sourceConfig.data.datasets.map(ds => ({ ...ds }))
    },
    options: {
      ...sourceConfig.options,
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        ...sourceConfig.options.plugins,
        legend: {
          ...sourceConfig.options.plugins.legend,
          display: true,
          position: 'bottom'
        },
        zoom: {
          pan: { enabled: true, mode: 'x', modifierKey: 'ctrl' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x'
          }
        }
      }
    }
  };

  if (fsConfig.options.scales.x) fsConfig.options.scales.x.ticks.font = { size: 11 };
  if (fsConfig.options.scales.y) fsConfig.options.scales.y.ticks.font = { size: 11 };

  _fsChartInst = new Chart(ctx, fsConfig);

  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => { });
    }
  } catch (_) { }
}
window.openFs = openFs;

function closeFs() {
  const fsOverlay = document.getElementById('fsOverlay');
  if (fsOverlay) fsOverlay.classList.remove('show');
  if (_fsChartInst) {
    _fsChartInst.destroy();
    _fsChartInst = null;
  }
  try {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  } catch (_) { }
}
window.closeFs = closeFs;

function zoomFs(factor) {
  if (_fsChartInst) {
    _fsChartInst.zoom(factor);
  }
}
window.zoomFs = zoomFs;

function resetZoomFs() {
  if (_fsChartInst) {
    _fsChartInst.resetZoom();
  }
}
window.resetZoomFs = resetZoomFs;

/* ── Render list ── */
function renderList(data, container) {
  const sorted = [...data].sort((a, b) => (b.tahun * 100 + b.bulan) - (a.tahun * 100 + a.bulan));
  container.innerHTML = sorted.map(renderCard).join('');
  container.querySelectorAll('.mon-card-header').forEach(h =>
    h.addEventListener('click', () => h.closest('.mon-card').classList.toggle('open'))
  );
}

function renderCard(item) {
  const namaAtlet = item.members?.name || 'Unknown';
  const role = item.members?.role || '';
  const periode = `${NB[item.bulan]} ${item.tahun}`;
  const compositeScore = item.skor_performa_total || 0;
  const pillarAvg = item.rata_rata_total || 0;
  const cls = compositeScore >= 80 ? 'good' : compositeScore >= 60 ? 'mid' : 'low';
  const inisial = namaAtlet.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const dataStr = encodeURIComponent(JSON.stringify(item));
  const namaStr = encodeURIComponent(namaAtlet);
  const savedUrl = _pdfLoad(item.id);

  let detailHtml = '';
  ['b1', 'b2', 'b3', 'b4'].forEach(k => {
    const d = item[`data_${k}`] || {};
    const rows = PILAR_ITEMS[k].map((lbl, idx) => {
      const i = idx + 1;
      const note = escHtml(d[`c${i}`] || '');
      const rowClass = note ? ' class="row-has-note"' : '';
      return `<tr${rowClass}>
          <td>${i}. ${lbl}</td>
          <td class="font-bold text-center">${d[`n${i}`] ?? '—'}</td>
          <td class="text-muted">${note}</td>
        </tr>`;
    }).join('');
    detailHtml += `<div class="pilar-section-title">B${k.slice(1)}. ${PILAR_LABEL[k]} — rata-rata ${d.rata_rata ?? '?'}</div>
      <div class="detail-table-wrapper">
        <table class="detail-table">
          <thead>
            <tr>
              <th class="col-ind">Indikator</th>
              <th class="col-val text-center">Nilai</th>
              <th class="col-note">Catatan</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  });

  const catBox = item.catatan_pelatih
    ? `<div class="note-box"><strong>💬 Catatan Pelatih:</strong>${escHtml(item.catatan_pelatih)}</div>` : '';
  const totalPoints = (item.hadir_count || 0) * _pointMultiplier;
  const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const itemGrid = `
    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-icon"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path fill="currentColor" d="M12 6a1 1 0 0 0-1 1v4H7a1 1 0 0 0 0 2h5a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z"/></svg></div>
        <div class="meta-info">
          <div class="meta-label">Sistem</div>
          <div class="meta-value">${escHtml(item.sistem_utama || '—')}</div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-icon"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V8h14zm-7-7h5v5h-5z"/></svg></div>
        <div class="meta-info">
          <div class="meta-label">Kehadiran</div>
          <div class="meta-value">${item.hadir_count || 0} / ${item.total_sesi || 0} <span class="text-[10px] font-normal opacity-60">Sesi</span></div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-icon" style="color:#eab308; background:#fefce8;"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2z"/></svg></div>
        <div class="meta-info">
          <div class="meta-label">Point</div>
          <div class="meta-value accent">${totalPoints.toLocaleString('id-ID')}</div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-icon" style="color:#ef4444; background:#fef2f2;"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>
        <div class="meta-info">
          <div class="meta-label">VO₂max</div>
          <div class="meta-value">${item.vo2max || '—'}</div>
        </div>
      </div>
      <div class="meta-card" style="grid-column: span 2; background: #f0fdf4; border-color: #bbf7d0;">
        <div class="meta-icon" style="color:#16a34a; background:#fff;"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87l6.91-1.01L12 2z"/></svg></div>
        <div class="meta-info">
          <div class="meta-label">Nilai Akumulasi</div>
          <div class="meta-value">${compositeScore}</div>
        </div>
      </div>
    </div>
    <div class="meta-timestamp">
      <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.1.8-1.2-4.5-2.7V7z"/></svg>
      Dibuat pada: ${createdDate}
    </div>
  `;

  return `
    <div class="mon-card" id="card-${item.id}">
      <div class="mon-card-header">
        <div class="mon-avatar">${inisial}</div>
        <div class="mon-info">
          <div class="mon-name">${escHtml(namaAtlet)}</div>
          <div class="mon-periode">${periode}${role ? ' · ' + escHtml(role) : ''}</div>
        </div>
        <span class="score-badge-main ${cls}">⭐ ${pillarAvg ?? '—'}</span>
        <span class="chevron">▼</span>
      </div>
      <div class="mon-card-body">
        ${itemGrid}
        ${detailHtml}
        ${catBox}
        <div class="pdf-actions">
          <button class="btn-gen-pdf" onclick="generatePDF('${dataStr}','${namaStr}','${periode}','${item.id}')">📄 Generate PDF</button>
          <button class="btn-view-pdf${savedUrl ? ' ready' : ''}" id="viewbtn-${item.id}"
            ${savedUrl ? `onclick="viewPDF('${item.id}')"` : ' disabled title="Generate PDF terlebih dahulu"'}>👁 View</button>
          <button class="btn-share-pdf${savedUrl ? ' ready' : ''}" id="sharebtn-${item.id}"
            ${savedUrl ? `onclick="sharePDF('${item.id}','${namaStr}','${periode}')"` : ' disabled title="Generate PDF terlebih dahulu"'}>🔗 Bagikan</button>
        </div>
      </div>
    </div>`;
}

/* ── PDF ── */
function _showOv() { const el = document.getElementById('pdfOverlay'); if (el) el.classList.add('show'); }
function _hideOv() { const el = document.getElementById('pdfOverlay'); if (el) el.classList.remove('show'); }

async function generatePDF(dataStr, namaStr, periode, itemId) {
  const item = JSON.parse(decodeURIComponent(dataStr));
  const nama = decodeURIComponent(namaStr);
  _showOv();
  try {
    const res = await apiPost('generateMonitoringPDF', {
      nama_atlet: nama, periode,
      kehadiran: 'Lihat Rekap Absen',
      sistem_utama: item.sistem_utama || '—',
      rata_rata_total: item.rata_rata_total,
      catatan_pelatih: item.catatan_pelatih || '—',
      b1: item.data_b1, b2: item.data_b2, b3: item.data_b3, b4: item.data_b4
    });
    const url = res?.pdfUrl || res?.pdf_url;
    if (!url) throw new Error('Gagal mendapatkan link PDF.');
    _pdfSave(itemId, url);
    const btn = document.getElementById(`viewbtn-${itemId}`);
    if (btn) {
      btn.classList.add('ready'); btn.removeAttribute('disabled');
      btn.setAttribute('onclick', `viewPDF('${itemId}')`); btn.title = '';
    }
    const sbtn = document.getElementById(`sharebtn-${itemId}`);
    if (sbtn) {
      sbtn.classList.add('ready'); sbtn.removeAttribute('disabled');
      sbtn.setAttribute('onclick', `sharePDF('${itemId}','${namaStr}','${periode}')`); sbtn.title = '';
    }
    showToastMsg('PDF berhasil dibuat!', 'success');
  } catch (err) {
    showToastMsg('Gagal: ' + err.message, 'error');
  } finally { _hideOv(); }
}
window.generatePDF = generatePDF;

function viewPDF(itemId) {
  const url = _pdfLoad(itemId);
  if (url) window.open(url, '_blank');
  else showToastMsg('Generate ulang PDF terlebih dahulu.', 'error');
}
window.viewPDF = viewPDF;

async function sharePDF(itemId, namaStr, periode) {
  const url = _pdfLoad(itemId);
  if (!url) return showToastMsg('Generate ulang PDF terlebih dahulu.', 'error');

  const nama = decodeURIComponent(namaStr);
  const text = `Halo, berikut adalah hasil Monitoring Gabku untuk ${nama} periode ${periode}.\n\nLihat PDF: ${url}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Monitoring Gabku - ${nama}`,
        text: text,
        url: url
      });
    } catch (err) {
      if (err.name !== 'AbortError') showToastMsg('Gagal berbagi: ' + err.message, 'error');
    }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      showToastMsg('Link disalin ke clipboard!', 'success');
    } catch (err) {
      showToastMsg('Gagal menyalin link.', 'error');
    }
  }
}
window.sharePDF = sharePDF;


