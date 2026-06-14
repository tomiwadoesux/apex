// The Apex mark — a navigation "delta" floating above a dot.
//
// One source of truth for the brand glyph. It's used in a few places with
// different treatments:
//   • <Logo animate="float" />            — branding badge on the map page
//   • <Logo animate="beat" /> / "pulse"   — loading / live indicators
//   • LOGO_PATHS                          — embedded raw into the map SVG as the
//                                            self-driving navigator marker
//
// The art lives in a 139×152 box. Forward (the pointy end) is "up" (−y), which
// is what the map marker relies on when it rotates the glyph to face travel.

import type { CSSProperties, SVGProps } from "react";

export const LOGO_VIEWBOX = "0 0 139 152";
export const LOGO_W = 139;
export const LOGO_H = 152;

// [0] = the navigation delta, [1] = the dot beneath it.
export const LOGO_PATHS = [
  "M66.7703 0C74.2372 0.18897 76.7497 3.24329 80.4577 9.45514C96.9025 37.0697 113.133 64.7208 129.466 92.4111C132.151 96.9622 139.831 108.081 138.677 113.593C138.253 115.617 136.012 120.237 134.195 120.71C116.289 125.374 88.0411 98.6954 72.0326 94.5106L71.1219 94.2792C53.5024 94.4998 25.6138 124.146 7.85784 122.039C5.40108 121.748 3.01758 120.715 1.57899 118.62C0.14955 116.539 -0.25924 113.594 0.151192 111.127C1.14272 105.174 52.8722 16.4895 59.8853 6.52736C61.8259 3.7719 64.0013 1.89386 66.7703 0Z",
  "M65.4483 103.057C78.6429 100.845 91.1706 109.627 93.5891 122.784C96.0076 135.941 87.4218 148.605 74.3037 151.23C65.6331 152.964 56.7001 149.891 50.9324 143.189C45.1639 136.487 43.4564 127.196 46.4643 118.882C49.4713 110.567 56.7276 104.518 65.4483 103.057Z",
] as const;

export type LogoAnimation =
  | "none"
  | "pulse" // breathing opacity — good for "live" / loading
  | "spin" // slow flat (2D) rotation
  | "spin3d" // 3D horizontal turntable spin (rotateY)
  | "float" // gentle vertical bob
  | "bob" // float + a little sway, like it's steering
  | "beat"; // heartbeat scale pop

// keyframes are namespaced so they never collide with app styles; injected once
// per animated instance (identical @keyframes blocks dedupe harmlessly).
const KEYFRAMES = `
@keyframes apexlogo-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes apexlogo-spin{to{transform:rotate(360deg)}}
@keyframes apexlogo-spin3d{from{transform:perspective(200px) rotateY(0deg)}to{transform:perspective(200px) rotateY(360deg)}}
@keyframes apexlogo-float{0%,100%{transform:translateY(4%)}50%{transform:translateY(-7%)}}
@keyframes apexlogo-bob{0%,100%{transform:translateY(3%) rotate(-5deg)}50%{transform:translateY(-6%) rotate(5deg)}}
@keyframes apexlogo-beat{0%,100%{transform:scale(1)}12%{transform:scale(1.14)}24%{transform:scale(.99)}36%{transform:scale(1.06)}50%{transform:scale(1)}}
`;

const DUR: Record<Exclude<LogoAnimation, "none">, string> = {
  pulse: "2.1s",
  spin: "9s",
  spin3d: "6s",
  float: "3.6s",
  bob: "2.6s",
  beat: "1.7s",
};
const EASE: Record<Exclude<LogoAnimation, "none">, string> = {
  pulse: "ease-in-out",
  spin: "linear",
  spin3d: "linear",
  float: "ease-in-out",
  bob: "ease-in-out",
  beat: "ease-out",
};

export type LogoProps = {
  /** Rendered height in px. Width follows the glyph's aspect ratio. */
  size?: number;
  /** Glyph color. Defaults to `currentColor` so it inherits CSS `color`. */
  color?: string;
  /** Optional separate color for the dot (defaults to `color`). */
  accent?: string;
  animate?: LogoAnimation;
  /** Override the animation duration, e.g. "4s". */
  duration?: string;
  /** Accessible label. When omitted the glyph is treated as decorative. */
  title?: string;
  className?: string;
  style?: CSSProperties;
} & Omit<SVGProps<SVGSVGElement>, "color" | "style">;

export default function Logo({
  size = 40,
  color = "#00209C",
  accent,
  animate = "none",
  duration,
  title,
  className,
  style,
  ...rest
}: LogoProps) {
  const animated = animate !== "none";
  const animStyle: CSSProperties = animated
    ? {
        animation: `apexlogo-${animate} ${duration ?? DUR[animate]} ${EASE[animate]} infinite`,
        transformBox: "fill-box",
        transformOrigin: "center",
        willChange: "transform, opacity",
      }
    : {};

  return (
    <svg
      width={(size * LOGO_W) / LOGO_H}
      height={size}
      viewBox={LOGO_VIEWBOX}
      fill="none"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ color, display: "block", overflow: "visible", ...style }}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {animated ? <style>{KEYFRAMES}</style> : null}
      <g style={animStyle}>
        <path d={LOGO_PATHS[0]} fill="currentColor" />
        <path d={LOGO_PATHS[1]} fill={accent ?? "currentColor"} />
      </g>
    </svg>
  );
}
