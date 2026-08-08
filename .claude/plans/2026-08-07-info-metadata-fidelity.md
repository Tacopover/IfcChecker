# Session: `<info>` is not preserved across an import/export round trip

**Goal:** a file the user only opened should come back out unchanged, including its header.

**Size:** small. Self-contained, and the fix is obvious once the decision below is made.

Found 2026-08-07 while auditing the import work; not in the original list of next steps.

---

## The finding, and how it hid

The corpus round-trip reports **7,784 / 7,784 files reproduced exactly** — but that check compares
only the `<specifications>` subtree. Widened to the whole `<ids>` element:

```
WHOLE-DOC {"files":7784,"ok":0,"drifted":7784}
CAUSES    [["date",7445],["specifications",328],["purpose",7],["milestone",4]]
```

**Zero of 7,784 survive.** The scoping of the test hid it — the same way no real file containing
two `<entity>` elements meant the round-trip could never catch the multi-entity export bug.

Two distinct faults:

- **`<date>` is overwritten with today's date on every export.** `buildIdsXml` defaults
  `date` to `new Date().toISOString().slice(0, 10)`, and the web export panel passes no date.
- **`idsXmlToDrafts` does not return the source date at all.** It is filtered out of `extraInfo`
  alongside `title`, but unlike `title` it is never surfaced — so the UI could not preserve it even
  if it wanted to. A file with no `<date>` also gets one invented.

## The decision to make

Is re-dating correct? There is a real argument either way, and it should be settled explicitly
rather than by whichever is easier to code:

- **Preserve** the source date. Consistent with the fidelity contract the whole import feature is
  built on: what we did not understand, and what the user did not touch, comes back unchanged.
- **Update** it, because the document genuinely changed. Defensible — but only if the user edited
  something, and we do not currently track whether they did.
- **Preserve on open, update on edit.** Most correct, most machinery. Note the scope note already
  wants an "edited since import" marker for a different reason (round-trip degrades from
  guaranteed to best-effort once a rule is touched), so this may come free with that.

Whatever is chosen, **inventing a date for a file that had none is wrong** in all three readings.

## Done when

- The whole-document round trip passes on the corpus, not just the `<specifications>` subtree —
  and the committed round-trip test is widened to match, so the scope of the claim matches the
  scope of the check.
- `idsXmlToDrafts` returns the source date, and the export panel passes it through.
- A file with no `<date>` still has none after a round trip.
- The decision above is written down in `goals.md` or the scope note, not just implemented.

## Gotchas

- `<info>` children have a schema-fixed order (title, copyright, version, description, author,
  date, purpose, milestone). `buildIdsXml` sorts them via `INFO_ORDER` — a fix made on 2026-08-07
  after `idsSchemaViolations` caught the exporter appending carried-through children after
  `<date>`. Do not reintroduce plain appending.
- `<info>` also has `copyright`, `version`, `description`, `author`, `purpose`, `milestone`. Those
  ride through `extraInfo` verbatim today and appear to be fine — the widened test will confirm it
  rather than assuming.
- `author` has a schema pattern (`[^@]+@[^\.]+\..+`) and `date` is an `xs:date`. If either ever
  becomes user-editable, they need validation; today they are only ever passed through.
