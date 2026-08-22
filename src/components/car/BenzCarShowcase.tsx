"use client";

// The scroll tour, rebuilt as its own page (/3d-benz-car).
//
// Three pieces that already existed but had lost their parent: CarStage (the
// GLB + the camera that reads `tourProgress`), ScrollServices (the captions that
// rise as each framing lands) and ShotNav (click an angle to crane to it). This
// component is the parent that drives them — it owns the one number they all
// share: scroll position, normalised to 0..1.
//
// The runway below the sticky stage is what creates that number. CarStage walks
// the poses with `u = progress * poses.length`, so one viewport of scroll per
// pose keeps every framing on its own screen.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Mode } from "./CarStage";
import ScrollServices from "./ScrollServices";
import ShotNav from "./ShotNav";
import { cameraTuning } from "./cameraTuning";

// WebGL / three.js is browser-only — skip prerendering, exactly as the /car
// configurator does. `ssr: false` is only legal inside a Client Component.
const CarStage = dynamic(() => import("./CarStage"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-white/30">
      Loading car…
    </div>
  ),
});

const BG: Record<Mode, string> = { light: "#e9eaee", dark: "#0b0f14" };
const MODES: Mode[] = ["light", "dark"];

// One full viewport of scroll per camera pose.
const RUNWAY_VH = cameraTuning.poses.length * 100;

export default function BenzCarShowcase() {
  // dark mode = white car, the hero look
  const [mode, setMode] = useState<Mode>("dark");
  const isLight = mode === "light";

  // The shared scroll number. A ref, not state: CarStage and ScrollServices both
  // read it every frame, so re-rendering React on scroll would only cost frames.
  const tour = useRef(0);
  const hero = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastY = -1;
    const loop = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      tour.current = p;

      // Releasing a click-to-pose is this parent's job: ShotNav sets
      // `cameraTuning.jumpTo` and nothing in the module ever clears it, so
      // without this the first shot you click would pin the camera for good and
      // scrolling would do nothing.
      if (lastY >= 0 && Math.abs(y - lastY) > 0.5 && cameraTuning.jumpTo !== null) {
        cameraTuning.jumpTo = null;
      }
      lastY = y;

      // Fade the title out as the first framing takes over.
      if (hero.current) {
        hero.current.style.opacity = String(Math.max(0, 1 - p / 0.04));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // cameraTuning is a module singleton shared with /car and the tuner panel —
  // leaving mid-tour would otherwise strand a pose for the next page that uses it.
  useEffect(
    () => () => {
      cameraTuning.jumpTo = null;
      cameraTuning.freeze = false;
    },
    [],
  );

  return (
    <div
      className="relative w-full transition-colors duration-500"
      style={{ backgroundColor: BG[mode] }}
    >
      {/* The stage pins for the whole runway while the camera walks the poses. */}
      <div className="sticky top-0 h-dvh w-full overflow-hidden">
        <CarStage mode={mode} tourProgress={tour} />

        {/* Title and scroll hint, sitting on the parked car before the tour
            engages. Both live in one faded wrapper, but the hint is pinned to
            the bottom so it never lands on the car's roof. */}
        <div ref={hero} className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-x-0 top-0 flex flex-col items-center px-6 pt-20 text-center sm:pt-24">
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.32em] ${
                isLight ? "text-black/45" : "text-white/45"
              }`}
            >
              Apex Ride
            </span>
            <h1
              className={`mt-3 text-4xl font-light leading-tight tracking-tight sm:text-6xl ${
                isLight ? "text-black/85" : "text-white/90"
              }`}
            >
              The Benz, in three dimensions.
            </h1>
          </div>
          <span
            className={`absolute inset-x-0 bottom-20 text-center text-xs tracking-wide ${
              isLight ? "text-black/40" : "text-white/40"
            }`}
          >
            Scroll to take the tour
          </span>
        </div>
      </div>

      {/* Scroll runway — gives the tour its length. */}
      <div style={{ height: `${RUNWAY_VH}vh` }} aria-hidden />

      {/* Captions (fixed overlay, keyed to the same progress as the camera). */}
      <ScrollServices isLight={isLight} tourProgress={tour} />

      {/* Jump straight to a framing. */}
      <ShotNav isLight={isLight} />

      {/* Light / dark toggle. */}
      <div className="fixed left-1/2 top-5 z-30 -translate-x-1/2">
        <div
          className={`flex rounded-full border p-1 backdrop-blur-md ${
            isLight ? "border-black/10 bg-white/70" : "border-white/15 bg-black/40"
          }`}
        >
          {MODES.map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  active
                    ? isLight
                      ? "bg-black text-white"
                      : "bg-white text-black"
                    : isLight
                      ? "text-black/55 hover:text-black"
                      : "text-white/55 hover:text-white"
                }`}
              >
                {m} mode
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
