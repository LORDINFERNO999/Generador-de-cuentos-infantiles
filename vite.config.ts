import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import {
  generateCharacterReferenceAI,
  generateKidsStoryAI,
  generateNarrationAudioAI,
  generateSceneImageAI,
  generateSocialMetaAI,
} from './src/server/geminiService';
import {
  disconnect,
  getOAuthUrl,
  getSocialStatus,
  publishDirect,
  type Platform,
} from './src/server/socialService';

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

          if (url === '/api/social/publish' && req.method === 'POST') {
            const body = await parseBody();
            const result = await publishDirect({
              platform: body.platform,
              title: body.title || '',
              description: body.description || '',
            });
            return send(200, result);
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
