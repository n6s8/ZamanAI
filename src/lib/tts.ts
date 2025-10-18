// Контроллер озвучки с fallback: серверный /api/tts → Web Speech API.
// Управление: speak(text), pause(), resume(), stop(), state().

type SpeakOpts = {
    voice?: string;                // серверный голос (если доступен на хабе)
    format?: 'mp3' | 'webm';
    model?: string;                // серверная tts-модель
    volume?: number;               // громкость <audio>
    rate?: number;                 // скорость для Web Speech API
    pitch?: number;                // тембр для Web Speech API
    lang?: string;                 // язык для Web Speech API (Web Speech)
};

type Mode = 'idle' | 'playing' | 'paused';
type Backend = 'server' | 'browser' | null;

class TTSController {
    private _audio: HTMLAudioElement | null = null;
    private _backend: Backend = null;
    private _mode: Mode = 'idle';

    state() { return { backend: this._backend, mode: this._mode }; }

    async speak(text: string, opts: SpeakOpts = {}) {
        await this.stop(); // останавливаем предыдущую озвучку
        const txt = text?.trim();
        if (!txt) return { ok: false, used: null as Backend, error: 'empty' };

        const voice = opts.voice ?? 'alloy';
        const format = opts.format ?? 'mp3';
        const model = opts.model ?? 'tts-1';
        const volume = opts.volume ?? 1.0;

        // 1) серверный путь
        try {
            const API_BASE = (import.meta as any).env?.VITE_API_URL || '';
            const r = await fetch(`${API_BASE}/api/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: txt, voice, format, model })
            });
            if (r.ok) {
                const buf = await r.arrayBuffer();
                const mime = format === 'mp3' ? 'audio/mpeg' : 'audio/webm';
                const blob = new Blob([buf], { type: mime });
                const url = URL.createObjectURL(blob);

                const audio = new Audio(url);
                audio.volume = volume;
                audio.onended = () => { this._mode = 'idle'; };
                audio.onpause  = () => { if (!audio.ended) this._mode = 'paused'; };
                audio.onplay   = () => { this._mode = 'playing'; };

                this._audio = audio;
                this._backend = 'server';
                await audio.play().catch(() => {});
                this._mode = audio.paused ? 'paused' : 'playing';
                return { ok: true, used: 'server' as Backend };
            }
        } catch {
            // упадём на браузерный fallback
        }

        // 2) fallback на Web Speech API
        const synth: SpeechSynthesis | undefined = (window as any).speechSynthesis;
        const Ctor: typeof SpeechSynthesisUtterance | undefined = (window as any).SpeechSynthesisUtterance;
        if (!synth || !Ctor) {
            this._backend = null; this._mode = 'idle';
            return { ok: false, used: null as Backend, error: 'web_speech_unavailable' };
        }

        const u = new Ctor(txt);
        u.lang = opts.lang ?? 'ru-RU';
        u.rate = opts.rate ?? 1.0;
        u.pitch = opts.pitch ?? 1.0;

        // подобрать голос по языку
        const voices = synth.getVoices();
        const v = voices.find(v => (v.lang || '').toLowerCase().startsWith((u.lang || '').toLowerCase()));
        if (v) u.voice = v;

        u.onend   = () => { this._mode = 'idle'; };
        u.onstart = () => { this._mode = 'playing'; };

        this._backend = 'browser';
        synth.speak(u);
        this._mode = 'playing';
        return { ok: true, used: 'browser' as Backend };
    }

    async pause() {
        if (this._backend === 'server' && this._audio) {
            this._audio.pause();
            this._mode = 'paused';
            return;
        }
        if (this._backend === 'browser') {
            const synth: SpeechSynthesis | undefined = (window as any).speechSynthesis;
            if (synth && this._mode === 'playing') {
                synth.pause();
                this._mode = 'paused';
            }
        }
    }

    async resume() {
        if (this._backend === 'server' && this._audio) {
            await this._audio.play().catch(() => {});
            this._mode = this._audio.paused ? 'paused' : 'playing';
            return;
        }
        if (this._backend === 'browser') {
            const synth: SpeechSynthesis | undefined = (window as any).speechSynthesis;
            if (synth && this._mode === 'paused') {
                synth.resume();
                this._mode = 'playing';
            }
        }
    }

    async stop() {
        if (this._backend === 'server' && this._audio) {
            try { this._audio.pause(); } catch {}
            try { this._audio.currentTime = 0; } catch {}
            this._audio = null;
        }
        if (this._backend === 'browser') {
            const synth: SpeechSynthesis | undefined = (window as any).speechSynthesis;
            if (synth) synth.cancel();
        }
        this._mode = 'idle';
        this._backend = null;
    }
}

export const tts = new TTSController();
