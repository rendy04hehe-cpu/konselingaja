/**
 * ==============================================
 * TEMAN BICARA AI — chat.js (Refactored)
 * ==============================================
 */

'use strict';

/**
 * Constants & Configuration
 */
const CONFIG = {
    API_URL: '/api/chat/',
    ANALYZE_URL: '/api/chat/analyze/',
    ANALYSIS_TRIGGER: 3,
    REC_DELAY: 1500,
    CRISIS_KEYWORDS: [
        'bunuh diri', 'menyakiti diri', 'tidak ingin hidup', 'ingin mati',
        'sudah tidak kuat', 'tidak sanggup lagi', 'ingin mengakhiri',
        'menyakiti orang', 'nyakitin diri', 'nyakitin orang',
    ]
};

/**
 * Utilities
 */
class Utils {
    static getCsrfToken() {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        return match ? match[1] : '';
    }

    static createSessionId() {
        if (crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static now() {
        return new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }
}

/**
 * API Service for Backend Communication
 */
class ChatService {
    constructor(sessionId, profile) {
        this.sessionId = sessionId;
        this.profile = profile;
    }

    async sendMessage(message, history, onChunk) {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': Utils.getCsrfToken(),
            },
            body: JSON.stringify({ message, history, profile: this.profile }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || contentType.includes('application/json')) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.reply || data.detail || `HTTP error ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            onChunk(decoder.decode(value, { stream: true }));
        }
    }

    async triggerAnalysis(history) {
        try {
            const res = await fetch(CONFIG.ANALYZE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': Utils.getCsrfToken(),
                },
                body: JSON.stringify({ history, profile: this.profile, session_id: this.sessionId }),
            });
            const data = await res.json().catch(() => ({}));
            return data && data.recommend;
        } catch (err) {
            console.error('[Teman Bicara] Analisis gagal:', err);
            return false;
        }
    }
}

/**
 * Crisis Detection Strategy
 */
class CrisisDetector {
    static detect(text) {
        const lower = text.toLowerCase();
        return CONFIG.CRISIS_KEYWORDS.some(kw => lower.includes(kw));
    }
}

/**
 * UI Component Builder
 */
class UIRenderer {
    static createMessageRow(role, text, isMarkdown = false) {
        const row = document.createElement('div');
        row.className = `msg-row ${role}`;
        
        const sender = document.createElement('span');
        sender.className = 'msg-sender';
        sender.textContent = role === 'ai' ? 'Teman Bicara' : 'Kamu';
        
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        UIRenderer.updateBubbleContent(bubble, text, isMarkdown);
        
        const time = document.createElement('span');
        time.className = 'msg-time';
        time.textContent = Utils.now();
        
        row.appendChild(sender);
        row.appendChild(bubble);
        row.appendChild(time);
        return { row, bubble };
    }

    static updateBubbleContent(bubble, text, isMarkdown) {
        if (isMarkdown && typeof DOMPurify !== 'undefined' && typeof marked !== 'undefined') {
            bubble.innerHTML = DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true }));
        } else {
            bubble.textContent = text;
        }
    }

    static createTypingIndicator() {
        const row = document.createElement('div');
        row.className = 'typing-row';
        row.id = 'typing-row';
        const bubble = document.createElement('div');
        bubble.className = 'typing-bubble';
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.className = 'typing-dot';
            bubble.appendChild(dot);
        }
        row.appendChild(bubble);
        return row;
    }
}

/**
 * Main Chat Application Class
 */
class ChatApp {
    constructor() {
        this.state = this.getInitialState();
        this.service = new ChatService(this.state.sessionId, this.state.profile);
        this.dom = {
            thread: document.getElementById('chat-thread'),
            input: document.getElementById('chat-input'),
            btnSend: document.getElementById('btn-send'),
            main: document.getElementById('chat-main')
        };
        this.init();
    }

    getInitialState() {
        let profile = {};
        try {
            const raw = sessionStorage.getItem('userProfile');
            profile = raw ? JSON.parse(raw) : {};
        } catch { }

        return {
            profile,
            messages: [],
            isWaiting: false,
            recShown: false,
            analysisTriggered: false,
            messageCount: 0,
            sessionId: Utils.createSessionId()
        };
    }

    async init() {
        this.setupTextarea();
        this.showThreadHeader();
        this.exposeGlobals();
        // Auto-save saat keluar halaman (back, klik Kembali, tutup tab,
        // pindah halaman) — percakapan terakhir otomatis masuk riwayat.
        window.addEventListener('pagehide', () => this.onPageExit());
        // Cek login dulu — auto-save hanya aktif untuk user login.
        // `isLoggedIn` pasti terisi sebelum greeting muncul (12 detik max),
        // jadi tidak ada race antara kirim pesan pertama dan status login.
        await this.initAuthState();
        this.showGreeting();
    }

    exposeGlobals() {
        window.handleSend = () => this.handleSend();
        window.startNewConversation = () => this.startNewConversation();
        window.showRecommendation = () => this.showRecommendation();
        window.dismissRecCard = () => this.dismissRecCard();
        window.showPsychologistInfo = () => this.showPsychologistInfo();
        window.closePsychologistInfo = () => this.closePsychologistInfo();
        window.openHistoryDrawer = () => this.openHistoryDrawer();
        window.closeHistoryDrawer = () => this.closeHistoryDrawer();
        window.loadConversation = (id, title) => this.loadConversation(id, title);
        window.deleteHistoryItem = (id) => this.deleteHistoryItem(id);
        window.logoutChat = () => this.logoutChat();
    }

    /** Cek status login. Auto-save aktif hanya untuk user login. */
    async initAuthState() {
        try {
            const res = await fetch('/api/chat/auth/me/', { credentials: 'same-origin' });
            const data = await res.json();
            if (data && data.authenticated) {
                this.isLoggedIn = true;
                // Profil akun (nama, umur, jenis kelamin, pekerjaan) dipakai
                // sebagai konteks percakapan. Kalau belum tersimpan di
                // sessionStorage (mis. buka chat.html langsung), ambil dari server.
                if (data.profile && !sessionStorage.getItem('userProfile')) {
                    const accountProfile = {
                        name: data.profile.name || '',
                        age: data.profile.age != null ? data.profile.age : '',
                        gender: data.profile.gender || '',
                        occupation: data.profile.occupation || '',
                        isAnonymous: false,
                    };
                    sessionStorage.setItem('userProfile', JSON.stringify(accountProfile));
                    this.state.profile = accountProfile;
                    this.service = new ChatService(this.state.sessionId, this.state.profile);
                }
            } else {
                this.isLoggedIn = false;
            }
        } catch (err) {
            this.isLoggedIn = false;
        }
    }

    setupTextarea() {
        this.dom.input.addEventListener('input', () => {
            this.dom.input.style.height = 'auto';
            this.dom.input.style.height = this.dom.input.scrollHeight + 'px';
            this.dom.btnSend.disabled = this.dom.input.value.trim().length === 0;
        });

        this.dom.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.dom.btnSend.disabled && !this.state.isWaiting) {
                    this.handleSend();
                }
            }
        });
    }

    scrollToBottom() {
        if (this.dom.main) {
            this.dom.main.scrollTo({ top: this.dom.main.scrollHeight, behavior: 'smooth' });
        }
    }

    addMessage(role, text) {
        // 'assistant' (dari server/history) dan 'ai' (bubble lokal) sama-sama
        // dirender dengan gaya pesan AI.
        const uiRole = role === 'assistant' ? 'ai' : role;
        const { row, bubble } = UIRenderer.createMessageRow(uiRole, text, uiRole === 'ai');
        this.dom.thread.appendChild(row);
        this.scrollToBottom();
        return bubble;
    }

    showTyping() {
        if (!document.getElementById('typing-row')) {
            this.dom.thread.appendChild(UIRenderer.createTypingIndicator());
            this.scrollToBottom();
        }
    }

    removeTyping() {
        const el = document.getElementById('typing-row');
        if (el) el.remove();
    }

    showThreadHeader() {
        const header = document.createElement('div');
        header.className = 'thread-header';
        header.innerHTML = `
            <div class="encryption-notice">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                Percakapan aman &amp; anonim
            </div>
            <div class="date-divider">Hari ini</div>
        `;
        this.dom.thread.appendChild(header);
    }

    showGreeting() {
        const name = this.state.profile?.name?.trim();
        const pool = name 
            ? [`Halo, ${name}.\n\nTidak semua hari terasa mudah. Aku senang kamu meluangkan waktu untuk hadir di sini.\n\nBagaimana harimu hari ini?`]
            : [`Selamat datang.\n\nTerima kasih sudah hadir di sini hari ini. Aku siap mendengarkan.\n\nApa yang ingin kamu ceritakan?`];
        
        const text = pool[Math.floor(Math.random() * pool.length)];

        this.showTyping();
        setTimeout(() => {
            this.removeTyping();
            this.addMessage('ai', text);
            this.state.messages.push({ role: 'assistant', content: text });
            if (this.state.messageCount === 0) this.showQuickStarters();
        }, 1200);
    }

    showQuickStarters() {
        if (document.getElementById('quick-starters')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'quick-starters';
        wrapper.id = 'quick-starters';
        
        ["Aku merasa cemas...", "Banyak pikiran hari ini", "Hanya butuh didengarkan"].forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'starter-chip';
            btn.textContent = text;
            btn.onclick = () => {
                this.dom.input.value = text;
                this.dom.btnSend.disabled = false;
                this.dom.input.focus();
            };
            wrapper.appendChild(btn);
        });
        
        this.dom.thread.appendChild(wrapper);
        this.scrollToBottom();
    }

    removeQuickStarters() {
        const el = document.getElementById('quick-starters');
        if (el) el.remove();
    }

    async handleSend() {
        const text = this.dom.input.value.trim();
        if (!text || this.state.isWaiting) return;

        this.addMessage('user', text);
        this.state.messages.push({ role: 'user', content: text });
        this.state.messageCount++;
        this.removeQuickStarters();

        this.dom.input.value = '';
        this.dom.input.style.height = 'auto';
        this.dom.btnSend.disabled = true;
        this.dom.input.focus();

        if (CrisisDetector.detect(text)) {
            this.handleCrisis();
        }

        this.processMessageWithAI(text);
        this.checkBackgroundAnalysis();
    }

    async processMessageWithAI(text) {
        this.state.isWaiting = true;
        this.showTyping();
        
        try {
            const history = this.state.messages.slice(-10);
            let reply = '';
            let bubble = null;
            
            await this.service.sendMessage(text, history, (chunk) => {
                this.removeTyping();
                if (!bubble) bubble = this.addMessage('ai', '');
                reply += chunk;
                UIRenderer.updateBubbleContent(bubble, reply, true);
                this.scrollToBottom();
            });
            
            this.state.messages.push({ role: 'assistant', content: reply });
        } catch (err) {
            this.removeTyping();
            this.addMessage('ai', `Terjadi kesalahan: ${err.message}. Silakan coba lagi.`);
        } finally {
            this.state.isWaiting = false;
            this.scrollToBottom();
        }
    }

    checkBackgroundAnalysis() {
        if (!this.state.analysisTriggered && this.state.messageCount >= CONFIG.ANALYSIS_TRIGGER) {
            this.state.analysisTriggered = true;
            this.service.triggerAnalysis(this.state.messages).then(recommend => {
                if (recommend && !this.state.recShown) {
                    setTimeout(() => this.showRecommendation(), CONFIG.REC_DELAY);
                }
            });
        }
    }

    handleCrisis() {
        const card = document.createElement('div');
        card.className = 'crisis-card';
        card.innerHTML = `
            <p class="crisis-card-title">Bantuan tersedia untuk kamu</p>
            <p class="crisis-card-body">Jika kamu sedang dalam situasi yang terasa sangat berat, ada orang-orang yang siap membantu.</p>
            <div class="crisis-card-links">
                <a class="crisis-link" href="tel:119">Hotline 119 ext 8</a>
                <a class="crisis-link" href="https://www.intothelightid.org" target="_blank">Into The Light</a>
            </div>
        `;
        this.dom.thread.appendChild(card);
        this.scrollToBottom();
    }

    showRecommendation() {
        if (this.state.recShown) return;
        this.state.recShown = true;

        const card = document.createElement('div');
        card.className = 'rec-card';
        card.innerHTML = `
            <div class="rec-card-body">
                <p class="rec-card-title">Kamu tidak harus menghadapi ini sendirian</p>
            </div>
            <div class="rec-card-actions">
                <button class="rec-card-btn" type="button" onclick="showPsychologistInfo()">Lihat informasi</button>
                <button class="rec-card-close" type="button" onclick="dismissRecCard()">&times;</button>
            </div>
        `;
        this.dom.thread.appendChild(card);
        setTimeout(() => card.classList.add('visible'), 50);
    }

    dismissRecCard() {
        const card = document.querySelector('.rec-card');
        if (card) {
            card.classList.remove('visible');
            setTimeout(() => card.remove(), 300);
        }
    }

    showPsychologistInfo() {
        this.dismissRecCard();
        this.closePsychologistInfo();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'psych-modal';
        modal.innerHTML = `
            <div class="modal-card">
                <button class="modal-close" type="button" onclick="closePsychologistInfo()">&times;</button>
                <h2 class="modal-title">Dukungan profesional</h2>
                <div class="modal-item"><h3 class="modal-item-title">Psikolog</h3></div>
                <button class="modal-done" type="button" onclick="closePsychologistInfo()">Mengerti</button>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('visible'), 50);
    }

    closePsychologistInfo() {
        const modal = document.getElementById('psych-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => modal.remove(), 300);
        }
    }

    async startNewConversation() {
        if (!confirm('Mulai percakapan baru?')) return;

        // Simpan otomatis percakapan lama sebelum memulai ruang baru,
        // agar tetap masuk riwayat meski user belum menutup halaman.
        await this.saveCurrentChat({ silent: true });

        this.state = this.getInitialState();
        this.service = new ChatService(this.state.sessionId, this.state.profile);
        this.dom.thread.innerHTML = '';
        this.dismissRecCard();
        this.closePsychologistInfo();
        this.showGreeting();
        this.dom.input.focus();
    }

    /* ===========================================
       Riwayat Percakapan (login)
       =========================================== */

    /** Simpan percakapan berjalan ke akun user. */
    async saveCurrentChat({ silent = false, keepalive = false } = {}) {
        if (!this.isLoggedIn) {
            if (!silent) window.location.href = '/';
            return false;
        }
        if (this.state.messages.length === 0) {
            if (!silent) this.showToast('Belum ada percakapan untuk disimpan.');
            return false;
        }

        const saved = await this.saveToServer(this.state.sessionId, keepalive);
        if (saved) {
            if (!silent) this.showToast('Percakapan disimpan.');
            return true;
        }

        // Session lama sudah dihapus/kedaluwarsa (404) — coba sekali lagi
        // dengan session baru agar percakapan tetap tersimpan.
        if (this.saveAttempted) return false;
        this.saveAttempted = true;
        this.state.sessionId = Utils.createSessionId();
        this.service = new ChatService(this.state.sessionId, this.state.profile);
        const retried = await this.saveToServer(this.state.sessionId, keepalive);
        if (retried) {
            if (!silent) this.showToast('Percakapan disimpan.');
        } else if (!silent) {
            this.showToast('Gagal menyimpan percakapan.');
        }
        this.saveAttempted = false;
        return retried;
    }

    /** Kirim pesan sesi ke endpoint save. Mengembalikan true bila sukses. */
    async saveToServer(sessionId, keepalive = false) {
        const title = this.buildChatTitle();

        try {
            const res = await fetch('/api/chat/history/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': Utils.getCsrfToken(),
                },
                credentials: 'same-origin',
                keepalive: !!keepalive,
                body: JSON.stringify({
                    session_id: sessionId,
                    title,
                    messages: this.state.messages,
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) return false;

            // Ikuti session_id yang disimpan server
            this.state.sessionId = data.session_id || sessionId;
            return true;
        } catch (err) {
            return false;
        }
    }

    /** Auto-save saat halaman ditinggalkan/ditutup. */
    onPageExit() {
        if (this._exitSaveStarted) return;
        this._exitSaveStarted = true;
        // keepalive memastikan fetch tetap dikirim meski halaman sedang
        // unload. Hasilnya tidak bisa ditunggu di sini — browser membersihkan
        // halaman setelah unload.
        this.saveCurrentChat({ silent: true, keepalive: true });
    }

    /** Judul otomatis dari pesan user pertama. */
    buildChatTitle() {
        const firstUser = this.state.messages.find(m => m.role === 'user');
        if (!firstUser) return 'Percakapan';
        const text = firstUser.content.replace(/\s+/g, ' ').trim();
        return text.length > 60 ? text.slice(0, 60) + '…' : text;
    }

    /** Buka drawer riwayat. */
    async openHistoryDrawer() {
        const overlay = document.getElementById('history-overlay');
        const body = document.getElementById('history-body');
        if (!overlay || !body) return;

        // Cek login dulu
        let authenticated = this.isLoggedIn;
        if (!authenticated) {
            try {
                const res = await fetch('/api/chat/auth/me/', { credentials: 'same-origin' });
                const data = await res.json();
                authenticated = !!(data && data.authenticated);
            } catch (err) {
                authenticated = false;
            }
        }

        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');

        if (!authenticated) {
            body.innerHTML = `
                <div class="history-login-prompt">
                    <p>Masuk untuk melihat dan menyimpan riwayat percakapanmu.</p>
                    <a class="history-login-btn" href="/">Masuk</a>
                </div>
            `;
            return;
        }

        body.innerHTML = '<div class="history-empty">Memuat...' + '</div>';

        try {
            const res = await fetch('/api/chat/history/', { credentials: 'same-origin' });
            const data = await res.json().catch(() => ({}));
            const sessions = (data && data.sessions) || [];

            if (sessions.length === 0) {
                body.innerHTML = '<div class="history-empty">Belum ada percakapan tersimpan.</div>';
                return;
            }

            body.innerHTML = '';
            sessions.forEach(s => {
                body.appendChild(this.createHistoryItem(s));
            });
        } catch (err) {
            body.innerHTML = '<div class="history-empty">Gagal memuat riwayat.</div>';
        }
    }

    createHistoryItem(session) {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');

        const main = document.createElement('div');
        main.className = 'history-item-main';

        const title = document.createElement('div');
        title.className = 'history-item-title';
        title.textContent = session.title || 'Percakapan';

        const meta = document.createElement('div');
        meta.className = 'history-item-meta';
        const date = session.updated_at
            ? new Date(session.updated_at).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric'
              })
            : '';
        const count = session.message_count || 0;
        meta.textContent = `${date} · ${count} pesan`;

        main.appendChild(title);
        main.appendChild(meta);

        const delBtn = document.createElement('button');
        delBtn.className = 'history-item-delete';
        delBtn.type = 'button';
        delBtn.setAttribute('aria-label', 'Hapus percakapan');
        delBtn.textContent = '×';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteHistoryItem(session.session_id, item);
        };

        const openHandler = () => this.loadConversation(session.session_id, session.title);
        item.addEventListener('click', openHandler);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openHandler();
            }
        });

        item.appendChild(main);
        item.appendChild(delBtn);
        return item;
    }

    /** Muat satu percakapan dari server ke thread. */
    async loadConversation(sessionId, title) {
        try {
            const res = await fetch(`/api/chat/history/${sessionId}/`, {
                credentials: 'same-origin',
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                this.showToast(data.detail || 'Gagal memuat percakapan.');
                return;
            }

            // Isi state dengan riwayat yang diambil
            this.state.messages = (data.messages || []).filter(m => m.content);
            this.state.sessionId = data.session_id || sessionId;
            this.state.analysisTriggered = true; // jangan re-run analisis

            this.dom.thread.innerHTML = '';
            this.dismissRecCard();
            this.closePsychologistInfo();

            // Header thread
            this.showThreadHeader();

            if (this.state.messages.length === 0) {
                this.showGreeting();
            } else {
                this.state.messages.forEach(m => {
                    this.addMessage(m.role, m.content);
                });
            }

            this.closeHistoryDrawer();
            this.dom.input.focus();
        } catch (err) {
            this.showToast('Tidak dapat terhubung ke server.');
        }
    }

    /** Hapus satu percakapan. */
    async deleteHistoryItem(sessionId, itemEl) {
        if (!confirm('Hapus percakapan ini?')) return;

        try {
            const res = await fetch(`/api/chat/history/${sessionId}/`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': Utils.getCsrfToken() },
                credentials: 'same-origin',
            });

            if (!res.ok) {
                this.showToast('Gagal menghapus percakapan.');
                return;
            }

            if (itemEl) {
                itemEl.remove();
            } else {
                this.openHistoryDrawer();
            }
        } catch (err) {
            this.showToast('Tidak dapat terhubung ke server.');
        }
    }

    closeHistoryDrawer() {
        const overlay = document.getElementById('history-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }

    /** Tampilkan/sembunyikan tombol keluar di footer drawer. */
    setHistoryFoot(visible) {
        const foot = document.getElementById('history-foot');
        if (foot) foot.hidden = !visible;
    }

    /** Keluar dari akun dan kembali ke halaman utama. */
    async logoutChat() {
        // Simpan otomatis percakapan berjalan sebelum keluar akun.
        await this.saveCurrentChat({ silent: true });
        try {
            await fetch('/api/chat/auth/logout/', {
                method: 'POST',
                headers: { 'X-CSRFToken': Utils.getCsrfToken() },
                credentials: 'same-origin',
            });
        } catch (err) {
            // Tetap arahkan ke beranda meskipun jaringan bermasalah
        }
        window.location.href = '/';
    }

    /** Toast kecil untuk umpan balik non-intrusif. */
    showToast(message) {
        const existing = document.querySelector('.save-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'save-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 260);
        }, 2200);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});
