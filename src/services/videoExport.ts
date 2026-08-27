// ============================================================
// Exportación de video vertical 9:16 (1080x1920).
// Renderiza cada escena en un <canvas> y graba con MediaRecorder.
//
// NOTA HONESTA: la Web Speech API (narración) NO puede capturarse de forma
// fiable en MediaRecorder, por lo que el MP4 exportado contiene la imagen,
// los subtítulos y (opcionalmente) música de fondo. La narración por voz se
// reproduce en la vista previa dentro de la app.
// ============================================================

import type { Scene, Story } from '../types';

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

export interface ExportedVideo {
  blob: Blob;
  url: string;
  mimeType: string;
  extension: string;
}

export interface ExportProgress {
  sceneIndex: number;
  totalScenes: number;
  phase: 'preparando' | 'grabando' | 'finalizando';
}

/** Elige el mejor tipo MIME soportado por el navegador (prioriza MP4). */
function pickMimeType(): { mimeType: string; extension: string } {
  const candidates = [
    { mimeType: 'video/mp4;codecs=h264', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: 'video/webm', extension: 'webm' };
}

/** Carga una imagen (dataURL o URL) como HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Dibuja una imagen cubriendo el lienzo (object-fit: cover) con un zoom. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  zoom: number
): void {
  const cw = VIDEO_WIDTH * zoom;
  const ch = VIDEO_HEIGHT * zoom;
  const scale = Math.max(cw / img.width, ch / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (VIDEO_WIDTH - w) / 2;
  const y = (VIDEO_HEIGHT - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

/** Dibuja un fondo degradado agradable cuando no hay imagen. */
function drawGradientBackground(ctx: CanvasRenderingContext2D, seed: number): void {
  const palettes = [
    ['#fde68a', '#fb7185'],
    ['#a7f3d0', '#60a5fa'],
    ['#c4b5fd', '#f0abfc'],
    ['#fdba74', '#f472b6'],
  ];
  const [c1, c2] = palettes[seed % palettes.length];
  const grad = ctx.createLinearGradient(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
}

/** Divide un texto en líneas que caben en el ancho dado. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Dibuja el subtítulo grande dentro de la zona segura inferior. */
function drawSubtitle(ctx: CanvasRenderingContext2D, subtitle: string, speaker?: string): void {
  if (!subtitle) return;
  const maxWidth = VIDEO_WIDTH * 0.86;

  ctx.textAlign = 'center';
  ctx.font = '700 84px "Quicksand", "Segoe UI", sans-serif';
  const lines = wrapText(ctx, subtitle, maxWidth);
  const lineHeight = 100;
  const blockHeight = lines.length * lineHeight;
  // Zona segura inferior (deja espacio para controles de la plataforma).
  const baseY = VIDEO_HEIGHT * 0.74 - blockHeight / 2;

  // Speaker (etiqueta pequeña).
  if (speaker && speaker.toLowerCase() !== 'narrador') {
    ctx.font = '700 42px "Quicksand", sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 8;
    ctx.strokeText(speaker.toUpperCase(), VIDEO_WIDTH / 2, baseY - 60);
    ctx.fillText(speaker.toUpperCase(), VIDEO_WIDTH / 2, baseY - 60);
  }

  ctx.font = '700 84px "Quicksand", "Segoe UI", sans-serif';
  lines.forEach((line, i) => {
    const y = baseY + i * lineHeight;
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(line, VIDEO_WIDTH / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, VIDEO_WIDTH / 2, y);
  });
}

/** Dibuja gradientes superior/inferior para legibilidad del texto. */
function drawVignette(ctx: CanvasRenderingContext2D): void {
  const top = ctx.createLinearGradient(0, 0, 0, VIDEO_HEIGHT * 0.3);
  top.addColorStop(0, 'rgba(0,0,0,0.45)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT * 0.3);

  const bottom = ctx.createLinearGradient(0, VIDEO_HEIGHT * 0.55, 0, VIDEO_HEIGHT);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, VIDEO_HEIGHT * 0.55, VIDEO_WIDTH, VIDEO_HEIGHT * 0.45);
}

/** Dibuja el título grande centrado (usado en la primera escena / gancho). */
function drawHook(ctx: CanvasRenderingContext2D, hook: string): void {
  if (!hook) return;
  const maxWidth = VIDEO_WIDTH * 0.82;
  ctx.textAlign = 'center';
  ctx.font = '700 72px "Fredoka", "Quicksand", sans-serif';
  const lines = wrapText(ctx, hook, maxWidth);
  const lineHeight = 92;
  const baseY = VIDEO_HEIGHT * 0.2;
  lines.forEach((line, i) => {
    const y = baseY + i * lineHeight;
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(line, VIDEO_WIDTH / 2, y);
    ctx.fillStyle = '#fef08a';
    ctx.fillText(line, VIDEO_WIDTH / 2, y);
  });
}

/**
 * Exporta el cuento a video. Renderiza escena por escena en tiempo real
 * mientras MediaRecorder graba el stream del canvas.
 */
export async function exportStoryVideo(
  story: Story,
  options: {
    musicUrl?: string;
    fps?: number;
    onProgress?: (p: ExportProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<ExportedVideo> {
  const fps = options.fps ?? 30;
  const scenes = story.scenes;
  if (!scenes.length) {
    throw new Error('El cuento no tiene escenas para exportar.');
  }

  options.onProgress?.({ sceneIndex: 0, totalScenes: scenes.length, phase: 'preparando' });

  // Precargar todas las imágenes.
  const images = await Promise.all(scenes.map((s) => loadImage(s.imageUrl || '')));

  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D del canvas.');

  const stream = canvas.captureStream(fps);

  // Música de fondo opcional mezclada en la pista de audio.
  let audioContext: AudioContext | null = null;
  let audioEl: HTMLAudioElement | null = null;
  if (options.musicUrl) {
    try {
      audioContext = new AudioContext();
      audioEl = new Audio(options.musicUrl);
      audioEl.crossOrigin = 'anonymous';
      audioEl.loop = true;
      const source = audioContext.createMediaElementSource(audioEl);
      const dest = audioContext.createMediaStreamDestination();
      const gain = audioContext.createGain();
      gain.gain.value = 0.5;
      source.connect(gain).connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      await audioEl.play().catch(() => undefined);
    } catch {
      // Si falla el audio, se exporta solo con video.
    }
  }

  const { mimeType, extension } = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();

  // Renderizado escena por escena.
  for (let i = 0; i < scenes.length; i++) {
    if (options.signal?.aborted) break;
    options.onProgress?.({ sceneIndex: i, totalScenes: scenes.length, phase: 'grabando' });
    await renderScene(ctx, scenes[i], images[i], i, story, options.signal);
  }

  options.onProgress?.({
    sceneIndex: scenes.length,
    totalScenes: scenes.length,
    phase: 'finalizando',
  });

  recorder.stop();
  const blob = await done;

  // Limpieza de audio.
  if (audioEl) {
    audioEl.pause();
  }
  if (audioContext) {
    await audioContext.close().catch(() => undefined);
  }

  const url = URL.createObjectURL(blob);
  return { blob, url, mimeType, extension };
}

/** Renderiza una escena durante su duración con una animación de zoom suave. */
function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  img: HTMLImageElement | null,
  index: number,
  story: Story,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    const durationMs = Math.max(2000, scene.durationSec * 1000);
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);

      // Fondo.
      if (img) {
        const zoom = 1.05 + t * 0.08; // ligero ken-burns
        drawCover(ctx, img, zoom);
      } else {
        drawGradientBackground(ctx, index);
      }

      drawVignette(ctx);

      // Fade-in inicial de escena.
      const fade = Math.min(1, elapsed / 400);
      ctx.globalAlpha = fade;

      // El gancho solo en la primera escena, primeros instantes.
      if (index === 0 && t < 0.6 && story.hook) {
        drawHook(ctx, story.hook);
      }

      drawSubtitle(ctx, scene.subtitle, scene.speaker);
      ctx.globalAlpha = 1;

      if (t >= 1 || signal?.aborted) {
        resolve();
      } else {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  });
}

/** Genera una portada (thumbnail) 1080x1920 con la primera imagen + título. */
export async function generateThumbnail(story: Story): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D.');

  const firstWithImage = story.scenes.find((s) => s.imageUrl);
  const img = firstWithImage ? await loadImage(firstWithImage.imageUrl || '') : null;

  if (img) {
    drawCover(ctx, img, 1.02);
  } else {
    drawGradientBackground(ctx, 0);
  }
  drawVignette(ctx);

  // Título grande centrado.
  ctx.textAlign = 'center';
  ctx.font = '700 96px "Fredoka", "Quicksand", sans-serif';
  const lines = wrapText(ctx, story.title, VIDEO_WIDTH * 0.84);
  const lineHeight = 116;
  const baseY = VIDEO_HEIGHT * 0.5 - (lines.length * lineHeight) / 2;
  lines.forEach((line, i) => {
    const y = baseY + i * lineHeight;
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(line, VIDEO_WIDTH / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, VIDEO_WIDTH / 2, y);
  });

  // Insignia superior.
  ctx.font = '700 48px "Quicksand", sans-serif';
  ctx.fillStyle = '#fde68a';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 8;
  ctx.strokeText('✨ CUENTO INFANTIL', VIDEO_WIDTH / 2, VIDEO_HEIGHT * 0.16);
  ctx.fillText('✨ CUENTO INFANTIL', VIDEO_WIDTH / 2, VIDEO_HEIGHT * 0.16);

  return canvas.toDataURL('image/png');
}

/** Descarga un blob/dataURL con un nombre de archivo. */
export function downloadFile(data: Blob | string, filename: string): void {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof data !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
