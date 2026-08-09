#!/usr/bin/env node
// Fetches buildingSMART's official IDS conformance cases into .conformance/.
//
//   node scripts/fetch-conformance-cases.mjs
//
// The suite is ~640 small files that belong to buildingSMART, not to us, so it is fetched rather
// than vendored — a sparse, blobless clone of just the TestCases folder, about 3 MB. Nothing in
// `pnpm verify` depends on it; `pnpm --filter @ifc-qa/ids-validator test:conformance` does.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/buildingSMART/IDS.git";
const SUBDIR = "Documentation/ImplementersDocumentation/TestCases";
const TARGET = join(ROOT, ".conformance");
const WORK = join(ROOT, ".conformance-clone");

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) {
    console.error(`\ngit ${args.join(" ")} failed with status ${result.status}`);
    process.exit(1);
  }
  return result.stdout.toString().trim();
}

rmSync(WORK, { recursive: true, force: true });

process.stdout.write(`▸ cloning ${SUBDIR} from buildingSMART/IDS… `);
git(["clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO, WORK], ROOT);
git(["sparse-checkout", "set", SUBDIR], WORK);
const commit = git(["rev-parse", "HEAD"], WORK);
console.log("ok");

const cases = join(WORK, SUBDIR);
if (!existsSync(cases)) {
  console.error(`\n${SUBDIR} is not in the clone — the upstream layout has moved.`);
  process.exit(1);
}

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET, { recursive: true });
renameSync(cases, join(TARGET, "TestCases"));
rmSync(WORK, { recursive: true, force: true });

// Which revision the recorded baseline was measured against, so a changed score can be told apart
// from a changed suite.
writeFileSync(join(TARGET, "SOURCE.txt"), `${REPO}\n${SUBDIR}\n${commit}\n`);

const groups = readdirSync(join(TARGET, "TestCases"), { withFileTypes: true }).filter((entry) =>
  entry.isDirectory()
);
const total = groups.reduce(
  (count, group) =>
    count +
    readdirSync(join(TARGET, "TestCases", group.name)).filter((name) => name.endsWith(".ids"))
      .length,
  0
);

console.log(`  ${total} cases in ${groups.length} groups, at ${commit.slice(0, 10)}`);
console.log(`  run: corepack pnpm --filter @ifc-qa/ids-validator test:conformance`);
