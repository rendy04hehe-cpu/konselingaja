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

    init() {
        this.setupTextarea();
        this.showThreadHeader();
        this.showGreeting();
        this.exposeGlobals();
    }

    exposeGlobals() {
        window.handleSend = () => this.handleSend();
        window.startNewConversation = () => this.startNewConversation();
        window.showRecommendation = () => this.showRecommendation();
        window.dismissRecCard = () => this.dismissRecCard();
        window.showPsychologistInfo = () => this.showPsychologistInfo();
        window.closePsychologistInfo = () => this.closePsychologistInfo();
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
        const { row, bubble } = UIRenderer.createMessageRow(role, text, role === 'ai');
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

    startNewConversation() {
        if (!confirm('Mulai percakapan baru?')) return;
        this.state = this.getInitialState();
        this.service = new ChatService(this.state.sessionId, this.state.profile);
        this.dom.thread.innerHTML = '';
        this.dismissRecCard();
        this.closePsychologistInfo();
        this.showGreeting();
        this.dom.input.focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});
