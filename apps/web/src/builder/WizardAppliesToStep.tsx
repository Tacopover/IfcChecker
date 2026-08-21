import { useMemo, useState } from "react";
import { ancestorsOf } from "@ifc-qa/ids-validator";
import type { ModelIntrospection, TreeNode } from "./introspect.js";
import { allIfcTypeNames } from "./allIfcTypes.js";

export interface WizardAppliesToStepProps {
  introspection: ModelIntrospection;
  fileName: string;
  entityTypes: string[];
  showAllTypes: boolean;
  onChange: (entityTypes: string[], showAllTypes: boolean) => void;
  onNext: () => void;
  onCancel: () => void;
}

function upperSet(names: string[]): Set<string> {
  return new Set(names.map((name) => name.toUpperCase()));
}

/**
 * Step 1 — "What does this rule apply to?" A pick list of the file's own types and groups (the
 * full `introspection.tree`, indented by nesting depth — a group's children stay individually
 * pickable, not just the group as a whole), plus an optional "show all IFC types" toggle that adds
 * a searched, honestly zero-data second section for a type this file doesn't contain (see
 * `allIfcTypeNames`).
 */
export function WizardAppliesToStep({
  introspection,
  fileName,
  entityTypes,
  showAllTypes,
  onChange,
  onNext,
  onCancel,
}: WizardAppliesToStepProps) {
  const [search, setSearch] = useState("");

  const groupByName = useMemo(
    () => new Map(introspection.groups.map((group) => [group.name, group])),
    [introspection]
  );
  // Every name already offered by the file's own tree — a group and every type under it, plus
  // every ungrouped type. Schema-only search never repeats one of these.
  const known = useMemo(() => {
    const names = new Set<string>();
    for (const group of introspection.groups) {
      names.add(group.name.toUpperCase());
      for (const type of group.types) names.add(type.toUpperCase());
    }
    for (const entry of introspection.entityTypes) names.add(entry.name.toUpperCase());
    return names;
  }, [introspection]);

  const pickedUpper = upperSet(entityTypes);
  const query = search.trim().toLowerCase();
  const schemaMatches = useMemo(() => {
    if (!showAllTypes || query === "") return [];
    return allIfcTypeNames()
      .filter((name) => !known.has(name.toUpperCase()))
      .filter((name) => name.toLowerCase().includes(query))
      .slice(0, 60);
  }, [showAllTypes, query, known]);

  // `fieldsFor` already resolves an ancestor picked above the file's own tree (via its
  // `descendantsOf` fallback) to the real present types under it, not just a literal-name match —
  // a plain count-by-name lookup would show 0 for exactly the picks the ancestor breadcrumb exists
  // to make possible.
  const totalCount = introspection.fieldsFor(entityTypes).total;
  const exampleGroup = introspection.groups[0] ?? null;

  function toggleGroup(name: string) {
    const group = groupByName.get(name);
    if (!group) return;
    const groupUpper = upperSet(group.types);
    const alreadyIn = group.types.every((type) => pickedUpper.has(type.toUpperCase()));
    const next = alreadyIn
      ? entityTypes.filter((type) => !groupUpper.has(type.toUpperCase()))
      : [...new Set([...entityTypes, ...group.types])];
    onChange(next, showAllTypes);
  }

  function toggleType(name: string) {
    const next = pickedUpper.has(name.toUpperCase())
      ? entityTypes.filter((type) => type.toUpperCase() !== name.toUpperCase())
      : [...entityTypes, name];
    onChange(next, showAllTypes);
  }

  function removeType(name: string) {
    const group = groupByName.get(name);
    if (group) {
      toggleGroup(name);
      return;
    }
    toggleType(name);
  }

  // Recurses into a group's children rather than stopping at the top level — a file with many
  // disciplines often has no narrower group than one broad root (e.g. every element sharing
  // IfcElement), and stopping at the top level would leave every real distinction underneath it
  // (IfcFlowSegment, IfcWall, ...) unreachable.
  function renderNode(node: TreeNode, depth: number) {
    const checked =
      node.kind === "group"
        ? (groupByName.get(node.name)?.types.every((type) => pickedUpper.has(type.toUpperCase())) ?? false)
        : pickedUpper.has(node.name.toUpperCase());
    // Only at the tree's own top: the schema ancestors sitting above the broadest type/group this
    // file's tree already shows — e.g. IfcElement's own file has no narrower group above it, but
    // IfcObject/IfcProduct still exist in the schema and may be the "everything" pick a user wants.
    const ancestors = depth === 0 ? [...ancestorsOf(node.name)].reverse() : [];
    return (
      <div key={node.name}>
        {ancestors.length > 0 && (
          <div className="ancestorpath">
            {ancestors.map((name) => (
              <button
                key={name}
                type="button"
                className={pickedUpper.has(name.toUpperCase()) ? "checked" : undefined}
                onClick={() => toggleType(name)}
              >
                {name}
              </button>
            ))}
            <span className="cur">{node.name}</span>
          </div>
        )}
        <label
          className={`pickrow${checked ? " checked" : ""}`}
          style={depth > 0 ? { marginLeft: `${depth * 1.25}rem` } : undefined}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => (node.kind === "group" ? toggleGroup(node.name) : toggleType(node.name))}
          />
          <div>
            <div className="name">{node.name}</div>
            {node.kind === "group" && (
              <div className="desc">covers {groupByName.get(node.name)?.types.join(", ")}</div>
            )}
          </div>
          <span className="cnt">{node.count} elements</span>
        </label>
        {node.kind === "group" && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="wizcard">
      <h1>What does this rule apply to?</h1>
      <p className="sub">
        Pick one or more types{showAllTypes ? "" : ` from ${fileName}`}. Everything listed below
        {showAllTypes ? "" : " is a type your file actually contains — nothing here is hypothetical"}.
      </p>

      <div className="explain">
        A <b>type</b> is an IFC class — the kind of thing an element is, like a wall or a door.
        {exampleGroup ? (
          <>
            {" "}
            Some types are grouped under a broader category, like <b>{exampleGroup.name}</b>{" "}
            below, which covers every kind of {exampleGroup.name.toLowerCase()} this file has (
            {exampleGroup.types.join(", ")}) — pick the group to cover all of them at once.
          </>
        ) : (
          <> Some types are grouped under a broader category when this file has more than one kind of it — pick the group to cover all of them at once.</>
        )}
      </div>

      <div className="togglerow">
        <button
          type="button"
          className="switch"
          aria-pressed={showAllTypes}
          aria-label="Show all IFC types"
          onClick={() => onChange(entityTypes, !showAllTypes)}
        >
          <span className="track" />
          <span className="knob" />
        </button>
        <div>
          <div className="tt">Show all IFC types</div>
          <div className="td">
            Off shows only the {introspection.entityTypes.length} type
            {introspection.entityTypes.length === 1 ? "" : "s"} {fileName} actually contains
          </div>
        </div>
      </div>

      {showAllTypes && (
        <div className="searchbox">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            aria-label="Search IFC types"
            placeholder="Search IFC types…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}

      {showAllTypes && <div className="sectiontitle">In {fileName}</div>}
      <div className="picklist">{introspection.tree.map((node) => renderNode(node, 0))}</div>

      {showAllTypes && query !== "" && (
        <>
          <div className="divider">also in the IFC schema</div>
          <div className="picklist">
            {schemaMatches.length === 0 && (
              <div className="emptyfilter">No schema type matches "{search.trim()}".</div>
            )}
            {schemaMatches.map((name) => {
              const checked = pickedUpper.has(name.toUpperCase());
              return (
                <label key={name} className={`pickrow unmatched${checked ? " checked" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleType(name)} />
                  <div className="name">{name}</div>
                  <span className="tag">not in this file</span>
                </label>
              );
            })}
          </div>
        </>
      )}
      {showAllTypes && query === "" && (
        <div className="emptyfilter">Type to search the full IFC schema (~{allIfcTypeNames().length} types).</div>
      )}

      <div className="selline">
        {entityTypes.length === 0 ? (
          "Nothing selected yet"
        ) : (
          <>
            Selected:
            {entityTypes
              .filter((name) => {
                // One chip per pick — a group's own name stands for its whole `.types` run, so a
                // type already covered by a checked group does not get its own chip too.
                const group = [...groupByName.values()].find((g) =>
                  g.types.some((t) => t.toUpperCase() === name.toUpperCase())
                );
                return !group || group.name.toUpperCase() === name.toUpperCase();
              })
              .map((name) => {
                const inFile = known.has(name.toUpperCase());
                return (
                  <span key={name} className={`selchip${inFile ? "" : " unmatched"}`}>
                    {name}
                    <button type="button" aria-label={`Remove ${name}`} onClick={() => removeType(name)}>
                      ✕
                    </button>
                  </span>
                );
              })}
          </>
        )}
      </div>

      <div className="wizfoot">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <span className="spacer" />
        <span className="selline" style={{ margin: 0 }}>
          {totalCount} element{totalCount === 1 ? "" : "s"} selected
        </span>
        <button type="button" className="btn" disabled={entityTypes.length === 0} onClick={onNext}>
          Next: Narrow it down →
        </button>
      </div>
    </div>
  );
}
