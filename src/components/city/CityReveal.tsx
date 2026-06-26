"use client";

// CityReveal — the city backdrop, a pure function of `progress` (0 → 1). The traced
// overlay (same 2688×1520 frame as public/images/FORNT-BG.webp) is used ONLY as a
// CLIP: it never paints its own fill/stroke, and the clip edge is HARD (no feather).
// Each landmark FOCUSES IN (blurred → sharp while fading up) in place, on a gentle
// ease, then the actual full photo reveals. On the landing page `progress` is driven
// by scroll.
//
//   • lagos     0.00–0.20   focuses in first
//   • abuja     0.20–0.40   focuses in next
//   • billboard 0.40–0.60   billboard + bridge focus in together
//   • bridge    0.40–0.60
//   • full      0.62–0.82   the actual photo materialises over the windows

import { BILLBOARD, LAGOS, BRIDGE, ABUJA } from "./cityPaths";

const IMG = "/images/FORNT-BG.webp";
const FRAME_W = 2688;
const FRAME_H = 1520;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};

// Reveal beats. Lagos leads, Abuja follows, then the billboard + bridge come in
// together as the final beat (they share the same window).
const LANDMARKS = [
  { id: "lagos", d: LAGOS, rule: "nonzero", win: [0.0, 0.2] },
  { id: "abuja", d: ABUJA, rule: "nonzero", win: [0.2, 0.4] },
  { id: "bill", d: BILLBOARD, rule: "nonzero", win: [0.4, 0.6] },
  { id: "bridge", d: BRIDGE, rule: "evenodd", win: [0.4, 0.6] },
] as const;

export default function CityReveal({
  progress,
  className,
}: {
  progress: number;
  className?: string;
}) {
  const p = clamp01(progress);
  const full = smooth(seg(p, 0.62, 0.82)); // the actual photo materialises

  return (
    <svg
      viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {LANDMARKS.map((m) => (
          <clipPath id={`cr-${m.id}`} key={m.id}>
            <path d={m.d} clipRule={m.rule} />
          </clipPath>
        ))}
      </defs>

      {/* each landmark's slice of the photo FOCUSES IN — starts soft/blurred and
          fades up, resolving to sharp over its window, clipped to its hard-edged
          shape. Hidden once the full photo covers everything (perf). */}
      {full < 1
        ? LANDMARKS.map((m) => {
            const t = seg(p, m.win[0], m.win[1]);
            if (t <= 0) return null;
            const e = smooth(t); // gentle ease — slow, not abrupt
            return (
              <g
                key={m.id}
                clipPath={`url(#cr-${m.id})`}
                style={{
                  // fade up while the content blur clears (26 user units → 0).
                  opacity: e,
                  filter: `blur(${((1 - e) * 26).toFixed(2)}px)`,
                  willChange: "filter, opacity",
                }}
              >
                <image href={IMG} x="0" y="0" width={FRAME_W} height={FRAME_H} />
              </g>
            );
          })
        : null}

      {/* the actual full photo materialises over the windows */}
      {full > 0 ? (
        <image href={IMG} x="0" y="0" width={FRAME_W} height={FRAME_H} style={{ opacity: full }} />
      ) : null}
    </svg>
  );
}
