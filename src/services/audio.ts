// ============================================================
// Utilidades de audio para narración TTS de Gemini.
// El TTS devuelve PCM 16-bit crudo (base64). Aquí lo decodificamos a
// AudioBuffer (para reproducir y para incrustar en el video) y ofrecemos
// exportación a WAV.
// ============================================================

import { generateNarrationAudio } from './api';
import type { Scene, Story } from '../types';

/** Decodifica base64 a Uint8Array. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convierte PCM 16-bit (little-endian) en base64 a un AudioBuffer.
 */
export function pcmBase64ToAudioBuffer(
  ctx: BaseAudioContext,
  base64: string,
  sampleRate: number,
  channels = 1
): AudioBuffer {
  const bytes = base64ToBytes(base64);
  const view = new DataView(bytes.buffer);
  const frameCount = Math.floor(bytes.length / 2 / channels);

  const buffer = ctx.createBuffer(channels, frameCount, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      const offset = (i * channels + ch) * 2;
      const sample = view.getInt16(offset, true);
      channelData[i] = sample / 32768;
    }
  }
  return buffer;
}

/** Codifica un AudioBuffer a un Blob WAV (PCM 16-bit). */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const bufferSize = 44 + dataSize;

  const ab = new ArrayBuffer(bufferSize);
  const view = new DataView(ab);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

/** Audio de narración crudo (independiente del AudioContext). */
export interface NarrationRaw {
  base64: string;
  sampleRate: number;
  channels: number;
}

/** Mapa de narración por escena (clave = scene.id). */
export type NarrationMap = Map<string, NarrationRaw>;

/**
 * Genera la narración por voz de todas las escenas del cuento.
 * Devuelve el audio crudo por escena para poder decodificarlo tanto en el
 * reproductor como en la exportación de video.
 */
export async function generateStoryNarration(
  story: Story,
  voiceForScene: (scene: Scene) => string | undefined,
  onProgress?: (index: number, total: number) => void
): Promise<NarrationMap> {
  const result: NarrationMap = new Map();

  for (let i = 0; i < story.scenes.length; i++) {
    const scene = story.scenes[i];
    onProgress?.(i + 1, story.scenes.length);
    if (!scene.narration.trim()) continue;
    const raw = await generateNarrationAudio(scene.narration, voiceForScene(scene));
    result.set(scene.id, raw);
  }

  return result;
}

/** Decodifica la narración cruda de una escena a AudioBuffer en el contexto dado. */
export function decodeNarration(
  ctx: BaseAudioContext,
  raw: NarrationRaw
): AudioBuffer {
  return pcmBase64ToAudioBuffer(ctx, raw.base64, raw.sampleRate, raw.channels);
}

/** Duración aproximada (segundos) de un audio crudo sin decodificar. */
export function narrationDurationSec(raw: NarrationRaw): number {
  const frames = Math.floor(base64ToBytes(raw.base64).length / 2 / raw.channels);
  return frames / raw.sampleRate;
}

/** Voces disponibles (deben coincidir con las del servidor). */
export const CLIENT_VOICES = [
  'Zephyr',
  'Puck',
  'Kore',
  'Charon',
  'Fenrir',
  'Aoede',
  'Leda',
  'Orus',
] as const;

/** Elige una voz a partir de un tono (versión cliente de pickVoiceForTone). */
export function clientPickVoiceForTone(tone?: string): string {
  if (!tone) return 'Aoede';
  const t = tone.toLowerCase();
  if (t.includes('grav') || t.includes('profund')) return 'Charon';
  if (t.includes('agud') || t.includes('alegr') || t.includes('brillante')) return 'Zephyr';
  if (t.includes('juguet') || t.includes('divertid')) return 'Puck';
  if (t.includes('fuerte') || t.includes('aventur')) return 'Fenrir';
  if (t.includes('tiern') || t.includes('dulce') || t.includes('suave')) return 'Aoede';
  if (t.includes('narrad') || t.includes('seria')) return 'Orus';
  if (t.includes('firme') || t.includes('clara')) return 'Kore';
  return 'Leda';
}

/**
 * Construye la función que asigna una voz a cada escena según el personaje
 * que habla (o la voz forzada por el usuario en character.voiceName).
 */
export function makeVoiceForScene(story: Story): (scene: Scene) => string | undefined {
  return (scene: Scene) => {
    const character = story.characters.find((c) => c.name === scene.speaker);
    if (character?.voiceName) return character.voiceName;
    return clientPickVoiceForTone(character?.voiceTone);
  };
}
