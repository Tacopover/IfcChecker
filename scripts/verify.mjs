#!/usr/bin/env node
// Single gate every change must pass before it is reported as done.
//
//   node scripts/verify.mjs            build + typecheck + all tests
//   node scripts/verify.mjs --visual   ... plus a real-browser render check
//   node scripts/verify.mjs --fast     tests only (use while iterating, never to finish)
//
// Exits non-zero on the first failing stage and prints that stage's tail.
// `pnpm` is only reachable through corepack in this environment.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const FAST = args.has("--fast");
const VISUAL = args.has("--visual");
const TAIL_LINES = 40;

function run(label, command, commandArgs) {
  return new Promise((resolve) => {
    const started = Date.now();
    process.stdout.write(`▸ ${label}… `);
    // shell: true so `corepack` resolves on Windows too — it ships as a .cmd/.ps1 shim there,
    // which a shell-less spawn cannot execute by bare name. Node quotes the args array correctly
    // for either shell, so this changes nothing about what actually runs on the NAS side.
    const child = spawn(command, commandArgs, { cwd: ROOT, env: process.env, shell: true });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => resolve({ label, ok: false, output: String(error), seconds: 0 }));
    child.on("close", (code) => {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      process.stdout.write(code === 0 ? `ok (${seconds}s)\n` : `FAILED (${seconds}s)\n`);
      resolve({ label, ok: code === 0, output, seconds });
    });
  });
}

const stages = [];
if (!FAST) stages.push(["build + typecheck", "corepack", ["pnpm", "-r", "run", "build"]]);
stages.push(["unit + component tests", "corepack", ["pnpm", "-r", "run", "test"]]);
if (VISUAL) stages.push(["browser render check", process.execPath, ["scripts/visual-check.mjs"]]);
// The results section is where a wrong answer is most expensive — a rule that silently
// checked nothing reads as a passing model — so it is driven end to end in a real browser.
if (VISUAL)
  stages.push([
    "browser validate check",
    process.execPath,
    ["scripts/visual-check.mjs", "--scenario", "validate"],
  ]);

const results = [];
for (const [label, command, commandArgs] of stages) {
  const result = await run(label, command, commandArgs);
  results.push(result);
  if (!result.ok) {
    console.error(`\n─── ${label} failed — last ${TAIL_LINES} lines ───`);
    console.error(result.output.trimEnd().split("\n").slice(-TAIL_LINES).join("\n"));
    console.error(`\nVERIFY FAILED at: ${label}`);
    process.exit(1);
  }
}

// Test counts are the only signal worth surfacing on success — a stage that
// runs zero tests passes just as loudly as one that runs hundreds.
const testOutput = results.find((r) => r.label.includes("tests"))?.output ?? "";
const totals = [...testOutput.matchAll(/Tests\s+(\d+) passed/g)].reduce((sum, m) => sum + Number(m[1]), 0);
const files = [...testOutput.matchAll(/Test Files\s+(\d+) passed/g)].reduce((sum, m) => sum + Number(m[1]), 0);

console.log(`\nVERIFY PASSED — ${totals} tests in ${files} files${FAST ? " (--fast: build skipped)" : ""}`);
if (totals === 0) {
  console.error("No tests ran. That is a failure, not a pass.");
  process.exit(1);
}
