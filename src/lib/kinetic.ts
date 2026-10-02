/**
 * Kinetic manager: enforces the legibility rules.
 *
 * - Only one kinetic element is active in the viewport at a time (marquees
 *   are exempt and never register here).
 * - The winner is the most visible element nearest the viewport centre, with
 *   hysteresis so two candidates don't flicker.
 * - Text never animates below 32px on screen.
 * - Nothing runs while Calm mode or prefers-reduced-motion is on.
 */
import { motionAllowed, onMotionChange } from './motion';

export interface KineticOptions {
  start: () => void;
  stop: () => void;
  /** Skip when rendered font-size is below 32px. Default true. */
  minSize?: boolean;
  /** Added to the score; use for elements that should win ties. */
  priority?: number;
}

interface Entry extends Required<KineticOptions> {
  el: HTMLElement;
  ratio: number;
  active: boolean;
}

const MIN_PX = 32;
const entries = new Map<Element, Entry>();
let io: IntersectionObserver | null = null;
let queued = false;

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    pick();
  });
}

function init() {
  if (io) return;
  io = new IntersectionObserver(
    (list) => {
      for (const rec of list) {
        const e = entries.get(rec.target);
        if (e) e.ratio = rec.isIntersecting ? rec.intersectionRatio : 0;
      }
      schedule();
    },
    { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1] },
  );
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('pulse:fitted', schedule);
  onMotionChange(schedule);
}

function score(e: Entry) {
  const r = e.el.getBoundingClientRect();
  const vh = innerHeight || 1;
  const centre = Math.abs(r.top + r.height / 2 - vh / 2) / vh; // 0 = centred
  return e.ratio - centre * 0.6 + e.priority + (e.active ? 0.15 : 0);
}

function pick() {
  let best: Entry | null = null;
  let bestScore = -Infinity;
  if (motionAllowed()) {
    for (const e of entries.values()) {
      if (e.ratio < 0.2) continue;
      if (e.minSize && parseFloat(getComputedStyle(e.el).fontSize) < MIN_PX) continue;
      const s = score(e);
      if (s > bestScore) {
        best = e;
        bestScore = s;
      }
    }
  }
  // Stop first, then start, so two are never active in the same frame.
  for (const e of entries.values()) {
    if (e !== best && e.active) {
      e.active = false;
      e.el.classList.remove('is-kinetic');
      e.stop();
    }
  }
  if (best && !best.active) {
    best.active = true;
    best.el.classList.add('is-kinetic');
    best.start();
  }
}

export function registerKinetic(el: HTMLElement, opts: KineticOptions) {
  init();
  const entry: Entry = { minSize: true, priority: 0, ...opts, el, ratio: 0, active: false };
  entries.set(el, entry);
  io!.observe(el);
  return () => {
    if (entry.active) entry.stop();
    el.classList.remove('is-kinetic');
    io!.unobserve(el);
    entries.delete(el);
  };
}

/** Force a re-evaluation (e.g. after Calm mode changes). */
export const refreshKinetic = schedule;
