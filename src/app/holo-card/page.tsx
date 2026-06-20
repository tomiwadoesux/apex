"use client";

/* ──────────────────────────────────────────────────────────────────────────
   Apex ride pass — a monochromatic, premium booking card. The centre is the
   booked ride: car image + type, the pickup → (dashed) → destination route, the
   ride time, an EMV-style chip, and a QR code that scans to /booking/<number>.

   The card tilts in 3D under the pointer, a white specular highlight + a sheen
   band track the cursor, brand accents (#FDBA16 amber / #00209C blue) carry the
   detail, and a subtle fractal grain + a soft, neutral elevation shadow ground
   the card.

   Pointer position is written straight to the DOM as CSS custom properties in a
   single rAF lerp loop, so dragging the (many) tweak sliders never fights the
   60fps motion. Idle drift respects prefers-reduced-motion. Inner sizes use
   `cqw` so the card scales cleanly at any width.
   ────────────────────────────────────────────────────────────────────────── */

import Image from "next/image";
import { Phone, Mail, MapPin, Clock, type LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "@/components/useReducedMotion";
import { LOGO_PATHS, LOGO_VIEWBOX } from "@/components/Logo";

/* ── brand accents ──────────────────────────────────────────────────────── */
const AMBER = "#FDBA16";
const BLUE = "#00209C";

/* ── the booked ride (data mirrors src/app/form/page.tsx vehicles) ──────── */
type Car = { name: string; klass: string; side: { dark: string; light: string } };
const CARS: Car[] = [
  {
    name: "Rolls-Royce Phantom",
    klass: "Ultra Luxury",
    side: {
      dark: "rollsroyce phantom Side black-silver.webp",
      light: "rollsroyce phantom Side white-black.webp",
    },
  },
  {
    name: "Lexus LX 600",
    klass: "Luxury SUV",
    side: { dark: "lexus lx Side black.webp", light: "lexus lx Side white.webp" },
  },
  {
    name: "Toyota Corolla",
    klass: "Executive Sedan",
    side: { dark: "toyota corolla Side black.webp", light: "toyota corolla Side white.webp" },
  },
  {
    name: "Toyota Hiace",
    klass: "Group Van",
    side: { dark: "toyota hiace Side black.webp", light: "toyota hiace Side white.webp" },
  },
];

const PICKUP = "Murtala Muhammed Intl · LOS";
const DESTINATION = "Eko Hotel, Victoria Island";

// Floating-island renders of each location (public/images/city) — a DAY cut-out
// for light mode, a NIGHT/dusk one for dark mode. Keyed by the location label so
// a route row can float its city beside the name. (Transparent PNGs, so the
// island floats on the card with no box.)
const LOCATION_IMG: Record<string, { light: string; dark: string }> = {
  [PICKUP]: {
    light: "/images/city/hf_20260609_191835_10382fac-98f4-4f3f-bbc5-b18661d9cd13.webp",
    dark: "/images/city/hf_20260609_191641_778c656b-3c37-40dc-b8b6-fb969aa69c40.webp",
  },
  [DESTINATION]: {
    light: "/images/city/hf_20260609_214000_7ad9a240-b82c-4cf6-8804-6d3d9f859ffc.webp",
    dark: "/images/city/hf_20260609_214125_de3aa492-7fb6-42b6-a4bc-d3f0de8d54c7.webp",
  },
};
const RIDE_DATE = "Sat, 21 Jun 2026";
const RIDE_TIME = "18:30";
const PHONE = "+234 801 234 5678";
const EMAIL = "concierge@apexride.com";
const SERVICE = "Airport transfer"; // the booked service — e.g. Point to point · Airport · Hourly
const DEFAULT_REF = "4827 1193 0641";

// Deterministic during SSR; reshuffled only on the client (a click handler).
function makeRef() {
  const g = () => String(Math.floor(1000 + Math.random() * 9000));
  return `${g()} ${g()} ${g()}`;
}

/* ── settings model ─────────────────────────────────────────────────────── */
type Blend =
  | "normal"
  | "overlay"
  | "color-dodge"
  | "screen"
  | "soft-light"
  | "hard-light"
  | "lighten"
  | "plus-lighter"
  | "difference";

type Settings = {
  // perspective & motion
  tilt: number;
  persp: number;
  hover: number;
  smooth: number;
  parallax: number;
  idle: number;
  animate: boolean;
  // glow
  glow: number;
  glowSize: number;
  ambient: number;
  // specular
  spec: number;
  specSize: number;
  specBlend: Blend;
  // grain
  noise: number;
  noiseScale: number;
  // sheen
  sheen: number;
  sheenWidth: number;
  // card
  radius: number;
  accent: "auto" | "amber" | "blue";
};

const DEFAULTS: Settings = {
  // subtler hover: gentler tilt + scale, softer shine
  tilt: 11,
  persp: 810,
  hover: 1.035,
  smooth: 0.14,
  parallax: 22,
  idle: 0.4,
  animate: true,
  glow: 0.5,
  glowSize: 93,
  ambient: 0.59,
  spec: 0.3,
  specSize: 37,
  specBlend: "screen",
  noise: 0.32,
  noiseScale: 0.76,
  sheen: 0.08,
  sheenWidth: 27,
  radius: 49,
  accent: "auto",
};

const PRESETS: Record<string, Partial<Settings>> = {
  Subtle: { tilt: 9, glow: 0.18, glowSize: 50, ambient: 0.18, spec: 0.4, noise: 0.15, sheen: 0.2 },
  Vivid: { tilt: 21, glow: 0.5, glowSize: 90, ambient: 0.45, spec: 0.85, specSize: 48, noise: 0.26, sheen: 0.55 },
  Brand: { tilt: 14, glow: 0.3, ambient: 0.28, spec: 0.6, noise: 0.18, sheen: 0.32, accent: "auto" },
  Frost: { tilt: 11, glow: 0.22, glowSize: 64, ambient: 0.22, spec: 0.9, specSize: 52, specBlend: "screen", noise: 0.12, sheen: 0.45 },
};

/* ── control-panel schema (drives rendering + randomise) ────────────────── */
type SliderItem = { type: "slider"; k: keyof Settings; label: string; min: number; max: number; step: number; unit?: string; fmt?: (v: number) => string };
type ToggleItem = { type: "toggle"; k: keyof Settings; label: string };
type SelectItem = { type: "select"; k: keyof Settings; label: string; options: { value: string; label: string }[] };
type Item = SliderItem | ToggleItem | SelectItem;

const BLEND_OPTS = ["normal", "overlay", "color-dodge", "screen", "soft-light", "hard-light", "lighten", "plus-lighter", "difference"].map((v) => ({ value: v, label: v }));

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Perspective & motion",
    items: [
      { type: "slider", k: "tilt", label: "Tilt", min: 0, max: 30, step: 0.5, unit: "°" },
      { type: "slider", k: "persp", label: "Perspective", min: 400, max: 2000, step: 10, unit: "px" },
      { type: "slider", k: "hover", label: "Hover scale", min: 1, max: 1.18, step: 0.005, fmt: (v) => v.toFixed(3) + "×" },
      { type: "slider", k: "smooth", label: "Smoothing", min: 0.05, max: 1, step: 0.01 },
      { type: "slider", k: "parallax", label: "Content parallax", min: 0, max: 50, step: 1, unit: "px" },
      { type: "toggle", k: "animate", label: "Idle float" },
      { type: "slider", k: "idle", label: "Idle amount", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: "Glow & shadow",
    items: [
      { type: "slider", k: "glow", label: "Accent glow", min: 0, max: 1, step: 0.01 },
      { type: "slider", k: "glowSize", label: "Shadow size", min: 10, max: 140, step: 1, unit: "px" },
      { type: "slider", k: "ambient", label: "Ambient spill", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: "Specular highlight",
    items: [
      { type: "slider", k: "spec", label: "Intensity", min: 0, max: 1, step: 0.01 },
      { type: "slider", k: "specSize", label: "Size", min: 10, max: 90, step: 1, unit: "%" },
      { type: "select", k: "specBlend", label: "Blend", options: BLEND_OPTS },
    ],
  },
  {
    title: "Grain & sheen",
    items: [
      { type: "slider", k: "noise", label: "Noise", min: 0, max: 0.6, step: 0.01 },
      { type: "slider", k: "noiseScale", label: "Noise scale", min: 0.2, max: 1.2, step: 0.02 },
      { type: "slider", k: "sheen", label: "Sheen", min: 0, max: 1, step: 0.01 },
      { type: "slider", k: "sheenWidth", label: "Sheen width", min: 6, max: 50, step: 1, unit: "%" },
    ],
  },
  {
    title: "Card",
    items: [
      { type: "slider", k: "radius", label: "Corner radius", min: 8, max: 56, step: 1, unit: "px" },
      { type: "select", k: "accent", label: "Accent", options: [{ value: "auto", label: "auto (theme)" }, { value: "amber", label: "amber" }, { value: "blue", label: "blue" }] },
    ],
  },
];

/* ── helpers ────────────────────────────────────────────────────────────── */
function noiseUrl(freq: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/* ── the inline brand mark ──────────────────────────────────────────────── */
function LogoMark({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 139 152" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <path d="M66.7703 0C74.2372 0.18897 76.7497 3.24329 80.4577 9.45514C96.9025 37.0697 113.133 64.7208 129.466 92.4111C132.151 96.9622 139.831 108.081 138.677 113.593C138.253 115.617 136.012 120.237 134.195 120.71C116.289 125.374 88.0411 98.6954 72.0326 94.5106L71.1219 94.2792C53.5024 94.4998 25.6138 124.146 7.85784 122.039C5.40108 121.748 3.01758 120.715 1.57899 118.62C0.14955 116.539 -0.25924 113.594 0.151192 111.127C1.14272 105.174 52.8722 16.4895 59.8853 6.52736C61.8259 3.7719 64.0013 1.89386 66.7703 0Z" fill="currentColor" />
      <path d="M65.4483 103.057C78.6429 100.845 91.1706 109.627 93.5891 122.784C96.0076 135.941 87.4218 148.605 74.3037 151.23C65.6331 152.964 56.7001 149.891 50.9324 143.189C45.1639 136.487 43.4564 127.196 46.4643 118.882C49.4713 110.567 56.7276 104.518 65.4483 103.057Z" fill="currentColor" />
    </svg>
  );
}

/* ── page ───────────────────────────────────────────────────────────────── */
export default function HoloCardPage() {
  const [light, setLight] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [carIdx, setCarIdx] = useState(0);
  const [hasDest, setHasDest] = useState(true);
  const [ref, setRef] = useState(DEFAULT_REF);

  const car = CARS[carIdx];
  const accent = s.accent === "amber" ? AMBER : s.accent === "blue" ? BLUE : light ? BLUE : AMBER;

  const surface = light
    ? "linear-gradient(155deg, #f7f9fd 0%, #e3e8f2 55%, #d2dae9 100%)"
    : "linear-gradient(155deg, #181b22 0%, #101218 55%, #0a0b0f 100%)";
  const cardBorder = light ? "rgba(10,18,40,0.14)" : "rgba(255,255,255,0.09)";

  // content palette
  const ink = light ? "#0c1222" : "#f3f5fa";
  const dim = light ? "rgba(12,18,34,.55)" : "rgba(255,255,255,.5)";
  const hair = light ? "rgba(10,18,40,.16)" : "rgba(255,255,255,.14)";


  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const randomize = () =>
    setS((p) => {
      const next = { ...p };
      for (const g of GROUPS)
        for (const it of g.items)
          if (it.type === "slider") {
            const steps = Math.round((it.max - it.min) / it.step);
            (next[it.k] as number) = +(it.min + Math.round(Math.random() * steps) * it.step).toFixed(4);
          }
      return next;
    });

  return (
    <main
      className="relative min-h-dvh w-full overflow-hidden transition-colors duration-500"
      style={{
        background: light
          ? "radial-gradient(130% 120% at 50% -10%, #eef2f8 0%, #d3dae6 70%, #c2cbdc 100%)"
          : "radial-gradient(130% 120% at 50% -10%, #14171e 0%, #0a0c10 65%, #06070a 100%)",
        color: ink,
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -left-32 top-40 h-96 w-96 rounded-full blur-3xl" style={{ background: accent, opacity: light ? 0.1 : 0.14 }} />
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-10 h-80 w-80 rounded-full blur-3xl" style={{ background: light ? BLUE : AMBER, opacity: 0.08 }} />

      <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ride pass</h1>
            <p className="mt-1 text-sm" style={{ color: dim }}>Premium booking card · perspective tilt · specular shine.</p>
          </div>
          <button onClick={() => setLight((v) => !v)} className="shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium" style={{ borderColor: cardBorder, background: light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)" }}>
            {light ? "Dark mode" : "Light mode"}
          </button>
        </header>

        <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
          {/* point-to-point card (with drop-off) */}
          <RideCard
            light={light} s={s} accent={accent} surface={surface} cardBorder={cardBorder}
            ink={ink} dim={dim} hair={hair} car={car}
            service="Point to point" pickup={PICKUP} dropoff={DESTINATION}
            date={RIDE_DATE} time={RIDE_TIME} bookingRef={ref}
          />
          {/* hourly hire card — identical, but NO drop-off (shows duration) */}
          <RideCard
            light={light} s={s} accent={accent} surface={surface} cardBorder={cardBorder}
            ink={ink} dim={dim} hair={hair} car={car}
            service="Hourly hire" pickup={PICKUP} dropoff={null} duration="4 hours · within Lagos"
            date={RIDE_DATE} time={RIDE_TIME} bookingRef={ref}
          />
        </div>
      </div>
    </main>
  );
}

/* ── one route row (marker + label + place) ─────────────────────────────── */
function RouteRow({ marker, icon: Icon, label, name, accent, ink, dim, img, light = false }: { marker?: "filled" | "ring"; icon?: LucideIcon; label: string; name: string; accent: string; ink: string; dim: string; img?: { light: string; dark: string }; light?: boolean }) {
  return (
    <div className="relative flex items-start" style={{ gap: "3cqw" }}>
      {Icon ? (
        <Icon strokeWidth={2.2} style={{ width: "3.8cqw", height: "3.8cqw", color: accent, flexShrink: 0, marginTop: "0.2cqw" }} />
      ) : (
        <span style={{ marginTop: "0.6cqw", width: "3.4cqw", height: "3.4cqw", borderRadius: "9999px", flexShrink: 0, background: marker === "filled" ? accent : "transparent", border: `1.5px solid ${accent}`, boxShadow: marker === "filled" ? `0 0 0 1.1cqw ${accent}22` : "none" }} />
      )}
      <div className="min-w-0" style={img ? { paddingRight: "15cqw" } : undefined}>
        <div style={{ fontSize: "2cqw", letterSpacing: "0.28em", textTransform: "uppercase", color: dim }}>{label}</div>
        <div className="truncate" style={{ fontSize: "3cqw", fontWeight: 500, color: ink, marginTop: "0.4cqw" }}>{name}</div>
      </div>
      {/* the location itself — a floating-island render, themed light/dark */}
      {img && (
        <div className="pointer-events-none absolute" style={{ right: 0, top: "50%", width: "13cqw", height: "12cqw", transform: "translateY(-50%)" }}>
          <Image
            src={light ? img.light : img.dark}
            alt={`${name} location`}
            fill
            sizes="180px"
            className="object-contain"
            style={{ filter: `drop-shadow(0 1.2cqw 1.4cqw rgba(0,0,0,${light ? 0.28 : 0.55}))` }}
          />
        </div>
      )}
    </div>
  );
}

/* ── one ride-pass card — own pointer-tilt so several can sit side by side ── */
type RideCardProps = {
  light: boolean;
  s: Settings;
  accent: string;
  surface: string;
  cardBorder: string;
  ink: string;
  dim: string;
  hair: string;
  car: Car;
  service: string;
  pickup: string;
  dropoff: string | null; // null = hourly hire (no drop-off)
  duration?: string; // shown in place of drop-off on the hourly card
  date: string;
  time: string;
  bookingRef: string;
};

function RideCard({ light, s, accent, surface, cardBorder, ink, dim, hair, car, service, pickup, dropoff, duration, date, time, bookingRef }: RideCardProps) {
  const reduced = useReducedMotion();
  // touch devices can't hover, so we auto-play a GENTLE version of the hover there
  const noHoverRef = useRef(false);
  useEffect(() => {
    noHoverRef.current = window.matchMedia("(hover: none)").matches;
  }, []);
  const stageRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0.5, y: 0.5, active: 0 });
  const current = useRef({ x: 0.5, y: 0.5, active: 0 });
  const hovering = useRef(false);
  const raf = useRef<number | null>(null);
  const live = useRef({ s, reduced });
  live.current = { s, reduced };

  useEffect(() => {
    const loop = () => {
      const { s: cfg, reduced: rm } = live.current;
      const t = target.current;
      const c = current.current;
      if (!hovering.current) {
        // Desktop: dead still — only a real hover tilts it. Touch (no hover):
        // a gentle auto-sweep, weaker than a real hover (active capped low).
        if (noHoverRef.current && !rm) {
          const now = performance.now() / 1000;
          t.x = 0.5 + Math.sin(now * 0.55) * 0.14;
          t.y = 0.5 + Math.cos(now * 0.42) * 0.14;
          t.active = 0.42;
        } else {
          t.x = 0.5;
          t.y = 0.5;
          t.active = 0;
        }
      }
      const k = 0.04 + cfg.smooth * 0.32;
      c.x += (t.x - c.x) * k;
      c.y += (t.y - c.y) * k;
      c.active += (t.active - c.active) * k;
      const el = stageRef.current;
      if (el) {
        const cx = c.x - 0.5;
        const cy = c.y - 0.5;
        const st = el.style;
        st.setProperty("--px", (c.x * 100).toFixed(2) + "%");
        st.setProperty("--py", (c.y * 100).toFixed(2) + "%");
        st.setProperty("--cx", cx.toFixed(4));
        st.setProperty("--cy", cy.toFixed(4));
        st.setProperty("--rx", (-cy * cfg.tilt * 2).toFixed(2) + "deg");
        st.setProperty("--ry", (cx * cfg.tilt * 2).toFixed(2) + "deg");
        st.setProperty("--active", c.active.toFixed(3));
        st.setProperty("--scl", (1 + (cfg.hover - 1) * c.active).toFixed(4));
        st.setProperty("--bgx", (50 - cx * 80).toFixed(2) + "%");
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    target.current.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    target.current.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    target.current.active = 1;
  }, []);
  const onEnter = useCallback(() => {
    hovering.current = true;
    target.current.active = 1;
  }, []);
  const onLeave = useCallback(() => {
    hovering.current = false;
  }, []);

  const glowRgb = light ? "12, 18, 34" : "255, 255, 255";
  const vars = useMemo(
    () =>
      ({
        "--persp": `${s.persp}px`,
        "--radius": `${s.radius}px`,
        "--glow-rgb": glowRgb,
        "--glow-strength": s.glow,
        "--glow-size": `${s.glowSize}px`,
        "--ambient": s.ambient,
        "--spec": s.spec,
        "--spec-size": `${s.specSize}%`,
        "--noise": s.noise,
        "--sheen": s.sheen,
        "--sheen-w": `${s.sheenWidth}%`,
        "--parallax": `${s.parallax}px`,
        "--px": "50%",
        "--py": "50%",
        "--cx": "0",
        "--cy": "0",
        "--rx": "0deg",
        "--ry": "0deg",
        "--scl": "1",
        "--active": "0",
        "--bgx": "50%",
      }) as CSSProperties,
    [s, glowRgb],
  );

  return (
    <div className="flex items-center justify-center py-6" style={vars}>
      <div ref={stageRef} onPointerMove={onMove} onPointerEnter={onEnter} onPointerLeave={onLeave} className="relative" style={{ width: "min(460px, 88vw)", aspectRatio: "5 / 7.5" }}>
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            borderRadius: "var(--radius)",
            background: surface,
            border: `1px solid ${cardBorder}`,
            containerType: "inline-size",
            transform: "perspective(var(--persp)) rotateX(var(--rx)) rotateY(var(--ry)) scale(var(--scl))",
            transformOrigin: "center",
            boxShadow: `
              0 calc(24px + var(--active) * 26px) calc(36px + var(--glow-size) * 0.5) -28px rgba(0,0,0,${light ? 0.34 : 0.66}),
              0 calc(6px + var(--active) * 6px) 18px -16px rgba(var(--glow-rgb), calc(var(--glow-strength) * var(--active) * 0.5))`,
            willChange: "transform",
          }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: light ? "radial-gradient(120% 80% at 50% -15%, rgba(255,255,255,.75) 0%, transparent 55%)" : "radial-gradient(120% 80% at 50% -15%, rgba(255,255,255,.07) 0%, transparent 55%)" }} />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(85% 60% at 78% 112%, rgba(var(--glow-rgb), ${light ? 0.05 : 0.1}) 0%, transparent 60%)` }} />

          {/* oversized faint logo bleeding off the corner — depth, not a centre mark */}
          <LogoMark style={{ position: "absolute", top: "-11cqw", right: "-13cqw", width: "62cqw", height: "auto", color: accent, opacity: light ? 0.06 : 0.08, transform: "rotate(-8deg)", pointerEvents: "none" }} />

          <div className="pointer-events-none absolute inset-0 flex flex-col" style={{ padding: "4cqw 7cqw 2cqw", transform: "translate(calc(var(--cx) * var(--parallax)), calc(var(--cy) * var(--parallax)))" }}>
            {/* header: brand lockup + booked service (big) + date + time */}
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center" style={{ gap: "3cqw" }}>
                <svg viewBox={LOGO_VIEWBOX} fill="none" style={{ width: "9cqw", height: "auto", overflow: "visible", flexShrink: 0 }}>
                  <path d={LOGO_PATHS[0]} fill={ink} />
                  <path d={LOGO_PATHS[1]} fill={accent} />
                </svg>
                <span style={{ fontWeight: 700, fontSize: "5.8cqw", letterSpacing: "0.08em", textTransform: "uppercase", color: ink, lineHeight: 1 }}>
                  Apex<span style={{ color: accent }}>Ride</span>
                </span>
              </div>
              <div style={{ marginTop: "3cqw", lineHeight: 1 }}>
                <div style={{ fontFamily: "var(--font-josefin-sans), sans-serif", fontSize: "6cqw", fontWeight: 600, color: ink, marginBottom: "2cqw" }}>{service}</div>
                <div style={{ fontSize: "3cqw", fontWeight: 600, letterSpacing: "0.02em", color: dim }}>{date}</div>
                <div style={{ fontFamily: "var(--font-josefin-sans), sans-serif", fontSize: "4.8cqw", fontWeight: 600, color: accent, marginTop: "1cqw" }}>{time}</div>
              </div>
            </div>

            {/* hero: the car — bigger for more presence / breathing room */}
            <div className="relative mt-[1cqw]" style={{ height: "72cqw", marginInline: "-7cqw" }}>
              <Image
                key={car.name + (light ? "l" : "d")}
                src={encodeURI(`/images/${light ? car.side.light : car.side.dark}`)}
                alt={`${car.name} side view`}
                fill
                draggable={false}
                className="select-none object-contain"
                style={{ filter: "saturate(.95)" }}
                sizes="420px"
                priority
              />
            </div>

            {/* car name + class — centred, snug under the car — with the accent
                hairline sitting directly UNDER the "… · Chauffeured" line */}
            <div className="mt-[0.5cqw] text-center">
              <div style={{ fontFamily: "var(--font-josefin-sans), sans-serif", fontWeight: 500, fontSize: "6.4cqw", lineHeight: 1.0, color: ink }}>{car.name}</div>
              <div style={{ fontSize: "2.8cqw", letterSpacing: "0.03em", color: dim, marginTop: "1cqw" }}>
                {car.klass} <span style={{ color: accent }}>·</span> <span style={{ color: accent }}>Chauffeured</span>
              </div>
              <div style={{ height: "1.5px", marginTop: "1.6cqw", background: `linear-gradient(90deg, transparent 0%, ${accent} 35%, ${accent} 65%, transparent 100%)` }} />
            </div>

            {/* route: pickup → drop-off (point-to-point, connected dots) OR
                pickup + duration (hourly, ICONS — so it doesn't read as a route) */}
            <div className="mt-[2cqw] flex flex-col">
              {dropoff ? (
                <>
                  <RouteRow marker="filled" label="Pickup" name={pickup} accent={accent} ink={ink} dim={dim} img={LOCATION_IMG[pickup]} light={light} />
                  <div style={{ height: "7cqw", marginLeft: "1.7cqw", borderLeft: `1.5px dashed ${light ? "rgba(10,18,40,.35)" : "rgba(255,255,255,.32)"}` }} />
                  <RouteRow marker="ring" label="Drop-off" name={dropoff} accent={accent} ink={ink} dim={dim} img={LOCATION_IMG[dropoff]} light={light} />
                </>
              ) : (
                <>
                  <RouteRow icon={MapPin} label="Pickup" name={pickup} accent={accent} ink={ink} dim={dim} img={LOCATION_IMG[pickup]} light={light} />
                  {duration && <div style={{ marginTop: "3cqw" }}><RouteRow icon={Clock} label="Duration" name={duration} accent={accent} ink={ink} dim={dim} /></div>}
                </>
              )}
            </div>

            {/* booking number — stays up with the content */}
            <div className="mt-[2cqw] text-center">
              <div style={{ borderTop: `2px dotted ${light ? "rgba(10,18,40,.3)" : "rgba(255,255,255,.26)"}`, margin: "2cqw 0 2.5cqw" }} />
              <div style={{ fontSize: "2.2cqw", letterSpacing: "0.3em", color: dim }}>BOOKING No.</div>
              <div style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 600, fontSize: "5.6cqw", letterSpacing: "0.2em", color: ink, marginTop: "1.2cqw" }}>{bookingRef}</div>
              <div style={{ fontSize: "2.2cqw", letterSpacing: "0.02em", color: accent, marginTop: "1.4cqw", whiteSpace: "nowrap" }}>apexride.com/booking/{bookingRef.replace(/\s+/g, "")}</div>
            </div>

            {/* contact — pinned to the bottom */}
            <div className="mt-auto flex flex-col items-center" style={{ gap: "1.8cqw", paddingTop: "3cqw" }}>
              <span className="inline-flex items-center" style={{ gap: "1.8cqw", fontSize: "2.6cqw", color: ink, whiteSpace: "nowrap" }}>
                <Phone strokeWidth={2.2} style={{ width: "2.9cqw", height: "2.9cqw", color: accent, flexShrink: 0 }} />
                {PHONE}
              </span>
              <span className="inline-flex items-center" style={{ gap: "1.8cqw", fontSize: "2.6cqw", color: ink, whiteSpace: "nowrap" }}>
                <Mail strokeWidth={2.2} style={{ width: "2.9cqw", height: "2.9cqw", color: accent, flexShrink: 0 }} />
                {EMAIL}
              </span>
            </div>

            {/* sharing instruction — pushed right down to the bottom edge */}
            <div style={{ marginTop: "3cqw", fontSize: "2.3cqw", lineHeight: 1.4, color: dim, textAlign: "center", paddingInline: "1cqw" }}>
              Only share this card with whoever you&apos;re sharing this ride with, or who you booked it for.
            </div>
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: noiseUrl(s.noiseScale), backgroundSize: "180px 180px", opacity: "var(--noise)", mixBlendMode: light ? "multiply" : "overlay" }} />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(105deg, transparent calc(var(--bgx) - var(--sheen-w)), rgba(255,255,255,calc(var(--sheen) * 0.55)) var(--bgx), transparent calc(var(--bgx) + var(--sheen-w)))`, mixBlendMode: "overlay", opacity: "calc(0.3 + var(--active) * 0.7)" }} />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ borderRadius: "var(--radius)", boxShadow: light ? "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 0 0 1px rgba(255,255,255,0.25)" : "inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.05)" }} />
        </div>
      </div>
    </div>
  );
}

/* ── one control row ────────────────────────────────────────────────────── */
function Control({ item, value, accent, light, onChange }: { item: Item; value: Settings[keyof Settings]; accent: string; light: boolean; onChange: (v: number | boolean | string) => void }) {
  const dim = light ? "rgba(12,18,34,.55)" : "rgba(255,255,255,.5)";
  const border = light ? "rgba(10,18,40,0.14)" : "rgba(255,255,255,0.12)";

  if (item.type === "toggle") {
    const on = value as boolean;
    return (
      <div className="flex items-center justify-between">
        <span className="text-[12px]">{item.label}</span>
        <button onClick={() => onChange(!on)} className="relative h-5 w-9 rounded-full transition-colors" style={{ background: on ? accent : light ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.18)" }} aria-pressed={on}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? "1.125rem" : "0.125rem" }} />
        </button>
      </div>
    );
  }

  if (item.type === "select") {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px]">{item.label}</span>
        <select value={value as string} onChange={(e) => onChange(e.target.value)} className="rounded-lg border bg-transparent px-2 py-1 text-[11px] outline-none" style={{ borderColor: border, color: "inherit" }}>
          {item.options.map((o) => (
            <option key={o.value} value={o.value} style={{ color: "#111" }}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  const v = value as number;
  const pct = ((v - item.min) / (item.max - item.min)) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px]">{item.label}</span>
        <span className="text-[11px] tabular-nums" style={{ color: dim }}>{item.fmt ? item.fmt(v) : `${v}${item.unit ?? ""}`}</span>
      </div>
      <input type="range" min={item.min} max={item.max} step={item.step} value={v} onChange={(e) => onChange(+e.target.value)} className="h-1.5 w-full cursor-pointer appearance-none rounded-full" style={{ accentColor: accent, background: `linear-gradient(90deg, ${accent} ${pct}%, ${light ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.14)"} ${pct}%)` }} />
    </div>
  );
}
