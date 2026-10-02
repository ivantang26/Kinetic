/**
 * Fit-text. Sizes each `[data-fit]` element so its text fills the container
 * exactly at a given variable-font state, recalculated on resize and font load.
 *
 *   <span class="fit" data-fit="fill|cap"><span class="fit__inner">NAME</span></span>
 *
 * - `fill` grows or shrinks to the container width.
 * - `cap` treats the CSS font-size as a maximum and only shrinks (artist list).
 * - The state to measure at comes from CSS custom properties `--fit-wght` and
 *   `--fit-wdth` (so breakpoints can change it), defaulting to 700 / 100.
 *   Measure at the widest state an element can reach and it never overflows.
 * - `data-fit-fill="0.96"` leaves breathing room.
 *
 * Measurement uses detached clones in an offscreen host, never the live
 * element: live kinetic type may be mid-animation, and browsers can report
 * the animated axis values even while a measuring override applies. Clones
 * are appended in one batch and read in one layout pass.
 */

const REF = 100; // measure at 100px, then scale linearly

const num = (v: string, d: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

let host: HTMLDivElement | null = null;
function measureHost() {
  if (!host || !host.isConnected) {
    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;contain:layout style;';
    document.body.append(host);
  }
  return host;
}

/** A static copy of `source` set at REF px in the given axis state. */
function cloneFor(source: HTMLElement, wght: number, wdth: number) {
  const cs = getComputedStyle(source);
  const size = parseFloat(cs.fontSize) || REF;
  const ls = parseFloat(cs.letterSpacing);
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.className = 'is-measuring';
  clone.style.cssText = [
    'display:inline-block',
    'white-space:nowrap',
    `font-family:${cs.fontFamily}`,
    `text-transform:${cs.textTransform}`,
    `letter-spacing:${Number.isFinite(ls) ? `${ls / size}em` : 'normal'}`,
    `font-size:${REF}px`,
    `--m-wght:${wght}`,
    `--m-wdth:${wdth}`,
  ].join(';');
  return clone;
}

/** Widths at REF px for a batch of [element, wght, wdth] jobs: one layout. */
export function measureBatch(jobs: [el: HTMLElement, wght: number, wdth: number][]) {
  const h = measureHost();
  const clones = jobs.map(([el, wg, wd]) => cloneFor(el, wg, wd));
  h.append(...clones);
  const widths = clones.map((c) => c.getBoundingClientRect().width);
  h.replaceChildren();
  return widths;
}

/** Width of `el`'s text at REF px in the given axis state. */
export const measure = (el: HTMLElement, wght: number, wdth: number) => measureBatch([[el, wght, wdth]])[0];

/**
 * Binary-search the width axis so `el` at `wght` is `goal` px wide at REF size.
 * Returns a wdth clamped to the font's 50–150 range.
 */
export function solveWdth(el: HTMLElement, wght: number, goal: number) {
  let lo = 50;
  let hi = 150;
  if (measure(el, wght, hi) <= goal) return hi;
  if (measure(el, wght, lo) >= goal) return lo;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    if (measure(el, wght, mid) > goal) hi = mid;
    else lo = mid;
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}

/**
 * Resolves once the display face is actually loaded. `document.fonts.ready`
 * is not enough: it resolves immediately if the load hasn't started yet.
 */
export const displayFontReady = (): Promise<unknown> =>
  document.fonts?.load('700 100px "Pulse Flex"').catch(() => undefined) ?? Promise.resolve();

const innerOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.fit__inner') ?? el;
const lastWidth = new WeakMap<Element, number>();

export function fitAll(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-fit]')].filter(
    (el) => el.getClientRects().length > 0,
  );
  if (!els.length) return;

  // 1. Clear previous size so the CSS max (clamp) can be read.
  for (const el of els) el.style.fontSize = '';
  const info = els.map((el) => {
    const cs = getComputedStyle(el);
    return {
      max: el.dataset.fit === 'fill' ? Infinity : num(cs.fontSize, 88),
      wght: num(cs.getPropertyValue('--fit-wght'), 700),
      wdth: num(cs.getPropertyValue('--fit-wdth'), 100),
      avail: el.clientWidth - num(cs.paddingLeft, 0) - num(cs.paddingRight, 0),
      fill: num(el.dataset.fitFill ?? '', 1),
    };
  });

  // 2. Measure every text in one batch.
  const widths = measureBatch(els.map((el, i) => [innerOf(el), info[i].wght, info[i].wdth]));

  // 3. Apply.
  els.forEach((el, i) => {
    const { avail, max, fill } = info[i];
    const size = widths[i] > 0 ? Math.min(max, ((avail * fill) / widths[i]) * REF) : max;
    el.style.fontSize = `${Math.floor(size * 100) / 100}px`;
    el.style.setProperty('--fit-size', String(size));
    lastWidth.set(el, el.clientWidth);
  });

  window.dispatchEvent(new CustomEvent('pulse:fitted'));
}

let inited = false;

/** Run fitAll now, when fonts load, and whenever a fitted box changes width. */
export function initFit() {
  if (inited) {
    fitAll();
    return;
  }
  inited = true;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fitAll();
    });
  };

  const ro = new ResizeObserver((entries) => {
    // Only refit on width changes; our own font-size writes change height.
    if (entries.some((e) => Math.round(e.contentRect.width) !== Math.round(lastWidth.get(e.target) ?? -1))) {
      schedule();
    }
  });
  const observeAll = () => document.querySelectorAll('[data-fit]').forEach((el) => ro.observe(el));

  fitAll();
  observeAll();
  displayFontReady().then(() => fitAll()); // direct: rAF may be throttled while hidden
  document.fonts?.addEventListener?.('loadingdone', schedule);
  window.addEventListener('pulse:refit', () => {
    observeAll();
    schedule();
  });
}
