// The app is a client-rendered SPA with two real, user-facing pages ("/" and
// "/build-rules/"), tracked in the browser by src/routing.ts. GitHub Pages
// has no server-side rewrites, so a direct request for /build-rules/ needs
// an actual file there — this copies the built shell into that path with its
// own <title>/description/canonical/OG/Twitter tags baked in, so search
// engines (and anyone opening the link directly) get a real 200 response
// with the right metadata already in the raw HTML, not just after the JS
// bundle runs. The relative asset references vite build emits (base: "./")
// are one directory shallower than this copy sits at, so they're rewritten
// to "../assets/..." to still resolve.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTES, SITE_ORIGIN } from "../seo-routes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const rootHtmlPath = join(distDir, "index.html");

const rootHtml = await readFile(rootHtmlPath, "utf8");

function withMeta(html, route) {
  const url = `${SITE_ORIGIN}${route.path}`;
  return html
    .replace(/="\.\//g, '="../')
    .replace(/<title>.*?<\/title>/s, `<title>${route.title}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/s,
      `$1${route.description}$2`
    )
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${route.title}$2`)
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${route.description}$2`
    )
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${route.title}$2`)
    .replace(
      /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
      `$1${route.description}$2`
    );
}

for (const [id, route] of Object.entries(ROUTES)) {
  if (route.path === "/") continue; // already what `vite build` produced at dist/index.html
  const outDir = join(distDir, route.path);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  await writeFile(outPath, withMeta(rootHtml, route));
  console.log(`[prerender-routes] ${id} -> ${outPath}`);
}

// Fallback for any path outside the known routes: the same shell the site
// used to serve for every URL, so an unrecognized path still shows the app
// (defaulting to "/") instead of GitHub Pages' bare 404 page.
const notFoundPath = join(distDir, "404.html");
await copyFile(rootHtmlPath, notFoundPath);
console.log(`[prerender-routes] fallback -> ${notFoundPath}`);
