"use client";

// Landing page — ONE scrubbed-scroll story on a pinned stage. As you scroll the
// page (progress 0→1), the same viewport morphs through four legs:
//   1. HERO        — dot-grid + fleet, centred "Ride & arrive in style." headline,
//                    with two buttons (Book Now + Our fleet) anchored low.
//   2. MORPH       — on scroll the headline fades out; the two-button row stays as
//                    the persistent CTA and rises slightly. The fleet PNG stays
//                    pinned (never scrolls).
//   3. CITY REVEAL — <CityReveal> clips the Lagos billboards + skyline in (it only
//                    clips, never shows its own shape), concurrent with the morph;
//                    the whole CAR FULL BG photo then materialises and the fleet
//                    PNG hands off to it (see CityReveal.tsx).
//   4. SERVICES    — <ServiceCards> crossfades a photo per service while a blue
//                    panel wipes in from the left (mirrors the /services page).
// Everything is a pure function of scroll progress, so scrolling back reverses it.
// Phase windows live in the timeline block inside Home() — tune them there.

import { useState, useEffect, useRef, type ComponentType, type MouseEvent, type CSSProperties } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Logo, { LOGO_W, LOGO_H } from "@/components/Logo";
import CityReveal from "@/components/city/CityReveal";
import ServiceCards from "@/components/story/ServiceCards";
type Theme = "light" | "dark";

// ---- contact-popup icons ----
function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.32 2.04 1.62 3.62 3.5 3.92v2.45c-1.3 0-2.55-.42-3.6-1.16v6.36c0 3.18-2.58 5.73-5.7 5.73S5 17.65 5 14.47s2.58-5.73 5.7-5.73c.3 0 .6.02.88.07v2.5a3.2 3.2 0 1 0 2.32 3.08V3h2.6z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="m3.6 6.5 8.4 6 8.4-6" />
    </svg>
  );
}

// A tappable contact detail. Tapping the text pops a TINY two-action menu right under
// it — the primary action (Call for a number, Send mail for an address) + Copy — kept
// compact and centred so it stays fully on-screen on mobile. Closes on outside tap.
function ContactDetail({
  kind,
  value,
  accent,
  isLight,
  className,
}: {
  kind: "mail" | "phone";
  value: string;
  accent: string;
  isLight: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const href = kind === "mail" ? `mailto:${value}` : `tel:${value.replace(/[^+\d]/g, "")}`;
  const PrimaryIcon = kind === "mail" ? MailIcon : PhoneIcon;
  const primaryLabel = kind === "mail" ? "Send mail" : "Call";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1000);
  };

  const itemCls = `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium leading-none transition-colors ${
    isLight ? "text-neutral-700 hover:bg-neutral-900/[0.06]" : "text-white/80 hover:bg-white/10"
  }`;

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group inline-flex items-center gap-1 tracking-tight transition-colors hover:opacity-70 ${className ?? ""}`}
        style={open ? { color: accent } : undefined}
      >
        <span className="underline decoration-[1.5px] decoration-neutral-300 underline-offset-[5px] transition-colors group-hover:decoration-neutral-500">
          {value}
        </span>
        {/* up-right "go" arrow on the right of the value */}
        <svg
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </button>

      {/* tiny action menu — sits just under the text, above the rest of the card */}
      <span
        role="menu"
        className="absolute left-1/2 top-full z-[25] mt-2 flex items-center gap-0.5 rounded-xl border p-1 shadow-xl"
        style={{
          background: isLight ? "rgba(255,255,255,0.98)" : "rgba(28,30,38,0.98)",
          borderColor: isLight ? "rgba(12,18,34,0.08)" : "rgba(255,255,255,0.12)",
          opacity: open ? 1 : 0,
          transform: open ? "translateX(-50%) translateY(0) scale(1)" : "translateX(-50%) translateY(-4px) scale(0.95)",
          transformOrigin: "top center",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 160ms ease-out, transform 160ms ease-out",
          whiteSpace: "nowrap",
        }}
      >
        <a href={href} className={itemCls} style={{ color: accent }} onClick={() => setOpen(false)}>
          <PrimaryIcon className="h-3.5 w-3.5" />
          {primaryLabel}
        </a>
        <span className="h-4 w-px" style={{ background: isLight ? "rgba(12,18,34,0.1)" : "rgba(255,255,255,0.14)" }} />
        <button type="button" className={itemCls} onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
    </span>
  );
}

// Primary CTA — flat accent fill, no gradient or sheen. Accent per mode:
// light → brand blue, dark → brand yellow.
function GlossButton({
  label,
  href,
  Icon,
  onClick,
  isLight,
  float = false,
  variant = "solid",
}: {
  label: string;
  href: string;
  Icon?: ComponentType<{ className?: string }>;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  isLight: boolean;
  float?: boolean;
  variant?: "solid" | "outline";
}) {
  // Flat accent fill matching the buttons on the services page; accent flips per theme.
  const g = isLight
    ? { fill: "#2A4FD0", border: "#16308f", ink: "#ffffff", accent: "#00209C" }
    : { fill: "#FDBA16", border: "#c98800", ink: "#1a1205", accent: "#FDBA16" };

  const base =
    "pointer-events-auto inline-flex h-11 items-center justify-center gap-2 rounded-full border px-6 text-sm font-semibold tracking-wide transition-[filter,transform,background-color] duration-150 active:translate-y-px";
  const isOutline = variant === "outline";
  const cls = isOutline
    ? `${base} bg-transparent ${isLight ? "hover:bg-[#00209C]/10" : "hover:bg-[#FDBA16]/10"}`
    : `${base} hover:brightness-[1.05] active:brightness-95`;
  const style = isOutline
    ? { borderColor: g.accent, color: g.accent }
    : {
        background: g.fill,
        borderColor: g.border,
        color: g.ink,
      };

  const button = (
    <a href={href} onClick={onClick} className={cls} style={style}>
      {Icon ? <Icon /> : null}
      {label}
    </a>
  );
  if (!float) return button;
  return (
    <span style={{ display: "inline-block", animation: "gloss-float 2.8s ease-in-out infinite" }}>
      <style>{`@keyframes gloss-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
      {button}
    </span>
  );
}

// ---- CTA icons (sit to the LEFT of the label inside HatchButton) ----
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}
function CarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

// Square CTA — a black or white slab with a faint diagonal hatch that slides on
// hover (the "interactive" bit) and an icon set to the left of the label.
function HatchButton({
  label,
  href,
  Icon,
  onClick,
  variant = "dark",
  hatch = false,
}: {
  label: string;
  href: string;
  Icon?: ComponentType<{ className?: string }>;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  variant?: "dark" | "light" | "accent";
  hatch?: boolean;
}) {
  const dark = variant === "dark";
  const isAccent = variant === "accent";
  // A very subtle "realistic" vertical gradient — a touch lighter at the top,
  // a touch darker at the foot — so the slab reads as a physical surface rather
  // than a flat fill. Paired with a hairline top sheen for the same reason.
  const bg = isAccent
    ? "linear-gradient(180deg, #3A60E0 0%, #2A4FD0 100%)"
    : dark
    ? "linear-gradient(180deg, #242424 0%, #090909 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #e8e8e8 100%)";
  const ink = isAccent || dark ? "#ffffff" : "#0a0a0a";
  const line = isAccent ? "rgba(255,255,255,0.14)" : dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)";
  const border = isAccent ? "rgba(15,32,110,0.5)" : dark ? "rgba(255,255,255,0.16)" : "rgba(10,10,10,0.18)";
  const sheen = isAccent ? "inset 0 1px 0 rgba(255,255,255,0.28)" : dark ? "inset 0 1px 0 rgba(255,255,255,0.14)" : "inset 0 1px 0 rgba(255,255,255,0.9)";
  return (
    <a
      href={href}
      onClick={onClick}
      className="group pointer-events-auto relative inline-flex h-11 items-center gap-2.5 overflow-hidden rounded-lg border px-6 text-sm font-semibold tracking-wide transition-transform duration-150 active:translate-y-px"
      style={{ background: bg, color: ink, borderColor: border, boxShadow: sheen }}
    >
      {/* diagonal hatch — oversized so it can slide on hover without exposing an edge */}
      {hatch ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-8 transition-transform duration-700 ease-out group-hover:translate-x-3 group-hover:-translate-y-3"
          style={{ backgroundImage: `repeating-linear-gradient(45deg, ${line} 0, ${line} 1px, transparent 1px, transparent 16px)` }}
        />
      ) : null}
      {Icon ? <Icon className="relative z-[1] h-4 w-4 shrink-0" /> : null}
      <span className="relative z-[1]">{label}</span>
    </a>
  );
}

// Minor connector words stay lowercase + normal size; only the "real" words get the
// enlarged capital initial, so the line reads like a title (Ride … Arrive … Style)
// rather than forcing every word — including "and" / "in" — up to a capital.
const MINOR_WORDS = new Set(["and", "in", "of", "the", "a", "an", "to", "or", "for", "on", "at"]);

// The hero headline: each word starts LYING on the floor (rotateX 90°, hinged on
// its bottom edge under CSS perspective) and stands up, staggered left → right,
// the instant `reveal` flips.
function StandUpHeadline({ text, reveal, className, style }: { text: string; reveal: boolean; className?: string; style?: CSSProperties }) {
  const words = text.split(" ");
  return (
    <h1 className={className} style={{ perspective: "640px", ...style }}>
      {words.map((w, i) => {
        // each major word starts like a new sentence: its first letter is capitalised
        // AND enlarged (1.35em — matching the global h1::first-letter treatment,
        // which we neutralise to 1em in the className so only THESE per-word
        // initials are big). Minor words keep their source casing and stay 1em.
        const minor = MINOR_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ""));
        const head = minor ? w.charAt(0) : w.charAt(0).toUpperCase();
        const tail = w.slice(1);
        return (
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
              <span style={{ fontSize: minor ? "1em" : "1.35em" }}>{head}</span>
              {tail}
            </span>
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </h1>
  );
}

// ── scroll-story tuning ──
const STORY_VH = 800; // total scroll length (× viewport height) for the whole story — a touch longer so each service holds a bit before it changes
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a)); // p → [a,b] → 0..1
const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Shared hero-headline styling — one line, fluid size, white ink. It sits under a
// mix-blend "difference" wrapper, so white renders DARK on the light hero and LIGHT
// on the dark city photo (always legible). first-letter:text-[1em] neutralises the
// global h1 drop-cap so only StandUpHeadline's per-word initials stay enlarged.
// NB: `font-light!` (Tailwind v4 trailing-bang = !important) is deliberate — globals.css
// forces `h1,h2,h3 { font-weight:300 !important }`, and the v3 prefix form
// (`!font-light`) does NOT compile in v4. 300 is the lightest Josefin weight loaded, so
// this is as thin as the headline goes without adding a lighter weight in layout.tsx.
const HEADLINE_CLASS =
  "mx-auto whitespace-nowrap text-[clamp(1.4rem,6vw,6.5rem)] font-light! leading-[0.92] tracking-tight text-white first-letter:text-[1em]";

export default function Home() {
  const theme: Theme = "light"; // site is light-mode only
  const [contactOpen, setContactOpen] = useState(false);
  const [reveal, setReveal] = useState(false); // on-load intro (headline stands up + fleet in)
  const [p, setP] = useState(0); // scroll progress 0..1 across the pinned story
  const [bgLoaded, setBgLoaded] = useState(false); // full city photo (FORNT-BG) decoded
  const [scrollPct, setScrollPct] = useState(0); // whole-page scroll 0..1 → accent scroll bar fill
  const spacerRef = useRef<HTMLDivElement>(null);

  // Baked hero offsets (the live tuners these were dialled in with are gone).
  const HERO_Y = -280; // headline raised into the upper third (px)
  const BUTTONS_Y = -96; // CTA row + sub-label dropped low in the hero (px)

  // ── Contact popup: the header logo physically FLIES from its top-left spot to the
  // popup's centre-top on open, and back on cancel. It's a FLIP move with a fixed
  // clone riding ABOVE the frosted overlay — a real translate you can watch, not a
  // crossfade. We measure the header slot and the popup slot, mount the clone over the
  // header (no transition), then on the next frames glide it to the popup slot.
  const headerLogoRef = useRef<HTMLSpanElement>(null);
  const popupLogoRef = useRef<HTMLDivElement>(null);
  const [flyShown, setFlyShown] = useState(false); // clone mounted (whole flight, both ways)
  const [flyToPopup, setFlyToPopup] = useState(false); // target: popup (true) / header (false)
  const [flyAnim, setFlyAnim] = useState(false); // transition armed (off for the first placement)
  const [headerPos, setHeaderPos] = useState<{ x: number; y: number } | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const HEAD_LOGO = 32; // header / clone glyph height in px
  const LOGO_PX_W = (HEAD_LOGO * LOGO_W) / LOGO_H; // its width, from the glyph aspect ratio

  const measureLogos = () => {
    const h = headerLogoRef.current?.getBoundingClientRect();
    const q = popupLogoRef.current?.getBoundingClientRect();
    if (h) setHeaderPos({ x: h.left, y: h.top });
    if (q) setPopupPos({ x: q.left, y: q.top });
  };

  const openContact = () => {
    measureLogos();
    setContactOpen(true);
    setFlyShown(true);
    setFlyAnim(false);
    setFlyToPopup(false); // mount the clone over the header slot first…
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setFlyAnim(true);
        setFlyToPopup(true); // …then glide it to the popup's centre-top
      }),
    );
  };

  const closeContact = () => {
    setContactOpen(false);
    setFlyAnim(true);
    setFlyToPopup(false); // glide back to the header; the clone unmounts on transitionend
  };

  // Trigger the on-load intro on the next frame.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReveal(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Whole-page scroll progress (0 at the very top → 1 at the very bottom) for the
  // accent scroll bar that fills top→bottom on the right edge.
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setScrollPct(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Warm the full city photo (FORNT-BG) as early as the hero cutout and flip
  // `bgLoaded` once it's actually decoded (img.decode()), so the fleet split only
  // opens onto a photo that can paint without a hitch. Same URL the
  // <link rel="preload"> warms, so it stays a single fetch. `decode()` handles the
  // already-cached case too, and we flip on reject as well so a decode hiccup never
  // permanently blocks the split.
  useEffect(() => {
    let cancelled = false;
    const done = () => !cancelled && setBgLoaded(true);
    const img = new window.Image();
    img.fetchPriority = "high";
    img.src = "/images/FORNT-BG.webp";
    img.decode().then(done, done);
    return () => {
      cancelled = true;
    };
  }, []);

  // Esc closes the contact popup; keep the flying logo's target in sync on resize.
  useEffect(() => {
    if (!contactOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeContact();
    const onResize = () => measureLogos();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [contactOpen]);

  // Scrub the page scroll into `p` with ScrollTrigger (drives the whole story —
  // the reveal scrubs IN on scroll, fast, and reverses on scroll up; no loading
  // animation, no scroll lock).
  useEffect(() => {
    if (!spacerRef.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: spacerRef.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => setP(self.progress),
    });
    return () => st.kill();
  }, []);

  const isLight = theme === "light"; // light-mode only, but the popup keeps its ternaries
  const accent = "#2A4FD0";
  const sub = "text-neutral-500";

  // ── the timeline: every visual is a pure function of scroll progress `p` ──
  // 1) the headline LEAVES and CHANGES at the same time: "Ride & arrive in style."
  //    blurs out as "See our services" blurs in (one window).
  // ── REVEAL: scroll-scrubbed and smooth (first ~16% of scroll). The landmarks scale
  //    in 1-by-1 on an ease-out, then the full photo lands; reverses on scroll up. ──
  // The reveal is scrubbed over the first 16% of scroll (was 10%) so the landmarks
  // take noticeably more scroll to arrive — i.e. they come in slower. The windows
  // below that key off "reveal finished" are shifted to match the new 0.16 end.
  const introP = win(p, 0.0, 0.16);
  const revealProgress = introP; // CityReveal: landmarks scale in 1-by-1, then full photo
  const overlayIn = smooth(win(introP, 0.6, 1.0)); // dark overlay settles as the photo lands
  const dotOut = smooth(win(introP, 0.05, 0.6)); // dot grid / vignette dim under the photo
  // fleet png clips open from the centre on the reveal's tail — held until the bg loads.
  const carSplit = bgLoaded ? smooth(win(introP, 0.82, 1.0)) : 0;
  // The cutout opens from the centre with a FEATHERED edge (a soft gradient mask,
  // not a hard inset clip) so the car dissolves outward instead of a sharp
  // rectangle edge wiping across. The image never moves — only the soft gap in the
  // mask grows. One symmetric mask on a SINGLE image (not two clipped halves) keeps
  // the join seamless at rest and avoids any translucent band down the centre.
  const splitGap = 50 * carSplit; // how far each side has opened, % from the centre
  // feather is 0 at rest (so the car stays fully solid, no centre line) then ramps
  // in fast as the split begins, so the receding edge is soft the whole way out.
  const splitFeather = 11 * smooth(Math.min(1, carSplit / 0.18)); // soft-edge width, %
  const gapL = 50 - splitGap; // inner (receding) edge of the left band
  const gapR = 50 + splitGap; // inner (receding) edge of the right band
  const carMask = `linear-gradient(to right, #000 0%, #000 ${(gapL - splitFeather).toFixed(2)}%, rgba(0,0,0,0) ${gapL.toFixed(2)}%, rgba(0,0,0,0) ${gapR.toFixed(2)}%, #000 ${(gapR + splitFeather).toFixed(2)}%, #000 100%)`;
  // ── AFTER THE REVEAL: scroll-driven off `p` ──
  // headline crossfade: as the city photo is almost finished forming, "Ride and
  // arrive in style." blurs OUT while "Our Services" blurs IN over the same window.
  const swap = smooth(win(p, 0.12, 0.23));
  const riseUp = smooth(win(p, 0.2, 0.3)); // buttons rise
  // the service cards walk-through (a bit slower); the first card lands ON the city
  // photo right as the reveal finishes; the scroll line fades first.
  const cardsProgress = win(p, 0.16, 1.0);
  const cardsIn = smooth(win(p, 0.16, 0.22)); // settle fast so service 01 holds (not fading through its whole slot)

  // headline / brand ink: dark on the light hero, fading to white as the overlay /
  // photo (dark) takes over, so the persistent "See our services" stays legible.
  const inkCh = Math.round(lerp(23, 255, overlayIn));
  const headInk = `rgb(${inkCh}, ${inkCh}, ${inkCh})`;

  return (
    <main className="relative w-full">
      {/* tall spacer sets the scroll length; the stage inside stays pinned */}
      <div ref={spacerRef} style={{ height: `${STORY_VH}vh` }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* base wash so the pinned stage is never transparent */}
          <div className="absolute inset-0 z-0" style={{ backgroundColor: "#f6f7f9" }} />

          {/* still dot-grid background (hero) — dims as the photo takes over */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              opacity: 1 - dotOut,
              backgroundImage:
                "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1.6px)",
              backgroundSize: "22px 22px",
            }}
          />

          {/* soft vignette for depth (hero) */}
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              opacity: 1 - dotOut,
              background:
                "radial-gradient(120% 120% at 50% 25%, transparent 55%, rgba(15,23,42,0.07) 100%)",
            }}
          />

          {/* CITY REVEAL — clip-only overlay; transparent until it clips the photo in */}
          <div className="pointer-events-none absolute inset-0 z-[2]">
            <CityReveal progress={revealProgress} className="h-full w-full" />
          </div>

          {/* dark overlay over the revealed photo — settles in as the reveal plays so
              the photo reads moodier and the white "See our services" stays legible */}
          <div
            className="pointer-events-none absolute inset-0 z-[3]"
            style={{
              opacity: overlayIn,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.5) 100%)",
            }}
          />

          {/* SERVICE CARDS — bg photo crossfade + blue panel wipe-ins */}
          <div
            className="absolute inset-0 z-[3]"
            style={{ opacity: cardsIn, pointerEvents: "none" }}
          >
            <ServiceCards progress={cardsProgress} />
          </div>

          {/* FRONT — the fleet (transparent) pinned in FRONT of the reveal. Its cars
              sit over the city photo's cars; at the END of the intro the cutout
              SPLITS from the centre out to the left and right (fast) as the full
              photo lands behind it — a soft FEATHERED gap opens, so it dissolves
              outward rather than a hard rectangle edge wiping across. */}
          <div className="pointer-events-none absolute inset-0 z-[4]">
            {/* Preload the reveal photo so it's fetched at the SAME time as the hero
                cutout — kills the mid-scroll lag before the mask has the image.
                React 19 hoists this <link> into <head> and dedupes it; the decode
                signal (`bgLoaded`) is wired up in an effect above. */}
            <link rel="preload" as="image" href="/images/FORNT-BG.webp" fetchPriority="high" />
            {/* eslint-disable-next-line @next/next/no-img-element -- transparent webp */}
            <img
              src="/images/FRONT.webp"
              alt="The ApexRide fleet"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full select-none object-cover"
              style={{
                // the IMAGE never moves — only the soft gap in the mask grows from
                // the centre outward, so the car appears to leave toward the left
                // and right with a feathered (not hard-cut) receding edge. No mask
                // at rest keeps the car perfectly solid (a zero-width gap could leave
                // a 1px seam at dead centre on some GPUs).
                maskImage: carSplit > 0 ? carMask : undefined,
                WebkitMaskImage: carSplit > 0 ? carMask : undefined,
                // base nudge only — aligns the cutout over the photo's cars.
                transform: "translate(0.65%, 9.7%)",
                // darken the cutout to match the dark overlay over the city photo,
                // so it reads as part of the same scene rather than a bright PNG.
                filter: `brightness(${lerp(1, 0.6, overlayIn).toFixed(3)})`,
                opacity: reveal ? 1 : 0,
                transition: "opacity 220ms linear",
              }}
            />
          </div>

          {/* brand lockup — top-left (persists; ink turns white over the photo) */}
          <div className="pointer-events-none absolute left-5 top-5 z-30 flex items-center gap-2.5" style={{ color: headInk }}>
            <span ref={headerLogoRef} className="inline-flex" style={{ visibility: flyShown ? "hidden" : "visible" }}>
              <Logo size={HEAD_LOGO} color={headInk} accent={accent} />
            </span>
            <h4 className="text-sm font-bold uppercase tracking-[0.08em]">
              Apex
              <span className="font-semibold" style={{ color: accent }}>
                Ride
              </span>
            </h4>
          </div>

          {/* Contact — top-right (persists) */}
          <div
            className="absolute right-5 top-5 z-30"
            style={{ opacity: reveal ? 1 : 0, transition: "opacity 420ms ease-out 300ms" }}
          >
            <HatchButton
              label="Contact Us"
              href="#contact"
              Icon={PhoneIcon}
              onClick={(e) => {
                e.preventDefault();
                openContact();
              }}
              variant="dark"
            />
          </div>

          {/* HERO headline — adaptive ink (headInk): DARK on the light hero, fading to
              WHITE as the dark city photo takes over, so it stays legible on both
              without the mix-blend "difference" ghosting it used to show over the busy
              photo. As the photo finishes forming the two headlines crossfade with a
              blur: "Ride and arrive in style." blurs OUT while "Our Services" blurs IN.
              The `top` offset is a relative nudge (no transform). */}
          <div
            className="pointer-events-none absolute inset-0 z-[20] flex flex-col items-center justify-center px-6 text-center"
          >
            <div className="relative" style={{ top: `${HERO_Y}px` }}>
              <div style={{ opacity: 1 - swap, filter: `blur(${(swap * 16).toFixed(2)}px)` }}>
                <StandUpHeadline
                  text="Ride and arrive in style."
                  reveal={reveal}
                  className={HEADLINE_CLASS}
                  style={{ color: headInk }}
                />
              </div>
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ opacity: swap, filter: `blur(${((1 - swap) * 16).toFixed(2)}px)` }}
              >
                <StandUpHeadline
                  text="Our Services"
                  reveal={reveal}
                  className={HEADLINE_CLASS}
                  style={{ color: headInk }}
                />
              </div>
            </div>
          </div>

          {/* CTA sub-label — sits just above the buttons and tracks the same nudges.
              Uses the same adaptive ink (headInk) as the headline: dark on the light
              hero, white over the dark city overlay — clean and legible on both, with
              no mix-blend ghosting. */}
          <span
            className="pointer-events-none absolute inset-x-0 z-[26] block whitespace-nowrap text-center text-[11px] font-medium uppercase tracking-[0.2em]"
            style={{
              bottom: `calc(14% + ${(56 + lerp(0, 16, riseUp) + BUTTONS_Y).toFixed(2)}px)`,
              color: headInk,
              opacity: reveal ? 1 : 0,
              transition: "opacity 420ms ease-out 220ms",
            }}
          >
            Airport Pickup&nbsp;&nbsp;|&nbsp;&nbsp;Daily chauffeur service&nbsp;&nbsp;|&nbsp;&nbsp;Interstate transit
          </span>

          {/* Buttons — anchored LOW in the hero, centred (decoupled from the centred
              headline so they sit well down the stage). Persist as the CTA and rise
              slightly as the headline leaves (riseUp), which folds into `bottom`
              alongside the baked BUTTONS_Y offset (no transform). */}
          <div
            className="absolute inset-x-0 z-[25] flex items-center justify-center gap-3"
            style={{
              bottom: `calc(14% + ${(lerp(0, 16, riseUp) + BUTTONS_Y).toFixed(2)}px)`,
              opacity: reveal ? 1 : 0,
              transition: "opacity 420ms ease-out 220ms",
            }}
          >
            <HatchButton label="Our fleet" href="/services" Icon={CarIcon} variant="dark" hatch={false} />
            <HatchButton label="Book Now" href="/form" Icon={CalendarIcon} variant="accent" hatch={false} />
          </div>
        </div>
      </div>

      {/* Contact popup — frosts the page and floats a glass card. Click outside / × / Esc
          to close. The card IRISES open: a clip-path circle grows from its centre (≈ the
          screen centre), so the panel morphs in from a small shape rather than just
          fading. clip-path (NOT a transform) leaves the popup logo slot's layout position
          fixed, so the flying-logo clone still lands dead-on. */}
      <div
        aria-hidden={!contactOpen}
        onClick={closeContact}
        className="fixed inset-0 z-[60] overflow-y-auto transition-opacity duration-300"
        style={{
          opacity: contactOpen ? 1 : 0,
          pointerEvents: contactOpen ? "auto" : "none",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          backgroundColor: isLight ? "rgba(226,232,240,0.45)" : "rgba(10,12,16,0.55)",
        }}
      >
        {/* full-height flex wrapper centres the card on BOTH axes at every screen size;
            if the card is taller than a short phone it grows past the viewport and the
            overlay scrolls, instead of clipping the top (the items-center overflow trap). */}
        <div className="flex min-h-full items-center justify-center p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Contact ApexRide"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm rounded-[28px] border px-7 pb-7 pt-12 text-center transition-[clip-path,opacity] duration-[460ms] ease-out"
          style={{
            background: isLight ? "#ffffff" : "#16181f",
            borderColor: isLight ? "rgba(12,18,34,0.08)" : "rgba(255,255,255,0.12)",
            boxShadow: isLight
              ? "0 40px 90px -20px rgba(15,23,42,0.28)"
              : "0 40px 90px -20px rgba(0,0,0,0.6)",
            color: isLight ? "#0c1222" : "#f3f5fa",
            clipPath: contactOpen ? "circle(150% at 50% 50%)" : "circle(0% at 50% 50%)",
            WebkitClipPath: contactOpen ? "circle(150% at 50% 50%)" : "circle(0% at 50% 50%)",
          }}
        >
          {/* logo slot — the flying clone settles here; reserves the glyph's footprint
              so the heading sits cleanly below it. */}
          <div
            ref={popupLogoRef}
            aria-hidden
            className="mx-auto mb-3"
            style={{ width: LOGO_PX_W, height: HEAD_LOGO }}
          />

          <button
            onClick={closeContact}
            aria-label="Close"
            className={`absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-lg leading-none ${
              isLight ? "text-neutral-500 hover:bg-neutral-900/5" : "text-white/55 hover:bg-white/10"
            }`}
          >
            ×
          </button>
          <h3 className="text-[1.45rem] font-semibold! leading-tight tracking-tight">Get in touch</h3>
          <p className={`mx-auto mt-2 max-w-[18rem] text-[13px] leading-relaxed ${sub}`}>
            Executive transport across Lagos and Abuja. Reach us anytime.
          </p>

          <div className="mt-5 flex flex-col items-center gap-2.5 text-[13px]">
            <ContactDetail kind="mail" value="contact@apexride.com" accent={accent} isLight={isLight} className="font-semibold" />
            <ContactDetail kind="phone" value="+234 801 234 5678" accent={accent} isLight={isLight} className="font-semibold" />
          </div>

          <div className="mx-auto mt-6 grid w-full grid-cols-2 gap-3">
            {[
              { label: "Instagram", Icon: InstagramIcon, href: "https://instagram.com/apexride", brand: "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)" },
              { label: "TikTok", Icon: TikTokIcon, href: "https://www.tiktok.com/@apexride", brand: "#0a0a0a" },
            ].map(({ label, Icon, href, brand }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className={`group flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-200 ${
                  isLight
                    ? "border-neutral-200 bg-neutral-50 hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-white hover:shadow-md"
                    : "border-white/10 bg-white/[0.04] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
                }`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-sm transition-transform duration-200 group-hover:scale-105"
                  style={{ background: brand }}
                >
                  <Icon />
                </span>
                <span className={`text-[13px] font-semibold ${isLight ? "text-neutral-800" : "text-white/90"}`}>{label}</span>
              </a>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: isLight ? "rgba(12,18,34,0.09)" : "rgba(255,255,255,0.1)" }} />
            <span className={`text-[10px] font-medium uppercase tracking-[0.18em] ${sub}`}>or send a message</span>
            <span className="h-px flex-1" style={{ background: isLight ? "rgba(12,18,34,0.09)" : "rgba(255,255,255,0.1)" }} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("name") || "");
              const phone = String(fd.get("phone") || "");
              const inquiry = String(fd.get("inquiry") || "");
              const body = `Name: ${name}\nPhone: ${phone}\n\n${inquiry}`;
              window.location.href = `mailto:contact@apexride.com?subject=${encodeURIComponent(
                `Inquiry from ${name || "a guest"}`,
              )}&body=${encodeURIComponent(body)}`;
              closeContact();
            }}
            className="grid grid-cols-2 gap-2.5 text-left"
          >
            {[
              { name: "name", type: "text", ph: "Name" },
              { name: "phone", type: "tel", ph: "Phone" },
            ].map((f) => (
              <input
                key={f.name}
                name={f.name}
                type={f.type}
                required
                placeholder={f.ph}
                className={`rounded-xl border px-3.5 py-3 text-sm outline-none transition-colors ${
                  isLight
                    ? "border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus:border-[#2A4FD0] focus:bg-white focus:ring-2 focus:ring-[#2A4FD0]/15"
                    : "border-white/12 bg-white/[0.04] placeholder:text-white/35 focus:border-white/45"
                }`}
              />
            ))}
            <textarea
              name="inquiry"
              rows={3}
              placeholder="Your inquiry"
              className={`col-span-2 resize-none rounded-xl border px-3.5 py-3 text-sm leading-relaxed outline-none transition-colors ${
                isLight
                  ? "border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus:border-[#2A4FD0] focus:bg-white focus:ring-2 focus:ring-[#2A4FD0]/15"
                  : "border-white/12 bg-white/[0.04] placeholder:text-white/35 focus:border-white/45"
              }`}
            />
            <button
              type="submit"
              className="col-span-2 mt-1 inline-flex h-11 items-center justify-center rounded-lg border text-sm font-semibold tracking-wide transition-[filter,transform] duration-150 hover:brightness-[1.05] active:translate-y-px"
              style={{
                background: "linear-gradient(180deg, #3A60E0 0%, #2A4FD0 100%)",
                color: "#ffffff",
                borderColor: "rgba(15,32,110,0.5)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
            >
              Send inquiry
            </button>
          </form>
        </div>
        </div>
      </div>

      {/* Flying logo — a fixed clone that rides ABOVE the frosted overlay (z-[70]) from
          the header's top-left slot to the popup's centre-top on open, and back on
          cancel. It's a plain translate with a transition, so the move is visible (not a
          crossfade). Unmounts once it lands back home. */}
      {flyShown && headerPos && popupPos ? (
        <div
          aria-hidden
          onTransitionEnd={() => {
            if (!flyToPopup) setFlyShown(false);
          }}
          className="pointer-events-none fixed left-0 top-0 z-[70]"
          style={{
            transform: `translate(${(flyToPopup ? popupPos : headerPos).x}px, ${(flyToPopup ? popupPos : headerPos).y}px)`,
            transition: flyAnim ? "transform 560ms cubic-bezier(0.22,1,0.36,1)" : "none",
            willChange: "transform",
          }}
        >
          <Logo size={HEAD_LOGO} color={isLight ? "#0c1222" : "#f3f5fa"} accent={accent} />
        </div>
      ) : null}

      {/* Accent scroll bar — a thin SQUARE rail pinned to the right edge whose accent
          fill grows from the top down as the page scrolls, reaching full at the bottom.
          The native scrollbar is hidden (below) so this reads as the page's scroll bar.
          Sits under the contact popup (z-[60]) so the popup covers it when open. */}
      <style>{`html{scrollbar-width:none} html::-webkit-scrollbar{width:0;height:0;display:none}`}</style>
      <div aria-hidden className="pointer-events-none fixed right-0 top-0 z-[55] h-full w-[4px] bg-neutral-900/[0.06]">
        <div
          className="w-full origin-top"
          style={{ height: `${(scrollPct * 100).toFixed(2)}%`, background: accent }}
        />
      </div>

    </main>
  );
}
