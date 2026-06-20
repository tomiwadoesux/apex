"use client";

// Showcase: each of the 6 services rendered as a BENTO grid. Squircle corners come
// from the global corner-shape rule in globals.css. Toggle light/dark to compare.
import { useState } from "react";
import {
  Handshake,
  Plane,
  Luggage,
  Clock,
  Heart,
  Sparkles,
  UserCheck,
  Users,
  Car,
  Timer,
  CalendarCheck,
  ReceiptText,
  Percent,
  Route,
  BadgeCheck,
  Compass,
  Map as MapIcon,
  Landmark,
  Camera,
  Gem,
  Lock,
  UserRound,
  Crown,
  type LucideIcon,
} from "lucide-react";

type Feat = { label: string; Icon: LucideIcon };
type Service = {
  index: string;
  title: string;
  blurb: string;
  stat: string;
  statLabel: string;
  features: Feat[];
};

const SERVICES: Service[] = [
  {
    index: "01",
    title: "Airport Transfers",
    blurb: "Smooth pickups and arrivals across Lagos and Abuja airports.",
    stat: "24/7",
    statLabel: "availability",
    features: [
      { label: "Meet and greet", Icon: Handshake },
      { label: "Flight tracking", Icon: Plane },
      { label: "Luggage help", Icon: Luggage },
      { label: "Round the clock", Icon: Clock },
    ],
  },
  {
    index: "02",
    title: "Wedding Transportation",
    blurb: "Elegant cars that make the big day completely effortless.",
    stat: "100%",
    statLabel: "styled",
    features: [
      { label: "Bridal cars", Icon: Heart },
      { label: "Ribbon styling", Icon: Sparkles },
      { label: "Trained chauffeurs", Icon: UserCheck },
      { label: "Guest shuttles", Icon: Users },
    ],
  },
  {
    index: "03",
    title: "Corporate Events",
    blurb: "Dependable transport for meetings, conferences and guests.",
    stat: "On time",
    statLabel: "every trip",
    features: [
      { label: "Executive sedans", Icon: Car },
      { label: "Punctual pickups", Icon: Timer },
      { label: "Flexible booking", Icon: CalendarCheck },
      { label: "Corporate billing", Icon: ReceiptText },
    ],
  },
  {
    index: "04",
    title: "Group Transportation",
    blurb: "Comfortable rides for groups of any size, all together.",
    stat: "32",
    statLabel: "seats",
    features: [
      { label: "Up to 32 seats", Icon: Users },
      { label: "Group rates", Icon: Percent },
      { label: "Route planning", Icon: Route },
      { label: "Seasoned drivers", Icon: BadgeCheck },
    ],
  },
  {
    index: "05",
    title: "City Tours",
    blurb: "Discover Lagos and Abuja with a knowledgeable local guide.",
    stat: "Local",
    statLabel: "guides",
    features: [
      { label: "Local guides", Icon: Compass },
      { label: "Custom routes", Icon: MapIcon },
      { label: "Top landmarks", Icon: Landmark },
      { label: "Cultural stops", Icon: Camera },
    ],
  },
  {
    index: "06",
    title: "Executive Travel",
    blurb: "Discreet, premium travel for executives and VIPs.",
    stat: "100%",
    statLabel: "private",
    features: [
      { label: "Luxury fleet", Icon: Gem },
      { label: "Total privacy", Icon: Lock },
      { label: "Personal chauffeur", Icon: UserRound },
      { label: "VIP service", Icon: Crown },
    ],
  },
];

export default function CardDesigns() {
  const [light, setLight] = useState(false);
  const accent = light ? "#00209C" : "#FDBA16";
  const text = light ? "text-neutral-900" : "text-white";
  const dim = light ? "text-neutral-600" : "text-white/60";

  return (
    <main
      className={`relative min-h-dvh w-full overflow-hidden px-6 py-14 transition-colors duration-500 ${text}`}
      style={{
        background: light
          ? "radial-gradient(120% 120% at 50% 0%, #eef1f5 0%, #d7dde6 100%)"
          : "radial-gradient(120% 120% at 50% 0%, #161a22 0%, #0a0c10 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-52 h-72 w-72 rounded-full blur-3xl"
        style={{ background: accent, opacity: 0.16 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-20 h-80 w-80 rounded-full blur-3xl"
        style={{ background: accent, opacity: 0.1 }}
      />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Services — bento</h1>
            <p className={`mt-1 text-sm ${dim}`}>All six services as bento grids · squircle corners.</p>
          </div>
          <button
            onClick={() => setLight((v) => !v)}
            className="rounded-full border border-current/15 px-4 py-1.5 text-xs font-medium"
            style={{ background: light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)" }}
          >
            {light ? "Dark mode" : "Light mode"}
          </button>
        </header>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {SERVICES.map((s) => (
            <Bento key={s.index} s={s} accent={accent} light={light} dim={dim} />
          ))}
        </div>
      </div>
    </main>
  );
}

function Bento({
  s,
  accent,
  light,
  dim,
}: {
  s: Service;
  accent: string;
  light: boolean;
  dim: string;
}) {
  const cellBg = light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.055)";
  const cellBorder = light ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.09)";
  const iconTint = light
    ? "color-mix(in srgb, " + accent + " 12%, transparent)"
    : "color-mix(in srgb, " + accent + " 22%, transparent)";
  const inkOnAccent = light ? "#ffffff" : "#16161a";
  const Lead = s.features[0].Icon; // watermark glyph in the hero cell
  const base =
    "rounded-3xl border p-5 transition-transform duration-300 will-change-transform hover:-translate-y-0.5";
  const neutral = { background: cellBg, borderColor: cellBorder };

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {/* TITLE — tall hero cell with a big faint icon watermark */}
      <div
        className={`${base} relative col-span-2 row-span-2 flex flex-col justify-between overflow-hidden`}
        style={neutral}
      >
        <Lead
          className="pointer-events-none absolute -right-5 -top-5"
          size={132}
          strokeWidth={1}
          style={{ color: accent, opacity: light ? 0.08 : 0.1 }}
        />
        <span className="relative text-[11px] font-semibold tracking-[0.32em] opacity-40">
          {s.index}
        </span>
        <h3 className="relative mt-8 text-[1.7rem] font-medium leading-[1.1] tracking-tight">
          {s.title}
        </h3>
      </div>

      {/* STAT — accent-filled cell for the colour pop */}
      <div
        className={`${base} col-span-2 flex flex-col justify-center`}
        style={{ background: accent, borderColor: "transparent", color: inkOnAccent }}
      >
        <span className="text-3xl font-semibold leading-none tracking-tight">{s.stat}</span>
        <span className="mt-1.5 text-[11px] opacity-75">{s.statLabel}</span>
      </div>

      {/* BLURB */}
      <div className={`${base} col-span-2 flex items-center`} style={neutral}>
        <p className={`text-[13px] leading-relaxed ${dim}`}>{s.blurb}</p>
      </div>

      {/* FEATURE tiles — 2 × 2 */}
      {s.features.map((f) => (
        <div
          key={f.label}
          className={`${base} col-span-2 flex items-center gap-3 !p-3.5`}
          style={neutral}
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{ background: iconTint, color: accent }}
          >
            <f.Icon size={17} strokeWidth={1.9} />
          </span>
          <span className="text-sm font-medium tracking-wide">{f.label}</span>
        </div>
      ))}
    </div>
  );
}
