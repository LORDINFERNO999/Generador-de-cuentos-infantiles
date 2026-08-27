import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import {
  analyzeHookAI,
  generateCharacterReferenceAI,
  generateKidsStoryAI,
  generateNarrationAudioAI,
  generateSceneImageAI,
  generateSocialMetaAI,
  generateTitleVariantsAI,
  generateTrendIdeasAI,
} from './src/server/geminiService';
import {
  disconnect,
  getOAuthUrl,
  getSocialStatus,
  handleOAuthCallback,
  publishDirect,
  type Platform,
} from './src/server/socialService';
import {
  getUserByToken,
  getUserData,
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  setUserData,
  tokenFromHeader,
} from './src/server/authService';

/** HTML que se muestra en la ventana emergente tras el callback OAuth. */
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

function apiServerPlugin(): Plugin {
  return {
    name: 'gemini-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = req.url.split('?')[0];
        const query = new URLSearchParams(req.url.split('?')[1] || '');

        const parseBody = () =>
          new Promise<any>((resolve) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });

        const send = (status: number, payload: unknown) => {
          res.statusCode = status;
          res.end(JSON.stringify(payload));
        };

        res.setHeader('Content-Type', 'application/json');

        try {
          // ----- Gemini -----
          if (url === '/api/gemini/status' && req.method === 'GET') {
            return send(200, { available: Boolean(process.env.GEMINI_API_KEY) });
          }

          if (url === '/api/gemini/generate-story' && req.method === 'POST') {
            const body = await parseBody();
            const result = await generateKidsStoryAI(body);
            return send(200, { success: true, data: result });
          }

          if (url === '/api/gemini/generate-image' && req.method === 'POST') {
            const body = await parseBody();
            const imageUrl = await generateSceneImageAI(body.prompt || '', body.referenceImages);
            return send(200, { success: true, imageUrl });
          }

          if (url === '/api/gemini/generate-reference' && req.method === 'POST') {
            const body = await parseBody();
            const imageUrl = await generateCharacterReferenceAI(
              body.description || '',
              body.artStyle || ''
            );
            return send(200, { success: true, imageUrl });
          }

          if (url === '/api/gemini/generate-meta' && req.method === 'POST') {
            const body = await parseBody();
            const platforms = await generateSocialMetaAI(body);
            return send(200, { success: true, platforms });
          }

          if (url === '/api/gemini/trends' && req.method === 'POST') {
            const body = await parseBody();
            const ideas = await generateTrendIdeasAI(body.count || 5, body.language);
            return send(200, { success: true, ideas });
          }

          if (url === '/api/gemini/analyze-hook' && req.method === 'POST') {
            const body = await parseBody();
            const result = await analyzeHookAI(body.hook || '', body.theme || '', body.language);
            return send(200, { success: true, ...result });
          }

          if (url === '/api/gemini/title-variants' && req.method === 'POST') {
            const body = await parseBody();
            const titles = await generateTitleVariantsAI(
              body.title || '',
              body.theme || '',
              body.count || 4,
              body.language
            );
            return send(200, { success: true, titles });
          }

          if (url === '/api/gemini/generate-audio' && req.method === 'POST') {
            const body = await parseBody();
            const audio = await generateNarrationAudioAI(body.text || '', body.voiceName);
            return send(200, { success: true, audio });
          }

          // ----- Redes sociales -----
          if (url === '/api/social/status' && req.method === 'GET') {
            return send(200, { success: true, platforms: getSocialStatus() });
          }

          if (url.startsWith('/api/social/connect/') && req.method === 'GET') {
            const platform = url.split('/').pop() as Platform;
            const appUrl = query.get('appUrl') || process.env.APP_URL || '';
            const authUrl = getOAuthUrl(platform, appUrl);
            if (!authUrl) {
              return send(200, {
                success: false,
                available: false,
                message:
                  'La conexión con esta plataforma no está configurada. Configura las credenciales OAuth oficiales en el servidor.',
              });
            }
            return send(200, { success: true, available: true, authUrl });
          }

          if (url.startsWith('/api/social/disconnect/') && req.method === 'POST') {
            const platform = url.split('/').pop() as Platform;
            disconnect(platform);
            return send(200, { success: true });
          }

          if (url.startsWith('/api/social/callback/') && req.method === 'GET') {
            const platform = url.split('/').pop() as Platform;
            const code = query.get('code') || '';
            const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
            const result = await handleOAuthCallback(platform, code, appUrl);
            res.setHeader('Content-Type', 'text/html');
            res.end(oauthCloseHtml(result.success, result.message));
            return;
          }

          if (url === '/api/social/publish' && req.method === 'POST') {
            const body = await parseBody();
            const result = await publishDirect({
              platform: body.platform,
              title: body.title || '',
              description: body.description || '',
              tags: body.tags,
              videoBase64: body.videoBase64,
              videoMimeType: body.videoMimeType,
            });
            return send(200, result);
          }

          // ----- Autenticación (genérica) -----
          if (url === '/api/auth/register' && req.method === 'POST') {
            const body = await parseBody();
            return send(200, authRegister(body.email || '', body.password || '', body.name || ''));
          }
          if (url === '/api/auth/login' && req.method === 'POST') {
            const body = await parseBody();
            return send(200, authLogin(body.email || '', body.password || ''));
          }
          if (url === '/api/auth/logout' && req.method === 'POST') {
            const token = tokenFromHeader(req.headers.authorization);
            if (token) authLogout(token);
            return send(200, { success: true });
          }
          if (url === '/api/auth/me' && req.method === 'GET') {
            const user = getUserByToken(tokenFromHeader(req.headers.authorization));
            return send(200, { user });
          }

          // ----- Datos sincronizados por usuario -----
          if (url === '/api/data' && req.method === 'GET') {
            const user = getUserByToken(tokenFromHeader(req.headers.authorization));
            if (!user) return send(401, { error: 'No autenticado' });
            return send(200, { data: getUserData(user.id) });
          }
          if (url === '/api/data' && req.method === 'PUT') {
            const user = getUserByToken(tokenFromHeader(req.headers.authorization));
            if (!user) return send(401, { error: 'No autenticado' });
            const body = await parseBody();
            setUserData(user.id, body.data);
            return send(200, { success: true });
          }

          return send(404, { error: 'Endpoint no encontrado' });
        } catch (error: any) {
          return send(500, {
            error: error?.message || 'Error interno en el servidor de la API',
          });
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
