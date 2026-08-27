# 🐰 Generador de Cuentos Infantiles Virales

Aplicación web que crea **cuentos infantiles animados en formato vertical 9:16**
(YouTube Shorts, Facebook Reels e Instagram Reels) usando IA de Google Gemini:
guion con gancho, personajes consistentes, ilustraciones por escena, narración,
subtítulos grandes, portada y una capa completa de preparación y publicación en redes.

## ✨ Funcionalidades

- **Generación con IA**: guion del cuento (Gemini) + ilustraciones 9:16 por escena (Imagen).
- **Personajes consistentes**: la descripción de cada personaje se reinyecta en cada imagen.
- **Reproductor 9:16**: narración por voz (Web Speech API), subtítulos grandes, música
  opcional, confeti final, zonas seguras y animaciones.
- **Modo Reel/Short**: gancho inicial, ritmo rápido y composición optimizada.
- **Exportación de video** (`MediaRecorder`) a MP4/WebM 1080×1920.
- **Preparar para redes**: título, descripción, hashtags, texto y portada adaptados a
  cada plataforma; vista previa editable y "Descargar todo".
- **Mis redes (OAuth oficial)**: conectar/desconectar cuentas. Nunca se piden ni guardan
  contraseñas; los tokens se manejan solo en el backend.
- **Publicación directa** cuando hay APIs oficiales configuradas y cuenta conectada.
  Si no, **no se finge la publicación**: se ofrece descargar el MP4 para publicar a mano.
- **Calendario** de recordatorios de publicación (borrador, preparado, programado, publicado, error).

## 🧱 Arquitectura

```
Frontend (React 19 + Vite + Tailwind v4)
  src/components   → UI (formulario, reproductor, panel final, social/*)
  src/services     → api, speech, videoExport, storage, social
        │  fetch /api/*
        ▼
Backend (Express en prod · plugin de Vite en dev)
  src/server/geminiService.ts  → cuento, imágenes y metadata
  src/server/socialService.ts  → OAuth + publicación (honesto)
        ▼
Google Gemini API (@google/genai)
```

## ▶️ Ejecutar en local

**Requisitos:** Node.js 18+.

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Crea un archivo `.env.local` con tu clave de Gemini:
   ```bash
   GEMINI_API_KEY="tu_api_key"
   ```
3. Arranca en desarrollo:
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

### Compilar para producción

```bash
npm run build   # genera dist/
npm run lint    # comprobación de tipos (tsc --noEmit)
```

## 🔌 Publicación en redes (opcional)

La publicación directa requiere **credenciales OAuth oficiales** de cada plataforma,
configuradas como variables de entorno en el servidor:

| Plataforma | Variables | Notas |
|---|---|---|
| YouTube Shorts | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | App verificada por Google |
| Facebook / Instagram Reels | `META_APP_ID`, `META_APP_SECRET` | Requiere Página + cuenta Business y App Review de Meta |

Sin estas credenciales, la app funciona en **modo manual**: prepara el video y sus
metadatos y te permite descargarlos para publicarlos tú mismo. Nunca se afirma que
un video fue publicado si la API no lo confirmó.

## ⚠️ Notas honestas

- La **narración por voz** (Web Speech API) suena en la vista previa, pero **no se
  incrusta en el MP4 exportado** (limitación del navegador para capturar TTS). El video
  incluye imágenes, subtítulos y música opcional.
- El formato de salida es MP4 cuando el navegador lo soporta; si no, WebM.
