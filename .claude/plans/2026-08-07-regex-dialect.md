# Session: XSD regular expressions are not JavaScript regular expressions

> ⚠️ **Demoted 2026-08-09** by the conformance baseline. The question this note exists to settle is
> settled, and the answer is small: XSD-vs-JavaScript regex dialect is worth **3 conformance cases**
> — `restriction/invalid-patterns_always_fail_on_any_number` and
> `restriction/invalid-patterns_only_work_on_strings_and_nothing_else` (both false passes: a pattern
> applied to a number must fail, not match), plus `restriction/pass-regex_patterns_work_in_OR_2_3`
> (a false fail). Still real; no longer a session of its own. See the baseline at the end of
> `2026-08-07-full-ids-scope.md`.

**Goal:** stop the builder exporting patterns that mean something different to an external checker
than they do in our own preview.

**Size:** small-to-medium, but it needs a product decision, and it is much easier to settle after
`2026-08-07-conformance-testing.md` gives a real XSD validator to test against.

---

## The problem

`xs:pattern` values are XML Schema regular expressions. We author, validate and evaluate them as
JavaScript regular expressions. The two dialects differ in ways that are silent, not loud.

Confirmed by running the current builder:

```
matches  "^W-\d+$"   →  <xs:pattern value="^W-\d+$" />
matches  "(?=W)W-1"  →  <xs:pattern value="(?=W)W-1" />
contains "US$"       →  <xs:pattern value=".*US\$.*" />
contains "a^b"       →  <xs:pattern value=".*a\^b.*" />
```

**1. `^` and `$` are not anchors in XSD.** The pattern is implicitly matched against the whole
value; `^` and `$` are ordinary literal characters. So `^W-\d+$` passes in our preview — we compile
it as `new RegExp("^(?:" + source + ")$")` in `compilePattern`, where the extra anchors are
harmless — and to an external checker it means "the literal text `^W-1$`". The exported file
contradicts the preview, which is the exact failure the MVP's export guards were built to prevent.

Corpus evidence: **0 of 90** real-world `xs:pattern` values use `^` or `$` at all.

**2. Lookahead and friends do not exist in XSD.** `(?=…)`, `\b`, backreferences. We export them
happily because `new RegExp()` accepts them.

**3. `\$` is probably not a legal XSD escape.** `escapeRegExp` in `rule-draft.ts` escapes
``[.*+?^${}()|[\]\\]``, so any literal `$` a user types in contains/startsWith/endsWith becomes
`\$`. `$` is not a metacharacter in XSD, and it does not appear to be in the `SingleCharEsc`
production either, which would make the pattern invalid rather than merely different.

**Not confirmed.** Three attempts to fetch the W3C production rule returned truncated pages, and
this sandbox has no XSD engine to test with. `\^` is fine — `^` *is* in the escapable set.
Settle this with the real validator from the conformance session rather than from memory.

## What has to change

Roughly, in increasing order of opinion required:

- **`escapeRegExp` should escape the XSD set, not the JavaScript set.** It is currently used for
  both purposes: composing the exported pattern *and* the pattern we evaluate in-browser. Those may
  need to diverge, which is a small but real design decision.
- **`patternError` in `completeness.ts` validates with `new RegExp()`** — a JavaScript check on a
  value destined for an XSD engine. It accepts constructs XSD rejects and would reject nothing that
  XSD accepts but JS does not (character-class subtraction `[a-z-[aeiou]]`, which is legal XSD).
- **The `matches` operator needs a decision.** Options:
  1. Validate against XSD rules and refuse `^`, `$`, lookahead with an inline explanation. Honest,
     and consistent with how the rest of the app refuses rather than half-understands.
  2. Silently strip leading `^` / trailing `$`. Convenient, guesses at intent, and guessing wrong
     changes the rule.
  3. Accept and warn. Weakest — the file still goes out wrong.

  Recommendation is (1), but it is the user's call: it makes the builder stricter than the box a
  user types into looks, and anyone who knows JS regex will type `^…$` by reflex.
- **Evaluation should match export.** `compilePattern` wrapping in `^(?:…)$` is right for the
  implicit-anchoring semantics, and should stay — but only once the source pattern is XSD-legal.

## Done when

- A pattern that cannot mean the same thing in XSD is refused at the point the user types it, with
  a message that says why, not after export.
- `escapeRegExp` produces XSD-legal escapes, with a test per metacharacter.
- The `restriction/` conformance cases (25 of them, see the conformance session) pass.
- A test asserts that for every operator, the exported `xs:pattern` and our in-browser evaluation
  agree on a shared set of sample values.

## Gotchas

- `escapeRegExp` and `compilePattern` are used by the *importer's* affix detection too
  (`readAffixPattern` in `import-ids.ts` checks `escapeRegExp(literal) === body` to decide whether
  a pattern is really a `contains`). Changing the escape set changes which imported patterns get
  the friendly operator — the corpus round-trip will catch it if it breaks, so run it.
- Do not "fix" the corpus round-trip by loosening it. If changing the escape set makes a real file
  re-export differently, that is the finding.
