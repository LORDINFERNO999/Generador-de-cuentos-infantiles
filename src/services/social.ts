// ============================================================
// Utilidades de redes sociales: metadatos de plataformas, generación
// de fallback local y empaquetado de descargas.
// ============================================================

import type { PlatformContent, SocialPackage, SocialPlatform, Story } from '../types';
import { downloadFile } from './videoExport';

export interface PlatformInfo {
  id: SocialPlatform;
  label: string;
  emoji: string;
  color: string;
  recommendedDuration: string;
  format: string;
}

export const PLATFORMS: Record<SocialPlatform, PlatformInfo> = {
  youtube: {
    id: 'youtube',
    label: 'YouTube Shorts',
    emoji: '▶️',
    color: '#ff0000',
    recommendedDuration: 'Hasta 60 segundos',
    format: 'MP4 vertical 9:16 (1080×1920)',
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook Reels',
    emoji: '📘',
    color: '#1877f2',
    recommendedDuration: '15–90 segundos',
    format: 'MP4 vertical 9:16 (1080×1920)',
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram Reels',
    emoji: '📸',
    color: '#e1306c',
    recommendedDuration: '15–90 segundos',
    format: 'MP4 vertical 9:16 (1080×1920)',
  },
};

export const ALL_PLATFORMS: SocialPlatform[] = ['youtube', 'facebook', 'instagram'];

/**
 * Genera contenido de fallback (sin IA) para una plataforma, por si la
 * generación con Gemini falla o no está disponible.
 */
export function buildFallbackContent(
  story: Story,
  platform: SocialPlatform
): PlatformContent {
  const info = PLATFORMS[platform];
  const baseTags = ['cuentosinfantiles', 'cuentos', 'niños', 'moraleja', 'shorts', 'reels'];
  const themeTag = story.theme
    .toLowerCase()
    .replace(/[^a-záéíóúñ0-9]+/g, '')
    .slice(0, 20);
  const hashtags = [themeTag, ...baseTags].filter(Boolean);

  const caption = `${story.hook || story.title}\n\n${story.moral ? `🌟 Moraleja: ${story.moral}` : ''}\n\n${hashtags
    .map((h) => `#${h}`)
    .join(' ')}`;

  return {
    platform,
    title: story.title,
    description: `${story.hook || ''} Un cuento infantil sobre ${story.theme}. ${
      story.moral ? `Enseña a los niños: ${story.moral}.` : ''
    }`.trim(),
    hashtags,
    caption,
    recommendedDuration: info.recommendedDuration,
    format: info.format,
  };
}

/** Convierte un dataURL a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

/** Genera un nombre de archivo seguro a partir de un texto. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Construye el texto .txt con toda la metadata de una plataforma. */
function buildMetaText(content: PlatformContent): string {
  return [
    `Plataforma: ${PLATFORMS[content.platform].label}`,
    `Duración recomendada: ${content.recommendedDuration}`,
    `Formato: ${content.format}`,
    '',
    '=== TÍTULO ===',
    content.title,
    '',
    '=== DESCRIPCIÓN ===',
    content.description,
    '',
    '=== HASHTAGS ===',
    content.hashtags.map((h) => `#${h}`).join(' '),
    '',
    '=== TEXTO PARA PUBLICACIÓN ===',
    content.caption,
    '',
  ].join('\n');
}

/**
 * Descarga TODOS los elementos del paquete: video, portada y un .txt de
 * metadata por cada plataforma.
 */
export function downloadPackage(pkg: SocialPackage): void {
  const base = slugify(pkg.storyTitle) || 'cuento';

  // Video.
  if (pkg.videoUrl) {
    const ext = pkg.videoMimeType?.includes('mp4') ? 'mp4' : 'webm';
    downloadFile(pkg.videoUrl, `${base}.${ext}`);
  }

  // Portada.
  if (pkg.thumbnailUrl) {
    downloadFile(dataUrlToBlob(pkg.thumbnailUrl), `${base}-portada.png`);
  }

  // Metadata por plataforma.
  Object.values(pkg.perPlatform).forEach((content) => {
    if (!content) return;
    const blob = new Blob([buildMetaText(content)], { type: 'text/plain;charset=utf-8' });
    downloadFile(blob, `${base}-${content.platform}.txt`);
  });
}

/** ¿El navegador soporta compartir archivos con Web Share API? */
export function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'share' in navigator &&
    'canShare' in navigator &&
    typeof (navigator as any).canShare === 'function'
  );
}
