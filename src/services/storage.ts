// ============================================================
// Almacenamiento local (localStorage): calendario de publicaciones
// y cuentos guardados. NUNCA se guardan tokens ni contraseñas aquí.
// ============================================================

import type { Branding, CalendarEntry, SavedCharacter, Story } from '../types';

const CALENDAR_KEY = 'cuentos_calendar_v1';
const STORIES_KEY = 'cuentos_stories_v1';
const CHARACTERS_KEY = 'cuentos_characters_v1';
const BRANDING_KEY = 'cuentos_branding_v1';

/** Valores por defecto de la marca. */
export const DEFAULT_BRANDING: Branding = {
  brandName: '',
  logo: undefined,
  introText: '',
  outroText: '¡Suscríbete para más cuentos! 🔔',
  accentColor: '#fb7185',
  showWatermark: true,
  showIntro: true,
  showOutro: true,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silencioso: puede fallar por cuota o modo privado.
  }
}

// -------- Calendario --------

export function getCalendarEntries(): CalendarEntry[] {
  return read<CalendarEntry[]>(CALENDAR_KEY, []).sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );
}

export function saveCalendarEntry(entry: CalendarEntry): void {
  const entries = read<CalendarEntry[]>(CALENDAR_KEY, []);
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  write(CALENDAR_KEY, entries);
}

export function deleteCalendarEntry(id: string): void {
  const entries = read<CalendarEntry[]>(CALENDAR_KEY, []).filter((e) => e.id !== id);
  write(CALENDAR_KEY, entries);
}

// -------- Cuentos --------

export function getSavedStories(): Story[] {
  return read<Story[]>(STORIES_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveStory(story: Story): void {
  const stories = read<Story[]>(STORIES_KEY, []);
  const idx = stories.findIndex((s) => s.id === story.id);
  if (idx >= 0) {
    stories[idx] = story;
  } else {
    stories.push(story);
  }
  write(STORIES_KEY, stories);
}

export function deleteStory(id: string): void {
  const stories = read<Story[]>(STORIES_KEY, []).filter((s) => s.id !== id);
  write(STORIES_KEY, stories);
}

// -------- Personajes reutilizables (galería) --------

export function getSavedCharacters(): SavedCharacter[] {
  return read<SavedCharacter[]>(CHARACTERS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveCharacter(character: SavedCharacter): void {
  const chars = read<SavedCharacter[]>(CHARACTERS_KEY, []);
  const idx = chars.findIndex((c) => c.id === character.id);
  if (idx >= 0) {
    chars[idx] = character;
  } else {
    chars.push(character);
  }
  write(CHARACTERS_KEY, chars);
}

export function deleteCharacter(id: string): void {
  const chars = read<SavedCharacter[]>(CHARACTERS_KEY, []).filter((c) => c.id !== id);
  write(CHARACTERS_KEY, chars);
}

// -------- Marca (branding) --------

export function getBranding(): Branding {
  return { ...DEFAULT_BRANDING, ...read<Partial<Branding>>(BRANDING_KEY, {}) };
}

export function saveBranding(branding: Branding): void {
  write(BRANDING_KEY, branding);
}
