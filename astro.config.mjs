// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://pulse27.example',
  trailingSlash: 'ignore',
  integrations: [preact()],
  build: { inlineStylesheets: 'auto' },
});
