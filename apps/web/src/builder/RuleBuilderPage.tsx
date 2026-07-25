import { Fragment, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { EngineId, NormalizedElement } from "@ifc-qa/shared-types";
import type { ConditionDraft, RuleDraft } from "@ifc-qa/ids-validator";
import { parseIfcFileOnly } from "../local/parseAndValidate.js";
import { introspectModel, type FieldSummary, type FieldsForResult, type TreeNode } from "./introspect.js";
import { ModelTree } from "./ModelTree.js";
import { RuleCard } from "./RuleCard.js";
import { IdsXmlPreview } from "./IdsXmlPreview.js";
import { defaultConditionFor } from "./ConditionRow.js";
import { nextDraftId } from "./draftIds.js";

interface LoadedModel {
  fileName: string;
  elements: NormalizedElement[];
  parseMs: number;
}

const SAMPLE_VALUES = 3;
const SAMPLE_LENGTH = 18;
const LOW_COVERAGE = 0.9;

// A stable empty array: introspection is memoised on identity, and a fresh [] would redo it on
// every render before a file is loaded.
const NO_ELEMENTS: NormalizedElement[] = [];

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function truncate(value: string): string {
  return value.length > SAMPLE_LENGTH ? `${value.slice(0, SAMPLE_LENGTH - 1)}…` : value;
}

/** Ancestor names between the roots and `name`, so selecting a node can reveal where it sits. */
export function pathToNode(nodes: TreeNode[], name: string): string[] | null {
  for (const node of nodes) {
    if (node.name === name) return [];
    const inner = pathToNode(node.children, name);
    if (inner) return [node.name, ...inner];
  }
  return null;
}

interface SchemaCardsProps {
  source: FieldsForResult;
  selectionName: string;
  groupTypeCount: number | null;
  onAddField: (field: { kind: ConditionDraft["kind"]; propertySet: string | null; name: string }) => void;
}

function FieldRows({
  fields,
  kind,
  onAddField,
}: {
  fields: FieldSummary[];
  kind: ConditionDraft["kind"];
  onAddField: SchemaCardsProps["onAddField"];
}) {
  return (
    <>
      {fields.map((field) => (
        <Fragment key={field.name}>
          <button
            type="button"
            className="field"
            title={`Add a condition on ${field.name}`}
            onClick={() => onAddField({ kind, propertySet: field.propertySet, name: field.name })}
          >
            <span className="field-name">{field.name}</span>
            <span className="cov num" data-low={field.coverage < LOW_COVERAGE ? 1 : 0}>
              {percent(field.coverage)}
            </span>
            <span className="plus" aria-hidden="true">
              +
            </span>
          </button>
          <div className="samples">
            {field.values.slice(0, SAMPLE_VALUES).map((entry) => (
              <span className="mini" key={entry.value}>
                {truncate(entry.value)}
              </span>
            ))}
            {field.values.length > SAMPLE_VALUES && (
              <span className="more">+{field.values.length - SAMPLE_VALUES}</span>
            )}
          </div>
        </Fragment>
      ))}
      {fields.length === 0 && <p className="hint">Nothing here for this selection.</p>}
    </>
  );
}

function SchemaCards({ source, selectionName, groupTypeCount, onAddField }: SchemaCardsProps) {
  return (
    <div className="schema">
      <section className="card">
        <header>
          <span className="micro">Attributes</span>
          <span className="tally">
            {selectionName} · {source.total}
            {groupTypeCount !== null ? ` across ${groupTypeCount} types` : ""}
          </span>
        </header>
        <div className="body">
          <FieldRows fields={source.attributes} kind="attribute" onAddField={onAddField} />
        </div>
      </section>
      {source.propertySets.map((set) => (
        <section className="card pset" key={set.name}>
          <header>
            <span className="micro">Pset</span>
            <span className="psname">{set.name}</span>
          </header>
          <div className="body">
            <FieldRows fields={set.fields} kind="property" onAddField={onAddField} />
          </div>
        </section>
      ))}
    </div>
  );
}

export function RuleBuilderPage() {
  const [engine, setEngine] = useState<EngineId | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [selection, setSelection] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [openRuleIds, setOpenRuleIds] = useState<ReadonlySet<string>>(new Set());
  const [failureRuleIds, setFailureRuleIds] = useState<ReadonlySet<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Introspection walks every element; it must survive keystrokes elsewhere on the page.
  const introspection = useMemo(() => introspectModel(model?.elements ?? NO_ELEMENTS), [model]);
  const selectionName = selection ?? introspection.entityTypes[0]?.name ?? null;
  const selectionSource = useMemo(
    () => (selectionName ? introspection.fieldsFor([selectionName]) : null),
    [introspection, selectionName]
  );
  const selectedGroup = introspection.groups.find((group) => group.name === selectionName) ?? null;

  async function handleLoad() {
    if (!file || engine === "" || isParsing) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const parsed = await parseIfcFileOnly(file, engine);
      const loaded = { fileName: file.name, elements: parsed.elements, parseMs: parsed.parseMs };
      const fresh = introspectModel(loaded.elements);
      const first = fresh.entityTypes[0]?.name ?? null;
      setModel(loaded);
      setSelection(first);
      setExpanded(new Set(first ? (pathToNode(fresh.tree, first) ?? []) : []));
    } catch (error) {
      // The previously loaded model (and any rules built against it) stays put — a failed parse
      // must cost the user nothing but the attempt.
      setParseError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsParsing(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setParseError(null);
  }

  function handleSelect(node: TreeNode) {
    setSelection(node.name);
    setExpanded((previous) => {
      const next = new Set(previous);
      for (const ancestor of pathToNode(introspection.tree, node.name) ?? []) next.add(ancestor);
      // Opening the node itself means a group shows its members the moment it is picked.
      if (node.kind === "group") next.add(node.name);
      return next;
    });
  }

  function handleToggle(name: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function openRule(id: string) {
    setActiveRuleId(id);
    setOpenRuleIds((previous) => new Set(previous).add(id));
  }

  function handleAddField(field: {
    kind: ConditionDraft["kind"];
    propertySet: string | null;
    name: string;
  }) {
    if (!selectionName) return;
    const condition: ConditionDraft = {
      id: nextDraftId("c"),
      kind: field.kind,
      propertySet: field.propertySet,
      name: field.name,
      operator: "exists",
      values: [],
      text: "",
    };
    const target = rules.find((rule) => rule.id === activeRuleId) ?? rules[0] ?? null;

    if (!target) {
      const rule: RuleDraft = {
        id: nextDraftId("r"),
        name: `${selectionName} rule`,
        entityTypes: [selectionName],
        conditions: [condition],
      };
      setRules([rule]);
      openRule(rule.id);
      return;
    }

    setRules(
      rules.map((rule) =>
        rule.id === target.id
          ? {
              ...rule,
              entityTypes: rule.entityTypes.includes(selectionName)
                ? rule.entityTypes
                : [...rule.entityTypes, selectionName],
              conditions: [...rule.conditions, condition],
            }
          : rule
      )
    );
    openRule(target.id);
  }

  function handleAddRule() {
    const entityTypes = selectionName ? [selectionName] : [];
    const rule: RuleDraft = {
      id: nextDraftId("r"),
      name: "New rule",
      entityTypes,
      conditions: selectionSource ? [defaultConditionFor(selectionSource)] : [],
    };
    setRules([...rules, rule]);
    openRule(rule.id);
  }

  function handleDuplicateRule(rule: RuleDraft) {
    const copy: RuleDraft = {
      ...rule,
      id: nextDraftId("r"),
      name: `${rule.name} (copy)`,
      entityTypes: [...rule.entityTypes],
      conditions: rule.conditions.map((condition) => ({
        ...condition,
        id: nextDraftId("c"),
        values: [...condition.values],
      })),
    };
    const index = rules.indexOf(rule);
    setRules([...rules.slice(0, index + 1), copy, ...rules.slice(index + 1)]);
    openRule(copy.id);
  }

  function toggleIn(setter: typeof setOpenRuleIds, id: string) {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canLoad = file !== null && engine !== "" && !isParsing;

  return (
    <div className="builder">
      <div className="loadbar">
        <fieldset>
          <legend>Engine</legend>
          <label>
            <input
              type="radio"
              name="builder-engine"
              value="web-ifc"
              checked={engine === "web-ifc"}
              onChange={() => setEngine("web-ifc")}
            />
            web-ifc
          </label>
          <label>
            <input
              type="radio"
              name="builder-engine"
              value="ifc-lite"
              checked={engine === "ifc-lite"}
              onChange={() => setEngine("ifc-lite")}
            />
            ifc-lite
          </label>
        </fieldset>

        <div className="loadfile">
          <label htmlFor="builder-ifc-file">IFC file (one worked example)</label>
          <input
            ref={fileInputRef}
            id="builder-ifc-file"
            type="file"
            accept=".ifc"
            onChange={handleFileChange}
          />
        </div>

        <button type="button" className="btn" disabled={!canLoad} onClick={handleLoad}>
          {isParsing ? "Parsing…" : "Load model"}
        </button>

        {model && (
          <span className="srcfile">
            <span className="dot" />
            {model.fileName}
            <span className="n num">
              · {model.elements.length} elements · {Math.round(model.parseMs)} ms
            </span>
          </span>
        )}
      </div>

      {isParsing && <p role="status">Parsing {file?.name}… this can take a while on a large file.</p>}
      {parseError && <p role="alert">Could not read that file: {parseError}</p>}

      {!model || !selectionSource || selectionName === null ? (
        <div className="empty-state">
          <h2>Build rules from a real file</h2>
          <p>
            Pick an engine and one IFC file, then load it. Everything offered here — types, property
            sets, values — comes from that file, so the rules you write are rules it can actually be
            judged against.
          </p>
        </div>
      ) : (
        <div className="wrap">
          <aside className="explorer">
            <div className="explorer-intro">
              <p>
                Everything here comes from this file. Pick a type or an inherited group, then click a
                field to add it as a condition.
              </p>
            </div>

            <section className="card">
              <header>
                <span className="micro">In your model</span>
                <span className="tally">
                  {introspection.entityTypes.length} types · {introspection.groups.length} groups
                </span>
              </header>
              <div className="body">
                <ModelTree
                  nodes={introspection.tree}
                  selectedName={selectionName}
                  expanded={expanded}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                />
              </div>
            </section>

            <SchemaCards
              source={selectionSource}
              selectionName={selectionName}
              groupTypeCount={selectedGroup ? selectedGroup.types.length : null}
              onAddField={handleAddField}
            />
          </aside>

          <main className="stack">
            <div className="stack-head">
              <h2>Rules</h2>
              <span className="micro">
                {rules.length} {rules.length === 1 ? "rule" : "rules"} · one specification each
              </span>
            </div>

            {rules.length === 0 && (
              <p className="hint">
                No rules yet — click a field on the left, or start an empty one below.
              </p>
            )}

            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                elements={model.elements}
                introspection={introspection}
                isActive={rule.id === activeRuleId}
                isOpen={openRuleIds.has(rule.id)}
                showFailures={failureRuleIds.has(rule.id)}
                onChange={(next) =>
                  setRules((previous) =>
                    previous.map((entry) => (entry.id === rule.id ? next : entry))
                  )
                }
                onDuplicate={() => handleDuplicateRule(rule)}
                onDelete={() => setRules(rules.filter((entry) => entry.id !== rule.id))}
                onActivate={() => setActiveRuleId(rule.id)}
                onToggleOpen={() => toggleIn(setOpenRuleIds, rule.id)}
                onToggleFailures={() => toggleIn(setFailureRuleIds, rule.id)}
              />
            ))}

            <button type="button" className="addrule" onClick={handleAddRule}>
              + New rule
            </button>

            <IdsXmlPreview rules={rules} title={model.fileName} />
          </main>
        </div>
      )}
    </div>
  );
}
