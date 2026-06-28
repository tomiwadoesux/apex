"use client";

// Services showcase — a fixed, full-screen experience (no normal page scroll).
// A single blue "service" panel sits over the plain dark page and clip-mask
// reveals from the LEFT. One scroll gesture = one step: the current panel wipes
// away while a new one wipes in at a fresh, non-clashing position.
import { useCallback, useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { AnimatePresence, motion } from "framer-motion";
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

// power4 inOut — matches the easing used elsewhere in the app.
const EASE = [0.76, 0, 0.24, 1] as const;
const ACCENT = "#2A4FD0"; // brand blue (light mode)
const PANEL_BG = "#00209C"; // the deep blue square from the mock
const WIPE_S = 1.2; // card draw-in / draw-out (s) — a touch slower, more deliberate
const STEP_LOCK_MS = 1800; // one scroll = one step; hold the card before the next

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
  },
  {
    index: "02",
    title: "Airport Transfers",
    blurb:
      "Smooth pickups and arrivals across Lagos and Abuja airports. Your chauffeur tracks every flight and waits at arrivals, so you walk off the plane straight into a calm, ready car.",
    stat: "24/7",
    statLabel: "availability",
    features: [
      { label: "Meet & greet", Icon: Handshake },
      { label: "Flight tracking", Icon: Plane },
      { label: "Luggage help", Icon: Luggage },
      { label: "Round the clock", Icon: Clock },
    ],
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
  },
  {
    index: "05",
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
  },
  {
    index: "06",
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
  },
];

type Pos = { left: number; top: number };

// Top-left anchors (viewport %) spread around the screen; the next panel lands
// at a random one kept FAR from the current so the two never visually clash.
// Kept in an upper-middle band (top 16–34%) so the taller card never runs off
// the bottom or into the Book Now bar; the spread is mostly horizontal.
const POSITIONS: Pos[] = [
  { left: 6, top: 18 },
  { left: 56, top: 16 },
  { left: 58, top: 34 },
  { left: 8, top: 34 },
  { left: 37, top: 26 },
  { left: 50, top: 24 },
  { left: 14, top: 24 },
];

const dist = (a: Pos, b: Pos) => Math.hypot(a.left - b.left, a.top - b.top);
function pickPosition(current: Pos): Pos {
  const far = POSITIONS.filter((p) => dist(p, current) > 28);
  const pool = far.length ? far : POSITIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

const CONTACTS = [
  { label: "Email", value: "contact@apexride.com", href: "mailto:contact@apexride.com" },
  { label: "WhatsApp", value: "+234 800 000 0000", href: "https://wa.me/2348000000000" },
  { label: "Instagram", value: "@apexride", href: "https://instagram.com/apexride" },
];

// A feature icon — static (entrance + idle animations removed).
function FeatureIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="grid place-items-center">
      <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
    </span>
  );
}

export default function ServicesPage() {
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<Pos>(POSITIONS[0]); // deterministic first render (no SSR mismatch)
  const [mobile, setMobile] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const lockRef = useRef(false);

  // Advance/retreat one service. The lock makes a single scroll == a single step.
  const go = useCallback((dir: number) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setIndex((i) => (i + dir + SERVICES.length) % SERVICES.length);
    setPos((p) => pickPosition(p));
    setTimeout(() => {
      lockRef.current = false;
    }, STEP_LOCK_MS);
  }, []);

  // Lock body scroll — this page owns the wheel/touch gesture instead.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Wheel / touch / keyboard all drive the same one-step-per-gesture advance.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 6) return;
      go(e.deltaY > 0 ? 1 : -1);
    };
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY == null) return;
      const dy = e.changedTouches[0].clientY - touchY;
      touchY = null;
      if (Math.abs(dy) > 40) go(dy < 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setContactOpen(false);
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [go]);

  const service = SERVICES[index];
  // On phones the panel just centres (no room to scatter); desktop scatters it.
  const panelPos: Pos = mobile ? { left: 11, top: 26 } : pos;

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-neutral-950 text-white select-none">
      {/* ── Header (landing-style, light mode, whitened for the dark backdrop) ── */}
      <div className="pointer-events-none fixed left-5 top-5 z-40 flex items-center gap-2.5">
        <Logo size={32} color="#ffffff" accent={ACCENT} />
        <h4 className="text-sm font-bold uppercase tracking-[0.08em] text-white">
          Apex<span className="font-semibold" style={{ color: "#8aa2ff" }}>Ride</span>
        </h4>
      </div>
      <div className="fixed right-5 top-5 z-40">
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="pointer-events-auto inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-semibold tracking-wide transition-[filter,transform] duration-150 hover:brightness-[1.05] active:translate-y-px"
          style={{
            background: "#2A4FD0",
            borderColor: "#16308f",
            color: "#ffffff",
            boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)",
          }}
        >
          Contact Us
        </button>
      </div>

      {/* Page title — top centre */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex flex-col items-center px-6 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/55">
          Our Services
        </div>
        <h1 className="mt-2.5 text-4xl font-light leading-[1.04] tracking-tight sm:text-5xl">
          What we do best.
        </h1>
      </div>

      {/* ── The blue service panel — clip-mask reveal from the LEFT. On each step
            the old one retracts left while the new one draws in from the left. ── */}
      <div className="pointer-events-none absolute inset-0 z-30">
        <AnimatePresence>
          <motion.div
            key={index}
            className="absolute w-[90vw] max-w-[520px]"
            style={{ left: `${panelPos.left}%`, top: `${panelPos.top}%` }}
            initial={{ clipPath: "inset(0% 100% 0% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: WIPE_S, ease: EASE } }}
            exit={{ clipPath: "inset(0% 100% 0% 0%)", transition: { duration: WIPE_S, ease: EASE } }}
          >
            {/* Sharp-cornered (no rounded bg) deep-blue card; layered gradient,
                glow + sheen, with the service's full set of offerings. */}
            <div
              className="relative overflow-hidden p-8 sm:p-10"
              style={{
                background: "linear-gradient(155deg, #1745d8 0%, #00209C 50%, #00135e 100%)",
                color: "#ffffff",
                boxShadow:
                  "0 36px 90px -28px rgba(0,12,80,0.78), 0 2px 8px rgba(0,12,80,0.4), inset 0 1px 0 rgba(255,255,255,0.22)",
              }}
            >
              {/* soft accent glow in the top-left corner */}
              <div
                aria-hidden
                className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(138,162,255,0.4), transparent 70%)" }}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold lowercase tracking-[0.18em] text-white/60">
                    signature service
                  </span>
                </div>
                <div className="text-right leading-none">
                  <div className="text-xl font-semibold tracking-tight" style={{ color: "#cdd8ff" }}>
                    {service.stat}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-white/50">
                    {service.statLabel}
                  </div>
                </div>
              </div>

              <h2 className="relative mt-4 text-3xl font-light leading-[1.04] tracking-tight sm:text-[2.15rem]">
                {service.title}
              </h2>
              <p className="relative mt-3.5 text-sm leading-relaxed text-white/75">
                {service.blurb}
              </p>

              {/* hairline divider with an accent lead-in */}
              <div
                className="relative my-5 h-px w-full"
                style={{
                  background:
                    "linear-gradient(to right, rgba(138,162,255,0.7) 0%, rgba(255,255,255,0.18) 18%, rgba(255,255,255,0.06) 100%)",
                }}
              />

              {/* full offering set — 2 × 2 bordered tiles */}
              <div className="relative grid grid-cols-2 gap-2.5">
                {service.features.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.1]"
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                      style={{ background: "rgba(138,162,255,0.18)", color: "#cdd8ff" }}
                    >
                      <FeatureIcon Icon={f.Icon} />
                    </span>
                    <span className="text-[12px] font-medium leading-tight tracking-wide text-white/90">
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Book Now — centred over the image */}
      <div className="pointer-events-none fixed inset-x-0 bottom-12 z-40 flex justify-center">
        <a
          href="/form"
          className="pointer-events-auto inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-semibold tracking-wide transition-[filter,transform] duration-150 hover:brightness-[1.05] active:translate-y-px"
          style={{
            background: "#2A4FD0",
            borderColor: "#16308f",
            color: "#ffffff",
            boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)",
          }}
        >
          Book Now
        </a>
      </div>

      {/* Contact popup */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6 backdrop-blur-md"
          onClick={() => setContactOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/15 bg-neutral-900/85 p-7 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "#8aa2ff" }}>
              ApexRide
            </div>
            <h3 className="mt-2 text-2xl font-light tracking-tight">Get in touch</h3>
            <div className="mt-5 flex flex-col gap-2.5">
              {CONTACTS.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition-colors duration-200 hover:bg-white/[0.08]"
                >
                  <span className="text-white/55">{c.label}</span>
                  <span className="font-semibold">{c.value}</span>
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setContactOpen(false)}
              className="mt-6 w-full rounded-full bg-white/10 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-colors duration-200 hover:bg-white/15"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
