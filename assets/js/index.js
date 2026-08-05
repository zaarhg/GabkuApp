/**
 * Gabku App - Main Dashboard Module
 * Encapsulated JS logic for index.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  await requireLogin();
  initDashboard();
  updateBadges();
});

async function updateBadges() {
  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  if (userMeta.role !== 'admin') return;

  try {
    const { count, error } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Menunggu');

    if (error) throw error;

    const navB = document.getElementById('navBadge');
    const menuB = document.getElementById('userMenuBadge');

    if (count > 0) {
      if (navB) { navB.textContent = count; navB.style.display = 'flex'; }
      if (menuB) { menuB.textContent = count; menuB.style.display = 'flex'; }
    } else {
      if (navB) navB.style.display = 'none';
      if (menuB) menuB.style.display = 'none';
    }
  } catch (e) {
    console.error("Gagal update badge:", e);
  }
}

function openManajemen() {
  const modal = document.getElementById('modalManajemen');
  if (modal) modal.classList.add('show');
}
window.openManajemen = openManajemen;

function closeManajemen() {
  const modal = document.getElementById('modalManajemen');
  if (!modal) return;
  const card = modal.querySelector('.modal-card');
  if (card) card.style.transform = '';
  modal.classList.remove('show');
}
window.closeManajemen = closeManajemen;

// SWIPE TO DISMISS LOGIC
let startY = 0;
let currentY = 0;
let isDragging = false;

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modalManajemen');
  if (!modal) return;
  const card = modal.querySelector('.modal-card');
  if (!card) return;

  card.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    isDragging = true;
    card.style.transition = 'none';
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      card.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  card.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentY - startY;
    card.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    if (diff > 120) {
      closeManajemen();
    } else {
      card.style.transform = 'translateY(0)';
    }
    startY = 0;
    currentY = 0;
  });
});

async function initDashboard() {
  // 0. Update Date
  const dOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('id-ID', dOptions);

  // 1. Welcome User
  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  if (userMeta.email) {
    const namePart = userMeta.email.split('@')[0].replace(/[._]/g, ' ');
    document.getElementById('welcomeUser').textContent = 'Halo, ' + (namePart.charAt(0).toUpperCase() + namePart.slice(1));
  }

  const now = new Date();
  try {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lmBulan = lastMonthDate.getMonth() + 1;
    const lmTahun = lastMonthDate.getFullYear();
    const lmFirst = lastMonthDate.toISOString().split('T')[0];
    const lmLast = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const { data: memberList } = await supabaseClient.from('members').select('id, name');
    const memberMap = {};
    if (memberList) memberList.forEach(m => memberMap[m.id] = m.name);

    const { data: settings } = await supabaseClient.from('app_settings').select('*').eq('setting_key', 'dashboard_activity').single();
    const featName = settings ? settings.setting_value : '';

    const { data: presRows } = await supabaseClient
      .from('attendance_detail')
      .select('member_id, presence, attendance_header!inner(id, date, activity_name_snapshot, location_snapshot)')
      .gte('attendance_header.date', firstDay);

    if (presRows && presRows.length > 0) {
      const total = presRows.length;
      const hadir = presRows.filter(r => r.presence === 'Hadir').length;
      document.getElementById('statAttendance').textContent = Math.round((hadir / total) * 100) + '%';

      const absRecap = {};
      presRows.forEach(r => {
        if (r.presence === 'Hadir') {
          absRecap[r.member_id] = (absRecap[r.member_id] || 0) + 1;
        }
      });
      const topAbs = Object.entries(absRecap)
        .map(([id, count]) => ({ id, name: memberMap[id] || 'Anon', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      renderLeaderboard('listTopPresensi', topAbs, 'hadir');

      if (featName) {
        const featRows = presRows.filter(r => {
          const name = r.attendance_header.activity_name_snapshot;
          return name === featName || name.startsWith(featName + ' - ');
        });
        if (featRows.length > 0) {
          const featHeaderIds = [...new Set(featRows.map(r => r.attendance_header.date))];
          const featHadir = featRows.filter(r => r.presence === 'Hadir').length;
          document.getElementById('featuredCard').style.display = 'block';
          document.getElementById('featuredName').textContent = featName;
          document.getElementById('featuredSessions').textContent = featHeaderIds.length;
          document.getElementById('featuredPct').textContent = Math.round((featHadir / featRows.length) * 100) + '%';
        }
      }

      const allSessionDates = [...new Set(presRows.map(r => r.attendance_header.date))];
      const actualSessions = allSessionDates.length;
      const targetSessions = Math.floor(now.getDate() / 2);
      document.getElementById('statSessions').innerHTML = `${actualSessions} <small style="font-size: 12px; opacity: 0.6; font-weight: 600;">(dari target ${targetSessions})</small>`;

      const headers = [...new Set(presRows.map(r => r.attendance_header.id))];
      const lastHeaderId = headers.sort((a, b) => {
        const dateA = presRows.find(r => r.attendance_header.id === a).attendance_header.date;
        const dateB = presRows.find(r => r.attendance_header.id === b).attendance_header.date;
        return new Date(dateB) - new Date(dateA);
      })[0];

      if (lastHeaderId) {
        const lastRowSmp = presRows.filter(r => r.attendance_header.id === lastHeaderId);
        const headerInfo = lastRowSmp[0].attendance_header;
        const totalL = lastRowSmp.length;
        const hadirL = lastRowSmp.filter(r => r.presence === 'Hadir').length;

        document.getElementById('lastActivityCard').style.display = 'block';
        document.getElementById('lastActName').textContent = headerInfo.activity_name_snapshot || 'Kegiatan';
        document.getElementById('lastActDate').textContent = new Date(headerInfo.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        document.getElementById('lastActLoc').innerHTML = `<em>${headerInfo.location_snapshot || 'Tanpa Lokasi'}</em>`;
        document.getElementById('lastActPresence').textContent = `${hadirL}/${totalL} (${Math.round((hadirL / totalL) * 100)}%)`;
      }

      const sessionCard = document.getElementById('cardSessions');
      if (actualSessions >= targetSessions) {
        sessionCard.style.borderColor = "#86efac";
        sessionCard.style.backgroundColor = "#f0fdf4";
      } else {
        sessionCard.style.borderColor = "#fca5a5";
        sessionCard.style.backgroundColor = "#fef2f2";
      }
    } else {
      document.getElementById('listTopPresensi').innerHTML = '<p class="text-xs text-muted">Belum ada data bulan ini.</p>';
    }

    const { data: lmPres } = await supabaseClient
      .from('attendance_detail')
      .select('member_id')
      .eq('presence', 'Hadir')
      .gte('attendance_header.date', lmFirst)
      .lte('attendance_header.date', lmLast);

    const attendedLM = [...new Set(lmPres?.map(r => r.member_id) || [])];

    const { data: lmMonCount } = await supabaseClient
      .from('monitoring_atlet')
      .select('member_id')
      .eq('bulan', lmBulan)
      .eq('tahun', lmTahun);

    const monitoredLMCount = [...new Set(lmMonCount?.map(r => r.member_id) || [])];

    const notMonitored = attendedLM.filter(id => !monitoredLMCount.includes(id));
    const elStatMonLM = document.getElementById('statMonLastMonth');
    if (elStatMonLM) elStatMonLM.textContent = notMonitored.length;

    const { data: setRows } = await supabaseClient.from('settings').select('key, value');
    const weightRow = setRows?.find(r => r.key === 'monitoring_weight_absensi');
    const weightAbs = weightRow ? parseFloat(weightRow.value) : 30;

    const { data: lmPresDetails } = await supabaseClient
      .from('attendance_detail')
      .select('member_id, presence, attendance_header(date)')
      .gte('attendance_header.date', lmFirst)
      .lte('attendance_header.date', lmLast);

    const lmAttendanceMap = {};
    const lmTotalSessionsMap = {};
    if (lmPresDetails) {
      lmPresDetails.forEach(r => {
        const h = r.attendance_header;
        if (!h) return;
        lmTotalSessionsMap[r.member_id] = (lmTotalSessionsMap[r.member_id] || 0) + 1;
        if (r.presence === 'Hadir') {
          lmAttendanceMap[r.member_id] = (lmAttendanceMap[r.member_id] || 0) + 1;
        }
      });
    }

    const { data: monRows } = await supabaseClient
      .from('monitoring_atlet')
      .select('member_id, rata_rata_total, data_b1, data_b2, data_b3, data_b4')
      .eq('bulan', lmBulan)
      .eq('tahun', lmTahun);

    if (monRows && monRows.length > 0) {
      let sumWeighted = 0, sumB1 = 0, sumB2 = 0, sumB3 = 0, sumB4 = 0;

      monRows.forEach(r => {
        let pAvg = r.rata_rata_total || 0;
        if (pAvg > 5) pAvg = pAvg / 20;

        const techScore = pAvg * 20;

        const hadir = lmAttendanceMap[r.member_id] || 0;
        const total = lmTotalSessionsMap[r.member_id] || 0;
        const absPct = total > 0 ? (hadir / total) * 100 : 0;

        const weightedScore = (techScore * (1 - weightAbs / 100)) + (absPct * (weightAbs / 100));
        sumWeighted += weightedScore;

        sumB1 += r.data_b1?.rata_rata || pAvg;
        sumB2 += r.data_b2?.rata_rata || pAvg;
        sumB3 += r.data_b3?.rata_rata || pAvg;
        sumB4 += r.data_b4?.rata_rata || pAvg;

        r._calculated_score = weightedScore;
      });

      const count = monRows.length;
      const elStatMon = document.getElementById('statMonitoring');
      if (elStatMon) elStatMon.textContent = (sumWeighted / count).toFixed(1);
      updatePillar('b1', (sumB1 / count).toFixed(1));
      updatePillar('b2', (sumB2 / count).toFixed(1));
      updatePillar('b3', (sumB3 / count).toFixed(1));
      updatePillar('b4', (sumB4 / count).toFixed(1));

      const topMon = monRows
        .map(r => ({ name: memberMap[r.member_id] || 'Anon', score: r._calculated_score.toFixed(1) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      renderLeaderboard('listTopMonitoring', topMon, 'skor');
    } else {
      const elTopMon = document.getElementById('listTopMonitoring');
      if (elTopMon) elTopMon.innerHTML = '<p class="text-xs text-muted">Belum ada monitoring bulan ini.</p>';
    }
  } catch (e) {
    console.error('initDashboard Error:', e);
  }
}

function renderLeaderboard(targetId, data, type) {
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!data.length) {
    el.innerHTML = '<p class="text-xs text-muted">Data tidak tersedia.</p>';
    return;
  }
  el.innerHTML = data.map((item, i) => `
    <div class="leader-item">
      <div class="leader-rank rank-${i + 1}">${i + 1}</div>
      <div class="init-avatar">${item.name.charAt(0)}</div>
      <div class="leader-info">
        <div class="leader-name">${item.name}</div>
        <div class="leader-val">${type === 'hadir' ? item.count + ' Hadir' : 'Skor ' + item.score}</div>
      </div>
    </div>
  `).join('');
}

function updatePillar(id, val) {
  const elVal = document.getElementById(`pilar-${id}-val`);
  const elFill = document.getElementById(`pilar-${id}-fill`);
  if (elVal) elVal.textContent = val;
  const pct = Math.min((val / 5) * 100, 100);
  if (elFill) elFill.style.width = pct + '%';
}

