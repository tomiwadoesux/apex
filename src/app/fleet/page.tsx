"use client";

// Our Fleet — pick a car. One screen, no page scroll on desktop.
//   • TOP    — "Our fleet" centred over the stage.
//   • CENTRE — the stage: a big centred car (sliding carousel) over a soft floor
//              shadow, with a giant model-name watermark behind it. Prev / next
//              arrows flank it on desktop; on touch screens the stage swipes.
//              A small FRONT / SIDE / REAR text switcher sits under the car.
//   • RIGHT  — the roster (grouped by MODEL, 3 across) with the active car's
//              details BELOW it, left-aligned to the grid: name, variant chips,
//              specs and the booking CTA. On phones the roster becomes a
//              horizontal snap strip and the details centre under the stage.
// Header matches the rest of the site: logo (links home) + Contact Us + popup.

import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";
import { GROUPS, EASE, anglesFor, type Angle } from "@/components/fleet/data";
import { Chevron } from "@/components/fleet/icons";

const ACCENT = "#2A4FD0";
const COLS = 3; // roster columns (for up / down arrow nav)
const CUSTOM = GROUPS.length; // index of the "?" custom tile
const TILES = GROUPS.length + 1;

// Site-standard pill button (matches the header / services "Contact Us").
const BTN = "inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-semibold tracking-wide transition-[filter,transform] duration-150 hover:brightness-[1.05] active:translate-y-px";
const BTN_STYLE = { background: ACCENT, borderColor: "#16308f", color: "#ffffff", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" } as const;
// Header "Contact Us" — the site-standard BLACK slab (matches home + booking form).
const CONTACT_BTN_STYLE = { background: "linear-gradient(180deg, #242424 0%, #090909 100%)", borderColor: "rgba(255,255,255,0.16)", color: "#ffffff", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)" } as const;

const CONTACTS = [
  { label: "Email", value: "contact@apex.ayotomcs.me", href: "mailto:contact@apex.ayotomcs.me" },
  { label: "WhatsApp", value: "+234 814 168 1273", href: "https://wa.me/2348141681273" },
  { label: "Instagram", value: "@apexride", href: "https://instagram.com/apexride" },
];

export default function FleetPage() {
  const reduce = useReducedMotion();
  const [gi, setGi] = useState(0); // group index; gi === CUSTOM → custom request
  const [vi, setVi] = useState(0); // variant index within the group
  const [dir, setDir] = useState(0); // carousel slide direction (+1 next, -1 prev, 0 none)
  const [angle, setAngle] = useState<Angle>("side"); // which view of the active car is on the stage
  const [angleCarKey, setAngleCarKey] = useState("0:0"); // car the current angle belongs to
  const [contactOpen, setContactOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false); // compact all-cars list popup
  // Accent scroll indicator under the phone roster strip: thumb width = the
  // visible fraction of the strip, offset = how far it's scrolled.
  const [stripBar, setStripBar] = useState({ w: 100, x: 0 });

  const gridRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const ctaRef = useRef<HTMLAnchorElement | null>(null);
  const swipeXRef = useRef<number | null>(null);

  const isCustom = gi === CUSTOM;
  const group = isCustom ? null : GROUPS[gi];
  const variant = group ? group.variants[Math.min(vi, group.variants.length - 1)] : null;
  const baseImage = variant ? variant.image ?? group!.image : null;

  // Each car starts on its side (hero) view; switching cars resets the angle.
  // Adjusting state during render — guarded by the car key — is React's
  // recommended way to derive state from other state without an effect.
  const carKey = `${gi}:${vi}`;
  if (carKey !== angleCarKey) {
    setAngleCarKey(carKey);
    setAngle("side");
  }

  // Per-angle photos for the active car (null where that angle has no shot).
  // The chosen angle falls back to the first one that exists, preferring side —
  // so cars missing a shot (e.g. Phantom has no side) still show something.
  const angles = baseImage ? anglesFor(baseImage) : null;
  const effectiveAngle: Angle = angles
    ? (angles[angle] ? angle : ((["side", "front", "rear"] as Angle[]).find((a) => angles[a]) ?? "side"))
    : "side";
  const stageImage = angles ? angles[effectiveAngle] : null;

  // Move to a tile (group or custom), remembering the slide direction.
  const goTo = (i: number, d: number) => {
    const next = ((i % TILES) + TILES) % TILES;
    setDir(d);
    setGi(next);
    setVi(0);
  };
  const go = (d: number) => goTo(gi + d, d);
  const pickVariant = (k: number) => { setDir(0); setVi(k); };
  // Angle changes cross-fade in place (no slide), so reset the slide direction.
  const pickAngle = (a: Angle) => { setDir(0); setAngle(a); };

  // Touch swipe on the stage — the natural way to browse on a phone.
  const onStageTouchStart = (e: ReactTouchEvent) => { swipeXRef.current = e.touches[0].clientX; };
  const onStageTouchEnd = (e: ReactTouchEvent) => {
    if (swipeXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeXRef.current;
    swipeXRef.current = null;
    if (Math.abs(dx) > 44) go(dx < 0 ? 1 : -1);
  };

  // Keyboard: arrows move (left/right wrap, up/down by a row), Enter confirms.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowRight") { e.preventDefault(); go(1); }
      else if (k === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (k === "ArrowDown") { e.preventDefault(); goTo(Math.min(TILES - 1, gi + COLS), 1); }
      else if (k === "ArrowUp") { e.preventDefault(); goTo(Math.max(0, gi - COLS), -1); }
      else if (k === "Enter") { ctaRef.current?.click(); }
      else if (k === "Escape") { setContactOpen(false); setListOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi]);

  // Keep the active tile in view inside the roster container.
  useEffect(() => {
    tileRefs.current[gi]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [gi]);

  // Track the roster strip's horizontal scroll for the accent indicator (phones).
  const syncStripBar = () => {
    const el = gridRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) { setStripBar({ w: 100, x: 0 }); return; }
    const frac = el.clientWidth / el.scrollWidth;
    const p = el.scrollLeft / (el.scrollWidth - el.clientWidth);
    setStripBar({ w: frac * 100, x: p * (100 - frac * 100) });
  };
  useEffect(() => {
    syncStripBar();
    window.addEventListener("resize", syncStripBar);
    return () => window.removeEventListener("resize", syncStripBar);
  }, []);

  const arrowBtn =
    "hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white/80 text-neutral-500 shadow-sm transition-colors duration-150 hover:border-neutral-900/30 hover:text-neutral-900 active:scale-95";

  // Shared roster tile chrome — active gets the brand ring, idle a quiet hairline.
  const tileClass = (active: boolean, dashed = false) =>
    `group/tile relative shrink-0 snap-center overflow-hidden rounded-xl border bg-white transition-all duration-200 ${
      active
        ? "border-transparent shadow-md shadow-[#2A4FD0]/15"
        : `${dashed ? "border-dashed border-neutral-300 hover:border-neutral-400" : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm"}`
    }`;
  const tileRing = (active: boolean) => (active ? { boxShadow: `inset 0 0 0 2px ${ACCENT}` } : undefined);

  // The active car's details. Rendered twice: centred under the stage on phones,
  // left-aligned under the roster grid on desktop (`left` + `withCtaRef`).
  const details = (left: boolean, withCtaRef: boolean): ReactNode => {
    const wrap = left ? "items-start text-left" : "items-center text-center";
    const chipsWrap = left ? "justify-start" : "justify-center";
    if (isCustom) {
      return (
        <motion.div key={`custom-${left}`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className={`flex flex-col ${wrap}`}>
          <h2 className="font-josefin text-2xl font-light leading-[1.06] tracking-tight sm:text-3xl">Not on the list?</h2>
          <p className="mt-2 max-w-sm text-sm text-neutral-500">Tell us the make, model and year you want and we will source it for your trip.</p>
          <Link ref={withCtaRef ? ctaRef : undefined} href="/form" className={`mt-4 ${BTN}`} style={BTN_STYLE}>Request a custom car</Link>
        </motion.div>
      );
    }
    return (
      <div className={`flex flex-col ${wrap}`}>
        <motion.div key={`${gi}-name-${left}`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className={`flex flex-col ${wrap}`}>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
            {variant!.year} · {variant!.type}
          </div>
          <h2 className="mt-1 font-josefin text-2xl font-light leading-[1.06] tracking-tight sm:text-3xl">{group!.name}</h2>
        </motion.div>

        {/* year / variant selector — only when the model has more than one */}
        {group!.variants.length > 1 && (
          <div className={`mt-3 flex flex-wrap gap-1.5 ${chipsWrap}`}>
            {group!.variants.map((v, k) => {
              const on = k === Math.min(vi, group!.variants.length - 1);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pickVariant(k)}
                  className="rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors"
                  style={{
                    borderColor: on ? ACCENT : "rgba(0,0,0,0.12)",
                    backgroundColor: on ? ACCENT : "transparent",
                    color: on ? "#fff" : "#525252",
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        )}

        {/* specs as quiet chips — scannable at a glance */}
        <div className={`mt-3 flex flex-wrap items-center gap-1.5 ${chipsWrap}`}>
          {variant!.specs.map((s) => (
            <span key={s} className="rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-[11px] font-medium tracking-wide text-neutral-600">
              {s}
            </span>
          ))}
        </div>

        <Link ref={withCtaRef ? ctaRef : undefined} href={`/form?car=${encodeURIComponent(variant!.name)}&year=${variant!.year}`} className={`mt-4 ${BTN}`} style={BTN_STYLE}>
          Add to booking
        </Link>
        <p className="mt-2.5 text-[11px] tracking-wide text-neutral-400">
          All vehicles chauffeur-driven · Lagos &amp; Abuja
        </p>
      </div>
    );
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#f4f6fb] text-neutral-900 lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {/* soft brand spotlight + a faint floor tint so the canvas isn't flat */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ background: "radial-gradient(78% 55% at 40% -4%, rgba(42,79,208,0.10), transparent 60%)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40" style={{ background: "linear-gradient(to top, rgba(42,79,208,0.05), transparent)" }} />

      {/* header — site standard: logo (links home) + Contact Us */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-5 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} color="#0b0d12" accent={ACCENT} />
          <span className="text-sm font-bold uppercase tracking-[0.08em]">Apex<span className="font-semibold" style={{ color: ACCENT }}>Ride</span></span>
        </Link>
        <button type="button" onClick={() => setContactOpen(true)} className={BTN} style={CONTACT_BTN_STYLE}>Contact Us</button>
      </header>

      {/* page title — top centre, sitting over the car */}
      <div className="relative z-10 shrink-0 px-5 text-center sm:px-10">
        <h1 className="font-josefin text-4xl font-light leading-none tracking-tight sm:text-5xl">Our fleet</h1>
      </div>

      {/* content — fills the rest of the screen on desktop */}
      <div className="relative z-10 grid grid-cols-1 gap-5 px-5 pb-6 pt-2 sm:px-10 lg:min-h-0 lg:flex-1 lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:gap-8">
        {/* LEFT — the stage alone, so the car sits big and centred */}
        <section className="order-1 flex min-h-0 flex-col gap-3">
          <div
            className="relative flex h-[38vh] min-h-[220px] items-center justify-center gap-1 sm:h-[42vh] sm:gap-3 lg:h-auto lg:min-h-0 lg:flex-1"
            onTouchStart={onStageTouchStart}
            onTouchEnd={onStageTouchEnd}
          >
            {/* giant model-name watermark — configurator-style depth behind the car.
                Font size scales inversely with the name length so every model fits. */}
            {!isCustom && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-[40%] z-0 -translate-y-1/2 select-none overflow-hidden whitespace-nowrap text-center font-josefin font-light uppercase leading-none tracking-[0.06em]"
                style={{ fontSize: `min(${((100 / group!.name.length) * 1.3).toFixed(2)}vw, 16vh)`, color: "rgba(42,79,208,0.07)" }}
              >
                {group!.name}
              </div>
            )}

            <button type="button" onClick={() => go(-1)} aria-label="Previous" className={arrowBtn}><Chevron dir="left" /></button>

            <motion.div
              key={`${gi}:${vi}:${effectiveAngle}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 70, scale: dir === 0 ? 1 : 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.42, ease: EASE }}
              className="relative z-10 flex h-full min-h-0 flex-1 items-center justify-center"
            >
              {isCustom ? (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-neutral-300 text-neutral-400 sm:h-32 sm:w-32">
                    <span className="text-5xl font-light">?</span>
                  </div>
                </div>
              ) : (
                <div className="relative flex h-full w-full items-center justify-center">
                  <Image
                    src={stageImage!}
                    alt={`${variant!.name} ${effectiveAngle} view`}
                    width={1200}
                    height={680}
                    priority={gi === 0}
                    draggable={false}
                    sizes="(max-width:1024px) 88vw, 60vw"
                    className="relative z-10 w-auto max-w-full select-none object-contain"
                    style={{ maxHeight: "78%", transform: variant!.flip ? "scaleX(-1)" : undefined }}
                  />
                  {/* floor shadow — grounds the car on the canvas */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2"
                    style={{
                      bottom: "8%",
                      width: "62%",
                      height: "9%",
                      background: "radial-gradient(50% 50% at 50% 50%, rgba(11,13,18,0.18), transparent 72%)",
                      filter: "blur(6px)",
                    }}
                  />
                </div>
              )}
            </motion.div>

            <button type="button" onClick={() => go(1)} aria-label="Next" className={arrowBtn}><Chevron dir="right" /></button>

            {/* angle switcher — small text labels tucked UNDER the car; dims any
                angle with no photo */}
            {!isCustom && angles && (
              <div className="absolute bottom-0 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-neutral-200 bg-white/80 p-0.5 shadow-sm backdrop-blur-sm">
                {(["front", "side", "rear"] as Angle[]).map((a) => {
                  const available = !!angles[a];
                  const on = effectiveAngle === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      disabled={!available}
                      onClick={() => pickAngle(a)}
                      aria-pressed={on}
                      title={available ? `${a[0].toUpperCase()}${a.slice(1)} view` : `No ${a} view available`}
                      className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed"
                      style={{
                        background: on ? ACCENT : "transparent",
                        color: on ? "#ffffff" : "#6b7280",
                        opacity: available ? 1 : 0.3,
                      }}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* details — centred under the stage on phones only */}
          <div className="flex shrink-0 flex-col items-center lg:hidden">{details(false, false)}</div>
        </section>

        {/* RIGHT — roster grid with the details underneath, left-aligned to it */}
        <section className="order-2 flex min-h-0 flex-col gap-4">
          <div className="flex w-full shrink-0 flex-col rounded-2xl border border-neutral-200 bg-white/70 p-2.5 backdrop-blur-sm lg:min-h-0 lg:max-h-[46vh]">
            <div className="flex shrink-0 items-center justify-between px-1 pb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">Models</span>
              {/* list view — opens the compact all-cars list */}
              <button
                type="button"
                onClick={() => setListOpen(true)}
                aria-label="View all cars as a list"
                title="View all cars as a list"
                className="grid h-7 w-7 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="9" y1="6" x2="20" y2="6" />
                  <line x1="9" y1="12" x2="20" y2="12" />
                  <line x1="9" y1="18" x2="20" y2="18" />
                  <circle cx="4.5" cy="6" r="1" fill="currentColor" />
                  <circle cx="4.5" cy="12" r="1" fill="currentColor" />
                  <circle cx="4.5" cy="18" r="1" fill="currentColor" />
                </svg>
              </button>
            </div>

            <div
              ref={gridRef}
              onScroll={syncStripBar}
              data-lenis-prevent
              className="accent-scrollbar accent-scrollbar-lg flex min-h-0 snap-x snap-mandatory gap-2.5 overflow-x-auto p-0.5 lg:grid lg:snap-none lg:auto-rows-max lg:grid-cols-3 lg:content-start lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1"
            >
              {GROUPS.map((g, i) => {
                const active = i === gi;
                return (
                  <button
                    key={g.id}
                    ref={(el) => { tileRefs.current[i] = el; }}
                    type="button"
                    onClick={() => goTo(i, i > gi ? 1 : -1)}
                    aria-label={g.name}
                    aria-pressed={active}
                    title={g.name}
                    className={`${tileClass(active)} flex h-[86px] w-[96px] flex-col lg:h-auto lg:w-auto lg:pb-0.5`}
                    style={tileRing(active)}
                  >
                    <span className="relative block h-[58px] w-full shrink-0 lg:h-[62px]">
                      <Image
                        src={g.image}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-contain p-1.5 transition-transform duration-200 group-hover/tile:scale-105"
                        style={{ transform: g.variants[0].flip ? "scaleX(-1)" : undefined }}
                      />
                    </span>
                    <span
                      className={`block w-full shrink-0 truncate px-1.5 pb-1 text-center text-[9px] font-semibold tracking-wide ${
                        active ? "text-[#2A4FD0]" : "text-neutral-400"
                      }`}
                    >
                      {g.short}
                    </span>
                  </button>
                );
              })}

              {/* "?" — anything not listed */}
              <button
                ref={(el) => { tileRefs.current[CUSTOM] = el; }}
                type="button"
                onClick={() => goTo(CUSTOM, 1)}
                aria-label="Request a car not listed"
                aria-pressed={isCustom}
                title="Request a car not listed"
                className={`${tileClass(isCustom, true)} flex h-[86px] w-[96px] flex-col items-center justify-center gap-0.5 lg:h-[82px] lg:w-auto`}
                style={tileRing(isCustom)}
              >
                <span className="text-2xl font-light text-neutral-400">?</span>
                <span className={`block w-full truncate px-1.5 text-center text-[9px] font-semibold tracking-wide ${isCustom ? "text-[#2A4FD0]" : "text-neutral-400"}`}>
                  Anything else
                </span>
              </button>
            </div>

            {/* accent scroll indicator — phones only; mirrors the strip's position */}
            <div className="mx-0.5 mt-2 h-[3px] shrink-0 overflow-hidden rounded-full bg-neutral-900/[0.07] lg:hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${stripBar.w}%`, marginLeft: `${stripBar.x}%`, background: ACCENT }}
              />
            </div>
          </div>

          {/* details — desktop only, left-aligned to the grid above */}
          <div data-lenis-prevent className="accent-scrollbar hidden min-h-0 flex-col overflow-y-auto px-0.5 lg:flex">{details(true, true)}</div>
        </section>
      </div>

      {/* All-cars list — compact rows: photo left, name + class beside it.
          Bottom sheet on phones, centred card on larger screens. Tapping a row
          puts that car on the stage and closes the list. */}
      {listOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center sm:px-6"
          onClick={() => setListOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="All cars"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-xl sm:max-h-[70vh] sm:rounded-3xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>All cars</div>
                <div className="mt-0.5 text-sm text-neutral-400">{GROUPS.length} models in the fleet</div>
              </div>
              <button
                type="button"
                onClick={() => setListOpen(false)}
                className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-900"
              >
                Close
              </button>
            </div>

            <div data-lenis-prevent className="accent-scrollbar flex min-h-0 flex-col gap-0.5 overflow-y-auto p-2">
              {GROUPS.map((g, i) => {
                const active = i === gi;
                const v = g.variants[0];
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { goTo(i, i > gi ? 1 : -1); setListOpen(false); }}
                    className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                      active ? "bg-[#2A4FD0]/[0.07]" : "hover:bg-neutral-100"
                    }`}
                  >
                    <span className="relative block h-9 w-16 shrink-0">
                      <Image src={g.image} alt="" fill sizes="64px" className="object-contain" style={{ transform: g.variants[0].flip ? "scaleX(-1)" : undefined }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${active ? "text-[#2A4FD0]" : "text-neutral-900"}`}>{g.name}</span>
                      <span className="block truncate text-[11px] text-neutral-400">{v.year} · {v.type}</span>
                    </span>
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}

              {/* custom request row */}
              <button
                type="button"
                onClick={() => { goTo(CUSTOM, 1); setListOpen(false); }}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  isCustom ? "bg-[#2A4FD0]/[0.07]" : "hover:bg-neutral-100"
                }`}
              >
                <span className="grid h-9 w-16 shrink-0 place-items-center">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-neutral-300 text-sm text-neutral-400">?</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${isCustom ? "text-[#2A4FD0]" : "text-neutral-900"}`}>Something else</span>
                  <span className="block truncate text-[11px] text-neutral-400">Request any make, model and year</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact popup — shared site pattern */}
      {contactOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6 backdrop-blur-md" onClick={() => setContactOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-neutral-900/85 p-7 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "#8aa2ff" }}>ApexRide</div>
            <h3 className="mt-2 text-2xl font-light tracking-tight">Get in touch</h3>
            <div className="mt-5 flex flex-col gap-2.5">
              {CONTACTS.map((c) => (
                <a key={c.label} href={c.href} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition-colors duration-200 hover:bg-white/[0.08]">
                  <span className="text-white/55">{c.label}</span>
                  <span className="font-semibold">{c.value}</span>
                </a>
              ))}
            </div>
            <button type="button" onClick={() => setContactOpen(false)} className="mt-6 w-full rounded-full bg-white/10 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-colors duration-200 hover:bg-white/15">Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
