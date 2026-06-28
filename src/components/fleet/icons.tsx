// Small shared SVGs for the fleet variants.

export function CarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden="true">
      <path d="M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13h14v4a1 1 0 0 1-1 1h-1.5a1.5 1.5 0 0 1-3 0h-5a1.5 1.5 0 0 1-3 0H4a1 1 0 0 1-1-1v-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Angle switcher glyphs. "side" reuses the car profile; "front" and "rear" are
// both head-on views — front shows round headlights + a centre grille, rear
// shows a horizontal light bar + a trunk seam, so the two read apart.
export function AngleIcon({ angle, className = "h-5 w-5" }: { angle: "front" | "side" | "rear"; className?: string }) {
  if (angle === "side") return <CarGlyph className={className} />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 11l1-2.6A2 2 0 0 1 8.9 7h6.2a2 2 0 0 1 1.9 1.4L18 11" />
      <rect x="4.5" y="11" width="15" height="6.4" rx="1.6" />
      {angle === "front" ? (
        <>
          <circle cx="7.8" cy="14.2" r="0.9" />
          <circle cx="16.2" cy="14.2" r="0.9" />
          <path d="M10.6 14.2h2.8" />
        </>
      ) : (
        <>
          <path d="M6.8 14h3.2M14 14h3.2M7 11h10" />
        </>
      )}
    </svg>
  );
}

export function Chevron({ dir, className = "h-5 w-5" }: { dir: "left" | "right"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

export function ShuffleIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${spinning ? "fleet-spin" : ""}`} aria-hidden="true">
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}
