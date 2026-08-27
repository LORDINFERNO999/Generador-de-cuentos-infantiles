// ============================================================
// Cliente frontend de la API. Toda comunicación con Gemini y redes
// pasa por el backend (nunca se expone la API key ni los tokens).
// ============================================================

import type {
  AccountConnection,
  PlatformContent,
  SocialPlatform,
  Story,
  StoryRequest,
} from '../types';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Error ${res.status}`);
  }
  return data as T;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Error ${res.status}`);
  }
  return data as T;
}

/** ¿Está configurada la clave de Gemini en el backend? */
export async function checkGeminiStatus(): Promise<boolean> {
  try {
    const data = await getJson<{ available: boolean }>('/api/gemini/status');
    return Boolean(data.available);
  } catch {
    return false;
  }
}

/** Genera el guion del cuento (sin imágenes todavía). */
export async function generateStory(req: StoryRequest): Promise<Story> {
  const data = await postJson<{ success: boolean; data: any }>(
    '/api/gemini/generate-story',
    req
  );

  const now = Date.now();
  const raw = data.data;

  const story: Story = {
    id: `story_${now}`,
    title: raw.title,
    theme: req.theme,
    moral: raw.moral,
    ageRange: req.ageRange,
    artStyle: req.artStyle,
    hook: raw.hook,
    reelMode: req.reelMode,
    createdAt: now,
    characters: (raw.characters || []).map((c: any, i: number) => ({
      id: `char_${now}_${i}`,
      name: c.name,
      description: c.description,
      voiceTone: c.voiceTone,
    })),
    scenes: (raw.scenes || []).map((s: any, i: number) => ({
      id: `scene_${now}_${i}`,
      index: i,
      narration: s.narration,
      subtitle: s.subtitle,
      speaker: s.speaker,
      imagePrompt: s.imagePrompt,
      durationSec: s.durationSec,
    })),
  };

  return story;
}

/** Genera la ilustración de una escena y devuelve un dataURL. */
export async function generateSceneImage(prompt: string): Promise<string> {
  const data = await postJson<{ success: boolean; imageUrl: string }>(
    '/api/gemini/generate-image',
    { prompt }
  );
  return data.imageUrl;
}

/** Genera metadata de publicación por plataforma. */
export async function generateSocialMeta(input: {
  storyTitle: string;
  theme: string;
  moral: string;
  ageRange: string;
  platforms: SocialPlatform[];
  language?: string;
}): Promise<PlatformContent[]> {
  const data = await postJson<{ success: boolean; platforms: PlatformContent[] }>(
    '/api/gemini/generate-meta',
    input
  );
  return data.platforms || [];
}

/** Estado de conexión de las cuentas de redes sociales. */
export async function getSocialStatus(): Promise<AccountConnection[]> {
  const data = await getJson<{
    success: boolean;
    platforms: Array<{
      platform: SocialPlatform;
      configured: boolean;
      connected: boolean;
      displayName?: string;
      directPublishAvailable: boolean;
    }>;
  }>('/api/social/status');

  return (data.platforms || []).map((p) => ({
    platform: p.platform,
    connected: p.connected,
    displayName: p.displayName,
    directPublishAvailable: p.directPublishAvailable,
  }));
}

/** Solicita la URL de OAuth para conectar una cuenta. */
export async function connectAccount(
  platform: SocialPlatform
): Promise<{ available: boolean; authUrl?: string; message?: string }> {
  const appUrl = encodeURIComponent(window.location.origin);
  return getJson(`/api/social/connect/${platform}?appUrl=${appUrl}`);
}

/** Desconecta una cuenta. */
export async function disconnectAccount(platform: SocialPlatform): Promise<void> {
  await postJson(`/api/social/disconnect/${platform}`, {});
}

/** Intenta publicar directamente (respuesta honesta del backend). */
export async function publishDirect(input: {
  platform: SocialPlatform;
  title: string;
  description: string;
}): Promise<{ success: boolean; message: string; postUrl?: string }> {
  return postJson('/api/social/publish', input);
}
