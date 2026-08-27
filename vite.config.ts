import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { generateKidsStoryAI, generateSceneImageAI } from './src/server/geminiService';

function apiServerPlugin(): Plugin {
  return {
    name: 'gemini-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

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

        res.setHeader('Content-Type', 'application/json');

        try {
          if (req.url === '/api/gemini/status' && req.method === 'GET') {
            const hasKey = Boolean(process.env.GEMINI_API_KEY);
            res.end(JSON.stringify({ available: hasKey }));
            return;
          }

          if (req.url === '/api/gemini/generate-story' && req.method === 'POST') {
            const body = await parseBody();
            const result = await generateKidsStoryAI(body);
            res.end(JSON.stringify({ success: true, data: result }));
            return;
          }

          if (req.url === '/api/gemini/generate-image' && req.method === 'POST') {
            const body = await parseBody();
            const imageUrl = await generateSceneImageAI(body.prompt || '');
            res.end(JSON.stringify({ success: true, imageUrl }));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
        } catch (error: any) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: error?.message || 'Error interno en el servidor de Gemini',
            })
          );
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
