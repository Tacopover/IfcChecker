import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIfcLiteBuffer } from "@ifc-qa/parser-adapters";
import { validateBySpecification } from "./validate-elements.js";

/**
 * Tier B of the conformance work: buildingSMART's official test cases, each a paired `.ids` and
 * `.ifc` whose expected verdict is in the file name. Nothing here grades our own homework — the
 * answer key was written by the people who wrote the specification.
 *
 * Node only, and driven by `conformance-suite.test.ts`, which is not part of the default test run
 * because the suite is not vendored. See `scripts/fetch-conformance-cases.mjs`.
 */

/** Where the suite lives once fetched, relative to the repo root. */
export const DEFAULT_SUITE_DIR = ".conformance/TestCases";

export type Verdict = "pass" | "fail" | "refused" | "error";

/**
 * The suite names cases `pass-`, `fail-` or `invalid-`. `invalid-` is a specification that asks
 * something nonsensical — a derived attribute, an attribute the entity does not have, an integer
 * written as a float — and the documented expectation is that it always fails. It is kept as its
 * own prefix because refusing such a document outright is a defensible second answer, and folding
 * it into `fail-` would hide which of the two we did.
 */
export type CasePrefix = "pass" | "fail" | "invalid";

export interface ConformanceCase {
  /** The facet folder the case sits in — `property`, `tolerance`, and so on. */
  group: string;
  name: string;
  prefix: CasePrefix;
  expected: "pass" | "fail";
  idsPath: string;
  ifcPath: string;
}

export interface CaseResult extends ConformanceCase {
  actual: Verdict;
  agrees: boolean;
  /** Why we said what we said, for the cases worth reading one by one. */
  detail: string;
}

export function resolveSuiteDir(): string | null {
  const fromEnvironment = process.env.IDS_CONFORMANCE_DIR;
  if (fromEnvironment) return existsSync(fromEnvironment) ? fromEnvironment : null;

  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const fallback = join(repoRoot, DEFAULT_SUITE_DIR);
  return existsSync(fallback) ? fallback : null;
}

export function collectCases(suiteDir: string): ConformanceCase[] {
  const cases: ConformanceCase[] = [];

  for (const group of readdirSync(suiteDir, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupDir = join(suiteDir, group.name);

    for (const entry of readdirSync(groupDir)) {
      if (!entry.endsWith(".ids")) continue;
      const name = basename(entry, ".ids");
      const ifcPath = join(groupDir, `${name}.ifc`);
      // A case without its model cannot be graded; dropping it silently would inflate the score.
      if (!existsSync(ifcPath)) continue;

      const prefix = (["pass", "fail", "invalid"] as const).find((candidate) =>
        name.startsWith(`${candidate}-`)
      );
      if (prefix === undefined) continue;

      cases.push({
        group: group.name,
        name,
        prefix,
        expected: prefix === "pass" ? "pass" : "fail",
        idsPath: join(groupDir, entry),
        ifcPath,
      });
    }
  }

  return cases.sort((left, right) =>
    `${left.group}/${left.name}`.localeCompare(`${right.group}/${right.name}`)
  );
}

/**
 * `refused` is deliberately its own verdict rather than a wrong answer. A specification we decline
 * to evaluate — because we cannot represent its applicability — is honest about not knowing;
 * folding it into `fail` would score a known gap as a wrong interpretation and hide both.
 */
export async function runCase(entry: ConformanceCase): Promise<CaseResult> {
  let actual: Verdict;
  let detail: string;

  try {
    const { elements } = await parseIfcLiteBuffer(readFileSync(entry.ifcPath));
    const outcomes = validateBySpecification(elements, readFileSync(entry.idsPath, "utf8"));

    if (outcomes.length === 0) {
      actual = "refused";
      detail = "no specification could be parsed out of the document";
    } else if (outcomes.some((outcome) => !outcome.checked)) {
      const refused = outcomes.filter((outcome) => !outcome.checked);
      actual = "refused";
      detail = refused
        .flatMap((outcome) => outcome.unsupported.map((item) => item.construct))
        .join(", ");
    } else {
      const failed = outcomes.filter((outcome) => outcome.failedCount > 0);
      actual = failed.length > 0 ? "fail" : "pass";
      detail = outcomes
        .map(
          (outcome) =>
            `${outcome.applicableCount} applicable, ${outcome.passedCount} passed, ${outcome.failedCount} failed`
        )
        .join("; ");
    }
  } catch (error) {
    actual = "error";
    detail = error instanceof Error ? error.message : String(error);
  }

  return { ...entry, actual, agrees: actual === entry.expected, detail };
}

export interface GroupTally {
  total: number;
  agreed: number;
  wrong: number;
  refused: number;
  errored: number;
}

export function tally(results: CaseResult[]): Record<string, GroupTally> {
  const tallies: Record<string, GroupTally> = {};

  for (const result of results) {
    const entry = (tallies[result.group] ??= {
      total: 0,
      agreed: 0,
      wrong: 0,
      refused: 0,
      errored: 0,
    });
    entry.total += 1;
    if (result.agrees) entry.agreed += 1;
    else if (result.actual === "refused") entry.refused += 1;
    else if (result.actual === "error") entry.errored += 1;
    else entry.wrong += 1;
  }

  return tallies;
}
