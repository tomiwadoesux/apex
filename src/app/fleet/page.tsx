"use client";

// Our Fleet — pick a car. One screen, no page scroll on desktop.
//   • LEFT  — the stage: a big car (sliding carousel) over a soft floor shadow,
//             with a giant index watermark behind it for depth. Prev / next arrows
//             flank it on desktop; on touch screens the stage swipes. Details sit
//             below: model name, year / variant chips, spec chips, and the CTA.
//   • RIGHT — the roster, grouped by MODEL so variants share one tile. On phones
//             it becomes a horizontal snap strip under the details; on desktop a
//             3-across vertical grid that scrolls inside its own frame. The last
//             tile is a "?" for anything not listed (custom request).
// Header matches the rest of the site: logo (links home) + Contact Us + popup.

import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";
import { GROUPS, EASE, anglesFor, pad2, type Angle } from "@/components/fleet/data";
import { Chevron, AngleIcon } from "@/components/fleet/icons";

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
  { label: "Email", value: "contact@apexride.com", href: "mailto:contact@apexride.com" },
  { label: "WhatsApp", value: "+234 800 000 0000", href: "https://wa.me/2348000000000" },
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
      else if (k === "Escape") { setContactOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi]);

  // Keep the active tile in view inside the roster container.
  useEffect(() => {
    tileRefs.current[gi]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [gi]);

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

      {/* content — fills the rest of the screen on desktop */}
      <div className="relative z-10 grid grid-cols-1 gap-5 px-5 pb-6 sm:px-10 lg:min-h-0 lg:flex-1 lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-8">
        {/* LEFT — stage + details */}
        <section className="order-1 flex min-h-0 flex-col gap-2">
          <div className="flex shrink-0 items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={{ color: ACCENT }}>The collection</div>
              <h1 className="mt-0.5 font-josefin text-4xl font-light leading-none tracking-tight sm:text-5xl">Our fleet</h1>
            </div>
            {/* position counter — reads "03 / 10", or "+" on the custom tile */}
            <div className="pb-1 font-mono text-xs tabular-nums text-neutral-400" aria-hidden="true">
              {isCustom ? "+" : pad2(gi + 1)}<span className="mx-1 text-neutral-300">/</span>{pad2(GROUPS.length)}
            </div>
          </div>

          {/* stage: arrows flank a sliding carousel; swipes on touch screens */}
          <div
            className="relative flex h-[38vh] min-h-[220px] items-center justify-center gap-1 sm:h-[42vh] sm:gap-3 lg:h-auto lg:min-h-0 lg:flex-1"
            onTouchStart={onStageTouchStart}
            onTouchEnd={onStageTouchEnd}
          >
            {/* giant index watermark — depth behind the car, never over the details */}
            {!isCustom && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 select-none text-center font-josefin font-light leading-none"
                style={{ fontSize: "min(34vh, 30vw)", color: "rgba(42,79,208,0.06)" }}
              >
                {pad2(gi + 1)}
              </div>
            )}

            {/* angle switcher — active car only; dims any angle with no photo */}
            {!isCustom && angles && (
              <div className="absolute left-1/2 top-0 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-neutral-200 bg-white/80 p-1 shadow-sm backdrop-blur-sm">
                {(["front", "side", "rear"] as Angle[]).map((a) => {
                  const available = !!angles[a];
                  const on = effectiveAngle === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      disabled={!available}
                      onClick={() => pickAngle(a)}
                      aria-label={`${a[0].toUpperCase()}${a.slice(1)} view`}
                      aria-pressed={on}
                      title={available ? `${a[0].toUpperCase()}${a.slice(1)} view` : `No ${a} view available`}
                      className="grid h-9 w-9 place-items-center rounded-full transition-colors disabled:cursor-not-allowed"
                      style={{
                        background: on ? ACCENT : "transparent",
                        color: on ? "#ffffff" : "#525252",
                        opacity: available ? 1 : 0.25,
                      }}
                    >
                      <AngleIcon angle={a} className="h-5 w-5" />
                    </button>
                  );
                })}
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
                    style={{ maxHeight: "82%", transform: variant!.flip ? "scaleX(-1)" : undefined }}
                  />
                  {/* floor shadow — grounds the car on the canvas */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2"
                    style={{
                      bottom: "4%",
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
          </div>

          {/* details — centered */}
          <div className="flex shrink-0 flex-col items-center text-center">
            {isCustom ? (
              <motion.div key="custom" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="flex flex-col items-center">
                <h2 className="font-josefin text-3xl font-light leading-[1.04] tracking-tight sm:text-4xl">Not on the list?</h2>
                <p className="mt-2 max-w-sm text-sm text-neutral-500">Tell us the make, model and year you want and we will source it for your trip.</p>
                <Link ref={ctaRef} href="/form" className={`mt-5 ${BTN}`} style={BTN_STYLE}>Request a custom car</Link>
              </motion.div>
            ) : (
              <>
                <motion.div key={`${gi}-name`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="flex flex-col items-center">
                  <h2 className="font-josefin text-3xl font-light leading-[1.04] tracking-tight sm:text-4xl">{group!.name}</h2>
                  <div className="mt-1 text-sm text-neutral-500">{variant!.year} · {variant!.type}</div>
                </motion.div>

                {/* year / variant selector — only when the model has more than one */}
                {group!.variants.length > 1 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
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
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
                  {variant!.specs.map((s) => (
                    <span key={s} className="rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-[11px] font-medium tracking-wide text-neutral-600">
                      {s}
                    </span>
                  ))}
                </div>

                <Link ref={ctaRef} href={`/form?car=${encodeURIComponent(variant!.name)}&year=${variant!.year}`} className={`mt-5 ${BTN}`} style={BTN_STYLE}>
                  Add to booking
                </Link>
                <p className="mt-2.5 text-[11px] tracking-wide text-neutral-400">
                  All vehicles chauffeur-driven · Lagos &amp; Abuja
                </p>
              </>
            )}
          </div>
        </section>

        {/* RIGHT — roster: horizontal snap strip on phones, 3-across grid on desktop */}
        <section className="order-2 flex min-h-0 items-start">
          <div className="flex w-full flex-col rounded-2xl border border-neutral-200 bg-white/70 p-2.5 backdrop-blur-sm lg:max-h-full lg:min-h-0">
            <div className="flex shrink-0 items-center justify-between px-1 pb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">Models</span>
              <span className="font-mono text-[11px] tabular-nums text-neutral-300">{GROUPS.length}</span>
            </div>

            <div
              ref={gridRef}
              className="flex min-h-0 snap-x snap-mandatory gap-2.5 overflow-x-auto p-0.5 [scrollbar-width:thin] lg:grid lg:flex-1 lg:snap-none lg:grid-cols-3 lg:content-start lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1"
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
                    className={`${tileClass(active)} h-[68px] w-[84px] lg:aspect-square lg:h-auto lg:w-auto`}
                    style={tileRing(active)}
                  >
                    <Image
                      src={g.image}
                      alt=""
                      fill
                      sizes="90px"
                      className="object-contain p-1.5 transition-transform duration-200 group-hover/tile:scale-105"
                      style={{ transform: g.variants[0].flip ? "scaleX(-1)" : undefined }}
                    />
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
                className={`${tileClass(isCustom, true)} grid h-[68px] w-[84px] place-items-center lg:aspect-square lg:h-auto lg:w-auto`}
                style={tileRing(isCustom)}
              >
                <span className="text-2xl font-light text-neutral-400">?</span>
              </button>
            </div>
          </div>
        </section>
      </div>

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
