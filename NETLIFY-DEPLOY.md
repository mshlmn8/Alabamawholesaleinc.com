# Netlify deploy notes

## Easiest drag-and-drop deploy
Use the static ZIP named `alabama-wholesale-netlify-drop.zip`. It contains only the already-built `dist` output, so Netlify does not run `npm install`.

## Source deploy
This source package includes:

- `netlify.toml` with `npm run build` and `publish = "dist"`
- `.nvmrc` and `NODE_VERSION = "20"` so Netlify uses Node 20 LTS instead of the Node 22/npm combo shown in the failed deploy log
- `.npmrc` pointing to the public npm registry
- a cleaned `package-lock.json` whose tarball URLs point to `registry.npmjs.org`, not the internal build registry used in the ChatGPT sandbox

Deploy settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Base directory: leave blank if these files are at the repo root
