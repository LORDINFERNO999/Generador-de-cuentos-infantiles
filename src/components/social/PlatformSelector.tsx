// ============================================================
// Selector de plataformas (spec 41): el usuario elige una o varias.
// ============================================================

import { Check } from 'lucide-react';
import { ALL_PLATFORMS, PLATFORMS } from '../../services/social';
import type { SocialPlatform } from '../../types';

interface Props {
  selected: SocialPlatform[];
  onChange: (platforms: SocialPlatform[]) => void;
}

export function PlatformSelector({ selected, onChange }: Props) {
  const toggle = (platform: SocialPlatform) => {
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ALL_PLATFORMS.map((id) => {
        const info = PLATFORMS[id];
        const active = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={`relative flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition ${
              active
                ? 'border-rose-400 bg-rose-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            {active && (
              <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-rose-400 text-white">
                <Check className="h-4 w-4" />
              </span>
            )}
            <span className="text-2xl">{info.emoji}</span>
            <span className="font-bold text-slate-800">{info.label}</span>
            <span className="text-xs text-slate-500">{info.recommendedDuration}</span>
          </button>
        );
      })}
    </div>
  );
}
