// ============================================================
// Selector de voz por personaje con vista previa (TTS de muestra).
// ============================================================

import { Loader2, Volume2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { generateNarrationAudio } from '../services/api';
import { CLIENT_VOICES, clientPickVoiceForTone, decodeNarration } from '../services/audio';
import type { Character } from '../types';

interface Props {
  character: Character;
  onChange: (voiceName: string) => void;
}

const SAMPLE = '¡Hola! Soy tu personaje del cuento. ¿Escuchas mi voz?';

export function VoiceSelector({ character, onChange }: Props) {
  const [previewing, setPreviewing] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const current = character.voiceName || clientPickVoiceForTone(character.voiceTone);

  const preview = async () => {
    setPreviewing(true);
    try {
      const raw = await generateNarrationAudio(SAMPLE, current);
      if (!ctxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctor();
      }
      const ctx = ctxRef.current;
      await ctx.resume().catch(() => undefined);
      const buffer = decodeNarration(ctx, raw);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start();
      src.onended = () => setPreviewing(false);
    } catch {
      setPreviewing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
        🎭 {character.name}
      </span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-rose-300"
      >
        {CLIENT_VOICES.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <button
        onClick={preview}
        disabled={previewing}
        title="Escuchar muestra"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 transition hover:bg-rose-200 disabled:opacity-50"
      >
        {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
