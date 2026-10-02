/**
 * Workbox service worker (FR-7). Runs after `astro build`.
 *
 * - Precaches every page, script, style and font (the site is tiny: no photos),
 *   so the schedule and My PULSE work in airplane mode after one visit.
 * - Query strings are ignored when matching pages (?day=sat is client-side).
 * - Other navigations go to the network and fall back to the schedule only
 *   when offline (navigateFallback would hijack them even when online).
 * - The queue page and the ticket API are never served from cache.
 */
import { generateSW } from 'workbox-build';

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,woff2,svg,webmanifest}'],
  globIgnores: ['queue/**', 'press/*.svg', 'api/**'],
  swDest: 'dist/sw.js',
  mode: 'production',
  inlineWorkboxRuntime: true,
  sourcemap: false,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  ignoreURLParametersMatching: [/.*/],
  directoryIndex: 'index.html',
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/queue/'),
      handler: 'NetworkOnly',
      options: { precacheFallback: { fallbackURL: '/schedule/index.html' } },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: { cacheName: 'pulse-api', networkTimeoutSeconds: 4, expiration: { maxEntries: 4 } },
    },
  ],
});

warnings.forEach((w) => console.warn(w));
console.log(`sw.js: precached ${count} files, ${(size / 1024).toFixed(1)} KB`);
