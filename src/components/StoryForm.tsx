// ============================================================
// Formulario de creación de cuentos + modo Reel/Short (spec 46).
// ============================================================

import { Lightbulb, Sparkles, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { getTrendIdeas, type TrendIdea } from '../services/api';
import type { AgeRange, ArtStyle, SavedCharacter, StoryRequest } from '../types';
import { Button, Card, SectionTitle } from './ui';

const AGE_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: '2-4', label: '2–4 años' },
  { value: '4-6', label: '4–6 años' },
  { value: '6-8', label: '6–8 años' },
  { value: '8-10', label: '8–10 años' },
];

const LANG_OPTIONS: { value: string; label: string }[] = [
  { value: 'español', label: '🇪🇸 Español' },
  { value: 'english', label: '🇬🇧 English' },
  { value: 'português', label: '🇧🇷 Português' },
  { value: 'français', label: '🇫🇷 Français' },
  { value: 'italiano', label: '🇮🇹 Italiano' },
  { value: 'deutsch', label: '🇩🇪 Deutsch' },
];

const STYLE_OPTIONS: { value: ArtStyle; label: string; emoji: string }[] = [
  { value: 'acuarela', label: 'Acuarela', emoji: '🎨' },
  { value: 'pixar-3d', label: '3D estilo Pixar', emoji: '🧸' },
  { value: 'plano-vectorial', label: 'Plano vectorial', emoji: '🟦' },
  { value: 'libro-ilustrado', label: 'Libro ilustrado', emoji: '📖' },
  { value: 'papel-recortado', label: 'Papel recortado', emoji: '✂️' },
  { value: 'anime-suave', label: 'Anime suave', emoji: '🌸' },
];

interface Props {
  onGenerate: (req: StoryRequest) => void;
  loading: boolean;
  disabled?: boolean;
  /** Personajes reutilizados desde la galería (se inyectan en el prompt). */
  reusedCharacters?: SavedCharacter[];
  onRemoveReused?: (id: string) => void;
}

export function StoryForm({
  onGenerate,
  loading,
  disabled,
  reusedCharacters = [],
  onRemoveReused,
}: Props) {
  const [theme, setTheme] = useState('');
  const [moral, setMoral] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange>('4-6');
  const [artStyle, setArtStyle] = useState<ArtStyle>('acuarela');
  const [characterHints, setCharacterHints] = useState('');
  const [sceneCount, setSceneCount] = useState(6);
  const [reelMode, setReelMode] = useState(true);
  const [language, setLanguage] = useState('español');

  const [ideas, setIdeas] = useState<TrendIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    setShowIdeas(true);
    try {
      setIdeas(await getTrendIdeas(6, language));
    } catch {
      setIdeas([]);
    } finally {
      setLoadingIdeas(false);
    }
  };

  const pickIdea = (idea: TrendIdea) => {
    setTheme(idea.theme);
    setShowIdeas(false);
  };

  const canSubmit = theme.trim().length > 2 && !loading && !disabled;

  // Si se reutilizan personajes, sus descripciones se añaden al prompt.
  const reusedText = reusedCharacters
    .map((c) => `${c.name}: ${c.description}`)
    .join('. ');

  const submit = () => {
    if (!canSubmit) return;
    const hints = [characterHints.trim(), reusedText].filter(Boolean).join('. ');
    onGenerate({
      theme: theme.trim(),
      moral: moral.trim() || undefined,
      ageRange,
      artStyle,
      characterHints: hints || undefined,
      sceneCount,
      reelMode,
      language,
    });
  };

  return (
    <Card>
      <SectionTitle
        emoji="✨"
        title="Crea tu cuento"
        subtitle="Describe la idea y la IA generará el guion, los personajes y las ilustraciones."
      />

      <div className="space-y-5">
        {/* Tema */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-700">
              ¿De qué trata el cuento? *
            </label>
            <button
              type="button"
              onClick={fetchIdeas}
              disabled={loadingIdeas || disabled}
              className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {loadingIdeas ? 'Buscando...' : 'Ideas virales'}
            </button>
          </div>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Ej: Una conejita que aprende a compartir sus zanahorias con sus amigos del bosque"
            rows={3}
            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
          />

          {showIdeas && (
            <div className="mt-2 space-y-2 rounded-2xl bg-amber-50/70 p-3">
              {loadingIdeas && <p className="text-xs text-amber-700">Generando ideas...</p>}
              {!loadingIdeas && ideas.length === 0 && (
                <p className="text-xs text-amber-700">No se pudieron obtener ideas ahora.</p>
              )}
              {ideas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickIdea(idea)}
                  className="block w-full rounded-xl bg-white p-2.5 text-left text-sm shadow-sm transition hover:ring-2 hover:ring-amber-300"
                >
                  <span className="font-semibold text-slate-800">{idea.theme}</span>
                  {idea.reason && <span className="mt-0.5 block text-xs text-slate-400">{idea.reason}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Moraleja */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Moraleja (opcional)
          </label>
          <input
            value={moral}
            onChange={(e) => setMoral(e.target.value)}
            placeholder="Ej: Compartir nos hace más felices"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
          />
        </div>

        {/* Personajes */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Personajes (opcional)
          </label>
          <input
            value={characterHints}
            onChange={(e) => setCharacterHints(e.target.value)}
            placeholder="Ej: Rita la conejita, Tom el erizo"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
          />
          {reusedCharacters.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {reusedCharacters.map((c) => (
                <span
                  key={c.id}
                  className="flex items-center gap-1 rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-700"
                >
                  🎭 {c.name}
                  {onRemoveReused && (
                    <button onClick={() => onRemoveReused(c.id)} title="Quitar">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Idioma */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Idioma</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
          >
            {LANG_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Edad */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Edad objetivo</label>
          <div className="flex flex-wrap gap-2">
            {AGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAgeRange(opt.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  ageRange === opt.value
                    ? 'bg-rose-400 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Estilo */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Estilo visual</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setArtStyle(opt.value)}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                  artStyle === opt.value
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nº escenas */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Número de escenas: <span className="text-rose-500">{sceneCount}</span>
          </label>
          <input
            type="range"
            min={3}
            max={12}
            value={sceneCount}
            onChange={(e) => setSceneCount(Number(e.target.value))}
            className="w-full accent-rose-400"
          />
        </div>

        {/* Modo Reel/Short */}
        <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-gradient-to-r from-fuchsia-50 to-rose-50 p-4">
          <div>
            <p className="flex items-center gap-2 font-semibold text-slate-800">
              📱 Modo Reel / Short
            </p>
            <p className="text-xs text-slate-500">
              Optimiza composición vertical, gancho inicial, subtítulos grandes y ritmo rápido.
            </p>
          </div>
          <input
            type="checkbox"
            checked={reelMode}
            onChange={(e) => setReelMode(e.target.checked)}
            className="h-6 w-6 accent-rose-500"
          />
        </label>

        <Button onClick={submit} loading={loading} disabled={!canSubmit} fullWidth>
          {loading ? (
            'Generando cuento...'
          ) : (
            <>
              <Wand2 className="h-5 w-5" /> Generar cuento
              <Sparkles className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
