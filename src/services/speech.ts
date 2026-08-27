// ============================================================
// Narración por voz usando la Web Speech API del navegador.
// Permite asignar una voz distinta por personaje.
// ============================================================

let cachedVoices: SpeechSynthesisVoice[] = [];

/** Carga las voces disponibles (puede tardar en estar listas). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // Fallback por si el evento no dispara.
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 800);
  });
}

/** Devuelve las voces en español disponibles. */
export function getSpanishVoices(): SpeechSynthesisVoice[] {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis?.getVoices() || [];
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  return es.length ? es : voices;
}

export interface SpeakOptions {
  voiceName?: string;
  pitch?: number;
  rate?: number;
  lang?: string;
}

/** Narra un texto. Devuelve una promesa que se resuelve al terminar. */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = options.lang || 'es-ES';
    utter.pitch = options.pitch ?? 1;
    utter.rate = options.rate ?? 1;

    const voices = getSpanishVoices();
    const voice = options.voiceName
      ? voices.find((v) => v.name === options.voiceName)
      : voices[0];
    if (voice) utter.voice = voice;

    utter.onend = () => resolve();
    utter.onerror = () => resolve();

    window.speechSynthesis.speak(utter);
  });
}

/** Detiene cualquier narración en curso. */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** ¿El navegador soporta síntesis de voz? */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
