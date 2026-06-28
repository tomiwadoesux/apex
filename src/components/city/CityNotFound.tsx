"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// WebGL / three.js is browser-only — skip prerendering, like the city viewer.
const CityScene = dynamic(() => import("./CityScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">
      Loading city…
    </div>
  ),
});

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

// Matches the site's dark "Contact Us" HatchButton (page.tsx) — black slab,
// white ink, sliding diagonal hatch on hover.
function HomeButton() {
  return (
    <Link
      href="/"
      className="group pointer-events-auto relative mt-2 inline-flex h-11 items-center gap-2.5 overflow-hidden rounded-lg border px-6 text-sm font-semibold tracking-wide transition-transform duration-150 active:translate-y-px"
      style={{
        background: "linear-gradient(180deg, #242424 0%, #090909 100%)",
        color: "#ffffff",
        borderColor: "rgba(255,255,255,0.16)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 transition-transform duration-700 ease-out group-hover:translate-x-3 group-hover:-translate-y-3"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0, rgba(255,255,255,0.10) 1px, transparent 1px, transparent 16px)",
        }}
      />
      <HomeIcon className="relative z-[1] h-4 w-4 shrink-0" />
      <span className="relative z-[1]">Return Home</span>
    </Link>
  );
}

export default function CityNotFound() {
  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{ backgroundColor: "#e9edf2" }}
    >
      {/* Cinematic low-poly city: one building colour, light mode, a camera that
          keeps cutting to random vantage points the driving logo passes through. */}
      <CityScene mode="light" cinematic unifiedBuildings />

      {/* 404 header + button — pointer-events-none so dragging the canvas below
          still orbits; the button re-enables pointer events on itself. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-3 px-5 py-10 text-center sm:py-14">
        <p className="text-6xl font-light tracking-tight text-black/80 sm:text-7xl">
          404
        </p>
        <h1 className="text-lg font-light tracking-wide text-black/55 sm:text-xl">
          Page Not Found
        </h1>
        <p className="text-xs text-black/40">
          That road does not lead anywhere. Drag to look around, or head back.
        </p>
        <HomeButton />
      </div>
    </div>
  );
}
