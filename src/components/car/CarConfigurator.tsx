"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Mode } from "./CarStage";

// WebGL / three.js is browser-only — skip prerendering, like MapHero does for maplibre.
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

export default function CarConfigurator() {
  // dark mode = white car (matches the hero look)
  const [mode, setMode] = useState<Mode>("dark");
  const isLight = mode === "light";

  return (
    <div
      className="relative h-dvh w-full overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: BG[mode] }}
    >
      <CarStage mode={mode} />

      {/* Light / Dark toggle, centred at the top */}
      <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2">
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
