// ============================================================
// Música de fondo integrada, generada de forma procedural con WebAudio.
// No depende de archivos externos: renderiza un bucle suave a un WAV.
// El usuario también puede subir su propia pista.
// ============================================================

import { audioBufferToWav } from './audio';

export interface MusicTrack {
  id: string;
  label: string;
  emoji: string;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'none', label: 'Sin música', emoji: '🔇' },
  { id: 'calma', label: 'Calma', emoji: '🌙' },
  { id: 'alegre', label: 'Alegre', emoji: '☀️' },
  { id: 'magico', label: 'Mágico', emoji: '✨' },
];

// Escalas pentatónicas (en Hz) para melodías agradables y sin disonancias.
const SCALES: Record<string, number[]> = {
  // Do mayor pentatónica (C D E G A) en varias octavas.
  calma: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
  alegre: [329.63, 392.0, 440.0, 523.25, 587.33, 659.25],
  magico: [293.66, 349.23, 440.0, 523.25, 587.33, 698.46],
};

const cache = new Map<string, string>();

/**
 * Genera un bucle musical suave (~8s) y devuelve un object URL de WAV.
 * Devuelve cadena vacía para 'none'.
 */
export async function getMusicUrl(trackId: string): Promise<string> {
  if (!trackId || trackId === 'none') return '';
  const cached = cache.get(trackId);
  if (cached) return cached;

  const url = await renderTrack(trackId);
  cache.set(trackId, url);
  return url;
}

async function renderTrack(trackId: string): Promise<string> {
  const sampleRate = 44100;
  const duration = 8; // segundos (bucle)
  const OfflineCtor =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new OfflineCtor(2, sampleRate * duration, sampleRate);

  const scale = SCALES[trackId] || SCALES.calma;
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Pad suave de fondo (dos osciladores con leve desafinación).
  const padFreq = scale[0] / 2;
  [0, 2].forEach((detune) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = padFreq;
    osc.detune.value = detune * 4;
    const g = ctx.createGain();
    g.gain.value = 0.08;
    osc.connect(g).connect(master);
    osc.start(0);
    osc.stop(duration);
  });

  // Melodía: notas arpegiadas con envolvente suave.
  const noteDuration = trackId === 'alegre' ? 0.4 : 0.6;
  let time = 0;
  let i = 0;
  while (time < duration - noteDuration) {
    const freq = scale[(i * 2 + (i % 3)) % scale.length];
    playNote(ctx, master, freq, time, noteDuration, trackId === 'magico' ? 'triangle' : 'sine');
    time += noteDuration;
    i++;
  }

  const rendered = await ctx.startRendering();
  const blob = audioBufferToWav(rendered);
  return URL.createObjectURL(blob);
}

function playNote(
  ctx: OfflineAudioContext,
  destination: AudioNode,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.16, start + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(destination);
  osc.start(start);
  osc.stop(start + dur);
}
