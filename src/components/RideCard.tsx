"use client";

/* ──────────────────────────────────────────────────────────────────────────
   Apex Ride pass — the premium, monochromatic booking card. Extracted from the
   /holo-card playground so the booking form, /check-booking, and the playground
   all render ONE card. The centre is the booked ride: car image + type, the
   pickup → (dashed) → destination route (or pickup + duration for hourly), the
   ride date/time, the booking number, and contact.

   The card tilts in 3D under the pointer; pointer position is written straight to
   the DOM as CSS custom properties in a single rAF lerp loop. Inner sizes use
   `cqw` so the card scales cleanly at any width. Idle drift respects
   prefers-reduced-motion.
   ────────────────────────────────────────────────────────────────────────── */

import Image from "next/image";
import { Phone, Mail, MapPin, Clock, type LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "@/components/useReducedMotion";
import { LOGO_PATHS, LOGO_VIEWBOX } from "@/components/Logo";

/* ── brand accents ──────────────────────────────────────────────────────── */
export const AMBER = "#FDBA16";
export const BLUE = "#00209C";

/* ── default concierge contact (shown when a booking has no contact of its own) */
const CONCIERGE_PHONE = "+234 801 234 5678";
const CONCIERGE_EMAIL = "concierge@apexride.com";

/* ── the booked car ───────────────────────────────────────────────────────── */
export type RideCar = {
  name: string;
  klass: string;
  // image paths are relative to /public/images (e.g. "cars/Range Rover Velar/side.webp")
  side: { dark: string; light: string };
};

/* ── a renderable booking (what the form / check-booking feed the card) ────── */
export type RideBooking = {
  service: string;
  pickup: string;
  dropoff: string | null;
  duration?: string | null;
  date: string;
  time: string;
  bookingRef: string;
  car: RideCar;
  passengerName?: string;
  phone?: string;
  email?: string;
  pickupImg?: { light: string; dark: string };
  dropoffImg?: { light: string; dark: string };
};

/* ── visual-tweak model (the /holo-card sliders drive this) ────────────────── */
export type Blend =
  | "normal"
  | "overlay"
  | "color-dodge"
  | "screen"
  | "soft-light"
  | "hard-light"
  | "lighten"
  | "plus-lighter"
  | "difference";

export type Settings = {
  tilt: number;
  persp: number;
  hover: number;
  smooth: number;
  parallax: number;
  idle: number;
  animate: boolean;
  glow: number;
  glowSize: number;
  ambient: number;
  spec: number;
  specSize: number;
  specBlend: Blend;
  noise: number;
  noiseScale: number;
  sheen: number;
  sheenWidth: number;
  radius: number;
  accent: "auto" | "amber" | "blue";
};

export const DEFAULTS: Settings = {
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

/* ── theme colours derived from light/dark + accent preference ─────────────── */
export function passTheme(light: boolean, accentPref: Settings["accent"] = "auto") {
  const accent = accentPref === "amber" ? AMBER : accentPref === "blue" ? BLUE : light ? BLUE : AMBER;
  return {
    accent,
    surface: light
      ? "linear-gradient(155deg, #f7f9fd 0%, #e3e8f2 55%, #d2dae9 100%)"
      : "linear-gradient(155deg, #181b22 0%, #101218 55%, #0a0b0f 100%)",
    cardBorder: light ? "rgba(10,18,40,0.14)" : "rgba(255,255,255,0.09)",
    ink: light ? "#0c1222" : "#f3f5fa",
    dim: light ? "rgba(12,18,34,.55)" : "rgba(255,255,255,.5)",
    hair: light ? "rgba(10,18,40,.16)" : "rgba(255,255,255,.14)",
  };
}

/* ── helpers ────────────────────────────────────────────────────────────────*/
export function noiseUrl(freq: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function LogoMark({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 139 152" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <path d="M66.7703 0C74.2372 0.18897 76.7497 3.24329 80.4577 9.45514C96.9025 37.0697 113.133 64.7208 129.466 92.4111C132.151 96.9622 139.831 108.081 138.677 113.593C138.253 115.617 136.012 120.237 134.195 120.71C116.289 125.374 88.0411 98.6954 72.0326 94.5106L71.1219 94.2792C53.5024 94.4998 25.6138 124.146 7.85784 122.039C5.40108 121.748 3.01758 120.715 1.57899 118.62C0.14955 116.539 -0.25924 113.594 0.151192 111.127C1.14272 105.174 52.8722 16.4895 59.8853 6.52736C61.8259 3.7719 64.0013 1.89386 66.7703 0Z" fill="currentColor" />
      <path d="M65.4483 103.057C78.6429 100.845 91.1706 109.627 93.5891 122.784C96.0076 135.941 87.4218 148.605 74.3037 151.23C65.6331 152.964 56.7001 149.891 50.9324 143.189C45.1639 136.487 43.4564 127.196 46.4643 118.882C49.4713 110.567 56.7276 104.518 65.4483 103.057Z" fill="currentColor" />
    </svg>
  );
}

/* ── one route row (marker + label + place + optional floating-island image) ─ */
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

/* ── one ride-pass card — own pointer-tilt so several can sit side by side ─── */
export type RideCardProps = {
  light: boolean;
  s: Settings;
  accent: string;
  surface: string;
  cardBorder: string;
  ink: string;
  dim: string;
  hair: string;
  car: RideCar;
  service: string;
  pickup: string;
  dropoff: string | null; // null = no drop-off (hourly / duration)
  duration?: string | null; // shown in place of drop-off
  date: string;
  time: string;
  bookingRef: string;
  passengerName?: string;
  phone?: string;
  email?: string;
  pickupImg?: { light: string; dark: string };
  dropoffImg?: { light: string; dark: string };
};

export function RideCard({
  light,
  s,
  accent,
  surface,
  cardBorder,
  ink,
  dim,
  car,
  service,
  pickup,
  dropoff,
  duration,
  date,
  time,
  bookingRef,
  passengerName,
  phone = CONCIERGE_PHONE,
  email = CONCIERGE_EMAIL,
  pickupImg,
  dropoffImg,
}: RideCardProps) {
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
  // The rAF loop reads the latest settings/reduced-motion via this ref (updated
  // after every commit, so we never touch a ref during render).
  const live = useRef({ s, reduced });
  useEffect(() => {
    live.current = { s, reduced };
  });

  useEffect(() => {
    const loop = () => {
      const { s: cfg, reduced: rm } = live.current;
      const t = target.current;
      const c = current.current;
      if (!hovering.current) {
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
          data-ride-card
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

            {/* hero: the car */}
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

            {/* car name + class */}
            <div className="mt-[0.5cqw] text-center">
              <div style={{ fontFamily: "var(--font-josefin-sans), sans-serif", fontWeight: 500, fontSize: "6.4cqw", lineHeight: 1.0, color: ink }}>{car.name}</div>
              <div style={{ fontSize: "2.8cqw", letterSpacing: "0.03em", color: dim, marginTop: "1cqw" }}>
                {car.klass} <span style={{ color: accent }}>·</span> <span style={{ color: accent }}>Chauffeured</span>
              </div>
              <div style={{ height: "1.5px", marginTop: "1.6cqw", background: `linear-gradient(90deg, transparent 0%, ${accent} 35%, ${accent} 65%, transparent 100%)` }} />
            </div>

            {/* route: pickup → drop-off OR pickup + duration */}
            <div className="mt-[2cqw] flex flex-col">
              {dropoff ? (
                <>
                  <RouteRow marker="filled" label="Pickup" name={pickup} accent={accent} ink={ink} dim={dim} img={pickupImg} light={light} />
                  <div style={{ height: "7cqw", marginLeft: "1.7cqw", borderLeft: `1.5px dashed ${light ? "rgba(10,18,40,.35)" : "rgba(255,255,255,.32)"}` }} />
                  <RouteRow marker="ring" label="Drop-off" name={dropoff} accent={accent} ink={ink} dim={dim} img={dropoffImg} light={light} />
                </>
              ) : (
                <>
                  <RouteRow icon={MapPin} label="Pickup" name={pickup} accent={accent} ink={ink} dim={dim} img={pickupImg} light={light} />
                  {duration && <div style={{ marginTop: "3cqw" }}><RouteRow icon={Clock} label="Duration" name={duration} accent={accent} ink={ink} dim={dim} /></div>}
                </>
              )}
            </div>

            {/* booking number (+ passenger, if any) */}
            <div className="mt-[2cqw] text-center">
              <div style={{ borderTop: `2px dotted ${light ? "rgba(10,18,40,.3)" : "rgba(255,255,255,.26)"}`, margin: "2cqw 0 2.5cqw" }} />
              <div style={{ fontSize: "2.2cqw", letterSpacing: "0.3em", color: dim }}>BOOKING No.</div>
              <div style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 600, fontSize: "5.6cqw", letterSpacing: "0.2em", color: ink, marginTop: "1.2cqw" }}>{bookingRef}</div>
              {passengerName ? (
                <div style={{ fontSize: "2.4cqw", letterSpacing: "0.04em", color: dim, marginTop: "1.4cqw" }}>
                  Issued to <span style={{ color: ink, fontWeight: 600 }}>{passengerName}</span>
                </div>
              ) : (
                <div style={{ fontSize: "2.2cqw", letterSpacing: "0.02em", color: accent, marginTop: "1.4cqw", whiteSpace: "nowrap" }}>apexride.com/booking/{bookingRef.replace(/\s+/g, "")}</div>
              )}
            </div>

            {/* contact — pinned to the bottom */}
            <div className="mt-auto flex flex-col items-center" style={{ gap: "1.8cqw", paddingTop: "3cqw" }}>
              <span className="inline-flex items-center" style={{ gap: "1.8cqw", fontSize: "2.6cqw", color: ink, whiteSpace: "nowrap" }}>
                <Phone strokeWidth={2.2} style={{ width: "2.9cqw", height: "2.9cqw", color: accent, flexShrink: 0 }} />
                {phone}
              </span>
              <span className="inline-flex items-center" style={{ gap: "1.8cqw", fontSize: "2.6cqw", color: ink, whiteSpace: "nowrap" }}>
                <Mail strokeWidth={2.2} style={{ width: "2.9cqw", height: "2.9cqw", color: accent, flexShrink: 0 }} />
                {email}
              </span>
            </div>

            {/* sharing instruction */}
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

/* ── convenience: render a card straight from a RideBooking + theme ────────── */
export function RidePass({
  booking,
  light,
  settings = DEFAULTS,
}: {
  booking: RideBooking;
  light: boolean;
  settings?: Settings;
}) {
  const t = passTheme(light, settings.accent);
  return (
    <RideCard
      light={light}
      s={settings}
      accent={t.accent}
      surface={t.surface}
      cardBorder={t.cardBorder}
      ink={t.ink}
      dim={t.dim}
      hair={t.hair}
      car={booking.car}
      service={booking.service}
      pickup={booking.pickup}
      dropoff={booking.dropoff}
      duration={booking.duration ?? undefined}
      date={booking.date}
      time={booking.time}
      bookingRef={booking.bookingRef}
      passengerName={booking.passengerName}
      phone={booking.phone}
      email={booking.email}
      pickupImg={booking.pickupImg}
      dropoffImg={booking.dropoffImg}
    />
  );
}
