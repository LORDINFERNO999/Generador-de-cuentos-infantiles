// ============================================================
// Ajustes de marca (branding): nombre, logo, intro/outro, color y
// marca de agua. Se guardan en localStorage y se aplican al exportar.
// ============================================================

import { Palette, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getBranding, saveBranding } from '../services/storage';
import type { Branding } from '../types';
import { Card, SectionTitle } from './ui';

interface Props {
  onChange?: (branding: Branding) => void;
}

export function BrandingSettings({ onChange }: Props) {
  const [branding, setBranding] = useState<Branding>(getBranding());

  useEffect(() => {
    onChange?.(branding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<Branding>) => {
    const next = { ...branding, ...patch };
    setBranding(next);
    saveBranding(next);
    onChange?.(next);
  };

  const uploadLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => update({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <SectionTitle
        emoji="🎨"
        title="Mi marca"
        subtitle="Añade tu logo, intro/outro y marca de agua a los videos."
      />

      <div className="space-y-4">
        {/* Nombre + logo */}
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {branding.logo ? (
              <img src={branding.logo} alt="logo" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">🎬</div>
            )}
          </div>
          <div className="flex-1">
            <input
              value={branding.brandName}
              onChange={(e) => update({ brandName: e.target.value })}
              placeholder="Nombre de tu canal/marca"
              className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
            />
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">
              <Upload className="h-4 w-4" /> Subir logo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
              />
            </label>
          </div>
        </div>

        {/* Color de acento */}
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-600">Color de acento</span>
          <input
            type="color"
            value={branding.accentColor}
            onChange={(e) => update({ accentColor: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-slate-200"
          />
        </div>

        {/* Intro / Outro */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Texto de intro</label>
            <input
              value={branding.introText || ''}
              onChange={(e) => update({ introText: e.target.value })}
              placeholder="(Se usa el título si vacío)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Texto de outro</label>
            <input
              value={branding.outroText || ''}
              onChange={(e) => update({ outroText: e.target.value })}
              placeholder="¡Suscríbete!"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-4">
          <Toggle
            label="Intro"
            checked={branding.showIntro}
            onChange={(v) => update({ showIntro: v })}
          />
          <Toggle
            label="Outro"
            checked={branding.showOutro}
            onChange={(v) => update({ showOutro: v })}
          />
          <Toggle
            label="Marca de agua"
            checked={branding.showWatermark}
            onChange={(v) => update({ showWatermark: v })}
          />
        </div>
      </div>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-rose-500"
      />
      {label}
    </label>
  );
}
