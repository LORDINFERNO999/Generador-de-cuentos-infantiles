// ============================================================
// Botones de compartir (spec 42).
// Usa Web Share API cuando está disponible. Cuando la publicación directa
// NO es posible, muestra el mensaje honesto y ofrece descargar el MP4.
// ============================================================

import { Download, Share2 } from 'lucide-react';
import { useState } from 'react';
import { PLATFORMS, canShareFiles, dataUrlToBlob } from '../../services/social';
import { downloadFile } from '../../services/videoExport';
import type { SocialPackage, SocialPlatform } from '../../types';
import { Button } from '../ui';

interface Props {
  pkg: SocialPackage;
  /** Plataformas con publicación directa disponible (cuentas conectadas). */
  directPublishPlatforms: SocialPlatform[];
  onOpenPublish: (platform: SocialPlatform) => void;
}

const MANUAL_MESSAGE = 'Video preparado. Descarga el MP4 y publícalo en la aplicación.';

export function ShareButtons({ pkg, directPublishPlatforms, onOpenPublish }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  const downloadVideo = () => {
    if (!pkg.videoUrl) {
      setNotice('Aún no has exportado el video. Pulsa "Descargar MP4" tras generarlo.');
      return;
    }
    const ext = pkg.videoMimeType?.includes('mp4') ? 'mp4' : 'webm';
    downloadFile(pkg.videoUrl, `${pkg.storyTitle || 'cuento'}.${ext}`);
  };

  const shareNative = async () => {
    const content = Object.values(pkg.perPlatform)[0];
    const text = content?.caption || pkg.storyTitle;

    try {
      // Intentar compartir el archivo de video si es posible.
      if (pkg.videoUrl && canShareFiles()) {
        const resp = await fetch(pkg.videoUrl);
        const blob = await resp.blob();
        const ext = pkg.videoMimeType?.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `${pkg.storyTitle}.${ext}`, { type: blob.type });
        if ((navigator as any).canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: pkg.storyTitle, text });
          return;
        }
      }
      if ('share' in navigator) {
        await navigator.share({ title: pkg.storyTitle, text });
        return;
      }
      setNotice('Tu navegador no soporta compartir directamente. ' + MANUAL_MESSAGE);
    } catch {
      // El usuario canceló o falló: no es un error crítico.
    }
  };

  const handlePlatform = (platform: SocialPlatform) => {
    if (directPublishPlatforms.includes(platform)) {
      onOpenPublish(platform);
    } else {
      // Honesto: no fingimos publicación.
      setNotice(`${PLATFORMS[platform].label}: ${MANUAL_MESSAGE}`);
      downloadVideo();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button onClick={downloadVideo} variant="primary">
          <Download className="h-5 w-5" /> Descargar MP4
        </Button>
        <Button onClick={shareNative} variant="secondary">
          <Share2 className="h-5 w-5" /> Compartir
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(pkg.perPlatform) as SocialPlatform[]).map((platform) => {
          const info = PLATFORMS[platform];
          const direct = directPublishPlatforms.includes(platform);
          return (
            <button
              key={platform}
              onClick={() => handlePlatform(platform)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span>{info.emoji}</span>
              {info.label}
              {direct && (
                <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  DIRECTO
                </span>
              )}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {notice}
        </div>
      )}
    </div>
  );
}
