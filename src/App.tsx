// ============================================================
// Generador de Cuentos Infantiles Virales — App principal.
// Flujo: Crear -> (generar guion + imágenes) -> Ver -> Preparar/Publicar.
// ============================================================

import { AlertTriangle, BookOpenText, CalendarDays, Film, Link as LinkIcon, Mic, Pencil, Save, Share2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CharacterGallery } from './components/CharacterGallery';
import { FinalPanel } from './components/FinalPanel';
import { MusicPicker } from './components/MusicPicker';
import { SceneEditor } from './components/SceneEditor';
import { StoryForm } from './components/StoryForm';
import { StoryViewer } from './components/StoryViewer';
import { VoiceSelector } from './components/VoiceSelector';
import { CalendarView } from './components/social/CalendarView';
import { MyNetworks } from './components/social/MyNetworks';
import { PublishDialog } from './components/social/PublishDialog';
import { SocialPrepare } from './components/social/SocialPrepare';
import { Button, Card, Spinner } from './components/ui';
import {
  checkGeminiStatus,
  generateCharacterReference,
  generateSceneImage,
  generateStory,
  getSocialStatus,
} from './services/api';
import {
  generateStoryNarration,
  makeVoiceForScene,
  type NarrationMap,
} from './services/audio';
import { loadVoices } from './services/speech';
import { saveCharacter, saveStory } from './services/storage';
import {
  downloadFile,
  exportStoryVideo,
  type ExportProgress,
} from './services/videoExport';
import type {
  AccountConnection,
  Character,
  SavedCharacter,
  SocialPackage,
  SocialPlatform,
  Story,
  StoryRequest,
} from './types';

type Stage = 'create' | 'result';
type Tab = 'video' | 'editar' | 'social' | 'networks' | 'calendar';

interface ExportedVideo {
  url: string;
  mimeType: string;
}

export default function App() {
  const [geminiAvailable, setGeminiAvailable] = useState<boolean | null>(null);
  const [stage, setStage] = useState<Stage>('create');
  const [tab, setTab] = useState<Tab>('video');

  const [story, setStory] = useState<Story | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [video, setVideo] = useState<ExportedVideo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  const [narration, setNarration] = useState<NarrationMap | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [narrationStatus, setNarrationStatus] = useState('');
  const [musicUrl, setMusicUrl] = useState('');

  const [reusedCharacters, setReusedCharacters] = useState<SavedCharacter[]>([]);
  const [galleryKey, setGalleryKey] = useState(0);
  const [refBusy, setRefBusy] = useState<string | null>(null);

  const [socialPackage, setSocialPackage] = useState<SocialPackage | null>(null);
  const [accounts, setAccounts] = useState<AccountConnection[]>([]);
  const [publishDialog, setPublishDialog] = useState<{
    platform: SocialPlatform;
    pkg: SocialPackage;
  } | null>(null);

  const lastRequest = useRef<StoryRequest | null>(null);

  // Comprobaciones iniciales.
  useEffect(() => {
    checkGeminiStatus().then(setGeminiAvailable);
    loadVoices();
    getSocialStatus().then(setAccounts).catch(() => undefined);
  }, []);

  const directPublishPlatforms = accounts
    .filter((a) => a.directPublishAvailable)
    .map((a) => a.platform);

  // ---- Generación del cuento + imágenes ----
  const handleGenerate = async (req: StoryRequest) => {
    lastRequest.current = req;
    setError(null);
    setGenerating(true);
    setVideo(null);
    setSocialPackage(null);
    setNarration(null);
    setGenStatus('Escribiendo el guion del cuento...');

    try {
      const newStory = await generateStory(req);
      setStory(newStory);
      setStage('result');
      setTab('video');

      // Generar imágenes escena por escena.
      for (let i = 0; i < newStory.scenes.length; i++) {
        setGenStatus(`Ilustrando escena ${i + 1} de ${newStory.scenes.length}...`);
        try {
          const imageUrl = await generateSceneImage(newStory.scenes[i].imagePrompt);
          newStory.scenes[i] = { ...newStory.scenes[i], imageUrl };
          setStory({ ...newStory, scenes: [...newStory.scenes] });
        } catch {
          // Si falla una imagen, seguimos: el visor muestra un fondo degradado.
        }
      }

      saveStory(newStory);
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el cuento.');
      setStage('create');
    } finally {
      setGenerating(false);
      setGenStatus('');
    }
  };

  const handleRegenerate = () => {
    if (lastRequest.current) handleGenerate(lastRequest.current);
  };

  // ---- Edición del cuento (escenas y personajes) ----
  const updateStory = (next: Story) => {
    setStory(next);
    saveStory(next);
  };

  const setCharacterVoice = (charId: string, voiceName: string) => {
    if (!story) return;
    const characters = story.characters.map((c) =>
      c.id === charId ? { ...c, voiceName } : c
    );
    // Cambió la voz: la narración previa queda obsoleta.
    setNarration(null);
    updateStory({ ...story, characters });
  };

  const makeReference = async (character: Character) => {
    if (!story) return;
    setRefBusy(character.id);
    setError(null);
    try {
      const referenceImage = await generateCharacterReference(character.description, story.artStyle);
      const characters = story.characters.map((c) =>
        c.id === character.id ? { ...c, referenceImage } : c
      );
      updateStory({ ...story, characters });
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar la referencia del personaje.');
    } finally {
      setRefBusy(null);
    }
  };

  const saveCharToGallery = (character: Character) => {
    const saved: SavedCharacter = {
      id: `saved_${Date.now()}_${character.id}`,
      name: character.name,
      description: character.description,
      voiceName: character.voiceName,
      voiceTone: character.voiceTone,
      referenceImage: character.referenceImage,
      createdAt: Date.now(),
    };
    saveCharacter(saved);
    setGalleryKey((k) => k + 1);
  };

  const reuseCharacter = (character: SavedCharacter) => {
    setReusedCharacters((prev) =>
      prev.some((c) => c.id === character.id) ? prev : [...prev, character]
    );
  };

  const removeReused = (id: string) => {
    setReusedCharacters((prev) => prev.filter((c) => c.id !== id));
  };

  // ---- Narración por voz IA ----
  const handleGenerateNarration = async () => {
    if (!story) return;
    setNarrating(true);
    setError(null);
    try {
      const voiceForScene = makeVoiceForScene(story);
      const map = await generateStoryNarration(story, voiceForScene, (i, total) =>
        setNarrationStatus(`Generando voz ${i} de ${total}...`)
      );
      setNarration(map);
      // El video exportado quedará obsoleto: hay que rehacerlo con la voz.
      setVideo(null);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron generar las voces.');
    } finally {
      setNarrating(false);
      setNarrationStatus('');
    }
  };

  // ---- Exportar video ----
  const handleExport = async (): Promise<ExportedVideo | null> => {
    if (!story) return null;
    setExporting(true);
    setError(null);
    try {
      const result = await exportStoryVideo(story, {
        narration,
        musicUrl: musicUrl || undefined,
        onProgress: setExportProgress,
      });
      const exported = { url: result.url, mimeType: result.mimeType };
      setVideo(exported);
      return exported;
    } catch (e: any) {
      setError(e?.message || 'No se pudo exportar el video.');
      return null;
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleDownload = async () => {
    let current = video;
    if (!current) {
      current = await handleExport();
    }
    if (current) {
      const ext = current.mimeType.includes('mp4') ? 'mp4' : 'webm';
      downloadFile(current.url, `${story?.title || 'cuento'}.${ext}`);
    }
  };

  const handleOpenPublish = (platform: SocialPlatform, pkg: SocialPackage) => {
    setPublishDialog({ platform, pkg });
  };

  const goPublish = () => {
    setTab('social');
    if (!socialPackage) {
      setError('Primero prepara el contenido en "Redes" para poder publicar.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-fuchsia-50">
      {/* Cabecera */}
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐰</span>
            <div>
              <h1 className="font-['Fredoka',sans-serif] text-lg font-bold leading-none text-slate-800">
                Cuentos Infantiles Virales
              </h1>
              <p className="text-xs text-slate-500">Video vertical 9:16 con IA</p>
            </div>
          </div>
          {stage === 'result' && (
            <Button variant="secondary" onClick={() => setStage('create')}>
              <BookOpenText className="h-5 w-5" /> Nuevo cuento
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Aviso de API key */}
        {geminiAvailable === false && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              No se detecta <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code>.
              Configúrala en <code className="rounded bg-amber-100 px-1">.env.local</code> para
              generar cuentos e imágenes.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Etapa: crear */}
        {stage === 'create' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <StoryForm
              onGenerate={handleGenerate}
              loading={generating}
              disabled={geminiAvailable === false}
              reusedCharacters={reusedCharacters}
              onRemoveReused={removeReused}
            />
            <div className="space-y-6">
              <Card className="flex flex-col items-center gap-3 bg-white/60 text-center">
                <span className="text-5xl animate-float-slow">📖✨</span>
                <div>
                  <h2 className="font-['Fredoka',sans-serif] text-xl font-bold text-slate-800">
                    Cuentos mágicos en segundos
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Escribe una idea y la IA creará un cuento animado con personajes consistentes,
                    voces, subtítulos y una portada lista para Shorts y Reels.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-400">
                  <span>▶️ YouTube Shorts</span>
                  <span>📘 Facebook Reels</span>
                  <span>📸 Instagram Reels</span>
                </div>
              </Card>

              <Card>
                <h3 className="mb-3 flex items-center gap-2 font-['Fredoka',sans-serif] text-lg font-bold text-slate-800">
                  🎭 Mis personajes
                </h3>
                <CharacterGallery onReuse={reuseCharacter} refreshKey={galleryKey} compact />
              </Card>
            </div>
          </div>
        )}

        {/* Etapa: resultado */}
        {stage === 'result' && story && (
          <div className="space-y-6">
            {/* Pestañas */}
            <div className="flex flex-wrap gap-2">
              <TabButton active={tab === 'video'} onClick={() => setTab('video')} icon={<Film className="h-4 w-4" />}>
                Video
              </TabButton>
              <TabButton active={tab === 'editar'} onClick={() => setTab('editar')} icon={<Pencil className="h-4 w-4" />}>
                Editar
              </TabButton>
              <TabButton active={tab === 'social'} onClick={() => setTab('social')} icon={<Share2 className="h-4 w-4" />}>
                Redes
              </TabButton>
              <TabButton active={tab === 'networks'} onClick={() => setTab('networks')} icon={<LinkIcon className="h-4 w-4" />}>
                Mis redes
              </TabButton>
              <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')} icon={<CalendarDays className="h-4 w-4" />}>
                Calendario
              </TabButton>
            </div>

            {/* Contenido de pestañas */}
            {tab === 'video' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  {generating && genStatus && (
                    <Card>
                      <Spinner label={genStatus} />
                    </Card>
                  )}
                  <StoryViewer story={story} narration={narration} musicUrl={musicUrl || undefined} />
                </div>
                <div className="space-y-4">
                  <FinalPanel
                    onView={() => setTab('video')}
                    onEdit={() => setStage('create')}
                    onRegenerate={handleRegenerate}
                    onDownload={handleDownload}
                    onPrepareSocial={() => setTab('social')}
                    onPublish={goPublish}
                    exporting={exporting}
                    hasVideo={Boolean(video)}
                  />

                  {/* Audio: voces IA + música */}
                  <Card className="space-y-4">
                    <div>
                      <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Mic className="h-4 w-4" /> Narración con voz IA
                      </p>
                      <p className="mb-2 text-xs text-slate-500">
                        Genera voces reales por personaje. Se oyen en la vista previa y se
                        incrustan en el MP4 exportado.
                      </p>
                      <Button
                        variant={narration ? 'secondary' : 'primary'}
                        onClick={handleGenerateNarration}
                        loading={narrating}
                        disabled={narrating || generating || geminiAvailable === false}
                      >
                        <Mic className="h-5 w-5" />
                        {narration ? 'Regenerar voces' : 'Generar voces IA'}
                      </Button>
                      {narrating && narrationStatus && (
                        <p className="mt-2 text-xs text-slate-500">{narrationStatus}</p>
                      )}
                      {narration && !narrating && (
                        <p className="mt-2 text-xs font-semibold text-emerald-600">
                          ✅ Voces listas ({narration.size} escenas)
                        </p>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <MusicPicker onChange={setMusicUrl} />
                    </div>
                  </Card>

                  {exporting && exportProgress && (
                    <Card>
                      <p className="mb-2 text-sm font-semibold text-slate-700">
                        Exportando video... ({exportProgress.phase})
                      </p>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-rose-400 transition-all"
                          style={{
                            width: `${
                              (exportProgress.sceneIndex / Math.max(1, exportProgress.totalScenes)) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        La exportación reproduce el cuento en tiempo real; tardará lo que dura el
                        video.
                      </p>
                    </Card>
                  )}

                  {/* Ficha del cuento */}
                  <Card>
                    <h3 className="mb-2 font-['Fredoka',sans-serif] text-lg font-bold text-slate-800">
                      {story.title}
                    </h3>
                    {story.hook && (
                      <p className="mb-2 text-sm italic text-rose-500">“{story.hook}”</p>
                    )}
                    {story.moral && (
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">🌟 Moraleja:</span> {story.moral}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        {story.scenes.length} escenas
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Edad {story.ageRange}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{story.artStyle}</span>
                      {story.characters.map((c) => (
                        <span key={c.id} className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {tab === 'editar' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <SceneEditor story={story} onChange={updateStory} />

                <Card>
                  <h3 className="mb-1 flex items-center gap-2 font-['Fredoka',sans-serif] text-lg font-bold text-slate-800">
                    🎭 Personajes y voces
                  </h3>
                  <p className="mb-4 text-sm text-slate-500">
                    Asigna una voz, genera una imagen de referencia para mantener el personaje
                    consistente entre escenas, y guárdalo para reutilizarlo.
                  </p>

                  <div className="space-y-4">
                    {story.characters.map((c) => (
                      <div key={c.id} className="rounded-2xl border border-slate-200 p-3">
                        <div className="flex gap-3">
                          <div className="aspect-vertical w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {c.referenceImage ? (
                              <img src={c.referenceImage} alt={c.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-2xl">🎭</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <p className="truncate text-sm font-semibold text-slate-700">{c.name}</p>
                            <p className="line-clamp-2 text-xs text-slate-400">{c.description}</p>
                            <VoiceSelector
                              character={c}
                              onChange={(voiceName) => setCharacterVoice(c.id, voiceName)}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => makeReference(c)}
                                loading={refBusy === c.id}
                                disabled={geminiAvailable === false || refBusy === c.id}
                                className="!px-3 !py-1.5 text-xs"
                              >
                                <Sparkles className="h-4 w-4" />
                                {c.referenceImage ? 'Regenerar referencia' : 'Generar referencia'}
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => saveCharToGallery(c)}
                                className="!px-3 !py-1.5 text-xs"
                              >
                                <Save className="h-4 w-4" /> Guardar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {tab === 'social' && (
              <SocialPrepare
                story={story}
                video={video}
                directPublishPlatforms={directPublishPlatforms}
                onPackageReady={setSocialPackage}
                onOpenPublish={handleOpenPublish}
              />
            )}

            {tab === 'networks' && <MyNetworks onStatusChange={setAccounts} />}

            {tab === 'calendar' && <CalendarView story={story} />}
          </div>
        )}
      </main>

      {/* Modal de publicación */}
      {publishDialog && (
        <PublishDialog
          platform={publishDialog.platform}
          pkg={publishDialog.pkg}
          onClose={() => setPublishDialog(null)}
        />
      )}

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400">
        Hecho con 💛 y Gemini · Los videos se preparan en 9:16 para Shorts y Reels.
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? 'bg-rose-400 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
