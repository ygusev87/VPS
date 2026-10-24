// Progress lives only on this device. Storage can be unavailable (private
// mode, blocked site data), so every access is guarded.
const KEY = 'electro-table:v1';

export interface Progress {
  done: Set<string>;
  sound: boolean;
  /** Night table: dark room, glowing parts. */
  night: boolean;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as { done?: string[]; sound?: boolean; night?: boolean };
      return { done: new Set(d.done ?? []), sound: d.sound ?? true, night: d.night ?? false };
    }
  } catch {
    // ignore
  }
  return { done: new Set(), sound: true, night: false };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ done: [...p.done], sound: p.sound, night: p.night }));
  } catch {
    // ignore
  }
}
