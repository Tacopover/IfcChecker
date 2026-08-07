import type { RefusedSpecification } from "@ifc-qa/ids-validator";

export interface RefusedSpecificationCardProps {
  specification: RefusedSpecification;
  onDelete: () => void;
}

/**
 * A specification held in the rule list but not offered for editing. It sits in its original
 * position rather than in a footnote: a user comparing this page to their file has to be able to
 * see that nothing went missing, and where the parts they cannot touch sit among the parts they can.
 */
export function RefusedSpecificationCard({
  specification,
  onDelete,
}: RefusedSpecificationCardProps) {
  const name = specification.name || "Untitled specification";

  return (
    <article className="rule refused" data-refused={name}>
      <div className="rule-head">
        <span className="refused-mark" aria-hidden="true">
          🔒
        </span>
        <span className="rule-title-static">{name}</span>
        <span className="badge kept">Kept, not editable</span>
        <button
          type="button"
          className="iconbtn danger"
          title="Remove from the export"
          aria-label={`Remove ${name} from the export`}
          onClick={onDelete}
        >
          🗑
        </button>
      </div>
      <div className="refused-body" role="note">
        <p>
          Written back into the exported file exactly as it came in. The builder cannot show which
          elements it selects, so editing it here would mean editing a rule you cannot see.
        </p>
        <ul className="unsupported-list">
          {specification.reasons.map((reason) => (
            <li key={`${reason.construct}-${reason.description}`}>
              <code>{reason.construct}</code> — {reason.description}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
