// ============================================================
// Modo lectura acompañada: páginas con texto grande y narración
// resaltada palabra por palabra (ideal para que el niño siga la lectura).
// ============================================================

import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeNarration, type NarrationMap } from '../services/audio';
import { isSpeechSupported, speak, stopSpeaking } from '../services/speech';
import type { Story } from '../types';

interface Props {
  story: Story;
  narration?: NarrationMap | null;
  onClose: () => void;
}

export function ReadingMode({ story, narration, onClose }: Props) {
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const scene = story.scenes[page];
  const words = (scene?.narration || scene?.subtitle || '').split(/\s+/).filter(Boolean);
  const activeWord = Math.floor(progress * words.length);

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stopSpeaking();
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        /* noop */
      }
      sourceRef.current = null;
    }
  }, []);

  const runProgress = (durationMs: number) => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Reproducir narración de la página actual.
  useEffect(() => {
    if (!playing || !scene) return;
    let cancelled = false;
    setProgress(0);
    const text = scene.narration || scene.subtitle;

    const next = () => {
      if (cancelled) return;
      if (page < story.scenes.length - 1) {
        setPage((p) => p + 1);
      } else {
        setPlaying(false);
      }
    };

    const raw = narration?.get(scene.id);
    if (raw) {
      if (!ctxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctor();
      }
      const ctx = ctxRef.current;
      ctx.resume().catch(() => undefined);
      const buffer = decodeNarration(ctx, raw);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      sourceRef.current = src;
      runProgress(buffer.duration * 1000);
      src.onended = () => {
        if (!cancelled) setTimeout(next, 600);
      };
      src.start();
    } else if (isSpeechSupported() && text) {
      runProgress(Math.max(2500, text.length * 90));
      speak(text, { rate: 0.95 }).then(() => {
        if (!cancelled) setTimeout(next, 600);
      });
    } else {
      runProgress(4000);
      const timer = setTimeout(next, 4000);
      return () => clearTimeout(timer);
    }

    return () => {
      cancelled = true;
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, page]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const go = (dir: -1 | 1) => {
    stopAudio();
    setProgress(0);
    setPage((p) => Math.max(0, Math.min(story.scenes.length - 1, p + dir)));
  };

  if (!scene) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Cabecera */}
      <div className="flex items-center justify-between p-4 text-white">
        <span className="font-['Fredoka',sans-serif] text-lg font-bold">{story.title}</span>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Página */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-4">
        {scene.imageUrl && (
          <img
            src={scene.imageUrl}
            alt=""
            className="max-h-[45vh] rounded-3xl object-contain shadow-2xl"
          />
        )}
        <p className="max-w-2xl text-center font-['Quicksand',sans-serif] text-2xl font-bold leading-relaxed text-white sm:text-3xl">
          {words.map((w, i) => (
            <span
              key={i}
              className={
                playing && i <= activeWord ? 'text-yellow-300' : 'text-white/70'
              }
            >
              {w}{' '}
            </span>
          ))}
        </p>
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-4 p-6">
        <button
          onClick={() => go(-1)}
          disabled={page === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-400 text-white shadow-lg"
        >
          {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" fill="currentColor" />}
        </button>
        <button
          onClick={() => go(1)}
          disabled={page === story.scenes.length - 1}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
      <p className="pb-4 text-center text-sm text-white/50">
        Página {page + 1} de {story.scenes.length}
      </p>
    </div>
  );
}
