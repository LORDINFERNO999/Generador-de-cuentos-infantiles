// ============================================================
// Galería de personajes reutilizables. Permite reusar en un cuento nuevo
// y eliminar personajes guardados.
// ============================================================

import { Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteCharacter, getSavedCharacters } from '../services/storage';
import type { SavedCharacter } from '../types';

interface Props {
  /** Se llama al reutilizar un personaje guardado. */
  onReuse: (character: SavedCharacter) => void;
  /** Señal para refrescar la lista (cambia cuando se guarda un personaje). */
  refreshKey?: number;
  compact?: boolean;
}

export function CharacterGallery({ onReuse, refreshKey, compact }: Props) {
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);

  const refresh = () => setCharacters(getSavedCharacters());

  useEffect(() => {
    refresh();
  }, [refreshKey]);

  const remove = (id: string) => {
    deleteCharacter(id);
    refresh();
  };

  if (!characters.length) {
    return (
      <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-400">
        No tienes personajes guardados aún. Crea un cuento y guarda sus personajes para reutilizarlos.
      </p>
    );
  }

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {characters.map((c) => (
        <div
          key={c.id}
          className="group relative flex flex-col items-center gap-1 rounded-2xl border border-slate-200 p-2 text-center"
        >
          <div className="aspect-vertical w-full overflow-hidden rounded-xl bg-slate-100">
            {c.referenceImage ? (
              <img src={c.referenceImage} alt={c.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">🎭</div>
            )}
          </div>
          <span className="truncate text-xs font-semibold text-slate-700">{c.name}</span>
          <button
            onClick={() => onReuse(c)}
            className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-200"
          >
            <UserPlus className="h-3 w-3" /> Usar
          </button>
          <button
            onClick={() => remove(c.id)}
            title="Eliminar"
            className="absolute right-1 top-1 rounded-full bg-white/80 p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
