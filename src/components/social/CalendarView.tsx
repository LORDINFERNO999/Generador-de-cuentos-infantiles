// ============================================================
// "📅 CALENDARIO" (spec 45).
// Guarda videos preparados con fecha, hora, plataforma, título y estado.
// Si una plataforma no permite programar por API, se guarda como
// recordatorio para publicación manual.
// ============================================================

import { CalendarPlus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  deleteCalendarEntry,
  getCalendarEntries,
  saveCalendarEntry,
} from '../../services/storage';
import { ALL_PLATFORMS, PLATFORMS } from '../../services/social';
import type { CalendarEntry, PublicationStatus, SocialPlatform, Story } from '../../types';
import { Badge, Button, Card, SectionTitle } from '../ui';

interface Props {
  story?: Story | null;
}

const STATUS_COLORS: Record<PublicationStatus, 'amber' | 'green' | 'red' | 'blue' | 'slate'> = {
  borrador: 'slate',
  preparado: 'blue',
  programado: 'amber',
  publicado: 'green',
  error: 'red',
};

const STATUS_LABELS: Record<PublicationStatus, string> = {
  borrador: 'Borrador',
  preparado: 'Preparado',
  programado: 'Programado',
  publicado: 'Publicado',
  error: 'Error',
};

export function CalendarView({ story }: Props) {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [platform, setPlatform] = useState<SocialPlatform>('youtube');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [title, setTitle] = useState('');

  const refresh = () => setEntries(getCalendarEntries());

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (story) setTitle(story.title);
  }, [story]);

  const add = () => {
    if (!date) return;
    const entry: CalendarEntry = {
      id: `cal_${Date.now()}`,
      storyId: story?.id || 'manual',
      storyTitle: story?.title || title || 'Cuento',
      platform,
      date,
      time,
      status: 'programado',
      title: title || story?.title || 'Cuento',
      createdAt: Date.now(),
    };
    saveCalendarEntry(entry);
    refresh();
    setDate('');
  };

  const changeStatus = (entry: CalendarEntry, status: PublicationStatus) => {
    saveCalendarEntry({ ...entry, status });
    refresh();
  };

  const remove = (id: string) => {
    deleteCalendarEntry(id);
    refresh();
  };

  return (
    <Card>
      <SectionTitle
        emoji="📅"
        title="Calendario"
        subtitle="Programa recordatorios de publicación. Se guardan en tu navegador."
      />

      {/* Formulario para añadir */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del cuento"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Plataforma</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
          >
            {ALL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORMS[p].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Hora</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={add} disabled={!date} fullWidth>
            <CalendarPlus className="h-5 w-5" /> Programar recordatorio
          </Button>
        </div>
      </div>

      {/* Lista de entradas */}
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No hay publicaciones programadas todavía.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 p-3"
            >
              <span className="text-xl">{PLATFORMS[entry.platform].emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{entry.title}</p>
                <p className="text-xs text-slate-500">
                  {entry.date} · {entry.time} · {PLATFORMS[entry.platform].label}
                </p>
              </div>
              <select
                value={entry.status}
                onChange={(e) => changeStatus(entry, e.target.value as PublicationStatus)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none"
              >
                {(Object.keys(STATUS_LABELS) as PublicationStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <Badge color={STATUS_COLORS[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
              <button
                onClick={() => remove(entry.id)}
                className="rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
