"use client";

// CityReveal — the full-bleed backdrop photo, a pure function of `progress`
// (0 → 1). Since the hero cutout and this photo are now the SAME image
// (public/images/FORNT-BG.webp == FRONT.webp), the old landmark clip-window
// choreography is gone: the photo simply materialises under the hero as the
// dark overlay settles, and the hero cutout fades into it seamlessly.

const IMG = "/images/FORNT-BG.webp";
const FRAME_W = 2688;
const FRAME_H = 1520;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};

export default function CityReveal({
  progress,
  className,
}: {
  progress: number;
  className?: string;
}) {
  const p = clamp01(progress);
  const full = smooth(seg(p, 0.3, 0.82)); // the photo materialises

  return (
    <svg
      viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      {full > 0 ? (
        <image href={IMG} x="0" y="0" width={FRAME_W} height={FRAME_H} style={{ opacity: full }} />
      ) : null}
    </svg>
  );
}
