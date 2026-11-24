import { Zip, ZipDeflate, strToU8 } from "fflate";
import type { RunReportData } from "./types.js";
import { sortResults } from "./sort-results.js";

const SUMMARY_SHEET_NAME = "Summary";
const RESULTS_SHEET_NAME = "Results";

// An .xlsx worksheet holds at most 1,048,576 rows; one of them is the header.
export const EXCEL_MAX_DATA_ROWS_PER_SHEET = 1_048_576 - 1;
// A single cell holds at most 32,767 characters; anything longer makes Excel report the file corrupt.
const EXCEL_MAX_CELL_CHARS = 32_767;
// Rows serialised per chunk before control goes back to the event loop, so a long export neither
// holds the whole sheet's XML in memory nor freezes the tab for its full duration.
const ROWS_PER_CHUNK = 5_000;

export interface ExcelReportOptions {
  maxRowsPerSheet?: number;
}

interface Column<T> {
  header: string;
  width: number;
  value: (row: T) => string | null;
}

type ResultRow = RunReportData["results"][number];

const RESULT_COLUMNS: Column<ResultRow>[] = [
  { header: "File", width: 25, value: (r) => r.fileName },
  { header: "Element", width: 25, value: (r) => r.elementName },
  { header: "Element Type", width: 20, value: (r) => r.elementType },
  { header: "Global ID", width: 25, value: (r) => r.elementGlobalId },
  { header: "Tag", width: 15, value: (r) => r.elementTag },
  { header: "Rule", width: 20, value: (r) => r.ruleId },
  { header: "Severity", width: 12, value: (r) => r.severity },
  { header: "Message", width: 50, value: (r) => r.message },
];

const SUMMARY_COLUMNS: Column<[string, string]>[] = [
  { header: "Field", width: 20, value: ([field]) => field },
  { header: "Value", width: 50, value: ([, value]) => value },
];

const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8" ?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";

// Characters XML 1.0 cannot carry at all, even escaped; a stray one in an element name would make
// the whole file unreadable.
// eslint-disable-next-line no-control-regex
const XML_ILLEGAL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

// Most cell text needs no escaping; one cheap test skips the four replace passes for it.
const NEEDS_XML_ESCAPING = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿&<>"]/;

function escapeXml(value: string): string {
  if (!NEEDS_XML_ESCAPING.test(value)) return value;
  return value
    .replace(XML_ILLEGAL_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function cellXml(columnIndex: number, rowNumber: number, value: string | null): string {
  if (value === null || value === "") return "";
  const text = value.length > EXCEL_MAX_CELL_CHARS ? value.slice(0, EXCEL_MAX_CELL_CHARS) : value;
  const preserve = text !== text.trim() ? ' xml:space="preserve"' : "";
  return `<c r="${columnLetter(columnIndex)}${rowNumber}" t="inlineStr"><is><t${preserve}>${escapeXml(text)}</t></is></c>`;
}

function rowXml<T>(columns: Column<T>[], rowNumber: number, row: T): string {
  const cells = columns.map((column, index) => cellXml(index, rowNumber, column.value(row)));
  return `<row r="${rowNumber}">${cells.join("")}</row>`;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Inline strings, not a shared-strings table: the table would have to hold every distinct string
// in memory until the last row is written, which is the cost this writer exists to avoid.
async function* worksheetXml<T>(
  columns: Column<T>[],
  rows: readonly T[],
  start: number,
  end: number
): AsyncGenerator<string> {
  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
    .join("");
  const header = columns.map((c, i) => cellXml(i, 1, c.header)).join("");
  yield `${XML_PROLOG}<worksheet xmlns="${NS_MAIN}"><cols>${cols}</cols><sheetData><row r="1">${header}</row>`;
  for (let from = start; from < end; from += ROWS_PER_CHUNK) {
    const to = Math.min(from + ROWS_PER_CHUNK, end);
    let chunk = "";
    for (let i = from; i < to; i++) chunk += rowXml(columns, i - start + 2, rows[i] as T);
    yield chunk;
    await yieldToEventLoop();
  }
  yield "</sheetData></worksheet>";
}

function resultsSheetName(sheetIndex: number): string {
  return sheetIndex === 0 ? RESULTS_SHEET_NAME : `${RESULTS_SHEET_NAME} ${sheetIndex + 1}`;
}

function workbookParts(sheetNames: string[], created: Date) {
  const sheetFiles = sheetNames.map((_, i) => `xl/worksheets/sheet${i + 1}.xml`);
  const contentTypes =
    `${XML_PROLOG}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheetFiles
      .map(
        (file) =>
          `<Override PartName="/${file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `</Types>`;
  const rootRels =
    `${XML_PROLOG}<Relationships xmlns="${NS_PKG_REL}">` +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `</Relationships>`;
  const workbook =
    `${XML_PROLOG}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
    sheetNames
      .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("") +
    `</sheets></workbook>`;
  const workbookRels =
    `${XML_PROLOG}<Relationships xmlns="${NS_PKG_REL}">` +
    sheetFiles
      .map((file, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="${file.slice(3)}"/>`)
      .join("") +
    `<Relationship Id="rId${sheetFiles.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
    `</Relationships>`;
  const styles =
    `${XML_PROLOG}<styleSheet xmlns="${NS_MAIN}">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `</styleSheet>`;
  const core =
    `${XML_PROLOG}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:creator>IFC QA Tool</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${created.toISOString()}</dcterms:created>` +
    `</cp:coreProperties>`;
  return { sheetFiles, contentTypes, rootRels, workbook, workbookRels, styles, core };
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Writes the workbook straight into a streamed zip, one chunk of rows at a time, instead of
 * building an in-memory object model first — exceljs held every cell as a JS object, which ran a
 * tab out of memory at a few hundred thousand violations. Results beyond a worksheet's row limit
 * continue on "Results 2", "Results 3", ... with the header repeated on each.
 */
export async function generateExcelReport(
  data: RunReportData,
  options: ExcelReportOptions = {}
): Promise<Uint8Array> {
  const maxRowsPerSheet = options.maxRowsPerSheet ?? EXCEL_MAX_DATA_ROWS_PER_SHEET;
  const sorted = sortResults(data.results);
  const resultSheetCount = Math.max(1, Math.ceil(sorted.length / maxRowsPerSheet));
  const resultSheetNames = Array.from({ length: resultSheetCount }, (_, i) => resultsSheetName(i));
  const parts = workbookParts([SUMMARY_SHEET_NAME, ...resultSheetNames], new Date(data.generatedAt));

  const summaryRows: [string, string][] = [
    ["Run ID", data.runId],
    ["Rule Set", data.ruleSetName],
    ["Engine", data.engine],
    ["Generated At", data.generatedAt],
    ["Violations", String(sorted.length)],
    ["Result Sheets", String(resultSheetCount)],
  ];

  const chunks: Uint8Array[] = [];
  const finished = new Promise<void>((resolve, reject) => {
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        reject(error);
        return;
      }
      chunks.push(chunk);
      if (final) resolve();
    });

    const addText = (name: string, text: string) => {
      const file = new ZipDeflate(name, { level: 1 });
      zip.add(file);
      file.push(strToU8(text), true);
    };
    const addStream = async (name: string, source: AsyncGenerator<string>) => {
      const file = new ZipDeflate(name, { level: 1 });
      zip.add(file);
      for await (const text of source) file.push(strToU8(text));
      file.push(new Uint8Array(0), true);
    };

    (async () => {
      addText("[Content_Types].xml", parts.contentTypes);
      addText("_rels/.rels", parts.rootRels);
      addText("xl/workbook.xml", parts.workbook);
      addText("xl/_rels/workbook.xml.rels", parts.workbookRels);
      addText("xl/styles.xml", parts.styles);
      addText("docProps/core.xml", parts.core);
      await addStream(
        parts.sheetFiles[0] as string,
        worksheetXml(SUMMARY_COLUMNS, summaryRows, 0, summaryRows.length)
      );
      for (let sheet = 0; sheet < resultSheetCount; sheet++) {
        const start = sheet * maxRowsPerSheet;
        const end = Math.min(start + maxRowsPerSheet, sorted.length);
        await addStream(
          parts.sheetFiles[sheet + 1] as string,
          worksheetXml(RESULT_COLUMNS, sorted, start, end)
        );
      }
      zip.end();
    })().catch(reject);
  });

  await finished;
  return concatChunks(chunks);
}
