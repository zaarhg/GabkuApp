/**
 * Gabku App - Presensi Module
 * Encapsulated JS logic for attendance recording & editing (presensi.html)
 */

let editId = null;
let isEditMode = false;

(async () => {
  await requireLogin();
  const params = new URLSearchParams(window.location.search);
  editId = params.get('edit');
  if (editId) isEditMode = true;
  init();
})();

const activitySel = document.getElementById("activity");
const dateEl = document.getElementById("date");
const msgEl = document.getElementById("msg");
const photoPreview = document.getElementById("photoPreview");

const timeSel = document.getElementById("timeSel");
const locSel = document.getElementById("locationSel");
const saveBtn = document.getElementById("saveBtn");

let activitiesCache = [];
let membersCache = [];
let participants = [];
let photoB64 = [];

window.toggleManualInput = (type) => {
  if (type === 'time') {
    document.getElementById('timeManual').style.display = timeSel.value === 'Lainnya' ? 'grid' : 'none';
  } else if (type === 'location') {
    document.getElementById('locationManual').style.display = locSel.value === 'Lainnya' ? 'block' : 'none';
  }
};

window.checkFormReady = () => {
  msgEl.textContent = "";

  let ready = true;
  if (!activitySel.value) ready = false;
  if (!dateEl.value) ready = false;

  if (timeSel.value === 'Lainnya') {
    if (!document.getElementById("timeStartManual").value || !document.getElementById("timeEndManual").value) ready = false;
  } else if (!timeSel.value) ready = false;

  if (locSel.value === 'Lainnya') {
    if (!document.getElementById("locationManual").value.trim()) ready = false;
  } else if (!locSel.value) ready = false;

  if (!participants.length) ready = false;

  const removeErr = el => { if (el) { el.style.borderColor = ""; el.style.backgroundColor = ""; } };
  const setErr = el => { if (el) { el.style.borderColor = "#fca5a5"; el.style.backgroundColor = "#fef2f2"; } };

  const tStart = document.getElementById("timeStartManual");
  const tEnd = document.getElementById("timeEndManual");
  const lMan = document.getElementById("locationManual");

  [dateEl, timeSel, tStart, tEnd, locSel, lMan].forEach(removeErr);

  if (activitySel.value) {
    if (!dateEl.value) setErr(dateEl);
    if (timeSel.value === 'Lainnya') {
      if (!tStart.value) setErr(tStart);
      if (!tEnd.value) setErr(tEnd);
    } else if (!timeSel.value) {
      setErr(timeSel);
    }

    if (locSel.value === 'Lainnya') {
      if (!lMan.value.trim()) setErr(lMan);
    } else if (!locSel.value) {
      setErr(locSel);
    }
  }

  if (ready) {
    saveBtn.style.background = "#198cda";
    saveBtn.style.cursor = "pointer";
  } else {
    saveBtn.style.background = "#9ca3af";
    saveBtn.style.cursor = "pointer";
  }
};


/* ── Member Picker untuk Peserta ── */
let _presPickerTemp = new Set();

function openPresensipicker() {
  _presPickerTemp = new Set();
  document.getElementById('presensiPickerSearch').value = '';
  filterPresensiPicker('');
  document.getElementById('memberPickerModal').classList.add('show');
  document.getElementById('presensiPickerSearch').focus();
}
function closePresensipicker() {
  document.getElementById('memberPickerModal').classList.remove('show');
}
function filterPresensiPicker(q) {
  const pool = q.trim()
    ? membersCache.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : membersCache;
  const alreadyIn = new Set(participants.map(p => p.member_id));
  document.getElementById('presensiPickerList').innerHTML = pool.map(m => {
    const inList = alreadyIn.has(m.id);
    const checked = inList || _presPickerTemp.has(m.id);
    return `
      <div class="picker-item${checked ? ' selected' : ''}${inList ? ' disabled' : ''}" onclick="togglePresensipickerItem('${m.id}',this)">
        <div class="picker-check">${checked ? '✓' : ''}</div>
        <div>
          <div class="picker-item-name">${escapeHtml(m.name)}</div>
          <div class="picker-item-role">${escapeHtml(m.role || '')}${inList ? ' · sudah ditambahkan' : ''}</div>
        </div>
      </div>`;
  }).join('');
}
function togglePresensipickerItem(id, el) {
  const alreadyIn = new Set(participants.map(p => p.member_id));
  if (alreadyIn.has(id)) return;
  if (_presPickerTemp.has(id)) { _presPickerTemp.delete(id); }
  else { _presPickerTemp.add(id); }
  el.classList.toggle('selected');
  el.querySelector('.picker-check').textContent = _presPickerTemp.has(id) ? '✓' : '';
}
function confirmPresensipicker() {
  let added = 0;
  _presPickerTemp.forEach(id => {
    const m = membersCache.find(x => x.id === id);
    if (!m || participants.find(p => p.member_id === id)) return;
    participants.push({ member_id: m.id, name: m.name, role: m.role || '', presence: 'Hadir' });
    added++;
  });
  if (added) renderParticipants();
  closePresensipicker();
}
document.getElementById('memberPickerModal').addEventListener('click', e => {
  if (e.target === document.getElementById('memberPickerModal')) closePresensipicker();
});



let hasWarnedTemplateMod = false;
async function checkTemplateWarning(actionDesc, type) {
  if (hasWarnedTemplateMod) return true;
  const selId = activitySel.value;
  if (!selId) return true;
  const act = activitiesCache.find(a => a.id === selId);
  if (!act) return true;

  let shouldWarn = false;
  if (type === 'location' && act.location) shouldWarn = true;
  if (type === 'participant' && act.default_participants && act.default_participants.length > 0) shouldWarn = true;

  if (shouldWarn) {
    const proceed = await asyncConfirm(`Kegiatan ini memiliki template. Yakin ingin ${actionDesc}?`);
    if (proceed) {
      hasWarnedTemplateMod = true;
      return true;
    }
    return false;
  }
  return true;
}

async function init() {
  if (isEditMode) {
    document.querySelector('.app-name').textContent = "Edit Presensi";
    document.querySelector('.app-subtitle').textContent = "Memperbarui riwayat & rekap";
    document.getElementById('saveBtn').innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" style="margin-right:8px"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg> 
      Simpan Perubahan & Update PDF
    `;
  }

  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  dateEl.value = today;
  dateEl.max = today;
  try {
    const { data: acts } = await supabaseClient.from('activities').select('*').eq('is_active', true).order('name');
    activitiesCache = acts || [];

    activitySel.innerHTML = `<option value="">-- pilih --</option>` + activitiesCache.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");

    const { data: mems } = await supabaseClient.from('members').select('*').eq('is_active', true).order('name');
    membersCache = mems;

    const { data: sets } = await supabaseClient.from('app_settings').select('*');
    if (sets) {
      const tRow = sets.find(r => r.setting_key === 'time_options');
      const lRow = sets.find(r => r.setting_key === 'location_options');
      const timeOpts = tRow ? tRow.setting_value : [];
      const locOpts = lRow ? lRow.setting_value : [];

      const tHtml = `<option value="">-- pilih --</option>` + timeOpts.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("") + `<option value="Lainnya">Lainnya...</option>`;
      timeSel.innerHTML = tHtml;

      const lHtml = `<option value="">-- pilih --</option>` + locOpts.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("") + `<option value="Lainnya">Lainnya...</option>`;
      locSel.innerHTML = lHtml;
    }

    const inputsForValidation = [
      activitySel, dateEl,
      document.getElementById('timeStartManual'), document.getElementById('timeEndManual'), document.getElementById('locationManual')
    ];

    inputsForValidation.forEach(inp => {
      if (inp) inp.addEventListener('change', checkFormReady);
      if (inp && inp.tagName === 'INPUT') inp.addEventListener('input', checkFormReady);
    });

    locSel.addEventListener('change', () => {
      toggleManualInput('location');
      checkFormReady();
    });

    timeSel.addEventListener('change', () => {
      toggleManualInput('time');
      checkFormReady();
    });

    if (isEditMode) await loadEditData(editId);

    checkFormReady();

  } catch (e) { console.error("Init Error:", e); }
}

async function loadEditData(id) {
  showProgress("Memuat Data", "Sedang mengambil data presensi lama...");
  try {
    const { data: header, error: errH } = await supabaseClient.from('attendance_header').select('*').eq('id', id).maybeSingle();
    if (errH) throw errH;
    if (!header) throw new Error("Data presensi tidak ditemukan.");

    activitySel.value = header.activity_id;
    const selAct = activitiesCache.find(a => a.id === header.activity_id);
    const subWrap = document.getElementById("subNameWrap");
    const subInp = document.getElementById("activitySubName");
    if (selAct && selAct.require_sub_name) {
      subWrap.style.display = "block";
      const snapshot = header.activity_name_snapshot || "";
      if (snapshot.includes(" - ")) {
        subInp.value = snapshot.split(" - ").slice(1).join(" - ");
      } else {
        subInp.value = "";
      }
    } else {
      subWrap.style.display = "none";
      subInp.value = "";
    }
    dateEl.value = header.date;
    document.getElementById("note").value = header.note || "";

    const timeFull = `${header.time_start} - ${header.time_end}`;
    let foundTime = false;
    for (let opt of timeSel.options) {
      if (opt.value === timeFull) {
        timeSel.value = timeFull;
        foundTime = true;
        break;
      }
    }
    if (!foundTime && header.time_start) {
      timeSel.value = "Lainnya";
      document.getElementById('timeManual').style.display = 'grid';
      document.getElementById("timeStartManual").value = header.time_start;
      document.getElementById("timeEndManual").value = header.time_end;
    }

    let foundLoc = false;
    for (let opt of locSel.options) {
      if (opt.value === header.location_snapshot) {
        locSel.value = header.location_snapshot;
        foundLoc = true;
        break;
      }
    }
    if (!foundLoc && header.location_snapshot) {
      locSel.value = "Lainnya";
      document.getElementById('locationManual').style.display = 'block';
      document.getElementById("locationManual").value = header.location_snapshot;
    }

    const { data: details, error: errD } = await supabaseClient.from('attendance_detail').select('*').eq('attendance_id', id);
    if (errD) throw errD;

    participants = details.map(d => ({
      member_id: d.member_id,
      name: d.member_name_snapshot,
      role: d.member_role_snapshot,
      presence: d.presence
    }));

    renderParticipants();
    checkFormReady();
    hideProgress();
  } catch (e) {
    hideProgress();
    asyncAlert("Gagal memuat data: " + e.message, "Error");
  }
}

activitySel.addEventListener('change', () => {
  hasWarnedTemplateMod = false;

  const confirmEl = document.getElementById('customConfirm');
  if (confirmEl) confirmEl.style.display = 'none';

  const promptEl = document.getElementById('customPrompt');
  if (promptEl) promptEl.style.display = 'none';

  msgEl.textContent = "";

  const act = activitiesCache.find(a => a.id === activitySel.value);

  timeSel.value = "";
  document.getElementById("timeStartManual").value = "";
  document.getElementById("timeEndManual").value = "";
  toggleManualInput('time');
  document.getElementById("note").value = "";

  const subWrap = document.getElementById("subNameWrap");
  const subInp = document.getElementById("activitySubName");
  if (act && act.require_sub_name) {
    subWrap.style.display = "block";
  } else {
    subWrap.style.display = "none";
    subInp.value = "";
  }

  if (!act) {
    locSel.value = "";
    toggleManualInput('location');
    document.getElementById("locationManual").value = "";
    participants = [];
    renderParticipants();
    return;
  }

  if (act.location) {
    const exists = Array.from(locSel.options).some(opt => opt.value === act.location);
    if (exists) {
      locSel.value = act.location;
      toggleManualInput('location');
    } else {
      locSel.value = 'Lainnya';
      toggleManualInput('location');
      document.getElementById("locationManual").value = act.location;
    }
  } else {
    locSel.value = "";
    toggleManualInput('location');
    document.getElementById("locationManual").value = "";
  }

  if (act.default_participants && act.default_participants.length > 0) {
    participants = act.default_participants.map(p => ({
      member_id: p.member_id,
      name: p.name,
      role: p.role,
      presence: "Hadir"
    }));
  } else {
    participants = [];
  }
  renderParticipants();
});

document.getElementById("addMemberBtn").onclick = async () => {
  const proceed = await checkTemplateWarning("menambah peserta manual di luar template", "participant");
  if (!proceed) return;
  openPresensipicker();
};

window.removeParticipant = async (i) => {
  const proceed = await checkTemplateWarning("menghapus peserta dari template", "participant");
  if (!proceed) return;
  participants.splice(i, 1);
  renderParticipants();
};

function renderParticipants() {
  const container = document.getElementById("participants");
  container.innerHTML = participants.map((p, i) => {
    const presenceClass = p.presence.toLowerCase();
    return `
    <div class="participant-card">
      <div class="p-card-info">
        <div class="p-card-name">${escapeHtml(p.name)}</div>
        <div class="p-card-role">${escapeHtml(p.role)}</div>
      </div>
      <div class="p-card-actions">
        <select class="status-select ${presenceClass}"
          onchange="participants[${i}].presence = this.value; renderParticipants();">
          <option value="Hadir" ${p.presence === 'Hadir' ? 'selected' : ''}>Hadir</option>
          <option value="Izin" ${p.presence === 'Izin' ? 'selected' : ''}>Izin</option>
          <option value="Sakit" ${p.presence === 'Sakit' ? 'selected' : ''}>Sakit</option>
          <option value="Alpa" ${p.presence === 'Alpa' ? 'selected' : ''}>Alpa</option>
        </select>
        <button class="btn-secondary flex items-center justify-center m-0" 
          style="width:34px; height:34px; padding:0; border-radius: 8px; background: var(--brand-50); color: var(--brand-indigo);" 
          onclick="removeParticipant(${i})" title="Hapus peserta">
          <span class="text-xl">&times;</span>
        </button>
      </div>
    </div>`;
  }).join("");
  if (typeof checkFormReady === 'function') checkFormReady();
}

document.getElementById("photos").onchange = async (e) => {
  photoB64 = [];
  photoPreview.innerHTML = "";
  const files = Array.from(e.target.files).slice(0, 4);
  for (const f of files) {
    const b64 = await compressImage(f, 1280, 0.7);
    photoB64.push(b64);
    const img = document.createElement("img");
    img.src = b64;
    img.style = "width:70px; height:70px; object-fit:cover; border-radius:8px;";
    photoPreview.appendChild(img);
  }
};

function compressImage(file, maxW, quality) {
  return new Promise((res) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => img.src = reader.result;
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * scale; c.height = img.height * scale;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", quality));
    };
    reader.readAsDataURL(file);
  });
}

function showProgress(title, msg) {
  document.getElementById('progressSpinner').style.display = 'block';
  document.getElementById('progressIcon').style.display = 'none';
  document.getElementById('successActions').style.display = 'none';
  document.getElementById('progressTitle').textContent = title;
  document.getElementById('progressMsg').textContent = msg;
  document.getElementById('progressOverlay').style.display = 'flex';
}
function updateProgress(title, msg) {
  document.getElementById('progressTitle').textContent = title;
  document.getElementById('progressMsg').textContent = msg;
}
function hideProgress() {
  document.getElementById('progressOverlay').style.display = 'none';
}

document.getElementById("saveBtn").onclick = async () => {
  msgEl.style.color = "red";
  if (!activitySel.value) return msgEl.textContent = "Mohon pilih Kegiatan.";
  if (!dateEl.value) return msgEl.textContent = "Tanggal wajib diisi.";

  const selectedDateStr = dateEl.value;
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

  if (selectedDateStr > todayStr) return msgEl.textContent = "Tidak bisa membuat presensi untuk tanggal besok atau seterusnya.";
  if (timeSel.value === 'Lainnya' && (!document.getElementById("timeStartManual").value || !document.getElementById("timeEndManual").value)) return msgEl.textContent = "Waktu kegiatan manual belum lengkap.";
  if (!timeSel.value) return msgEl.textContent = "Waktu kegiatan belum dipilih.";
  if (locSel.value === 'Lainnya' && !document.getElementById("locationManual").value.trim()) return msgEl.textContent = "Lokasi manual belum diisi.";
  if (!locSel.value) return msgEl.textContent = "Pilih lokasi/tempat kegiatan.";

  const subWrap = document.getElementById("subNameWrap");
  const subInp = document.getElementById("activitySubName");
  if (subWrap && subWrap.style.display !== 'none' && !subInp.value.trim()) {
    return msgEl.textContent = "Detail / Sub-Nama Sesi wajib diisi.";
  }

  if (!participants.length) return msgEl.textContent = "Daftar peserta tidak boleh kosong. Tambahkan minimal 1 orang.";

  msgEl.textContent = "";
  const btn = document.getElementById("saveBtn");
  btn.disabled = true;

  try {
    let ts = '', te = '';
    if (timeSel.value === 'Lainnya') {
      ts = document.getElementById("timeStartManual").value;
      te = document.getElementById("timeEndManual").value;
    } else {
      const parts = timeSel.value.split(" - ");
      ts = parts[0] ? parts[0].trim() : "";
      te = parts.length > 1 ? parts[1].trim() : "";
    }

    showProgress(
      '📄 Membuat PDF...',
      'Sedang mengunggah data & foto ke Google Drive. Proses ini bisa memakan waktu 15–60 detik.'
    );

    let fullActName = activitySel.options[activitySel.selectedIndex].text;
    if (subWrap && subWrap.style.display !== 'none' && subInp.value.trim()) {
      fullActName = `${fullActName} - ${subInp.value.trim()}`;
    }

    const headerData = {
      activity_id: activitySel.value,
      activity_name: fullActName,
      date: dateEl.value,
      time_start: ts,
      time_end: te,
      location: locSel.value === 'Lainnya' ? document.getElementById("locationManual").value : locSel.value,
      note: document.getElementById("note").value
    };

    const gasRes = await apiPost("createAttendanceSession", {
      header: headerData,
      participants: participants,
      photos: photoB64
    });

    if (!gasRes || !gasRes.pdf_fileId) throw new Error("Gagal mendapatkan ID PDF dari Drive");
    const pdfId = gasRes.pdf_fileId;

    updateProgress(
      '☁️ Menyimpan Data...',
      'PDF berhasil dibuat! Sedang menyimpan rekap presensi ke database...'
    );

    const att_id = isEditMode ? editId : `ATT-${new Date().getTime()}`;

    if (isEditMode) {
      const { error: errH } = await supabaseClient.from('attendance_header').update({
        activity_id: headerData.activity_id,
        activity_name_snapshot: headerData.activity_name,
        date: headerData.date,
        time_start: headerData.time_start,
        time_end: headerData.time_end,
        location_snapshot: headerData.location,
        note: headerData.note,
        pdf_file_id: pdfId
      }).eq('id', att_id);
      if (errH) throw errH;

      const { error: errD1 } = await supabaseClient.from('attendance_detail').delete().eq('attendance_id', att_id);
      if (errD1) throw errD1;

      const details = participants.map(p => ({
        attendance_id: att_id,
        member_id: p.member_id,
        member_name_snapshot: p.name,
        member_role_snapshot: p.role,
        presence: p.presence
      }));
      const { error: errD2 } = await supabaseClient.from('attendance_detail').insert(details);
      if (errD2) throw errD2;

    } else {
      const { error: errH } = await supabaseClient.from('attendance_header').insert([{
        id: att_id,
        activity_id: headerData.activity_id,
        activity_name_snapshot: headerData.activity_name,
        date: headerData.date,
        time_start: headerData.time_start,
        time_end: headerData.time_end,
        location_snapshot: headerData.location,
        note: headerData.note,
        pdf_file_id: pdfId
      }]);
      if (errH) throw errH;

      const details = participants.map(p => ({
        attendance_id: att_id,
        member_id: p.member_id,
        member_name_snapshot: p.name,
        member_role_snapshot: p.role,
        presence: p.presence
      }));
      const { error: errD } = await supabaseClient.from('attendance_detail').insert(details);
      if (errD) throw errD;
    }

    document.getElementById('progressSpinner').style.display = 'none';
    document.getElementById('progressIcon').style.display = 'block';
    document.getElementById('progressTitle').textContent = isEditMode ? 'Berhasil Diperbarui!' : 'Berhasil Disimpan!';
    document.getElementById('progressMsg').innerHTML = `Presensi <b>${headerData.activity_name}</b> telah berhasil ${isEditMode ? 'diperbarui' : 'dibuat'} dan disimpan.`;

    document.getElementById('viewPdfBtn').href = `https://drive.google.com/file/d/${pdfId}/view`;
    document.getElementById('sharePdfBtn').onclick = () => {
      const shareUrl = `https://drive.google.com/file/d/${pdfId}/view`;
      const shareText = `Rekap presensi *${headerData.activity_name}* (${headerData.date}).`;
      if (navigator.share) {
        navigator.share({ title: 'Presensi Gabku', text: shareText, url: shareUrl }).catch(err => console.log(err));
      } else {
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        asyncAlert("Link PDF berhasil disalin!");
      }
    };

    if (isEditMode) {
      const finishBackBtn = document.getElementById('finishBackBtn');
      finishBackBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h10v2H7zm0 4h7v2H7zm0-8h10v2H7z"/>
        </svg>
        Kembali ke Rekap
      `;
      finishBackBtn.onclick = () => window.location.href = 'rekap.html';
    }

    document.getElementById('successActions').style.display = 'flex';

  } catch (e) {
    hideProgress();
    msgEl.style.color = "red";
    msgEl.textContent = "Gagal: " + e.message;
  } finally {
    btn.disabled = false;
  }
};
