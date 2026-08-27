// ============================================================
// Reproductor de video vertical 9:16 (vista previa dentro de la app).
// Muestra escenas con imagen, subtítulos karaoke, narración por voz
// (TTS real de Gemini con fallback a Web Speech), música opcional,
// confeti al final, transiciones variadas y zonas seguras.
// ============================================================

import confetti from 'canvas-confetti';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeNarration, type NarrationMap } from '../services/audio';
import { isSpeechSupported, speak, stopSpeaking } from '../services/speech';
import type { Story } from '../types';

interface Props {
  story: Story;
  /** URL de música de fondo opcional. */
  musicUrl?: string;
  /** Narración TTS por escena (si ya se generó). */
  narration?: NarrationMap | null;
}

/** Transiciones variadas por escena (spec: transiciones variadas). */
function sceneTransition(index: number) {
  const variants = [
    { initial: { opacity: 0, scale: 1.1 }, animate: { opacity: 1, scale: 1 } },
    { initial: { opacity: 0, x: 80 }, animate: { opacity: 1, x: 0 } },
    { initial: { opacity: 0, x: -80 }, animate: { opacity: 1, x: 0 } },
    { initial: { opacity: 0, y: 80 }, animate: { opacity: 1, y: 0 } },
    { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 } },
  ];
  return variants[index % variants.length];
}

/** Subtítulo con resaltado karaoke palabra por palabra. */
function KaraokeSubtitle({ text, progress }: { text: string; progress: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  const activeIndex = Math.floor(progress * words.length);
  return (
    <p className="subtitle-outline text-center font-['Quicksand',sans-serif] text-2xl font-bold leading-tight text-white">
      {words.map((word, i) => (
        <span
          key={i}
          className={`transition-colors duration-150 ${
            i <= activeIndex ? 'text-yellow-300' : 'text-white/85'
          }`}
        >
          {word}{' '}
        </span>
      ))}
    </p>
  );
}

export function StoryViewer({ story, musicUrl, narration }: Props) {
  const [currentScene, setCurrentScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [karaoke, setKaraoke] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const scenes = story.scenes;
  const scene = scenes[currentScene];

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  };

  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopSource = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        // ya detenido
      }
      sourceRef.current = null;
    }
  };

  const stopAll = useCallback(() => {
    clearTimers();
    stopSpeaking();
    stopSource();
    if (audioRef.current) audioRef.current.pause();
  }, []);

  // Bucle de progreso karaoke.
  const runKaraoke = (durationMs: number) => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setKaraoke(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Reproduce la escena actual: narra y avanza al terminar.
  useEffect(() => {
    if (!playing || !scene) return;
    let cancelled = false;
    setKaraoke(0);

    const advance = () => {
      if (cancelled) return;
      if (currentScene < scenes.length - 1) {
        setCurrentScene((i) => i + 1);
      } else {
        setPlaying(false);
        setFinished(true);
      }
    };

    const raw = narration?.get(scene.id);

    if (!muted && raw) {
      // Narración TTS real de Gemini.
      const ctx = getAudioContext();
      ctx.resume().catch(() => undefined);
      const buffer = decodeNarration(ctx, raw);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      sourceRef.current = source;
      runKaraoke(buffer.duration * 1000);
      source.onended = () => {
        if (!cancelled) timerRef.current = setTimeout(advance, 350);
      };
      source.start();
    } else if (!muted && isSpeechSupported() && scene.narration) {
      // Fallback: voz del navegador.
      const character = story.characters.find((c) => c.name === scene.speaker);
      runKaraoke(Math.max(2000, scene.durationSec * 1000));
      speak(scene.narration, {
        rate: story.reelMode ? 1.05 : 0.98,
        pitch: character?.voiceTone?.includes('agud') ? 1.3 : 1,
      }).then(() => {
        if (!cancelled) timerRef.current = setTimeout(advance, 400);
      });
    } else {
      // Silenciado o sin voz: solo temporizador.
      const durationMs = Math.max(2000, scene.durationSec * 1000);
      runKaraoke(durationMs);
      timerRef.current = setTimeout(advance, durationMs);
    }

    return () => {
      cancelled = true;
      clearTimers();
      stopSpeaking();
      stopSource();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, currentScene, muted]);

  // Confeti al finalizar.
  useEffect(() => {
    if (finished) {
      const rect = containerRef.current?.getBoundingClientRect();
      const origin = rect
        ? {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + rect.height / 2) / window.innerHeight,
          }
        : { x: 0.5, y: 0.5 };
      confetti({ particleCount: 120, spread: 80, origin });
    }
  }, [finished]);

  // Música de fondo.
  useEffect(() => {
    if (!musicUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.3;
    if (playing && !muted) {
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [playing, muted, musicUrl]);

  useEffect(() => () => stopAll(), [stopAll]);

  const play = () => {
    if (finished) {
      setCurrentScene(0);
      setFinished(false);
    }
    setPlaying(true);
  };

  const pause = () => {
    setPlaying(false);
    stopAll();
  };

  const restart = () => {
    stopAll();
    setCurrentScene(0);
    setFinished(false);
    setPlaying(true);
  };

  const progress = ((currentScene + 1) / scenes.length) * 100;
  const hasRealVoice = Boolean(narration && scene && narration.get(scene.id));
  const t = sceneTransition(currentScene);

  return (
    <div className="flex flex-col items-center gap-4">
      {musicUrl && <audio ref={audioRef} src={musicUrl} loop preload="auto" />}

      {/* Marco del teléfono 9:16 */}
      <div
        ref={containerRef}
        className="relative aspect-vertical w-full max-w-[340px] overflow-hidden rounded-[2.5rem] border-8 border-slate-900 bg-slate-900 shadow-2xl"
      >
        {/* Barra de progreso por segmentos */}
        <div className="absolute left-3 right-3 top-3 z-30 flex gap-1">
          {scenes.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white transition-all"
                style={{ width: i <= currentScene ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Escena */}
        <AnimatePresence mode="wait">
          <motion.div
            key={scene?.id || currentScene}
            initial={t.initial}
            animate={t.animate}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            {scene?.imageUrl ? (
              <motion.img
                src={scene.imageUrl}
                alt={scene.subtitle}
                className="h-full w-full object-cover"
                initial={{ scale: 1.05 }}
                animate={{ scale: 1.15 }}
                transition={{ duration: scene.durationSec, ease: 'linear' }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-200 via-rose-200 to-fuchsia-200">
                <span className="text-6xl">🎨</span>
              </div>
            )}

            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Gancho (solo primera escena) */}
        {currentScene === 0 && story.hook && (
          <div className="safe-zone z-20 flex items-start justify-center">
            <motion.p
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="subtitle-outline mt-2 text-center font-['Fredoka',sans-serif] text-lg font-bold text-yellow-200"
            >
              {story.hook}
            </motion.p>
          </div>
        )}

        {/* Subtítulo karaoke dentro de zona segura */}
        <div className="absolute inset-x-0 bottom-[18%] z-20 px-5">
          {scene?.speaker && scene.speaker.toLowerCase() !== 'narrador' && (
            <p className="subtitle-outline mb-1 text-center text-sm font-bold text-amber-300">
              {scene.speaker.toUpperCase()}
            </p>
          )}
          {scene && <KaraokeSubtitle text={scene.subtitle} progress={playing ? karaoke : 0} />}
        </div>

        {/* Overlay de fin */}
        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm"
          >
            <span className="text-5xl">🎉</span>
            <p className="font-['Fredoka',sans-serif] text-xl font-bold text-white">¡Fin del cuento!</p>
            <button
              onClick={restart}
              className="mt-2 flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 font-semibold text-slate-800"
            >
              <RotateCcw className="h-4 w-4" /> Ver de nuevo
            </button>
          </motion.div>
        )}

        {/* Botón play/pause central */}
        {!finished && (
          <button
            onClick={playing ? pause : play}
            className="absolute inset-0 z-10 flex items-center justify-center"
            aria-label={playing ? 'Pausar' : 'Reproducir'}
          >
            {!playing && (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/85 shadow-lg">
                <Play className="h-8 w-8 translate-x-0.5 text-slate-800" fill="currentColor" />
              </span>
            )}
          </button>
        )}
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3">
        <button
          onClick={playing ? pause : play}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-400 text-white shadow-lg transition hover:bg-rose-500"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" fill="currentColor" />}
        </button>
        <button
          onClick={restart}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow transition hover:bg-slate-50"
          title="Reiniciar"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          onClick={() => setMuted((m) => !m)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow transition hover:bg-slate-50"
          title={muted ? 'Activar voz' : 'Silenciar voz'}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <span className="text-sm font-medium text-slate-500">
          Escena {currentScene + 1}/{scenes.length}
        </span>
      </div>

      {hasRealVoice && (
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          🎙️ Voz IA activada
        </span>
      )}

      <div className="h-1 w-full max-w-[340px] overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-rose-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
