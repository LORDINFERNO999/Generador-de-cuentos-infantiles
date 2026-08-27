// ============================================================
// Biblioteca "Mis cuentos": historial de cuentos guardados.
// Permite abrir uno para verlo/editarlo o eliminarlo.
// ============================================================

import { Clock, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteStory, getSavedStories } from '../services/storage';
import type { Story } from '../types';

interface Props {
  onOpen: (story: Story) => void;
  refreshKey?: number;
}

export function StoryLibrary({ onOpen, refreshKey }: Props) {
  const [stories, setStories] = useState<Story[]>([]);

  const refresh = () => setStories(getSavedStories());

  useEffect(() => {
    refresh();
  }, [refreshKey]);

  const remove = (id: string) => {
    deleteStory(id);
    refresh();
  };

  if (!stories.length) {
    return (
      <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-400">
        Aún no has creado cuentos. Los que generes se guardarán aquí automáticamente.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stories.map((story) => {
        const cover = story.scenes.find((s) => s.imageUrl)?.imageUrl;
        return (
          <div
            key={story.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-200"
          >
            <button onClick={() => onOpen(story)} className="block w-full text-left">
              <div className="aspect-vertical w-full overflow-hidden bg-slate-100">
                {cover ? (
                  <img src={cover} alt={story.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">📖</div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-sm font-semibold text-slate-800">{story.title}</p>
                <p className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" />
                  {new Date(story.createdAt).toLocaleDateString()} · {story.scenes.length} escenas
                </p>
              </div>
            </button>
            <button
              onClick={() => remove(story.id)}
              title="Eliminar"
              className="absolute right-1 top-1 rounded-full bg-white/80 p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
