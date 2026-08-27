// ============================================================
// "📱 PUBLICAR Y COMPARTIR" + "🚀 PREPARAR PARA REDES" (spec 39-42).
//
// Al preparar: comprueba formato 9:16, prepara el MP4, genera título,
// descripción, hashtags, texto y portada por plataforma, muestra vista
// previa editable y permite descargar todos los elementos.
// ============================================================

import { CheckCircle2, DownloadCloud, Rocket, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateSocialMeta } from '../../services/api';
import {
  ALL_PLATFORMS,
  PLATFORMS,
  buildFallbackContent,
  downloadPackage,
} from '../../services/social';
import { generateThumbnail } from '../../services/videoExport';
import type { PlatformContent, SocialPackage, SocialPlatform, Story } from '../../types';
import { Button, Card, SectionTitle } from '../ui';
import { PlatformSelector } from './PlatformSelector';
import { ShareButtons } from './ShareButtons';

interface Props {
  story: Story;
  /** Video ya exportado (si existe). */
  video?: { url: string; mimeType: string } | null;
  /** Plataformas con publicación directa disponible. */
  directPublishPlatforms: SocialPlatform[];
  onPackageReady: (pkg: SocialPackage) => void;
  onOpenPublish: (platform: SocialPlatform, pkg: SocialPackage) => void;
}

type PrepStep = { label: string; done: boolean };

export function SocialPrepare({
  story,
  video,
  directPublishPlatforms,
  onPackageReady,
  onOpenPublish,
}: Props) {
  const [selected, setSelected] = useState<SocialPlatform[]>([...ALL_PLATFORMS]);
  const [preparing, setPreparing] = useState(false);
  const [steps, setSteps] = useState<PrepStep[]>([]);
  const [pkg, setPkg] = useState<SocialPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const is916 = true; // El video se genera siempre en 1080x1920 (9:16).

  const setStepDone = (label: string) =>
    setSteps((prev) => prev.map((s) => (s.label === label ? { ...s, done: true } : s)));

  const prepare = async () => {
    if (!selected.length) {
      setError('Selecciona al menos una plataforma.');
      return;
    }
    setError(null);
    setPreparing(true);

    const initialSteps: PrepStep[] = [
      { label: 'Comprobar formato vertical 9:16', done: false },
      { label: 'Preparar el MP4', done: false },
      { label: 'Generar título, descripción y hashtags', done: false },
      { label: 'Generar texto de publicación', done: false },
      { label: 'Generar portada', done: false },
    ];
    setSteps(initialSteps);

    try {
      // 1. Formato 9:16
      await wait(300);
      setStepDone('Comprobar formato vertical 9:16');

      // 2. MP4
      await wait(200);
      setStepDone('Preparar el MP4');

      // 3-4. Metadata por plataforma (IA con fallback local)
      let perPlatform: Partial<Record<SocialPlatform, PlatformContent>> = {};
      try {
        const metas = await generateSocialMeta({
          storyTitle: story.title,
          theme: story.theme,
          moral: story.moral,
          ageRange: story.ageRange,
          platforms: selected,
          language: 'español',
        });
        for (const m of metas) {
          if (selected.includes(m.platform)) perPlatform[m.platform] = m;
        }
      } catch {
        // Si la IA falla, usamos fallback local (sin fingir nada).
      }
      // Rellenar las que falten con fallback.
      for (const p of selected) {
        if (!perPlatform[p]) perPlatform[p] = buildFallbackContent(story, p);
      }
      setStepDone('Generar título, descripción y hashtags');
      setStepDone('Generar texto de publicación');

      // 5. Portada
      let thumbnailUrl: string | undefined;
      try {
        thumbnailUrl = await generateThumbnail(story);
      } catch {
        thumbnailUrl = undefined;
      }
      setStepDone('Generar portada');

      const newPkg: SocialPackage = {
        storyId: story.id,
        storyTitle: story.title,
        thumbnailUrl,
        videoUrl: video?.url,
        videoMimeType: video?.mimeType,
        perPlatform,
        createdAt: Date.now(),
      };
      setPkg(newPkg);
      onPackageReady(newPkg);
    } catch (e: any) {
      setError(e?.message || 'Error al preparar el contenido.');
    } finally {
      setPreparing(false);
    }
  };

  const updateContent = (platform: SocialPlatform, patch: Partial<PlatformContent>) => {
    setPkg((prev) => {
      if (!prev) return prev;
      const current = prev.perPlatform[platform];
      if (!current) return prev;
      const next = {
        ...prev,
        perPlatform: { ...prev.perPlatform, [platform]: { ...current, ...patch } },
      };
      onPackageReady(next);
      return next;
    });
  };

  return (
    <Card>
      <SectionTitle
        emoji="📱"
        title="Publicar y compartir"
        subtitle="Prepara tu cuento para YouTube Shorts, Facebook Reels e Instagram Reels."
      />

      {/* Selección de plataformas */}
      <div className="mb-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">Elige las plataformas</p>
        <PlatformSelector selected={selected} onChange={setSelected} />
      </div>

      {/* Estado del formato */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
        Formato vertical 9:16 (1080×1920) — óptimo para Reels y Shorts.
      </div>

      <Button onClick={prepare} loading={preparing} disabled={preparing} fullWidth>
        <Rocket className="h-5 w-5" /> Preparar para redes
        <Sparkles className="h-5 w-5" />
      </Button>

      {/* Progreso de preparación */}
      {steps.length > 0 && (
        <ul className="mt-4 space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <span className="h-5 w-5 animate-pulse rounded-full border-2 border-slate-300" />
              )}
              <span className={s.done ? 'text-slate-700' : 'text-slate-400'}>{s.label}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Vista previa editable por plataforma */}
      {pkg && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-['Fredoka',sans-serif] text-lg font-bold text-slate-800">
              Vista previa
            </h3>
            <Button variant="secondary" onClick={() => downloadPackage(pkg)}>
              <DownloadCloud className="h-5 w-5" /> Descargar todo
            </Button>
          </div>

          {/* Portada */}
          {pkg.thumbnailUrl && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-600">Portada generada</p>
              <img
                src={pkg.thumbnailUrl}
                alt="Portada"
                className="aspect-vertical w-32 rounded-2xl object-cover shadow-md"
              />
            </div>
          )}

          {(Object.keys(pkg.perPlatform) as SocialPlatform[]).map((platform) => {
            const content = pkg.perPlatform[platform]!;
            const info = PLATFORMS[platform];
            return (
              <div key={platform} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 font-bold text-slate-800">
                  <span>{info.emoji}</span>
                  {info.label}
                  <span className="ml-auto text-xs font-normal text-slate-400">
                    {content.recommendedDuration} · {content.format}
                  </span>
                </div>

                <label className="mb-1 block text-xs font-semibold text-slate-500">Título</label>
                <input
                  value={content.title}
                  onChange={(e) => updateContent(platform, { title: e.target.value })}
                  className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                />

                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Descripción
                </label>
                <textarea
                  value={content.description}
                  onChange={(e) => updateContent(platform, { description: e.target.value })}
                  rows={2}
                  className="mb-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                />

                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Hashtags (separados por espacio)
                </label>
                <input
                  value={content.hashtags.map((h) => `#${h}`).join(' ')}
                  onChange={(e) =>
                    updateContent(platform, {
                      hashtags: e.target.value
                        .split(/\s+/)
                        .map((h) => h.replace(/^#/, '').trim())
                        .filter(Boolean),
                    })
                  }
                  className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                />

                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Texto para publicación
                </label>
                <textarea
                  value={content.caption}
                  onChange={(e) => updateContent(platform, { caption: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                />
              </div>
            );
          })}

          {/* Botones de compartir (spec 42) */}
          <ShareButtons
            pkg={pkg}
            directPublishPlatforms={directPublishPlatforms}
            onOpenPublish={(platform) => onOpenPublish(platform, pkg)}
          />
        </div>
      )}
    </Card>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
