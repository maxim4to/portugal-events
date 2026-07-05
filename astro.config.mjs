import { defineConfig } from 'astro/config';

const base = '/portugal-events';

export default defineConfig({
  site: 'https://maxim4to.github.io',
  base,
  srcDir: './site',
  redirects: {
    '/': base + '/places/',
  },
});
