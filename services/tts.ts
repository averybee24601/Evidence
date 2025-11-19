export const waitForVoices = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
        const voices = speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
            resolve(voices);
            return;
        }
        const handler = () => {
            const v = speechSynthesis.getVoices();
            if (v && v.length > 0) {
                speechSynthesis.removeEventListener('voiceschanged', handler);
                resolve(v);
            }
        };
        speechSynthesis.addEventListener('voiceschanged', handler);
        // Fallback timer in case event never fires
        setTimeout(() => {
            speechSynthesis.removeEventListener('voiceschanged', handler);
            resolve(speechSynthesis.getVoices());
        }, 1200);
    });
};

const femaleNameHints = ['Female', 'Natasha', 'Olivia', 'Sonia', 'Emma', 'Zira', 'Hazel', 'Aria', 'Jenny', 'Neural'];

export const findBestVoice = async (preferredLocales: string[] = ['en-AU', 'en-GB', 'en-US']): Promise<SpeechSynthesisVoice | undefined> => {
    const voices = await waitForVoices();
    if (!voices || voices.length === 0) return undefined;

    for (const locale of preferredLocales) {
        const candidates = voices.filter(v => (v.lang || '').toLowerCase().startsWith(locale.toLowerCase()));
        if (candidates.length === 0) continue;
        // Prefer female/natural voices
        const female = candidates.find(v => femaleNameHints.some(h => (v.name || '').toLowerCase().includes(h.toLowerCase())));
        if (female) return female;
        // Prefer Google/Microsoft premium voices
        const branded = candidates.find(v => /(google|microsoft)/i.test(v.name));
        if (branded) return branded;
        return candidates[0];
    }

    // Fallback: any English
    const english = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
    return english[0] || voices[0];
};

let preferredVoice: SpeechSynthesisVoice | undefined;

export const getPreferredVoice = async (): Promise<SpeechSynthesisVoice | undefined> => {
    if (preferredVoice) return preferredVoice;
    preferredVoice = await findBestVoice(['en-AU', 'en-GB', 'en-US']);
    return preferredVoice;
};

export const setPreferredVoice = (voice: SpeechSynthesisVoice | undefined) => {
    preferredVoice = voice;
};

export interface SpeakOptions {
    rate?: number;
    pitch?: number;
    voice?: SpeechSynthesisVoice;
    onstart?: () => void;
    onend?: () => void;
}

export const speakText = (text: string, options: SpeakOptions = {}): SpeechSynthesisUtterance => {
    const utter = new SpeechSynthesisUtterance(text);
    if (options.voice) utter.voice = options.voice;
    utter.rate = options.rate ?? 1.0;
    utter.pitch = options.pitch ?? 1.0;
    if (options.onstart) utter.onstart = options.onstart;
    if (options.onend) utter.onend = options.onend;
    speechSynthesis.speak(utter);
    return utter;
};

export const stopSpeaking = () => speechSynthesis.cancel();
export const pauseSpeaking = () => speechSynthesis.pause();
export const resumeSpeaking = () => speechSynthesis.resume();

// Speak long text more reliably by chunking
export const speakInChunks = async (text: string, options: SpeakOptions = {}) => {
    if (!text || text.trim().length === 0) {
        return;
    }
    const MAX_LEN = 1800; // keep well under some browser limits
    const chunks: string[] = [];
    let remaining = text.trim();
    while (remaining.length > MAX_LEN) {
        // split on nearest sentence end before limit
        let idx = remaining.lastIndexOf('. ', MAX_LEN);
        if (idx === -1) idx = remaining.lastIndexOf('? ', MAX_LEN);
        if (idx === -1) idx = remaining.lastIndexOf('! ', MAX_LEN);
        if (idx === -1) idx = MAX_LEN;
        chunks.push(remaining.slice(0, idx + 1));
        remaining = remaining.slice(idx + 1);
    }
    if (remaining.length > 0) chunks.push(remaining);

    let started = false;
    const speakNext = (i: number) => {
        if (i >= chunks.length) {
            if (options.onend) options.onend();
            return;
        }
        const u = speakText(chunks[i], {
            voice: options.voice,
            rate: options.rate,
            pitch: options.pitch,
            onstart: () => {
                if (!started) {
                    started = true;
                    if (options.onstart) options.onstart();
                }
            },
            onend: () => speakNext(i + 1),
        });
        return u;
    };

    speakNext(0);
};


