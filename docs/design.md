# DESIGN.md
> Version: 1.0
> Project: Teman Bicara AI
> Design Philosophy: Less is More

---

# Design Vision

Teman Bicara AI bukan sekadar chatbot.

Website ini adalah ruang yang tenang.

Ketika pengguna membuka halaman pertama, mereka harus merasa seperti memasuki sebuah ruangan yang sunyi, aman, dan tidak menghakimi.

Tidak ada distraksi.

Tidak ada elemen yang berlebihan.

Tidak ada warna mencolok.

Semua keputusan desain harus membuat pengguna lebih fokus terhadap dirinya sendiri dan percakapannya.

Prinsip utama:

> "A calm space to think, feel, and be heard."

---

# Core Principles

## Less is More

Hilangkan semua elemen yang tidak memiliki tujuan jelas.

Setiap pixel harus memiliki alasan keberadaannya.

Jangan menambahkan icon, gambar, animasi, badge, statistik, ataupun dekorasi hanya untuk mempercantik tampilan.

Kesederhanaan adalah identitas utama.

---

## Content First

Konten adalah fokus utama.

Yang paling penting adalah:

- kata-kata pengguna
- respon AI

Bukan animasi.

Bukan ilustrasi.

Bukan efek visual.

---

## Calm Experience

Semua interaksi harus terasa tenang.

Tidak ada:

❌ popup besar

❌ loading mencolok

❌ warna terang

❌ animasi berlebihan

Semua transisi:

- lembut
- halus
- natural

---

## Emotional Safety

Website harus terasa aman.

Pengguna tidak boleh merasa:

- dihakimi
- ditekan
- dipaksa

Desain harus memberi ruang bernapas.

Gunakan white space sebanyak mungkin.

---

# Design Language

Keywords

Minimal

Quiet

Elegant

Warm

Human

Professional

Accessible

Comfortable

Timeless

Zen

---

# Color Palette

Gunakan monochromatic palette.

Jangan menggunakan banyak warna.

Background

#FAFAFA

Surface

#FFFFFF

Primary Text

#111111

Secondary Text

#6B7280

Muted

#9CA3AF

Border

#E5E7EB

Divider

#F1F1F1

Input Background

#F7F7F7

Hover

#EFEFEF

Shadow

rgba(0,0,0,.04)

Jika membutuhkan warna tambahan (misalnya status aktif), gunakan satu aksen lembut secara konsisten dan hindari warna yang terlalu mencolok.

---

# Typography

Font Family

Inter

Fallback

Helvetica Neue

Arial

sans-serif

Heading

48px

Weight 300

Line Height 1.2

Sub Heading

24px

Weight 400

Body

16px

Weight 400

Line Height 1.8

Small Text

14px

Button

15px

Weight 500

Letter spacing normal.

Tidak menggunakan font decorative.

---

# White Space

Whitespace adalah komponen utama.

Jangan memenuhi layar.

Gunakan ruang kosong.

Container

max-width: 760px

Desktop Padding

80px

Tablet

48px

Mobile

24px

Gap antar section minimal

80px

Gap antar paragraph

24px

Gap antar chat

32px

---

# Border Radius

Card

16px

Input

14px

Button

14px

Notification

16px

Tidak menggunakan radius ekstrem.

---

# Shadows

Shadow sangat tipis.

box-shadow:

0 8px 30px rgba(0,0,0,.04)

Tidak ada glow.

Tidak ada shadow besar.

---

# Buttons

Button sangat sederhana.

Primary

Background

#111111

Text

White

Hover

#222222

Secondary

Background

Transparent

Border

1px solid #E5E7EB

Hover

#F5F5F5

Tidak menggunakan gradient.

Tidak menggunakan icon besar.

---

# Inputs

Background

#F7F7F7

Border

1px solid transparent

Focus

1px solid #111111

Padding

16px

Placeholder

#9CA3AF

Input harus terasa ringan.

---

# Icons

Gunakan icon seminimal mungkin.

Jika memungkinkan gunakan teks.

Jangan menggunakan icon dekoratif.

Icon hanya digunakan jika benar-benar membantu pemahaman.

---

# Animations

Durasi

200–300ms

Timing

ease

Gunakan hanya:

Fade

Slide 8px

Opacity

Tidak boleh menggunakan:

Bounce

Zoom

Flip

Rotate

Pulse berlebihan

---

# Landing Page

Landing page harus sangat sederhana.

Komponen:

Logo kecil

Judul

Subjudul

Satu tombol utama

Disclaimer singkat

Tidak ada:

Gallery

Feature cards

Testimonials

Counters

Pricing

Banner

Video

Background image

Hero image

---

# Welcome Modal

Sebelum chat dimulai.

Tampilkan form identitas.

Semua field bersifat opsional.

Field:

Nama

Usia

Pekerjaan

Jenis Kelamin

Button:

Lewati

Lanjut

Background di-blur.

Tidak fullscreen.

---

# Chat Layout

Fokus utama aplikasi.

Container maksimal

760px

Header sangat kecil.

Tidak ada sidebar pada mobile.

Chat bubble AI:

Background putih.

Border tipis.

Chat bubble User:

Background #F7F7F7.

Tidak menggunakan warna mencolok.

---

# Greeting Experience

Setelah pengguna mengisi identitas (atau memilih melewati), AI harus memberikan sapaan pembuka yang terasa personal.

Jika nama tersedia:

Contoh:

"Halo, {nama}."

"Tidak semua hari terasa mudah."

"Aku senang kamu meluangkan waktu untuk hadir di sini."

"Bagaimana harimu hari ini?"

atau

"Selamat datang, {nama}."

"Semoga hari ini kamu menemukan sedikit ruang untuk bernapas."

"Apa yang ingin kamu ceritakan?"

Jika nama kosong:

"Selamat datang."

"Terima kasih sudah hadir."

"Aku siap mendengarkan."

Sapaan harus bervariasi agar tidak terasa seperti template.

---

# AI Response Style

Respon AI harus:

Empatik

Lembut

Hangat

Tidak menghakimi

Tidak menyalahkan

Tidak memberi diagnosis

Tidak memaksa

Tidak menggurui

AI lebih banyak bertanya daripada memberi solusi.

Selalu memvalidasi emosi pengguna.

Contoh:

"Aku bisa memahami mengapa situasi itu terasa berat."

"Terima kasih sudah mempercayaiku dengan cerita ini."

"Hal yang kamu rasakan terdengar sangat melelahkan."

---

# Recommendation Notification

Setelah percakapan cukup panjang atau AI mendeteksi bahwa pengguna mungkin memerlukan dukungan tambahan, tampilkan notifikasi kecil di pojok kanan bawah.

Ukuran kecil.

Tidak mengganggu.

Tidak menutupi chat.

Isi contoh:

"Jika kamu merasa membutuhkan dukungan lebih lanjut, berbicara dengan psikolog dapat menjadi langkah yang baik."

Tombol:

Lihat Informasi

Tutup

---

# Accessibility

Minimum font

16px

Kontras tinggi.

Keyboard accessible.

Screen reader friendly.

Touch target minimal

44px

Tidak menggunakan teks abu-abu yang terlalu pucat.

---

# Responsive

Desktop

760px container

Tablet

90%

Mobile

100%

Padding

24px

Semua komponen harus nyaman digunakan dengan satu tangan.

---

# What We Never Build

Jangan pernah menambahkan:

Dashboard yang ramai

Grafik berlebihan

Banner promosi

Animasi mencolok

Emoji besar

Confetti

Gradient berlebihan

Neon

Glassmorphism

Cyberpunk style

Gaming style

Dark mode sebagai tampilan utama (boleh menjadi opsi di masa depan)

---

# Emotional Design Goal

Setiap keputusan desain harus menjawab pertanyaan berikut:

> "Apakah ini membuat pengguna merasa lebih tenang?"

Jika jawabannya "tidak", maka elemen tersebut tidak perlu ada.

Target akhir bukan membuat website yang terlihat modern.

Target akhirnya adalah membuat pengguna merasa:

"Aku berada di tempat yang aman untuk didengar."