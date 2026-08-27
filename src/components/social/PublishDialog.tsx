// ============================================================
// "🚀 PUBLICAR" — publicación directa (spec 44).
// Muestra plataforma, título, descripción, hashtags, video y portada;
// permite editar antes de confirmar. Tras publicar muestra el resultado
// REAL devuelto por la API (nunca finge éxito).
// ============================================================

import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { publishDirect } from '../../services/api';
import { PLATFORMS } from '../../services/social';
import type { SocialPackage, SocialPlatform } from '../../types';
import { Button } from '../ui';

interface Props {
  platform: SocialPlatform;
  pkg: SocialPackage;
  onClose: () => void;
}

export function PublishDialog({ platform, pkg, onClose }: Props) {
  const info = PLATFORMS[platform];
  const content = pkg.perPlatform[platform];

  const [title, setTitle] = useState(content?.title || pkg.storyTitle);
  const [description, setDescription] = useState(content?.description || '');
  const [hashtags, setHashtags] = useState((content?.hashtags || []).map((h) => `#${h}`).join(' '));
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; postUrl?: string } | null>(
    null
  );

  const confirm = async () => {
    setPublishing(true);
    setResult(null);
    try {
      // Convertir el video (objectURL) a base64 para la subida real.
      let videoBase64: string | undefined;
      if (pkg.videoUrl) {
        const blob = await fetch(pkg.videoUrl).then((r) => r.blob());
        videoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      const tags = hashtags
        .split(/\s+/)
        .map((h) => h.replace(/^#/, '').trim())
        .filter(Boolean);
      const res = await publishDirect({
        platform,
        title,
        description,
        tags,
        videoBase64,
        videoMimeType: pkg.videoMimeType,
      });
      setResult(res);
    } catch (e: any) {
      setResult({ success: false, message: e?.message || 'No se pudo publicar.' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-['Fredoka',sans-serif] text-xl font-bold text-slate-800">
            🚀 Publicar en {info.label}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-6 w-6" />
          </button>
        </div>

        {!result && (
          <div className="space-y-4">
            {/* Vista previa video + portada */}
            <div className="flex gap-3">
              {pkg.thumbnailUrl && (
                <img
                  src={pkg.thumbnailUrl}
                  alt="Portada"
                  className="aspect-vertical w-24 rounded-xl object-cover"
                />
              )}
              <div className="flex-1 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">{info.emoji} {info.label}</p>
                <p>{info.recommendedDuration}</p>
                <p>{content?.format}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {pkg.videoUrl ? '✅ Video listo' : '⚠️ Exporta el video antes de publicar'}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Título</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Hashtags</label>
              <input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} fullWidth>
                Cancelar
              </Button>
              <Button onClick={confirm} loading={publishing} fullWidth>
                🚀 Confirmar publicación
              </Button>
            </div>
          </div>
        )}

        {/* Resultado honesto */}
        {result && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            {result.success ? (
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            ) : (
              <XCircle className="h-16 w-16 text-red-400" />
            )}
            <p className="text-lg font-bold text-slate-800">
              {result.success ? '✅ Publicado correctamente' : '❌ No se pudo publicar'}
            </p>
            <p className="text-sm text-slate-500">{result.message}</p>
            {result.postUrl && (
              <a
                href={result.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-rose-500 underline"
              >
                Ver publicación
              </a>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
