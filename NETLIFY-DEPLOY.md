# Netlify deploy notes

The site deploys only from Git. Netlify installs and builds every push itself,
so each deploy runs the environment check and the image and site build, and
every deploy maps to a commit.

<!-- TODO(owner): Which cookieless analytics, error reporting and uptime monitor should the site use? None is added; adding one also changes the CSP in netlify.toml and the privacy policy's processor list. (AW-210) -->

## Site settings

Link the Netlify site to the GitHub repository (**Site configuration → Build &
deploy → Continuous deployment**):

- Production branch: `main`
- Base directory: leave blank (the files are at the repo root)
- Build command: `npm run build` (also set in `netlify.toml`)
- Publish directory: `dist` (also set in `netlify.toml`)
- Node version: from `netlify.toml` (`NODE_VERSION = "24"`, the same major as
  `.nvmrc`). `.nvmrc` and `NODE_VERSION = "24"` pin Node 24 LTS (supported to
  April 2028); `.npmrc` sets `engine-strict`, so an install on the wrong Node
  version fails instead of warning.

`netlify.toml` also sets `NPM_FLAGS = "--no-fund"` (npm audit stays on) and the
`/* → /index.html` fallback the single-page app needs: every page has a path
URL (`/product/12`, `/category/tobacco`), and loading or reloading one must
serve `index.html`. Keep that rule. `npm run build` also writes
`dist/sitemap.xml` from the catalog; `public/robots.txt` points at it.

Optional: `VITE_SITE_URL` sets the public origin used for canonical links,
share tags and the sitemap. It defaults to `https://alabamawholesaleinc.com`;
set it only if the site moves to another domain.

## Environment variables, migrations and releases

The build fails unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
in the Netlify environment (scope "All", so deploy previews get them too).
[BACKEND.md](BACKEND.md) covers the variables and the Supabase auth URL
settings (section 4), the database migrations (section 2) and the first-run
sanity check (section 5).

## Netlify Forms

The site uses no Netlify Forms: quotes go to Supabase's `submit_quote`
function and applications to Supabase Auth. If the Netlify dashboard (**Forms**)
still lists `apply`, `quote` or `newsletter` forms from earlier deploys, delete
them and turn off form detection so nothing can post to them.

## Do not drag and drop `dist/`

Do not drag-and-drop `dist/` (or a ZIP of it) onto Netlify: it bypasses the
build, the environment check and version tracking, and a local `dist/` is
easily stale or built without the backend settings.

To look at a production build locally instead, rebuild it first:

```bash
rm -rf dist
npm run build
npm run preview
```
