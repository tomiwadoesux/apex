"use client";

import dynamic from "next/dynamic";
import { useState, useRef, ComponentType, useEffect } from "react";
import type { Mode, LensType } from "@/components/car/CarStage";
import MiniMap from "@/components/MiniMap";
import Logo from "@/components/Logo"; // flat SVG brand mark (top-left lockup)
import ServicesBento from "@/components/ServicesBento"; // services section (bento grid) below the hero
import { useReducedMotion } from "@/components/useReducedMotion";

// WebGL / three.js is browser-only — skip prerendering, like the /car page does.
const CarStage = dynamic(() => import("@/components/car/CarStage"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
      Loading…
    </div>
  ),
});

// Live camera-pose tuner (dev panel) — only loaded/shown when the URL hash
// contains "tune" (e.g. /#tune), so normal visitors never see or download it.
const CameraTuner = dynamic(() => import("@/components/car/CameraTuner"), {
  ssr: false,
});

// The scroll tour is just empty full-bleed sections that act as scroll distance
// for the single camera move (resting side view → the low "bottom angle" in
// CarStage). No cards: the car IS the content.
const TOUR_STOPS = 7; // scroll length — one stop per service bento (6) + a little settle

// Tour-progress points where the theme inverts AGAIN, on top of the initial
// hero→content flip. The tour has 7 bands (6 services + footer), so each owns a
// 1/7-wide band; the morph for service `i` peaks at (i + 0.825)/7. So the theme
// flips midway through Wedding(1)→Corporate(2) and midway through
// CityTours(4)→Executive(5). Each crossing toggles light↔dark.
const THEME_FLIP_POINTS = [1.825 / 7, 4.825 / 7]; // ≈ 0.261, 0.689 (7 bands: 6 services + footer)

// page backdrop: studio style vignette spotlights centered behind the car stage
const BG_GRADIENT: Record<Mode, string> = {
  light:
    "radial-gradient(120% 120% at 50% 50%, #e2e8f0 0%, #cbd5e1 60%, #94a3b8 100%)",
  dark: "radial-gradient(120% 120% at 50% 42%, #2b2b31 0%, #1c1c20 60%, #101012 100%)",
};

// headlamp reflector path (lamp body only)
const HEADLAMP_BODY =
  "M31.875 1.875C37.7083 2.29167 49.375 7.5 49.375 19.375C49.375 31.25 37.7083 36.4583 31.875 36.875C27.5 36.875 25.625 34.75 25.625 26.25L25.625 12.5C25.625 4 27.5 1.875 31.875 1.875Z";
// the four projecting beams
const HEADLAMP_BEAMS =
  "M17.5 8.125L1.875 8.125M17.5 15.625L1.875 15.625M17.5 23.125L1.875 23.125M17.5 30.625L1.875 30.625";

// headlamp with beams = "lights on" → light mode
function HeadlampOnIcon() {
  return (
    <svg
      width="22"
      height="16"
      viewBox="0 0 52 39"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={`${HEADLAMP_BEAMS} ${HEADLAMP_BODY}`} />
    </svg>
  );
}

// same lamp, beams off → dark mode (centered since the beams are gone)
function HeadlampOffIcon() {
  return (
    <svg
      width="22"
      height="16"
      viewBox="0 0 52 39"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path transform="translate(-11.5 0)" d={HEADLAMP_BODY} />
    </svg>
  );
}

// --- Solid Filled Icon Pack (reminiscent of Lucide/shadcn solid filled styles) ---
function MailIconSolid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

// A road in perspective with its centre lane-markings streaming downward — the
// driving-forward POV reads as "scroll" without resorting to a literal car. The
// top fades into the vanishing point so the lane recedes. `dur` sets the flow
// speed (faster on hover). Strokes are currentColor so they pick up the hover
// colour from the parent.
function ScrollRoadIcon({ dur = "2.6s" }: { dur?: string }) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 28" fill="none" aria-hidden="true">
      {/* travel = one dash period (3 + 9 = 12) so the loop is seamless */}
      <style>{`@keyframes road-flow{to{stroke-dashoffset:-12}}`}</style>
      <defs>
        <linearGradient id="scrollroad-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="scrollroad-mask">
          <rect x="0" y="0" width="22" height="28" fill="url(#scrollroad-fade)" />
        </mask>
      </defs>
      <g mask="url(#scrollroad-mask)" stroke="currentColor" strokeLinecap="round">
        {/* converging road edges (vanishing point up top) — accent tone */}
        <path d="M2.5 27 L8.5 2" stroke="var(--accent)" strokeWidth="1.4" opacity="0.5" />
        <path d="M19.5 27 L13.5 2" stroke="var(--accent)" strokeWidth="1.4" opacity="0.5" />
        {/* centre lane markings, flowing toward the viewer */}
        <path
          d="M11 2 L11 27"
          strokeWidth="2"
          strokeDasharray="3 9"
          style={{ animation: `road-flow ${dur} linear infinite` }}
        />
      </g>
    </svg>
  );
}

// Option B — a tachometer whose needle sweeps up and back.
function TachometerIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <style>{`@keyframes tach-needle{0%,100%{transform:rotate(-55deg)}50%{transform:rotate(55deg)}}`}</style>
      <path
        d="M4 19 A10 10 0 1 1 22 19"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 100%",
          animation: "tach-needle 2.6s ease-in-out infinite",
        }}
      >
        <line x1="13" y1="18" x2="13" y2="8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <circle cx="13" cy="18" r="1.7" fill="currentColor" />
    </svg>
  );
}

// Option C — a gear-stick knob that drops down through its gate.
function GearShiftIcon() {
  return (
    <svg width="20" height="26" viewBox="0 0 20 26" fill="none" aria-hidden="true">
      <style>{`@keyframes gear-drop{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}`}</style>
      <line x1="10" y1="5" x2="10" y2="21" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: "gear-drop 2.6s ease-in-out infinite",
        }}
      >
        <line x1="10" y1="8" x2="10" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="7" r="3.2" fill="currentColor" />
      </g>
    </svg>
  );
}

// Option D — three down-chevrons fading in sequence.
function ChevronsIcon() {
  return (
    <svg width="20" height="26" viewBox="0 0 20 26" fill="none" aria-hidden="true">
      <style>{`@keyframes chev-fade{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 5 L10 9 L15 5" style={{ animation: "chev-fade 2.2s ease-in-out infinite" }} />
        <path d="M5 11 L10 15 L15 11" style={{ animation: "chev-fade 2.2s ease-in-out infinite 0.26s" }} />
        <path d="M5 17 L10 21 L15 17" style={{ animation: "chev-fade 2.2s ease-in-out infinite 0.52s" }} />
      </g>
    </svg>
  );
}

// Option E — a steering wheel that turns gently back and forth.
function SteeringWheelSpinIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <style>{`@keyframes wheel-turn{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(16deg)}}`}</style>
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: "wheel-turn 3.2s ease-in-out infinite",
        }}
      >
        <circle cx="13" cy="13" r="10" />
        <line x1="13" y1="13" x2="13" y2="3.5" stroke="var(--accent)" opacity="0.55" />
        <line x1="13" y1="13" x2="5" y2="18" stroke="var(--accent)" opacity="0.55" />
        <line x1="13" y1="13" x2="21" y2="18" stroke="var(--accent)" opacity="0.55" />
        <circle cx="13" cy="13" r="2.4" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

// Option F — a piston pumping up and down in its cylinder.
function PistonIcon() {
  return (
    <svg width="20" height="26" viewBox="0 0 20 26" fill="none" aria-hidden="true">
      <style>{`@keyframes piston-pump{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}`}</style>
      <rect x="5" y="3" width="10" height="13" rx="2" stroke="var(--accent)" strokeWidth="1.4" opacity="0.55" />
      <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "piston-pump 2s ease-in-out infinite" }}>
        <rect x="5.6" y="6" width="8.8" height="3.4" rx="1.2" fill="currentColor" />
        <line x1="10" y1="9" x2="10" y2="21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <circle cx="10" cy="22" r="1.7" fill="currentColor" />
    </svg>
  );
}

// Option H — a brake rotor spinning behind a static caliper.
function DiscBrakeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <style>{`@keyframes rotor-spin{to{transform:rotate(360deg)}}`}</style>
      <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "rotor-spin 3.8s linear infinite" }}>
        <circle cx="13" cy="13" r="9" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="13" cy="13" r="3" fill="currentColor" />
        {Array.from({ length: 6 }).map((_, k) => {
          const a = (k * 60 * Math.PI) / 180;
          return <circle key={k} cx={13 + 6 * Math.cos(a)} cy={13 + 6 * Math.sin(a)} r="0.9" fill="currentColor" />;
        })}
      </g>
      <path d="M19.5 8.5 a2 4 0 0 1 0 9" fill="var(--accent)" opacity="0.6" />
    </svg>
  );
}

// Option I — a coil spring compressing and releasing.
function SpringIcon() {
  return (
    <svg width="20" height="26" viewBox="0 0 20 26" fill="none" aria-hidden="true">
      <style>{`@keyframes spring-bounce{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.7)}}`}</style>
      {/* bottom mount — fixed to the ground */}
      <line x1="4" y1="22" x2="16" y2="22" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      {/* the coil AND its top mount compress together (origin = bottom) so the
          top cap rides the spring up and down */}
      <g style={{ transformBox: "fill-box", transformOrigin: "bottom", animation: "spring-bounce 1.8s ease-in-out infinite" }}>
        <line x1="4" y1="3" x2="16" y2="3" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        <path
          d="M5 4 L15 6 L5 9 L15 11 L5 14 L15 16 L5 19 L15 21"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

// Option J — a windshield wiper sweeping back and forth.
function WiperIcon() {
  return (
    <svg width="26" height="24" viewBox="0 0 26 24" fill="none" aria-hidden="true">
      <style>{`@keyframes wiper-sweep{0%{transform:rotate(-38deg)}50%{transform:rotate(22deg)}100%{transform:rotate(-38deg)}}`}</style>
      <path d="M3 21 A18 18 0 0 1 23 21" stroke="var(--accent)" strokeWidth="1.3" opacity="0.55" />
      <g style={{ transformBox: "fill-box", transformOrigin: "50% 100%", animation: "wiper-sweep 3s ease-in-out infinite" }}>
        <line x1="13" y1="22" x2="13" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <circle cx="13" cy="22" r="1.6" fill="currentColor" />
    </svg>
  );
}

// The pool of car-themed scroll-cue glyphs. One is picked at random on each
// landing-page load (see ScrollHint).
const SCROLL_ICON_LIST = [
  ScrollRoadIcon,
  TachometerIcon,
  GearShiftIcon,
  ChevronsIcon,
  SteeringWheelSpinIcon,
  PistonIcon,
  DiscBrakeIcon,
  SpringIcon,
  WiperIcon,
];

// Hero scroll cue beside the CTA: "See our services" + a RANDOM car-themed glyph
// (different on every load). Two-tone — black/white text & moving parts, accent
// structural parts (via --accent). Clicking smooth-scrolls down a viewport.
function ScrollHint({ isLight }: { isLight: boolean }) {
  const main = isLight ? "#0c0c0e" : "#ffffff";
  const acc = isLight ? "#2A4FD0" : "#FDBA16";
  const [hovered, setHovered] = useState(false);
  // Pick the icon AFTER mount (random on the server/first render would mismatch
  // hydration). `idx === null` until then, so NO icon renders on the first paint
  // — instead of flashing the default — and the chosen one fades in once picked.
  const [idx, setIdx] = useState<number | null>(null);
  useEffect(() => {
    setIdx(Math.floor(Math.random() * SCROLL_ICON_LIST.length));
  }, []);
  const Icon = idx === null ? null : SCROLL_ICON_LIST[idx];
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() =>
        document
          .getElementById("services")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className="pointer-events-auto text-sm font-medium tracking-wide transition-colors duration-300"
      style={{ color: hovered ? acc : main, ["--accent" as string]: acc }}
    >
      {/* one underlined unit: the label AND the icon share a single bottom rule */}
      <span
        className="flex items-center gap-2 border-b pb-1"
        style={{ borderColor: "currentColor" }}
      >
        Scroll to see our services
        {/* fixed-width slot reserves space so the line doesn't shift when the
            icon fades in (the glyphs vary 20–26px wide) */}
        <span
          className="flex h-[24px] w-[24px] items-center justify-center transition-opacity duration-300"
          style={{ opacity: Icon ? 1 : 0 }}
        >
          {Icon ? <Icon /> : null}
        </span>
      </span>
    </button>
  );
}

// --- Pill Button Layout Components & Reactive Hover Fill ---
interface AccentPair {
  light: string;
  dark: string;
}
interface PillButtonItem {
  label: string;
  href: string;
  Icon?: ComponentType<{ className?: string }>;
  /** Override the hover accent (fill + text). Defaults to the mode's brand colour. */
  accent?: AccentPair;
  /** Fires alongside navigation — used to nudge the 3D logo on "Contact". */
  onClick?: () => void;
}

// #rrggbb → rgba() so we can vary alpha for the gradient stops.
function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function PillButton({
  item,
  isLight,
  isFirst,
  isLast,
  total,
}: {
  item: PillButtonItem;
  isLight: boolean;
  isFirst: boolean;
  isLast: boolean;
  total: number;
}) {
  const { Icon, label, href, accent, onClick } = item;
  const [hovered, setHovered] = useState(false);

  // accent for this button + mode (Book Now forces yellow via its own pair)
  const acc = accent
    ? isLight
      ? accent.light
      : accent.dark
    : isLight
      ? "#00209C"
      : "#FDBA16";
  const baseText = isLight ? "#171717" : "#ffffff";

  // Border / padding depending on position inside the group
  const borderStyle =
    total === 1
      ? "rounded-full px-6"
      : `${isFirst ? "rounded-l-full pl-6 pr-4" : ""} ${
          isLast ? "rounded-r-full pr-6 pl-4" : ""
        } ${!isFirst && !isLast ? "px-4" : ""}`;

  // The fill sweeps in from the OUTER edge of each button and its gradient is
  // weighted toward the shared CENTRE: left button strong on its right edge,
  // right button strong on its left edge — so colour converges where they meet.
  const faint = rgba(acc, 0.04);
  const strong = rgba(acc, 0.22);
  let origin = "center";
  let gradient = `linear-gradient(to right, ${faint} 0%, ${strong} 50%, ${faint} 100%)`;
  if (total > 1 && isFirst) {
    origin = "left";
    gradient = `linear-gradient(to right, ${faint} 0%, ${strong} 100%)`;
  } else if (total > 1 && isLast) {
    origin = "right";
    gradient = `linear-gradient(to right, ${strong} 0%, ${faint} 100%)`;
  } else if (total > 1) {
    gradient = `linear-gradient(to right, ${faint} 0%, ${strong} 50%, ${faint} 100%)`;
  }

  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex-1 flex items-center justify-center h-full overflow-hidden text-xs font-semibold tracking-wider ${borderStyle}`}
      style={{ color: hovered ? acc : baseText, transition: "color 300ms ease" }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: gradient,
          transformOrigin: origin,
          transform: hovered ? "scaleX(1)" : "scaleX(0)",
          transition: "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
      <span className="relative z-10 flex items-center gap-2.5">
        {Icon ? <Icon /> : null}
        {label}
      </span>
    </a>
  );
}

function PillButtonGroup({
  items,
  isLight,
  className = "",
}: {
  items: PillButtonItem[];
  isLight: boolean;
  className?: string;
}) {
  // If 1 item is passed, render a single compact button. Otherwise render split group container (w-80).
  const widthStyle = items.length === 1 ? "w-40" : "w-80";

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between rounded-full border transition-all duration-300 h-11 ${widthStyle} ${
        isLight
          ? "border-neutral-900/40 bg-transparent"
          : "border-white/30 bg-transparent"
      } ${className}`}
    >
      {items.map((item, idx) => (
        <div key={item.label} className="flex-1 flex items-center h-full">
          {idx > 0 && (
            <span className={`h-5 w-[1px] ${isLight ? "bg-neutral-900/20" : "bg-white/20"}`} />
          )}
          <PillButton
            item={item}
            isLight={isLight}
            isFirst={idx === 0}
            isLast={idx === items.length - 1}
            total={items.length}
          />
        </div>
      ))}
    </div>
  );
}

// The hero headline: each word starts LYING on the floor (rotateX 90°, hinged on
// its bottom edge under CSS perspective) and stands up to vertical, staggered
// left → right, the instant `reveal` flips. At rest it's a plain flat heading.
function StandUpHeadline({
  text,
  reveal,
  className,
}: {
  text: string;
  reveal: boolean;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <h1 className={className} style={{ perspective: "640px" }}>
      {words.map((w, i) => (
        <span key={i} style={{ display: "inline-block", whiteSpace: "pre" }}>
          <span
            style={{
              display: "inline-block",
              transformOrigin: "bottom center",
              transform: reveal ? "rotateX(0deg)" : "rotateX(90deg)",
              opacity: reveal ? 1 : 0,
              transition: `transform 720ms cubic-bezier(0.2,0.75,0.25,1) ${i * 95}ms, opacity 460ms ease-out ${i * 95}ms`,
              willChange: "transform, opacity",
            }}
          >
            {w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </h1>
  );
}

// Client voices shown in the footer reveal — kept short so three cards stack
// cleanly on mobile and sit in a row on desktop. Just a name and a message.
const TESTIMONIALS = [
  {
    name: "Adeola Balogun",
    message:
      "Spotless cars and a chauffeur who made the airport run effortless. The only service I trust in Lagos now.",
  },
  {
    name: "Chidi Okeke",
    message:
      "Booked the fleet for our wedding — every car arrived early, beautifully styled, and the drivers were impeccable.",
  },
  {
    name: "Funke Adeyemi",
    message:
      "Discreet, professional and always on time for my corporate travel. Genuinely a class above the rest.",
  },
];

// A single testimonial — a frosted-glass card themed to the current mode. Just a
// name and message, dressed up: a soft accent glow + oversized watermark quote in
// the corner, a gradient monogram avatar, a hairline divider, and a hover lift.
function TestimonialCard({
  name,
  message,
  isLight,
}: {
  name: string;
  message: string;
  isLight: boolean;
}) {
  const accent = isLight ? "#2A4FD0" : "#FDBA16";
  // monogram from the first + last name initials (e.g. "Adeola Balogun" → "AB")
  const words = name.trim().split(/\s+/);
  const initials = (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
  return (
    <figure
      className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border p-6 text-left transition-[transform,box-shadow] duration-300 ease-out sm:hover:-translate-y-1.5"
      style={{
        background: isLight
          ? "linear-gradient(155deg, rgba(255,255,255,0.92) 0%, rgba(235,241,249,0.74) 100%)"
          : "linear-gradient(155deg, rgba(40,44,55,0.78) 0%, rgba(14,16,22,0.6) 100%)",
        borderColor: isLight ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.14)",
        backdropFilter: "blur(26px) saturate(165%)",
        WebkitBackdropFilter: "blur(26px) saturate(165%)",
        boxShadow: isLight
          ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 56px rgba(15,23,42,0.12)"
          : "inset 0 1px 0 rgba(255,255,255,0.1), 0 22px 64px rgba(0,0,0,0.34)",
      }}
    >
      {/* oversized watermark quotation mark */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-5 top-1 font-serif text-[5.5rem] leading-none"
        style={{ color: accent, opacity: isLight ? 0.09 : 0.13 }}
      >
        &rdquo;
      </span>

      <blockquote
        className={`relative flex-1 text-[14px] leading-[1.65] ${
          isLight ? "text-neutral-700" : "text-white/80"
        }`}
      >
        {message}
      </blockquote>

      {/* hairline divider, fading out to the right */}
      <div
        aria-hidden
        className="relative my-5 h-px w-full"
        style={{
          background: isLight
            ? "linear-gradient(to right, rgba(15,23,42,0.14), transparent)"
            : "linear-gradient(to right, rgba(255,255,255,0.18), transparent)",
        }}
      />

      <figcaption className="relative flex items-center gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-bold tracking-wide"
          style={{
            background: `linear-gradient(145deg, ${accent}, color-mix(in srgb, ${accent} 58%, ${
              isLight ? "#ffffff" : "#000000"
            }))`,
            color: isLight ? "#ffffff" : "#16161a",
          }}
        >
          {initials}
        </span>
        <span
          className={`text-[15px] font-semibold tracking-tight ${
            isLight ? "text-neutral-900" : "text-white"
          }`}
        >
          {name}
        </span>
      </figcaption>
    </figure>
  );
}

// A round glass arrow that pages the testimonial row. Dims + disables itself when
// there's nothing further to scroll in that direction.
function CarouselArrow({
  dir,
  onClick,
  disabled,
  isLight,
}: {
  dir: -1 | 1;
  onClick: () => void;
  disabled: boolean;
  isLight: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "Previous testimonials" : "Next testimonials"}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border backdrop-blur-md transition-all duration-200 disabled:cursor-default disabled:opacity-25 ${
        isLight
          ? "border-neutral-900/15 bg-white/60 text-neutral-900 hover:border-neutral-900/30 hover:bg-white"
          : "border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/15"
      }`}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dir === -1 ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

// The footer testimonials: a centred label, then prev/next arrows flanking a
// snap-scrolling card row (swipe on mobile, all three in view on desktop). Each
// card rises out of a 3D recline + side-fan when the footer band arrives.
function TestimonialsCarousel({
  isLight,
  atFooter,
}: {
  isLight: boolean;
  atFooter: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const page = (dir: number) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const sub = isLight ? "text-neutral-500" : "text-white/55";

  return (
    <div
      className="w-full max-w-5xl"
      style={{
        opacity: atFooter ? 1 : 0,
        transition: "opacity 500ms ease-out 120ms",
      }}
    >
      <p
        className={`mb-6 text-center text-xs font-semibold uppercase tracking-[0.22em] ${sub}`}
      >
        What our clients say
      </p>
      <div
        className="flex items-center gap-3 sm:gap-6"
        style={{ pointerEvents: atFooter ? "auto" : "none" }}
      >
        <CarouselArrow dir={-1} disabled={!canLeft} onClick={() => page(-1)} isLight={isLight} />
        <div
          ref={scrollRef}
          className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
          style={{ perspective: "1100px", perspectiveOrigin: "center" }}
        >
          {TESTIMONIALS.map((t, i) => {
            // -1 (left) … 0 (centre) … +1 (right): drives the fan direction.
            const offset = i - (TESTIMONIALS.length - 1) / 2;
            return (
              <div
                key={t.name}
                className="min-w-[82%] shrink-0 snap-center sm:min-w-0 sm:flex-1"
                style={{
                  opacity: atFooter ? 1 : 0,
                  // rotateX = the recline standing up (hinged at the bottom);
                  // rotateY = the per-side fan; settles flat. Same delay for every
                  // card → they all rise together.
                  transform: atFooter
                    ? "none"
                    : `rotateX(48deg) rotateY(${offset * 30}deg) translateY(26px)`,
                  transformOrigin: "center bottom",
                  transition:
                    "opacity 600ms ease-out 150ms, transform 800ms cubic-bezier(0.22, 1, 0.36, 1) 150ms",
                  willChange: "transform, opacity",
                }}
              >
                <TestimonialCard name={t.name} message={t.message} isLight={isLight} />
              </div>
            );
          })}
        </div>
        <CarouselArrow dir={1} disabled={!canRight} onClick={() => page(1)} isLight={isLight} />
      </div>
    </div>
  );
}

export default function Home() {
  // the theme the HERO (top of page) shows. The toggle button flips this; the
  // scrolled content always shows the OPPOSITE (see derived `mode` below).
  const [heroMode, setHeroMode] = useState<Mode>("light");
  // true once the visitor has scrolled into the services tour (fades the MiniMap)
  const [scrolled, setScrolled] = useState(false);
  // true the moment scrolling STARTS — gates the car reveal + first theme flip
  const [heroHidden, setHeroHidden] = useState(false);
  // hero text lingers a little, THEN blurs out — set once the visitor scrolls
  // past a short distance (not the instant they scroll, like heroHidden).
  const [heroTextGone, setHeroTextGone] = useState(false);
  // the live 3D has finished loading (kept hidden behind the poster until scroll)
  const [carLoaded, setCarLoaded] = useState(false);
  // how many theme-flip boundaries the scroll has crossed: 1 for hero→content,
  // then +1 at each THEME_FLIP_POINT. Its parity drives the light↔dark inversion.
  const [flipCount, setFlipCount] = useState(0);
  // true in the final FOOTER band of the tour (the top-of-car shot) — fades in the
  // "Book with us" footer over the car.
  const [atFooter, setAtFooter] = useState(false);
  // reveal the car + flip to dark: true once the 3D has loaded AND the visitor
  // starts scrolling — until then the light-mode poster just stays put.
  const [carReady, setCarReady] = useState(false);
  const tourRef = useRef<HTMLDivElement>(null);
  // 0..1 progress through the tour — a mutable ref read by the 3D frame loop,
  // so scrolling never re-renders React
  const tourProgress = useRef(0);
  const heroTextRef = useRef<HTMLDivElement>(null);
  // Displayed theme: the hero shows `heroMode`; once the car is revealed, every
  // theme-flip boundary the scroll has crossed inverts it again. So the site goes
  // light → dark (into the content) → light (Corporate…) → dark (Executive), and
  // the toggle (which sets `heroMode`) swaps the whole relationship.
  const oppositeMode = (m: Mode): Mode => (m === "light" ? "dark" : "light");
  const inverted = carReady && flipCount % 2 === 1;
  const mode: Mode = inverted ? oppositeMode(heroMode) : heroMode;
  const isLight = mode === "light";
  // Toggle handler: make the CURRENTLY shown section the clicked theme by setting
  // heroMode (undoing the inversion when scrolled), so the other section flips too.
  const setDisplayedMode = (target: Mode) =>
    setHeroMode(inverted ? oppositeMode(target) : target);
  const reduced = useReducedMotion();

  // Intro: only the hero TEXT animates now. The poster paints immediately (light
  // mode) and just STAYS — the 3D loads silently behind it but nothing changes
  // until the visitor scrolls. No logo flight, no blur veil.
  const [posterIn, setPosterIn] = useState(false); // car poster eases in
  const [reveal, setReveal] = useState(false); // headline stands up (text animation)

  // Camera tuner (dev): lens state it drives, shown only when the URL hash has
  // "tune". Use it to position the footer top-of-car pose (pose index 6), then
  // paste the printed line back into cameraTuning.ts.
  const [lens, setLens] = useState<LensType>("perspective");
  const [fisheyeZoom, setFisheyeZoom] = useState(0.5);
  const [showTuner, setShowTuner] = useState(false);
  useEffect(() => {
    const check = () => setShowTuner(window.location.hash.includes("tune"));
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  useEffect(() => {
    if (reduced) {
      setPosterIn(true);
      setReveal(true);
      return;
    }
    const raf = requestAnimationFrame(() => setPosterIn(true));
    const t1 = setTimeout(() => setReveal(true), 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
    };
  }, [reduced]);

  // First scroll (once the 3D has loaded) reveals the car — latched, so the
  // poster never returns. The actual light↔dark inversion as you scroll is
  // handled by the derived `mode` above; this only trips the reveal latch.
  useEffect(() => {
    if (carLoaded && heroHidden && !carReady) setCarReady(true);
  }, [carLoaded, heroHidden, carReady]);
  // fade-in style with a stagger delay (ms)
  const revealStyle = (delay: number) => ({
    opacity: reveal ? 1 : 0,
    transition: `opacity 420ms ease-out ${delay}ms`,
  });

  // feed scroll position into the camera tour
  useEffect(() => {
    const onScroll = () => {
      const vh = window.innerHeight;
      const scrollY = window.scrollY;
      setScrolled(scrollY > vh * 0.3);
      setHeroHidden(scrollY > 8); // any real scroll arms the reveal + first flip
      setHeroTextGone(scrollY > vh * 0.25); // text lingers ~a quarter-screen, then blurs out

      const el = tourRef.current;
      if (!el) return;
      // The hero, backdrop and car canvas are all position:fixed (out of flow),
      // so this tour container sits at offsetTop ≈ 0 and provides ALL the scroll
      // distance. Map scrollY = 0 → progress 0 (the parked side view "hero"), and
      // the final scroll position → progress 1. Using `offsetTop - vh` here would
      // make the top of the page already read as ~13% into the tour and snap the
      // camera to the first pose before any scrolling.
      const start = el.offsetTop;
      const end = el.offsetTop + el.offsetHeight - vh;
      // linear progress → every camera move between car framings takes the same
      // scroll distance (uniform tour; no section held longer than another).
      const p = Math.min(
        1,
        Math.max(0, (window.scrollY - start) / Math.max(1, end - start)),
      );
      tourProgress.current = p;

      // count the theme-flip boundaries crossed: hero→content (any scroll), then
      // each THEME_FLIP_POINT. Parity of this drives the light↔dark inversion.
      let flips = scrollY > 8 ? 1 : 0;
      for (const thr of THEME_FLIP_POINTS) if (p >= thr) flips++;
      setFlipCount(flips);
      // the FOOTER band is the last of the 7 tour bands (6 services + footer)
      setAtFooter(p >= 6 / 7);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const heading = isLight ? "text-neutral-900" : "text-white";
  const sub = isLight ? "text-neutral-500" : "text-white/55";

  return (
    <main className="relative w-full">
      {/* fixed studio backdrop. The LIGHT gradient is always painted as the base;
          the DARK gradient sits on top and simply CROSS-FADES in/out by opacity
          (no circle wipe) so switching themes is a clean, even fade. */}
      <div className="fixed inset-0 z-0" style={{ background: BG_GRADIENT.light }} />
      <div
        className="fixed inset-0 z-0 transition-opacity duration-700 ease-out"
        style={{
          background: BG_GRADIENT.dark,
          opacity: isLight ? 0 : 1,
        }}
      />

      {/* the same car from /car, recolored by mode — PINNED full-screen behind
          the page so the scroll tour can move the CAMERA while content scrolls
          past. Fixed at top-0 (no scroll-triggered shift) so the car never jumps
          when scrolling starts — only the camera moves. */}
      <div className="fixed inset-x-0 top-0 z-[1] w-full h-dvh">
        {/* Lightweight per-mode poster of the first frame: paints instantly while
            the 3D loads, then cross-fades OUT as the live car eases in over it. It
            sits UNDERNEATH the canvas and matches it pixel-for-pixel, so the fade
            never exposes the bare background. Keyed to the displayed mode so it
            still matches if the visitor flips the hero theme before scrolling. */}
        <picture
          className="pointer-events-none absolute inset-0 block h-full w-full transition-opacity duration-500 ease-out"
          style={{ opacity: carReady ? 0 : posterIn ? 1 : 0 }}
        >
          <source
            media="(max-width: 639px)"
            srcSet={isLight ? "/images/car-poster-light-mobile.webp" : "/images/car-poster-dark-mobile.webp"}
          />
          <source
            media="(max-width: 1023px)"
            srcSet={isLight ? "/images/car-poster-light-tablet.webp" : "/images/car-poster-dark-tablet.webp"}
          />
          <img
            src={isLight ? "/images/car-poster-light.webp" : "/images/car-poster-dark.webp"}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        </picture>
        {/* the live 3D, stacked ON TOP and eased in from 0 → full opacity the
            moment it's ready. As it loads the site flips light → dark, so the car
            materialises in as the whole scene transitions to dark mode. */}
        <div
          className="absolute inset-0 transition-opacity duration-300 ease-out"
          style={{ opacity: carReady ? 1 : 0 }}
        >
          <CarStage
            mode={mode}
            fit={1.7}
            transparent
            tourProgress={tourProgress}
            staticView
            lens={lens}
            fisheyeZoom={fisheyeZoom}
            onLoaded={() => setCarLoaded(true)}
          />
        </div>
      </div>

      {/* dev camera tuner — only when the URL hash has "tune" (e.g. /#tune). Select
          pose 6 + Freeze to position the footer top-of-car shot, then paste the
          printed line back into cameraTuning.ts. */}
      {showTuner && (
        <CameraTuner
          lens={lens}
          onLens={setLens}
          fisheyeZoom={fisheyeZoom}
          onFisheyeZoom={setFisheyeZoom}
        />
      )}

      {/* Mini self-driving maps dashboard widget, bottom left — hero only.
          Outer wrapper handles the intro fade-in; inner the scroll fade-out. */}
      <div style={revealStyle(300)}>
        <div
          className={`transition-opacity duration-500 ${scrolled ? "opacity-0" : "opacity-100"}`}
          style={scrolled ? { pointerEvents: "none" } : undefined}
        >
          <MiniMap mode={mode} paused={scrolled} />
        </div>
      </div>

      {/* brand lockup — pinned top-left. At the footer the ACTUAL mark slides from
          this corner to screen centre and scales up 1.8× (one real element, fully
          visible, so you watch it travel). Origin top-left keeps the maths simple:
          translateX centres it (90% = scaled half-width), translateY drops the top
          to 13vh. No sm:left-10 so the centring stays exact across breakpoints. */}
      <div
        className={`pointer-events-none fixed left-5 top-5 z-30 flex items-center gap-2.5 ${heading}`}
        style={{
          transform: atFooter
            ? "translateX(calc(50vw - 1.25rem - 90%)) translateY(calc(13vh - 1.25rem)) scale(1.8)"
            : "none",
          transformOrigin: "left top",
          transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <Logo
          size={32}
          color={isLight ? "#000000" : "#ffffff"}
          accent={isLight ? "#2A4FD0" : "#FDBA16"}
        />
        <h4 className="text-sm font-bold uppercase tracking-[0.08em]">
          Apex
          <span
            className="font-semibold"
            style={{ color: isLight ? "#2A4FD0" : "#FDBA16" }}
          >
            Ride
          </span>
        </h4>
      </div>

      {/* Contact action — pinned top-right. At the footer the ACTUAL button slides
          from this corner down to centre-bottom (mirroring the logo sliding from
          the left), landing below the testimonials. Origin top-right; translateX
          centres it, translateY drops the top to 84vh. No sm:right-10 so the
          centring stays exact. */}
      <div
        style={{
          opacity: reveal ? 1 : 0,
          transform: atFooter
            ? "translateX(calc(1.25rem + 50% - 50vw)) translateY(calc(84vh - 1.25rem))"
            : "none",
          transformOrigin: "top right",
          transition:
            "transform 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease-out",
        }}
        className="pointer-events-none fixed right-5 top-5 z-30"
      >
        <PillButtonGroup
          isLight={isLight}
          items={[
            {
              label: "Contact Us",
              href: "mailto:contact@apexride.com",
              Icon: MailIconSolid,
            },
          ]}
        />
      </div>

      {/* Tesla-style hero overlay — sits BELOW the blur overlay (z-[8]) so the
          text reveals/sharpens as the blur lifts. Clicks pass through except on
          interactive bits. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[2] flex h-dvh flex-col">
        {/* headline near the top (top bar elements are fixed siblings above) */}
        <div
          ref={heroTextRef}
          className="flex flex-col items-center px-6 pt-20 text-center"
          style={{
            // lingers, then blurs + fades out as it leaves (the headline also
            // lies back down via `reveal` below — mirroring how it stood up in).
            opacity: heroTextGone ? 0 : 1,
            filter: heroTextGone ? "blur(12px)" : "blur(0px)",
            transition: "opacity 600ms ease, filter 600ms ease",
            pointerEvents: heroTextGone ? "none" : "auto",
          }}
        >
          <StandUpHeadline
            text="Ride & arrive in style."
            reveal={reveal && !heroTextGone}
            className={`mt-3 max-w-3xl text-4xl font-light tracking-tight first-letter:text-6xl first-letter:font-normal sm:text-5xl sm:first-letter:text-7xl ${heading}`}
          />
          <p
            style={revealStyle(160)}
            className={`mt-4 max-w-xl text-sm leading-relaxed sm:text-base ${sub}`}
          >
            ApexRide — executive transport across Lagos. Airport pickups, daily
            chauffeur service, and inter-state transit. Discreet, effortless, and
            always on time.
          </p>
          <div
            style={revealStyle(300)}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
          >
            <ScrollHint isLight={isLight} />
            <PillButtonGroup
              isLight={isLight}
              items={[
                {
                  label: "Book Now",
                  href: "/car",
                  accent: { light: "#FDBA16", dark: "#FDBA16" },
                },
              ]}
            />
          </div>
        </div>

        <div className="flex-1" />

        {/* empty footer to keep spacing clean */}
        <footer className="flex flex-col items-center px-6 pb-12" />

        {/* headlamp light / dark toggle, bottom right (glassmorphic sliding selector) */}
        <div
          style={revealStyle(300)}
          className={`pointer-events-auto fixed bottom-4 right-6 z-20 select-none`}
        >
          <div className={`relative flex rounded-full border p-1 shadow-lg backdrop-blur-md transition-all duration-300 ${
            isLight
              ? "border-neutral-900/15 bg-transparent shadow-neutral-900/5"
              : "border-white/10 bg-transparent shadow-black/40"
          }`}>
            {/* Sliding selector indicator — slides via transform (compositor-only)
                rather than animating `left` */}
            <div
              className={`absolute left-[4px] top-[4px] bottom-[4px] w-[calc(50%-4px)] rounded-full border transition-[transform,background-color,border-color] duration-300 ease-in-out ${
                isLight
                  ? "border-neutral-950 bg-white shadow-sm"
                  : "border-white bg-white/10 shadow-sm"
              }`}
              style={{ transform: isLight ? "translateX(0)" : "translateX(100%)" }}
            />
            <button
              onClick={() => setDisplayedMode("light")}
              aria-label="Headlights on — light mode"
              aria-pressed={isLight}
              className={`relative z-10 rounded-full p-2 transition-all duration-300 ${
                isLight ? "text-neutral-900" : "text-white/45 hover:text-white"
              }`}
            >
              <HeadlampOnIcon />
            </button>
            <button
              onClick={() => setDisplayedMode("dark")}
              aria-label="Headlights off — dark mode"
              aria-pressed={!isLight}
              className={`relative z-10 rounded-full p-2 transition-all duration-300 ${
                !isLight ? "text-white" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <HeadlampOffIcon />
            </button>
          </div>
        </div>
      </div>

      {/* service bento grids — one shows as the camera settles on each pose */}
      <ServicesBento isLight={isLight} tourProgress={tourProgress} />

      {/* Footer reveal — testimonials live in a reserved MIDDLE band (top/bottom
          24vh kept clear for the logo sliding to centre-top and the contact button
          sliding to centre-bottom). Each card rises out of a 3D recline (lying on
          its back → standing flat) and the row FANS: the left card swings in from
          the left, the right from the right, the centre straight up — and they all
          come up AT THE SAME TIME. Mobile: a swipeable snap-scroll row; desktop:
          a 3-up grid. */}
      <div className="pointer-events-none fixed inset-x-0 top-[24vh] bottom-[24vh] z-[6] flex items-center justify-center px-6">
        <TestimonialsCarousel isLight={isLight} atFooter={atFooter} />
      </div>

      {/* --- scroll tour: empty full-height sections, one per camera stop. Each is
          just scroll distance that advances the camera to its next framing of the
          car (poses live in CarStage); the matching service bento fades in. */}
      <div ref={tourRef} id="services" className="relative">
        {Array.from({ length: TOUR_STOPS }).map((_, i) => (
          // 154vh = 110vh × 1.4 → the whole tour scrolls 1.4× longer (slower)
          <section key={i} aria-hidden className="h-[154vh]" />
        ))}
      </div>
    </main>
  );
}
