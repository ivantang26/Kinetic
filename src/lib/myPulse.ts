/**
 * "My PULSE": starred sets saved in localStorage (works offline) plus clash
 * detection. Syncs across tabs via the storage event.
 */
import { toMin, type Act } from '../data/festival';

const KEY = 'pulse27:my';
export const MY_EVENT = 'pulse:my';

export function loadStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveStarred(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {}
  window.dispatchEvent(new CustomEvent(MY_EVENT));
}

export function onStarredChange(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  addEventListener('storage', onStorage);
  addEventListener(MY_EVENT, cb);
  return () => {
    removeEventListener('storage', onStorage);
    removeEventListener(MY_EVENT, cb);
  };
}

const overlaps = (a: Act, b: Act) =>
  a.day === b.day && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

/** Map of set id -> the starred sets it clashes with. */
export function findClashes(starred: Act[]) {
  const map = new Map<string, Act[]>();
  for (let i = 0; i < starred.length; i++) {
    for (let j = i + 1; j < starred.length; j++) {
      const a = starred[i];
      const b = starred[j];
      if (!overlaps(a, b)) continue;
      map.set(a.id, [...(map.get(a.id) ?? []), b]);
      map.set(b.id, [...(map.get(b.id) ?? []), a]);
    }
  }
  return map;
}

/** Unique clashing pairs, for the warning banner. */
export function clashPairs(starred: Act[]) {
  const pairs: [Act, Act][] = [];
  for (let i = 0; i < starred.length; i++)
    for (let j = i + 1; j < starred.length; j++)
      if (overlaps(starred[i], starred[j])) pairs.push([starred[i], starred[j]]);
  return pairs;
}
