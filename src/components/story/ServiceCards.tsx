"use client";

// ServiceCards — the final leg of the home scroll story. Driven by a single
// `progress` (0 → 1) that is scrubbed off the page scroll, it walks through the six
// services: the background photo AND the deep-blue panel both wipe with a clip mask
// (in from the left, holds, then draw away to the right as the next one arrives) — no
// crossfade. Scroll up and the whole thing runs in reverse for free.
//
// The card visual matches the standalone /services page so the two stay in sync.
import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import Logo from "@/components/Logo";
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
  bg: string;
};

const SERVICES: Service[] = [
  {
    index: "01",
    title: "Airport Transfers",
    blurb:
      "Smooth pickups and arrivals across Lagos and Abuja airports. Your chauffeur tracks every flight and waits at arrivals, so you walk straight into a calm, ready car.",
    stat: "24/7",
    statLabel: "availability",
    features: [
      { label: "Meet & greet", Icon: Handshake },
      { label: "Flight tracking", Icon: Plane },
      { label: "Luggage help", Icon: Luggage },
      { label: "Round the clock", Icon: Clock },
    ],
    // the first card lands ON the revealed city scene (same photo), so it's
    // continuous with the hero reveal rather than cutting to a different image.
    bg: "/images/FORNT-BG.webp",
  },
  {
    index: "02",
    title: "Wedding Transportation",
    blurb:
      "Elegant cars that make the big day feel completely effortless. From the bridal entrance to guest shuttles, every detail is styled and timed so you simply enjoy the moment.",
    stat: "100%",
    statLabel: "styled",
    features: [
      { label: "Bridal cars", Icon: Heart },
      { label: "Ribbon styling", Icon: Sparkles },
      { label: "Trained chauffeurs", Icon: UserCheck },
      { label: "Guest shuttles", Icon: Users },
    ],
    bg: "https://picsum.photos/seed/apexride-wedding/1920/1080",
  },
  {
    index: "03",
    title: "Corporate Events",
    blurb:
      "Dependable transport for meetings, conferences and visiting clients. Executive sedans arrive early, every itinerary is planned ahead, and billing stays clean for your company.",
    stat: "On time",
    statLabel: "every trip",
    features: [
      { label: "Executive sedans", Icon: Car },
      { label: "Punctual pickups", Icon: Timer },
      { label: "Flexible booking", Icon: CalendarCheck },
      { label: "Corporate billing", Icon: ReceiptText },
    ],
    bg: "https://picsum.photos/seed/apexride-corporate/1920/1080",
  },
  {
    index: "04",
    title: "Group Transportation",
    blurb:
      "Comfortable rides for groups of any size, all travelling together. We coordinate the seating, route and timing so everyone arrives at the same place at the same moment.",
    stat: "32",
    statLabel: "seats",
    features: [
      { label: "Up to 32 seats", Icon: Users },
      { label: "Group rates", Icon: Percent },
      { label: "Route planning", Icon: Route },
      { label: "Seasoned drivers", Icon: BadgeCheck },
    ],
    bg: "https://picsum.photos/seed/apexride-group/1920/1080",
  },
  {
    index: "05",
    title: "City Tours",
    blurb:
      "Discover Lagos and Abuja with a knowledgeable local guide. Explore the landmarks, hidden corners and culture at your own pace, on a route shaped around what you want to see.",
    stat: "Local",
    statLabel: "guides",
    features: [
      { label: "Local guides", Icon: Compass },
      { label: "Custom routes", Icon: MapIcon },
      { label: "Top landmarks", Icon: Landmark },
      { label: "Cultural stops", Icon: Camera },
    ],
    bg: "https://picsum.photos/seed/apexride-citytours/1920/1080",
  },
  {
    index: "06",
    title: "Executive Travel",
    blurb:
      "Discreet, premium travel for executives and visiting VIPs. A dedicated chauffeur, total privacy and a flawless car come standard on every confidential journey.",
    stat: "100%",
    statLabel: "private",
    features: [
      { label: "Luxury fleet", Icon: Gem },
      { label: "Total privacy", Icon: Lock },
      { label: "Personal chauffeur", Icon: UserRound },
      { label: "VIP service", Icon: Crown },
    ],
    bg: "https://picsum.photos/seed/apexride-executive/1920/1080",
  },
];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function ServiceCards({ progress }: { progress: number }) {
  const N = SERVICES.length;
  const g = clamp01(progress);

  // Track viewport width so the cards' horizontal travel can line up with the
  // header (left-5 ≈ 20px) on the left and the Contact button (right-5) on the right.
  const [vw, setVw] = useState(1280);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const MARGIN = 20; // matches header left-5 / Contact right-5 (1.25rem)
  const cardW = Math.min(vw * 0.9, 520);
  const leftX = MARGIN; // leftmost card: its LEFT edge sits at the header's x
  const rightX = Math.max(MARGIN, vw - MARGIN - cardW); // rightmost: RIGHT edge at Contact's x
  // Phones: there isn't room to march cards across, so the card stays CENTRED and the
  // whole service (photo + panel) wipes top→down instead of left→right.
  const isMobile = vw < 640;

  // Each service owns a slot of 1/N. Cards wipe in from the left / out to the right,
  // and consecutive cards OVERLAP by 25% of a slot (the next starts as the current
  // is finishing) — the transition windows are centred on each slot boundary.
  const slot = 1 / N;
  const tw = 0.125 * slot; // half of the 25%-of-a-slot transition window

  return (
    <div className="absolute inset-0">
      {/* background photos — each service's photo WIPES with a clip mask instead of
          crossfading. Desktop: draws in from the RIGHT, sweeps to the LEFT. Phones:
          draws in from the TOP, sweeps DOWN. (The card panel wipes the same axis.) */}
      <div className="absolute inset-0">
        {SERVICES.map((s, j) => {
          const inS = j * slot - tw;
          const outE = (j + 1) * slot + tw;
          if (g < inS || g > outE) return null; // off-stage → don't paint
          const inAmt = smooth(win(g, inS, j * slot + tw));
          const outAmt = j === N - 1 ? 0 : smooth(win(g, (j + 1) * slot - tw, outE));
          // photo 0 is the hero photo handed off from the reveal — keep it fully shown
          // (no in-wipe) so the join stays seamless; it only wipes OUT when service 2 lands.
          const recede = j === 0 ? 0 : (1 - inAmt) * 100; // reveal edge recedes (in)
          const collapse = outAmt * 100; // far edge collapses in (out)
          const clip = isMobile
            ? `inset(${collapse.toFixed(2)}% 0% ${recede.toFixed(2)}% 0%)` // top→down
            : `inset(0% ${collapse.toFixed(2)}% 0% ${recede.toFixed(2)}%)`; // right→left
          return (
            <div key={s.bg} className="absolute inset-0" style={{ clipPath: clip }}>
              <Image src={s.bg} alt="" fill priority={j === 0} sizes="100vw" className="object-cover" />
            </div>
          );
        })}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
      </div>

      {/* one card per service. Desktop: marches left→right across services (leftmost
          aligns with the header, rightmost with Contact) and wipes in from the left /
          out to the right. Phones: stays CENTRED and wipes top→down. */}
      {SERVICES.map((s, j) => {
        const inS = j * slot - tw; // wipe-in window (centred on this slot's start)
        const outE = (j + 1) * slot + tw; // wipe-out window end (next slot's start)
        if (g < inS || g > outE) return null; // off-stage → don't render
        // service 01 gets NO half-cut head start: it wipes in FULLY from g=0 (a proper
        // clip-mask entrance, same as every other service), instead of appearing
        // half-revealed because its in-window straddles 0.
        const inAmt = j === 0 ? smooth(win(g, 0, 2 * tw)) : smooth(win(g, inS, j * slot + tw));
        const outAmt = j === N - 1 ? 0 : smooth(win(g, (j + 1) * slot - tw, outE));
        const reveal = (1 - inAmt) * 100; // hidden until revealed (in)
        const collapse = outAmt * 100; // collapses away as it leaves (out)
        // the PREVIOUS card softens as the next one clip-masks in over it: blur ramps
        // up with its wipe-out so the outgoing panel goes out of focus while it leaves.
        const blurPx = outAmt * 12;
        const x = N > 1 ? lerp(leftX, rightX, j / (N - 1)) : leftX;
        const blur = blurPx > 0.01 ? `blur(${blurPx.toFixed(2)}px)` : undefined;
        const cardStyle: CSSProperties = isMobile
          ? {
              left: "50%",
              transform: "translateX(-50%)", // stay centred, no horizontal march
              clipPath: `inset(${collapse.toFixed(2)}% 0% ${reveal.toFixed(2)}% 0%)`, // top→down
              filter: blur,
              willChange: blur ? "filter" : undefined,
            }
          : {
              left: `${x.toFixed(1)}px`,
              clipPath: `inset(0% ${reveal.toFixed(2)}% 0% ${collapse.toFixed(2)}%)`, // right→left
              filter: blur,
              willChange: blur ? "filter" : undefined,
            };
        return (
          <div key={s.index} className="absolute bottom-[16%] w-[90vw] max-w-[520px]" style={cardStyle}>
            <ServicePanel service={s} />
          </div>
        );
      })}
    </div>
  );
}

// The deep-blue service panel (matches the standalone /services page).
function ServicePanel({ service }: { service: Service }) {
  return (
    <div
      className="relative overflow-hidden p-8 text-white sm:p-10"
      style={{
        background: "linear-gradient(155deg, #1745d8 0%, #00209C 50%, #00135e 100%)",
        boxShadow:
          "0 36px 90px -28px rgba(0,12,80,0.78), 0 2px 8px rgba(0,12,80,0.4), inset 0 1px 0 rgba(255,255,255,0.22)",
      }}
    >
      {/* faint brand-mark watermark in the corner (replaces the old "01/02" index) */}
      <Logo
        size={160}
        color="#ffffff"
        className="pointer-events-none absolute -right-5 -top-7 select-none opacity-[0.08]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(138,162,255,0.4), transparent 70%)" }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/60">
            Signature Service
          </span>
        </div>
        <div className="text-right leading-none">
          <div className="text-3xl font-semibold tracking-tight" style={{ color: "#dde6ff" }}>
            {service.stat}
          </div>
          <div className="mt-1.5 text-[12px] uppercase tracking-wider text-white/75">{service.statLabel}</div>
        </div>
      </div>

      <h2 className="relative mt-4 text-3xl font-light leading-[1.04] tracking-tight sm:text-[2.15rem]">
        {service.title}
      </h2>
      <p className="relative mt-3.5 text-sm leading-relaxed text-white/75">{service.blurb}</p>

      <div
        className="relative my-5 h-px w-full"
        style={{
          background:
            "linear-gradient(to right, rgba(138,162,255,0.7) 0%, rgba(255,255,255,0.18) 18%, rgba(255,255,255,0.06) 100%)",
        }}
      />

      <div className="relative grid grid-cols-2 gap-2.5">
        {service.features.map((feat) => (
          <div
            key={feat.label}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
              style={{ background: "rgba(138,162,255,0.18)", color: "#cdd8ff" }}
            >
              <feat.Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
            </span>
            <span className="text-[12px] font-medium leading-tight tracking-wide text-white/90">
              {feat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
