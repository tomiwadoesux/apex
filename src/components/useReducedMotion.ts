"use client";

import { useSyncExternalStore } from "react";

// Tracks the user's `prefers-reduced-motion` setting (and updates if it changes).
// CSS-based motion is handled globally in globals.css; this hook is for the
// JS / rAF / WebGL animations that CSS can't reach (the 3D scenes, the
// self-driving map loops). useSyncExternalStore is the idiomatic way to read an
// external source like matchMedia — SSR-safe and tear-free.
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false; // assume motion is allowed during SSR
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
