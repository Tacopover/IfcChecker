import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type {
  ConditionDraft,
  IdsDocumentInfo,
  RefusedSpecification,
  RuleDraft,
} from "@ifc-qa/ids-validator";
import {
  expandedTypeNamesFor,
  nextOrGroupId,
  OR_GROUP_IDENTIFIER_PREFIX,
  orGroupIdOf,
  orGroupSiblingsOf,
  plainName,
} from "@ifc-qa/ids-validator";
import { SPATIAL_STRUCTURE_TYPES } from "@ifc-qa/parser-adapters/browser";
import { useLoadedModels } from "../state/loadedModels.js";
import { introspectModel, type FieldSummary, type FieldsForResult, type TreeNode } from "./introspect.js";
import { ModelTree } from "./ModelTree.js";
import { RuleCard } from "./RuleCard.js";
import { RuleWizard } from "./RuleWizard.js";
import { RefusedSpecificationCard } from "./RefusedSpecificationCard.js";
import { IdsXmlPreview } from "./IdsXmlPreview.js";
import { DocumentInfoPanel } from "./DocumentInfoPanel.js";
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
  query: string;
  onAddField: (field: { kind: ConditionDraft["kind"]; propertySet: string | null; name: string }) => void;
}

/** Alphabetical, and narrowed to whatever the search box asks for — the panel is for scanning by
 * name, unlike the value pickers elsewhere, which stay ranked by how common a value is. */
function sortedAndFiltered(fields: FieldSummary[], query: string): FieldSummary[] {
  const needle = query.trim().toLowerCase();
  return fields
    .filter((field) => needle === "" || field.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function FieldRows({
  fields,
  kind,
  query,
  onAddField,
}: {
  fields: FieldSummary[];
  kind: ConditionDraft["kind"];
  query: string;
  onAddField: SchemaCardsProps["onAddField"];
}) {
  const shown = sortedAndFiltered(fields, query);
  return (
    <>
      {shown.map((field) => (
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
      {shown.length === 0 && (
        <p className="hint">
          {fields.length === 0 ? "Nothing here for this selection." : `No properties match "${query.trim()}".`}
        </p>
      )}
    </>
  );
}

function SchemaCards({ source, selectionName, groupTypeCount, query, onAddField }: SchemaCardsProps) {
  const needle = query.trim().toLowerCase();
  const propertySets = [...source.propertySets]
    .sort((a, b) => a.name.localeCompare(b.name))
    // A set with no field matching the search has nothing to show; skip its (otherwise empty) card.
    .filter((set) => needle === "" || set.fields.some((field) => field.name.toLowerCase().includes(needle)));

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
          <FieldRows fields={source.attributes} kind="attribute" query={query} onAddField={onAddField} />
        </div>
      </section>
      {propertySets.map((set) => (
        <section className="card pset" key={set.name}>
          <header>
            <span className="micro">Pset</span>
            <span className="psname">{set.name}</span>
          </header>
          <div className="body">
            <FieldRows fields={set.fields} kind="property" query={query} onAddField={onAddField} />
          </div>
        </section>
      ))}
    </div>
  );
}

export function RuleBuilderPage({ onGoToFiles }: { onGoToFiles?: () => void } = {}) {
  const { models } = useLoadedModels();
  const [modelKey, setModelKey] = useState<string | null>(null);

  // The loadbar is sticky, and the explorer rail below it is too (see .explorer in styles.css) —
  // its own sticky offset and height have to leave room for whatever the loadbar actually renders
  // at, which varies as its content wraps, so that space is measured rather than guessed.
  const builderRef = useRef<HTMLDivElement | null>(null);
  const loadbarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const loadbar = loadbarRef.current;
    const builder = builderRef.current;
    // Absent in the test environment and in any browser old enough to lack it; the CSS fallback
    // (see --loadbar-h in styles.css) covers that case, so there is nothing more to do here.
    if (!loadbar || !builder || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      builder.style.setProperty("--loadbar-h", `${entry.contentRect.height}px`);
    });
    observer.observe(loadbar);
    return () => observer.disconnect();
  }, []);

  const [selection, setSelection] = useState<string | null>(null);
  // null until the user opens or closes something themselves — until then the tree
  // shows whatever it takes to reveal the current selection, for whichever file is picked.
  const [expandedOverride, setExpanded] = useState<ReadonlySet<string> | null>(null);
  // Narrows the properties panel below the model tree; kept across a type switch (searching
  // "fire" while browsing several types is a normal way to use it) and cleared on a new file.
  const [propertySearch, setPropertySearch] = useState("");

  const [rules, setRules] = useState<RuleDraft[]>([]);
  // Which rule a field click in the left rail adds a condition to — a rule id, or "new" to start
  // one. Doubles as the explorer's "Add conditions to" selection and the active rule's highlight,
  // so the two can never disagree about what a click will do.
  const [target, setTarget] = useState<string>("new");
  const [openRuleIds, setOpenRuleIds] = useState<ReadonlySet<string>>(new Set());
  const [failureRuleIds, setFailureRuleIds] = useState<ReadonlySet<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  // Cosmetic only: which rule (if any) the wizard just produced, so its card can show a transient
  // "Just added" badge. Cleared by whichever of the other rule-adding actions happens next.
  const [justAddedRuleId, setJustAddedRuleId] = useState<string | null>(null);

  // Everything an imported document carries that is not a rule. Held beside the rules rather than
  // inside them because it belongs to the file as a whole, and re-export has to hand all of it back.
  const [refused, setRefused] = useState<RefusedSpecification[]>([]);
  const [documentInfo, setDocumentInfo] = useState<IdsDocumentInfo>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [extraInfo, setExtraInfo] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // Only a parsed model can be a worked example — the rest of the page reads its elements.
  const parsedModels = models.filter((entry) => entry.status === "succeeded");
  // Falling back to the first model rather than holding a dangling key: the chosen file can be
  // removed on the validate page, and the builder must not go blank while a usable model is loaded.
  const model = parsedModels.find((entry) => entry.key === modelKey) ?? parsedModels[0] ?? null;

  // The reviewer element list plus the spatial backbone (Project/Site/Building/Storey): excluded
  // from `elements` because a reviewer doesn't check them, but a rule can still be written against
  // one, and checking already reads them via `idsScope` — only picking one in the builder was missing.
  const builderElements = useMemo(
    () => [
      ...(model?.elements ?? NO_ELEMENTS),
      ...(model?.idsScope.filter((entity) => SPATIAL_STRUCTURE_TYPES.has(entity.ifcType.toUpperCase())) ??
        NO_ELEMENTS),
    ],
    [model]
  );

  // Introspection walks every element; it must survive keystrokes elsewhere on the page.
  const introspection = useMemo(() => introspectModel(builderElements), [builderElements]);
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
    setPropertySearch("");
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
    setTarget(id);
    setOpenRuleIds((previous) => new Set(previous).add(id));
  }

  function handleAddField(field: {
    kind: ConditionDraft["kind"];
    propertySet: string | null;
    name: string;
  }) {
    if (!selectionName) return;
    setJustAddedRuleId(null);
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
    // A stale id (its rule got deleted) falls back to the first rule, same as an unset target —
    // "new" is the only way to reach rule creation once at least one rule exists.
    const targetRule = target === "new" ? null : (rules.find((rule) => rule.id === target) ?? rules[0] ?? null);

    if (!targetRule) {
      const rule: RuleDraft = {
        id: nextDraftId("r"),
        name: `${selectionName} rule`,
        entityTypes: expandedTypeNamesFor(selectionName),
        conditions: [condition],
        ifcVersion: "IFC2X3 IFC4",
      };
      setRules([...rules, rule]);
      openRule(rule.id);
      return;
    }

    setRules(
      rules.map((rule) =>
        rule.id === targetRule.id
          ? {
              ...rule,
              entityTypes: [...new Set([...rule.entityTypes, ...expandedTypeNamesFor(selectionName)])],
              conditions: [...rule.conditions, condition],
            }
          : rule
      )
    );
    openRule(targetRule.id);
  }

  /**
   * The wizard's own draft never touches `rules` until this fires — Cancel just unmounts it. The
   * new rule is deliberately left collapsed rather than opened: the wizard already walked the user
   * through configuring it, so reopening it into the dense card would be redundant.
   */
  function handleWizardFinish(rule: RuleDraft) {
    setRules([...rules, rule]);
    setJustAddedRuleId(rule.id);
    setTarget(rule.id);
    setWizardOpen(false);
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
      // "Duplicate" makes an independent rule, not another OR branch: silently growing the
      // group here would be a surprising side effect of a button that says nothing about OR.
      // A non-OR identifier (a third party's own machine id) is left untouched.
      ...(orGroupIdOf(rule.identifier) ? { identifier: null } : {}),
    };
    const index = rules.indexOf(rule);
    setRules([...rules.slice(0, index + 1), copy, ...rules.slice(index + 1)]);
    openRule(copy.id);
  }

  /**
   * Adds a new rule that shares `rule`'s applicability but starts with no conditions of its own,
   * linked to it (and any of its existing OR siblings) through a fresh or existing group id on
   * `identifier`. The pair is meant to be read as one rule that passes an element if either
   * branch does — see `validateBySpecificationGrouped`, which is what actually merges them at
   * check time. `rule` itself gains the group id here too, the first time it branches.
   *
   * A fresh id goes through `nextOrGroupId` rather than a bare `nextDraftId("or")` — an imported
   * document carries its `identifier` verbatim, never re-keyed onto the page's counter, so the very
   * next counter value can already name a group the import brought in. Minting straight off the
   * counter would then silently merge two unrelated OR groups into one at check time.
   */
  function handleAddOrBranch(rule: RuleDraft) {
    const existingGroupId = orGroupIdOf(rule.identifier);
    const groupId = existingGroupId ?? nextOrGroupId(rules, () => nextDraftId("or"));
    const siblingCount = orGroupSiblingsOf(rules, rule).length;

    const branch: RuleDraft = {
      id: nextDraftId("r"),
      name: `${rule.name} (${siblingCount + 2})`,
      entityTypes: [...rule.entityTypes],
      cardinality: rule.cardinality,
      entityPredefinedType: rule.entityPredefinedType,
      applicabilityFacets: rule.applicabilityFacets?.map((facet) => ({ ...facet, id: nextDraftId("c") })),
      conditions: [],
      ifcVersion: rule.ifcVersion,
      identifier: `${OR_GROUP_IDENTIFIER_PREFIX}${groupId}`,
    };

    const index = rules.indexOf(rule);
    const updatedSource = existingGroupId ? rule : { ...rule, identifier: branch.identifier };
    setRules([...rules.slice(0, index), updatedSource, branch, ...rules.slice(index + 1)]);
    openRule(branch.id);
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
    // The title is a field of the same block, so the panel edits all eight through one state.
    setDocumentInfo({ ...outcome.result.info, title: outcome.result.title ?? undefined });
    setExtraInfo(outcome.result.extraInfo);
    setTarget("new");
    setOpenRuleIds(new Set());
    setFailureRuleIds(new Set());
    setJustAddedRuleId(null);
  }

  /**
   * Rules and refused specifications in the order the imported document put them. OR-linked rules
   * are always adjacent — `handleAddOrBranch` inserts a new branch right beside its source, and
   * nothing in the builder reorders rules — so consecutive same-group cards are buffered and
   * wrapped in one `.or-frame` to show they belong together. A group broken up by something else
   * (an imported document, say) just renders as separate cards instead.
   */
  function specificationCards(): ReactNode[] {
    const cards: ReactNode[] = [];
    let groupBuffer: { groupId: string; nodes: ReactNode[] } | null = null;

    function flushGroup() {
      if (!groupBuffer) return;
      cards.push(
        groupBuffer.nodes.length > 1 ? (
          <div className="or-frame" key={`or-frame-${groupBuffer.groupId}`}>
            {groupBuffer.nodes}
          </div>
        ) : (
          groupBuffer.nodes[0]
        )
      );
      groupBuffer = null;
    }

    for (let index = 0; index <= rules.length; index += 1) {
      refused.forEach((specification, position) => {
        if (Math.min(specification.passThrough.afterIndex, rules.length) !== index) return;
        flushGroup();
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
      const card = (
        <RuleCard
          key={rule.id}
          rule={rule}
          elements={builderElements}
          introspection={introspection}
          isActive={rule.id === target}
          isOpen={openRuleIds.has(rule.id)}
          showFailures={failureRuleIds.has(rule.id)}
          isNew={rule.id === justAddedRuleId}
          onChange={(next) =>
            setRules((previous) => previous.map((entry) => (entry.id === rule.id ? next : entry)))
          }
          onDuplicate={() => handleDuplicateRule(rule)}
          orGroupSiblingNames={orGroupSiblingsOf(rules, rule).map((sibling) => sibling.name)}
          onAddOrBranch={() => handleAddOrBranch(rule)}
          onDelete={() => {
            setRules(rules.filter((entry) => entry.id !== rule.id));
            setTarget((current) => (current === rule.id ? "new" : current));
          }}
          onActivate={() => setTarget(rule.id)}
          onToggleOpen={() => toggleIn(setOpenRuleIds, rule.id)}
          onToggleFailures={() => toggleIn(setFailureRuleIds, rule.id)}
        />
      );

      const groupId = orGroupIdOf(rule.identifier);
      if (groupId === null) {
        flushGroup();
        cards.push(card);
      } else if (groupBuffer && groupBuffer.groupId === groupId) {
        groupBuffer.nodes.push(card);
      } else {
        flushGroup();
        groupBuffer = { groupId, nodes: [card] };
      }
    }
    flushGroup();
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
    <div className="builder" ref={builderRef}>
      <header className="builder-head">
        <h1>IDS Rule Builder</h1>
        <p className="lede">
          Build buildingSMART IDS (Information Delivery Specification) rule sets from a real IFC
          model: entirely in your browser, with no server and no upload.
        </p>
      </header>

      <div className="loadbar" ref={loadbarRef}>
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
            Everything offered here (types, property sets, values) comes from one of your own IFC
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

            <div className="target-strip">
              <label htmlFor="rule-target" className="micro">
                Add conditions to
              </label>
              <select
                id="rule-target"
                value={target}
                title={target === "new" ? "Create a new rule" : (rules.find((rule) => rule.id === target)?.name ?? "")}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="new">+ Create a new rule</option>
                {rules.length > 0 && (
                  <optgroup label="Existing rules">
                    {rules.map((rule) => (
                      <option key={rule.id} value={rule.id} title={rule.name}>
                        {rule.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="property-search">
              <input
                type="text"
                aria-label="Search properties"
                placeholder="Search properties…"
                value={propertySearch}
                onChange={(event) => setPropertySearch(event.target.value)}
              />
            </div>

            <SchemaCards
              source={selectionSource}
              selectionName={selectionName}
              groupTypeCount={selectedGroup ? selectedGroup.types.length : null}
              query={propertySearch}
              onAddField={handleAddField}
            />
          </aside>

          <main
            className="stack"
            // A click on the stack's own background — the gaps around and between rule cards,
            // not a card or anything inside one — reads as "target nothing", the same as picking
            // "+ Create a new rule" from the picker. Rule cards, and everything else in here, stop
            // this from firing by simply being what was actually clicked.
            onClick={(event) => {
              if (!wizardOpen && event.target === event.currentTarget) setTarget("new");
            }}
          >
            {wizardOpen ? (
              <RuleWizard
                introspection={introspection}
                elements={builderElements}
                fileName={model.fileName}
                onFinish={handleWizardFinish}
                onCancel={() => setWizardOpen(false)}
              />
            ) : (
              <>
                <div className="stack-head">
                  <h2>Rules</h2>
                  <span className="micro">
                    {rules.length} {rules.length === 1 ? "rule" : "rules"}
                    {refused.length > 0
                      ? ` · ${refused.length} kept but not editable`
                      : " · one specification each"}
                  </span>
                </div>

                <DocumentInfoPanel
                  info={documentInfo}
                  titlePlaceholder={model.fileName}
                  open={infoOpen}
                  onToggle={() => setInfoOpen((wasOpen) => !wasOpen)}
                  onChange={setDocumentInfo}
                />

                {rules.length === 0 && refused.length === 0 && (
                  <p className="hint">
                    No rules yet: click a field on the left, start one below, or import an
                    existing .ids file.
                  </p>
                )}

                {specificationCards()}

                <div
                  className="addtile"
                  // Not a rule card, so it counts as background too — except the button, which
                  // has its own job and shouldn't also carry this side effect.
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest(".go")) setTarget("new");
                  }}
                >
                  <span className="plus" aria-hidden="true">
                    +
                  </span>
                  <div>
                    <div className="t">Create a new rule</div>
                    <div className="d">
                      Answer a few questions about what to check; we'll pull types, fields and
                      real values straight from {model.fileName} as you go.
                    </div>
                  </div>
                  <button type="button" className="go" onClick={() => setWizardOpen(true)}>
                    Start
                  </button>
                </div>

                <IdsXmlPreview
                  rules={rules}
                  info={documentInfo}
                  title={documentInfo.title || model.fileName}
                  refused={refused}
                  extraInfo={extraInfo}
                />
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
