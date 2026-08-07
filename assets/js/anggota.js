/**
 * Gabku App - Anggota Module
 * Encapsulated JS logic for member management (anggota.html)
 */

(async () => {
  await requireLogin();
  load();
})();

const listEl = document.getElementById("list");
const msgEl = document.getElementById("msg");
const qEl = document.getElementById("q");
const countPill = document.getElementById("countPill");
let cache = [];



function render(items) {
  if (!items.length) {
    listEl.innerHTML = "<p class='muted text-center py-8'>Tidak ada anggota ditemukan.</p>";
    countPill.style.display = "none";
    return;
  }
  countPill.textContent = items.length + " Orang";
  countPill.style.display = "inline-flex";

  listEl.innerHTML = `<div>` + items.map(m => `
    <div class="member-card-item">
      <div class="session-info flex-1 pr-3 cursor-pointer" onclick="viewMemberDetail('${m.id}')">
        <div class="font-bold text-sm text-main">${escapeHtml(m.name)}</div>
        <div class="text-xs text-muted mt-1 flex items-center gap-1.5 flex-wrap">
          <span>${escapeHtml(m.role)}</span>
          ${m.pengurus_status ? `<span class="bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold px-2 py-0.5 rounded text-[11px]">${escapeHtml(m.pengurus_status)}</span>` : ''}
        </div>
      </div>
      <div class="session-actions-group flex items-center gap-2 admin-only">
        <button class="btn-secondary btn-icon p-2.5 rounded-lg flex items-center justify-center text-gray-600 hover:text-sky-600" title="Edit Anggota" onclick="editMember('${m.id}')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-danger btn-icon p-2.5 rounded-lg flex items-center justify-center text-red-600 hover:text-red-700" title="Hapus Anggota" onclick="deleteMember('${m.id}', '${escapeHtml(m.name)}')">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    </div>
  `).join("") + `</div>`;
}

function togglePengurusField() {
  const isPengurus = document.getElementById('role_pengurus').checked;
  document.getElementById("pengurusWrap").style.display = isPengurus ? 'block' : 'none';
}
window.togglePengurusField = togglePengurusField;

function toggleEditPengurusField() {
  const isPengurus = document.getElementById('edit_role_pengurus').checked;
  document.getElementById("editPengurusWrap").style.display = isPengurus ? 'block' : 'none';
}
window.toggleEditPengurusField = toggleEditPengurusField;

const handleGenderSel = (groupId, inputId) => {
  document.querySelectorAll(`#${groupId} .radio-btn`).forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(`#${groupId} .radio-btn`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(inputId).value = btn.getAttribute('data-val');
    };
  });
};
handleGenderSel('genderGroup', 'gender');
handleGenderSel('editGenderGroup', 'editGender');

document.getElementById("toggleAddMemberBtn").onclick = () => {
  document.getElementById("addMemberModal").style.display = "flex";
  document.getElementById("name").focus();
};

const closeAddModal = () => {
  document.getElementById("addMemberModal").style.display = "none";
  msgEl.textContent = "";
};

const cancelSecBtn = document.getElementById("cancelAddMemberBtnSec");
if (cancelSecBtn) cancelSecBtn.onclick = closeAddModal;

document.getElementById('addMemberModal').addEventListener('click', function (e) {
  if (e.target === this) closeAddModal();
});

async function load() {
  listEl.innerHTML = "<p class='muted'>Memuat...</p>";
  try {
    const { data: setDb } = await supabaseClient.from('app_settings').select('*').eq('setting_key', 'pengurus_options').single();
    let pengurusOptions = ["Ketua", "Wakil Ketua", "Sekretaris", "Bendahara", "Anggota Divisi"];
    if (setDb && setDb.setting_value) {
      try { pengurusOptions = JSON.parse(setDb.setting_value); } catch (e) { }
    }
    const optHtml = `<option value="">— pilih status —</option>` + pengurusOptions.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
    document.getElementById("pengurusStatus").innerHTML = optHtml;
    document.getElementById("editPengurusStatus").innerHTML = optHtml;

    const { data, error } = await supabaseClient.from('members').select('*').eq('is_active', true).order('name');
    if (error) throw error;
    cache = data;
    render(cache);
  } catch (e) { listEl.innerHTML = `<p class='msg'>Error: ${e.message}</p>`; }
}

document.getElementById("addBtn").onclick = async () => {
  const name = document.getElementById("name").value.trim();

  const roles = [];
  document.querySelectorAll('#roleGroup input[type="checkbox"]:checked').forEach(cb => roles.push(cb.value));
  const role = roles.join(', ');

  const gend = document.getElementById("gender").value;
  const bdate = document.getElementById("birthDate").value;
  const ph = document.getElementById("phone").value.trim();
  const pst = document.getElementById("pengurusStatus").value;

  msgEl.textContent = "";
  if (!name || !role) return msgEl.textContent = "Data Nama & Role wajib diisi.";
  if (roles.includes('Pengurus') && !pst) return msgEl.textContent = "Status pengurus wajib diisi.";

  try {
    msgEl.textContent = "Menyimpan...";
    const id = `MBR-${new Date().toISOString().replace(/[-T:]/g, '').split('.')[0]}-${Math.floor(1000 + Math.random() * 9000)}`;
    const payload = { id, name, role, gender: gend };
    if (bdate) payload.birth_date = bdate;
    if (ph) payload.phone = ph;
    if (roles.includes('Pengurus')) payload.pengurus_status = pst;

    const { error } = await supabaseClient.from('members').insert([payload]);
    if (error) throw error;
    msgEl.textContent = "Berhasil!";
    document.getElementById("name").value = '';
    document.querySelectorAll('#roleGroup input[type="checkbox"]').forEach(cb => cb.checked = false);
    togglePengurusField();
    document.getElementById("birthDate").value = '';
    document.getElementById("phone").value = '';
    document.getElementById("pengurusStatus").value = '';

    closeAddModal();
    await load();
  } catch (e) { msgEl.textContent = "Gagal: " + e.message; }
};

// FUNGSI LIHAT DETAIL
window.viewMemberDetail = (id) => {
  const m = cache.find(x => x.id === id);
  if (!m) return;
  document.getElementById('detName').textContent = m.name;
  document.getElementById('detRole').textContent = m.role + (m.pengurus_status ? ` - ${m.pengurus_status}` : '');
  document.getElementById('detGender').textContent = m.gender || '-';

  let bDateOut = '-';
  if (m.birth_date) {
    try {
      const d = new Date(m.birth_date);
      const mth = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
      bDateOut = `${d.getDate()} ${mth[d.getMonth()]} ${d.getFullYear()}`;
      const ageDate = new Date(Date.now() - d.getTime());
      const umur = Math.abs(ageDate.getUTCFullYear() - 1970);
      bDateOut += ` (${umur} th)`;
    } catch (e) { }
  }
  document.getElementById('detBirth').textContent = bDateOut;
  document.getElementById('detPhone').textContent = m.phone || '-';

  const waBtn = document.getElementById('detWaBtn');
  if (m.phone) {
    let p = m.phone.replace(/[^0-9]/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    waBtn.href = `https://wa.me/${p}`;
    waBtn.style.display = 'flex';
  } else {
    waBtn.style.display = 'none';
  }

  document.getElementById('detailModal').style.display = 'flex';
};

document.getElementById('detailModal').addEventListener('click', function (e) {
  if (e.target === this) this.style.display = 'none';
});

// FUNGSI EDIT
window.editMember = (id) => {
  const m = cache.find(x => x.id === id);
  if (!m) return;
  const decodeHtml = (html) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  document.getElementById('editId').value = id;
  document.getElementById('editName').value = decodeHtml(m.name);

  const roles = (m.role || '').split(',').map(r => r.trim());
  document.querySelectorAll('#editRoleGroup input[type="checkbox"]').forEach(cb => {
    cb.checked = roles.includes(cb.value);
  });
  toggleEditPengurusField();

  if (roles.includes('Pengurus') && m.pengurus_status) {
    document.getElementById('editPengurusStatus').value = decodeHtml(m.pengurus_status);
  } else {
    document.getElementById('editPengurusStatus').value = '';
  }

  document.getElementById('editBirthDate').value = m.birth_date || '';
  document.getElementById('editPhone').value = m.phone || '';

  const g = m.gender || 'Laki-laki';
  document.getElementById('editGender').value = g;
  document.querySelectorAll('#editGenderGroup .radio-btn').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('data-val') === g) b.classList.add('active');
  });

  document.getElementById('editModal').style.display = 'flex';
};

document.getElementById('editModal').addEventListener('click', function (e) {
  if (e.target === this) closeEditModal();
});

window.closeEditModal = () => {
  document.getElementById('editModal').style.display = 'none';
  document.getElementById('editId').value = '';
  document.getElementById('editName').value = '';
  document.querySelectorAll('#editRoleGroup input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('editPengurusStatus').value = '';
  document.getElementById('editBirthDate').value = '';
  document.getElementById('editPhone').value = '';
};

window.saveEdit = async () => {
  const id = document.getElementById('editId').value;
  const newName = document.getElementById('editName').value.trim();

  const roles = [];
  document.querySelectorAll('#editRoleGroup input[type="checkbox"]:checked').forEach(cb => roles.push(cb.value));
  const newRole = roles.join(', ');

  const gend = document.getElementById("editGender").value;
  const bdate = document.getElementById("editBirthDate").value;
  const ph = document.getElementById("editPhone").value.trim();
  const pst = document.getElementById("editPengurusStatus").value;

  if (!newName || !newRole) return alert("Data (Nama & Role) tidak boleh kosong!");
  if (roles.includes('Pengurus') && !pst) return alert("Status pengurus wajib diisi.");

  try {
    const btn = document.querySelector('#editModal .btn-primary');
    const originalText = btn.textContent;
    btn.textContent = 'Menyimpan...';
    btn.disabled = true;

    const payload = {
      name: newName,
      role: newRole,
      gender: gend,
      birth_date: bdate || null,
      phone: ph || null,
      pengurus_status: roles.includes('Pengurus') ? pst : null
    };

    const { error } = await supabaseClient.from('members').update(payload).eq('id', id);
    if (error) throw error;

    closeEditModal();
    load();

    btn.textContent = originalText;
    btn.disabled = false;
  } catch (e) {
    alert("Error: " + e.message);
    const btn = document.querySelector('#editModal .btn-primary');
    btn.textContent = 'Simpan';
    btn.disabled = false;
  }
};



// FUNGSI HAPUS (Soft Delete)
window.deleteMember = async (id, name) => {
  const proceed = await asyncConfirm(`Hapus ${name}? (Riwayat presensinya akan tetap aman)`);
  if (!proceed) return;
  try {
    const { error } = await supabaseClient.from('members').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    load();
  } catch (e) { alert("Error: " + e.message); }
};

qEl.addEventListener("input", () => {
  const q = qEl.value.trim().toLowerCase();
  render(q ? cache.filter(m => String(m.name || "").toLowerCase().includes(q)) : cache);
});

document.getElementById("refreshBtn").onclick = load;
