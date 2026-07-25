import { useMemo, useState, type ReactNode } from "react";
import { buildIdsXml, type RuleDraft } from "@ifc-qa/ids-validator";

// Tag names, then attribute="value" pairs — enough to read the structure at a glance without
// pulling in a highlighter.
const TOKEN = /(<\/?)([\w:.]+)|([\w:]+)=("[^"]*")/g;

export function highlight(xml: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of xml.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(xml.slice(cursor, start));
    if (match[2]) {
      nodes.push(match[1]);
      nodes.push(
        <span className="t" key={start}>
          {match[2]}
        </span>
      );
    } else {
      nodes.push(
        <span className="a" key={start}>
          {match[3]}
        </span>
      );
      nodes.push("=");
      nodes.push(
        <span className="v" key={`${start}v`}>
          {match[4]}
        </span>
      );
    }
    cursor = start + match[0].length;
  }
  if (cursor < xml.length) nodes.push(xml.slice(cursor));
  return nodes;
}

function downloadName(title: string): string {
  const base = title.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-") || "rules";
  return `${base}.ids`;
}

export interface IdsXmlPreviewProps {
  rules: RuleDraft[];
  title: string;
}

export function IdsXmlPreview({ rules, title }: IdsXmlPreviewProps) {
  const [visible, setVisible] = useState(true);
  const xml = useMemo(() => buildIdsXml(rules, { title }), [rules, title]);

  function handleDownload() {
    const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadName(title);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="export" aria-label="Export">
      <div className="export-head">
        <span className="micro">Export</span>
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => setVisible((shown) => !shown)}>
          {visible ? "Hide IDS XML" : "Show IDS XML"}
        </button>
        <button type="button" className="btn" onClick={handleDownload}>
          Download .ids
        </button>
      </div>
      {visible && (
        <pre className="xml" aria-label="IDS XML preview">
          {highlight(xml)}
        </pre>
      )}
    </section>
  );
}
