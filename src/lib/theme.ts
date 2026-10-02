/**
 * Day theme (FR-5). Filtering to a day recolours the whole site: the colour
 * tokens are registered custom properties, so a single attribute change on
 * <html> transitions every surface over 400ms.
 */

export type ThemeDay = 'all' | 'fri' | 'sat' | 'sun';

const DAY_KEY = 'pulse27:day';
export const DAY_EVENT = 'pulse:day';

const META_COLOR: Record<ThemeDay, string> = {
  all: '#0A0A0A',
  fri: '#0A0A0A',
  sat: '#0A0A0A',
  sun: '#2B4BFF',
};

export function getDay(): ThemeDay {
  const d = document.documentElement.dataset.day;
  return d === 'fri' || d === 'sat' || d === 'sun' ? d : 'all';
}

export function setDay(day: ThemeDay) {
  const root = document.documentElement;
  if (getDay() === day) return;
  if (day === 'all') delete root.dataset.day;
  else root.dataset.day = day;
  try {
    sessionStorage.setItem(DAY_KEY, day);
  } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[day]);
  window.dispatchEvent(new CustomEvent(DAY_EVENT, { detail: day }));
}

export const isDay = (v: unknown): v is ThemeDay => v === 'all' || v === 'fri' || v === 'sat' || v === 'sun';
