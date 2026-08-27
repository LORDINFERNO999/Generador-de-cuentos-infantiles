// ============================================================
// Selector de música de fondo: pistas integradas (generadas) o subir la tuya.
// ============================================================

import { Music, Upload } from 'lucide-react';
import { useState } from 'react';
import { MUSIC_TRACKS, getMusicUrl } from '../services/music';

interface Props {
  onChange: (url: string) => void;
}

export function MusicPicker({ onChange }: Props) {
  const [selected, setSelected] = useState('none');
  const [loading, setLoading] = useState(false);

  const choose = async (id: string) => {
    setSelected(id);
    setLoading(true);
    try {
      const url = await getMusicUrl(id);
      onChange(url);
    } finally {
      setLoading(false);
    }
  };

  const uploadOwn = (file: File) => {
    const url = URL.createObjectURL(file);
    setSelected('custom');
    onChange(url);
  };

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Music className="h-4 w-4" /> Música de fondo
        {loading && <span className="text-xs font-normal text-slate-400">generando...</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {MUSIC_TRACKS.map((track) => (
          <button
            key={track.id}
            type="button"
            onClick={() => choose(track.id)}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
              selected === track.id
                ? 'bg-rose-400 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {track.emoji} {track.label}
          </button>
        ))}

        <label
          className={`flex cursor-pointer items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
            selected === 'custom'
              ? 'bg-rose-400 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Upload className="h-4 w-4" /> Subir
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadOwn(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}
