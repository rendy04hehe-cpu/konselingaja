/* ===========================================
   TEMAN BICARA AI — main.js
   Landing page & Identity Modal logic
   =========================================== */

'use strict';

/* Simpan referensi semua modal */
const modals = {};

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi semua modal sekaligus
    ['identityModal', 'aboutModal', 'termsModal', 'authModal', 'historyWarningModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            modals[id] = new bootstrap.Modal(el, {
                backdrop: true,
                keyboard: id !== 'identityModal', // About, Terms & Auth bisa ditutup ESC
            });
        }
    });

    // Saat modal identitas terbuka, fokus otomatis ke field nama
    const identityModalEl = document.getElementById('identityModal');
    if (identityModalEl) {
        identityModalEl.addEventListener('shown.bs.modal', () => {
            const nameField = document.getElementById('userName');
            if (nameField) nameField.focus();
        });
    }

    // Saat modal auth terbuka, fokus ke username & reset ke langkah 1
    const authModalEl = document.getElementById('authModal');
    if (authModalEl) {
        authModalEl.addEventListener('shown.bs.modal', () => {
            const usernameField = document.getElementById('authUsername');
            if (usernameField) usernameField.focus();
            goAuthStep(1);
        });

        // Saat modal ditutup, kembalikan ke mode login agar tampilan
        // bersih saat dibuka kembali.
        authModalEl.addEventListener('hidden.bs.modal', () => {
            if (authMode !== 'login') setAuthMode('login');
        });
    }

    // Tekan Enter di dalam form = Lanjut
    const identityForm = document.getElementById('identityForm');
    if (identityForm) {
        identityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            continueToChat();
        });
    }

    // Submit form auth (login/daftar)
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleAuthSubmit();
        });
    }

    // Tombol ganti mode login/daftar
    const btnToggleAuthMode = document.getElementById('btn-toggle-auth-mode');
    if (btnToggleAuthMode) {
        btnToggleAuthMode.addEventListener('click', toggleAuthMode);
    }

    // Tombol submit auth
    const btnAuthSubmit = document.getElementById('btn-auth-submit');
    if (btnAuthSubmit) {
        btnAuthSubmit.addEventListener('click', handleAuthSubmit);
    }

    // Cek status login saat halaman dimuat
    initAuth();
});

/**
 * Status login terkini. Disinkronkan oleh initAuth(), handleAuthSubmit(),
 * dan logout(). Dipakai handleStartTelling() agar tidak fetch ulang.
 * @type {boolean|null} null = belum diketahui (masih loading)
 */
let currentAuthState = null;

/**
 * Simpan status login terakhir yang diketahui.
 */
function setCurrentAuthState(authenticated) {
    currentAuthState = authenticated;
}

/** ===========================================
   AUTH — Login / Logout Landing Page
   =========================================== */

/**
 * Ambil nilai cookie CSRF (dipasang oleh Django via ensure_csrf_cookie).
 */
function getCsrfToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
}

/**
 * Cek status login via /api/chat/auth/me/ lalu render tombol di topbar.
 */
async function initAuth() {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;

    const loginBtn = document.getElementById('btn-open-login');
    navAuth.setAttribute('data-auth', 'loading');

    try {
        const res = await fetch('/api/chat/auth/me/', { credentials: 'same-origin' });
        const data = await res.json();

        if (data && data.authenticated) {
            setCurrentAuthState(true);
            renderLoggedInNav(data.username);
        } else {
            setCurrentAuthState(false);
            renderLoggedOutNav();
        }
    } catch (err) {
        setCurrentAuthState(false);
        // Jaringan error — tampilkan tombol "Masuk" saja agar tidak mengunci halaman
        navAuth.setAttribute('data-auth', 'logged-out');
        if (loginBtn) loginBtn.style.display = '';
    }
}

function renderLoggedOutNav() {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;

    navAuth.setAttribute('data-auth', 'logged-out');
    navAuth.innerHTML = `
        <button
            class="nav-link-btn"
            type="button"
            onclick="openModal('authModal')"
            aria-haspopup="dialog"
        >
            Masuk
        </button>
    `;
}

function renderLoggedInNav(username) {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;

    navAuth.setAttribute('data-auth', 'logged-in');
    navAuth.innerHTML = `
        <span class="nav-auth-username" title="${escapeHtml(username)}">${escapeHtml(username)}</span>
        <button class="nav-auth-logout" type="button" onclick="logout()">Keluar</button>
    `;
}

/**
 * Escape HTML untuk mencegah XSS saat merender username.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Mode form auth: 'login' atau 'register'.
 * @type {'login' | 'register'}
 */
let authMode = 'login';

/** Jumlah langkah form daftar. */
const REGISTER_TOTAL_STEPS = 3;

/** Langkah aktif form daftar (1..3). */
let registerStep = 1;

/**
 * Toggle antara form Masuk dan Daftar.
 * Mode daftar memakai form multi-langkah yang bisa di-slide.
 */
function toggleAuthMode() {
    const heading = document.getElementById('modal-auth-heading');
    const submitSub = document.getElementById('modal-auth-sub');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const btnToggle = document.getElementById('btn-toggle-auth-mode');
    const passwordInput = document.getElementById('authPassword');
    const steps = document.getElementById('authSteps');
    const dots = document.getElementById('authStepsDots');
    const errorEl = document.getElementById('authError');

    if (authMode === 'login') {
        authMode = 'register';
        if (heading) heading.textContent = 'Daftar akun';
        if (submitSub) submitSub.textContent = 'Daftar akun baru untuk menyimpan riwayat percakapanmu. Kami perlu beberapa informasi dasar untuk menyesuaikan percakapan.';
        if (btnSubmit) btnSubmit.textContent = 'Lanjut';
        if (btnToggle) btnToggle.textContent = 'Sudah punya akun? Masuk';
        if (passwordInput) passwordInput.setAttribute('autocomplete', 'new-password');
        if (steps) steps.hidden = false;
        if (dots) dots.hidden = false;
        registerStep = 1;
        goAuthStep(1);
    } else {
        authMode = 'login';
        if (heading) heading.textContent = 'Masuk';
        if (submitSub) submitSub.textContent = 'Masuk untuk menyimpan riwayat percakapanmu. Kamu bisa membukanya kembali kapan saja.';
        if (btnSubmit) btnSubmit.textContent = 'Masuk';
        if (btnToggle) btnToggle.textContent = 'Daftar akun baru';
        if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
        if (steps) steps.hidden = true;
        if (dots) dots.hidden = true;
    }

    if (errorEl) errorEl.textContent = '';
}

/**
 * Set mode form auth ('login' | 'register') dan render ulang UI-nya.
 */
function setAuthMode(mode) {
    if (mode === authMode) return;
    toggleAuthMode();
}

/**
 * Pindah slide form daftar ke langkah tertentu (1..3).
 * Track digeser horizontal sehingga setiap langkah tampil satu per satu.
 */
function goAuthStep(step) {
    const total = REGISTER_TOTAL_STEPS;
    const target = Math.max(1, Math.min(total, step));
    registerStep = target;

    const track = document.getElementById('authStepsTrack');
    if (track) {
        track.style.transform = `translateX(-${(target - 1) * 100}%)`;
    }

    // Indikator titik
    const dots = document.querySelectorAll('.auth-step-dot');
    dots.forEach(dot => {
        const dotNum = parseInt(dot.getAttribute('data-dot'), 10);
        dot.classList.toggle('is-active', dotNum === target);
    });

    // Tombol: "Lanjut" untuk langkah 1-2, "Daftar" di langkah terakhir
    const btnSubmit = document.getElementById('btn-auth-submit');
    if (btnSubmit) {
        btnSubmit.textContent = target === total ? 'Daftar' : 'Lanjut';
    }

    // Fokus ke field pertama pada langkah baru
    setTimeout(() => {
        const stepEl = document.querySelector(`.auth-step[data-step="${target}"]`);
        const firstInput = stepEl && stepEl.querySelector('.field-input');
        if (firstInput) firstInput.focus();
    }, 80);
}

/**
 * Validasi kolom pada langkah aktif. Kembalikan string error atau null.
 */
function validateAuthStep(step) {
    if (step === 1) {
        const username = document.getElementById('authUsername')?.value.trim() || '';
        const password = document.getElementById('authPassword')?.value || '';
        if (!username) return 'Mohon isi username.';
        if (password.length < 8) return 'Password minimal 8 karakter.';
        return null;
    }
    if (step === 2) {
        const age = document.getElementById('authAge')?.value.trim() || '';
        if (age) {
            const ageNum = parseInt(age, 10);
            if (isNaN(ageNum) || ageNum < 10 || ageNum > 100) {
                return 'Umur harus antara 10–100 tahun.';
            }
        }
        return null;
    }
    if (step === 3) {
        const gender = document.getElementById('authGender')?.value.trim() || '';
        const occupation = document.getElementById('authJob')?.value.trim() || '';
        if (!gender) return 'Jenis kelamin wajib diisi.';
        if (!occupation) return 'Pekerjaan wajib diisi.';
        return null;
    }
    return null;
}

/**
 * Ambil nilai profil dari form daftar.
 */
function collectRegisterProfile() {
    return {
        name: document.getElementById('authName')?.value.trim() || '',
        age: document.getElementById('authAge')?.value.trim() || '',
        gender: document.getElementById('authGender')?.value.trim() || '',
        occupation: document.getElementById('authJob')?.value.trim() || '',
    };
}

/**
 * Simpan profil akun ke sessionStorage sebagai konteks percakapan.
 */
function storeAccountProfile(profile) {
    if (!profile) return;
    sessionStorage.setItem('userProfile', JSON.stringify({
        name: profile.name || '',
        age: profile.age != null ? profile.age : '',
        gender: profile.gender || '',
        occupation: profile.occupation || '',
        isAnonymous: false,
    }));
}

/**
 * Kirim login ke backend lalu arahkan ke chat.
 */
async function submitLogin() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    const btnSubmit = document.getElementById('btn-auth-submit');

    if (!username || !password) {
        if (errorEl) errorEl.textContent = 'Mohon isi username dan password.';
        return;
    }

    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const res = await fetch('/api/chat/auth/login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (errorEl) errorEl.textContent = data.detail || 'Terjadi kesalahan. Coba lagi.';
            return;
        }

        // Berhasil — simpan profil akun lalu langsung menuju chat.
        // Pengguna yang sudah login TIDAK perlu mengisi form identitas lagi.
        setCurrentAuthState(true);
        if (modals['authModal']) modals['authModal'].hide();
        renderLoggedInNav(username);
        storeAccountProfile(data.profile);
        window.location.href = 'chat.html';
    } catch (err) {
        if (errorEl) errorEl.textContent = 'Tidak dapat terhubung ke server.';
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

/**
 * Kirim daftar akun ke backend lalu arahkan ke chat.
 */
async function submitRegister() {
    const body = { username: '', password: '', name: '', age: '', gender: '', occupation: '' };
    body.username = document.getElementById('authUsername').value.trim();
    body.password = document.getElementById('authPassword').value;

    const profile = collectRegisterProfile();
    body.name = profile.name;
    body.age = profile.age;
    body.gender = profile.gender;
    body.occupation = profile.occupation;

    const errorEl = document.getElementById('authError');
    const btnSubmit = document.getElementById('btn-auth-submit');

    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const res = await fetch('/api/chat/auth/register/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (errorEl) errorEl.textContent = data.detail || 'Terjadi kesalahan. Coba lagi.';
            return;
        }

        // Berhasil — simpan profil akun lalu langsung menuju chat.
        setCurrentAuthState(true);
        if (modals['authModal']) modals['authModal'].hide();
        renderLoggedInNav(body.username);
        storeAccountProfile(data.profile);
        window.location.href = 'chat.html';
    } catch (err) {
        if (errorEl) errorEl.textContent = 'Tidak dapat terhubung ke server.';
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

/**
 * Handler tombol submit form auth.
 *
 * - Mode login: langsung kirim login.
 * - Mode daftar: tombol "Lanjut" memvalidasi langkah aktif lalu menggeser
 *   ke langkah berikutnya; hanya di langkah terakhir tombol "Daftar" yang
 *   benar-benar mengirim registrasi.
 */
function handleAuthSubmit() {
    const errorEl = document.getElementById('authError');
    if (errorEl) errorEl.textContent = '';

    if (authMode === 'login') {
        submitLogin();
        return;
    }

    const error = validateAuthStep(registerStep);
    if (error) {
        if (errorEl) errorEl.textContent = error;
        return;
    }

    if (registerStep < REGISTER_TOTAL_STEPS) {
        goAuthStep(registerStep + 1);
        return;
    }

    submitRegister();
}

/**
 * Keluar dari sesi lalu kembali ke tampilan awal.
 */
async function logout() {
    try {
        await fetch('/api/chat/auth/logout/', {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() },
            credentials: 'same-origin',
        });
    } catch (err) {
        // Tetap render tampilan logout meskipun jaringan bermasalah
    }
    setCurrentAuthState(false);
    renderLoggedOutNav();
}

/**
 * Handler tombol "Mulai bercerita".
 *
 * Jika user belum login (atau status login belum diketahui), tampilkan
 * peringatan bahwa riwayat tidak akan tersimpan. User bisa memilih
 * "Lanjut tanpa login" atau "Masuk / Daftar".
 */
async function handleStartTelling() {
    // Cek login secara pasti sebelum memutuskan
    let authenticated = currentAuthState;
    if (authenticated === null) {
        try {
            const res = await fetch('/api/chat/auth/me/', { credentials: 'same-origin' });
            const data = await res.json();
            authenticated = !!(data && data.authenticated);
            setCurrentAuthState(authenticated);
            if (authenticated) {
                renderLoggedInNav(data.username);
                storeAccountProfile(data.profile);
            }
        } catch (err) {
            authenticated = false;
        }
    }

    if (authenticated) {
        // Pengguna sudah login → langsung menuju chat, TIDAK perlu
        // mengisi form identitas lagi. Profil akun sudah tersimpan di
        // sessionStorage; kalau belum, ambil dari server.
        if (!sessionStorage.getItem('userProfile')) {
            try {
                const res = await fetch('/api/chat/auth/me/', { credentials: 'same-origin' });
                const data = await res.json();
                if (data && data.profile) storeAccountProfile(data.profile);
            } catch (err) {
                // Profil kosong pun chat tetap berjalan.
            }
        }
        window.location.href = 'chat.html';
        return;
    }

    if (modals['historyWarningModal']) {
        modals['historyWarningModal'].show();
    } else {
        // Fallback bila modal tidak tersedia — langsung buka identitas.
        openIdentityModal();
    }
}

/** Lanjut tanpa login — tutup peringatan lalu buka form identitas. */
function continueAnonymous() {
    if (modals['historyWarningModal']) modals['historyWarningModal'].hide();
    openIdentityModal();
}

/** Buka form login/daftar dari peringatan. */
function openAuthForStart() {
    if (modals['historyWarningModal']) modals['historyWarningModal'].hide();
    if (modals['authModal']) modals['authModal'].show();
}

/**
 * Membuka modal identitas ketika tombol "Mulai bercerita" diklik.
 * Fokus otomatis ke field nama agar pengguna langsung siap mengisi.
 */
function openIdentityModal() {
    if (modals['identityModal']) {
        modals['identityModal'].show();

        // Fokus ke nama setelah modal selesai bertransisi
        setTimeout(() => {
            const nameField = document.getElementById('userName');
            if (nameField) nameField.focus();
        }, 350);
    }
}

/**
 * Pengguna memilih melewati pengisian identitas.
 * Session dimulai tanpa profil.
 */
function skipToChat() {
    if (modals['identityModal']) modals['identityModal'].hide();

    sessionStorage.setItem('userProfile', JSON.stringify({
        name: '', age: '', gender: '', occupation: '', isAnonymous: true
    }));

    window.location.href = 'chat.html';
}

/**
 * Pengguna mengisi identitas dan memilih Lanjut.
 * Data disimpan ke sessionStorage sebagai konteks percakapan.
 */
function continueToChat() {
    const name       = document.getElementById('userName').value.trim();
    const age        = document.getElementById('userAge').value.trim();
    const gender     = document.getElementById('userGender').value.trim();
    const occupation = document.getElementById('userJob').value.trim();

    // Validasi input
    const errors = [];

    if (name) {
        const nameLower = name.toLowerCase();
        const invalidNames = ['halo', 'hai', 'test', 'admin', 'anonim', 'user', 'aku', 'saya'];
        if (name.length < 2) errors.push("Nama terlalu pendek (minimal 2 huruf).");
        if (/\d/.test(name)) errors.push("Nama tidak boleh mengandung angka.");
        if (invalidNames.includes(nameLower)) errors.push("Silakan gunakan nama yang valid, bukan kata sapaan atau umum.");
    }

    if (age) {
        const ageNum = parseInt(age, 10);
        if (isNaN(ageNum) || ageNum < 10 || ageNum > 100) {
            errors.push("Usia tidak valid (Harap masukkan antara 10 - 100 tahun).");
        }
    }

    if (occupation) {
        const jobLower = occupation.toLowerCase();
        const invalidJobs = ['halo', 'test', 'tidak ada', 'kosong'];
        if (occupation.length < 3) errors.push("Deskripsi pekerjaan terlalu singkat.");
        if (/^\d+$/.test(occupation)) errors.push("Pekerjaan tidak boleh hanya berisi angka.");
        if (invalidJobs.includes(jobLower)) errors.push("Silakan masukkan pekerjaan/kesibukan yang valid.");
    }

    if (errors.length > 0) {
        alert("Mohon perbaiki isian Anda:\n\n- " + errors.join("\n- "));
        return;
    }

    const profile = {
        name,
        age: age ? parseInt(age, 10) : null,
        gender,
        occupation,
        isAnonymous: (!name && !age && !gender && !occupation)
    };

    sessionStorage.setItem('userProfile', JSON.stringify(profile));

    if (modals['identityModal']) modals['identityModal'].hide();

    window.location.href = 'chat.html';
}

/**
 * Utility untuk membuka modal umum
 */
function openModal(modalId) {
    if (modals[modalId]) {
        modals[modalId].show();
    }
}

/**
 * Utility untuk menutup modal umum
 */
function closeModal(modalId) {
    if (modals[modalId]) {
        modals[modalId].hide();
    }
}
