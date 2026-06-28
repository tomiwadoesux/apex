"use client";

// Our Fleet — pick a car. One screen, no page scroll on desktop.
//   • LEFT  — a big car (a sliding carousel) flanked by prev / next arrows, with its
//             details below it: model name, a year / variant selector, specs as plain
//             text, and an "Add to booking" button. All centered.
//   • RIGHT — the roster as a bordered container of separated boxes (3 across), grouped
//             by MODEL so variants share one tile (no empty tiles). The last tile is a
//             "?" for anything not listed, which opens a custom request.
// Header matches the rest of the site: logo + a "Contact Us" button + the contact popup.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";
import { GROUPS, EASE, anglesFor, type Angle } from "@/components/fleet/data";
import { Chevron, AngleIcon } from "@/components/fleet/icons";

const ACCENT = "#2A4FD0";
const COLS = 3; // roster columns (for up / down arrow nav)
const CUSTOM = GROUPS.length; // index of the "?" custom tile
const TILES = GROUPS.length + 1;

// Site-standard pill button (matches the header / services "Contact Us").
const BTN = "inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-semibold tracking-wide transition-[filter,transform] duration-150 hover:brightness-[1.05] active:translate-y-px";
const BTN_STYLE = { background: ACCENT, borderColor: "#16308f", color: "#ffffff", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" } as const;

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
    tileRefs.current[gi]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [gi]);

  const arrowBtn =
    "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white/80 text-neutral-500 shadow-sm transition-colors duration-150 hover:border-neutral-900/30 hover:text-neutral-900 active:scale-95";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#f4f6fb] text-neutral-900 lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {/* soft spotlight */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ background: "radial-gradient(78% 55% at 40% -4%, rgba(42,79,208,0.10), transparent 60%)" }} />

      {/* header — site standard: logo + Contact Us */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} color="#0b0d12" accent={ACCENT} />
          <span className="text-sm font-bold uppercase tracking-[0.08em]">Apex<span className="font-semibold" style={{ color: ACCENT }}>Ride</span></span>
        </Link>
        <button type="button" onClick={() => setContactOpen(true)} className={BTN} style={BTN_STYLE}>Contact Us</button>
      </header>

      {/* content — fills the rest of the screen on desktop */}
      <div className="relative z-10 grid grid-cols-1 gap-6 px-6 pb-6 sm:px-10 lg:min-h-0 lg:flex-1 lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-8">
        {/* LEFT — stage + details */}
        <section className="order-1 flex min-h-0 flex-col gap-2">
          <div className="shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={{ color: ACCENT }}>The collection</div>
            <h1 className="mt-0.5 font-josefin text-4xl font-light leading-none tracking-tight sm:text-5xl">Our fleet</h1>
          </div>

          {/* stage: arrows flank a sliding carousel */}
          <div className="relative flex h-[42vh] items-center justify-center gap-1 sm:gap-3 lg:h-auto lg:min-h-0 lg:flex-1">
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
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 70 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.42, ease: EASE }}
              className="flex h-full min-h-0 flex-1 items-center justify-center"
            >
              {isCustom ? (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-neutral-300 text-neutral-400 sm:h-32 sm:w-32">
                    <span className="text-5xl font-light">?</span>
                  </div>
                </div>
              ) : (
                <Image
                  src={stageImage!}
                  alt={`${variant!.name} ${effectiveAngle} view`}
                  width={1200}
                  height={680}
                  priority={gi === 0}
                  draggable={false}
                  sizes="(max-width:1024px) 88vw, 60vw"
                  className="w-auto max-w-full select-none object-contain"
                  style={{ maxHeight: "82%", transform: variant!.flip ? "scaleX(-1)" : undefined }}
                />
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

                <div className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
                  {variant!.specs.join(" · ")}
                </div>
                <Link ref={ctaRef} href={`/form?car=${encodeURIComponent(variant!.name)}&year=${variant!.year}`} className={`mt-5 ${BTN}`} style={BTN_STYLE}>
                  Add to booking
                </Link>
              </>
            )}
          </div>
        </section>

        {/* RIGHT — roster container (grouped, 3 across, scrolls inside itself) */}
        <section className="order-2 flex min-h-0 items-start">
          <div className="flex max-h-[58vh] w-full flex-col rounded-2xl border border-neutral-200 bg-white/70 p-2.5 backdrop-blur-sm lg:max-h-full">
            <div className="flex shrink-0 items-center justify-between px-1 pb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">Models</span>
            </div>

            <div ref={gridRef} className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2.5 overflow-y-auto p-0.5 pr-1 [scrollbar-width:thin]">
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
                    className={`relative aspect-square overflow-hidden rounded-lg border bg-white transition-colors duration-200 ${active ? "border-[#2A4FD0]" : "border-neutral-200 hover:border-neutral-300"}`}
                    style={active ? { boxShadow: `inset 0 0 0 2px ${ACCENT}` } : undefined}
                  >
                    <Image src={g.image} alt="" fill sizes="90px" className="object-contain p-1.5" style={{ transform: g.variants[0].flip ? "scaleX(-1)" : undefined }} />
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
                className={`relative grid aspect-square place-items-center rounded-lg border bg-white transition-colors duration-200 ${isCustom ? "border-[#2A4FD0]" : "border-dashed border-neutral-300 hover:border-neutral-400"}`}
                style={isCustom ? { boxShadow: `inset 0 0 0 2px ${ACCENT}` } : undefined}
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
