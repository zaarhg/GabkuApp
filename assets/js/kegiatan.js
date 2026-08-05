/**
 * Gabku App - Kegiatan Module
 * Encapsulated JS logic for activity management page (kegiatan.html)
 */

(async () => {
  await requireLogin();
  await initMembers();
  await initOptions();
  load();
})();

const listEl = document.getElementById("list");
const msgEl = document.getElementById("msg");
const countPill = document.getElementById("countPill");

let membersCache = [];
let activitiesCache = [];
let addParticipants = [];
let editParticipants = [];
let locationOpts = [];

async function initOptions() {
  const { data } = await supabaseClient.from('app_settings').select('*').eq('setting_key', 'location_options').single();
  if (data && data.setting_value) {
    locationOpts = Array.isArray(data.setting_value) ? data.setting_value : JSON.parse(data.setting_value);
  }
  let optsHtml = `<option value="">— pilih tempat (opsional) —</option>` + locationOpts.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  optsHtml += `<option value="Lainnya">Lainnya...</option>`;
  document.getElementById('activityLocSel').innerHTML = optsHtml;
  document.getElementById('editLocSel').innerHTML = optsHtml;
}

async function initMembers() {
  if (membersCache.length === 0) {
    const { data } = await supabaseClient.from('members').select('*').eq('is_active', true).order('name');
    if (data) membersCache = data;
  }
}



/* ── Member Picker ── */
let _pickerTargetArr = null;
let _pickerRenderFn = null;
let _kegPickerTemp = new Set();

function openMemberPicker(targetArr, renderFn) {
  _pickerTargetArr = targetArr;
  _pickerRenderFn = renderFn;
  _kegPickerTemp = new Set();
  document.getElementById('kegiatanPickerSearch').value = '';
  filterMemberList('');
  document.getElementById('memberPickerModal').classList.add('show');
  document.getElementById('kegiatanPickerSearch').focus();
}

function closeMemberPicker() {
  document.getElementById('memberPickerModal').classList.remove('show');
  _pickerTargetArr = null;
  _pickerRenderFn = null;
}

function filterMemberList(q) {
  const pool = q.trim()
    ? membersCache.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : membersCache;
  const alreadyIn = new Set((_pickerTargetArr || []).map(p => p.member_id));
  const el = document.getElementById('kegiatanPickerList');
  el.innerHTML = pool.map(m => {
    const inList = alreadyIn.has(m.id);
    const checked = inList || _kegPickerTemp.has(m.id);
    return `
      <div class="picker-item${checked ? ' selected' : ''}${inList ? ' disabled' : ''}" onclick="toggleMemberItem('${m.id}',this)">
        <div class="picker-check">${checked ? '✓' : ''}</div>
        <div>
          <div class="picker-item-name">${escapeHtml(m.name)}</div>
          <div class="picker-item-role">${escapeHtml(m.role || '')}${inList ? ' · sudah ditambahkan' : ''}</div>
        </div>
      </div>`;
  }).join('');
}

function toggleMemberItem(id, el) {
  const alreadyIn = new Set((_pickerTargetArr || []).map(p => p.member_id));
  if (alreadyIn.has(id)) return;
  if (_kegPickerTemp.has(id)) { _kegPickerTemp.delete(id); }
  else { _kegPickerTemp.add(id); }
  el.classList.toggle('selected');
  el.querySelector('.picker-check').textContent = _kegPickerTemp.has(id) ? '✓' : '';
}

function confirmMemberPicker() {
  if (!_pickerTargetArr || !_pickerRenderFn) return;
  _kegPickerTemp.forEach(id => {
    const m = membersCache.find(x => x.id === id);
    if (!m || _pickerTargetArr.find(p => p.member_id === id)) return;
    _pickerTargetArr.push({ member_id: m.id, name: m.name, role: m.role || '' });
  });
  _pickerTargetArr.sort((a, b) => a.name.localeCompare(b.name));
  _pickerRenderFn();
  closeMemberPicker();
}

document.getElementById('memberPickerModal').addEventListener('click', e => {
  if (e.target === document.getElementById('memberPickerModal')) closeMemberPicker();
});

// RENDER PARTICIPANTS UNTUK TAMBAH
function renderAddParts() {
  document.getElementById("addPartList").innerHTML = addParticipants.map((p, i) => `
    <div class="list-item rounded-lg bg-gray-50 p-2">
      <div class="list-content m-0">
        <div class="font-bold text-sm text-main">${escapeHtml(p.name)}</div>
        <div class="text-xs text-muted mt-1">${escapeHtml(p.role)}</div>
      </div>
      <button class="flex items-center justify-center" style="width: 28px; height: 28px; border-radius: 50%; border: none; background: #fee2e2; color: #ef4444; cursor: pointer; transition: transform 0.15s ease;" onmousedown="this.style.transform='scale(0.85)';" onmouseup="this.style.transform='scale(1)';" onmouseleave="this.style.transform='scale(1)';" onclick="addParticipants.splice(${i},1); renderAddParts();" type="button" aria-label="Hapus">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
      </button>
    </div>`).join("");
}

document.getElementById("addPartBtn").onclick = () => openMemberPicker(addParticipants, renderAddParts);

// RENDER PARTICIPANTS UNTUK EDIT
function renderEditParts() {
  document.getElementById("editPartList").innerHTML = editParticipants.map((p, i) => `
    <div class="list-item rounded-lg bg-gray-50 p-2">
      <div class="list-content m-0">
        <div class="font-bold text-sm text-main">${escapeHtml(p.name)}</div>
        <div class="text-xs text-muted mt-1">${escapeHtml(p.role)}</div>
      </div>
      <button class="flex items-center justify-center" style="width: 28px; height: 28px; border-radius: 50%; border: none; background: #fee2e2; color: #ef4444; cursor: pointer; transition: transform 0.15s ease;" onmousedown="this.style.transform='scale(0.85)';" onmouseup="this.style.transform='scale(1)';" onmouseleave="this.style.transform='scale(1)';" onclick="editParticipants.splice(${i},1); renderEditParts();" type="button" aria-label="Hapus">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
      </button>
    </div>`).join("");
}

window.addEditParticipant = () => openMemberPicker(editParticipants, renderEditParts);

document.getElementById("toggleAddActivityBtn").onclick = () => {
  document.getElementById("toggleAddActivityBtn").style.display = "none";
  document.getElementById("addActivityForm").style.display = "block";
  document.getElementById("activityName").focus();
};
document.getElementById("cancelAddActivityBtn").onclick = () => {
  document.getElementById("addActivityForm").style.display = "none";
  document.getElementById("toggleAddActivityBtn").style.display = "flex";
  msgEl.textContent = "";
};

// Toggle Arsip behavior
document.getElementById("toggleInactiveBtn").onclick = () => {
  document.getElementById("toggleInactiveBtn").style.display = "none";
  document.getElementById("inactiveSection").style.display = "block";
};
document.getElementById("closeInactiveBtn").onclick = () => {
  document.getElementById("inactiveSection").style.display = "none";
  document.getElementById("toggleInactiveBtn").style.display = "flex";
};

async function load() {
  listEl.innerHTML = "<p class='muted'>Memuat...</p>";
  const InactiveListEl = document.getElementById("listInactive");
  InactiveListEl.innerHTML = "<p class='muted'>Memuat...</p>";
  countPill.style.display = "none";

  try {
    const { data, error } = await supabaseClient.from('activities').select('*').order('name');
    if (error) throw error;

    activitiesCache = data || [];
    const activeActivities = activitiesCache.filter(a => a.is_active);
    const inactiveActivities = activitiesCache.filter(a => !a.is_active);

    // Render Active
    if (!activeActivities.length) {
      listEl.innerHTML = "<p class='muted'>Belum ada kegiatan aktif.</p>";
    } else {
      countPill.textContent = activeActivities.length + " item";
      countPill.style.display = "inline-flex";
      listEl.innerHTML = activeActivities.map(r => `
        <div class="list-item">
          <div class="list-content ml-0">
            <div class="list-title mb-1">${escapeHtml(r.name)}</div>
            ${r.category === 'Latihan' ? `<span class="badge badge-success mb-1">Latihan</span>` : (r.category === 'Pertandingan' ? `<span class="badge badge-warning mb-1">Pertandingan</span>` : `<span class="badge badge-neutral mb-1">Lainnya</span>`)}
            ${r.location ? `<div class="text-xs text-muted mt-1">📍 ${escapeHtml(r.location)}</div>` : ''}
          </div>
          <div class="flex gap-2 items-center">
            <button class="btn-outline btn-sm admin-only" onclick="editActivity('${r.id}')">Edit</button>
            <button class="btn-secondary btn-sm admin-only" onclick="toggleActivityStatus('${r.id}', false, '${escapeHtml(r.name)}')">Nonaktifkan</button>
          </div>
        </div>
      `).join("");
    }

    // Render Inactive
    if (!inactiveActivities.length) {
      InactiveListEl.innerHTML = "<p class='muted'>Arsip kosong.</p>";
    } else {
      InactiveListEl.innerHTML = inactiveActivities.map(r => `
        <div class="list-item" style="background:#fff;">
          <div class="list-content ml-0">
            <div class="list-title mb-1 text-muted">${escapeHtml(r.name)}</div>
            <span class="badge badge-neutral mb-1">Nonaktif</span>
          </div>
          <div class="flex gap-2 items-center">
            <button class="btn-primary btn-sm admin-only" onclick="toggleActivityStatus('${r.id}', true, '${escapeHtml(r.name)}')">Aktifkan</button>
            <button class="btn-delete btn-sm admin-only" onclick="deleteActivity('${r.id}', '${escapeHtml(r.name)}')">Hapus</button>
          </div>
        </div>
      `).join("");
    }
  } catch (e) {
    listEl.innerHTML = `<p class='msg text-center'>Gagal load: ${e.message}</p>`;
  }
}

window.toggleSubNameCheckbox = (wrapId, inputId, forceState) => {
  const wrap = document.getElementById(wrapId);
  const inp = document.getElementById(inputId);
  if (!wrap || !inp) return;
  if (typeof forceState === 'boolean') {
    inp.checked = forceState;
  } else {
    inp.checked = !inp.checked;
  }
  const icon = wrap.querySelector('.toggle-icon');
  if (inp.checked) {
    wrap.style.background = '#eff6ff';
    wrap.style.borderColor = '#3b82f6';
    wrap.style.color = '#1d4ed8';
    if (icon) icon.textContent = '☑️';
  } else {
    wrap.style.background = '#f8fafc';
    wrap.style.borderColor = '#cbd5e1';
    wrap.style.color = '#475569';
    if (icon) icon.textContent = '⬜';
  }
};

const handleRadioSel = (groupId, inputId) => {
  document.querySelectorAll(`#${groupId} .radio-btn`).forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(`#${groupId} .radio-btn`).forEach(b => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      const dt = btn.getAttribute('data-val');
      document.getElementById(inputId).value = dt;
    };
  });
};
handleRadioSel('activityCategoryGroup', 'activityCategory');
handleRadioSel('editCategoryGroup', 'editCategory');

document.getElementById("addBtn").onclick = async () => {
  const name = document.getElementById("activityName").value.trim();
  let locValRaw = document.getElementById("activityLocSel").value;
  const loc = locValRaw === 'Lainnya' ? document.getElementById("activityLocation").value.trim() : locValRaw;
  const cat = document.getElementById("activityCategory").value;
  const sd = document.getElementById("activityStartD").value;
  const ed = document.getElementById("activityEndD").value;

  msgEl.textContent = "";
  if (!name) return msgEl.textContent = "Nama wajib diisi.";
  if (name.toLowerCase() === 'latihan') {
    return await asyncAlert('Nama kegiatan tidak boleh dibiarkan hanya bernama "Latihan". Mohon tulis lebih spesifik dan unik, contoh: Latihan Gabungan, Latihan Rutin, dsb.', 'Hindari Ambiguitas');
  }

  try {
    msgEl.textContent = "Menyimpan...";
    const id = `ACT-${new Date().toISOString().replace(/[-T:]/g, '').split('.')[0]}-${Math.floor(1000 + Math.random() * 9000)}`;
    const reqSub = document.getElementById("activityRequireSub").checked;
    const payload = { id, name, category: cat, require_sub_name: reqSub };
    if (loc) payload.location = loc;
    if (sd) payload.start_date = sd;
    if (ed) payload.end_date = ed;
    if (addParticipants.length > 0) payload.default_participants = addParticipants;

    let { error } = await supabaseClient.from('activities').insert([payload]);
    if (error && payload.require_sub_name !== undefined) {
      delete payload.require_sub_name;
      const retry = await supabaseClient.from('activities').insert([payload]);
      error = retry.error;
    }
    if (error) throw error;
    msgEl.textContent = "Berhasil!";
    document.getElementById("activityName").value = "";
    document.getElementById("activityLocation").value = "";
    document.getElementById("activityLocSel").value = "";
    document.getElementById("activityLocation").style.display = "none";
    document.getElementById("activityCategory").value = "Kegiatan Lain";
    toggleSubNameCheckbox('activityRequireSubWrap', 'activityRequireSub', false);
    document.getElementById("activityStartD").value = "";
    document.getElementById("activityEndD").value = "";
    addParticipants = [];
    renderAddParts();
    document.getElementById("addActivityForm").style.display = "none";
    document.getElementById("toggleAddActivityBtn").style.display = "flex";
    await load();
  } catch (e) {
    msgEl.textContent = "Gagal: " + e.message;
  }
};

// FUNGSI EDIT
window.editActivity = (id) => {
  const act = activitiesCache.find(a => a.id === id);
  if (!act) return;

  document.getElementById('editId').value = act.id;
  document.getElementById('editName').value = act.name || '';

  const locVal = act.location || '';
  if (locationOpts.includes(locVal) || !locVal) {
    document.getElementById('editLocSel').value = locVal;
    document.getElementById('editLocation').style.display = 'none';
    document.getElementById('editLocation').value = '';
  } else {
    document.getElementById('editLocSel').value = 'Lainnya';
    document.getElementById('editLocation').style.display = 'block';
    document.getElementById('editLocation').value = locVal;
  }

  const cVal = act.category || 'Kegiatan Lain';
  document.getElementById('editCategory').value = cVal;
  document.querySelectorAll('#editCategoryGroup .radio-btn').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('data-val') === cVal) b.classList.add('active');
  });
  document.getElementById('editStartD').value = act.start_date || '';
  document.getElementById('editEndD').value = act.end_date || '';
  toggleSubNameCheckbox('editRequireSubWrap', 'editRequireSub', !!act.require_sub_name);

  editParticipants = act.default_participants ? JSON.parse(JSON.stringify(act.default_participants)) : [];
  editParticipants.sort((a, b) => a.name.localeCompare(b.name));
  renderEditParts();

  document.getElementById('editModal').style.display = 'flex';
};

window.closeEditModal = () => {
  document.getElementById('editModal').style.display = 'none';
  document.getElementById('editId').value = '';
  document.getElementById('editName').value = '';
  document.getElementById('editLocation').value = '';
  document.getElementById('editLocSel').value = '';
  editParticipants = [];
};

window.saveEdit = async () => {
  const id = document.getElementById('editId').value;
  const newName = document.getElementById('editName').value.trim();
  let editLocRaw = document.getElementById("editLocSel").value;
  const newLoc = editLocRaw === 'Lainnya' ? document.getElementById('editLocation').value.trim() : editLocRaw;
  const cat = document.getElementById('editCategory').value;
  const sd = document.getElementById('editStartD').value;
  const ed = document.getElementById('editEndD').value;

  if (!newName) return await asyncAlert("Nama kegiatan wajib diisi!");
  if (newName.toLowerCase() === 'latihan') return await asyncAlert('Nama kegiatan tidak boleh dibiarkan hanya bernama "Latihan". Mohon tulis lebih spesifik dan unik, contoh: Latihan Mingguan, Latihan Gabungan.', 'Hindari Ambiguitas');

  try {
    const btn = document.querySelector('#editModal .btn-primary');
    const originalText = btn.textContent;
    btn.textContent = 'Menyimpan...';
    btn.disabled = true;

    const reqSub = document.getElementById('editRequireSub').checked;
    const payload = {
      name: newName,
      location: newLoc || null,
      category: cat,
      start_date: sd || null,
      end_date: ed || null,
      default_participants: editParticipants.length > 0 ? editParticipants : null,
      require_sub_name: reqSub
    };

    let { error } = await supabaseClient.from('activities').update(payload).eq('id', id);
    if (error && payload.require_sub_name !== undefined) {
      delete payload.require_sub_name;
      const retry = await supabaseClient.from('activities').update(payload).eq('id', id);
      error = retry.error;
    }
    if (error) throw error;

    closeEditModal();
    load();

    btn.textContent = originalText;
    btn.disabled = false;
  } catch (e) {
    if (e.message && e.message.includes('require_sub_name')) {
      await asyncAlert("Kolom 'require_sub_name' belum ditambahkan di database Supabase.\n\nSilakan jalankan query SQL berikut di SQL Editor Supabase:\n\nALTER TABLE activities ADD COLUMN IF NOT EXISTS require_sub_name BOOLEAN DEFAULT false;", "Database Butuh Update Kolom");
    } else {
      await asyncAlert("Gagal update: " + e.message);
    }
    const btn = document.querySelector('#editModal .btn-primary');
    btn.textContent = 'Simpan';
    btn.disabled = false;
  }
};

// FUNGSI HAPUS (Soft Delete)
window.deleteActivity = async (id, currentName) => {
  const proceed = await asyncConfirm(`Hapus permanent kegiatan "${currentName}"?`);
  if (!proceed) return;
  try {
    const { error } = await supabaseClient.from('activities').delete().eq('id', id);
    if (error) throw error;
    load();
  } catch (e) { await asyncAlert("Gagal hapus: " + e.message); }
};

window.toggleActivityStatus = async (id, newStatus, name) => {
  const action = newStatus ? "Mengaktifkan kembali" : "Menonaktifkan";
  const proceed = await asyncConfirm(`${action} kegiatan "${name}"?`, "Konfirmasi Status");
  if (!proceed) return;

  try {
    const { error } = await supabaseClient.from('activities').update({ is_active: newStatus }).eq('id', id);
    if (error) throw error;
    load();
  } catch (e) { await asyncAlert("Gagal update status: " + e.message); }
};

document.getElementById("refreshBtn").onclick = load;
