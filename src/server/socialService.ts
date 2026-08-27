// ============================================================
// Servicio de redes sociales (lado servidor)
//
// PRINCIPIOS (según especificación):
//  - Usar SOLO APIs y OAuth oficiales.
//  - NUNCA pedir ni almacenar contraseñas.
//  - NUNCA guardar tokens en el frontend: se manejan aquí.
//  - NUNCA fingir que se publicó algo.
//
// Este módulo es honesto: si las credenciales oficiales de cada plataforma
// no están configuradas en variables de entorno, reporta que la conexión y
// la publicación directa NO están disponibles, y el frontend cae al modo
// manual ("descarga el MP4 y publícalo tú mismo").
// ============================================================

export type Platform = 'youtube' | 'facebook' | 'instagram';

interface PlatformConfigStatus {
  platform: Platform;
  /** ¿Hay credenciales OAuth oficiales configuradas para esta plataforma? */
  configured: boolean;
  /** ¿Hay una cuenta conectada (token válido) en esta sesión de servidor? */
  connected: boolean;
  displayName?: string;
  /** ¿Se puede publicar directamente por API? */
  directPublishAvailable: boolean;
}

// Almacenamiento en memoria de tokens (NUNCA en el frontend).
// En producción esto debería ser un almacén seguro/cifrado por usuario.
const tokenStore = new Map<Platform, { accessToken: string; displayName?: string }>();

/** Comprueba qué credenciales oficiales están configuradas por entorno. */
function isConfigured(platform: Platform): boolean {
  switch (platform) {
    case 'youtube':
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case 'facebook':
    case 'instagram':
      // Instagram Graph API se gestiona a través de la app de Meta/Facebook.
      return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
    default:
      return false;
  }
}

/** Devuelve el estado de todas las plataformas. */
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
      // Solo hay publicación directa si está configurado Y conectado.
      directPublishAvailable: connected,
    };
  });
}

/**
 * Devuelve la URL de autorización OAuth oficial para una plataforma,
 * o null si no está configurada.
 */
export function getOAuthUrl(platform: Platform, appUrl: string): string | null {
  if (!isConfigured(platform)) return null;

  const redirectBase = appUrl || process.env.APP_URL || 'http://localhost:3000';

  if (platform === 'youtube') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      redirect_uri: `${redirectBase}/api/social/callback/youtube`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Facebook e Instagram comparten el login de Meta.
  const metaScope =
    platform === 'instagram'
      ? 'instagram_basic,instagram_content_publish,pages_show_list,business_management'
      : 'pages_show_list,pages_manage_posts,publish_video,business_management';
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID as string,
    redirect_uri: `${redirectBase}/api/social/callback/${platform}`,
    response_type: 'code',
    scope: metaScope,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

/** Desconecta (olvida el token en memoria) una plataforma. */
export function disconnect(platform: Platform): void {
  tokenStore.delete(platform);
}

/**
 * Intenta publicar directamente. Devuelve un resultado HONESTO:
 * si no está conectado/configurado, success = false con instrucción manual.
 *
 * La subida real de video a cada API oficial debe implementarse aquí cuando
 * el usuario haya configurado sus credenciales y conectado su cuenta.
 */
export async function publishDirect(input: {
  platform: Platform;
  title: string;
  description: string;
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
        'No hay una cuenta conectada. Conecta tu cuenta en "Mis redes" o descarga el MP4 y publícalo manualmente.',
    };
  }

  // NOTA: aquí iría la llamada real a la API oficial (YouTube Data API v3 /
  // Meta Graph API). Mientras no esté implementada la subida real, NO fingimos
  // éxito: devolvemos false para respetar el principio de honestidad.
  return {
    success: false,
    message:
      'La cuenta está conectada, pero la subida automática aún no está habilitada en este servidor. Descarga el MP4 y publícalo manualmente.',
  };
}
