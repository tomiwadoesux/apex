"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SCENE_CENTER, type CameraState, type MapSettings } from "./map-settings";

const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function rasterPaint(s: MapSettings) {
  return {
    "raster-hue-rotate": s.hue,
    "raster-saturation": s.saturation,
    "raster-brightness-max": s.brightness,
    "raster-contrast": s.contrast,
    "raster-fade-duration": 300,
  } as const;
}

function buildStyle(s: MapSettings): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
      },
    },
    sky: {
      "sky-color": "#0b1118",
      "horizon-color": "#1d2b38",
      "fog-color": "#0b1118",
      "fog-ground-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "sky-horizon-blend": 0.9,
      "atmosphere-blend": 0.5,
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#06090d" },
      },
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        paint: rasterPaint(s),
      },
    ],
  };
}

export default function MapStage({
  settings,
  onCameraChange,
}: {
  settings: MapSettings;
  onCameraChange: (camera: CameraState) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);

  // Keep latest values reachable from map event handlers without re-binding them
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;

  // Create the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: buildStyle(settingsRef.current),
      center: SCENE_CENTER,
      zoom: settingsRef.current.zoom,
      pitch: settingsRef.current.pitch,
      bearing: settingsRef.current.bearing,
      maxPitch: 85,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on("load", () => {
      loadedRef.current = true;
      // Re-apply in case sliders moved while tiles were loading
      for (const [key, value] of Object.entries(rasterPaint(settingsRef.current))) {
        map.setPaintProperty("satellite", key, value);
      }
    });

    // Glowing orb marker (plain DOM element, styled in globals.css)
    const orb = document.createElement("div");
    orb.className = "orb-marker";
    new maplibregl.Marker({ element: orb }).setLngLat(SCENE_CENTER).addTo(map);

    // Report drag/rotate/zoom gestures back so the panel sliders stay in sync
    map.on("move", () => {
      onCameraChangeRef.current({
        pitch: Math.round(map.getPitch() * 10) / 10,
        bearing: Math.round(map.getBearing() * 10) / 10,
        zoom: Math.round(map.getZoom() * 100) / 100,
      });
    });

    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Panel sliders → camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const inSync =
      Math.abs(map.getPitch() - settings.pitch) < 0.05 &&
      Math.abs(map.getBearing() - settings.bearing) < 0.05 &&
      Math.abs(map.getZoom() - settings.zoom) < 0.005;
    if (!inSync) {
      map.jumpTo({
        pitch: settings.pitch,
        bearing: settings.bearing,
        zoom: settings.zoom,
      });
    }
  }, [settings.pitch, settings.bearing, settings.zoom]);

  // Panel sliders → imagery color grade
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    for (const [key, value] of Object.entries(rasterPaint(settings))) {
      map.setPaintProperty("satellite", key, value);
    }
  }, [settings.hue, settings.saturation, settings.brightness, settings.contrast]);

  // Inline style, not Tailwind classes: maplibre-gl.css sets `.maplibregl-map
  // { position: relative }` unlayered, which beats Tailwind's layered utilities
  // and collapses the container to zero height.
  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
