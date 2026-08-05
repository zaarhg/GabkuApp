/**
 * Gabku App - User Management Module
 * Encapsulated JS logic for manajemen-user.html
 */

let _allUsers = [];
let _allMembers = [];

document.addEventListener('DOMContentLoaded', async () => {
  await requireLogin();

  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  if (userMeta.role !== 'admin') {
    await asyncAlert("Akses ditolak. Anda bukan Admin.", "Akses Terbatas");
    window.location.href = "index.html";
    return;
  }

  await loadInitialData();

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const approved = _allUsers.filter(u => u.status !== 'Menunggu');
      const filtered = approved.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
      renderUsers(filtered);
    });
  }
});

async function loadInitialData() {
  const { data: members } = await supabaseClient.from('members').select('id, name').eq('is_active', true).order('name');
  _allMembers = members || [];

  const mSel = document.getElementById('editMemberId');
  if (mSel) {
    mSel.innerHTML = '<option value="">-- Pilih Nama Atlet --</option>' +
      _allMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }

  await loadAllData();
}

async function loadAllData() {
  const loading = document.getElementById('loading');
  const list = document.getElementById('userList');
  const pendingSection = document.getElementById('pendingSection');

  if (loading) loading.style.display = 'block';
  if (list) list.innerHTML = '';
  if (pendingSection) pendingSection.style.display = 'none';

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });

  if (loading) loading.style.display = 'none';

  if (error) {
    asyncAlert("Gagal memuat: " + error.message, "Error");
    return;
  }

  _allUsers = data || [];

  const waiting = _allUsers.filter(u => u.status === 'Menunggu');
  const approved = _allUsers.filter(u => u.status !== 'Menunggu');

  if (waiting.length > 0) {
    if (pendingSection) pendingSection.style.display = 'block';
    renderPending(waiting);
  }

  renderUsers(approved);
}

function renderPending(users) {
  const list = document.getElementById('pendingList');
  if (!list) return;
  list.innerHTML = users.map(u => `
    <div class="pending-card">
      <div class="pending-info">
        <div class="pending-name">${escapeHtml(u.full_name)}</div>
        <div class="pending-email">${escapeHtml(u.email)}</div>
      </div>
      
      <div class="pending-form">
        <div>
          <label class="text-[10px] font-bold text-muted uppercase">Setel Role</label>
          <select class="field mt-1" id="role-${u.id}">
            <option value="atlet">Atlet</option>
            <option value="pelatih">Pelatih</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div id="mbox-${u.id}">
          <label class="text-[10px] font-bold text-muted uppercase">Link ke Data Anggota (Wajib)</label>
          <select class="field mt-1" id="member-${u.id}">
            <option value="">-- Pilih Profil Anggota --</option>
            ${_allMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
          </select>
        </div>

        <div class="flex gap-2 mt-2">
          <button onclick="approveUser('${u.id}')" class="btn-primary" style="flex: 2; height:38px;">Setujui Akun</button>
          <button onclick="rejectUser('${u.id}')" class="btn-danger" style="flex: 1; height:38px; border:1px solid #fee2e2; background:transparent !important; color:#dc2626 !important;">Tolak</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderUsers(users) {
  const list = document.getElementById('userList');
  if (!list) return;
  if (!users.length) {
    list.innerHTML = '<p class="text-center text-muted py-10">Tidak ada user terdaftar.</p>';
    return;
  }

  list.innerHTML = users.map(u => {
    const statusClass = (u.status || '').toLowerCase() === 'aktif' ? 'aktif' : ((u.status || '').toLowerCase() === 'nonaktif' ? 'nonaktif' : '');
    return `
      <div class="user-card">
        <div class="user-info">
          <div class="user-avatar">${(u.full_name || 'U').charAt(0)}</div>
          <div class="user-details">
            <div class="user-name">${escapeHtml(u.full_name)}</div>
            <div class="user-email">${escapeHtml(u.email)}</div>
            <div class="user-badges">
              <span class="badge badge-role">${escapeHtml(u.role)}</span>
              <span class="badge badge-status ${statusClass}">${escapeHtml(u.status)}</span>
              ${u.member_id ? `<span class="badge" style="background:#f1f5f9;color:#475569;">Linked</span>` : ''}
            </div>
          </div>
        </div>
        
        <div class="actions-row">
          <button onclick="openEditModal('${u.id}')" class="btn-secondary" style="font-size:11px; padding:8px;">Ubah Akses</button>
          <button onclick="openPasswordModal('${u.id}', '${u.email}')" class="btn-secondary" style="font-size:11px; padding:8px;">Set Sandi Baru</button>
        </div>
        <div class="actions-row">
          ${u.status === 'Nonaktif'
        ? `<button onclick="toggleStatus('${u.id}', 'Aktif')" class="btn-primary" style="font-size:11px; padding:8px; background:#16a34a !important;">Aktifkan</button>`
        : `<button onclick="toggleStatus('${u.id}', 'Nonaktif')" class="btn-danger" style="font-size:11px; padding:8px;">Banned</button>`
      }
          <button onclick="hapusUser('${u.id}', '${escapeHtml(u.full_name)}')" class="btn-danger" style="font-size:11px; padding:8px; border:1px solid #fee2e2; background:transparent !important; color:#dc2626 !important;">Hapus</button>
        </div>
      </div>
    `;
  }).join('');
}

async function approveUser(userId) {
  const role = document.getElementById(`role-${userId}`).value;
  const mId = document.getElementById(`member-${userId}`).value;

  if (!mId) return asyncAlert("Silakan pilih data anggota.", "Data Kurang");

  const member = _allMembers.find(m => m.id === mId);
  const newName = member ? member.name : null;

  const proceed = await asyncConfirm("Setujui akun ini?", "Konfirmasi");
  if (!proceed) return;

  try {
    const payload = {
      role: role,
      member_id: mId,
      status: 'Aktif'
    };
    if (newName) payload.full_name = newName;

    const { error } = await supabaseClient.from('profiles').update(payload).eq('id', userId);

    if (error) throw error;
    await loadAllData();
  } catch (err) { asyncAlert("Gagal: " + err.message); }
}
window.approveUser = approveUser;

async function rejectUser(userId) {
  const proceed = await asyncConfirm("Tolak & hapus permintaan pendaftaran ini?", "Konfirmasi");
  if (!proceed) return;

  try {
    const { error } = await supabaseClient.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    await loadAllData();
  } catch (err) { asyncAlert("Gagal: " + err.message); }
}
window.rejectUser = rejectUser;

function openEditModal(userId) {
  const u = _allUsers.find(x => x.id === userId);
  if (!u) return;
  document.getElementById('editUserId').value = u.id;
  document.getElementById('editEmail').textContent = u.email;
  document.getElementById('editRole').value = u.role || 'atlet';
  document.getElementById('editMemberId').value = u.member_id || '';
  document.getElementById('editModal').classList.add('show');
}
window.openEditModal = openEditModal;

function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
}
window.closeEditModal = closeEditModal;

async function saveAkses() {
  const userId = document.getElementById('editUserId').value;
  const role = document.getElementById('editRole').value;
  const mId = document.getElementById('editMemberId').value;

  if (!mId) return asyncAlert("Data link anggota wajib diisi.", "Peringatan");

  const member = _allMembers.find(m => m.id === mId);
  const newName = member ? member.name : null;

  try {
    const payload = { role, member_id: mId };
    if (newName) payload.full_name = newName;

    const { error } = await supabaseClient.from('profiles').update(payload).eq('id', userId);
    if (error) throw error;
    closeEditModal();
    await loadAllData();
  } catch (err) { asyncAlert("Gagal: " + err.message); }
}
window.saveAkses = saveAkses;

function openPasswordModal(userId, email) {
  document.getElementById('editUserId').value = userId;
  document.getElementById('pwEmail').textContent = email;
  document.getElementById('newPassword').value = '';
  document.getElementById('passwordModal').classList.add('show');
}
window.openPasswordModal = openPasswordModal;

function closePasswordModal() {
  document.getElementById('passwordModal').classList.remove('show');
}
window.closePasswordModal = closePasswordModal;

async function submitResetPassword() {
  const userId = document.getElementById('editUserId').value;
  const newPw = document.getElementById('newPassword').value.trim();
  if (newPw.length < 6) return asyncAlert("Sandi minimal 6 karakter.");

  const btn = document.querySelector('#passwordModal .btn-primary');
  try {
    if (btn) { btn.textContent = 'Memproses...'; btn.disabled = true; }
    await apiPost("resetPasswordAdmin", { userId, newPassword: newPw });
    await asyncAlert("Sandi berhasil diubah!", "Berhasil");
    closePasswordModal();
  } catch (err) { asyncAlert("Gagal: " + err.message); }
  finally {
    if (btn) { btn.textContent = 'Update Sandi Sekarang'; btn.disabled = false; }
  }
}
window.submitResetPassword = submitResetPassword;

async function toggleStatus(userId, newStatus) {
  const proceed = await asyncConfirm(`Yakin ingin mengubah status?`);
  if (!proceed) return;
  try {
    const { error } = await supabaseClient.from('profiles').update({ status: newStatus }).eq('id', userId);
    if (error) throw error;
    await loadAllData();
  } catch (err) { asyncAlert("Gagal: " + err.message); }
}
window.toggleStatus = toggleStatus;

async function hapusUser(userId, name) {
  const proceed = await asyncConfirm(`Hapus permanent akun ${name}?`);
  if (!proceed) return;
  try {
    const { error } = await supabaseClient.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    await loadAllData();
  } catch (err) { asyncAlert("Gagal: " + err.message); }
}
window.hapusUser = hapusUser;


