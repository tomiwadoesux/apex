"use client";

import dynamic from "next/dynamic";

// maplibre-gl is browser-only (WebGL, window) — skip prerendering entirely, the
// same way MapHero loads MapStage.
const PickupMap = dynamic(() => import("./PickupMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-[11px] tracking-wide opacity-40">
      Loading map…
    </div>
  ),
});

// Sized, rounded shell for the map inside the "Customize location" popup.
export default function PickupMapEmbed({
  lng,
  lat,
  isLight,
  accent,
}: {
  lng: number | null;
  lat: number | null;
  isLight: boolean;
  accent: string;
}) {
  return (
    <div
      className={`relative h-32 sm:h-40 w-full overflow-hidden rounded-2xl border ${
        isLight ? "border-neutral-900/10" : "border-white/10"
      }`}
    >
      <PickupMap lng={lng} lat={lat} accent={accent} />
    </div>
  );
}
