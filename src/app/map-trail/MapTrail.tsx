"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./MapTrail.module.css";
import { CITY, CANVAS } from "./city";
import { createNavigator } from "./streetGraph";
import Logo, { LOGO_PATHS } from "@/components/Logo";
import { useReducedMotion } from "@/components/useReducedMotion";

const VIEW = 250; // viewBox window (of the 600-unit map) — larger = zoomed out
const SPEED = 25; // svg units / second the navigator drives
const CAM_SMOOTH = 2.6; // higher = camera catches the navigator faster
const CAM_LEAD = VIEW * 0.55; // camera starts this far ahead so the marker drives in

// Logo art is a 139×152 box; map it down and pivot near its visual centre so it
// sits on the road and the pointy end leads in the direction of travel. Scale
// tracks VIEW so the marker keeps a constant on-screen size at any zoom.
const MARK_SCALE = 0.12 * (VIEW / 175);
const MARK_AX = 69;
const MARK_AY = 95;

type Theme = "light" | "dark";

const LABEL_CLASS: Record<string, string> = {
  street: styles.labelStreet,
  poi: styles.labelPoi,
  park: styles.labelPark,
  water: styles.labelWater,
};

export default function MapTrail() {
  const svgRef = useRef<SVGSVGElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const pulseRef = useRef<SVGGElement>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const reduced = useReducedMotion();

  // Split roads so arterials paint last (on top at intersections).
  const { minorRoads, majorRoads } = useMemo(
    () => ({
      minorRoads: CITY.roads.filter((r) => !r.arterial),
      majorRoads: CITY.roads.filter((r) => r.arterial),
    }),
    [],
  );

  // Resolve stored / system theme after mount → no SSR hydration mismatch.
  useEffect(() => {
    const stored = localStorage.getItem("apex-map-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
    else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      try {
        localStorage.setItem("apex-map-theme", next);
      } catch {
        /* private mode — ignore */
      }
      return next;
    });

  // Drive loop — imperative (viewBox + marker transform) so it never triggers a
  // React re-render. Runs once; theme toggles don't restart it.
  useEffect(() => {
    const svg = svgRef.current;
    const marker = markerRef.current;
    const pulse = pulseRef.current;
    if (!svg || !marker || !pulse) return;

    const nav = createNavigator();
    if (!nav) return;

    let pos = { x: nav.start.x, y: nav.start.y, angle: 0 };
    // Camera starts ahead of the navigator so it drives in from off-frame.
    const cam = {
      x: nav.start.x + nav.startDir.x * CAM_LEAD,
      y: nav.start.y + nav.startDir.y * CAM_LEAD,
    };

    const place = () => {
      svg.setAttribute(
        "viewBox",
        `${cam.x - VIEW / 2} ${cam.y - VIEW / 2} ${VIEW} ${VIEW}`,
      );
      marker.setAttribute(
        "transform",
        `translate(${pos.x} ${pos.y}) rotate(${pos.angle + 90}) scale(${MARK_SCALE}) translate(${-MARK_AX} ${-MARK_AY})`,
      );
      pulse.setAttribute("transform", `translate(${pos.x} ${pos.y})`);
    };
    place();

    if (reduced) return; // reduced motion → park the navigator, no drive loop

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      pos = nav.advance(SPEED * dt);
      const k = 1 - Math.exp(-CAM_SMOOTH * dt);
      cam.x += (pos.x - cam.x) * k;
      cam.y += (pos.y - cam.y) * k;
      place();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div className={styles.wrap} data-theme={theme}>
      <header className={styles.brand}>
        <Logo size={24} animate="float" title="Apex" />
        <span className={styles.brandName}>
          Apex<span className={styles.brandThin}>Maps</span>
        </span>
      </header>

      <button
        type="button"
        className={styles.toggle}
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} map`}
      >
        <span className={styles.toggleIcon} aria-hidden>
          {theme === "light" ? "🌙" : "☀️"}
        </span>
        {theme === "light" ? "Dark" : "Light"}
      </button>

      <div className={styles.frame}>
        <svg
          ref={svgRef}
          className={styles.map}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          role="img"
          aria-label="The Apex mark driving itself around the streets of Apex District"
        >
          {/* land */}
          <rect
            className={styles.land}
            x={-CANVAS}
            y={-CANVAS}
            width={CANVAS * 3}
            height={CANVAS * 3}
          />

          {/* parks, plazas, water, promenades */}
          {CITY.parks.map((d, i) => (
            <path key={`pk${i}`} className={styles.park} d={d} />
          ))}
          {CITY.plazas.map((d, i) => (
            <path key={`pz${i}`} className={styles.plaza} d={d} />
          ))}
          {CITY.water.map((d, i) => (
            <path key={`w${i}`} className={styles.water} d={d} />
          ))}
          {CITY.promenades.map((d, i) => (
            <path key={`pr${i}`} className={styles.promenade} d={d} />
          ))}
          {CITY.trees.map((t, i) => (
            <circle key={`t${i}`} className={styles.tree} cx={t.cx} cy={t.cy} r={t.r} />
          ))}

          {/* buildings — faux-3D drop shadow, then the footprint */}
          {CITY.buildings.map((b, i) => (
            <rect
              key={`bs${i}`}
              className={styles.buildingShadow}
              x={b.x + 1.6}
              y={b.y + 2.4}
              width={b.w}
              height={b.h}
              rx={1.6}
            />
          ))}
          {CITY.buildings.map((b, i) => (
            <rect
              key={`bb${i}`}
              className={b.landmark ? styles.landmark : styles.building}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={1.6}
            />
          ))}
          {CITY.malls.map((m, i) => (
            <path key={`m${i}`} className={styles.mall} d={m.d} />
          ))}

          {/* roads: all casings first, then fills; arterials on top of each */}
          {minorRoads.map((r, i) => (
            <path key={`mc${i}`} className={styles.roadCasing} d={r.d} strokeWidth={r.casing} />
          ))}
          {majorRoads.map((r, i) => (
            <path key={`ac${i}`} className={styles.arterialCasing} d={r.d} strokeWidth={r.casing} />
          ))}
          {minorRoads.map((r, i) => (
            <path key={`mf${i}`} className={styles.road} d={r.d} strokeWidth={r.w} />
          ))}
          {majorRoads.map((r, i) => (
            <path key={`af${i}`} className={styles.arterial} d={r.d} strokeWidth={r.w} />
          ))}

          {/* roundabout island + fountains */}
          {CITY.islands.map((s, i) => (
            <circle key={`is${i}`} className={styles.island} cx={s.cx} cy={s.cy} r={s.r} />
          ))}
          {CITY.fountains.map((f, i) => (
            <g key={`f${i}`} transform={`translate(${f.cx} ${f.cy})`}>
              <circle className={styles.fountainBasin} r={f.r} />
              <circle className={styles.fountainRim} r={f.r * 0.62} />
              <circle className={styles.fountainJet} r={f.r * 0.22} />
            </g>
          ))}

          {/* place + street labels */}
          {CITY.labels.map((l, i) => (
            <text
              key={`l${i}`}
              className={LABEL_CLASS[l.kind]}
              fontSize={l.size}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`translate(${l.x} ${l.y}) rotate(${l.rot})`}
            >
              {l.text}
            </text>
          ))}

          {/* GPS pulse under the marker */}
          <g ref={pulseRef}>
            <circle className={styles.pulse} r={3} />
          </g>

          {/* the navigator — the Apex logo itself */}
          <g ref={markerRef} className={styles.marker}>
            <path className={styles.markerBody} d={LOGO_PATHS[0]} />
            <path className={styles.markerDot} d={LOGO_PATHS[1]} />
          </g>
        </svg>
      </div>

      <p className={styles.caption}>
        <Logo size={13} animate="beat" className={styles.captionLogo} />
        Apex District · self-driving demo
      </p>
    </div>
  );
}
