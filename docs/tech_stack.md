# TECH_STACK.md

Version 2.0

Project:
Teman Bicara AI

---

# Architecture

Monolithic Architecture

Frontend
↓
Django Backend
↓
Gemini API
↓
PostgreSQL

Semua komunikasi AI dilakukan melalui backend.

Frontend tidak pernah mengakses Gemini API secara langsung.

---

# Frontend

HTML5

Semantic HTML.

CSS3

Custom CSS sebagai fondasi utama.

Bootstrap 5.3

Digunakan hanya untuk:

- Grid
- Modal
- Form
- Utility classes

Desain akhir tetap mengikuti DESIGN.md.

JavaScript (ES6)

Digunakan untuk.

- Fetch API
- Chat UI
- Auto Scroll
- Typing Indicator
- Notification
- Session Handling
- Markdown Rendering

Tidak menggunakan.

React

Vue

Angular

---

# Backend

Python 3.13+

Django 5+

Django REST Framework

Gunakan REST API untuk komunikasi frontend.

---

# AI

Provider

Google Gemini

Model Default

gemini-2.5-flash

Model cadangan dapat dikonfigurasi melalui environment variable.

Semua prompt dibangun di backend menggunakan:

- System Prompt
- AI Behavior
- Personality
- Conversation History
- User Context

---

# Database

PostgreSQL

Gunakan UUID sebagai primary key untuk seluruh tabel utama.

---

# Session

Anonymous Session

Tidak ada login.

Setiap pengguna memperoleh Session ID unik.

Profil bersifat opsional.

---

# AI Context

Setiap request ke Gemini berisi:

- System Prompt
- Personality
- AI Behavior
- Profil Pengguna (opsional)
- Riwayat Percakapan
- Pesan Terbaru

---

# Markdown

Respons Gemini menggunakan Markdown.

Frontend merender Markdown secara aman menggunakan DOMPurify + Marked.js.

---

# HTTP

Fetch API

JSON

HTTPS

---

# Security

Environment Variables

HTTPS

CSRF Protection

XSS Sanitization

Rate Limiting

Input Validation

Content Security Policy

---

# Storage

Static Files

Django Static

Media Files

Django Media

---

# Deployment

Railway

PostgreSQL Railway

Gunicorn

WhiteNoise

---

# Development Tools

Git

GitHub

Visual Studio Code

Ruff

Black

Prettier

---

# Environment Variables

SECRET_KEY

DEBUG

DATABASE_URL

GEMINI_API_KEY

GEMINI_MODEL

ALLOWED_HOSTS

---

# Future Roadmap

PWA

Speech to Text

Text to Speech

Conversation Summary

Emotion Timeline

AI Memory

Export Conversation

Multi-language Support

Offline Cache