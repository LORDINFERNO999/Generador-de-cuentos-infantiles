import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateKidsStoryAI, generateSceneImageAI } from './src/server/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/gemini/status', (req, res) => {
  res.json({ available: Boolean(process.env.GEMINI_API_KEY) });
});

app.post('/api/gemini/generate-story', async (req, res) => {
  try {
    const result = await generateKidsStoryAI(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generating story' });
  }
});

app.post('/api/gemini/generate-image', async (req, res) => {
  try {
    const imageUrl = await generateSceneImageAI(req.body.prompt || '');
    res.json({ success: true, imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generating image' });
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
