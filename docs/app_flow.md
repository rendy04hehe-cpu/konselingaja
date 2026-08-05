# APP_FLOW.md

# Teman Bicara AI

Application Flow

Version 1.0

---

# Main Flow

Landing Page

↓

Klik "Mulai"

↓

Modal Identitas

↓

Lewati

atau

Isi Data

↓

Masuk Chat

↓

AI Greeting

↓

Percakapan

↓

Notifikasi Profesional (jika diperlukan)

↓

Percakapan Selesai

---

# Landing Page

User membuka website.

Halaman hanya memiliki:

Logo

Judul

Deskripsi singkat

Button Mulai

Disclaimer

Tujuan halaman ini hanya satu:

Mengajak pengguna memulai percakapan.

---

# Identity Modal

Sebelum chat dimulai.

Semua field bersifat opsional.

Field:

Nama

Usia

Jenis Kelamin

Pekerjaan

Button:

Lewati

Lanjut

Jika kosong:

AI tetap berjalan.

Jika diisi:

Informasi digunakan sebagai konteks percakapan.

---

# Greeting Flow

Jika nama tersedia.

AI menyapa pengguna menggunakan nama.

Contoh:

"Halo, Rendy."

"Semoga hari ini kamu menemukan sedikit ruang untuk bernapas."

"Apa yang ingin kamu ceritakan?"

Jika nama kosong.

AI menyapa secara umum.

"Selamat datang."

"Aku siap mendengarkan."

Greeting harus berbeda setiap sesi.

---

# Chat Flow

User mengirim pesan.

↓

Frontend mengirim request.

↓

Backend menerima.

↓

Backend menyusun prompt.

↓

Prompt dikirim ke AI.

↓

AI memberikan response.

↓

Backend menyimpan percakapan.

↓

Frontend menampilkan jawaban.

↓

Scroll otomatis ke bawah.

---

# Conversation Memory

Setiap pesan disimpan.

Context beberapa pesan sebelumnya dikirim kembali ke AI agar percakapan tetap nyambung.

---

# AI Behaviour

AI selalu:

Mendengarkan

Memvalidasi emosi

Memberikan ruang

Mengajukan pertanyaan reflektif

Tidak:

Menghakimi

Memberi diagnosis

Memberi obat

Menyalahkan pengguna

---

# Recommendation Flow

Backend menganalisis isi percakapan.

Jika ditemukan pola seperti:

Stress berkepanjangan

Kecemasan

Burnout

Kesedihan yang menetap

Maka frontend menampilkan notifikasi kecil.

Contoh:

"Kalau kamu merasa membutuhkan dukungan tambahan, berbicara dengan psikolog dapat menjadi langkah yang baik."

Button:

Lihat Informasi

Tutup

Notifikasi hanya muncul sekali dalam satu sesi.

---

# Crisis Flow

Jika AI mendeteksi kemungkinan risiko tinggi (misalnya pengguna menyatakan ingin menyakiti diri sendiri atau orang lain), backend mengaktifkan mode respons krisis.

↓

AI memberikan respons yang empatik.

↓

Frontend menampilkan kartu bantuan yang tidak menutupi percakapan.

↓

Pengguna diberikan pilihan untuk melihat informasi bantuan profesional atau layanan darurat yang sesuai.

↓

Pengguna tetap dapat melanjutkan percakapan.

---

# End Session

User dapat:

Refresh

atau

Klik

Percakapan Baru

↓

Context dihapus.

↓

AI kembali ke greeting awal.

---

# Future Flow

Mood Tracker

↓

Emotion Timeline

↓

Weekly Reflection

↓

Conversation Summary

↓

Export PDF

↓

Voice Conversation

↓

PWA Offline Mode