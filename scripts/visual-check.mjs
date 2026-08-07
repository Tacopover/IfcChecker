#!/usr/bin/env node
// Real-browser render check. jsdom (what the component tests run in) has no
// layout engine, so it cannot see the failure mode that actually bit us during
// design: a flex child with `overflow: hidden` collapsing below its content and
// silently clipping it. This builds the app, loads it in headless Chromium and
// asserts on the *rendered* result.
//
//   node scripts/visual-check.mjs [--keep] [--scenario <name>] [--probe <file.js>]
//
// With no --scenario the page is only opened (optionally on SMOKE_ROUTE) and
// checked in its empty state — that is the fast default the gate runs. A
// scenario drives the app first: `builder` feeds the rule builder a real IFC
// fixture over this script's own static server, so the assertions below run
// against a loaded model instead of a placeholder. --probe injects an extra
// `async function probe(helpers)` whose return value is reported back, for
// one-off investigation without editing this file.
//
// Skips cleanly (exit 0) when no Chromium is available, so it never blocks a
// machine that cannot run one. Screenshots land in .verify-output/.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".verify-output");
const BUILD = join(OUT, "build");
const FIXTURES = join(ROOT, "fixtures");
const KEEP = process.argv.includes("--keep");

function flag(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const SCENARIO = flag("--scenario", process.env.SMOKE_SCENARIO ?? "");
const PROBE_FILE = flag("--probe", process.env.SMOKE_PROBE ?? "");
// Scenario work is real (fetch + parse), and --virtual-time-budget counts the
// polling waits below against the same clock — the default is far too tight.
const TIME_BUDGET = SCENARIO ? 60000 : 8000;

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

// Each scenario is a body for `async function scenario(h)`, evaluated in the
// page. Anything it returns is reported back under `scenario`.
const SCENARIOS = {
  // The whole point of the results section, in a real browser: a rule that fails elements
  // reports which ones, a rule that matches nothing says so instead of reading as clean, and
  // picking an element shows what it actually carries.
  validate: `
    h.click('[data-smoke-route="validate"]');
    await h.waitFor(function () { return document.getElementById("local-ifc-files"); }, "validate page");
    document.querySelector('input[name="local-engine"][value="ifc-lite"]').click();

    var response = await fetch("/fixtures/ifc/mixed-disciplines.ifc");
    if (!response.ok) throw new Error("fixture fetch failed: " + response.status);
    var bytes = await response.arrayBuffer();

    var input = document.getElementById("local-ifc-files");
    var transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "mixed-disciplines.ifc", { type: "application/octet-stream" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await h.waitFor(function () {
      var button = h.button("Parse files");
      return button && !button.disabled ? button : null;
    }, "enabled Parse files button");
    h.button("Parse files").click();
    await h.waitFor(function () {
      return h.all("table td").some(function (cell) { return cell.textContent === "succeeded"; });
    }, "parsed file row");

    // Three specifications on purpose: one that every wall fails, one whose applicability names
    // a type this model doesn't contain, and one that selects by property value — which the
    // checker cannot represent, and which used to match nothing and read as a clean pass.
    var ids = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<ids xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns="http://standards.buildingsmart.org/IDS">',
      '<info><title>Gate rules</title></info>',
      '<specifications>',
      '<specification name="Walls are fire rated" ifcVersion="IFC4">',
      '<applicability maxOccurs="unbounded"><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>',
      '<requirements><property dataType="IFCLABEL">',
      '<propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>',
      '<baseName><simpleValue>FireRating</simpleValue></baseName></property></requirements>',
      '</specification>',
      '<specification name="Curtain walls are named" ifcVersion="IFC4">',
      '<applicability maxOccurs="unbounded"><entity><name><simpleValue>IFCCURTAINWALL</simpleValue></name></entity></applicability>',
      '<requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>',
      '</specification>',
      '<specification name="Load-bearing walls are named" ifcVersion="IFC4">',
      '<applicability maxOccurs="unbounded">',
      '<entity><name><simpleValue>IFCWALL</simpleValue></name></entity>',
      '<property dataType="IFCBOOLEAN">',
      '<propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>',
      '<baseName><simpleValue>LoadBearing</simpleValue></baseName>',
      '<value><simpleValue>TRUE</simpleValue></value></property>',
      '</applicability>',
      '<requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>',
      '</specification>',
      '</specifications></ids>'
    ].join("\\n");

    var idsInput = document.getElementById("local-ids-file");
    var idsTransfer = new DataTransfer();
    idsTransfer.items.add(new File([ids], "gate-rules.ids", { type: "text/xml" }));
    idsInput.files = idsTransfer.files;
    idsInput.dispatchEvent(new Event("change", { bubbles: true }));

    await h.waitFor(function () {
      var button = h.button("Check files");
      return button && !button.disabled ? button : null;
    }, "enabled Check files button");
    h.button("Check files").click();

    await h.waitFor(function () { return document.querySelector(".check-summary"); }, "check summary");

    function specRow(name) {
      var cell = h.all(".check-summary .spec-name").filter(function (n) { return n.textContent === name; })[0];
      if (!cell) throw new Error("no summary row for " + name);
      var cells = Array.prototype.slice.call(cell.closest("tr").querySelectorAll("td"));
      return { applied: cells[1].textContent, passed: cells[2].textContent, failed: cells[3].textContent };
    }

    var failing = specRow("Walls are fire rated");
    if (failing.applied === "0") throw new Error("the wall rule matched nothing; the fixture or the rule is wrong");
    if (failing.failed === "0") throw new Error("expected the wall rule to fail elements, got " + JSON.stringify(failing));

    var inert = specRow("Curtain walls are named");
    if (inert.applied !== "0") throw new Error("expected the curtain wall rule to match nothing, got " + inert.applied);
    var alert = h.all(".check-summary [role=alert]")[0];
    if (!alert || alert.textContent.indexOf("nothing was checked") === -1) {
      throw new Error("a rule that matched no elements did not say so — it reads as a clean model");
    }

    // A rule the checker cannot represent must show no counts at all: a "0 failed" here would be
    // a measurement never taken, and is exactly how a false pass used to be reported.
    var refusedName = h.all(".check-summary .spec-name").filter(function (n) {
      return n.textContent === "Load-bearing walls are named";
    })[0];
    if (!refusedName) throw new Error("no summary row for the unrepresentable rule");
    var refusedRow = refusedName.closest("tr");
    var refusedCells = Array.prototype.slice.call(refusedRow.querySelectorAll("td"));
    var refused = { applied: refusedCells[1].textContent, passed: refusedCells[2].textContent, failed: refusedCells[3].textContent };
    if (refused.applied !== "\\u2014" || refused.passed !== "\\u2014" || refused.failed !== "\\u2014") {
      throw new Error("an unchecked rule reported counts: " + JSON.stringify(refused));
    }
    var refusedNotice = refusedRow.nextElementSibling;
    if (!refusedNotice || refusedNotice.textContent.indexOf("false pass") === -1) {
      throw new Error("a rule that could not run did not say so — it reads as a clean model");
    }
    if (h.text(".check-summary .summary-line").indexOf("1 not checked") === -1) {
      throw new Error("the summary line hid an unchecked rule: " + h.text(".check-summary .summary-line"));
    }

    // The element behind a row, which the flat table never identified at all.
    var pick = h.all(".check-summary button.link")[0];
    if (!pick) throw new Error("no failing element was offered for inspection");
    var gidNode = pick.querySelector(".element-gid");
    var gid = gidNode ? gidNode.textContent.trim() : "";
    pick.click();

    var details = await h.waitFor(function () { return document.querySelector(".element-details"); }, "element details");
    if (details.textContent.indexOf(gid) === -1) {
      throw new Error("details panel does not describe the element that was picked (" + gid + ")");
    }
    var captions = Array.prototype.slice.call(details.querySelectorAll("caption")).map(function (n) { return n.textContent; });
    if (captions.indexOf("Attributes") === -1) throw new Error("details panel has no attributes section");
    if (captions.length < 3) throw new Error("details panel showed no property sets: " + JSON.stringify(captions));

    // Picking an element scrolls the panel into view, and Chromium screenshots a scrolled
    // document as blank under --virtual-time-budget. The assertions above have already run
    // against real layout; this only keeps the saved screenshot readable.
    window.scrollTo(0, 0);
    await h.settle(50);

    return { failing: failing, inert: inert, refused: refused, picked: gid, sections: captions };
  `,

  // Walks the real flow end to end: files are loaded and parsed on the validate
  // page, and the builder then picks one of them out of the shared store.
  builder: `
    h.click('[data-smoke-route="validate"]');
    await h.waitFor(function () { return document.getElementById("local-ifc-files"); }, "validate page");
    document.querySelector('input[name="local-engine"][value="ifc-lite"]').click();

    var response = await fetch("/fixtures/ifc/mixed-disciplines.ifc");
    if (!response.ok) throw new Error("fixture fetch failed: " + response.status);
    var bytes = await response.arrayBuffer();

    // A real <input type=file> only accepts a FileList, and only DataTransfer
    // can mint one — assigning an array is silently ignored.
    var input = document.getElementById("local-ifc-files");
    var transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "mixed-disciplines.ifc", { type: "application/octet-stream" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await h.waitFor(function () {
      var button = h.button("Parse files");
      return button && !button.disabled ? button : null;
    }, "enabled Parse files button");
    h.button("Parse files").click();

    await h.waitFor(function () {
      var cells = h.all("table td");
      return cells.some(function (cell) { return cell.textContent === "succeeded"; });
    }, "parsed file row");

    h.click('[data-smoke-route="builder"]');
    var picker = await h.waitFor(function () {
      var select = document.getElementById("builder-model");
      return select && !select.disabled ? select : null;
    }, "builder model picker");

    await h.waitFor(function () { return document.querySelector(".tree [role=treeitem]"); }, "model tree");

    // Importing an IDS the builder only partly understands: one editable rule that also carries a
    // facet outside its model, and one specification it must hold read-only rather than mangle.
    var ids = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<ids xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns="http://standards.buildingsmart.org/IDS">',
      '<info><title>Client standard</title><author>bim@client.example</author></info>',
      '<specifications>',
      '<specification name="Walls are named" ifcVersion="IFC2X3 IFC4">',
      '<applicability maxOccurs="unbounded"><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>',
      '<requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute>',
      '<classification><value><simpleValue>21.22</simpleValue></value></classification></requirements>',
      '</specification>',
      '<specification name="Classified elements are named" ifcVersion="IFC4">',
      '<applicability maxOccurs="unbounded"><classification><system><simpleValue>NL/SfB</simpleValue></system></classification></applicability>',
      '<requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>',
      '</specification>',
      '<specification name="Doors are named" ifcVersion="IFC4">',
      '<applicability maxOccurs="unbounded"><entity><name><simpleValue>IFCDOOR</simpleValue></name></entity></applicability>',
      '<requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>',
      '</specification>',
      '</specifications></ids>'
    ].join("\\n");

    var idsInput = document.querySelector('input[aria-label="Import an IDS file"]');
    if (!idsInput) throw new Error("the builder offers no way to import an IDS file");
    var idsTransfer = new DataTransfer();
    idsTransfer.items.add(new File([ids], "client.ids", { type: "text/xml" }));
    idsInput.files = idsTransfer.files;
    idsInput.dispatchEvent(new Event("change", { bubbles: true }));

    await h.waitFor(function () {
      return h.all("article.rule").length === 3 ? true : null;
    }, "three imported specification cards");

    var cards = h.all("article.rule").map(function (card) {
      var editable = card.querySelector(".rule-title");
      var readOnly = card.querySelector(".rule-title-static");
      return editable ? editable.value : readOnly ? readOnly.textContent.trim() : "";
    });
    if (cards.join("|") !== "Walls are named|Classified elements are named|Doors are named") {
      throw new Error("imported specifications lost their document order: " + JSON.stringify(cards));
    }

    // The refused one must be visibly inert, not quietly missing from the list.
    var refusedCard = document.querySelector("article.rule.refused");
    if (!refusedCard) throw new Error("a specification that cannot be edited was not marked as such");
    if (refusedCard.querySelector(".rule-title")) {
      throw new Error("a specification the builder cannot show offered an editable name");
    }
    var keptBadges = h.all(".badge.kept").map(function (n) { return n.textContent; });
    if (keptBadges.indexOf("1 kept") === -1) {
      throw new Error("a rule carrying a preserved requirement did not say so: " + JSON.stringify(keptBadges));
    }

    // The whole point: what the builder could not read still leaves in the exported document.
    var exported = h.text(".xml");
    if (exported.indexOf("<classification>") === -1) {
      throw new Error("re-export dropped the facets the builder could not represent");
    }
    if (exported.indexOf('name="Classified elements are named"') === -1) {
      throw new Error("re-export dropped the specification the builder refused to edit");
    }
    if (exported.indexOf("bim@client.example") === -1) {
      throw new Error("re-export dropped the imported document's own metadata");
    }

    window.scrollTo(0, 0);
    await h.settle(50);

    return {
      fixtureBytes: bytes.byteLength,
      picked: picker.options[picker.selectedIndex].textContent,
      tally: h.text(".explorer .card header .tally"),
      source: h.text(".srcfile"),
      treeRoots: h.all(".tree > [role=treeitem] > .rowline .row-name").map(function (n) { return n.textContent; }),
      imported: cards,
      kept: keptBadges
    };
  `,
};

if (SCENARIO && !SCENARIOS[SCENARIO]) {
  console.error(`browser check FAILED — unknown scenario "${SCENARIO}" (have: ${Object.keys(SCENARIOS).join(", ")})`);
  process.exit(1);
}
if (PROBE_FILE && !existsSync(resolve(PROBE_FILE))) {
  console.error(`browser check FAILED — probe file not found: ${PROBE_FILE}`);
  process.exit(1);
}

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

  // --virtual-time-budget fast-forwards setTimeout, so a timer-based poll burns
  // its whole budget in microseconds and never lets real work (parsing a file)
  // run. Virtual time does pause on a pending network fetch, so the harness's
  // own /__tick endpoint is what actually buys wall-clock time here.
  function settle(ms) {
    return fetch("/__tick?ms=" + (ms == null ? 40 : ms)).then(function () {});
  }
  var h = {
    settle: settle,
    all: function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); },
    text: function (selector) { var el = document.querySelector(selector); return el ? el.textContent.trim() : null; },
    button: function (label) {
      return h.all("button").filter(function (b) { return b.textContent.trim().indexOf(label) === 0; })[0] || null;
    },
    click: function (selector) {
      var el = document.querySelector(selector);
      if (!el) throw new Error("nothing to click for " + selector);
      el.click();
      return el;
    },
    waitFor: async function (predicate, what) {
      for (var tries = 0; tries < 200; tries++) {
        var value = predicate();
        if (value) return value;
        await settle(25);
      }
      throw new Error("timed out waiting for " + (what || "condition"));
    },
  };

  var scenario = ${SCENARIO ? `async function (h) {${SCENARIOS[SCENARIO]}}` : "null"};
  var probe = ${PROBE_FILE ? readFileSync(resolve(PROBE_FILE), "utf8") : "null"};

  // This is a classic script, so it runs before the deferred module bundle —
  // and --virtual-time-budget fast-forwards timers, so a fixed delay would
  // expire before React ever mounts. Wait for load, then poll for the mount.
  async function start() {
    var report = {};
    try {
      await h.waitFor(function () {
        var root = document.getElementById("root");
        return root && root.children.length > 0;
      }, "React mount");
      if (target) {
        var btn = document.querySelector('[data-smoke-route="' + target + '"]');
        if (btn) btn.click();
      }
      if (scenario) report.scenario = (await scenario(h)) || true;
      if (probe) report.probe = (await probe(h)) || true;
    } catch (error) {
      report.driverError = String((error && error.stack) || error);
    }
    // Not requestAnimationFrame: it does not reliably fire under
    // --virtual-time-budget. Reading scrollHeight in collect() forces a
    // synchronous layout, so a painted frame is not needed anyway.
    await settle(50);
    var result = collect();
    result.scenario = report.scenario ?? null;
    result.probe = report.probe ?? null;
    if (report.driverError) result.errors = result.errors.concat(["scenario: " + report.driverError]);
    publish(result);
  }
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
</script>`;

const indexHtml = readFileSync(join(BUILD, "index.html"), "utf8");
const smokePath = join(BUILD, "smoke.html");
writeFileSync(
  smokePath,
  // Both replacements must use a function: a string replacement would treat
  // `$$` / `$&` inside the injected script as substitution patterns.
  indexHtml.replace(/<head(\s[^>]*)?>/i, (m) => m + CAPTURE).replace(/<\/body>/i, () => ASSERT + "</body>")
);

// The bundle is loaded as an ES module, which browsers refuse to fetch over
// file:// — so the built app is served from a throwaway localhost origin.
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".ifc": "application/octet-stream", ".ids": "application/xml",
};
// One report per Chromium run. Runs are sequential, so a single slot is enough —
// but it must be re-armed before each run, or every viewport after the first
// would post into a promise that is already settled and assert nothing.
let awaitingReport = null;

const server = createServer((req, res) => {
  if (req.url.startsWith("/__tick")) {
    const ms = Math.min(Number(new URL(req.url, "http://x").searchParams.get("ms")) || 40, 500);
    setTimeout(() => res.writeHead(204).end(), ms);
    return;
  }
  if (req.method === "POST" && req.url === "/__smoke") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      res.writeHead(204).end();
      const deliver = awaitingReport;
      awaitingReport = null;
      if (!deliver) return;
      try { deliver(JSON.parse(body)); } catch { deliver(null); }
    });
    return;
  }
  const requested = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  // Test fixtures are not part of the build, but a scenario has to be able to
  // hand the app a real file — so they are served alongside it.
  const fromFixtures = requested.startsWith("/fixtures/");
  const base = fromFixtures ? FIXTURES : BUILD;
  const filePath = fromFixtures
    ? join(FIXTURES, requested.slice("/fixtures".length))
    : join(BUILD, requested === "/" ? "index.html" : requested);
  if (!filePath.startsWith(base) || !existsSync(filePath)) {
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
        `--virtual-time-budget=${TIME_BUDGET}`, "--run-all-compositor-stages-before-draw",
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

const PREFIX =
  (SCENARIO ? `${SCENARIO}-` : "") +
  (PROBE_FILE ? `${PROBE_FILE.split(/[\\/]/).pop().replace(/\.[^.]+$/, "")}-` : "");
const VIEWPORTS = [
  { name: `${PREFIX}desktop`, size: "1400,950" },
  { name: `${PREFIX}short`, size: "1400,620" },
  { name: `${PREFIX}narrow`, size: "760,950" },
];

async function renderAt(viewport) {
  const reported = new Promise((resolve) => { awaitingReport = resolve; });
  const run = chromeRun([
    `--window-size=${viewport.size}`,
    `--screenshot=${join(OUT, `render-${viewport.name}.png`)}`,
  ]);
  // Not unref'd: if Chromium dies before reporting, an unref'd timer lets the
  // event loop drain and Node exits 13 with no message at all.
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), 45000); });
  const result = await Promise.race([reported, timeout]);
  clearTimeout(timer);
  awaitingReport = null;
  await run;
  return result;
}

// The clip this gate exists to catch is viewport-dependent — a flex child
// collapses where there is least room — so every viewport is asserted, not just
// the one that happens to be listed first.
const failures = [];
let firstResult = null;

for (const viewport of VIEWPORTS) {
  const result = await renderAt(viewport);
  if (!result) {
    // Silence means the app threw before mounting, which no other viewport can
    // tell us anything new about — stop rather than burn 45s twice more.
    failures.push(`${viewport.name} (${viewport.size}): the page never reported back within 45s — it most likely threw before mounting; see .verify-output/render-${viewport.name}.png`);
    console.log(`  ${viewport.name} (${viewport.size}): NO REPORT`);
    break;
  }
  firstResult ??= result;

  if (!result.mounted) failures.push(`${viewport.name}: app did not mount — #root is empty`);
  if (result.errors.length) {
    failures.push(`${viewport.name}: console/runtime errors:\n    ${result.errors.join("\n    ")}`);
  }
  if (result.clipped.length) {
    failures.push(
      `${viewport.name}: content clipped by an overflow:hidden box (flex-collapse — give it flex-shrink:0 or let its container scroll):\n    ` +
        result.clipped.map((c) => `${c.el} hides ${c.hidden}px`).join("\n    ")
    );
  }
  if (result.horizontalOverflow > 1) {
    failures.push(`${viewport.name}: page scrolls sideways by ${result.horizontalOverflow}px`);
  }

  console.log(
    `  ${viewport.name} (${viewport.size}): mounted ${result.mounted} · ${result.interactive} interactive` +
      ` · ${result.clipped.length} clipped · sideways ${result.horizontalOverflow}px`
  );
}

if (firstResult) {
  console.log(`  routes: ${firstResult.routes.join(", ") || "none"}`);
  console.log(`  headings: ${firstResult.headings.slice(0, 6).join(" | ") || "none"}`);
  if (firstResult.scenario) console.log(`  scenario ${SCENARIO}: ${JSON.stringify(firstResult.scenario)}`);
  if (firstResult.probe) console.log(`  probe: ${JSON.stringify(firstResult.probe, null, 2)}`);
}
console.log(`  screenshots: ${VIEWPORTS.map((v) => `.verify-output/render-${v.name}.png`).join(", ")}`);

server.close();
if (!KEEP) rmSync(BUILD, { recursive: true, force: true });

if (failures.length) {
  console.error("\nbrowser check FAILED:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("browser check passed");
