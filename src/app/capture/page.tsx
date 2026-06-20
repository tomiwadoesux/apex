"use client";

// Dev-only poster capture route. Renders just the parked car (transparent, like
// the hero's first frame) at the theme given by ?mode=light|dark, full-bleed at
// whatever viewport you load it in. The headless capture script (scripts/
// capture-posters.mjs) loads this at phone/tablet/desktop sizes, waits for
// [data-car-ready], and reads the canvas with toDataURL → the per-aspect poster
// webps. You can also open it in a browser and grab the canvas by hand.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Mode } from "@/components/car/CarStage";

const CarStage = dynamic(() => import("@/components/car/CarStage"), {
  ssr: false,
});

export default function CapturePage() {
  // parked side view (tour progress 0) — the framing the poster must match.
  const tour = useRef(0);
  const [mode, setMode] = useState<Mode>("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("mode") === "dark") setMode("dark");
  }, []);

  // flag the DOM once the model is in, so the capture script knows it can shoot.
  useEffect(() => {
    if (loaded) document.body.setAttribute("data-car-ready", "true");
  }, [loaded]);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <CarStage
        mode={mode}
        fit={1.7}
        transparent
        capture
        staticView
        tourProgress={tour}
        onLoaded={() => setLoaded(true)}
      />
    </div>
  );
}
