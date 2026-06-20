"use client";

// Scroll-synced service captions for the landing tour. As the camera cranes
// around the car (driven by `tourProgress`, 0..1), each service's text rises up
// out of depth — translating up from below, pulling forward in Z, un-tilting and
// un-blurring — so the words read as if they share the car's 3D space. One
// service per scroll band; the band's local 0..1 drives an enter → hold → exit
// scrub (the last one never exits, so it rests at the bottom of the page).
//
// The scrub is done by writing two CSS custom properties (--in / --out) on each
// caption every frame; CSS does the rest via calc(), so the rAF loop only
// touches two numbers per caption and never re-renders React.

import { useEffect, useRef, useState } from "react";
import {
  Plane,
  Clock,
  Handshake,
  Luggage,
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

type Feature = { label: string; Icon: LucideIcon };
type Service = {
  title: string;
  blurb: string;
  features: Feature[];
};

const SERVICES: Service[] = [
  {
    title: "Airport Transfers",
    blurb:
      "Smooth pickups and arrivals at Lagos and Abuja airports. We track your flight, meet you at the door, and handle the bags so you simply step in and go.",
    features: [
      { label: "Meet and greet", Icon: Handshake },
      { label: "Flight tracking", Icon: Plane },
      { label: "Luggage help", Icon: Luggage },
      { label: "Round the clock", Icon: Clock },
    ],
  },
  {
    title: "Wedding Transportation",
    blurb:
      "Elegant cars that make the big day effortless. From the bridal car to guest shuttles, every arrival is styled, on time, and completely stress free.",
    features: [
      { label: "Bridal cars", Icon: Heart },
      { label: "Ribbon styling", Icon: Sparkles },
      { label: "Trained chauffeurs", Icon: UserCheck },
      { label: "Guest shuttles", Icon: Users },
    ],
  },
  {
    title: "Corporate Events",
    blurb:
      "Dependable transport for meetings, conferences and corporate guests. Executive vehicles, punctual chauffeurs, and tidy billing your finance team will love.",
    features: [
      { label: "Executive sedans", Icon: Car },
      { label: "Punctual pickups", Icon: Timer },
      { label: "Flexible booking", Icon: CalendarCheck },
      { label: "Corporate billing", Icon: ReceiptText },
    ],
  },
  {
    title: "Group Transportation",
    blurb:
      "Comfortable rides for groups of any size. Up to thirty two seats with planned routes and seasoned drivers, so the whole party arrives together.",
    features: [
      { label: "Up to 32 seats", Icon: Users },
      { label: "Group rates", Icon: Percent },
      { label: "Route planning", Icon: Route },
      { label: "Seasoned drivers", Icon: BadgeCheck },
    ],
  },
  {
    title: "City Tours",
    blurb:
      "Discover Lagos and Abuja with a local guide. Custom routes through the top landmarks and the quiet corners only insiders know about.",
    features: [
      { label: "Local guides", Icon: Compass },
      { label: "Custom routes", Icon: MapIcon },
      { label: "Top landmarks", Icon: Landmark },
      { label: "Cultural stops", Icon: Camera },
    ],
  },
  {
    title: "Executive Travel",
    blurb:
      "Discreet, premium travel for executives and VIPs. A personal chauffeur, total privacy, and a luxury fleet ready whenever and wherever you are.",
    features: [
      { label: "Luxury fleet", Icon: Gem },
      { label: "Total privacy", Icon: Lock },
      { label: "Personal chauffeur", Icon: UserRound },
      { label: "VIP service", Icon: Crown },
    ],
  },
];

// Each caption is tied to the camera POSE of the same index. The camera reaches
// pose i at scroll progress i/(N-1); the caption stays HIDDEN while the camera is
// travelling toward it and only comes UP once it has ARRIVED (u ≥ i), then holds
// until the camera leaves for the next shot. RAMP is the fade length in pose
// units. The first caption is nudged a touch past pose 0 so it doesn't sit on
// top of the hero at the very top of the page.
const RAMP = 0.28;
const FIRST_CENTER = 0.45;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// smootherstep — zero velocity at both ends so the reveal never snaps
const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

// --- colour helpers for the accent-filled cards ---
function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
// darken a hex toward black by factor f (0..1; lower = darker), at alpha a
function darken(hex: string, f: number, a = 1): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)}, ${a})`;
}
// black or white ink, whichever reads better on the given fill
function readableInk(hex: string): string {
  const [r, g, b] = hexRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#16161a" : "#ffffff";
}

// Shared card chrome for the first caption's two accent-filled panels: rounded
// corners and clipping for the sheen overlay. Fill / shadow / ink are applied
// inline (they depend on the live accent colour).
const CARD_CLASS = "relative overflow-hidden rounded-3xl backdrop-blur-md";

// Per-service SLOTS: the on-screen CENTRE of each card as viewport fractions.
// The two PERSISTENT cards travel between consecutive slots as the camera moves
// from one shot to the next (they never disappear — only the text swaps).
const SLOTS: { info: [number, number]; feat: [number, number] }[] = [
  { info: [0.37, 0.5], feat: [0.63, 0.5] }, // 1 · centred, side by side
  { info: [0.8, 0.5], feat: [0.2, 0.5] }, //   2 · split to the edges
  { info: [0.2, 0.4], feat: [0.2, 0.74] }, //  3 · stacked, bottom-left
  { info: [0.8, 0.5], feat: [0.2, 0.5] }, //   4 · edges (info right, feat left)
  { info: [0.2, 0.5], feat: [0.8, 0.5] }, //   5 · edges SWAPPED — cards switch
  { info: [0.37, 0.5], feat: [0.63, 0.5] }, // 6 · centred
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// --- six perspective entrances (one per service, to pick from) --------------
// Each is a function of var(--in) (0 = entering, 1 = settled). At --in = 1 every
// recipe collapses to identity, so the RESTING card is a plain flat card with no
// perspective left — the 3D only happens during the scroll-in.
type CardFx = { transform: string; origin: string };
type Entrance = { name: string; info: CardFx; features: CardFx };
const A = "(1 - var(--in))"; // 1 while away, 0 when settled
const ENTRANCES: Entrance[] = [
  {
    name: "dolly", // flies forward along the car's Z axis
    info: { transform: `perspective(1000px) translateZ(calc(${A} * -720px))`, origin: "center" },
    features: { transform: `perspective(1000px) translateZ(calc(${A} * -560px))`, origin: "center" },
  },
  {
    name: "stand-up", // hinges up off the ground plane
    info: { transform: `perspective(900px) rotateX(calc(${A} * 86deg))`, origin: "bottom center" },
    features: { transform: `perspective(900px) rotateX(calc(${A} * 86deg))`, origin: "bottom center" },
  },
  {
    name: "yaw", // swings to face you head-on (mirrored L/R)
    info: { transform: `perspective(900px) translateZ(calc(${A} * -120px)) rotateY(calc(${A} * -42deg))`, origin: "center" },
    features: { transform: `perspective(900px) translateZ(calc(${A} * -120px)) rotateY(calc(${A} * 42deg))`, origin: "center" },
  },
  {
    name: "untilt", // lying in a low 3/4 perspective, then squares up
    info: { transform: `perspective(850px) translateZ(calc(${A} * -160px)) rotateX(calc(${A} * 32deg)) rotateY(calc(${A} * -16deg))`, origin: "center" },
    features: { transform: `perspective(850px) translateZ(calc(${A} * -160px)) rotateX(calc(${A} * 32deg)) rotateY(calc(${A} * 16deg))`, origin: "center" },
  },
  {
    name: "door", // hinges open on the inner vertical edge
    info: { transform: `perspective(1100px) rotateY(calc(${A} * -84deg))`, origin: "left center" },
    features: { transform: `perspective(1100px) rotateY(calc(${A} * 84deg))`, origin: "right center" },
  },
  {
    name: "unfold", // drops down like an awning from its top edge
    info: { transform: `perspective(900px) rotateX(calc(${A} * -92deg))`, origin: "top center" },
    features: { transform: `perspective(900px) rotateX(calc(${A} * -92deg))`, origin: "top center" },
  },
];

export default function ScrollServices({
  isLight,
  tourProgress,
}: {
  isLight: boolean;
  /** 0..1 scroll progress through the tour (mutable ref, shared with the car) */
  tourProgress: { current: number };
}) {
  // Two PERSISTENT cards, each a SINGLE element so its backdrop-blur survives:
  // positioned via left/top (no transform), morphed via clip-path (no transform),
  // faded via its OWN opacity (own-opacity doesn't break its own backdrop-filter).
  // txt = the text that cross-fades on each transition.
  const infoCard = useRef<HTMLDivElement>(null);
  const infoTxt = useRef<HTMLDivElement>(null);
  const featCard = useRef<HTMLDivElement>(null);
  const featTxt = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const uRef = useRef(0);
  // which service's TEXT is currently shown (swaps at the midpoint, text hidden)
  const [active, setActive] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const N = SERVICES.length;
    const TAU = 0.12; // motion smoothing time-constant
    const START = 0.04; // hold the cards back until the hero clears (small, to keep the later cards in sync with the camera)
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt / TAU);
      const p = clamp01(tourProgress.current ?? 0);
      // same pose param the camera uses (0..N-1), nudged past the hero
      const targetU = clamp01((p - START) / (1 - START)) * (N - 1);
      uRef.current += (targetU - uRef.current) * k;
      const u = uRef.current;

      const i = Math.min(N - 1, Math.floor(u));
      const next = Math.min(N - 1, i + 1);
      const frac = u - i; // 0..1 across the segment i → i+1

      // Each segment HOLDS first so the service is actually readable, then morphs
      // + travels, then the next text fades in:
      //   [0,0.4]   hold — square + text fully shown at slot i
      //   [0.4,0.85] box morphs to an ellipse and travels to slot i+1
      //   [0.4,0.55] old text fades out · [0.72,0.95] new text fades in
      const moveT = smooth(clamp01((frac - 0.4) / 0.45));
      const SW = 0.57; // service text swaps here (while hidden)
      const textOp =
        frac < SW
          ? 1 - smooth(clamp01((frac - 0.4) / 0.15))
          : smooth(clamp01((frac - 0.72) / 0.23));
      // hide over the hero, with a one-time rise/perspective entrance
      const reveal = smooth(clamp01((p - 0.02) / 0.08));
      // box is "settled" (flat, --in=1) at rest, perspective-morphed (--in→0)
      // mid-move; also plays the entrance as it first reveals.
      const settled = reveal * (1 - Math.sin(clamp01(moveT) * Math.PI));

      // swap the shown service only once the old text is hidden
      const act = frac < SW ? i : next;
      if (act !== activeRef.current) {
        activeRef.current = act;
        setActive(act);
      }

      const m = 1 - settled; // 0 = full rounded square · 1 = small ellipse
      const clip = `inset(${(44 * m).toFixed(2)}% ${(40 * m).toFixed(2)}% round ${(24 + 600 * m).toFixed(0)}px)`;
      const place = (
        card: HTMLDivElement | null,
        txt: HTMLDivElement | null,
        key: "info" | "feat",
      ) => {
        if (card) {
          const a = SLOTS[i][key];
          const b = SLOTS[next][key];
          // position via left/top (NO transform → backdrop-blur stays alive)
          card.style.left = `${(lerp(a[0], b[0], moveT) * 100).toFixed(2)}vw`;
          card.style.top = `${(lerp(a[1], b[1], moveT) * 100).toFixed(2)}vh`;
          // morph via clip-path (NO transform)
          card.style.clipPath = clip;
          (card.style as unknown as { webkitClipPath: string }).webkitClipPath = clip;
          card.style.opacity = reveal.toFixed(3);
        }
        if (txt) txt.style.opacity = (textOp * reveal).toFixed(3);
      };
      place(infoCard.current, infoTxt.current, "info");
      place(featCard.current, featTxt.current, "feat");

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tourProgress]);

  // No panel behind the text anymore — it floats directly over the car scene,
  // right-aligned. So every colour flips with the page mode to stay legible:
  // dark ink on the light backdrop, light ink on the dark one.
  const accent = isLight ? "#00209C" : "#FDBA16";

  // The two first-caption cards are filled with the accent colour. Pick ink that
  // reads on it, and dress the flat fill up: a top-lit gradient, a soft accent
  // glow + inner highlight, and a hairline rim that matches the ink.
  const ink = readableInk(accent);
  const cardStyle = {
    // The white "sheen" is baked into the background as stacked gradient layers
    // (topmost first) over the solid fill — NOT a separate -z element, which used
    // to vanish whenever the card hit opacity:1 and stopped forming a stacking
    // context. Layers: upper-left key light, top highlight, bottom vignette, fill.
    background: [
      "radial-gradient(120% 90% at 12% 0%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)",
      "linear-gradient(to bottom, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.03) 22%, rgba(255,255,255,0) 46%)",
      "linear-gradient(to top, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 40%)",
      darken(accent, 0.95, 0.22), // accent fill, almost transparent (frosted)
    ].join(", "),
    color: ink,
    border: `1px solid ${ink === "#ffffff" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)"}`,
    boxShadow:
      "inset 0 1px 0 0 rgba(255,255,255,0.30), 0 16px 44px -22px rgba(0,0,0,0.55)",
  };
  const dim = ink === "#ffffff" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.66)";
  const hair = ink === "#ffffff" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
  // faint tile behind each circular feature-icon badge
  const tile = ink === "#ffffff" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.09)";

  const s = SERVICES[active];
  // Static chrome. Position (left/top), shape (clip-path) and opacity are all set
  // imperatively in the loop — NONE is a CSS transform, so the card's frosted
  // backdrop-blur stays alive. Fixed size + negative margins centre the card on
  // its slot point without a transform.
  const cardChrome = {
    ...cardStyle,
    position: "absolute" as const,
    marginLeft: "-10.5rem", // ½ of w-[21rem]
    marginTop: "-10rem", //    ½ of h-[20rem]
    opacity: 0,
    willChange: "left, top, clip-path, opacity",
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[5]">
      {/* INFO card — frosted accent panel that travels between slots; text swaps */}
      <div
        ref={infoCard}
        className={`flex h-[20rem] w-[21rem] flex-col items-center justify-center px-8 text-center ${CARD_CLASS}`}
        style={cardChrome}
      >
        <div ref={infoTxt} style={{ opacity: 0 }}>
          <h2 className="text-3xl font-light leading-tight tracking-tight first-letter:text-5xl first-letter:font-normal sm:text-4xl sm:first-letter:text-6xl">
            {s.title}
          </h2>
          <span
            aria-hidden
            className="mx-auto my-5 block h-[2px] w-10 rounded-full"
            style={{ backgroundColor: hair }}
          />
          <p className="mx-auto max-w-xs text-sm leading-relaxed sm:text-[15px]" style={{ color: dim }}>
            {s.blurb}
          </p>
        </div>
      </div>

      {/* FEATURES card — frosted accent panel, travels too */}
      <div
        ref={featCard}
        className={`flex h-[20rem] w-[21rem] flex-col justify-center px-8 text-left ${CARD_CLASS}`}
        style={cardChrome}
      >
        <div ref={featTxt} style={{ opacity: 0 }}>
          <span
            className="mb-3 block text-center text-[10px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: dim }}
          >
            What&apos;s included
          </span>
          {/* clean list: circular accent-ringed icon badges + hairline rules */}
          <div className="flex flex-col">
            {s.features.map((f, i) => (
              <div
                key={f.label}
                className="flex items-center gap-3.5 py-3"
                style={i > 0 ? { borderTop: `1px solid ${hair}` } : undefined}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                  style={{
                    backgroundColor: tile,
                    color: ink,
                    border: `1px solid ${accent}59`,
                  }}
                >
                  <f.Icon size={19} strokeWidth={1.75} />
                </span>
                <span className="text-base font-medium tracking-wide">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
