// ============================================================
// Editor de escenas: reordenar, editar texto/subtítulo/duración,
// regenerar imagen (con consistencia por referencia) y borrar escenas.
// ============================================================

import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { generateSceneImage } from '../services/api';
import type { Scene, Story } from '../types';
import { Button, Card, SectionTitle } from './ui';

interface Props {
  story: Story;
  onChange: (story: Story) => void;
}

export function SceneEditor({ story, onChange }: Props) {
  const [busyScene, setBusyScene] = useState<string | null>(null);

  const updateScene = (id: string, patch: Partial<Scene>) => {
    const scenes = story.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s));
    onChange({ ...story, scenes });
  };

  const reindex = (scenes: Scene[]): Scene[] => scenes.map((s, i) => ({ ...s, index: i }));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= story.scenes.length) return;
    const scenes = [...story.scenes];
    [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
    onChange({ ...story, scenes: reindex(scenes) });
  };

  const remove = (id: string) => {
    const scenes = story.scenes.filter((s) => s.id !== id);
    onChange({ ...story, scenes: reindex(scenes) });
  };

  const addScene = () => {
    const newScene: Scene = {
      id: `scene_${Date.now()}`,
      index: story.scenes.length,
      narration: '',
      subtitle: 'Nueva escena',
      speaker: 'Narrador',
      imagePrompt: '',
      durationSec: 4,
    };
    onChange({ ...story, scenes: [...story.scenes, newScene] });
  };

  // Referencias visuales de los personajes para mantener consistencia.
  const referenceImages = story.characters
    .map((c) => c.referenceImage)
    .filter((x): x is string => Boolean(x));

  const regenerateImage = async (scene: Scene) => {
    if (!scene.imagePrompt.trim()) return;
    setBusyScene(scene.id);
    try {
      const imageUrl = await generateSceneImage(
        scene.imagePrompt,
        referenceImages.length ? referenceImages : undefined
      );
      updateScene(scene.id, { imageUrl });
    } catch {
      // Silencioso: se mantiene la imagen anterior.
    } finally {
      setBusyScene(null);
    }
  };

  return (
    <Card>
      <SectionTitle
        emoji="✏️"
        title="Editor de escenas"
        subtitle="Reordena, ajusta textos y duración, y regenera ilustraciones."
      />

      <div className="space-y-4">
        {story.scenes.map((scene, index) => (
          <div key={scene.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex gap-4">
              {/* Miniatura */}
              <div className="relative aspect-vertical w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                {busyScene === scene.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Controles */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Escena {index + 1}</span>
                  <div className="flex gap-1">
                    <IconBtn title="Subir" onClick={() => move(index, -1)} disabled={index === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      title="Bajar"
                      onClick={() => move(index, 1)}
                      disabled={index === story.scenes.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn title="Eliminar" onClick={() => remove(scene.id)} danger>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>

                <input
                  value={scene.subtitle}
                  onChange={(e) => updateScene(scene.id, { subtitle: e.target.value })}
                  placeholder="Subtítulo (corto)"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-rose-300"
                />
                <textarea
                  value={scene.narration}
                  onChange={(e) => updateScene(scene.id, { narration: e.target.value })}
                  placeholder="Narración (texto que se lee en voz alta)"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-rose-300"
                />
                <textarea
                  value={scene.imagePrompt}
                  onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })}
                  placeholder="Descripción de la imagen (prompt)"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 outline-none focus:border-rose-300"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    Duración: <span className="font-semibold text-rose-500">{scene.durationSec}s</span>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={scene.durationSec}
                      onChange={(e) => updateScene(scene.id, { durationSec: Number(e.target.value) })}
                      className="accent-rose-400"
                    />
                  </label>
                  <Button
                    variant="secondary"
                    onClick={() => regenerateImage(scene)}
                    loading={busyScene === scene.id}
                    disabled={!scene.imagePrompt.trim()}
                    className="!px-3 !py-1.5 text-xs"
                  >
                    <ImageIcon className="h-4 w-4" /> Regenerar imagen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button variant="secondary" onClick={addScene} fullWidth>
          <Plus className="h-5 w-5" /> Añadir escena
        </Button>

        {referenceImages.length > 0 && (
          <p className="text-center text-xs text-emerald-600">
            🎯 Consistencia activa: {referenceImages.length} referencia(s) de personaje
          </p>
        )}
      </div>
    </Card>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-30 ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
