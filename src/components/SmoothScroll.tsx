"use client";

// Lenis smooth scroll, mounted in "root" mode so it animates the REAL window
// scroll (and keeps emitting native "scroll" events). The landing page's 3D car
// tour reads window.scrollY and listens to "scroll", so it keeps working exactly
// as before — just silky. `root` renders a fragment (no wrapper element), so it
// doesn't disturb the page layout, and exposes the instance via useLenis().
//
// prefers-reduced-motion: drop the wheel smoothing (native scroll, instant) so
// motion-sensitive visitors get a plain, immediate scroll.
import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/components/useReducedMotion";

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <ReactLenis
      root
      options={{
        // lerp = how quickly the smoothed position catches the target each frame
        // (lower = longer, silkier glide). 1 = no smoothing (reduced motion).
        lerp: reduced ? 1 : 0.1,
        smoothWheel: !reduced,
        wheelMultiplier: 1,
        touchMultiplier: 1.4,
      }}
    >
      {children}
    </ReactLenis>
  );
}
