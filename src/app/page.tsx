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
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Logo from "@/components/Logo";
import CityReveal from "@/components/city/CityReveal";
import ServiceCards from "@/components/story/ServiceCards";
import { ContactPopup } from "@/components/ContactPopup";
import QuickBooking from "@/components/QuickBooking";
type Theme = "light" | "dark";

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
function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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
  // inner sheen + a soft drop shadow so the pills lift off busy photography;
  // the accent slab gets a blue glow instead of a neutral one.
  const sheen = isAccent
    ? "inset 0 1px 0 rgba(255,255,255,0.28), 0 16px 34px -14px rgba(42,79,208,0.65)"
    : dark
    ? "inset 0 1px 0 rgba(255,255,255,0.14), 0 16px 34px -16px rgba(0,0,0,0.6)"
    : "inset 0 1px 0 rgba(255,255,255,0.9), 0 16px 34px -16px rgba(0,0,0,0.35)";
  return (
    <a
      href={href}
      onClick={onClick}
      className="group pointer-events-auto relative inline-flex h-11 items-center gap-2.5 overflow-hidden rounded-full border px-6 text-sm font-semibold tracking-wide transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-px"
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
      <span className="relative z-[1] whitespace-nowrap">{label}</span>
    </a>
  );
}

// Client voices shown at the foot of the full-screen footer — revived from the
// old 3D landing. Kept short so three cards stack cleanly on mobile.
const TESTIMONIALS = [
  {
    name: "Adeola Balogun",
    role: "Airport transfers",
    message:
      "Spotless cars and a chauffeur who made the airport run effortless. The only service I trust in Lagos now.",
  },
  {
    name: "Chidi Okeke",
    role: "Wedding hire",
    message:
      "Booked the fleet for our wedding — every car arrived early, beautifully styled, and the drivers were impeccable.",
  },
  {
    name: "Funke Adeyemi",
    role: "Corporate travel",
    message:
      "Discreet, professional and always on time for my corporate travel. Genuinely a class above the rest.",
  },
];

// A single testimonial — a frosted-glass card on the dark footer: a gold 5-star
// rating, the quote, a hairline divider, then a neutral monogram + name + role.
function TestimonialCard({ name, role, message }: { name: string; role: string; message: string }) {
  const words = name.trim().split(/\s+/);
  const initials = (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
  return (
    <figure
      className="relative flex h-full flex-col overflow-hidden rounded-[28px] border p-6 text-left sm:p-7"
      style={{
        // solid fill (no backdrop-blur): the footer behind is opaque anyway, so
        // the blur added nothing but scroll-time compositing lag during the reveal.
        background: "linear-gradient(155deg, #23262f 0%, #14161c 100%)",
        borderColor: "rgba(255,255,255,0.12)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 20px 56px rgba(0,0,0,0.32)",
      }}
    >
      <div aria-label="Rated 5 out of 5" style={{ color: "#f5b50a", fontSize: "13px", letterSpacing: "3px", lineHeight: 1 }}>
        ★★★★★
      </div>
      <blockquote className="relative mt-4 flex-1 text-[14px] leading-[1.7] text-white/85 sm:text-[15px]">{message}</blockquote>
      <div
        aria-hidden
        className="relative my-5 h-px w-full"
        style={{ background: "linear-gradient(to right, rgba(255,255,255,0.16), transparent)" }}
      />
      <figcaption className="relative flex items-center gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border text-[13px] font-semibold tracking-wide text-white"
          style={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.14)" }}
        >
          {initials}
        </span>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-white">{name}</div>
          <div className="mt-0.5 text-[12px] text-white/55">{role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

// A round glass arrow that pages the testimonial row. Dims + disables itself
// when there's nothing further to scroll in that direction.
function CarouselArrow({ dir, onClick, disabled }: { dir: -1 | 1; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "Previous testimonial" : "Next testimonial"}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-all duration-200 hover:border-white/30 hover:bg-white/15 disabled:cursor-default disabled:opacity-25"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dir === -1 ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

// The footer testimonials: a centred label over the card row — ONE card per view
// on mobile, paged with arrows underneath; all three in a row on desktop. Each
// card rises out of a 3D recline + side-fan as the footer reveals, and reverses
// on scroll up.
function TestimonialsCarousel({ atFooter }: { atFooter: boolean }) {
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
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="w-full" style={{ opacity: atFooter ? 1 : 0, transition: "opacity 500ms ease-out 120ms" }}>
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/55">What our clients say</p>
      <div
        ref={scrollRef}
        data-lenis-prevent
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
        style={{ perspective: "1100px", perspectiveOrigin: "center" }}
      >
        {TESTIMONIALS.map((t, i) => {
          // -1 (left) … 0 (centre) … +1 (right): drives the fan direction.
          const offset = i - (TESTIMONIALS.length - 1) / 2;
          return (
            <div
              key={t.name}
              className="w-full max-w-full shrink-0 snap-center sm:w-auto sm:max-w-none sm:flex-1"
              style={{
                opacity: atFooter ? 1 : 0,
                // rotateX = the recline standing up (hinged at the bottom);
                // rotateY = the per-side fan; settles flat.
                transform: atFooter ? "none" : `rotateX(48deg) rotateY(${offset * 30}deg) translateY(26px)`,
                transformOrigin: "center bottom",
                transition: "opacity 600ms ease-out 150ms, transform 800ms cubic-bezier(0.22, 1, 0.36, 1) 150ms",
                willChange: "transform, opacity",
              }}
            >
              <TestimonialCard name={t.name} role={t.role} message={t.message} />
            </div>
          );
        })}
      </div>
      {/* pager arrows — phones only; desktop shows all three cards at once */}
      <div className="mt-5 flex items-center justify-center gap-3 sm:hidden">
        <CarouselArrow dir={-1} disabled={!canLeft} onClick={() => page(-1)} />
        <CarouselArrow dir={1} disabled={!canRight} onClick={() => page(1)} />
      </div>
    </div>
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
  "mx-auto whitespace-nowrap text-[clamp(1.4rem,8vw,6.5rem)] sm:text-[clamp(1.4rem,6vw,6.5rem)] font-light! leading-[0.92] tracking-tight text-white first-letter:text-[1em]";

export default function Home() {
  const theme: Theme = "light"; // site is light-mode only
  const [contactOpen, setContactOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false); // Quick Booking popup (progress persists while closed)
  const [reveal, setReveal] = useState(false); // on-load intro (headline stands up + fleet in)
  const [p, setP] = useState(0); // scroll progress 0..1 across the pinned story
  const [fr, setFr] = useState(0); // footer reveal 0..1 — triggers the testimonials' 3D entrance
  const [bgLoaded, setBgLoaded] = useState(false); // full city photo (FORNT-BG) decoded
  const [scrollPct, setScrollPct] = useState(0); // whole-page scroll 0..1 → accent scroll bar fill
  const spacerRef = useRef<HTMLDivElement>(null);

  // Baked hero offsets (the live tuners these were dialled in with are gone).
  const HERO_Y = -280; // headline raised into the upper third (px)
  const BUTTONS_Y = -96; // CTA row + sub-label dropped low in the hero (px)

  // ── Contact popup lives in <ContactPopup/> (shared with the booking form). We just
  // track open/closed here and hand it the header logo for the fly-to-popup animation.
  const headerLogoRef = useRef<HTMLSpanElement>(null);
  const HEAD_LOGO = 32; // header glyph height in px

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
    // Footer reveal: progress of scrolling PAST the story into the footer.
    // Triggers the testimonials' 3D entrance and reverses on scroll up.
    const ft = ScrollTrigger.create({
      trigger: spacerRef.current,
      start: "bottom bottom",
      end: "bottom 55%",
      onUpdate: (self) => setFr(self.progress),
    });
    return () => {
      st.kill();
      ft.kill();
    };
  }, []);

  const isLight = theme === "light"; // light-mode only, but the popup keeps its ternaries
  const accent = "#2A4FD0";

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
  // The fleet PNG and the full bg photo are the SAME aligned scene, so rather than the
  // cutout masking/splitting itself away, it simply FADES out on the reveal's tail —
  // dissolving into the identical photo behind it so the two read as one image. Held
  // until the bg has loaded so it never fades to an empty frame.
  const carFade = bgLoaded ? smooth(win(introP, 0.82, 1.0)) : 0; // 0 = solid, 1 = gone
  // ── AFTER THE REVEAL: scroll-driven off `p` ──
  // headline crossfade: as the city photo is almost finished forming, "Ride and
  // arrive in style." blurs OUT while "Our Services" blurs IN over the same window.
  const swap = smooth(win(p, 0.12, 0.23));
  const riseUp = smooth(win(p, 0.2, 0.3)); // buttons rise
  // At REST (p≈0) the headline + pill + buttons sit as ONE cluster centred
  // vertically; as you begin to scroll they "settle" out to their story
  // positions (headline up top, CTAs low) so the service cards have room.
  const settle = smooth(win(p, 0.0, 0.14));
  // the service cards walk-through (a bit slower); the first card lands ON the city
  // photo right as the reveal finishes; the scroll line fades first.
  const cardsProgress = win(p, 0.16, 1.0);
  const cardsIn = smooth(win(p, 0.16, 0.22)); // settle fast so service 01 holds (not fading through its whole slot)

  // headline / brand ink: the hero photo carries a black scrim from the start,
  // so the ink stays WHITE through the whole story.
  const headInk = "#f3f5fa";

  return (
    <main className="relative w-full">
      {/* tall spacer sets the scroll length; the stage inside stays pinned.
          It sits ABOVE the footer (z-10 + opaque stage) so the sticky footer
          below is hidden until the story scrolls up past it. */}
      <div ref={spacerRef} className="relative z-10" style={{ height: `${STORY_VH}vh`, backgroundColor: "#f6f7f9" }}>
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
              sit exactly over the city photo's cars; at the END of the intro the cutout
              simply FADES out as the full photo lands behind it, so the PNG and the
              photo read as one image (no clip / mask split). */}
          <div className="pointer-events-none absolute inset-0 z-[4]">
            {/* Preload the reveal photo so it's fetched at the SAME time as the hero
                cutout — kills the mid-scroll lag before the mask has the image.
                React 19 hoists this <link> into <head> and dedupes it; the decode
                signal (`bgLoaded`) is wired up in an effect above. */}
            <link rel="preload" as="image" href="/images/FORNT-BG.webp" fetchPriority="high" />
            <link rel="preload" as="image" href="/images/FRONT.webp" fetchPriority="high" />
            {/* The cutout is drawn through the SAME viewBox + slice mapping as
                CityReveal's photo (2688×1520, xMidYMid slice). That makes the cutout
                and the reveal photo scale and crop as ONE image at EVERY screen aspect
                ratio — so the cars stay locked together on a laptop, an external
                monitor, anything. FRONT.webp is exported at exactly 2688×1520 with the
                old (17,147) alignment nudge BAKED IN, so it sits at 0,0 as a pixel-
                perfect overlay of the reveal photo — no runtime offset to tune. */}
            <svg
              viewBox="0 0 2688 1520"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full select-none"
              aria-hidden="true"
            >
              <image
                href="/images/FRONT.webp"
                x={0}
                y={0}
                width="2688"
                height="1520"
                preserveAspectRatio="xMidYMid slice"
                style={{
                  // darken the cutout to match the dark overlay over the city photo.
                  filter: `brightness(${lerp(1, 0.6, overlayIn).toFixed(3)})`,
                  // fades out into the identical photo behind it on the reveal's tail.
                  opacity: reveal ? 1 - carFade : 0,
                  transition: "opacity 220ms linear",
                }}
              />
            </svg>
            {/* black scrim over the hero photo so the headline + CTAs pop; hands
                off with the cutout (the story's own overlays take over from there) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-black/35"
              style={{ opacity: reveal ? 1 - carFade : 0, transition: "opacity 220ms linear" }}
            />
          </div>

          {/* brand lockup — top-left (persists; ink turns white over the photo).
              Clickable site-wide convention: the logo always leads back home. */}
          <div className="pointer-events-none absolute left-5 top-5 z-30" style={{ color: headInk }}>
            <Link href="/" className="pointer-events-auto flex items-center gap-2.5">
              <span ref={headerLogoRef} className="inline-flex">
                <Logo size={HEAD_LOGO} color={headInk} accent={accent} />
              </span>
              <h4 className="text-sm font-bold uppercase tracking-[0.08em]">
                Apex
                <span className="font-semibold" style={{ color: accent }}>
                  Ride
                </span>
              </h4>
            </Link>
          </div>

          {/* Contact — top-right (persists) */}
          <div
            className="absolute right-5 top-5 z-30"
            style={{ opacity: reveal ? 1 : 0, transition: "opacity 420ms ease-out 300ms" }}
          >
            <HatchButton
              label="Contact"
              href="#contact"
              Icon={PhoneIcon}
              onClick={(e) => {
                e.preventDefault();
                setContactOpen(true);
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
            <div className="relative" style={{ top: `${lerp(-90, HERO_Y, settle).toFixed(1)}px` }}>
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

          {/* CTA sub-label — a frosted-glass pill of the three services, separated by
              accent dots. The glass flips from light to dark with the overlay
              (overlayIn) so it stays legible on both the light hero and the city
              photo, and the ink tracks headInk like the headline. Phones: sits just
              UNDER the headline (clear of the bottom buttons); sm+: above the buttons. */}
          <div
            className="pointer-events-none absolute inset-x-0 z-[26] flex justify-center px-4 bottom-[var(--pill-b)]"
            style={{
              ["--pill-b" as string]: `calc(14% + ${(60 + lerp(0, 16, riseUp) + BUTTONS_Y).toFixed(2)}px)`,
              transform: `translateY(${lerp(-30, 0, settle).toFixed(1)}vh)`,
              opacity: reveal ? 1 : 0,
              transition: "opacity 420ms ease-out 220ms",
            }}
          >
            <div
              className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 rounded-full border px-5 py-2.5 backdrop-blur-md sm:gap-x-4 sm:px-6"
              style={{
                color: headInk,
                background: "rgba(8,10,16,0.35)",
                borderColor: "rgba(255,255,255,0.16)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 34px -18px rgba(0,0,0,0.45)",
              }}
            >
              {["Airport Pickup", "Daily Chauffeur", "Interstate Transit"].map((s, i) => (
                <span key={s} className="flex items-center gap-x-3.5 sm:gap-x-4">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className="inline-block h-1 w-1 rounded-full"
                      style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                    />
                  )}
                  <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-[11px]">{s}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Buttons — anchored LOW in the hero, centred; they scroll away with the
              story like everything else on the stage. */}
          <div
            className="pointer-events-none absolute inset-x-0 z-[25] flex items-center justify-center gap-3"
            style={{
              bottom: `calc(14% + ${(lerp(0, 16, riseUp) + BUTTONS_Y).toFixed(2)}px)`,
              transform: `translateY(${lerp(-24, 0, settle).toFixed(1)}vh)`,
              opacity: reveal ? 1 : 0,
              transition: "opacity 420ms ease-out 220ms",
            }}
          >
            <HatchButton
              label="Quick booking"
              href="#quick-booking"
              Icon={BoltIcon}
              variant="dark"
              hatch={false}
              onClick={(e) => {
                e.preventDefault();
                setQuickOpen(true);
              }}
            />
            <HatchButton label="Book Now" href="/form" Icon={CalendarIcon} variant="accent" hatch={false} />
          </div>
        </div>
      </div>

      {/* FOOTER — REVEALED, not scrolled in: on sm+ it sticks to the viewport
          bottom BEHIND the story (z-0 vs the story's z-10), so the page appears
          to lift away like a curtain and expose it. On phones (where the footer
          is taller than the screen) it stays in normal flow. A blue CTA banner
          card floats over the dark navy slab; link columns beneath it; a giant
          faint brand watermark bleeds off the bottom. */}
      <footer className="relative z-10 w-full overflow-hidden sm:sticky sm:bottom-0 sm:z-0 sm:h-screen" style={{ background: "linear-gradient(180deg, #0c1017 0%, #06080d 100%)", color: "#eef1f6" }}>
        <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pb-8 pt-14 sm:h-full sm:px-10 sm:pt-10">
          {/* CTA banner — brand-blue gradient card with the same inner sheen as the CTAs */}
          <div
            className="relative overflow-hidden rounded-[1.75rem] px-7 py-9 sm:rounded-[2rem] sm:px-10 sm:py-11"
            style={{
              background: "linear-gradient(135deg, #3A60E0 0%, #2A4FD0 55%, #1B3AAE 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 24px 60px -24px rgba(42,79,208,0.55)",
            }}
          >
            {/* oversized faint logo bleeding off the card corner — slow 3D turntable spin */}
            <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 opacity-[0.1]">
              <Logo size={190} color="#ffffff" accent="#ffffff" animate="spin3d" />
            </span>

            <div className="relative flex flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/60">Apex Ride</div>
                <h2 className="mt-2 font-josefin text-3xl font-light leading-[1.06] tracking-tight text-white sm:text-4xl">
                  Ready when you are.
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
                  Chauffeur-driven rides across Lagos &amp; Abuja — booked in minutes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="/form"
                  className="inline-flex h-11 items-center gap-2.5 rounded-full bg-white px-6 text-sm font-semibold tracking-wide text-[#12234f] transition-transform duration-150 hover:scale-[1.02] active:translate-y-px"
                  style={{ boxShadow: "0 10px 24px -10px rgba(0,0,0,0.4)" }}
                >
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  Book Now
                </a>
                <a
                  href="/fleet"
                  className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/45 px-6 text-sm font-semibold tracking-wide text-white transition-colors duration-150 hover:bg-white/10"
                >
                  <CarIcon className="h-4 w-4 shrink-0" />
                  Our fleet
                </a>
              </div>
            </div>
          </div>

          {/* client voices — fill the band between the CTA card and the bottom bar;
              the cards do their 3D recline + fan entrance as the curtain lifts */}
          <div className="flex flex-1 items-center pt-10 sm:pt-6">
            <TestimonialsCarousel atFooter={fr > 0.35} />
          </div>

          {/* bottom bar — logo lockup + slim nav pinned to the very bottom */}
          <div className="mt-10 flex flex-col items-center justify-between gap-5 border-t border-white/[0.08] pt-6 pb-1 sm:flex-row">
            <Link href="/" className="inline-flex items-center gap-3">
              <Logo size={30} color="#f3f5fa" accent={accent} />
              <span className="text-sm font-bold uppercase tracking-[0.08em]">
                Apex<span className="font-semibold" style={{ color: "#8aa2ff" }}>Ride</span>
              </span>
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-sm">
              {[
                { label: "Our fleet", href: "/fleet" },
                { label: "Services", href: "/services" },
                { label: "Book a ride", href: "/form" },
                { label: "Check booking", href: "/check-booking" },
                { label: "Contact", href: "mailto:contact@apex.ayotomcs.me" },
              ].map((l) => (
                <a key={l.label} href={l.href} className="text-white/55 transition-colors hover:text-white">
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </footer>

      {/* Quick Booking — stays mounted so a closed popup resumes where it stopped;
          only a reload starts the flow over. */}
      <QuickBooking open={quickOpen} onClose={() => setQuickOpen(false)} />

      {/* Shared contact popup + flying logo (the same component the booking form uses). */}
      <ContactPopup
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        isLight={isLight}
        accent={accent}
        headerLogoRef={headerLogoRef}
        logoSize={HEAD_LOGO}
      />

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
