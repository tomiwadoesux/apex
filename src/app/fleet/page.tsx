"use client";

// Our Fleet — pick a car. A centred "Our fleet" title sits up top. The left side is
// the big featured car with a prev/next arrow on each flank and its name + year + spec
// chips CENTRED underneath. The right side is a tall, full-height picker with a
// 3-per-row grid of every car (vertically centred in the panel), each using its own
// front photo; clicking a cell (or using the arrows) selects it into the featured view.
//
// Each car in CARS points at its own shot in /public/images (e.g. "lexus lx Front
// black.webp"); swap to the white / side / rear variants on disk as needed.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "@/components/Logo";

const ACCENT = "#2A4FD0"; // brand blue (light mode)

type Car = {
  id: string;
  name: string;
  year: number;
  type: string;
  specs: string[];
  image: string;
};

// Each car points at its OWN front shot in /public/images (black trims, to match the
// landing fleet). Swap to the white / side / rear variants on disk if you prefer.
const CARS: Car[] = [
  { id: "lx600", name: "Lexus LX 600", year: 2024, type: "Full size SUV", specs: ["7 seats", "AWD", "Twin turbo V6"], image: "/images/lexus lx Front black.webp" },
  { id: "phantom", name: "Rolls Royce Phantom", year: 2023, type: "Ultra luxury sedan", specs: ["5 seats", "Auto", "V12"], image: "/images/rollsroyce phantom Front black-silver.webp" },
  { id: "corolla", name: "Toyota Corolla", year: 2024, type: "Executive sedan", specs: ["5 seats", "Auto", "Hybrid"], image: "/images/toyota corolla Front black.webp" },
  { id: "hiace", name: "Toyota Hiace", year: 2023, type: "Passenger van", specs: ["14 seats", "Diesel", "Manual"], image: "/images/toyota hiace Front black.webp" },
];

// ease-out — the featured car enters quickly then settles (entering element).
const EASE = [0.16, 0.84, 0.44, 1] as const;

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

export default function FleetPage() {
  const [selected, setSelected] = useState(0);
  const car = CARS[selected];

  const go = (d: number) => setSelected((i) => (i + d + CARS.length) % CARS.length);
  const pick = (i: number) => setSelected(i);

  // Left / right arrow keys also flip through the fleet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const arrowCls =
    "grid h-11 w-11 shrink-0 place-items-center rounded-full text-neutral-600 transition-[color,background-color,transform] duration-150 hover:bg-neutral-900/[0.06] hover:text-neutral-900 active:scale-90";

  return (
    <main className="relative min-h-dvh w-full" style={{ backgroundColor: "#f6f7f9" }}>
      {/* subtle dot grid, matching the landing page */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(42,79,208,0.10) 1px, transparent 1.6px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} color="#0b0d12" accent={ACCENT} />
          <span className="text-sm font-bold uppercase tracking-[0.08em] text-neutral-900">
            Apex<span className="font-semibold" style={{ color: ACCENT }}>Ride</span>
          </span>
        </Link>
        <Link
          href="/form"
          className="inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-semibold tracking-wide transition-[filter,transform] duration-150 hover:brightness-[1.05] active:translate-y-px"
          style={{ background: ACCENT, borderColor: "#16308f", color: "#ffffff", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}
        >
          Book Now
        </Link>
      </header>

      {/* title — centred (the old "Our Fleet" eyebrow is gone; this heading carries it) */}
      <div className="relative z-10 px-6 pt-1 text-center sm:px-10">
        <h1 className="text-4xl font-light tracking-tight text-neutral-900 sm:text-5xl">Our fleet</h1>
      </div>

      {/* stage — featured left, grid right, spanning the FULL width: the featured car
          sits against the LEFT edge (under the title) and the fixed, compact grid
          column sits against the RIGHT edge, so the two sections bookend the page
          instead of being capped and floating. The featured image is height-capped
          (lg:max-h) so it can't overflow the row as its column widens. */}
      <div className="relative z-10 grid w-full grid-cols-1 gap-8 px-6 pb-14 pt-8 sm:px-10 lg:h-[82vh] lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-10">
        {/* LEFT — featured car flanked by arrows */}
        <div className="flex h-full items-center gap-1 sm:gap-3">
          <button type="button" onClick={() => go(-1)} aria-label="Previous car" className={arrowCls}>
            <Chevron dir="left" />
          </button>

          <div className="min-w-0 flex-1">
            {/* Coverflow slider — active car centred, the neighbours peeking in
                (scaled, blurred, faded) on each flank, echoing the form's car select.
                Each car's role (and CSS transform) is its offset from `selected`, so a
                car glides from flank to centre as the selection changes. */}
            <div className="relative aspect-video w-full overflow-hidden lg:max-h-[62vh]">
              {CARS.map((c, i) => {
                const n = CARS.length;
                let off = i - selected;
                if (off > n / 2) off -= n;
                if (off < -n / 2) off += n;
                const center = off === 0;
                const adj = Math.abs(off) === 1;
                return (
                  <div
                    key={c.id}
                    aria-hidden={!center}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      transform: `translateX(${off * 58}%) scale(${center ? 1 : 0.5})`,
                      opacity: center ? 1 : adj ? 0.4 : 0,
                      filter: center ? "none" : "blur(6px)",
                      zIndex: center ? 30 : adj ? 20 : 0,
                      transition:
                        "transform 520ms cubic-bezier(0.16,0.84,0.44,1), opacity 520ms ease, filter 520ms ease",
                      pointerEvents: center ? "auto" : "none",
                    }}
                  >
                    <Image
                      src={c.image}
                      alt={c.name}
                      fill
                      sizes="(max-width: 1024px) 88vw, 55vw"
                      className="object-contain"
                      priority={i === 0}
                    />
                  </div>
                );
              })}
            </div>

            {/* name + year/type + spec chips, centred under the active car */}
            <div className="relative mt-4 min-h-[112px] sm:mt-6">
              <AnimatePresence initial={false}>
                <motion.div
                  key={car.id}
                  className="absolute inset-x-0 top-0 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <h2 className="text-3xl font-light tracking-tight text-neutral-900 sm:text-[2.5rem] sm:leading-[1.05]">
                    {car.name}
                  </h2>
                  <div className="mt-1.5 text-sm text-neutral-500">
                    {car.year} · {car.type}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {car.specs.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-neutral-900/10 bg-white/70 px-3 py-1 text-[12px] font-medium text-neutral-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <button type="button" onClick={() => go(1)} aria-label="Next car" className={arrowCls}>
            <Chevron dir="right" />
          </button>
        </div>

        {/* RIGHT — compact car picker. THREE per row as equal squares, each with its
            name centred under the thumbnail. Sits HIGH (top-aligned) and stays small;
            scrolls inside the box only if the fleet outgrows it. */}
        <div className="flex flex-col justify-center overflow-y-auto rounded-2xl border border-neutral-900/10 bg-white/55 p-4 backdrop-blur-sm lg:h-full">
          <div className="grid grid-cols-3 gap-3.5">
            {CARS.map((c, i) => {
              const active = i === selected;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(i)}
                  aria-label={c.name}
                  aria-pressed={active}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white text-center transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 active:scale-[0.98] ${
                    active ? "border-transparent" : "border-neutral-900/10 hover:border-neutral-900/20 hover:shadow-md"
                  }`}
                  style={active ? { boxShadow: `0 0 0 2px ${ACCENT}, 0 10px 24px -10px rgba(42,79,208,0.4)` } : undefined}
                >
                  {/* soft radial "stage" so the cutout reads as grounded, not floating */}
                  <div
                    className="relative aspect-square w-full"
                    style={{ background: "radial-gradient(120% 90% at 50% 38%, #ffffff 0%, #eef1f6 100%)" }}
                  >
                    <Image src={c.image} alt={c.name} fill sizes="130px" className="object-contain p-2 transition-transform duration-300 group-hover:scale-[1.06]" />
                  </div>
                  <div className="px-1.5 pb-2 pt-1.5">
                    <span className={`block truncate text-[11px] font-semibold leading-tight tracking-wide ${active ? "text-[#2A4FD0]" : "text-neutral-800"}`}>
                      {c.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] leading-tight text-neutral-400">{c.type}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
