#!/usr/bin/env node
// Real-browser render check. jsdom (what the component tests run in) has no
// layout engine, so it cannot see the failure mode that actually bit us during
// design: a flex child with `overflow: hidden` collapsing below its content and
// silently clipping it. This builds the app, loads it in headless Chromium and
// asserts on the *rendered* result.
//
//   node scripts/visual-check.mjs [--keep]
//
// Skips cleanly (exit 0) when no Chromium is available, so it never blocks a
// machine that cannot run one. Screenshots land in .verify-output/.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".verify-output");
const BUILD = join(OUT, "build");
const KEEP = process.argv.includes("--keep");

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.log("browser check SKIPPED — no Chromium found (set CHROME_BIN to enable)");
  process.exit(0);
}

// A Chromium that is present but missing shared libraries is worse than absent:
// it would fail every run for a reason unrelated to the code under test.
const probe = spawnSync(chrome, ["--version"], { encoding: "utf8" });
if (probe.status !== 0) {
  console.log(`browser check SKIPPED — Chromium present but not runnable: ${(probe.stderr || "").trim().split("\n")[0]}`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
rmSync(BUILD, { recursive: true, force: true });

const build = spawnSync(
  "corepack",
  ["pnpm", "--filter", "@ifc-qa/web", "exec", "vite", "build", "--outDir", BUILD, "--emptyOutDir"],
  { cwd: ROOT, encoding: "utf8" }
);
if (build.status !== 0) {
  console.error("browser check FAILED — vite build errored");
  console.error((build.stdout || "") + (build.stderr || ""));
  process.exit(1);
}

// Captures anything the app logs or throws. Must run before the app's own
// scripts, so it is injected at the very top of <head>.
const CAPTURE = `<script>
window.__smokeErrors = [];
(function () {
  var realError = console.error;
  console.error = function () {
    window.__smokeErrors.push("console.error: " + Array.prototype.join.call(arguments, " "));
    realError.apply(console, arguments);
  };
  window.addEventListener("error", function (e) { window.__smokeErrors.push("uncaught: " + e.message); });
  window.addEventListener("unhandledrejection", function (e) { window.__smokeErrors.push("unhandled rejection: " + e.reason); });
})();
</script>`;

const ASSERT = `<script>
(function () {
  function describe(el) {
    return el.tagName.toLowerCase()
      + (el.id ? "#" + el.id : "")
      + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\\s+/).join(".") : "");
  }
  function collect() {
    var clipped = [];
    document.querySelectorAll("*").forEach(function (el) {
      if (!el.children.length || el.clientHeight === 0) return;
      var overflowY = getComputedStyle(el).overflowY;
      // scrollHeight > clientHeight with a hidden overflow means content the
      // user can never reach — the flex-collapse signature.
      if (overflowY === "hidden" && el.scrollHeight - el.clientHeight > 2) {
        clipped.push({ el: describe(el), hidden: el.scrollHeight - el.clientHeight });
      }
    });
    var root = document.getElementById("root");
    return {
      mounted: !!root && root.children.length > 0,
      errors: window.__smokeErrors || [],
      clipped: clipped,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      headings: Array.from(document.querySelectorAll("h1,h2")).map(function (h) { return h.textContent.trim(); }),
      routes: Array.from(document.querySelectorAll("[data-smoke-route]")).map(function (b) { return b.getAttribute("data-smoke-route"); }),
      interactive: document.querySelectorAll("button, select, input").length
    };
  }
  // Posted back to the harness rather than written into the DOM: --dump-dom
  // snapshots the document at load, so anything appended after the app mounts
  // would never be seen.
  function publish(result) {
    fetch("/__smoke", { method: "POST", body: JSON.stringify(result) });
  }
  var target = ${JSON.stringify(process.env.SMOKE_ROUTE ?? "")};
  // This is a classic script, so it runs before the deferred module bundle —
  // and --virtual-time-budget fast-forwards timers, so a fixed delay would
  // expire before React ever mounts. Wait for load, then poll for the mount.
  function start() {
    var tries = 0;
    (function attempt() {
      var root = document.getElementById("root");
      if ((root && root.children.length > 0) || ++tries > 100) {
        if (target) {
          var btn = document.querySelector('[data-smoke-route="' + target + '"]');
          if (btn) btn.click();
        }
        // Not requestAnimationFrame: it does not reliably fire under
        // --virtual-time-budget. Reading scrollHeight in collect() forces a
        // synchronous layout, so a painted frame is not needed anyway.
        setTimeout(function () { publish(collect()); }, 50);
        return;
      }
      setTimeout(attempt, 50);
    })();
  }
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
</script>`;

const indexHtml = readFileSync(join(BUILD, "index.html"), "utf8");
const smokePath = join(BUILD, "smoke.html");
writeFileSync(
  smokePath,
  indexHtml.replace(/<head(\s[^>]*)?>/i, (m) => m + CAPTURE).replace(/<\/body>/i, ASSERT + "</body>")
);

// The bundle is loaded as an ES module, which browsers refuse to fetch over
// file:// — so the built app is served from a throwaway localhost origin.
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};
let reportResult;
const reported = new Promise((resolve) => { reportResult = resolve; });

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/__smoke") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      res.writeHead(204).end();
      try { reportResult(JSON.parse(body)); } catch { reportResult(null); }
    });
    return;
  }
  const requested = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(BUILD, requested === "/" ? "index.html" : requested);
  if (!filePath.startsWith(BUILD) || !existsSync(filePath)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
  res.end(readFileSync(filePath));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
// Keep-alive sockets from Chromium outlive close() and would hold the event
// loop open forever; unref lets the process exit the moment work is done.
server.unref();

// Must be async: spawnSync would block the event loop, leaving the server above
// unable to answer the very request Chromium is waiting on.
function chromeRun(extraArgs) {
  return new Promise((resolve) => {
    const child = spawn(
      chrome,
      [
        "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
        "--virtual-time-budget=8000", "--run-all-compositor-stages-before-draw",
        ...extraArgs,
        `${origin}/smoke.html`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "", stderr = "";
    child.stdout.on("data", (c) => { stdout += c; });
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("close", (status) => resolve({ stdout, stderr, status }));
  });
}

const VIEWPORTS = [
  { name: "desktop", size: "1400,950" },
  { name: "short", size: "1400,620" },
  { name: "narrow", size: "760,950" },
];

const first = chromeRun([
  `--window-size=${VIEWPORTS[0].size}`,
  `--screenshot=${join(OUT, `render-${VIEWPORTS[0].name}.png`)}`,
]);
const timeout = new Promise((resolve) => setTimeout(() => resolve(undefined), 45000).unref());
const result = await Promise.race([reported, timeout]);
await first;

if (!result) {
  server.close();
  console.error("browser check FAILED — the page never reported back within 45s.");
  console.error("The app most likely threw before mounting; see .verify-output/render-desktop.png");
  process.exit(1);
}

for (const viewport of VIEWPORTS.slice(1)) {
  await chromeRun([`--window-size=${viewport.size}`, `--screenshot=${join(OUT, `render-${viewport.name}.png`)}`]);
}

const failures = [];
if (!result.mounted) failures.push("app did not mount — #root is empty");
if (result.errors.length) failures.push(`console/runtime errors:\n    ${result.errors.join("\n    ")}`);
if (result.clipped.length) {
  failures.push(
    "content clipped by an overflow:hidden box (flex-collapse — give it flex-shrink:0 or let its container scroll):\n    " +
      result.clipped.map((c) => `${c.el} hides ${c.hidden}px`).join("\n    ")
  );
}
if (result.horizontalOverflow > 1) failures.push(`page scrolls sideways by ${result.horizontalOverflow}px`);

console.log(`  mounted: ${result.mounted} · interactive elements: ${result.interactive} · routes: ${result.routes.join(", ") || "none"}`);
console.log(`  headings: ${result.headings.slice(0, 6).join(" | ") || "none"}`);
console.log(`  screenshots: ${VIEWPORTS.map((v) => `.verify-output/render-${v.name}.png`).join(", ")}`);

server.close();
if (!KEEP) rmSync(BUILD, { recursive: true, force: true });

if (failures.length) {
  console.error("\nbrowser check FAILED:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("browser check passed");
