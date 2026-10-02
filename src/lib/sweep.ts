/**
 * Page transitions: the next page's title sweeps across as mega type (500ms).
 *
 * 250ms in on the outgoing page, 250ms out on the incoming page. Browsers
 * hold the old frame during same-origin navigation, so the overlay covers the
 * gap. The boot script in Base.astro adds `html.sweep-in` before first paint
 * when a sweep is in progress.
 */
import { PAGE_TITLES } from '../data/festival';
import { motionAllowed } from './motion';

const KEY = 'pulse27:sweep';
const HALF = 250;

const norm = (path: string) => (path.endsWith('/') ? path : `${path}/`);

function titleFor(url: URL) {
  return PAGE_TITLES[norm(url.pathname)] ?? null;
}

export function initSweep() {
  const overlay = document.querySelector<HTMLElement>('.sweep');
  const word = overlay?.querySelector<HTMLElement>('.sweep__word');
  if (!overlay || !word) return;
  const root = document.documentElement;

  // Incoming half.
  if (root.classList.contains('sweep-in')) {
    let done = false;
    const out = () => {
      if (done) return;
      done = true;
      root.classList.add('sweep-out');
      setTimeout(() => root.classList.remove('sweep-in', 'sweep-out'), HALF + 20);
    };
    requestAnimationFrame(() => requestAnimationFrame(out)); // after first paint
    setTimeout(out, 150); // rAF doesn't run in background tabs; never leave the page covered
  }

  addEventListener('pageshow', (e) => {
    if (e.persisted) root.classList.remove('sweep-in', 'sweep-out', 'sweep-go');
  });

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a');
    if (!a || a.target || a.hasAttribute('download') || a.dataset.noSweep !== undefined) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) return; // same page (hash or filter)
    const title = titleFor(url);
    if (!title || !motionAllowed()) return;

    e.preventDefault();
    word.textContent = title;
    word.style.fontSize = '';
    // Size the sweep word to the viewport width.
    const w = word.getBoundingClientRect().width || 1;
    word.style.fontSize = `${(parseFloat(getComputedStyle(word).fontSize) * innerWidth * 0.94) / w}px`;
    try {
      sessionStorage.setItem(KEY, title);
    } catch {}
    root.classList.add('sweep-go');
    setTimeout(() => {
      location.href = url.href;
    }, HALF);
  });
}
