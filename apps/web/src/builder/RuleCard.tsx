import { useMemo } from "react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { ApplicabilityFacetDraft, FacetDraft, RuleDraft } from "@ifc-qa/ids-validator";
import type { ModelIntrospection } from "./introspect.js";
import { evaluateRuleDraft } from "./evaluateDraft.js";
import { defaultConditionFor } from "./ConditionRow.js";
import { ruleProblems } from "./completeness.js";
import { FailingElementsTable } from "./FailingElementsTable.js";
import { ApplicabilityRow, RequirementRow } from "./FacetRow.js";
import { nextDraftId } from "./draftIds.js";

export interface RuleCardProps {
  rule: RuleDraft;
  elements: NormalizedElement[];
  introspection: ModelIntrospection;
  isActive: boolean;
  isOpen: boolean;
  showFailures: boolean;
  onChange: (next: RuleDraft) => void;
  onDuplicate: () => void;
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
  onChange,
  onDuplicate,
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
    [rule.entityTypes, rule.applicabilityFacets, rule.conditions, elements]
  );
  const source = useMemo(
    () => introspection.fieldsFor(rule.entityTypes),
    [introspection, rule.entityTypes]
  );

  const { matched, passed, perCondition, failures } = evaluation;
  const failing = matched - passed;
  const ratio = matched ? passed / matched : 0;
  const scoreClass =
    matched === 0 || rule.conditions.length === 0 ? "empty" : failing === 0 ? "all-pass" : "has-fail";

  const problems = ruleProblems(rule);
  const preserved = rule.imported?.passThrough ?? [];
  const groupByName = new Map(introspection.groups.map((group) => [group.name, group]));
  const countByType = new Map(introspection.entityTypes.map((entry) => [entry.name, entry.count]));
  const usedTypes = new Set(rule.entityTypes);

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
  const summary =
    rule.conditions.length === 0
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
        {preserved.length > 0 && (
          <span className="badge kept" title={preserved.map((entry) => entry.construct).join(", ")}>
            {preserved.length} kept
          </span>
        )}
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
              {rule.entityTypes.map((entityType) => {
                const group = groupByName.get(entityType);
                return (
                  <span
                    key={entityType}
                    className={group ? "chip group" : "chip"}
                    title={group ? `covers ${group.types.join(", ")}` : entityType}
                  >
                    {entityType}
                    <span className="chip-count num">
                      {group
                        ? `${group.types.length} types · ${group.count}`
                        : (countByType.get(entityType) ?? 0)}
                    </span>
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
                  onChange({ ...rule, entityTypes: [...rule.entityTypes, event.target.value] });
                }}
              >
                <option value="">+ type…</option>
                <optgroup label="Groups (inherited)">
                  {introspection.groups
                    .filter((group) => !usedTypes.has(group.name))
                    .map((group) => (
                      <option key={group.name} value={group.name}>
                        {group.name} — {group.types.length} types, {group.count}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Entity types in this file">
                  {introspection.entityTypes
                    .filter((entry) => !usedTypes.has(entry.name))
                    .map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name} ({entry.count})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
            {(rule.applicabilityFacets ?? []).map((facet, index) => (
              <ApplicabilityRow
                key={facet.id}
                facet={facet}
                source={source}
                onChange={(next) => replaceApplicabilityFacet(facet.id, next)}
                onDuplicate={() => duplicateApplicabilityFacet(index, facet)}
                onDelete={() => deleteApplicabilityFacet(facet.id)}
              />
            ))}
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
                  onChange={(next) => replaceCondition(condition.id, next)}
                  onDuplicate={() => duplicateCondition(index, condition)}
                  onDelete={() => deleteCondition(condition.id)}
                />
              ))
            )}
            <button
              type="button"
              className="linkbtn"
              onClick={() => updateConditions([...rule.conditions, defaultConditionFor(source)])}
            >
              + condition
            </button>

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
                      {entry.reason ? ` — ${entry.reason}` : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rule-foot">
            <span className={`score ${scoreClass}`}>
              <span className="score-text">{summary}</span>
            </span>
            {failing > 0 && (
              <button type="button" className="linkbtn" onClick={onToggleFailures}>
                {showFailures ? "Hide" : "Show"} failing elements
              </button>
            )}
          </div>

          {showFailures && failing > 0 && (
            <FailingElementsTable failures={failures} conditions={rule.conditions} />
          )}
        </div>
      )}
    </article>
  );
}
