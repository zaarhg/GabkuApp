/**
 * Gabku App - Login Module
 * Encapsulated JS logic for login.html
 */

document.addEventListener('DOMContentLoaded', () => {
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const msgEl = document.getElementById("msg");
  const btnEl = document.getElementById("btn");

  async function doLogin() {
    const email = emailEl.value.trim();
    const password = passEl.value.trim();

    if (!email || !password) {
      msgEl.textContent = "Email dan password wajib diisi.";
      msgEl.style.color = "var(--danger)";
      return;
    }

    btnEl.disabled = true;
    btnEl.textContent = "Memeriksa...";
    msgEl.textContent = "";

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;
      window.location.href = "index.html";
    } catch (e) {
      msgEl.textContent = "Gagal login: " + e.message;
      msgEl.style.color = "var(--danger)";
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = "Masuk";
    }
  }
  window.doLogin = doLogin;

  if (emailEl && passEl) {
    [emailEl, passEl].forEach(el => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
    });
  }
});
