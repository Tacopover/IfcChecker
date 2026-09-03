// The viewer's toolbar sits on the model rather than in a strip of labelled
// buttons, so its controls have to read as glyphs. Hand-drawn on the same 24
// grid the builder's chevron already uses — an icon dependency for eight paths
// would be the largest thing in the bundle it joined.

interface IconProps {
  size?: number;
}

function Glyph({ size = 17, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Corner brackets closing on a box — frame everything that is on screen. */
export function ZoomToFitIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4" />
      <rect x="9" y="9" width="6" height="6" />
    </Glyph>
  );
}

/** A reticle — frame the one thing that is picked, not the whole model. */
export function ZoomToSelectionIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="3.1" />
      <circle cx="12" cy="12" r="7.6" />
      <path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6" />
    </Glyph>
  );
}

export function ResetViewIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 2.5v5h-5" />
    </Glyph>
  );
}

/** A cube with a plane cutting through it. */
export function SectionBoxIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7.2 12 3l8 4.2v9.6L12 21l-8-4.2z" />
      <path d="m4 7.2 8 4.2 8-4.2M12 11.4V21" />
      <path d="M2.5 15.5 21.5 5.5" />
    </Glyph>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Glyph size={10} {...props}>
      <path d="M5 5l14 14M19 5 5 19" />
    </Glyph>
  );
}
