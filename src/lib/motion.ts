/**
 * Motion gate. Kinetic type runs only when the visitor has not asked for
 * reduced motion AND has not switched on Calm mode (stored for the session).
 * The boot script in Base.astro applies `data-calm` before first paint.
 */

const CALM_KEY = 'pulse27:calm';
export const MOTION_EVENT = 'pulse:motion';

const reduced = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export const isCalm = () => document.documentElement.dataset.calm === 'on';
export const prefersReduced = () => !!reduced?.matches;
export const motionAllowed = () => !isCalm() && !prefersReduced();

/** Desktop pointer that can hover precisely (FR-4 cursor-reactive type). */
export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function setCalm(on: boolean) {
  const root = document.documentElement;
  if (on) root.dataset.calm = 'on';
  else delete root.dataset.calm;
  try {
    sessionStorage.setItem(CALM_KEY, on ? 'on' : 'off');
  } catch {}
  track(on ? 'calm_mode_on' : 'calm_mode_off');
  window.dispatchEvent(new CustomEvent(MOTION_EVENT));
}

export function onMotionChange(cb: () => void) {
  window.addEventListener(MOTION_EVENT, cb);
  reduced?.addEventListener('change', () => {
    window.dispatchEvent(new CustomEvent(MOTION_EVENT));
  });
}

/** Analytics hook: pushes to a dataLayer if the host page provides one. */
export function track(event: string, detail: Record<string, unknown> = {}) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer?.push({ event, ...detail });
}
