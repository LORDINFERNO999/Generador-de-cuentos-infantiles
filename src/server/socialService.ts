// ============================================================
// Servicio de redes sociales (lado servidor)
//
// PRINCIPIOS (según especificación):
//  - Usar SOLO APIs y OAuth oficiales.
//  - NUNCA pedir ni almacenar contraseñas.
//  - NUNCA guardar tokens en el frontend: se manejan aquí.
//  - NUNCA fingir que se publicó algo.
//
// Si las credenciales oficiales no están configuradas por entorno, la
// conexión y la publicación directa NO están disponibles y el frontend cae
// al modo manual ("descarga el MP4 y publícalo tú mismo").
//
// La subida directa a YouTube (Data API v3, resumable upload) está
// implementada de forma real: se activa cuando hay credenciales y una cuenta
// conectada. Facebook/Instagram quedan honestos (requieren Página/cuenta
// Business y App Review de Meta, además de un video alojado en URL pública).
// ============================================================

export type Platform = 'youtube' | 'facebook' | 'instagram';

interface PlatformConfigStatus {
  platform: Platform;
  configured: boolean;
  connected: boolean;
  displayName?: string;
  directPublishAvailable: boolean;
}

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  displayName?: string;
}

// Almacenamiento en memoria de tokens (NUNCA en el frontend).
// En producción: almacén seguro/cifrado por usuario.
const tokenStore = new Map<Platform, StoredToken>();

function isConfigured(platform: Platform): boolean {
  switch (platform) {
    case 'youtube':
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case 'facebook':
    case 'instagram':
      return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
    default:
      return false;
  }
}

function redirectUri(platform: Platform, appUrl: string): string {
  const base = appUrl || process.env.APP_URL || 'http://localhost:3000';
  return `${base}/api/social/callback/${platform}`;
}

export function getSocialStatus(): PlatformConfigStatus[] {
  const platforms: Platform[] = ['youtube', 'facebook', 'instagram'];
  return platforms.map((platform) => {
    const configured = isConfigured(platform);
    const token = tokenStore.get(platform);
    const connected = configured && Boolean(token);
    return {
      platform,
      configured,
      connected,
      displayName: token?.displayName,
      // YouTube tiene subida real; Meta requiere pasos adicionales (honesto).
      directPublishAvailable: connected && platform === 'youtube',
    };
  });
}

export function getOAuthUrl(platform: Platform, appUrl: string): string | null {
  if (!isConfigured(platform)) return null;

  if (platform === 'youtube') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      redirect_uri: redirectUri(platform, appUrl),
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  const metaScope =
    platform === 'instagram'
      ? 'instagram_basic,instagram_content_publish,pages_show_list,business_management'
      : 'pages_show_list,pages_manage_posts,publish_video,business_management';
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID as string,
    redirect_uri: redirectUri(platform, appUrl),
    response_type: 'code',
    scope: metaScope,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export function disconnect(platform: Platform): void {
  tokenStore.delete(platform);
}

// ------------------------------------------------------------
// Intercambio de código OAuth por token (callback)
// ------------------------------------------------------------

export async function handleOAuthCallback(
  platform: Platform,
  code: string,
  appUrl: string
): Promise<{ success: boolean; message: string }> {
  if (!isConfigured(platform)) {
    return { success: false, message: 'Plataforma no configurada en el servidor.' };
  }
  if (!code) {
    return { success: false, message: 'No se recibió el código de autorización.' };
  }

  try {
    if (platform === 'youtube') {
      const body = new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        redirect_uri: redirectUri(platform, appUrl),
        grant_type: 'authorization_code',
      });
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data: any = await res.json();
      if (!res.ok || !data.access_token) {
        return { success: false, message: data.error_description || 'No se pudo obtener el token.' };
      }
      const displayName = await fetchYouTubeChannelName(data.access_token);
      tokenStore.set(platform, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        displayName,
      });
      return { success: true, message: 'Cuenta de YouTube conectada.' };
    }

    // Meta (Facebook/Instagram): intercambio básico de token.
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID as string,
      client_secret: process.env.META_APP_SECRET as string,
      redirect_uri: redirectUri(platform, appUrl),
      code,
    });
    const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`);
    const data: any = await res.json();
    if (!res.ok || !data.access_token) {
      return { success: false, message: data.error?.message || 'No se pudo obtener el token.' };
    }
    tokenStore.set(platform, { accessToken: data.access_token });
    return { success: true, message: 'Cuenta de Meta conectada.' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Error en el intercambio OAuth.' };
  }
}

async function fetchYouTubeChannelName(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data: any = await res.json();
    return data?.items?.[0]?.snippet?.title;
  } catch {
    return undefined;
  }
}

/** Refresca el token de YouTube si ha caducado. */
async function ensureFreshYouTubeToken(): Promise<string | null> {
  const token = tokenStore.get('youtube');
  if (!token) return null;
  if (token.expiresAt && token.expiresAt > Date.now() + 60_000) {
    return token.accessToken;
  }
  if (!token.refreshToken) return token.accessToken;

  try {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data: any = await res.json();
    if (data.access_token) {
      tokenStore.set('youtube', {
        ...token,
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      });
      return data.access_token;
    }
  } catch {
    /* usa el token actual */
  }
  return token.accessToken;
}

// ------------------------------------------------------------
// Publicación directa
// ------------------------------------------------------------

export async function publishDirect(input: {
  platform: Platform;
  title: string;
  description: string;
  tags?: string[];
  /** Video en dataURL o base64 (necesario para subir a YouTube). */
  videoBase64?: string;
  videoMimeType?: string;
}): Promise<{ success: boolean; message: string; postUrl?: string }> {
  const status = getSocialStatus().find((s) => s.platform === input.platform);

  if (!status || !status.configured) {
    return {
      success: false,
      message:
        'La publicación directa no está configurada para esta plataforma. Descarga el MP4 y publícalo en la aplicación.',
    };
  }
  if (!status.connected) {
    return {
      success: false,
      message:
        'No hay una cuenta conectada. Conéctala en "Mis redes" o descarga el MP4 y publícalo manualmente.',
    };
  }

  if (input.platform === 'youtube') {
    return uploadToYouTube(input);
  }

  // Facebook / Instagram: honesto. Requieren cuenta Business + App Review y
  // (Instagram) un video alojado en URL pública. No fingimos la publicación.
  return {
    success: false,
    message:
      'La publicación directa en esta plataforma requiere una cuenta Business y revisión de la app de Meta. Descarga el MP4 y publícalo manualmente.',
  };
}

/** Subida real a YouTube mediante resumable upload (Data API v3). */
async function uploadToYouTube(input: {
  title: string;
  description: string;
  tags?: string[];
  videoBase64?: string;
  videoMimeType?: string;
}): Promise<{ success: boolean; message: string; postUrl?: string }> {
  if (!input.videoBase64) {
    return { success: false, message: 'Falta el video. Expórtalo antes de publicar.' };
  }

  const accessToken = await ensureFreshYouTubeToken();
  if (!accessToken) {
    return { success: false, message: 'No hay token de YouTube válido. Reconecta tu cuenta.' };
  }

  const base64 = input.videoBase64.includes(',')
    ? input.videoBase64.split(',')[1]
    : input.videoBase64;
  const videoBuffer = Buffer.from(base64, 'base64');
  const mimeType = input.videoMimeType || 'video/mp4';

  const metadata = {
    snippet: {
      title: input.title.slice(0, 100),
      description: input.description || '',
      tags: input.tags || [],
      categoryId: '24', // Entertainment
    },
    status: { privacyStatus: 'private', selfDeclaredMadeForKids: true },
  };

  try {
    // 1) Iniciar sesión de subida "resumable".
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(videoBuffer.length),
        },
        body: JSON.stringify(metadata),
      }
    );
    if (!initRes.ok) {
      const err: any = await initRes.json().catch(() => ({}));
      return { success: false, message: err.error?.message || 'No se pudo iniciar la subida.' };
    }
    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return { success: false, message: 'YouTube no devolvió la URL de subida.' };
    }

    // 2) Subir el contenido del video.
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType, 'Content-Length': String(videoBuffer.length) },
      body: videoBuffer,
    });
    const result: any = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !result.id) {
      return { success: false, message: result.error?.message || 'La subida falló.' };
    }

    return {
      success: true,
      message: 'Publicado en YouTube como privado. Revísalo y hazlo público desde YouTube Studio.',
      postUrl: `https://youtube.com/watch?v=${result.id}`,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Error al subir a YouTube.' };
  }
}
