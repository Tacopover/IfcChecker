// `<info>` fidelity over the corpus: import every real .ids file, export it again, and compare the
// eight children `ids.xsd` names, text for text.
//
// The round-trip harness beside this one cannot answer the question. It pins `date` so its output
// is stable, and it compares what `parseIdsXml` sees — which reads no `<info>` at all. So a change
// to how the metadata is carried can pass that harness and still lose the author's name.
//
//   npx tsx .claude/plans/corpus-info-fidelity.mjs [corpus-root]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { idsXmlToDrafts } from "/root/IfcChecker/packages/ids-validator/src/import-ids.ts";
import { buildIdsXml } from "/root/IfcChecker/packages/ids-validator/src/build-ids.ts";

const ROOT = process.argv[2] ?? "/tmp/ids-corpus";
const TAGS = [
  "title",
  "copyright",
  "version",
  "description",
  "author",
  "date",
  "purpose",
  "milestone",
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walk(path, out);
    else if (entry.toLowerCase().endsWith(".ids")) out.push(path);
  }
  return out;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** The text each named child holds, read the same way from the source and from the export. */
function infoTextOf(xml) {
  const block = /<(?:\w+:)?info\b[^>]*>([\s\S]*?)<\/(?:\w+:)?info>/.exec(xml);
  if (!block) return null;
  const found = {};
  for (const tag of TAGS) {
    // Self-closing counts: one corpus file writes `<ids:title />`, and an empty element and a
    // self-closing one are the same empty string to a reader.
    if (new RegExp(`<(?:\\w+:)?${tag}\\s*/>`).test(block[1])) {
      found[tag] = "";
      continue;
    }
    const match = new RegExp(`<(?:\\w+:)?${tag}\\s*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(block[1]);
    found[tag] =
      match === null
        ? null
        : match[1]
            .trim()
            // XML 1.0 §2.11 requires a reader to translate CRLF to LF before the application sees
            // it, so a source written with CRLF and an export written with LF are the same text.
            // 7,445 corpus descriptions differ only this way.
            .replace(/\r\n/g, "\n")
            .replace(/&(amp|lt|gt|quot|apos);/g, (_whole, name) => ENTITIES[name]);
  }
  return found;
}

const files = walk(ROOT);
let compared = 0;
let identical = 0;
let dated = 0;
const lost = new Map();

for (const file of files) {
  const source = readFileSync(file, "utf8");
  let imported;
  let out;
  try {
    imported = idsXmlToDrafts(source);
    out = buildIdsXml(imported.rules, {
      ...imported.info,
      title: imported.title ?? undefined,
      date: imported.info.date ?? undefined,
      extraInfo: imported.extraInfo,
      untouched: imported.refused.map((entry) => entry.passThrough),
    });
  } catch {
    continue;
  }

  const before = infoTextOf(source);
  const after = infoTextOf(out);
  if (before === null) continue;
  compared++;

  // `buildIdsXml` stamps today's date on a document that states none, which is right for a file
  // being authored and is not a loss of anything the source carried. Counted, not called a failure.
  if (before.date === null && (after?.date ?? null) !== null) dated++;

  const differing = TAGS.filter(
    (tag) =>
      (before[tag] ?? null) !== (after?.[tag] ?? null) &&
      !(tag === "date" && before.date === null)
  );
  if (differing.length === 0) identical++;
  else for (const tag of differing) lost.set(tag, (lost.get(tag) ?? 0) + 1);
}

console.log(`corpus root                      ${ROOT}`);
console.log(`files with an <info>             ${compared}`);
console.log(`reproduced child for child       ${identical} / ${compared}`);
console.log(`dated, having stated none        ${dated}`);
if (lost.size > 0) {
  console.log("\nchildren that differ:");
  for (const [tag, count] of [...lost.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${tag}`);
  }
}
