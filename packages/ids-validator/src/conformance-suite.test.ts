import { readFileSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { CaseResult } from "./conformance-cases.js";
import { collectCases, resolveSuiteDir, runCase, tally } from "./conformance-cases.js";

/**
 * The 318 official buildingSMART conformance cases, run against our validator.
 *
 * Not part of `pnpm test`: the suite is fetched, not vendored, so a gate stage would either be
 * absent on a fresh clone or — worse — skip itself and read green. Run it with
 * `pnpm --filter @ifc-qa/ids-validator test:conformance`.
 *
 * It is a scoreboard with a ratchet, not a pass/fail gate: the baseline records which cases we get
 * right today, and the only assertion is that no case we agree with today starts disagreeing.
 * Refresh the baseline with UPDATE_CONFORMANCE_BASELINE=1.
 */

const BASELINE_PATH = new URL("../conformance-baseline.json", import.meta.url);

interface Baseline {
  generated: string;
  totals: { cases: number; agreed: number; wrong: number; refused: number; errored: number };
  groups: Record<string, ReturnType<typeof tally>[string]>;
  /** Every case we currently get right. Shrinking this list is the regression we care about. */
  agreeing: string[];
  /** Every case we currently get wrong, with our answer, so the list can be worked through. */
  disagreeing: { case: string; expected: string; actual: string; detail: string }[];
}

const suiteDir = resolveSuiteDir();
let results: CaseResult[] = [];

describe("buildingSMART conformance suite", () => {
  beforeAll(async () => {
    // Loud, not skipped: a conformance run that quietly does nothing is worse than no run at all.
    if (suiteDir === null) {
      throw new Error(
        "The conformance suite is not on disk. Run `node scripts/fetch-conformance-cases.mjs`, " +
          "or point IDS_CONFORMANCE_DIR at an existing TestCases directory."
      );
    }
    results = [];
    for (const entry of collectCases(suiteDir)) results.push(await runCase(entry));
  }, 600_000);

  it("finds the whole suite", () => {
    expect(results.length).toBeGreaterThanOrEqual(318);
  });

  it("does not lose ground against the recorded baseline", () => {
    const groups = tally(results);
    const agreeing = results.filter((result) => result.agrees).map((result) => key(result));
    const disagreeing = results
      .filter((result) => !result.agrees)
      .map((result) => ({
        case: key(result),
        expected: result.expected,
        actual: result.actual,
        detail: result.detail,
      }));

    const current: Baseline = {
      generated: new Date().toISOString().slice(0, 10),
      totals: {
        cases: results.length,
        agreed: agreeing.length,
        wrong: disagreeing.filter((entry) => entry.actual === "pass" || entry.actual === "fail")
          .length,
        refused: disagreeing.filter((entry) => entry.actual === "refused").length,
        errored: disagreeing.filter((entry) => entry.actual === "error").length,
      },
      groups,
      agreeing,
      disagreeing,
    };

    if (process.env.UPDATE_CONFORMANCE_BASELINE === "1") {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }

    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
    const nowAgreeing = new Set(agreeing);
    const lost = baseline.agreeing.filter((name) => !nowAgreeing.has(name));

    expect(lost).toEqual([]);
  });
});

function key(result: CaseResult): string {
  return `${result.group}/${result.name}`;
}
