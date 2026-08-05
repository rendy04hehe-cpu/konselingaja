# DATABASE.md

# Teman Bicara AI

Database Design

Version 1.0

---

# Philosophy

Karena aplikasi tidak menggunakan login, seluruh data percakapan berbasis Session ID.

Setiap pengguna dianggap anonim.

Identitas yang diisi hanya digunakan sebagai konteks percakapan.

---

# Database

PostgreSQL

---

# Tables

## Session

Menyimpan satu sesi percakapan.

Fields

id

UUID

primary key

session_id

UUID

unique

created_at

timestamp

last_activity

timestamp

ended_at

timestamp nullable

status

active

ended

expired

---

## User Profile

Data opsional.

Fields

id

UUID

session

Foreign Key

name

varchar(100)

nullable

age

integer

nullable

gender

varchar(30)

nullable

occupation

varchar(100)

nullable

created_at

timestamp

Semua field boleh kosong.

---

## Conversation

Satu sesi dapat memiliki banyak percakapan.

Fields

id

UUID

session

Foreign Key

created_at

timestamp

updated_at

timestamp

---

## Message

Seluruh isi chat.

Fields

id

UUID

conversation

Foreign Key

role

enum

user

assistant

content

text

token_count

integer

nullable

created_at

timestamp

---

## Emotion Analysis

Hasil analisis emosi AI.

Tidak digunakan untuk diagnosis.

Hanya membantu AI memahami konteks.

Fields

id

UUID

message

Foreign Key

primary_emotion

varchar

emotion_score

float

created_at

timestamp

Contoh:

Sedih

Cemas

Marah

Lelah

Kecewa

Bingung

Bahagia

Tenang

---

## Recommendation

Riwayat rekomendasi profesional yang pernah ditampilkan.

Fields

id

UUID

session

Foreign Key

recommendation_type

varchar

reason

text

shown_at

timestamp

dismissed

boolean

---

## Feedback

Masukan pengguna setelah sesi selesai.

Fields

id

UUID

session

Foreign Key

rating

integer

comment

text

nullable

created_at

timestamp

---

# Relationship

Session

↓

User Profile

↓

Conversation

↓

Message

↓

Emotion Analysis

Session

↓

Recommendation

Session

↓

Feedback

---

# Session Lifecycle

Website dibuka.

↓

Session dibuat.

↓

User mengisi identitas (opsional).

↓

Chat dimulai.

↓

Semua pesan disimpan.

↓

Jika tidak ada aktivitas selama 30 menit, sesi dapat dianggap berakhir (durasi dapat disesuaikan).

↓

Session selesai.

---

# AI Context

Setiap request AI menerima:

User Profile

Conversation History

Emotion History

Current Message

Prompt System

---

# Privacy

Tidak meminta email.

Tidak meminta nomor telepon.

Tidak meminta alamat.

Tidak meminta NIK.

Tidak meminta informasi sensitif yang tidak diperlukan.

Semua identitas bersifat opsional.

---

# Data Retention

Sediakan mekanisme untuk menghapus sesi lama secara otomatis sesuai kebijakan privasi aplikasi.

Pengguna juga sebaiknya dapat menghapus percakapannya selama sesi masih aktif.

---

# Future Tables

Mood Entry

Conversation Summary

Reflection

Journal

Favorite Quotes

AI Memory

Professional Recommendation

Analytics

Anonymous Statistics

Multilingual Translation