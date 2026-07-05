import { defineConfig } from 'astro/config';

const base = '/portugal-events';

export default defineConfig({
  site: 'https://maxim4to.github.io',
  base,
  srcDir: './site',
  redirects: {
    '/': base + '/places/',
  },
  vite: {
    plugins: [
      {
        // Dev-only: the `redirects` config above is applied at build time, but
        // `astro dev` serves the bare root as 404. Redirect it so hitting `/`
        // (e.g. a fresh preview tab) lands on the app.
        name: 'dev-root-redirect',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/') {
              res.statusCode = 302;
              res.setHeader('Location', base + '/places/');
              res.end();
              return;
            }
            next();
          });
        },
      },
    ],
  },
});
