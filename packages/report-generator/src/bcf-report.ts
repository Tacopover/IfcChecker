import { XMLBuilder } from "fast-xml-parser";
import { strToU8, zipSync } from "fflate";
import type { Severity } from "@ifc-qa/shared-types";
import type { RunReportData } from "./types.js";

const REPORT_AUTHOR = "IFC QA Tool";
const BCF_VERSION = "2.1";

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  indentBy: "  ",
  suppressEmptyNode: true,
  // Default true renders an attribute valued exactly "true" as bare (HTML-style), which
  // Visibility/@DefaultVisibility's xs:boolean type rejects — it requires an explicit value.
  suppressBooleanAttributes: false,
});

const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n';

function xmlFile(tree: Record<string, unknown>): Uint8Array {
  return strToU8(XML_PROLOG + xmlBuilder.build(tree));
}

// A real, minimal PNG (1x1, light gray), not a placeholder string: after DEFAULT_CAMERA below still
// left BIMcollab's Navisworks plugin reporting "no viewpoint to zoom to", a missing Snapshot is the
// next suspect — markup.xsd's ViewPoint type allows either or both, but this app has no way yet to
// confirm which one that plugin actually treats as mandatory. atob/charCodeAt, not Buffer, so this
// decodes the same way in the browser bundle and under Node's test runner.
const DEFAULT_SNAPSHOT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4ceIEAAS0AlkWLoFAAAAAAElFTkSuQmCC";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const DEFAULT_SNAPSHOT_PNG = base64ToBytes(DEFAULT_SNAPSHOT_PNG_BASE64);

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1 };
const TOPIC_TYPE: Record<Severity, string> = { error: "Error", warning: "Warning" };

type Violation = RunReportData["results"][number];

interface TopicGroup {
  ruleId: string;
  severity: Severity;
  topicGuid: string;
  viewpointGuid: string;
  fileNames: string[];
  elementGlobalIds: string[];
  comments: Array<{ guid: string; text: string }>;
}

/**
 * One topic per (rule, severity), not one per violation: a rule failing on forty elements is one
 * issue for a reviewer to open, not forty. The per-element detail a topic-per-row export would give
 * isn't lost — it survives as one Comment per element, and every failing element's IfcGuid still
 * goes into the topic's own viewpoint so a receiving tool can select or colour them together.
 */
function groupByRule(results: readonly Violation[]): TopicGroup[] {
  const groups = new Map<string, TopicGroup>();
  for (const result of results) {
    const key = `${result.ruleId} ${result.severity}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        ruleId: result.ruleId,
        severity: result.severity,
        topicGuid: crypto.randomUUID(),
        viewpointGuid: crypto.randomUUID(),
        fileNames: [],
        elementGlobalIds: [],
        comments: [],
      };
      groups.set(key, group);
    }
    if (!group.fileNames.includes(result.fileName)) group.fileNames.push(result.fileName);
    if (!group.elementGlobalIds.includes(result.elementGlobalId)) {
      group.elementGlobalIds.push(result.elementGlobalId);
    }
    const label = result.elementName ?? result.elementGlobalId;
    group.comments.push({
      guid: crypto.randomUUID(),
      text: `${result.fileName} — ${result.elementType} "${label}" (${result.elementGlobalId}): ${result.message}`,
    });
  }

  const sorted = [...groups.values()].sort((a, b) => {
    if (a.severity !== b.severity) return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return a.ruleId.localeCompare(b.ruleId);
  });
  for (const group of sorted) {
    group.fileNames.sort((a, b) => a.localeCompare(b));
    group.elementGlobalIds.sort((a, b) => a.localeCompare(b));
  }
  return sorted;
}

function versionFile(): Uint8Array {
  return xmlFile({
    Version: { "@_VersionId": BCF_VERSION, DetailedVersion: BCF_VERSION },
  });
}

function markupFile(group: TopicGroup, generatedAt: string): Uint8Array {
  const elementCount = group.elementGlobalIds.length;
  const fileCount = group.fileNames.length;
  return xmlFile({
    Markup: {
      Header: {
        File: group.fileNames.map((fileName) => ({ Filename: fileName })),
      },
      Topic: {
        "@_Guid": group.topicGuid,
        "@_TopicType": TOPIC_TYPE[group.severity],
        "@_TopicStatus": "Open",
        Title: group.ruleId,
        CreationDate: generatedAt,
        CreationAuthor: REPORT_AUTHOR,
        Description: `${elementCount} element${elementCount === 1 ? "" : "s"} fail this rule across ${fileCount} file${fileCount === 1 ? "" : "s"}.`,
      },
      Comment: group.comments.map((comment) => ({
        "@_Guid": comment.guid,
        Date: generatedAt,
        Author: REPORT_AUTHOR,
        Comment: comment.text,
      })),
      Viewpoints: {
        "@_Guid": group.viewpointGuid,
        Viewpoint: "viewpoint.bcfv",
        Snapshot: "snapshot.png",
      },
    },
  });
}

// Selection lists every failing element so a receiving tool can highlight them together.
//
// The camera below is a fixed guess, not a real "frame this element" view: neither parse engine
// in this app computes element geometry, so there is no bounding box to aim at. visinfo.xsd makes
// OrthogonalCamera optional, and reads that way in at least one open-source BCF reader (camera and
// Components are handled independently) — but BIMcollab's Navisworks plugin was observed treating
// a camera-less viewpoint as no viewpoint at all, refusing to zoom to it (and, with it, refusing
// Selection). A fixed camera looking down at the shared model origin from above is enough to
// satisfy that check for this app's real models, which share one project origin near (0,0,0); nothing
// promises the failing elements actually fall inside this view, so "zoom to selection" after
// opening the viewpoint is still the reliable way to see them.
const DEFAULT_CAMERA = {
  CameraViewPoint: { X: 0, Y: 0, Z: 1000 },
  CameraDirection: { X: 0, Y: 0, Z: -1 },
  CameraUpVector: { X: 0, Y: 1, Z: 0 },
  ViewToWorldScale: 1000,
};

function viewpointFile(group: TopicGroup): Uint8Array {
  return xmlFile({
    VisualizationInfo: {
      "@_Guid": group.viewpointGuid,
      Components: {
        Selection: {
          Component: group.elementGlobalIds.map((id) => ({ "@_IfcGuid": id })),
        },
        // A literal boolean here would hit fast-xml-parser's suppressBooleanAttributes default and
        // serialize as a bare `DefaultVisibility` with no value, which visinfo.xsd rejects.
        Visibility: { "@_DefaultVisibility": "true" },
      },
      OrthogonalCamera: DEFAULT_CAMERA,
    },
  });
}

/** A `.bcf` (BCF-XML 2.1) zip archive: one topic per failing rule, as `generateBcfReport` groups them. */
export function generateBcfReport(data: RunReportData): Uint8Array {
  const groups = groupByRule(data.results);

  const entries: Record<string, Uint8Array> = {
    "bcf.version": versionFile(),
  };
  for (const group of groups) {
    entries[`${group.topicGuid}/markup.bcf`] = markupFile(group, data.generatedAt);
    entries[`${group.topicGuid}/viewpoint.bcfv`] = viewpointFile(group);
    entries[`${group.topicGuid}/snapshot.png`] = DEFAULT_SNAPSHOT_PNG;
  }

  return zipSync(entries);
}
