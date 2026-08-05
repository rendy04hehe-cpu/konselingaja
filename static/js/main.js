/* ===========================================
   TEMAN BICARA AI — main.js
   Landing page & Identity Modal logic
   =========================================== */

'use strict';

/* Simpan referensi semua modal */
const modals = {};

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi semua modal sekaligus
    ['identityModal', 'aboutModal', 'termsModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            modals[id] = new bootstrap.Modal(el, {
                backdrop: true,
                keyboard: id !== 'identityModal', // About & Terms bisa ditutup ESC
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

    // Tekan Enter di dalam form = Lanjut
    const identityForm = document.getElementById('identityForm');
    if (identityForm) {
        identityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            continueToChat();
        });
    }
});

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
