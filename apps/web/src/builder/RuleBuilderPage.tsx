import { Fragment, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { ConditionDraft, RefusedSpecification, RuleDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import { useLoadedModels } from "../state/loadedModels.js";
import { introspectModel, type FieldSummary, type FieldsForResult, type TreeNode } from "./introspect.js";
import { ModelTree } from "./ModelTree.js";
import { RuleCard } from "./RuleCard.js";
import { RefusedSpecificationCard } from "./RefusedSpecificationCard.js";
import { IdsXmlPreview } from "./IdsXmlPreview.js";
import { defaultConditionFor } from "./ConditionRow.js";
import { nextDraftId } from "./draftIds.js";
import { importIdsText } from "./importIds.js";

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

export function RuleBuilderPage({ onGoToFiles }: { onGoToFiles?: () => void } = {}) {
  const { models } = useLoadedModels();
  const [modelKey, setModelKey] = useState<string | null>(null);

  const [selection, setSelection] = useState<string | null>(null);
  // null until the user opens or closes something themselves — until then the tree
  // shows whatever it takes to reveal the current selection, for whichever file is picked.
  const [expandedOverride, setExpanded] = useState<ReadonlySet<string> | null>(null);

  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [openRuleIds, setOpenRuleIds] = useState<ReadonlySet<string>>(new Set());
  const [failureRuleIds, setFailureRuleIds] = useState<ReadonlySet<string>>(new Set());

  // Everything an imported document carries that is not a rule. Held beside the rules rather than
  // inside them because it belongs to the file as a whole, and re-export has to hand all of it back.
  const [refused, setRefused] = useState<RefusedSpecification[]>([]);
  const [importedTitle, setImportedTitle] = useState<string | null>(null);
  const [extraInfo, setExtraInfo] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // Only a parsed model can be a worked example — the rest of the page reads its elements.
  const parsedModels = models.filter((entry) => entry.status === "succeeded");
  // Falling back to the first model rather than holding a dangling key: the chosen file can be
  // removed on the validate page, and the builder must not go blank while a usable model is loaded.
  const model = parsedModels.find((entry) => entry.key === modelKey) ?? parsedModels[0] ?? null;

  // Introspection walks every element; it must survive keystrokes elsewhere on the page.
  const introspection = useMemo(() => introspectModel(model?.elements ?? NO_ELEMENTS), [model]);
  // A selection made against a previous model may name a type this one doesn't have.
  const known = useMemo(
    () =>
      new Set([
        ...introspection.entityTypes.map((entry) => entry.name),
        ...introspection.groups.map((group) => group.name),
      ]),
    [introspection]
  );
  const selectionName =
    selection && known.has(selection) ? selection : (introspection.entityTypes[0]?.name ?? null);
  const selectionSource = useMemo(
    () => (selectionName ? introspection.fieldsFor([selectionName]) : null),
    [introspection, selectionName]
  );
  const selectedGroup = introspection.groups.find((group) => group.name === selectionName) ?? null;

  const defaultExpanded = useMemo(
    () => new Set(selectionName ? (pathToNode(introspection.tree, selectionName) ?? []) : []),
    [introspection, selectionName]
  );
  const expanded = expandedOverride ?? defaultExpanded;

  function handleModelChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = parsedModels.find((entry) => entry.key === event.target.value);
    if (!next) return;
    setModelKey(next.key);
    // Back to defaults: the new file's first type, and the ancestors that reveal it.
    setSelection(null);
    setExpanded(null);
  }

  function handleSelect(node: TreeNode) {
    setSelection(node.name);
    setExpanded((previous) => {
      const next = new Set(previous ?? defaultExpanded);
      for (const ancestor of pathToNode(introspection.tree, node.name) ?? []) next.add(ancestor);
      // Opening the node itself means a group shows its members the moment it is picked.
      if (node.kind === "group") next.add(node.name);
      return next;
    });
  }

  function handleToggle(name: string) {
    setExpanded((previous) => {
      const next = new Set(previous ?? defaultExpanded);
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
    const common = {
      id: nextDraftId("c"),
      name: plainName(field.name),
      value: null,
      cardinality: "required",
    } as const;
    const condition: ConditionDraft =
      field.kind === "attribute"
        ? { ...common, kind: "attribute", propertySet: null }
        : {
            ...common,
            kind: "property",
            propertySet: field.propertySet === null ? null : plainName(field.propertySet),
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
      // A ValueDraft is only ever replaced, never edited in place, so the copy can share it.
      conditions: rule.conditions.map((condition) => ({ ...condition, id: nextDraftId("c") })),
      // Re-keyed for the same reason the conditions are: the row is keyed on the id, and deleting
      // one from the copy must not take the original's row with it.
      ...(rule.applicabilityFacets
        ? {
            applicabilityFacets: rule.applicabilityFacets.map((facet) => ({
              ...facet,
              id: nextDraftId("c"),
            })),
          }
        : {}),
    };
    const index = rules.indexOf(rule);
    setRules([...rules.slice(0, index + 1), copy, ...rules.slice(index + 1)]);
    openRule(copy.id);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared straight away, so picking the same file twice still fires a change event.
    event.target.value = "";
    if (!file) return;

    const existing = rules.length + refused.length;
    if (
      existing > 0 &&
      !window.confirm(
        `Importing ${file.name} replaces the ${existing} specification${existing === 1 ? "" : "s"} already here. Continue?`
      )
    ) {
      return;
    }

    const outcome = importIdsText(file.name, await file.text());
    if (!outcome.ok) {
      setImportError(outcome.message);
      return;
    }

    setImportError(null);
    setRules(outcome.result.rules);
    setRefused(outcome.result.refused);
    setImportedTitle(outcome.result.title);
    setExtraInfo(outcome.result.extraInfo);
    setActiveRuleId(null);
    setOpenRuleIds(new Set());
    setFailureRuleIds(new Set());
  }

  /** Rules and refused specifications in the order the imported document put them. */
  function specificationCards(): ReactNode[] {
    const cards: ReactNode[] = [];

    for (let index = 0; index <= rules.length; index += 1) {
      refused.forEach((specification, position) => {
        if (Math.min(specification.passThrough.afterIndex, rules.length) !== index) return;
        cards.push(
          <RefusedSpecificationCard
            key={`refused-${position}`}
            specification={specification}
            onDelete={() => setRefused(refused.filter((entry) => entry !== specification))}
          />
        );
      });
      if (index === rules.length) break;

      const rule = rules[index];
      cards.push(
        <RuleCard
          key={rule.id}
          rule={rule}
          elements={model?.elements ?? NO_ELEMENTS}
          introspection={introspection}
          isActive={rule.id === activeRuleId}
          isOpen={openRuleIds.has(rule.id)}
          showFailures={failureRuleIds.has(rule.id)}
          onChange={(next) =>
            setRules((previous) => previous.map((entry) => (entry.id === rule.id ? next : entry)))
          }
          onDuplicate={() => handleDuplicateRule(rule)}
          onDelete={() => setRules(rules.filter((entry) => entry.id !== rule.id))}
          onActivate={() => setActiveRuleId(rule.id)}
          onToggleOpen={() => toggleIn(setOpenRuleIds, rule.id)}
          onToggleFailures={() => toggleIn(setFailureRuleIds, rule.id)}
        />
      );
    }
    return cards;
  }

  function toggleIn(setter: typeof setOpenRuleIds, id: string) {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="builder">
      <div className="loadbar">
        <div className="loadfile">
          <label htmlFor="builder-model">IFC file (one worked example)</label>
          <select
            id="builder-model"
            value={model?.key ?? ""}
            disabled={parsedModels.length === 0}
            onChange={handleModelChange}
          >
            {parsedModels.length === 0 ? (
              <option value="">No parsed files yet</option>
            ) : (
              parsedModels.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.fileName}
                </option>
              ))
            )}
          </select>
        </div>

        {model && (
          <span className="srcfile">
            <span className="dot" />
            {model.fileName}
            <span className="n num">
              · {model.elements.length} elements · {Math.round(model.parseMs ?? 0)} ms · {model.engine}
            </span>
          </span>
        )}

        {/* The rest of the page reads its counts and field lists from a model, so an imported rule
            has nothing to render against until one is parsed. */}
        <label
          className={`btn ghost importbtn${model ? "" : " is-disabled"}`}
          title={model ? "Open an existing .ids file" : "Parse an IFC file first"}
        >
          Import .ids
          <input
            type="file"
            accept=".ids,.xml,application/xml,text/xml"
            aria-label="Import an IDS file"
            disabled={!model}
            onChange={handleImport}
          />
        </label>
      </div>

      {importError && (
        <p className="import-error" role="alert">
          {importError}
        </p>
      )}

      {!model || !selectionSource || selectionName === null ? (
        <div className="empty-state">
          <h2>Build rules from a real file</h2>
          <p>
            Everything offered here — types, property sets, values — comes from one of your own IFC
            files, so the rules you write are rules it can actually be judged against. Load and parse
            your files first, then pick one above.
          </p>
          {onGoToFiles && (
            <button type="button" className="btn" onClick={onGoToFiles}>
              Load IFC files
            </button>
          )}
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
                {rules.length} {rules.length === 1 ? "rule" : "rules"}
                {refused.length > 0
                  ? ` · ${refused.length} kept but not editable`
                  : " · one specification each"}
              </span>
            </div>

            {rules.length === 0 && refused.length === 0 && (
              <p className="hint">
                No rules yet — click a field on the left, start an empty one below, or import an
                existing .ids file.
              </p>
            )}

            {specificationCards()}

            <button type="button" className="addrule" onClick={handleAddRule}>
              + New rule
            </button>

            <IdsXmlPreview
              rules={rules}
              title={importedTitle ?? model.fileName}
              refused={refused}
              extraInfo={extraInfo}
            />
          </main>
        </div>
      )}
    </div>
  );
}
