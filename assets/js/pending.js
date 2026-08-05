/**
 * Gabku App - Pending Registration Module
 * Encapsulated JS logic for pending.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    return;
  }

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('status')
    .eq('id', data.session.user.id)
    .maybeSingle();

  if (profile && (profile.status === 'Aktif' || profile.status === 'approved')) {
    window.location.href = "index.html";
  }

  try {
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_wa_number')
      .maybeSingle();

    if (settings && settings.setting_value) {
      let num = settings.setting_value.replace(/[^0-9]/g, '');
      if (num.startsWith('0')) num = '62' + num.slice(1);
      const btn = document.getElementById('waButton');
      const text = encodeURIComponent("Halo Admin, saya sudah mendaftar di Gabku App. Mohon bantuannya untuk aktivasi akun saya. Terima kasih!");
      if (btn) btn.href = `https://wa.me/${num}?text=${text}`;
    }
  } catch (e) {
    console.error("Gagal ambil nomor WA:", e);
  }
});

