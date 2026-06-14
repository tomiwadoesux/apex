"use client";

import dynamic from "next/dynamic";
import { useState, useRef, ComponentType, useEffect } from "react";
import type { Mode } from "@/components/car/CarStage";
import MiniMap from "@/components/MiniMap";

// WebGL / three.js is browser-only — skip prerendering, like the /car page does.
const CarStage = dynamic(() => import("@/components/car/CarStage"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
      Loading…
    </div>
  ),
});

// the 3D brand mark for the top-left lockup (also WebGL — client only)
const Logo3D = dynamic(() => import("@/components/Logo3D"), {
  ssr: false,
  loading: () => <span style={{ display: "block", width: 34, height: 34 }} />,
});

// The scroll tour is a sequence of empty full-bleed sections — each one is just
// a scroll "trigger" that advances the camera to the next cool framing of the
// car (see the poses in CarStage). There are no cards: the car IS the content.
const TOUR_STOPS = 6; // must match the number of camera poses in CarStage

// page backdrop: studio style vignette spotlights centered behind the car stage
const BG_GRADIENT: Record<Mode, string> = {
  light:
    "radial-gradient(120% 120% at 50% 50%, #e2e8f0 0%, #cbd5e1 60%, #94a3b8 100%)",
  dark: "radial-gradient(120% 120% at 50% 50%, #1c1c1c 0%, #0a0a0a 60%, #020202 100%)",
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

// Automotive icons for the CTAs — a sedan (the fleet / "Our Services") and a
// three-spoke steering wheel (the drive / "Book Now"), kept in the same solid
// filled style as the rest of the icon set.
function CarIconSolid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

function SteeringWheelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.6a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8Z"
      />
      <circle cx="12" cy="12" r="2.7" />
      <rect x="11" y="12.6" width="2" height="7" rx="1" />
      <rect x="11" y="12.6" width="2" height="7" rx="1" transform="rotate(120 12 12)" />
      <rect x="11" y="12.6" width="2" height="7" rx="1" transform="rotate(240 12 12)" />
    </svg>
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
  Icon: ComponentType<{ className?: string }>;
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
        <Icon />
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

export default function Home() {
  const [mode, setMode] = useState<Mode>("light");
  // bumped on every "Contact" click to make the 3D logo play its tumble
  const [contactPulse, setContactPulse] = useState(0);
  // true once the visitor has scrolled into the services tour (fades the MiniMap)
  const [scrolled, setScrolled] = useState(false);
  // true once the first service stop is reached — fades the top-left brand mark
  // away; it returns when scrolling back up to the hero
  const [logoHidden, setLogoHidden] = useState(false);
  const tourRef = useRef<HTMLDivElement>(null);
  // 0..1 progress through the tour — a mutable ref read by the 3D frame loop,
  // so scrolling never re-renders React
  const tourProgress = useRef(0);
  const isLight = mode === "light";

  // feed scroll position into the camera tour
  useEffect(() => {
    const onScroll = () => {
      const vh = window.innerHeight;
      setScrolled(window.scrollY > vh * 0.3);
      // hide the brand mark once the hero is mostly gone / the first stop is reached
      setLogoHidden(window.scrollY > vh * 0.6);
      const el = tourRef.current;
      if (!el) return;
      const start = el.offsetTop - vh; // tour top reaches the viewport bottom
      const end = el.offsetTop + el.offsetHeight - vh;
      tourProgress.current = Math.min(
        1,
        Math.max(0, (window.scrollY - start) / Math.max(1, end - start)),
      );
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
      {/* fixed studio backdrop — two stacked gradients that cross-fade on mode
          change (CSS can't tween a gradient, so we fade the dark layer's opacity
          to match the car's ~1s colour lerp instead of snapping) */}
      <div className="fixed inset-0 z-0" style={{ background: BG_GRADIENT.light }} />
      <div
        className="fixed inset-0 z-0 transition-opacity duration-500"
        style={{ background: BG_GRADIENT.dark, opacity: isLight ? 0 : 1 }}
      />

      {/* the same car from /car, recolored by mode — PINNED behind the page so
          the scroll tour can move the camera while the content scrolls past. It
          sits in a lower band for the hero, then grows to fill the whole screen
          for the tour so the close-up framings read big and cinematic. */}
      <div
        className={`fixed inset-x-0 z-[1] w-full transition-[top,height] duration-700 ease-out h-dvh ${
          scrolled ? "top-0" : "top-[18dvh]"
        }`}
      >
        <CarStage
          mode={mode}
          fit={2.1}
          transparent
          tourProgress={tourProgress}
        />
      </div>

      {/* Mini self-driving maps dashboard widget, bottom left — hero only */}
      <div
        className={`transition-opacity duration-500 ${scrolled ? "opacity-0" : "opacity-100"}`}
        style={scrolled ? { pointerEvents: "none" } : undefined}
      >
        <MiniMap mode={mode} paused={scrolled} />
      </div>

      {/* brand lockup — pinned top-left so it persists over the hero, then fades
          out the moment the tour begins and fades back in on scroll up */}
      <div
        className={`pointer-events-none fixed left-5 top-5 z-30 flex items-center gap-2.5 transition-opacity duration-500 ${heading}`}
        style={{ opacity: logoHidden ? 0 : 1 }}
      >
        <Logo3D mode={mode} trigger={contactPulse} />
        <h4 className="text-sm font-bold uppercase tracking-[0.08em]">
          Apex<span className="font-semibold opacity-85">Ride</span>
        </h4>
      </div>

      {/* Tesla-style hero overlay — clicks pass through except on interactive bits */}
      <div className="pointer-events-none relative z-10 flex h-dvh flex-col">
        {/* top bar: the header action (the brand mark above is a separate fixed
            element so it can persist over the hero and then fade with the tour) */}
        <header className="flex items-center justify-end p-5">
          <PillButtonGroup
            isLight={isLight}
            items={[
              {
                label: "Contact Us",
                href: "mailto:contact@apexride.com",
                Icon: MailIconSolid,
                onClick: () => setContactPulse((c) => c + 1),
              },
            ]}
          />
        </header>

        {/* headline near the top */}
        <div className="flex flex-col items-center px-6 pt-0 text-center">
          <h1
            className={`mt-3 max-w-3xl text-4xl font-light tracking-tight sm:text-5xl ${heading}`}
          >
            Arrive at your apex.
          </h1>
          <p
            className={`mt-4 max-w-xl text-sm leading-relaxed sm:text-base ${sub}`}
          >
            Chauffeur-driven luxury across Lagos &amp; Abuja — trusted,
            effortless, and ready whenever you are. 24/7.
          </p>
          <div className="mt-8">
            <PillButtonGroup
              isLight={isLight}
              items={[
                {
                  label: "Our Services",
                  href: "#services",
                  Icon: CarIconSolid,
                  accent: { light: "#00209C", dark: "#6E8BFF" },
                },
                {
                  label: "Book Now",
                  href: "/car",
                  Icon: SteeringWheelIcon,
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
        <div className={`pointer-events-auto fixed bottom-4 right-6 z-20 select-none`}>
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
              onClick={() => setMode("light")}
              aria-label="Headlights on — light mode"
              aria-pressed={isLight}
              className={`relative z-10 rounded-full p-2 transition-all duration-300 ${
                isLight ? "text-neutral-900" : "text-white/45 hover:text-white"
              }`}
            >
              <HeadlampOnIcon />
            </button>
            <button
              onClick={() => setMode("dark")}
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

      {/* --- scroll tour: empty full-height sections, one per camera stop -----
          No cards — each section is just scroll distance that advances the
          camera to its next cool framing of the car (poses live in CarStage).
          The car canvas is fixed behind, so scrolling moves only the camera. */}
      <div ref={tourRef} id="services" className="relative">
        {Array.from({ length: TOUR_STOPS }).map((_, i) => (
          <section key={i} aria-hidden className="h-[110vh]" />
        ))}
      </div>
    </main>
  );
}
