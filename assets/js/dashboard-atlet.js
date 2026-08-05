/**
 * Gabku App - Dashboard Atlet Module
 * Encapsulated JS logic for dashboard-atlet.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  await requireLogin();
  initAthleteDashboard();
});

async function initAthleteDashboard() {
  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  if (!userMeta.member_id) {
    alert("Akun Anda belum dihubungkan ke data anggota. Silakan hubungi Admin.");
    return;
  }

  document.getElementById('welcomeMsg').textContent = `Halo, ${userMeta.full_name.split(' ')[0]}! 👋`;
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('pillarStats').innerHTML = ['b1', 'b2', 'b3', 'b4'].map(k => {
    const lbl = (k === 'b1') ? 'Bidding' : (k === 'b2') ? 'Play' : (k === 'b3') ? 'Defense' : 'Mental';
    return `
      <div class="pillar-mini">
        <div class="text-xs font-bold text-muted">B${k.slice(1)}. ${lbl}</div>
        <div class="pillar-bar"><div id="p-${k}" class="pillar-fill" style="width: 0%"></div></div>
        <div id="v-${k}" class="text-sm font-bold mt-1">0.0</div>
      </div>`;
  }).join('');

  try {
    const memberId = userMeta.member_id;

    const [{ data: settings }, { data: allPresence }] = await Promise.all([
      supabaseClient.from('settings').select('*'),
      supabaseClient.from('attendance_detail')
        .select('presence, attendance_header!inner(date)')
        .eq('member_id', memberId)
    ]);

    let weightAbsensiSetting = 30;
    let pointMultiplier = 10000;
    if (settings) {
      const wRow = settings.find(r => r.setting_key === 'monitoring_weight_absensi');
      if (wRow) weightAbsensiSetting = parseInt(wRow.setting_value) || 30;
      const pRow = settings.find(r => r.setting_key === 'attendance_points');
      if (pRow) pointMultiplier = parseInt(pRow.setting_value) || 10000;
    }

    const attendanceMap = {};
    const totalSessionsMap = {};

    if (allPresence && allPresence.length > 0) {
      allPresence.forEach(row => {
        const dt = row.attendance_header?.date;
        if (!dt) return;
        const pts = dt.split('-');
        const key = `${parseInt(pts[0])}-${parseInt(pts[1])}`;

        totalSessionsMap[key] = (totalSessionsMap[key] || 0) + 1;
        if (row.presence === 'Hadir') {
          attendanceMap[key] = (attendanceMap[key] || 0) + 1;
        }
      });
    }

    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const curHadir = attendanceMap[currentKey] || 0;
    const curTotal = totalSessionsMap[currentKey] || 0;
    document.getElementById('myAttendance').textContent = curTotal > 0 ? Math.round((curHadir / curTotal) * 100) + '%' : '0%';
    document.getElementById('myAttendanceDetail').textContent = `${curHadir}/${curTotal} Sesi • Bulan Ini`;

    const { data: monData } = await supabaseClient
      .from('monitoring_atlet')
      .select('*')
      .eq('member_id', memberId)
      .order('tahun', { ascending: true })
      .order('bulan', { ascending: true });

    if (monData && monData.length > 0) {
      monData.forEach(item => {
        const key = `${item.tahun}-${item.bulan}`;
        item.hadir_count = attendanceMap[key] || 0;
        item.total_sesi = totalSessionsMap[key] || 0;
        item._pointMultiplier = pointMultiplier;

        let pAvg = item.rata_rata_total || 0;
        let pilarNorm = pAvg * 20;

        if (pAvg > 5) {
          pilarNorm = pAvg;
          item.rata_rata_total = parseFloat((pAvg / 20).toFixed(2));
        }

        const attendancePct = item.total_sesi > 0 ? (item.hadir_count / item.total_sesi) * 100 : 0;

        const wPilar = 1 - (weightAbsensiSetting / 100);
        const wAbsen = weightAbsensiSetting / 100;

        item.skor_performa_total = parseFloat(((pilarNorm * wPilar) + (attendancePct * wAbsen)).toFixed(1));
      });

      const last = monData[monData.length - 1];
      document.getElementById('myScore').textContent = last.skor_performa_total.toFixed(1);
      document.getElementById('myScoreDetail').textContent = `Periode ${NB[last.bulan]} ${last.tahun}`;

      updatePillar('b1', last.data_b1?.rata_rata || 0);
      updatePillar('b2', last.data_b2?.rata_rata || 0);
      updatePillar('b3', last.data_b3?.rata_rata || 0);
      updatePillar('b4', last.data_b4?.rata_rata || 0);

      _lastData = monData;
      document.getElementById('countPill').textContent = monData.length + ' data';
      renderMainChart(monData);
      renderMonitoringList(monData);
    }

  } catch (e) {
    console.error("Athlete Dashboard Error:", e);
  }
}

let _chartInst = null, _pilarChartInst = null, _fisikChartInst = null;
let _activePilarKey = null, _activeFisikKey = null, _lastData = [];

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const PILAR_COLORS = { b1: '#3b82f6', b2: '#10b981', b3: '#f59e0b', b4: '#8b5cf6', hadir: '#0891b2', vo2max: '#10b981' };

function renderMainChart(data) {
  if (_chartInst) { _chartInst.destroy(); _chartInst = null; }
  const labels = data.map(d => `${NB[d.bulan].slice(0, 3)} '${String(d.tahun).slice(-2)}`);
  const scores = data.map(d => d.skor_performa_total);

  const ctx = document.getElementById('trendChart').getContext('2d');
  _chartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Indeks Performa',
        data: scores,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { stepSize: 20, font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

function togglePilarChart(key, btnEl) {
  const area = document.getElementById('pilarChartArea');
  const allBtns = btnEl.closest('.pilar-tab-row').querySelectorAll('.pilar-tab-btn');
  if (_activePilarKey === key) {
    _activePilarKey = null; area.classList.remove('open');
    allBtns.forEach(b => b.classList.remove('active'));
    return;
  }
  _activePilarKey = key;
  allBtns.forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  area.classList.add('open');
  renderSubChart(key, _lastData, 'pilarChart', (inst) => _pilarChartInst = inst);
}
window.togglePilarChart = togglePilarChart;

function toggleFisikChart(key, btnEl) {
  const area = document.getElementById('fisikChartArea');
  const allBtns = btnEl.closest('.pilar-tab-row').querySelectorAll('.pilar-tab-btn');
  if (_activeFisikKey === key) {
    _activeFisikKey = null; area.classList.remove('open');
    allBtns.forEach(b => b.classList.remove('active'));
    return;
  }
  _activeFisikKey = key;
  allBtns.forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  area.classList.add('open');
  renderSubChart(key, _lastData, 'fisikChart', (inst) => _fisikChartInst = inst);
}
window.toggleFisikChart = toggleFisikChart;

function renderSubChart(key, data, canvasId, setInst) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = data.map(d => `${NB[d.bulan].slice(0, 3)} '${String(d.tahun).slice(-2)}`);
  let vals = [];
  let tooltips = [];

  if (key === 'hadir') {
    vals = data.map(d => d.hadir_count || 0);
    tooltips = data.map(d => `${d.hadir_count || 0}/${d.total_sesi || 0} Sesi`);
  } else if (key === 'vo2max') {
    vals = data.map(d => d.vo2max || 0);
  } else {
    vals = data.map(d => d[`data_${key}`]?.rata_rata || 0);
  }

  const isFisikScale = key === 'vo2max';
  const isFiveScale = (key.startsWith('b') && key !== 'vo2max');

  let yMax = undefined;
  if (isFiveScale) yMax = 5;
  else if (key === 'hadir') {
    const maxSesi = Math.max(...data.map(d => d.total_sesi || 0));
    yMax = maxSesi > 0 ? maxSesi + 1 : 5;
  }

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: key.toUpperCase(),
        data: vals,
        borderColor: PILAR_COLORS[key],
        backgroundColor: PILAR_COLORS[key] + '22',
        borderWidth: 2, fill: true, tension: 0.3, pointRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (key === 'hadir') return ` Kehadiran: ${tooltips[context.dataIndex]}`;
              return ` Nilai: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: yMax,
          ticks: {
            stepSize: key === 'hadir' ? 1 : undefined,
            font: { size: 9 }
          }
        },
        x: { ticks: { font: { size: 9 } } }
      }
    }
  };

  if (canvasId === 'pilarChart' && _pilarChartInst) _pilarChartInst.destroy();
  if (canvasId === 'fisikChart' && _fisikChartInst) _fisikChartInst.destroy();

  const newInst = new Chart(ctx, config);
  setInst(newInst);
}

function updatePillar(id, val) {
  const pct = Math.min((val / 5) * 100, 100);
  document.getElementById(`p-${id}`).style.width = pct + '%';
  document.getElementById(`v-${id}`).textContent = val.toFixed(1);
}

const NB = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const PILAR_LABEL = { b1: 'Bidding', b2: 'Play (Declarer)', b3: 'Defense', b4: 'Mental & Kemitraan' };
const PILAR_ITEMS = {
  b1: ['Akurasi Penentuan Kontrak', 'Pemahaman Sistem & Konvensi', 'Konsistensi Interpretasi Bid', 'Kepatuhan Sistem & Kesepakatan', 'Penanganan Bid Kompetitif & Preemp'],
  b2: ['Perencanaan Play Awal', 'Teknik Declarer', 'Analisis Peluang & Distribusi', 'Timing & Entry Management', 'Konsistensi Rencana Main (Line of Play)'],
  b3: ['Ketepatan Opening Lead', 'Kejelasan Signaling', 'Akurasi Switching & Discard', 'Membaca Permainan Partner', 'Defense Planning (2 trik awal)'],
  b4: ['Konsistensi Fokus & Stamina', 'Respon Papan Buruk', 'Komunikasi & Harmonisasi Partner', 'Manajemen Waktu (Tempo Permainan)', 'Diskusi Pasca Latihan & Error Awareness']
};

function renderMonitoringList(dataList, showAll = false) {
  const container = document.getElementById('latestDetailContainer');
  const btnContainer = document.getElementById('loadMoreContainer');
  document.getElementById('detailSection').style.display = 'block';

  if (!dataList || dataList.length === 0) {
    container.innerHTML = '<div class="text-center p-4 text-muted text-sm">Belum ada data monitoring.</div>';
    btnContainer.style.display = 'none';
    return;
  }

  const sorted = [...dataList].sort((a, b) => (b.tahun * 100 + b.bulan) - (a.tahun * 100 + a.bulan));

  const displayData = showAll ? sorted : sorted.slice(0, 4);
  container.innerHTML = displayData.map(renderMonitoringCard).join('');

  if (!showAll && sorted.length > 4) {
    btnContainer.style.display = 'flex';
  } else {
    btnContainer.style.display = 'none';
  }

  container.querySelectorAll('.mon-card-header').forEach(h =>
    h.addEventListener('click', () => h.closest('.mon-card').classList.toggle('open'))
  );
}
}
window.renderMonitoringList = renderMonitoringList;


function renderMonitoringCard(item) {
  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  const namaAtlet = userMeta.full_name || 'Atlet';
  const inisial = namaAtlet.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const periode = `${NB[item.bulan]} ${item.tahun}`;
  const compositeScore = item.skor_performa_total || 0;
  const _pointMultiplier = item._pointMultiplier || 10000;
  const totalPoints = (item.hadir_count || 0) * _pointMultiplier;
  const cls = compositeScore >= 80 ? 'good' : compositeScore >= 60 ? 'mid' : 'low';
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
        <div class="meta-icon" style="color:#ef4444; background:#fef2f2;"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>
        <div class="meta-info">
          <div class="meta-label">VO₂max</div>
          <div class="meta-value">${item.vo2max || '—'}</div>
        </div>
      </div>
      <div class="meta-card" style="background: #f0fdf4; border-color: #bbf7d0;">
        <div class="meta-icon" style="color:#16a34a; background:#fff;"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87l6.91-1.01L12 2z"/></svg></div>
        <div class="meta-info">
          <div class="meta-label">Nilai Akumulasi</div>
          <div class="meta-value">${compositeScore.toFixed(1)}</div>
        </div>
      </div>
    </div>
  `;

  let detailHtml = '';
  ['b1', 'b2', 'b3', 'b4'].forEach(k => {
    const d = item[`data_${k}`] || {};
    const rows = PILAR_ITEMS[k].map((lbl, idx) => {
      const i = idx + 1;
      return `<tr>
          <td>${i}. ${lbl}</td>
          <td class="font-bold text-center">${d[`n${i}`] ?? '—'}</td>
        </tr>`;
    }).join('');
    detailHtml += `<div class="pilar-section-title">B${k.slice(1)}. ${PILAR_LABEL[k]} — rata-rata ${d.rata_rata ?? '?'}</div>
      <div class="detail-table-wrapper">
        <table class="detail-table">
          <thead>
            <tr>
              <th class="col-ind">Indikator</th>
              <th class="col-val text-center">Nilai</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  });

  const catBox = item.catatan_pelatih
    ? `<div class="note-box"><strong>💬 Catatan Pelatih:</strong><br>${escHtml(item.catatan_pelatih)}</div>` : '';

  return `
    <div class="mon-card" id="card-${item.id}">
      <div class="mon-card-header">
        <div class="mon-avatar">${inisial}</div>
        <div class="mon-info">
          <div class="mon-name">${periode}</div>
          <div class="mon-periode">Monitoring Perkembangan</div>
        </div>
        <span class="score-badge-main ${cls}">⭐ ${item.rata_rata_total?.toFixed(1) || '—'}</span>
        <span class="chevron">▼</span>
      </div>
      <div class="mon-card-body">
        <div class="mon-card-inner">
          ${itemGrid}
          ${detailHtml}
          ${catBox}
          <div class="meta-timestamp mt-4">
            <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.1.8-1.2-4.5-2.7V7z"/></svg>
            Dibuat pada: ${createdDate}
          </div>
        </div>
      </div>
    </div>`;
}
}

