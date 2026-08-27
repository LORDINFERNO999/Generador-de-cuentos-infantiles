import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeHookAI,
  generateCharacterReferenceAI,
  generateKidsStoryAI,
  generateNarrationAudioAI,
  generateSceneImageAI,
  generateSocialMetaAI,
  generateTitleVariantsAI,
  generateTrendIdeasAI,
} from './src/server/geminiService.js';
import {
  disconnect,
  getOAuthUrl,
  getSocialStatus,
  handleOAuthCallback,
  publishDirect,
  type Platform,
} from './src/server/socialService.js';

import {
  getUserByToken,
  getUserData,
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  setUserData,
  tokenFromHeader,
} from './src/server/authService.js';
import { ensureSchema, isDbConfigured } from './src/server/db.js';

function oauthCloseHtml(success: boolean, message: string): string {
  const safe = message.replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${
    success ? 'Conectado' : 'Error'
  }</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#fff7ed">
  <h2>${success ? '✅ Cuenta conectada' : '❌ No se pudo conectar'}</h2>
  <p>${safe}</p>
  <p style="color:#94a3b8">Puedes cerrar esta ventana.</p>
  <script>setTimeout(function(){window.close()},2500)</script>
  </body></html>`;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// El puerto lo asigna el proveedor (Hostinger) por variable de entorno.
const PORT = Number(process.env.PORT) || 3000;

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
    const imageUrl = await generateSceneImageAI(req.body.prompt || '', req.body.referenceImages);
    res.json({ success: true, imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generando la imagen' });
  }
});

app.post('/api/gemini/generate-reference', async (req, res) => {
  try {
    const imageUrl = await generateCharacterReferenceAI(
      req.body.description || '',
      req.body.artStyle || ''
    );
    res.json({ success: true, imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generando la referencia' });
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

app.post('/api/gemini/trends', async (req, res) => {
  try {
    const ideas = await generateTrendIdeasAI(req.body.count || 5, req.body.language);
    res.json({ success: true, ideas });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generando ideas' });
  }
});

app.post('/api/gemini/analyze-hook', async (req, res) => {
  try {
    const result = await analyzeHookAI(req.body.hook || '', req.body.theme || '', req.body.language);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error analizando el gancho' });
  }
});

app.post('/api/gemini/title-variants', async (req, res) => {
  try {
    const titles = await generateTitleVariantsAI(
      req.body.title || '',
      req.body.theme || '',
      req.body.count || 4,
      req.body.language
    );
    res.json({ success: true, titles });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generando títulos' });
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

app.get('/api/social/callback/:platform', async (req, res) => {
  const platform = req.params.platform as Platform;
  const code = (req.query.code as string) || '';
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const result = await handleOAuthCallback(platform, code, appUrl);
  res.setHeader('Content-Type', 'text/html');
  res.send(oauthCloseHtml(result.success, result.message));
});

app.post('/api/social/publish', async (req, res) => {
  try {
    const result = await publishDirect({
      platform: req.body.platform,
      title: req.body.title || '',
      description: req.body.description || '',
      tags: req.body.tags,
      videoBase64: req.body.videoBase64,
      videoMimeType: req.body.videoMimeType,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || 'Error al intentar publicar',
    });
  }
});

// ---------------- Autenticación (genérica) ----------------

app.post('/api/auth/register', async (req, res) => {
  try {
    res.json(await authRegister(req.body.email || '', req.body.password || '', req.body.name || ''));
  } catch (e: any) {
    res.status(500).json({ success: false, message: e?.message || 'Error en el registro' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    res.json(await authLogin(req.body.email || '', req.body.password || ''));
  } catch (e: any) {
    res.status(500).json({ success: false, message: e?.message || 'Error al iniciar sesión' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = tokenFromHeader(req.headers.authorization);
  if (token) await authLogout(token);
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  const user = await getUserByToken(tokenFromHeader(req.headers.authorization));
  res.json({ user });
});

// ---------------- Datos sincronizados por usuario ----------------

app.get('/api/data', async (req, res) => {
  const user = await getUserByToken(tokenFromHeader(req.headers.authorization));
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  res.json({ data: await getUserData(user.id) });
});

app.put('/api/data', async (req, res) => {
  const user = await getUserByToken(tokenFromHeader(req.headers.authorization));
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  await setUserData(user.id, req.body.data);
  res.json({ success: true });
});

// ---------------- Estáticos ----------------

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

async function startup() {
  if (isDbConfigured()) {
    try {
      await ensureSchema();
      console.log('Base de datos MySQL conectada y esquema listo.');
    } catch (e) {
      console.error('No se pudo inicializar MySQL; se usará almacén en memoria.', e);
    }
  } else {
    console.log('MySQL no configurado: autenticación en memoria (solo desarrollo).');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startup();
