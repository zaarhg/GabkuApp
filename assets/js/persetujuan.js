/**
 * Gabku App - Account Approval Module
 * Encapsulated JS logic for persetujuan.html
 */

let members = [];

document.addEventListener('DOMContentLoaded', async () => {
  await requireLogin();

  const userMeta = JSON.parse(localStorage.getItem('gabku_user_meta') || '{}');
  if (userMeta.role !== 'admin') {
    await asyncAlert("Akses ditolak. Anda bukan Admin.", "Akses Ditolak");
    window.location.href = "index.html";
    return;
  }

  await loadMembers();
  await loadPendingUsers();
});

async function loadMembers() {
  const { data } = await supabaseClient.from('members').select('id, name').eq('is_active', true).order('name');
  members = data || [];
}

async function loadPendingUsers() {
  const loading = document.getElementById('loading');
  const list = document.getElementById('pendingList');
  const empty = document.getElementById('emptyState');

  if (loading) loading.style.display = 'block';
  if (list) list.innerHTML = '';
  if (empty) empty.style.display = 'none';

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('status', 'Menunggu')
    .order('created_at', { ascending: true });

  if (loading) loading.style.display = 'none';

  if (error) {
    asyncAlert("Gagal memuat data: " + error.message, "Error");
    return;
  }

  if (!data || data.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  data.forEach(user => {
    const row = document.createElement('div');
    row.className = 'pending-row';
    row.innerHTML = `
      <div class="pending-name">${user.full_name}</div>
      <div class="pending-email">${user.email || 'No Email'}</div>
      
      <div class="form-approve">
        <div>
          <label class="text-xs font-bold text-muted uppercase">Pilih Role</label>
          <select class="field mt-1" id="role-${user.id}" onchange="toggleMemberSelect('${user.id}')">
            <option value="atlet">Atlet</option>
            <option value="pelatih">Pelatih</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div id="member-box-${user.id}">
          <label class="text-xs font-bold text-muted uppercase">Link ke Data Anggota</label>
          <select class="field mt-1" id="member-${user.id}">
            <option value="">-- Pilih Nama Atlet --</option>
            ${members.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
          </select>
        </div>

        <div class="flex gap-2 mt-2">
          <button onclick="approveUser('${user.id}')" class="btn-primary" style="flex: 2">Setujui Akun</button>
          <button onclick="rejectUser('${user.id}')" class="btn-danger" style="flex: 1">Tolak</button>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}

function toggleMemberSelect(userId) {
  const role = document.getElementById(`role-${userId}`).value;
  const box = document.getElementById(`member-box-${userId}`);
  if (box) box.style.display = (role === 'atlet') ? 'block' : 'none';
}
window.toggleMemberSelect = toggleMemberSelect;

async function approveUser(userId) {
  const role = document.getElementById(`role-${userId}`).value;
  const memberId = document.getElementById(`member-${userId}`).value;

  if (role === 'atlet' && !memberId) {
    asyncAlert("Silakan pilih data anggota untuk atlet ini.", "Data Belum Lengkap");
    return;
  }

  const proceed = await asyncConfirm("Setujui akun ini?", "Konfirmasi Persetujuan");
  if (!proceed) return;

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      role: role,
      member_id: role === 'atlet' ? memberId : null,
      status: 'Aktif'
    })
    .eq('id', userId);

  if (error) {
    asyncAlert("Gagal menyetujui: " + error.message, "Gagal");
  } else {
    await asyncAlert("Akun berhasil disetujui!", "Berhasil");
    await loadPendingUsers();
  }
}
window.approveUser = approveUser;

async function rejectUser(userId) {
  const proceed = await asyncConfirm("Tolak dan hapus permintaan ini?", "Konfirmasi Penolakan");
  if (!proceed) return;

  const { error } = await supabaseClient
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (error) {
    asyncAlert("Gagal menghapus: " + error.message, "Gagal");
  } else {
    await asyncAlert("Permintaan ditolak.", "Update");
    await loadPendingUsers();
  }
}
window.rejectUser = rejectUser;


