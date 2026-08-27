// ============================================================
// Servicio de Gemini (lado servidor)
// Genera: guion del cuento, ilustraciones de escena y metadata para redes.
// La GEMINI_API_KEY nunca se expone al frontend: todo pasa por aquí.
// ============================================================

import { GoogleGenAI, Type } from '@google/genai';

// --- Tipos de dominio (duplicados ligeros para no acoplar el server al front) ---

export interface StoryRequestPayload {
  theme: string;
  moral?: string;
  ageRange: string;
  artStyle: string;
  characterHints?: string;
  sceneCount?: number;
  reelMode?: boolean;
  language?: string;
}

export interface SocialMetaPayload {
  storyTitle: string;
  theme: string;
  moral: string;
  ageRange: string;
  platforms: string[];
  language?: string;
}

const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'imagen-4.0-generate-001';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

/**
 * Voces prebuilt de Gemini TTS disponibles. Mapeamos un "tono" a una voz
 * concreta para dar personalidad a cada personaje.
 * https://ai.google.dev/gemini-api/docs/speech-generation
 */
export const TTS_VOICES = [
  { name: 'Zephyr', tone: 'brillante y alegre' },
  { name: 'Puck', tone: 'juguetona y animada' },
  { name: 'Kore', tone: 'firme y clara' },
  { name: 'Charon', tone: 'grave y calmada' },
  { name: 'Fenrir', tone: 'fuerte y aventurera' },
  { name: 'Aoede', tone: 'dulce y musical' },
  { name: 'Leda', tone: 'juvenil y tierna' },
  { name: 'Orus', tone: 'seria y narradora' },
] as const;

/** Elige una voz razonable a partir de un tono descrito por la IA. */
export function pickVoiceForTone(tone?: string): string {
  if (!tone) return 'Aoede';
  const t = tone.toLowerCase();
  if (t.includes('grav') || t.includes('profund')) return 'Charon';
  if (t.includes('agud') || t.includes('alegr') || t.includes('brillante')) return 'Zephyr';
  if (t.includes('juguet') || t.includes('divertid')) return 'Puck';
  if (t.includes('fuerte') || t.includes('aventur')) return 'Fenrir';
  if (t.includes('tiern') || t.includes('dulce') || t.includes('suave')) return 'Aoede';
  if (t.includes('narrad') || t.includes('seria')) return 'Orus';
  if (t.includes('firme') || t.includes('clara')) return 'Kore';
  return 'Leda';
}

let cachedClient: GoogleGenAI | null = null;

/** Devuelve un cliente de Gemini o lanza si falta la API key. */
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no está configurada. Añádela en .env.local o en el panel de secretos.'
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

// ------------------------------------------------------------
// 1. Generación del guion del cuento
// ------------------------------------------------------------

const storySchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Título corto y llamativo del cuento.' },
    hook: {
      type: Type.STRING,
      description:
        'Gancho inicial de 1 frase para los primeros 3 segundos del video (retención).',
    },
    moral: { type: Type.STRING, description: 'La moraleja o enseñanza del cuento.' },
    characters: {
      type: Type.ARRAY,
      description: 'Personajes con descripción física detallada para consistencia visual.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: {
            type: Type.STRING,
            description:
              'Descripción física muy detallada y estable (colores, ropa, rasgos) para reutilizar en cada imagen.',
          },
          voiceTone: {
            type: Type.STRING,
            description: 'Tono de voz sugerido (p.ej. "aguda y alegre", "grave y calmada").',
          },
        },
        required: ['name', 'description', 'voiceTone'],
      },
    },
    scenes: {
      type: Type.ARRAY,
      description: 'Escenas en orden. Cada una es una toma del video vertical.',
      items: {
        type: Type.OBJECT,
        properties: {
          narration: {
            type: Type.STRING,
            description: 'Texto narrado de la escena (1-3 frases, lenguaje infantil claro).',
          },
          subtitle: {
            type: Type.STRING,
            description: 'Subtítulo corto (máx 8 palabras) para mostrar grande en pantalla.',
          },
          speaker: {
            type: Type.STRING,
            description: 'Nombre del personaje que habla, o "Narrador".',
          },
          imagePrompt: {
            type: Type.STRING,
            description:
              'Prompt en inglés para ilustrar la escena, incluyendo la descripción de los personajes presentes para mantener consistencia.',
          },
          durationSec: {
            type: Type.NUMBER,
            description: 'Duración estimada de la escena en segundos (entre 3 y 6).',
          },
        },
        required: ['narration', 'subtitle', 'speaker', 'imagePrompt', 'durationSec'],
      },
    },
  },
  required: ['title', 'hook', 'moral', 'characters', 'scenes'],
};

/** Genera el guion completo de un cuento infantil. */
export async function generateKidsStoryAI(payload: StoryRequestPayload) {
  const ai = getClient();

  const sceneCount = clampNumber(payload.sceneCount ?? 6, 3, 12);
  const language = payload.language || 'español';
  const reelNote = payload.reelMode
    ? 'El cuento se publicará como Reel/Short vertical: usa un gancho potente en la primera escena, ritmo rápido, frases cortas y un cierre con moraleja memorable.'
    : '';

  const prompt = [
    `Eres un guionista experto en cuentos infantiles virales para video vertical 9:16.`,
    `Crea un cuento en ${language} sobre: "${payload.theme}".`,
    payload.moral ? `La moraleja debe ser: "${payload.moral}".` : 'Incluye una moraleja positiva y clara.',
    `Edad objetivo: ${payload.ageRange} años. Adapta vocabulario y complejidad.`,
    payload.characterHints ? `Ideas de personajes: ${payload.characterHints}.` : '',
    `Genera exactamente ${sceneCount} escenas.`,
    `Estilo visual de las ilustraciones: ${payload.artStyle}. Refleja ese estilo en cada imagePrompt.`,
    `MUY IMPORTANTE: en cada imagePrompt repite la descripción física de los personajes que aparecen, para que sean visualmente idénticos en todas las escenas.`,
    reelNote,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: storySchema,
      temperature: 0.9,
    },
  });

  const raw = response.text;
  if (!raw) {
    throw new Error('Gemini no devolvió contenido para el cuento.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('La respuesta del cuento no es un JSON válido.');
  }

  return normalizeStory(parsed);
}

// ------------------------------------------------------------
// 2. Generación de la imagen de una escena
// ------------------------------------------------------------

/** Genera una ilustración vertical 9:16 para una escena y la devuelve como dataURL. */
export async function generateSceneImageAI(prompt: string): Promise<string> {
  if (!prompt || !prompt.trim()) {
    throw new Error('El prompt de la imagen está vacío.');
  }
  const ai = getClient();

  const finalPrompt = `${prompt}. Children's book illustration, vertical 9:16 composition, bright friendly colors, soft lighting, no text, safe for kids.`;

  const response = await ai.models.generateImages({
    model: IMAGE_MODEL,
    prompt: finalPrompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '9:16',
    },
  });

  const generated = response.generatedImages?.[0]?.image?.imageBytes;
  if (!generated) {
    throw new Error('Gemini no devolvió ninguna imagen.');
  }
  return `data:image/png;base64,${generated}`;
}

// ------------------------------------------------------------
// 2b. Narración por voz real (Gemini TTS)
// ------------------------------------------------------------

export interface NarrationAudio {
  /** Audio PCM 16-bit en base64. */
  base64: string;
  /** Frecuencia de muestreo (Hz), normalmente 24000. */
  sampleRate: number;
  /** Nº de canales (normalmente 1). */
  channels: number;
}

/** Extrae la frecuencia de muestreo de un mimeType tipo "audio/L16;rate=24000". */
function parseSampleRate(mimeType?: string): number {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : 24000;
}

/**
 * Genera la narración por voz de un texto usando el modelo TTS de Gemini.
 * Devuelve audio PCM crudo (16-bit) en base64 para incrustarlo en el video.
 */
export async function generateNarrationAudioAI(
  text: string,
  voiceName?: string
): Promise<NarrationAudio> {
  if (!text || !text.trim()) {
    throw new Error('El texto de la narración está vacío.');
  }
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: text,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName || 'Aoede' },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const inline = part?.inlineData;
  if (!inline?.data) {
    throw new Error('Gemini TTS no devolvió audio.');
  }

  return {
    base64: inline.data,
    sampleRate: parseSampleRate(inline.mimeType),
    channels: 1,
  };
}

// ------------------------------------------------------------
// 3. Metadata para redes sociales (título, descripción, hashtags...)
// ------------------------------------------------------------

const socialSchema = {
  type: Type.OBJECT,
  properties: {
    platforms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          platform: { type: Type.STRING, description: 'youtube | facebook | instagram' },
          title: { type: Type.STRING, description: 'Título optimizado para la plataforma.' },
          description: { type: Type.STRING, description: 'Descripción adaptada a la plataforma.' },
          hashtags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Hashtags relevantes SIN el símbolo #.',
          },
          caption: {
            type: Type.STRING,
            description: 'Texto completo listo para pegar en la publicación.',
          },
          recommendedDuration: {
            type: Type.STRING,
            description: 'Duración recomendada por la plataforma.',
          },
          format: { type: Type.STRING, description: 'Formato recomendado, p.ej. "MP4 vertical 9:16".' },
        },
        required: [
          'platform',
          'title',
          'description',
          'hashtags',
          'caption',
          'recommendedDuration',
          'format',
        ],
      },
    },
  },
  required: ['platforms'],
};

/** Genera la metadata de publicación adaptada a cada plataforma seleccionada. */
export async function generateSocialMetaAI(payload: SocialMetaPayload) {
  const ai = getClient();
  const language = payload.language || 'español';
  const platforms = payload.platforms.length ? payload.platforms : ['youtube'];

  const prompt = [
    `Eres experto en marketing de contenido infantil para redes.`,
    `Genera metadata de publicación en ${language} para estas plataformas: ${platforms.join(', ')}.`,
    `Video: cuento infantil titulado "${payload.storyTitle}", tema "${payload.theme}", moraleja "${payload.moral}", edad ${payload.ageRange}.`,
    `Adapta el tono, longitud, hashtags y duración recomendada a cada plataforma:`,
    `- youtube (Shorts): título con gancho, descripción algo más larga, hasta 60s.`,
    `- facebook (Reels): tono cercano y familiar.`,
    `- instagram (Reels): caption breve y emotivo, hashtags al final.`,
    `Devuelve solo las plataformas solicitadas.`,
  ].join('\n');

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: socialSchema,
      temperature: 0.8,
    },
  });

  const raw = response.text;
  if (!raw) {
    throw new Error('Gemini no devolvió metadata para redes.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('La metadata de redes no es un JSON válido.');
  }

  const list = Array.isArray(parsed?.platforms) ? parsed.platforms : [];
  return list.map((p: any) => ({
    platform: String(p.platform || '').toLowerCase(),
    title: String(p.title || payload.storyTitle),
    description: String(p.description || ''),
    hashtags: Array.isArray(p.hashtags)
      ? p.hashtags.map((h: any) => String(h).replace(/^#/, '').trim()).filter(Boolean)
      : [],
    caption: String(p.caption || ''),
    recommendedDuration: String(p.recommendedDuration || 'Hasta 60 segundos'),
    format: String(p.format || 'MP4 vertical 9:16'),
  }));
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

function clampNumber(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Asegura que el cuento tenga la forma esperada, con valores por defecto seguros. */
function normalizeStory(parsed: any) {
  const characters = Array.isArray(parsed?.characters) ? parsed.characters : [];
  const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];

  return {
    title: String(parsed?.title || 'Cuento sin título'),
    hook: String(parsed?.hook || ''),
    moral: String(parsed?.moral || ''),
    characters: characters.map((c: any) => ({
      name: String(c?.name || 'Personaje'),
      description: String(c?.description || ''),
      voiceTone: String(c?.voiceTone || 'alegre y cálida'),
    })),
    scenes: scenes.map((s: any, i: number) => ({
      index: i,
      narration: String(s?.narration || ''),
      subtitle: String(s?.subtitle || ''),
      speaker: String(s?.speaker || 'Narrador'),
      imagePrompt: String(s?.imagePrompt || ''),
      durationSec: clampNumber(Number(s?.durationSec ?? 4), 2, 10),
    })),
  };
}
