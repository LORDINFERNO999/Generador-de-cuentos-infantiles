// ============================================================
// Herramientas de crecimiento: análisis del gancho y variantes A/B
// de título (y, en consecuencia, de portada).
// ============================================================

import { Check, Gauge, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { analyzeHook, getTitleVariants } from '../services/api';
import type { Story } from '../types';
import { Button, Card, SectionTitle } from './ui';

interface Props {
  story: Story;
  onUpdateStory: (story: Story) => void;
}

export function GrowthTools({ story, onUpdateStory }: Props) {
  const [analyzing, setAnalyzing] = useState(false);
  const [hookResult, setHookResult] = useState<{
    score: number;
    feedback: string;
    improvedHook: string;
  } | null>(null);

  const [loadingTitles, setLoadingTitles] = useState(false);
  const [titles, setTitles] = useState<string[]>([]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      setHookResult(await analyzeHook(story.hook, story.theme, story.language));
    } catch {
      setHookResult(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyHook = () => {
    if (hookResult?.improvedHook) {
      onUpdateStory({ ...story, hook: hookResult.improvedHook });
    }
  };

  const fetchTitles = async () => {
    setLoadingTitles(true);
    try {
      setTitles(await getTitleVariants(story.title, story.theme, 5, story.language));
    } catch {
      setTitles([]);
    } finally {
      setLoadingTitles(false);
    }
  };

  const scoreColor =
    (hookResult?.score ?? 0) >= 75
      ? 'text-emerald-600'
      : (hookResult?.score ?? 0) >= 50
        ? 'text-amber-600'
        : 'text-red-500';

  return (
    <Card>
      <SectionTitle
        emoji="📈"
        title="Optimización viral"
        subtitle="Analiza el gancho y prueba variantes de título para maximizar la retención."
      />

      {/* Análisis del gancho */}
      <div className="mb-6 rounded-2xl border border-slate-200 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Gauge className="h-4 w-4" /> Gancho inicial
        </p>
        <p className="mb-3 rounded-xl bg-slate-50 p-2 text-sm italic text-slate-600">
          “{story.hook || 'Sin gancho'}”
        </p>
        <Button variant="secondary" onClick={runAnalysis} loading={analyzing} className="!py-2 text-sm">
          <Sparkles className="h-4 w-4" /> Analizar gancho
        </Button>

        {hookResult && (
          <div className="mt-3 space-y-2">
            <p className="text-sm">
              Puntuación:{' '}
              <span className={`text-lg font-bold ${scoreColor}`}>{hookResult.score}/100</span>
            </p>
            <p className="text-sm text-slate-600">{hookResult.feedback}</p>
            {hookResult.improvedHook && (
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-700">Sugerencia mejorada:</p>
                <p className="text-sm text-slate-700">“{hookResult.improvedHook}”</p>
                <Button variant="success" onClick={applyHook} className="mt-2 !py-1.5 text-xs">
                  <Check className="h-4 w-4" /> Aplicar este gancho
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Variantes A/B de título */}
      <div className="rounded-2xl border border-slate-200 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Wand2 className="h-4 w-4" /> Variantes de título (A/B)
        </p>
        <p className="mb-3 text-sm text-slate-500">
          Título actual: <span className="font-semibold text-slate-700">{story.title}</span>
        </p>
        <Button
          variant="secondary"
          onClick={fetchTitles}
          loading={loadingTitles}
          className="!py-2 text-sm"
        >
          <Sparkles className="h-4 w-4" /> Generar variantes
        </Button>

        {titles.length > 0 && (
          <div className="mt-3 space-y-2">
            {titles.map((t, i) => {
              const active = t === story.title;
              return (
                <button
                  key={i}
                  onClick={() => onUpdateStory({ ...story, title: t })}
                  className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left text-sm transition ${
                    active
                      ? 'border-rose-300 bg-rose-50 text-rose-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>{t}</span>
                  {active && <Check className="h-4 w-4" />}
                </button>
              );
            })}
            <p className="text-xs text-slate-400">
              Al cambiar el título, la portada generada en “Preparar para redes” lo reflejará.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
