"use client";

// Lenis smooth scroll, mounted in "root" mode so it animates the REAL window scroll
// (and keeps emitting native "scroll" events). The landing page's scrubbed scroll
// story reads window scroll via GSAP ScrollTrigger, so it keeps working exactly as
// before — just silky.
//
// Lenis is driven by GSAP's single ticker (autoRaf off) so the wheel smoothing and
// every ScrollTrigger update run on the SAME rAF frame — without that, the pinned,
// scrubbed hero story double-buffers against Lenis and visibly jitters. `root`
// renders no wrapper element, so it doesn't disturb the page layout.
//
// prefers-reduced-motion: drop the wheel smoothing (native scroll, instant) so
// motion-sensitive visitors get a plain, immediate scroll.
import { ReactLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/components/useReducedMotion";

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // Drive Lenis from GSAP's ticker (its own rAF is disabled via autoRaf:false).
    // gsap.ticker time is in SECONDS; Lenis' raf wants milliseconds.
    const raf = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0); // never "catch up" after a stall — keep scroll exact

    // Keep ScrollTrigger's cached scroll position locked to Lenis' smoothed position.
    const lenis = lenisRef.current?.lenis;
    lenis?.on("scroll", ScrollTrigger.update);

    return () => {
      gsap.ticker.remove(raf);
      lenis?.off("scroll", ScrollTrigger.update);
    };
  }, [reduced]);

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{
        // lerp = how quickly the smoothed position catches the target each frame
        // (lower = longer, silkier glide). 1 = no smoothing (reduced motion).
        lerp: reduced ? 1 : 0.1,
        smoothWheel: !reduced,
        wheelMultiplier: 1,
        touchMultiplier: 1.4,
        // GSAP's ticker runs the rAF above — don't let Lenis run a second one.
        autoRaf: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
