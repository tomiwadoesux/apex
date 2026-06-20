"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "@/app/map-trail/MapTrail.module.css";
import { CITY } from "@/app/map-trail/city";
import { createNavigator } from "@/app/map-trail/streetGraph";
import { LOGO_PATHS } from "@/components/Logo";
import { useReducedMotion } from "@/components/useReducedMotion";

const VIEW = 220; // Zoomed in slightly more for the mini map
const SPEED = 25; // Speed of travel (units/sec)
const CAM_SMOOTH = 2.6; // camera catch-up smoothing
const CAM_LEAD = VIEW * 0.55;

// The widget blends into the page backdrop: its ground/surround, drop shadow and
// caption all derive from the page's BG_GRADIENT tone (mirror those values), so
// only the roads, buildings and the (untouched) pulse read on top.
const SURFACE: Record<"light" | "dark", string> = {
  light: "#cbd5e1", // mirrors page BG_GRADIENT light
  dark: "#26262b", // mirrors page BG_GRADIENT dark
};
const CAPTION_INK: Record<"light" | "dark", string> = {
  light: "#64748b", // slate, reads on the light backdrop
  dark: "#9aa1ac", // soft grey, reads on the dark backdrop
};

// Value-prop one-liners the caption types out (and deletes) on a loop.
const PITCHES = [
  "Always on time",
  "Private chauffeurs",
  "An executive fleet",
  "Airport to anywhere",
  "Discreet & seamless",
];

// Typewriter caption: types a pitch, holds, deletes, types the next — looping
// through PITCHES. Reduced-motion shows the first one static.
function RotatingCaption({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(PITCHES[0]);
  const idx = useRef(0);
  const len = useRef(PITCHES[0].length);
  const phase = useRef<"type" | "hold" | "del">("hold");

  useEffect(() => {
    if (reduced) {
      setDisplay(PITCHES[0]);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = PITCHES[idx.current % PITCHES.length];
      if (phase.current === "type") {
        len.current += 1;
        setDisplay(full.slice(0, len.current));
        if (len.current >= full.length) {
          phase.current = "hold";
          t = setTimeout(tick, 1600);
        } else t = setTimeout(tick, 58);
      } else if (phase.current === "hold") {
        phase.current = "del";
        t = setTimeout(tick, 60);
      } else {
        len.current -= 1;
        setDisplay(full.slice(0, Math.max(0, len.current)));
        if (len.current <= 0) {
          idx.current = (idx.current + 1) % PITCHES.length;
          phase.current = "type";
          t = setTimeout(tick, 320);
        } else t = setTimeout(tick, 30);
      }
    };
    t = setTimeout(tick, 1600); // hold the first pitch, then start cycling
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <span
      aria-hidden
      className="flex h-[12px] items-center text-[9px] font-bold uppercase tracking-widest opacity-70 transition-opacity duration-300 group-hover:opacity-100"
      style={{ color }}
    >
      {display}
    </span>
  );
}

const MARK_SCALE = 0.12 * (VIEW / 175);
const MARK_AX = 69;
const MARK_AY = 95;

export default function MiniMap({
  mode,
  paused = false,
}: {
  mode: "light" | "dark";
  /** stop the self-driving loop when the widget is faded out / off-screen */
  paused?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const pulseRef = useRef<SVGGElement>(null);
  const navRef = useRef<ReturnType<typeof createNavigator> | null>(null);
  const stateRef = useRef<{
    pos: { x: number; y: number; angle: number };
    cam: { x: number; y: number };
  } | null>(null);
  const reduced = useReducedMotion();
  const isLight = mode === "light";
  const active = !paused && !reduced;

  // Split minor and major roads for layered intersection drawing
  const { minorRoads, majorRoads } = useMemo(
    () => ({
      minorRoads: CITY.roads.filter((r) => !r.arterial),
      majorRoads: CITY.roads.filter((r) => r.arterial),
    }),
    []
  );

  // Self-driving simulation — position persists across pause/resume (in refs),
  // and the rAF only runs while `active` (widget visible & motion allowed).
  useEffect(() => {
    const svg = svgRef.current;
    const marker = markerRef.current;
    const pulse = pulseRef.current;
    if (!svg || !marker || !pulse) return;

    if (!navRef.current) navRef.current = createNavigator();
    const nav = navRef.current;
    if (!nav) return;

    if (!stateRef.current) {
      stateRef.current = {
        pos: { x: nav.start.x, y: nav.start.y, angle: 0 },
        cam: {
          x: nav.start.x + nav.startDir.x * CAM_LEAD,
          y: nav.start.y + nav.startDir.y * CAM_LEAD,
        },
      };
    }
    const st = stateRef.current;

    const place = () => {
      svg.setAttribute(
        "viewBox",
        `${st.cam.x - VIEW / 2} ${st.cam.y - VIEW / 2} ${VIEW} ${VIEW}`
      );
      marker.setAttribute(
        "transform",
        `translate(${st.pos.x} ${st.pos.y}) rotate(${st.pos.angle + 90}) scale(${MARK_SCALE}) translate(${-MARK_AX} ${-MARK_AY})`
      );
      pulse.setAttribute("transform", `translate(${st.pos.x} ${st.pos.y})`);
    };
    place(); // draw current position (the only draw when frozen / paused)

    if (!active) return; // paused or reduced motion → static, no loop

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      st.pos = nav.advance(SPEED * dt);
      const k = 1 - Math.exp(-CAM_SMOOTH * dt);
      st.cam.x += (st.pos.x - st.cam.x) * k;
      st.cam.y += (st.pos.y - st.cam.y) * k;
      place();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <a
      href="/map-trail"
      aria-label="View full interactive Apex Maps"
      className="pointer-events-auto group fixed bottom-4 left-6 z-20 flex flex-col items-center gap-1.5 cursor-pointer no-underline text-center"
    >
      <div
        data-theme={mode}
        style={{
          position: "relative",
          inset: "auto",
          width: "112px",
          height: "112px",
          borderRadius: "9999px",
          overflow: "hidden",
          border: "none",
          boxShadow: "none",
          background: SURFACE[mode],
          // feather the circular edge into transparency so the widget melts into
          // the page backdrop instead of reading as a hard-edged disc.
          WebkitMaskImage:
            "radial-gradient(closest-side, #000 62%, rgba(0,0,0,0.55) 82%, transparent 100%)",
          maskImage:
            "radial-gradient(closest-side, #000 62%, rgba(0,0,0,0.55) 82%, transparent 100%)",
          // override the map's ground/surround (and the gradient behind it) to the
          // page backdrop tone — minimap only, the shared CSS module is untouched.
          ["--c-land" as string]: SURFACE[mode],
          ["--bg-1" as string]: SURFACE[mode],
          ["--bg-2" as string]: SURFACE[mode],
          transition: "transform 0.3s ease, border-color 0.3s ease",
        } as CSSProperties}
        className={`${styles.wrap} group-hover:scale-105`}
      >
        <svg
          ref={svgRef}
          className={styles.map}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          role="img"
          aria-label="Apex Live mini-map widget"
        >
          {/* Base ground layer */}
          <rect
            className={styles.land}
            x={-1000}
            y={-1000}
            width={3000}
            height={3000}
          />

          {/* Parks, plazas, and water surfaces */}
          {CITY.parks.map((d, i) => (
            <path key={`mpk${i}`} className={styles.park} d={d} />
          ))}
          {CITY.plazas.map((d, i) => (
            <path key={`mpz${i}`} className={styles.plaza} d={d} />
          ))}
          {CITY.water.map((d, i) => (
            <path key={`mw${i}`} className={styles.water} d={d} />
          ))}
          {CITY.promenades.map((d, i) => (
            <path key={`mpr${i}`} className={styles.promenade} d={d} />
          ))}
          {CITY.trees.map((t, i) => (
            <circle key={`mt${i}`} className={styles.tree} cx={t.cx} cy={t.cy} r={t.r} />
          ))}

          {/* Buildings footprints */}
          {CITY.buildings.map((b, i) => (
            <rect
              key={`mbb${i}`}
              className={b.landmark ? styles.landmark : styles.building}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={1.6}
            />
          ))}

          {/* Roads layers: minor and major casing and fills */}
          {minorRoads.map((r, i) => (
            <path key={`mmc${i}`} className={styles.roadCasing} d={r.d} strokeWidth={r.casing} />
          ))}
          {majorRoads.map((r, i) => (
            <path key={`mac${i}`} className={styles.arterialCasing} d={r.d} strokeWidth={r.casing} />
          ))}
          {minorRoads.map((r, i) => (
            <path key={`mmf${i}`} className={styles.road} d={r.d} strokeWidth={r.w} />
          ))}
          {majorRoads.map((r, i) => (
            <path key={`maf${i}`} className={styles.arterial} d={r.d} strokeWidth={r.w} />
          ))}

          {/* Roundabout islands */}
          {CITY.islands.map((s, i) => (
            <circle key={`mis${i}`} className={styles.island} cx={s.cx} cy={s.cy} r={s.r} />
          ))}

          {/* GPS pulse under the self-driving marker */}
          <g ref={pulseRef}>
            <circle className={styles.pulse} r={3} />
          </g>

          {/* The self-driving apex delta marker */}
          <g ref={markerRef} className={styles.marker}>
            <path className={styles.markerBody} d={LOGO_PATHS[0]} />
            <path className={styles.markerDot} d={LOGO_PATHS[1]} />
          </g>
        </svg>
      </div>
      <RotatingCaption color={CAPTION_INK[mode]} />
    </a>
  );
}
