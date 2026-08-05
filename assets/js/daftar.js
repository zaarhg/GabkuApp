/**
 * Gabku App - Registration Module
 * Encapsulated JS logic for daftar.html
 */

document.addEventListener('DOMContentLoaded', () => {
  const nameEl = document.getElementById("full_name");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const msgEl = document.getElementById("msg");
  const btnEl = document.getElementById("btn");

  async function doRegister() {
    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passEl.value.trim();

    if (!name || !email || !password) {
      msgEl.textContent = "Semua kolom wajib diisi.";
      msgEl.style.color = "var(--danger)";
      return;
    }

    if (password.length < 6) {
      msgEl.textContent = "Password minimal 6 karakter.";
      msgEl.style.color = "var(--danger)";
      return;
    }

    btnEl.disabled = true;
    btnEl.textContent = "Mendaftarkan...";
    msgEl.textContent = "";

    try {
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      const { error: profError } = await supabaseClient.from('profiles').insert({
        id: userId,
        full_name: name,
        email: email,
        status: 'Menunggu'
      });

      if (profError) throw profError;

      msgEl.textContent = "Pendaftaran Berhasil! Mengalihkan...";
      msgEl.style.color = "#16a34a";

      setTimeout(() => {
        window.location.href = "pending.html";
      }, 1500);

    } catch (e) {
      msgEl.textContent = "Gagal: " + e.message;
      msgEl.style.color = "var(--danger)";
      btnEl.disabled = false;
      btnEl.textContent = "Daftar Sekarang";
    }
  }
  window.doRegister = doRegister;

  if (nameEl && emailEl && passEl) {
    [nameEl, emailEl, passEl].forEach(el => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doRegister();
      });
    });
  }
});
