# Campus Connect website

The Campus Connect marketing site, exported from the Claude Design canvas as a static site.

## Deploy on Netlify

1. In Netlify choose **Add new site → Import an existing project → GitHub** and pick this repo.
2. Leave the build command empty. The publish directory is `site` (already set in `netlify.toml`).
3. Deploy. Every push to `main` redeploys automatically.

## What's inside

- `site/` – everything Netlify serves
  - `index.html` and `*.dc.html` – one small page shell per page (the file names match the links between pages)
  - `src/` – each page's design source (`.dc.txt`, plain text so Netlify never rewrites them), including the shared Nav, Footer and the two live demos
  - `assets/` – images and stylesheets
  - `dc-runtime.js` – renders the design sources in the browser (React, bundled)
- `runtime-src/dc-runtime.js` – source of the runtime
- `build.py` – rebuilds `site/` from a fresh copy of the canvas files

## Updating after design changes

Copy the canvas's `project/*.dc.html` files over `site/src/`, replacing any `/_blob/<id>` URLs with the
matching file in `site/assets/` (`build.py` does this automatically), then commit and push.
