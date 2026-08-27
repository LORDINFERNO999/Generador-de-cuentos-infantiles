import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateKidsStoryAI,
  generateNarrationAudioAI,
  generateSceneImageAI,
  generateSocialMetaAI,
} from './src/server/geminiService.js';
import {
  disconnect,
  getOAuthUrl,
  getSocialStatus,
  publishDirect,
  type Platform,
} from './src/server/socialService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Los videos/portadas en base64 pueden ser grandes.
app.use(express.json({ limit: '25mb' }));

// ---------------- Gemini ----------------

app.get('/api/gemini/status', (_req, res) => {
  res.json({ available: Boolean(process.env.GEMINI_API_KEY) });
});

app.post('/api/gemini/generate-story', async (req, res) => {
  try {
    const result = await generateKidsStoryAI(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generando el cuento' });
  }
});

app.post('/api/gemini/generate-image', async (req, res) => {
  try {
    const imageUrl = await generateSceneImageAI(req.body.prompt || '');
    res.json({ success: true, imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generando la imagen' });
  }
});

app.post('/api/gemini/generate-meta', async (req, res) => {
  try {
    const platforms = await generateSocialMetaAI(req.body);
    res.json({ success: true, platforms });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generando la metadata' });
  }
});

app.post('/api/gemini/generate-audio', async (req, res) => {
  try {
    const audio = await generateNarrationAudioAI(req.body.text || '', req.body.voiceName);
    res.json({ success: true, audio });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generando la narración' });
  }
});

// ---------------- Redes sociales ----------------

app.get('/api/social/status', (_req, res) => {
  res.json({ success: true, platforms: getSocialStatus() });
});

app.get('/api/social/connect/:platform', (req, res) => {
  const platform = req.params.platform as Platform;
  const appUrl = (req.query.appUrl as string) || process.env.APP_URL || '';
  const url = getOAuthUrl(platform, appUrl);
  if (!url) {
    return res.status(200).json({
      success: false,
      available: false,
      message:
        'La conexión con esta plataforma no está configurada. Configura las credenciales OAuth oficiales en el servidor.',
    });
  }
  res.json({ success: true, available: true, authUrl: url });
});

app.post('/api/social/disconnect/:platform', (req, res) => {
  disconnect(req.params.platform as Platform);
  res.json({ success: true });
});

app.post('/api/social/publish', async (req, res) => {
  try {
    const result = await publishDirect({
      platform: req.body.platform,
      title: req.body.title || '',
      description: req.body.description || '',
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || 'Error al intentar publicar',
    });
  }
});

// ---------------- Estáticos ----------------

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
