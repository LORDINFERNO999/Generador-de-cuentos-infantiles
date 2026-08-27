// ============================================================
// Tipos compartidos de la aplicación
// ============================================================

/** Plataformas de redes sociales soportadas. */
export type SocialPlatform = 'youtube' | 'facebook' | 'instagram';

/** Rango de edad objetivo del cuento. */
export type AgeRange = '2-4' | '4-6' | '6-8' | '8-10';

/** Estilo visual de las ilustraciones. */
export type ArtStyle =
  | 'acuarela'
  | 'pixar-3d'
  | 'plano-vectorial'
  | 'libro-ilustrado'
  | 'papel-recortado'
  | 'anime-suave';

/** Un personaje del cuento, con descripción para mantener consistencia visual. */
export interface Character {
  id: string;
  name: string;
  /** Descripción física detallada para reutilizarse en cada prompt de imagen. */
  description: string;
  /** Voz asignada (nombre de la voz TTS de Gemini). */
  voiceName?: string;
  /** Tono de voz sugerido para la narración. */
  voiceTone?: string;
  /** DataURL de la hoja de referencia visual (para consistencia entre escenas). */
  referenceImage?: string;
}

/** Personaje guardado en la galería para reutilizar en otros cuentos. */
export interface SavedCharacter {
  id: string;
  name: string;
  description: string;
  voiceName?: string;
  voiceTone?: string;
  referenceImage?: string;
  createdAt: number;
}

/** Una escena individual del cuento (una "toma" del video vertical). */
export interface Scene {
  id: string;
  /** Orden dentro del cuento. */
  index: number;
  /** Texto narrado (voz en off / diálogo). */
  narration: string;
  /** Subtítulo grande y corto que se muestra en pantalla. */
  subtitle: string;
  /** Nombre del personaje que habla o protagoniza (si aplica). */
  speaker?: string;
  /** Prompt para generar la ilustración de la escena. */
  imagePrompt: string;
  /** URL/dataURL de la imagen generada. */
  imageUrl?: string;
  /** Duración estimada de la escena en segundos. */
  durationSec: number;
}

/** Cuento completo generado. */
export interface Story {
  id: string;
  title: string;
  theme: string;
  moral: string;
  ageRange: AgeRange;
  artStyle: ArtStyle;
  /** Gancho inicial (hook) para retener la atención en los primeros segundos. */
  hook: string;
  characters: Character[];
  scenes: Scene[];
  /** Modo Reel/Short activado (composición vertical optimizada). */
  reelMode: boolean;
  createdAt: number;
}

/** Parámetros de entrada del formulario para generar un cuento. */
export interface StoryRequest {
  theme: string;
  moral?: string;
  ageRange: AgeRange;
  artStyle: ArtStyle;
  characterHints?: string;
  sceneCount: number;
  reelMode: boolean;
  language: string;
}

/** Contenido adaptado a una plataforma concreta. */
export interface PlatformContent {
  platform: SocialPlatform;
  title: string;
  description: string;
  hashtags: string[];
  /** Texto listo para pegar en la publicación (caption). */
  caption: string;
  /** Duración recomendada por la plataforma (texto legible). */
  recommendedDuration: string;
  /** Formato recomendado (p.ej. "MP4 vertical 9:16"). */
  format: string;
}

/** Paquete completo listo para publicar/compartir. */
export interface SocialPackage {
  storyId: string;
  storyTitle: string;
  /** DataURL de la portada generada. */
  thumbnailUrl?: string;
  /** Blob del video (si ya se exportó). */
  videoUrl?: string;
  videoMimeType?: string;
  /** Contenido por plataforma seleccionada. */
  perPlatform: Partial<Record<SocialPlatform, PlatformContent>>;
  createdAt: number;
}

/** Estado de una conexión de cuenta de red social. */
export interface AccountConnection {
  platform: SocialPlatform;
  connected: boolean;
  displayName?: string;
  /** Si la publicación directa por API está disponible para esta cuenta. */
  directPublishAvailable: boolean;
}

/** Estados posibles de una entrada del calendario. */
export type PublicationStatus =
  | 'borrador'
  | 'preparado'
  | 'programado'
  | 'publicado'
  | 'error';

/** Entrada del calendario de publicaciones. */
export interface CalendarEntry {
  id: string;
  storyId: string;
  storyTitle: string;
  platform: SocialPlatform;
  /** Fecha en formato ISO (YYYY-MM-DD). */
  date: string;
  /** Hora en formato HH:mm. */
  time: string;
  status: PublicationStatus;
  title: string;
  note?: string;
  createdAt: number;
}

/** Resultado de un intento de publicación directa. */
export interface PublishResult {
  platform: SocialPlatform;
  success: boolean;
  message: string;
  /** URL de la publicación si la API la devolvió. */
  postUrl?: string;
}
