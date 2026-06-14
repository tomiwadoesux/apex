"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Mode } from "./CityScene";

// WebGL / three.js is browser-only — skip prerendering, like the car stage.
const CityScene = dynamic(() => import("./CityScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">
      Loading city…
    </div>
  ),
});

const MODES: Mode[] = ["light", "dark"];
const PAGE_BG: Record<Mode, string> = { light: "#eef1f5", dark: "#0f1822" };

export default function CityViewer() {
  const [mode, setMode] = useState<Mode>("light");
  const isLight = mode === "light";

  return (
    <div
      className="relative h-dvh w-full overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: PAGE_BG[mode] }}
    >
      <CityScene mode={mode} />

      {/* Header — pointer-events-none so dragging the canvas underneath still
          works; the toggle re-enables pointer events on itself. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 py-4 sm:px-8">
        <div>
          <h1
            className={`text-lg font-semibold tracking-tight transition-colors ${
              isLight ? "text-black/85" : "text-white/90"
            }`}
          >
            Low-Poly City
          </h1>
          <p
            className={`text-xs transition-colors ${
              isLight ? "text-black/45" : "text-white/45"
            }`}
          >
            Drag to orbit · scroll to zoom · right-drag to pan
          </p>
        </div>

        <div className="pointer-events-auto">
          <div
            className={`flex rounded-full border p-1 backdrop-blur-md transition-colors ${
              isLight
                ? "border-black/10 bg-white/70"
                : "border-white/15 bg-black/40"
            }`}
          >
            {MODES.map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
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
      </header>
    </div>
  );
}
