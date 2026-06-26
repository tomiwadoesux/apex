"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { sunPosition } from "./sun";

// Esri World Imagery — satellite tiles, no key required (same source as MapStage).
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244]; // Lagos

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Colour-grade the imagery to the sun's altitude: bright by day, warm at golden
// hour, dark blue at night — an approximation of the location's current daylight.
function gradeForAltitude(altDeg: number) {
  const day = clamp((altDeg + 6) / 12, 0, 1); // 0 at -6°, 1 at +6°
  const golden = altDeg > -6 ? clamp(1 - Math.abs(altDeg) / 12, 0, 1) : 0;
  return {
    "raster-brightness-min": 0,
    "raster-brightness-max": 0.22 + 0.78 * day,
    "raster-saturation": clamp(-0.25 * (1 - day) + 0.18 * golden, -1, 1),
    "raster-hue-rotate": (1 - day) * 215 + golden * 12,
    "raster-contrast": clamp(0.05 + 0.1 * golden, -1, 1),
    "raster-fade-duration": 300,
  } as const;
}

// A "shadow" veil: a directional darkening on the side opposite the sun (strongest
// near the horizon) plus a flat night vignette when the sun is down.
function shadeOverlay(altDeg: number, azimuthDeg: number) {
  const night = clamp((6 - altDeg) / 18, 0, 1); // 0 by day, 1 deep night
  const dir = clamp((20 - altDeg) / 20, 0, 1) * 0.35; // long shadows near the horizon
  const shadowDir = (azimuthDeg + 180) % 360; // shadows fall away from the sun
  return (
    `linear-gradient(${shadowDir}deg, rgba(8,12,24,${(0.05 + dir).toFixed(2)}) 0%, rgba(8,12,24,0) 60%),` +
    `radial-gradient(rgba(6,10,20,0) 38%, rgba(6,10,20,${(0.12 + 0.5 * night).toFixed(2)}) 100%)`
  );
}

function buildStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri · Search © OpenStreetMap",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#06090d" } },
      { id: "satellite", type: "raster", source: "satellite", paint: { "raster-fade-duration": 300 } },
    ],
  };
}

export default function PickupMap({
  lng,
  lat,
  accent,
}: {
  lng: number | null;
  lat: number | null;
  /** site accent (#00209C light · #FDBA16 dark) — used for the location pin */
  accent: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);
  const accentRef = useRef(accent);
  useEffect(() => {
    accentRef.current = accent;
  });
  const [overlay, setOverlay] = useState("");

  // Grade the imagery + shade for a location's local time (uses the real clock).
  const applyTimeGrade = (longitude: number, latitude: number) => {
    const { altitudeDeg, azimuthDeg } = sunPosition(new Date(), latitude, longitude);
    setOverlay(shadeOverlay(altitudeDeg, azimuthDeg));
    const map = mapRef.current;
    if (map && loadedRef.current) {
      for (const [k, v] of Object.entries(gradeForAltitude(altitudeDeg))) {
        map.setPaintProperty("satellite", k, v as number);
      }
    }
  };

  // Create the map once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: buildStyle(),
      center: DEFAULT_CENTER,
      zoom: 10,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on("load", () => {
      loadedRef.current = true;
      const c = map.getCenter();
      applyTimeGrade(c.lng, c.lat);
    });
    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Searched coords → pin + glide there, then regrade for that local time.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lng == null || lat == null) return;
    const a = accentRef.current;
    if (!markerRef.current) {
      const pin = document.createElement("div");
      pin.style.width = "16px";
      pin.style.height = "16px";
      pin.style.borderRadius = "9999px";
      pin.style.border = "3px solid #ffffff";
      pin.style.background = a;
      pin.style.boxShadow = `0 0 0 3px ${a}55, 0 6px 16px rgba(0,0,0,0.5)`;
      pinRef.current = pin;
      markerRef.current = new maplibregl.Marker({ element: pin }).setLngLat([lng, lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
    map.flyTo({ center: [lng, lat], zoom: 16, duration: 900, essential: true });
    applyTimeGrade(lng, lat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lng, lat]);

  // Theme → recolour the pin (imagery grade is driven by time, not theme).
  useEffect(() => {
    const pin = pinRef.current;
    if (!pin) return;
    pin.style.background = accent;
    pin.style.boxShadow = `0 0 0 3px ${accent}55, 0 6px 16px rgba(0,0,0,0.5)`;
  }, [accent]);

  // Inline style, not Tailwind: maplibre-gl.css sets `.maplibregl-map { position:
  // relative }` unlayered, which beats Tailwind utilities and collapses height.
  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: overlay,
          transition: "background 600ms ease",
        }}
      />
    </>
  );
}
