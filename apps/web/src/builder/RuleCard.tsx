import { useMemo, useState } from "react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { ApplicabilityFacetDraft, FacetDraft, RuleDraft } from "@ifc-qa/ids-validator";
import {
  collapsibleEntityGroupsFor,
  DEFAULT_IFC_VERSION,
  descendantsOf,
  effectiveCardinalityOf,
  expandedTypeNamesFor,
  isAbstractIfcType,
  plainName,
} from "@ifc-qa/ids-validator";
import type { ModelIntrospection } from "./introspect.js";
import { evaluateRuleDraft } from "./evaluateDraft.js";
import {
  APPLICABILITY_KINDS,
  REQUIREMENT_KINDS,
  defaultApplicabilityFacetFor,
  defaultFacetFor,
} from "./defaultFacets.js";
import { ruleProblems } from "./completeness.js";
import { FailingElementsTable } from "./FailingElementsTable.js";
import { ApplicabilityRow, RequirementRow } from "./FacetRow.js";
import { FacetValueEditor } from "./FacetValueEditor.js";
import { predefinedTypeOptions } from "./EntityRow.js";
import { SpecificationInfoPanel } from "./SpecificationInfoPanel.js";
import { nextDraftId } from "./draftIds.js";

/**
 * What the "narrow by" select carries for the entity's predefined type.
 *
 * Not a facet kind, so it cannot collide with one — it is a field on the `<entity>` and is stored
 * beside the type chips rather than in `applicabilityFacets`.
 */
const PREDEFINED_TYPE_OPTION = "entityPredefinedType";

/**
 * The three schema versions `ids.xsd` lists, and the only three a document may name.
 *
 * A checkbox each rather than a text box: `ifcVersion` is a space-separated list drawn from a
 * closed enumeration, so a box would let a user write a value that makes the document invalid.
 * 344 of the 464 hand-authored corpus specifications say `"IFC2X3 IFC4"`.
 */
const IFC_VERSIONS = ["IFC2X3", "IFC4", "IFC4X3_ADD2"];

const PROHIBITED_HINT =
  "Flips this from a check to a ban: instead of judging elements that match, it fails the " +
  "moment any element does. A prohibited rule can't also state requirements; remove any " +
  "below, or this rule won't export.";

export interface RuleCardProps {
  rule: RuleDraft;
  elements: NormalizedElement[];
  introspection: ModelIntrospection;
  isActive: boolean;
  isOpen: boolean;
  showFailures: boolean;
  /** Whether this rule was just produced by the creation wizard — shows a transient badge. */
  isNew?: boolean;
  onChange: (next: RuleDraft) => void;
  onDuplicate: () => void;
  /** Names of the other rules this one is OR-linked with — see `orGroupSiblingsOf`. Empty if none. */
  orGroupSiblingNames: string[];
  onAddOrBranch: () => void;
  onDelete: () => void;
  onActivate: () => void;
  onToggleOpen: () => void;
  onToggleFailures: () => void;
}

export function RuleCard({
  rule,
  elements,
  introspection,
  isActive,
  isOpen,
  showFailures,
  isNew = false,
  onChange,
  onDuplicate,
  orGroupSiblingNames,
  onAddOrBranch,
  onDelete,
  onActivate,
  onToggleOpen,
  onToggleFailures,
}: RuleCardProps) {
  // Real models are far larger than the mockup's synthetic one: without this the whole file would be
  // re-walked on every keystroke anywhere on the page. Keyed on the two fields the verdict actually
  // depends on, so renaming the rule does not re-evaluate it.
  const evaluation = useMemo(
    () => evaluateRuleDraft(rule, elements),
    [rule.entityTypes, rule.entityPredefinedType, rule.applicabilityFacets, rule.conditions, elements]
  );
  const source = useMemo(
    () => introspection.fieldsFor(rule.entityTypes),
    [introspection, rule.entityTypes]
  );

  const { matched, passed, perCondition, failures } = evaluation;
  const prohibited = effectiveCardinalityOf(rule) === "prohibited";
  const failing = matched - passed;
  const ratio = matched ? passed / matched : 0;
  // A prohibited rule's own zero conditions are its complete, intended state — not the "still being
  // authored" state the same emptiness means for an ordinary rule — so it gets its own read: any
  // match at all is a violation, and no match is full compliance.
  const scoreClass = prohibited
    ? matched === 0
      ? "all-pass"
      : "has-fail"
    : matched === 0 || rule.conditions.length === 0
      ? "empty"
      : failing === 0
        ? "all-pass"
        : "has-fail";

  // Local, because it is presentation only: which panels are open is not part of the draft, and
  // the page already tracks which rules are open.
  const [infoOpen, setInfoOpen] = useState(false);
  // Whether the "what does Prohibited mean" bubble is open — presentation only, same as `infoOpen`.
  const [prohibitedTipOpen, setProhibitedTipOpen] = useState(false);

  // `??`, not `||`: a rule that has never stated one gets the exporter's default, and one the user
  // cleared states none — which `ruleProblems` reports rather than this control silently re-checking.
  const statedVersions = (rule.ifcVersion ?? DEFAULT_IFC_VERSION).split(/\s+/).filter(Boolean);
  function toggleVersion(version: string) {
    const next = statedVersions.includes(version)
      ? statedVersions.filter((entry) => entry !== version)
      : [...IFC_VERSIONS.filter((entry) => statedVersions.includes(entry) || entry === version)];
    onChange({ ...rule, ifcVersion: next.join(" ") });
  }
  // Which facets the user has interacted with, so a freshly-added one doesn't show a completeness
  // error before they've touched it (see `FacetRowFrameProps.onTouch`). Keyed by facet id rather
  // than boolean-per-row so a duplicate or a newly-added facet — with its own fresh id — always
  // starts untouched, with no special-case reset needed.
  const [touchedFacetIds, setTouchedFacetIds] = useState<ReadonlySet<string>>(new Set());
  function touch(id: string) {
    setTouchedFacetIds((previous) => new Set(previous).add(id));
  }
  const predefinedType = rule.entityPredefinedType ?? null;
  const predefinedTypes = useMemo(() => predefinedTypeOptions(source, null), [source]);

  const problems = ruleProblems(rule);
  const preserved = rule.imported?.passThrough ?? [];
  const groupByName = new Map(introspection.groups.map((group) => [group.name, group]));
  const countByType = new Map(introspection.entityTypes.map((entry) => [entry.name, entry.count]));
  const usedTypes = new Set(rule.entityTypes);

  // Schema-scoped, unlike `groupByName` above: a literal chip run that exactly matches a known
  // ancestor's full expansion collapses into one summary chip, regardless of which file is open.
  const collapsedGroups = useMemo(
    () => collapsibleEntityGroupsFor(rule.entityTypes),
    [rule.entityTypes]
  );
  const collapsedUpper = new Set(collapsedGroups.flatMap((group) => group.types.map((t) => t.toUpperCase())));

  function updateConditions(conditions: FacetDraft[]) {
    onChange({ ...rule, conditions });
  }

  // Shared by every row kind, so a new one wires up three callbacks rather than re-deriving them.
  function replaceCondition(id: string, next: FacetDraft) {
    updateConditions(rule.conditions.map((entry) => (entry.id === id ? next : entry)));
  }

  function duplicateCondition(index: number, condition: FacetDraft) {
    updateConditions([
      ...rule.conditions.slice(0, index + 1),
      { ...condition, id: nextDraftId("c") },
      ...rule.conditions.slice(index + 1),
    ]);
  }

  function deleteCondition(id: string) {
    updateConditions(rule.conditions.filter((entry) => entry.id !== id));
  }

  // The same three, on the other side of the rule. Kept apart rather than parameterised: the two
  // lists live in different fields of the draft, and an applicability facet is a narrower type.
  function updateApplicabilityFacets(facets: ApplicabilityFacetDraft[]) {
    onChange({ ...rule, applicabilityFacets: facets });
  }

  function replaceApplicabilityFacet(id: string, next: ApplicabilityFacetDraft) {
    updateApplicabilityFacets(
      (rule.applicabilityFacets ?? []).map((entry) => (entry.id === id ? next : entry))
    );
  }

  function duplicateApplicabilityFacet(index: number, facet: ApplicabilityFacetDraft) {
    const facets = rule.applicabilityFacets ?? [];
    updateApplicabilityFacets([
      ...facets.slice(0, index + 1),
      { ...facet, id: nextDraftId("a") },
      ...facets.slice(index + 1),
    ]);
  }

  function deleteApplicabilityFacet(id: string) {
    updateApplicabilityFacets((rule.applicabilityFacets ?? []).filter((entry) => entry.id !== id));
  }

  // Qualified whenever requirements were kept but not shown, so "all pass" never reads as a verdict
  // on the whole specification when part of it was never checked here.
  const shownOnly = preserved.length > 0 ? " on the conditions shown" : "";
  const summary = prohibited
    ? matched === 0
      ? "None found: this rule is satisfied"
      : `${matched} element${matched === 1 ? "" : "s"} found, and none may match this rule`
    : rule.conditions.length === 0
      ? preserved.length > 0
        ? "Nothing shown here to check"
        : "Nothing checked yet"
      : matched === 0
        ? "No matching elements in this file"
        : failing === 0
          ? `All ${matched} pass${shownOnly}`
          : `${failing} of ${matched} fail${shownOnly}`;

  return (
    <article
      className={`rule${isOpen ? " open" : ""}${isActive ? " is-active" : ""}`}
      data-rule={rule.id}
      onFocusCapture={onActivate}
      onClick={onActivate}
    >
      <div className="rule-head">
        <button
          type="button"
          className="disclose"
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${rule.name}`}
          aria-expanded={isOpen}
          onClick={onToggleOpen}
        >
          ▶
        </button>
        <input
          className="rule-title"
          aria-label="Rule name"
          value={rule.name}
          onChange={(event) => onChange({ ...rule, name: event.target.value })}
        />
        {isActive && <span className="badge target">Adding here</span>}
        {isNew && <span className="badge new">Just added</span>}
        {preserved.length > 0 && (
          <span className="badge kept" title={preserved.map((entry) => entry.construct).join(", ")}>
            {preserved.length} kept
          </span>
        )}
        {orGroupSiblingNames.length > 0 && (
          <span
            className="badge or-group"
            title={`Passes if this rule or ${orGroupSiblingNames.join(", ")} passes`}
          >
            OR
          </span>
        )}
        <fieldset className="version-toggle" aria-label="Schema versions">
          {IFC_VERSIONS.map((version) => (
            <label key={version}>
              <input
                type="checkbox"
                checked={statedVersions.includes(version)}
                onChange={() => toggleVersion(version)}
              />
              {version}
            </label>
          ))}
        </fieldset>
        <span className="prohibited-toggle">
          <label>
            <input
              type="checkbox"
              checked={prohibited}
              onChange={(event) =>
                onChange({
                  ...rule,
                  // Explicit either way, not `undefined` on uncheck: an imported rule may be
                  // effectively prohibited through its own source's <applicability minOccurs
                  // maxOccurs> rather than this field, and `undefined` would just fall back to that
                  // source again — leaving the checkbox unable to ever turn a real import's ban off.
                  cardinality: event.target.checked ? "prohibited" : "required",
                })
              }
            />
            Prohibited
          </label>
          <span className="tip">
            <button
              type="button"
              className="tip-btn"
              aria-label="What does Prohibited mean?"
              aria-expanded={prohibitedTipOpen}
              onClick={() => setProhibitedTipOpen((wasOpen) => !wasOpen)}
            >
              ?
            </button>
            {prohibitedTipOpen && (
              <div className="tip-bubble" role="tooltip">
                {PROHIBITED_HINT}
              </div>
            )}
          </span>
        </span>
        <span className={`score ${scoreClass}`}>
          <span className="bar" data-empty={matched ? 0 : 1}>
            <i style={{ width: `${ratio * 100}%` }} />
          </span>
          <span className="score-text num">
            <b>{passed}</b>/{matched}
          </span>
        </span>
        <button
          type="button"
          className="iconbtn"
          title="Duplicate rule"
          aria-label={`Duplicate rule ${rule.name}`}
          onClick={onDuplicate}
        >
          ⧉
        </button>
        <button
          type="button"
          className="iconbtn"
          title="Add an OR condition: passes if this rule or the new one passes"
          aria-label={`Add OR condition to ${rule.name}`}
          onClick={onAddOrBranch}
        >
          🔀
        </button>
        <button
          type="button"
          className="iconbtn danger"
          title="Delete rule"
          aria-label={`Delete rule ${rule.name}`}
          onClick={onDelete}
        >
          🗑
        </button>
      </div>

      {isOpen && (
        <div className="rule-body">
          <div className="clause">
            <span className="micro">Applies to</span>
            <div className="chips">
              {collapsedGroups.map((group) => {
                const count = group.types.reduce((n, t) => n + (countByType.get(t) ?? 0), 0);
                return (
                  <span
                    key={`collapsed:${group.name}`}
                    className="chip group"
                    title={`covers ${group.types.join(", ")}`}
                  >
                    {group.name}
                    <span className="chip-count num">
                      {group.types.length} types · {count}
                    </span>
                    <button
                      type="button"
                      className="x"
                      aria-label={`Remove ${group.name}`}
                      onClick={() => {
                        const upper = new Set(group.types.map((t) => t.toUpperCase()));
                        onChange({
                          ...rule,
                          entityTypes: rule.entityTypes.filter((name) => !upper.has(name.trim().toUpperCase())),
                        });
                      }}
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
              {rule.entityTypes
                .filter((entityType) => !collapsedUpper.has(entityType.trim().toUpperCase()))
                .map((entityType) => {
                  const group = groupByName.get(entityType);
                  const abstract = isAbstractIfcType(entityType);
                  // Schema-wide, unlike `group`: a name can have subtypes the table knows about
                  // even when this file holds none of them, or only one, so `group` never formed.
                  const subtypes = descendantsOf(entityType).filter((name) => !isAbstractIfcType(name));
                  const title = [
                    abstract ? `${entityType} is abstract; no element can carry it directly` : entityType,
                    group ? `covers ${group.types.join(", ")} in this file` : null,
                  ]
                    .filter((line): line is string => line !== null)
                    .join(" · ");
                  return (
                    <span
                      key={entityType}
                      className={`chip${group ? " group" : ""}${abstract ? " abstract" : ""}`}
                      title={title}
                    >
                      {entityType}
                      <span className="chip-count num">
                        {group
                          ? `${group.types.length} types · ${group.count}`
                          : (countByType.get(entityType) ?? 0)}
                      </span>
                      {/* IDS matches an entity name exactly and inherits nothing, so this name alone
                          selects only itself — one click writes its subtypes into the list instead,
                          the same way the builder already does silently for an authored pick. */}
                      {subtypes.length > 0 && (
                        <button
                          type="button"
                          className="expand"
                          title={`Expand to ${entityType} and its ${subtypes.length} subtype${subtypes.length === 1 ? "" : "s"}`}
                          aria-label={`Expand ${entityType} to its subtypes`}
                          onClick={() =>
                            onChange({
                              ...rule,
                              entityTypes: [
                                ...new Set([
                                  ...rule.entityTypes.filter((name) => name !== entityType),
                                  ...expandedTypeNamesFor(entityType),
                                ]),
                              ],
                            })
                          }
                        >
                          ⊃{subtypes.length}
                        </button>
                      )}
                      <button
                        type="button"
                        className="x"
                        aria-label={`Remove ${entityType}`}
                        onClick={() =>
                          onChange({
                            ...rule,
                            entityTypes: rule.entityTypes.filter((name) => name !== entityType),
                          })
                        }
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              <select
                className="linkbtn"
                aria-label="Add entity type or group"
                value=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  onChange({
                    ...rule,
                    entityTypes: [...new Set([...rule.entityTypes, ...expandedTypeNamesFor(event.target.value)])],
                  });
                }}
              >
                <option value="">+ type…</option>
                <optgroup label="Groups (inherited)">
                  {introspection.groups
                    .filter((group) => !usedTypes.has(group.name))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((group) => (
                      <option key={group.name} value={group.name}>
                        {group.name}: {group.types.length} types, {group.count}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Entity types in this file">
                  {introspection.entityTypes
                    .filter((entry) => !usedTypes.has(entry.name))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name} ({entry.count})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
            {/* Not a facet, so not a `FacetRowFrame`: it narrows the type chips above rather than
                standing beside them, and there is nothing sensible to duplicate. Shown only when
                the rule states one, because 6 of 41,751 corpus specifications do. */}
            {predefinedType !== null && (
              <div className="cond applicability-facet">
                <span className="tok">Predefined type</span>
                <span className="glue">selects only those whose predefined type must</span>
                <FacetValueEditor
                  id={rule.id}
                  label="Predefined type"
                  operatorLabel="Predefined type operator"
                  value={predefinedType}
                  // The row's presence is the statement, so the absent reading is the ✕ beside it
                  // rather than an operator that would leave an empty row behind.
                  onChange={(value) =>
                    onChange({ ...rule, entityPredefinedType: value ?? predefinedType })
                  }
                  observed={predefinedTypes}
                  absentLabel={null}
                />
                <span className="cond-score">
                  <button
                    type="button"
                    className="iconbtn danger"
                    title="Remove the predefined type this rule selects by"
                    aria-label="Remove the predefined type this rule selects by"
                    onClick={() => onChange({ ...rule, entityPredefinedType: null })}
                  >
                    ✕
                  </button>
                </span>
              </div>
            )}
            {(rule.applicabilityFacets ?? []).map((facet, index) => (
              <ApplicabilityRow
                key={facet.id}
                facet={facet}
                source={source}
                touched={touchedFacetIds.has(facet.id)}
                onTouch={() => touch(facet.id)}
                onChange={(next) => replaceApplicabilityFacet(facet.id, next)}
                onDuplicate={() => duplicateApplicabilityFacet(index, facet)}
                onDelete={() => deleteApplicabilityFacet(facet.id)}
              />
            ))}
            <select
              className="linkbtn"
              aria-label="Narrow what this rule selects"
              value=""
              onChange={(event) => {
                const picked = event.target.value;
                if (!picked) return;
                if (picked === PREDEFINED_TYPE_OPTION) {
                  onChange({
                    ...rule,
                    entityPredefinedType: plainName(predefinedTypes[0]?.value ?? ""),
                  });
                  return;
                }
                updateApplicabilityFacets([
                  ...(rule.applicabilityFacets ?? []),
                  defaultApplicabilityFacetFor(picked as ApplicabilityFacetDraft["kind"], source),
                ]);
              }}
            >
              <option value="">+ narrow by…</option>
              {APPLICABILITY_KINDS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
              {/* Offered here because it is where the user looks to narrow the selection, even
                  though it is a field on the `<entity>` rather than a facet standing beside it. */}
              {predefinedType === null && (
                <option value={PREDEFINED_TYPE_OPTION}>Predefined type</option>
              )}
            </select>
            {problems.applicability && <p className="rule-error">{problems.applicability}</p>}
          </div>

          <div className="clause">
            <span className="micro">Must satisfy all of</span>
            {problems.conditions ? (
              <p className="rule-error">
                {problems.conditions} Click a field in the left panel, or add one.
              </p>
            ) : (
              rule.conditions.map((condition, index) => (
                <RequirementRow
                  key={condition.id}
                  facet={condition}
                  source={source}
                  hits={perCondition[index] ?? 0}
                  matched={matched}
                  touched={touchedFacetIds.has(condition.id)}
                  onTouch={() => touch(condition.id)}
                  onChange={(next) => replaceCondition(condition.id, next)}
                  onDuplicate={() => duplicateCondition(index, condition)}
                  onDelete={() => deleteCondition(condition.id)}
                />
              ))
            )}
            {/* A select rather than the button it replaces: every kind `ids.xsd` allows here has a
                row now, and one that can only be reached by importing a file is not authorable. */}
            <select
              className="linkbtn"
              aria-label="Add a requirement"
              value=""
              onChange={(event) => {
                if (!event.target.value) return;
                updateConditions([
                  ...rule.conditions,
                  defaultFacetFor(event.target.value as FacetDraft["kind"], source),
                ]);
              }}
            >
              <option value="">+ condition…</option>
              {REQUIREMENT_KINDS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>

            {/* Permanent, not dismissible: the moment this matters is export, which can happen
                long after the import, and a count above that ignores these would be a lie. */}
            {preserved.length > 0 && (
              <div className="rule-preserved" role="note">
                <strong>
                  {preserved.length} more requirement{preserved.length === 1 ? "" : "s"} kept from
                  the imported file.
                </strong>{" "}
                They are written back on export, but the builder cannot show them, so the count
                above does not include them.
                <ul className="unsupported-list">
                  {preserved.map((entry) => (
                    <li key={`${entry.construct}-${entry.afterIndex}-${entry.xml}`}>
                      <code>{entry.construct}</code>
                      {entry.reason ? `: ${entry.reason}` : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <SpecificationInfoPanel
            rule={rule}
            open={infoOpen}
            onToggle={() => setInfoOpen((wasOpen) => !wasOpen)}
            onChange={onChange}
          />

          <div className="rule-foot">
            <span className={`score ${scoreClass}`}>
              <span className="score-text">{summary}</span>
            </span>
            {/* A prohibited rule's violation is the match itself, not a per-condition failure — the
                table's "Checked"/"Actual" columns read a condition that never runs here, so it has
                nothing to show. The score text above already says how many were found. */}
            {failing > 0 && !prohibited && (
              <button type="button" className="linkbtn" onClick={onToggleFailures}>
                {showFailures ? "Hide" : "Show"} failing elements
              </button>
            )}
          </div>

          {showFailures && failing > 0 && !prohibited && (
            <FailingElementsTable failures={failures} conditions={rule.conditions} />
          )}
        </div>
      )}
    </article>
  );
}
