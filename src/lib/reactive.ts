/**
 * Cursor-reactive mega type (FR-4).
 *
 * Desktop (fine pointer): letters within 120px of the cursor gain weight.
 * Touch: replaced by a slow automatic weight wave (pure CSS, see global.css).
 *
 * Letters are split on the server (`.ch` spans, aria-hidden, the parent keeps
 * an aria-label), so there's no reflow when JS arrives. JS only writes one
 * number per letter, `--k` (0–1); CSS maps it to weight and width.
 *
 * Layout: as a letter gains weight its width axis narrows by a calibrated
 * amount (`--comp-wdth`) so each glyph keeps roughly the same advance and the
 * word stays inside its fixed box.
 */
import { displayFontReady, measure, solveWdth } from './fit';
import { registerKinetic } from './kinetic';
import { finePointer } from './motion';

const RADIUS = 120;
const PEAK = 900;

function calibrate(el: HTMLElement) {
  const inner = el.querySelector<HTMLElement>('.fit__inner');
  if (!inner) return;
  const rest = parseFloat(getComputedStyle(el).getPropertyValue('--rest-wght')) || 500;
  const goal = measure(inner, rest, 100);
  el.style.setProperty('--comp-wdth', String(solveWdth(inner, PEAK, goal)));
}

export function initReactive(el: HTMLElement) {
  if (el.dataset.reactive) return;
  el.dataset.reactive = 'on';

  const letters = [...el.querySelectorAll<HTMLElement>('.ch')];
  const k = new Float32Array(letters.length);
  let px = -1e5;
  let py = -1e5;
  let raf = 0;

  const frame = () => {
    raf = 0;
    const rects = letters.map((l) => l.getBoundingClientRect()); // read all
    let settling = false;
    rects.forEach((r, i) => {
      const dx = Math.max(r.left - px, 0, px - r.right);
      const dy = Math.max(r.top - py, 0, py - r.bottom);
      const x = Math.max(0, 1 - Math.hypot(dx, dy) / RADIUS);
      const target = x * x * (3 - 2 * x); // smoothstep
      k[i] += (target - k[i]) * 0.22;
      if (Math.abs(target - k[i]) > 0.003) settling = true;
    });
    letters.forEach((l, i) => l.style.setProperty('--k', k[i].toFixed(3))); // write all
    if (settling) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const onMove = (e: PointerEvent) => {
    px = e.clientX;
    py = e.clientY;
    kick();
  };

  registerKinetic(el, {
    start() {
      if (finePointer()) {
        addEventListener('pointermove', onMove, { passive: true });
        addEventListener('scroll', kick, { passive: true });
      } else {
        el.classList.add('is-wave');
      }
    },
    stop() {
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', kick);
      cancelAnimationFrame(raf);
      raf = 0;
      el.classList.remove('is-wave');
      k.fill(0);
      letters.forEach((l) => l.style.removeProperty('--k')); // CSS eases back to rest
    },
  });

  displayFontReady().then(() => calibrate(el));
}

export function initAllReactive(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-reactive-type]').forEach(initReactive);
}
