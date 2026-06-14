"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import ControlPanel from "./ControlPanel";
import {
  DEFAULT_SETTINGS,
  type CameraState,
  type MapSettings,
} from "./map-settings";

// maplibre-gl is browser-only (WebGL, window) — skip prerendering entirely
const MapStage = dynamic(() => import("./MapStage"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-white/30">
      Loading map…
    </div>
  ),
});

export default function MapHero() {
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS);

  // Map gestures report camera state back; bail out when nothing changed so
  // continuous `move` events don't cause render loops
  const handleCameraChange = useCallback((camera: CameraState) => {
    setSettings((s) =>
      s.pitch === camera.pitch &&
      s.bearing === camera.bearing &&
      s.zoom === camera.zoom
        ? s
        : { ...s, ...camera }
    );
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#06090d]">
      <MapStage settings={settings} onCameraChange={handleCameraChange} />

      {/* Mood tint — blends with the map canvas underneath */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: settings.tintColor,
          opacity: settings.tintStrength,
          mixBlendMode: settings.blendMode,
        }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, ${settings.vignette}) 100%)`,
        }}
      />

      <ControlPanel settings={settings} onChange={setSettings} />
    </div>
  );
}
