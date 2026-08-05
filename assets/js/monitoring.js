/**
 * Gabku App - Monitoring Module
 * Encapsulated JS logic for athlete monitoring (monitoring.html)
 */

/* =====================================================
 * KONSTANTA
 * ===================================================== */
const NAMA_BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const INDIKATOR_DATA = {
  b1: { title: "B1. TABEL BIDDING", items: ["Akurasi Penentuan Kontrak", "Pemahaman Sistem & Konvensi", "Konsistensi Interpretasi Bid", "Kepatuhan Sistem & Kesepakatan", "Penanganan Bid Kompetitif & Preemp"] },
  b2: { title: "B2. TABEL PLAY (DECLARER PLAY)", items: ["Perencanaan Play Awal", "Teknik Declarer", "Analisis Peluang & Distribusi", "Timing & Entry Management", "Konsistensi Rencana Main (Line of Play)"] },
  b3: { title: "B3. TABEL DEFENSE", items: ["Ketepatan Opening Lead", "Kejelasan Signaling", "Akurasi Switching & Discard", "Membaca Permainan Partner", "Defense Planning (2 trik awal)"] },
  b4: { title: "B4. TABEL MENTAL & KEMITRAAN", items: ["Konsistensi Fokus & Stamina", "Respon Papan Buruk", "Komunikasi & Harmonisasi Partner", "Manajemen Waktu (Tempo Permainan)", "Diskusi Pasca Latihan & Error Awareness"] }
};

/* =====================================================
 * STATE
 * ===================================================== */
let _currentMember = null;
let _existingId = null;
let _allMembers = [];
let _allActivities = [];
let _historyCache = [];
let _monWeightAbsensi = 30;

/* =====================================================
 * INIT
 * ===================================================== */
(async () => {
  await requireLogin();
  await loadDropdowns();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const selTahun = document.getElementById('inputTahun');
  const selBulan = document.getElementById('inputBulan');

  selTahun.innerHTML = `
    <option value="${currentYear - 1}">${currentYear - 1}</option>
    <option value="${currentYear}" selected>${currentYear}</option>
  `;

  function updateMonthOptions() {
    const selectedYear = parseInt(selTahun.value);
    const maxMonth = (selectedYear === currentYear) ? currentMonth : 12;
    const prevVal = parseInt(selBulan.value);

    let html = '<option value="">— Bulan —</option>';
    for (let i = 1; i <= 12; i++) {
      const disabled = i > maxMonth ? 'disabled style="color:#ccc;"' : '';
      html += `<option value="${i}" ${disabled}>${NAMA_BULAN[i]}</option>`;
    }
    selBulan.innerHTML = html;

    if (prevVal && prevVal <= maxMonth) {
      selBulan.value = prevVal;
    } else if (currentMonth <= maxMonth) {
      selBulan.value = currentMonth;
    } else {
      selBulan.value = "";
    }
  }

  selTahun.addEventListener('change', updateMonthOptions);
  updateMonthOptions();

  const savedActId = localStorage.getItem('mon_last_activity');
  if (savedActId) {
    const selK = document.getElementById('filterKegiatan');
    if (selK) {
      selK.value = savedActId;
      selK.dispatchEvent(new Event('change'));
    }
  }

  const savedMemberId = localStorage.getItem('mon_last_member');
  if (savedMemberId && _allMembers.length) {
    const member = _allMembers.find(m => m.id === savedMemberId);
    if (member) {
      _currentMember = member;
      _renderProfile(member);
      await loadMonitoringHistory(member.id);
      showPhase(2);
      updateMonStatusTable();
    } else {
      localStorage.removeItem('mon_last_member');
    }
  }
})();

/* =====================================================
 * LOAD DROPDOWNS
 * ===================================================== */
async function loadDropdowns() {
  try {
    const [{ data: members, error: errM }, { data: activities, error: errA }, { data: settings, error: errS }] = await Promise.all([
      supabaseClient.from('members').select('id,name,role,gender,birth_date,phone').eq('is_active', true).order('name'),
      supabaseClient.from('activities').select('id,name,default_participants,start_date,end_date').eq('is_active', true).order('name'),
      supabaseClient.from('app_settings').select('*')
    ]);

    if (!errM && members) {
      _allMembers = members;
      _populateAtletDropdown(members);
    }
    if (!errA && activities) {
      _allActivities = activities;
      const selK = document.getElementById('filterKegiatan');
      activities.forEach(a => { selK.innerHTML += `<option value="${a.id}">${escHtml(a.name)}</option>`; });
    }
    if (!errS && settings) {
      const sysRow = settings.find(r => r.setting_key === 'system_options');
      const sysOptions = sysRow ? sysRow.setting_value : ["Standard American", "Precision", "Sistem Berdikari", "Two-over-one"];
      const selS = document.getElementById('inputSistem');
      selS.innerHTML = '<option value="">— Pilih Sistem —</option>';
      sysOptions.sort().forEach(s => {
        selS.innerHTML += `<option value="${escHtml(s)}">${escHtml(s)}</option>`;
      });
      const wRow = settings.find(r => r.setting_key === 'monitoring_weight_absensi');
      if (wRow) _monWeightAbsensi = parseInt(wRow.setting_value) ?? 30;
    }
  } catch (err) { console.error('loadDropdowns:', err); }
}

function _populateAtletDropdown(members) {
  _currentPickerPool = members || [];
  if (document.getElementById('monMemberPickerModal').classList.contains('show')) {
    filterMonPicker(document.getElementById('monPickerSearch').value);
  }
}

let _currentPickerPool = [];
function openMonPicker() {
  document.getElementById('monPickerSearch').value = '';
  filterMonPicker('');
  document.getElementById('monMemberPickerModal').classList.add('show');
  document.getElementById('monPickerSearch').focus();
}
window.openMonPicker = openMonPicker;

function closeMonPicker() {
  document.getElementById('monMemberPickerModal').classList.remove('show');
}
window.closeMonPicker = closeMonPicker;

function filterMonPicker(q) {
  const pool = q.trim()
    ? _currentPickerPool.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : _currentPickerPool;

  const currentId = document.getElementById('selectAtlet').value;
  const listEl = document.getElementById('monPickerList');

  if (!pool.length) {
    listEl.innerHTML = '<div class="empty-state">Data tidak ditemukan.</div>';
    return;
  }

  let html = '';

  if (!q.trim()) {
    const isAllSelected = !currentId;
    html += `
      <div class="picker-item all-option${isAllSelected ? ' selected' : ''}" onclick="selectMonMember('','',true)">
        <div class="picker-check">${isAllSelected ? '✓' : ''}</div>
        <div class="flex-1">
          <div class="picker-item-name">🔄 Pilih Seluruh Atlet</div>
          <div class="picker-item-role">Recap status kegiatan</div>
        </div>
      </div>`;
  }

  html += pool.map(m => {
    const sel = m.id === currentId;
    return `
      <div class="picker-item${sel ? ' selected' : ''}" onclick="selectMonMember('${m.id}','${escHtml(m.name)}',${sel})">
        <div class="picker-check">${sel ? '✓' : ''}</div>
        <div class="flex-1">
          <div class="picker-item-name">${escHtml(m.name)}</div>
          <div class="picker-item-role">${escHtml(m.role || '-')}</div>
        </div>
      </div>`;
  }).join('');

  listEl.innerHTML = html;
}
window.filterMonPicker = filterMonPicker;

function selectMonMember(id, name, isAlreadySelected) {
  const input = document.getElementById('selectAtlet');
  const text = document.getElementById('selectAtletText');
  const actId = document.getElementById('filterKegiatan').value;

  if (isAlreadySelected) {
    input.value = '';
    if (actId) {
      text.textContent = 'Keseluruhan atlet';
    } else {
      text.textContent = 'Pilih atlet...';
      text.style.color = '#94a3b8';
    }
  } else {
    input.value = id;
    text.textContent = name;
    text.style.color = '#111827';
  }
  closeMonPicker();
  document.getElementById('monStatusArea').innerHTML = '';
}
window.selectMonMember = selectMonMember;

async function updateMonStatusTable() {
  const actId = document.getElementById('filterKegiatan').value;
  const atletId = document.getElementById('selectAtlet').value;
  const area = document.getElementById('monStatusArea');

  const act = _allActivities.find(a => a.id === actId);
  if (!act || !act.default_participants || act.default_participants.length === 0) {
    area.innerHTML = '<div class="empty-state">Kegiatan ini belum memiliki daftar peserta.</div>';
    return;
  }

  area.innerHTML = '<div class="empty-state">Memuat status…</div>';

  try {
    const now = new Date();
    const curM = now.getMonth() + 1;
    const curY = now.getFullYear();
    const curOrd = curY * 100 + curM;

    let colPeriods = [];
    if (act.start_date && act.end_date) {
      const [sy, sm] = act.start_date.split('-').map(Number);
      const [ey, em] = act.end_date.split('-').map(Number);

      let ty = sy, tm = sm;
      while (ty < ey || (ty === ey && tm <= em)) {
        colPeriods.push({ m: tm, y: ty });
        tm++;
        if (tm > 12) { tm = 1; ty++; }
        if (colPeriods.length > 24) break;
      }
    }

    if (colPeriods.length === 0) {
      for (let m = 1; m <= 12; m++) colPeriods.push({ m, y: curY });
    }

    const { data: records, error } = await supabaseClient
      .from('monitoring_atlet')
      .select('member_id, bulan, tahun')
      .eq('activity_id', actId);

    if (error) throw error;

    const statusMap = {};
    records.forEach(r => {
      if (!statusMap[r.member_id]) statusMap[r.member_id] = {};
      statusMap[r.member_id][`${r.tahun}-${r.bulan}`] = true;
    });

    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const participants = act.default_participants;
    const rows = participants.map(p => {
      const m = _allMembers.find(mem => mem.id === p.member_id);
      return { id: p.member_id, name: m ? m.name : 'Unknown' };
    }).sort((a, b) => a.name.localeCompare(b.name));

    let html = `
      <div class="recap-container">
        <div class="header-text px-3 pt-3" style="font-size:12px; font-weight:700; color:#475569;">
          Status Pengisian (${act.name})
        </div>
        <div class="recap-scroll">
          <table class="recap-table">
            <thead>
              <tr>
                <th>Nama Atlet</th>
                ${colPeriods.map(p => `<th>${mNames[p.m - 1]}<br><small style="font-weight:400; font-size:9px;">${p.y}</small></th>`).join('')}
              </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(row => {
      html += `<tr>`;
      html += `<td class="recap-name" onclick="selectMonMember('${row.id}','${escHtml(row.name)}',false)">${escHtml(row.name)}</td>`;
      colPeriods.forEach(p => {
        const pOrd = p.y * 100 + p.m;
        const isFuture = pOrd > curOrd;
        const ok = statusMap[row.id] && statusMap[row.id][`${p.y}-${p.m}`];

        if (isFuture) {
          html += `<td class="status-future" title="Bulan depan belum tersedia">•</td>`;
        } else {
          html += `<td onclick="quickEditMonitoring('${row.id}','${escHtml(row.name)}',${p.m},${p.y})" style="cursor:pointer">
            ${ok ? '<span class="status-ok">✓</span>' : '<span class="status-empty">•</span>'}
          </td>`;
        }
      });
      html += `</tr>`;
    });

    html += `
            </tbody>
          </table>
        </div>
        <p class="text-xs text-slate-500 mt-2 italic px-3 pb-3">
          💡 Tip: Klik pada titik (•) atau centang (✓) untuk mengisi data secara cepat.
        </p>
      </div>
    `;
    area.innerHTML = html;
  } catch (err) {
    console.error(err);
    area.innerHTML = '<div class="empty-state text-danger">Gagal memuat rekap.</div>';
  }
}

function quickEditMonitoring(id, name, bulan, tahun) {
  const now = new Date();
  const curM = now.getMonth() + 1;
  const curY = now.getFullYear();
  if ((tahun > curY) || (tahun === curY && bulan > curM)) {
    showToastMsg('Tidak bisa mengisi monitoring untuk bulan depan.', 'info');
    return;
  }

  selectMonMember(id, name, false);

  const bSel = document.getElementById('inputBulan');
  const tSel = document.getElementById('inputTahun');

  if (tSel) tSel.value = tahun;
  if (bSel) bSel.value = bulan;

  onConfirmAthlete();
}
window.quickEditMonitoring = quickEditMonitoring;

document.getElementById('monMemberPickerModal').addEventListener('click', e => {
  if (e.target === document.getElementById('monMemberPickerModal')) closeMonPicker();
});

function toggleProfileDetails() {
  const details = document.getElementById('profileDetails');
  const icon = document.querySelector('.toggle-icon');

  const isOpen = details.classList.contains('open');

  if (isOpen) {
    details.classList.remove('open');
    icon.classList.remove('rotate');
  } else {
    details.classList.add('open');
    icon.classList.add('rotate');
  }
}
window.toggleProfileDetails = toggleProfileDetails;

document.getElementById('filterKegiatan').addEventListener('change', function () {
  const actId = this.value;
  const text = document.getElementById('selectAtletText');
  document.getElementById('monStatusArea').innerHTML = '';

  if (actId) localStorage.setItem('mon_last_activity', actId);
  else localStorage.removeItem('mon_last_activity');

  if (!actId) {
    _populateAtletDropdown(_allMembers);
    text.textContent = 'Pilih atlet...';
    text.style.color = '#94a3b8';
    return;
  }

  text.textContent = 'Keseluruhan atlet';
  text.style.color = '#111827';

  const act = _allActivities.find(a => a.id === actId);
  if (!act || !act.default_participants || !act.default_participants.length) {
    _populateAtletDropdown(_allMembers);
    showToastMsg('Kegiatan ini belum punya daftar peserta, menampilkan semua atlet.', 'info');
    return;
  }
  const ids = new Set(act.default_participants.map(p => p.member_id));
  const filtered = _allMembers.filter(m => ids.has(m.id));
  _populateAtletDropdown(filtered.length ? filtered : _allMembers);
  if (!filtered.length) showToastMsg('Tidak ada anggota aktif yang cocok, menampilkan semua.', 'info');
});

/* =====================================================
 * FASE 1 → 2
 * ===================================================== */
function onConfirmAthlete() {
  const msgEl = document.getElementById('phase1-msg');
  const memberId = document.getElementById('selectAtlet').value;
  const actId = document.getElementById('filterKegiatan').value;

  if (!memberId) {
    if (actId) {
      msgEl.textContent = '';
      updateMonStatusTable();
    } else {
      msgEl.textContent = 'Pilih kegiatan atau atlet terlebih dahulu!';
    }
    return;
  }
  msgEl.textContent = '';

  const member = _allMembers.find(m => m.id === memberId);
  if (!member) { msgEl.textContent = 'Data atlet tidak ditemukan.'; return; }

  _currentMember = member;
  localStorage.setItem('mon_last_member', member.id);
  _renderProfile(member);
  loadMonitoringHistory(member.id);
  showPhase(2);
}
window.onConfirmAthlete = onConfirmAthlete;

function _renderProfile(m) {
  document.getElementById('profName').textContent = m.name || '—';
  document.getElementById('profRole').textContent = m.role || '—';
  document.getElementById('profGender').textContent = m.gender || '—';
  document.getElementById('profPhone').textContent = m.phone || '—';
  let bDateOut = '—';
  if (m.birth_date) {
    try {
      const d = new Date(m.birth_date);
      const mth = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
      bDateOut = `${d.getDate()} ${mth[d.getMonth()]} ${d.getFullYear()}`;
      const age = Math.abs(new Date(Date.now() - d.getTime()).getUTCFullYear() - 1970);
      bDateOut += ` (${age} th)`;
    } catch (_) { }
  }
  document.getElementById('profBirth').textContent = bDateOut;
}

/* =====================================================
 * LOAD RIWAYAT
 * ===================================================== */
async function loadMonitoringHistory(memberId) {
  const container = document.getElementById('historyList');
  container.innerHTML = '<div class="empty-state">Memuat riwayat…</div>';
  _historyCache = [];

  try {
    const { data, error } = await supabaseClient
      .from('monitoring_atlet')
      .select('id,bulan,tahun,rata_rata_total,sistem_utama,vo2max,catatan_pelatih,data_b1,data_b2,data_b3,data_b4')
      .eq('member_id', memberId)
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false });

    if (error) throw error;
    _historyCache = data || [];

    if (!_historyCache.length) {
      container.innerHTML = '<div class="empty-state">Belum ada data monitoring untuk atlet ini.</div>';
      return;
    }

    const { data: presRows } = await supabaseClient
      .from('attendance_detail')
      .select('presence, attendance_header(date)')
      .eq('member_id', memberId);

    const attendanceMap = {};
    if (presRows) {
      presRows.forEach(r => {
        if (!r.attendance_header || !r.attendance_header.date) return;
        const d = new Date(r.attendance_header.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!attendanceMap[key]) attendanceMap[key] = { hadir: 0, total: 0 };
        attendanceMap[key].total++;
        if (r.presence === 'Hadir') attendanceMap[key].hadir++;
      });
    }

    container.innerHTML = _historyCache.map(item => {
      const periode = `${NAMA_BULAN[item.bulan]} ${item.tahun}`;
      const key = `${item.tahun}-${item.bulan}`;
      const att = attendanceMap[key] || { hadir: 0, total: 0 };
      const attPct = att.total > 0 ? (att.hadir / att.total) * 100 : 0;

      const pAvg = item.rata_rata_total || 0;
      const wAbs = _monWeightAbsensi / 100;
      const wPil = 1 - wAbs;
      const score = parseFloat(((pAvg * 20 * wPil) + (attPct * wAbs)).toFixed(1));

      const dataStr = encodeURIComponent(JSON.stringify(item));
      const namaStr = encodeURIComponent(_currentMember.name);
      const savedUrl = _pdfLoad(item.id);
      return `
        <div class="history-card" id="hcard-${item.id}">
          <div class="history-card-info">
            <h4>${periode}</h4>
            <p>Skor Performa: <strong>${score}</strong> | VO₂max: <strong>${item.vo2max || '—'}</strong></p>
            <div class="text-xs text-muted mt-1">
               <span>Pilar: ${pAvg}</span>
               <span class="mx-1">•</span>
               <span>Hadir: ${Math.round(attPct)}%</span>
            </div>
          </div>
          <div class="history-card-actions">
            <button class="btn-gen-pdf"
              onclick="generatePDF('${dataStr}','${namaStr}','${periode}','${item.id}')">📄 Generate</button>
            <button class="btn-view-pdf${savedUrl ? ' ready' : ''}" id="viewbtn-${item.id}"
              ${savedUrl ? `onclick="viewPDF('${item.id}')"` : 'disabled title="Generate PDF terlebih dahulu"'}>👁 View</button>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('loadMonitoringHistory:', err);
    container.innerHTML = '<div class="empty-state" style="color:#dc2626;">Gagal memuat riwayat.</div>';
  }
}

function _getPrevMonitoring(bulan, tahun) {
  const target = tahun * 100 + bulan;
  return _historyCache.find(item => (item.tahun * 100 + item.bulan) < target) || null;
}

/* =====================================================
 * FASE 2 → 3
 * ===================================================== */
async function onStartMonitoring() {
  const msgEl = document.getElementById('phase2-msg');
  const bulan = parseInt(document.getElementById('inputBulan').value);
  const tahun = parseInt(document.getElementById('inputTahun').value);

  if (!bulan || !tahun) { msgEl.textContent = 'Pilih bulan dan tahun terlebih dahulu!'; return; }
  if (tahun < 2020 || tahun > 2099) { msgEl.textContent = 'Tahun tidak valid (2020–2099).'; return; }
  msgEl.textContent = '';

  if (typeof showLoading === 'function') showLoading();
  try {
    const { data: existing, error } = await supabaseClient
      .from('monitoring_atlet').select('*')
      .eq('member_id', _currentMember.id).eq('bulan', bulan).eq('tahun', tahun)
      .maybeSingle();
    if (error) throw error;

    _existingId = existing ? existing.id : null;

    const periode = `${NAMA_BULAN[bulan]} ${tahun}`;
    document.getElementById('formAtletLabel').textContent = _currentMember.name;
    document.getElementById('formPeriodeLabel').textContent = `Periode: ${periode}`;

    if (existing) {
      renderFormPenilaian(existing, null);
      showToastMsg('Data sudah ada — mode Edit aktif.', 'info');
    } else {
      const prev = _getPrevMonitoring(bulan, tahun);
      renderFormPenilaian(null, prev);
      if (prev) showToastMsg(`Nilai dari ${NAMA_BULAN[prev.bulan]} ${prev.tahun} diisi otomatis sebagai referensi.`, 'info');
    }

    _fetchAndRenderAttendanceStats(_currentMember.id, bulan, tahun);

    showPhase(3);

  } catch (err) {
    console.error('onStartMonitoring:', err);
    msgEl.textContent = 'Gagal memeriksa data: ' + err.message;
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}
window.onStartMonitoring = onStartMonitoring;

/* =====================================================
 * RENDER FORM B1–B4
 * ===================================================== */
function renderFormPenilaian(existingData, prefillData) {
  const source = existingData || prefillData;
  const container = document.getElementById('penilaianContainer');

  const nilaiOpts = () => {
    let o = '<option value="">Nilai</option>';
    for (let n = 0.5; n <= 5; n = +(n + 0.5).toFixed(1)) o += `<option value="${n}">${n}</option>`;
    return o;
  };

  let html = '';
  for (const [key, data] of Object.entries(INDIKATOR_DATA)) {
    const pilar = source ? (source[`data_${key}`] || {}) : {};
    html += `<section class="section-card"><div class="section-title m-0 mb-3 text-sm">${data.title}</div>`;

    data.items.forEach((indikator, idx) => {
      const i = idx + 1;
      const fid = `${key}_${i}`;
      const catatan = pilar[`c${i}`] || '';
      const hasCat = catatan.trim().length > 0;

      html += `
        <div class="indikator-row">
          <div class="indikator-label">${i}. ${indikator}</div>
          <div class="indikator-inputs">
            <select id="${fid}_n" class="field" required>${nilaiOpts()}</select>
            <div class="catatan-wrap flex-1 relative">
              <textarea id="${fid}_c" class="field" rows="1"
                placeholder="Catatan (opsional)"
                class="${hasCat ? 'pr-8' : ''}"
                oninput="autoResizeTextarea(this);toggleClearBtn(this,'${fid}_clear')"
              >${escHtml(catatan)}</textarea>
              <button type="button" class="btn-clear-catatan" id="${fid}_clear"
                style="display:${hasCat ? 'flex' : 'none'};"
                onclick="clearField('${fid}_c','${fid}_clear')" title="Hapus catatan">✕</button>
            </div>
          </div>
        </div>`;
    });
    html += '</section>';
  }
  container.innerHTML = html;

  if (source) {
    for (const key of Object.keys(INDIKATOR_DATA)) {
      const pilar = source[`data_${key}`] || {};
      for (let i = 1; i <= 5; i++) {
        const val = pilar[`n${i}`];
        if (val !== null && val !== undefined && val !== '') {
          const sel = document.getElementById(`${key}_${i}_n`);
          if (sel) sel.value = String(val);
        }
      }
    }
    document.getElementById('inputSistem').value = source.sistem_utama || '';
    document.getElementById('inputVo2max').value = source.vo2max || '';

    const catPelatih = existingData ? (existingData.catatan_pelatih || '') : '';
    const elCat = document.getElementById('inputCatatanPelatih');
    elCat.value = catPelatih;
    autoResizeTextarea(elCat);
    _updateCatatanPelatihClearBtn(catPelatih);
  } else {
    document.getElementById('inputSistem').value = '';
    const elCat = document.getElementById('inputCatatanPelatih');
    elCat.value = '';
    autoResizeTextarea(elCat);
    _updateCatatanPelatihClearBtn('');
  }

  setTimeout(() => {
    container.querySelectorAll('textarea').forEach(ta => autoResizeTextarea(ta));
    autoResizeTextarea(document.getElementById('inputCatatanPelatih'));
  }, 0);
}

/* =====================================================
 * FETCH KEHADIRAN UNTUK FORM (PHASE 3)
 * ===================================================== */
async function _fetchAndRenderAttendanceStats(memberId, bulan, tahun) {
  const container = document.getElementById('attendanceCardContainer');
  container.innerHTML = `
    <section class="section-card bg-gray-50 mb-3" style="border-left: 4px solid #64748b;">
      <div class="section-title m-0 text-muted font-bold text-sm">📊 Statistik Kehadiran</div>
      <div class="text-xs text-muted mt-2">Memuat data presensi…</div>
    </section>`;

  try {
    const tBulan = String(bulan).padStart(2, '0');
    const lastDay = new Date(tahun, bulan, 0).getDate();
    const dateFrom = `${tahun}-${tBulan}-01`;
    const dateTo = `${tahun}-${tBulan}-${lastDay}`;

    const { data: rows, error } = await supabaseClient
      .from('attendance_detail')
      .select('presence, attendance_header!inner(date)')
      .eq('member_id', memberId)
      .gte('attendance_header.date', dateFrom)
      .lte('attendance_header.date', dateTo);

    if (error) throw error;

    let statusHtml = '';
    if (!rows || rows.length === 0) {
      statusHtml = `<div class="font-bold text-danger text-base">Belum tercatat</div>
                    <div class="text-xs text-muted mt-1">Tidak ditemukan data presensi di periode ini.</div>`;
    } else {
      const total = rows.length;
      const hadir = rows.filter(r => r.presence === 'Hadir').length;
      const pct = Math.round((hadir / total) * 100);
      statusHtml = `
        <div class="flex items-baseline gap-2">
          <div class="font-extrabold text-main text-xl">${hadir}/${total}</div>
          <div class="text-xs text-muted font-bold">Sesi Terdiikuti</div>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full" style="width:${pct}%; background:${pct >= 75 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626'};"></div>
          </div>
          <div class="font-bold text-sm" style="color:${pct >= 75 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626'};">${pct}%</div>
        </div>`;
    }

    container.innerHTML = `
      <section class="section-card bg-white shadow-sm mb-3" style="border-left: 4px solid #1590df;">
        <div class="section-title m-0 text-main text-sm flex justify-between">
          <span>📊 Statistik Kehadiran</span>
        </div>
        <div class="mt-3">${statusHtml}</div>
      </section>`;

  } catch (err) {
    console.error('_fetchAndRenderAttendanceStats:', err);
    container.innerHTML = `
      <section class="section-card bg-red-50 mb-3" style="border-left: 4px solid #dc2626;">
        <div class="section-title m-0 text-danger text-sm">📊 Statistik Kehadiran</div>
        <div class="text-xs text-danger mt-2">Gagal memuat: ${err.message}</div>
      </section>`;
  }
}

/* =====================================================
 * AUTO-RESIZE & CLEAR BTN HELPERS
 * ===================================================== */
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
window.autoResizeTextarea = autoResizeTextarea;

function toggleClearBtn(textarea, clearId) {
  const btn = document.getElementById(clearId);
  if (!btn) return;
  const hasVal = textarea.value.trim().length > 0;
  btn.style.display = hasVal ? 'flex' : 'none';
  textarea.style.paddingRight = hasVal ? '34px' : '8px';
}
window.toggleClearBtn = toggleClearBtn;

function clearField(textareaId, clearId) {
  const ta = document.getElementById(textareaId);
  const btn = document.getElementById(clearId);
  if (ta) { ta.value = ''; autoResizeTextarea(ta); ta.style.paddingRight = '8px'; }
  if (btn) btn.style.display = 'none';
}
window.clearField = clearField;

function _updateCatatanPelatihClearBtn(val) {
  const btn = document.getElementById('btnClearCatatanPelatih');
  if (btn) btn.style.display = val.trim().length > 0 ? 'flex' : 'none';
}
window._updateCatatanPelatihClearBtn = _updateCatatanPelatihClearBtn;

function clearCatatanPelatih() {
  const ta = document.getElementById('inputCatatanPelatih');
  ta.value = ''; autoResizeTextarea(ta); _updateCatatanPelatihClearBtn('');
}
window.clearCatatanPelatih = clearCatatanPelatih;

/* =====================================================
 * SUBMIT
 * ===================================================== */
async function submitMonitoring(e) {
  e.preventDefault();
  const bulan = parseInt(document.getElementById('inputBulan').value);
  const tahun = parseInt(document.getElementById('inputTahun').value);
  const activity_id = document.getElementById('filterKegiatan').value || null;

  if (typeof showLoading === 'function') showLoading();

  function extractPilar(prefix) {
    const r = {}; let total = 0, count = 0;
    for (let i = 1; i <= 5; i++) {
      const n = parseFloat(document.getElementById(`${prefix}_${i}_n`)?.value);
      const c = document.getElementById(`${prefix}_${i}_c`)?.value?.trim() || '';
      r[`n${i}`] = isNaN(n) ? null : n;
      r[`c${i}`] = c;
      if (!isNaN(n) && n) { total += n; count++; }
    }
    r.rata_rata = count > 0 ? parseFloat((total / count).toFixed(2)) : 0;
    return r;
  }

  const data_b1 = extractPilar('b1'), data_b2 = extractPilar('b2'),
    data_b3 = extractPilar('b3'), data_b4 = extractPilar('b4');

  const pAvg = parseFloat(
    ((data_b1.rata_rata + data_b2.rata_rata + data_b3.rata_rata + data_b4.rata_rata) / 4).toFixed(2)
  );

  const rata_rata_total = pAvg;

  const payload = {
    member_id: _currentMember.id, activity_id, bulan, tahun,
    sistem_utama: document.getElementById('inputSistem').value.trim(),
    vo2max: parseFloat(document.getElementById('inputVo2max').value) || null,
    catatan_pelatih: document.getElementById('inputCatatanPelatih').value.trim(),
    data_b1, data_b2, data_b3, data_b4, rata_rata_total
  };

  try {
    let error;
    if (_existingId) {
      ({ error } = await supabaseClient.from('monitoring_atlet').update(payload).eq('id', _existingId));
    } else {
      ({ error } = await supabaseClient.from('monitoring_atlet').insert([payload]));
    }
    if (error) {
      if (error.code === '23505') throw new Error('Data bulan & tahun ini sudah ada untuk atlet tersebut!');
      throw error;
    }
    showToastMsg('Data monitoring berhasil disimpan! 🎉', 'success');
    if (_existingId) _pdfDel(_existingId);

    resetToPhase1();
  } catch (err) {
    console.error('submitMonitoring:', err);
    showToastMsg(err.message || 'Gagal menyimpan data.', 'error');
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}
window.submitMonitoring = submitMonitoring;

/* =====================================================
 * PDF — Persistent localStorage helpers
 * ===================================================== */
const _PDF_LS_PREFIX = 'mon_pdf_';
const _pdfSave = (id, url) => { try { localStorage.setItem(_PDF_LS_PREFIX + id, url); } catch (_) { } };
const _pdfLoad = (id) => { try { return localStorage.getItem(_PDF_LS_PREFIX + id) || ''; } catch (_) { return ''; } };
const _pdfDel = (id) => { try { localStorage.removeItem(_PDF_LS_PREFIX + id); } catch (_) { } };

function _showPdfOverlay() {
  document.getElementById('pdfOverlay').classList.add('show');
}
function _hidePdfOverlay() {
  document.getElementById('pdfOverlay').classList.remove('show');
}

async function generatePDF(dataStringEncoded, namaEncoded, periode, itemId) {
  const item = JSON.parse(decodeURIComponent(dataStringEncoded));
  const namaAtlet = decodeURIComponent(namaEncoded);

  _showPdfOverlay();
  try {
    let kompositScore = item.rata_rata_total || 0;
    let kehadiranStr = 'Lihat Rekap Absen';
    try {
      const tBulan = String(item.bulan).padStart(2, '0');
      const tTahun = item.tahun;
      const lastDay = new Date(tTahun, item.bulan, 0).getDate();
      const dateFrom = `${tTahun}-${tBulan}-01`;
      const dateTo = `${tTahun}-${tBulan}-${lastDay}`;

      const { data: presRows, error: presErr } = await supabaseClient
        .from('attendance_detail')
        .select('presence, attendance_header!inner(date)')
        .eq('member_id', _currentMember.id)
        .gte('attendance_header.date', dateFrom)
        .lte('attendance_header.date', dateTo);

      if (presErr) {
        console.warn('[generatePDF] attendance_detail error:', presErr.message);
        kehadiranStr = 'Lihat Rekap Absen';
      } else if (!presRows || presRows.length === 0) {
        console.warn('[generatePDF] attendance_detail: 0 baris ditemukan');
        kehadiranStr = 'Belum tercatat';
      } else {
        const total = presRows.length;
        const hadir = presRows.filter(r => r.presence === 'Hadir').length;
        const pct = Math.round((hadir / total) * 100);
        kehadiranStr = `${hadir}/${total} sesi (${pct}% hadir)`;

        const pAvg = item.rata_rata_total || 0;
        const wAbs = _monWeightAbsensi / 100;
        const wPil = 1 - wAbs;
        kompositScore = parseFloat(((pAvg * 20 * wPil) + (pct * wAbs)).toFixed(1));
      }
    } catch (presEx) {
      console.error('[generatePDF] attendance fetch threw exception:', presEx);
      kehadiranStr = 'Lihat Rekap Absen';
    }

    const payload = {
      nama_atlet: namaAtlet,
      periode,
      kehadiran: kehadiranStr,
      sistem_utama: item.sistem_utama || '',
      rata_rata_total: kompositScore,
      catatan_pelatih: item.catatan_pelatih || '',
      b1: item.data_b1 || null,
      b2: item.data_b2 || null,
      b3: item.data_b3 || null,
      b4: item.data_b4 || null,
    };

    console.log('[generatePDF] payload →', JSON.stringify(payload, null, 2));

    const response = await apiPost('generateMonitoringPDF', payload);

    const url = response?.pdfUrl || response?.pdf_url;
    if (!url) throw new Error('Gagal mendapatkan link PDF dari server.');

    _pdfSave(itemId, url);

    const viewBtn = document.getElementById(`viewbtn-${itemId}`);
    if (viewBtn) {
      viewBtn.classList.add('ready');
      viewBtn.removeAttribute('disabled');
      viewBtn.title = '';
      viewBtn.setAttribute('onclick', `viewPDF('${itemId}')`);
    }
    showToastMsg('PDF berhasil dibuat! Klik tombol View untuk membuka.', 'success');

  } catch (err) {
    console.error('generatePDF:', err);
    showToastMsg('Gagal membuat PDF: ' + err.message, 'error');
  } finally {
    _hidePdfOverlay();
  }
}
window.generatePDF = generatePDF;

function viewPDF(itemId) {
  const url = _pdfLoad(itemId);
  if (url) window.open(url, '_blank');
  else showToastMsg('URL tidak ditemukan, silakan generate ulang PDF.', 'error');
}
window.viewPDF = viewPDF;

let _currentPhase = 1;

function showPhase(n) {
  _currentPhase = n;
  document.getElementById('phase-select').style.display = n === 1 ? 'block' : 'none';
  document.getElementById('phase-profile').style.display = n === 2 ? 'block' : 'none';
  document.getElementById('phase-form').style.display = n === 3 ? 'block' : 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showPhase = showPhase;

function handleBack() {
  if (_currentPhase > 1) { resetToPhase1(); }
  else { window.location.href = 'index.html'; }
}
window.handleBack = handleBack;

function resetToPhase1() {
  _currentMember = null; _existingId = null; _historyCache = [];
  localStorage.removeItem('mon_last_member');
  showPhase(1);
  updateMonStatusTable();
}
window.resetToPhase1 = resetToPhase1;

function resetToPhase2() {
  _existingId = null;
  document.getElementById('inputBulan').value = new Date().getMonth() + 1;
  document.getElementById('inputTahun').value = new Date().getFullYear();
  document.getElementById('phase2-msg').textContent = '';
  showPhase(2);
}
window.resetToPhase2 = resetToPhase2;

/* =====================================================
 * HELPER
 * ===================================================== */
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToastMsg(msg, type) {
  const toast = document.getElementById('toast');
  if (!toast) { alert(msg); return; }
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.style.background = type === 'error' ? '#dc2626' : type === 'info' ? '#0369a1' : '#16a34a';
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => { toast.style.display = 'none'; toast.style.opacity = '1'; }, 400);
  }, 3500);
}
window.showToastMsg = showToastMsg;
