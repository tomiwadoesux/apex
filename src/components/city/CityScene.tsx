"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildCityModel, type MatKey } from "./cityModel";
import { createNavigator } from "@/app/map-trail/streetGraph";
import { CITY } from "@/app/map-trail/city";
import { LOGO_PATHS, LOGO_VIEWBOX, LOGO_W, LOGO_H } from "@/components/Logo";

export type Mode = "light" | "dark";

// Flat, ground-hugging surfaces are double-sided (their winding is arbitrary);
// solid prisms keep front-side culling.
const FLAT = new Set<MatKey>([
  "ground",
  "water",
  "grass",
  "plaza",
  "sidewalk",
  "road",
  "lane",
]);
// Only the tall solids cast shadows; flat near-coplanar pieces just receive.
const CASTERS = new Set<MatKey>([
  "buildingA",
  "buildingB",
  "buildingC",
  "landmark",
  "treeFoliage",
  "treeTrunk",
]);

type Pal = Record<MatKey, string>;
const THEME: Record<
  Mode,
  { bg: string; fog: [number, number]; accent: string; building: string; mats: Pal }
> = {
  light: {
    bg: "#e9edf2",
    fog: [210, 540],
    accent: "#00209C",
    building: "#e4e0d6", // single flat colour for every building (cinematic 404)
    mats: {
      ground: "#dde2e9",
      water: "#b7d6e8",
      grass: "#cfe6bf",
      plaza: "#e7e1d4",
      sidewalk: "#ced3db",
      road: "#9aa1ac",
      lane: "#00209C",
      buildingA: "#e7e2da",
      buildingB: "#dde2e9",
      buildingC: "#f2f1ed",
      landmark: "#d8d1e6",
      trim: "#00209C",
      treeFoliage: "#7cc081",
      treeTrunk: "#9a8b78",
      fountain: "#cdd3da",
      fountainWater: "#bfe0ef",
      island: "#cfe6bf",
    },
  },
  dark: {
    bg: "#16222e",
    fog: [220, 560],
    accent: "#FDBA16",
    building: "#46545f",
    mats: {
      ground: "#26333f",
      water: "#1d4a6b",
      grass: "#316b53",
      plaza: "#3c4854",
      sidewalk: "#414e5b",
      road: "#4d5a67",
      lane: "#FDBA16",
      buildingA: "#3f4f5e",
      buildingB: "#4a5a68",
      buildingC: "#566776",
      landmark: "#534d72",
      trim: "#FDBA16",
      treeFoliage: "#3f8b75",
      treeTrunk: "#3b4854",
      fountain: "#414e5b",
      fountainWater: "#3a86b0",
      island: "#316b53",
    },
  },
};

// White-silhouette logo texture (tinted per material) — same trick as CarStage.
function makeLogoTexture(): THREE.Texture {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}" width="${LOGO_W}" height="${LOGO_H}">` +
    `<path d="${LOGO_PATHS[0]}" fill="#ffffff"/><path d="${LOGO_PATHS[1]}" fill="#ffffff"/></svg>`;
  const tex = new THREE.TextureLoader().load(
    "data:image/svg+xml;utf8," + encodeURIComponent(svg),
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A tiny low-poly window grid baked into one 64px canvas — white wall (tinted by
// the building's own colour) with slightly darker window panes. One shared
// texture, GPU-tiled per box face, so it adds essentially nothing to the cost.
function makeWindowTexture(): THREE.Texture {
  const px = 64;
  const c = document.createElement("canvas");
  c.width = px;
  c.height = px;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // wall — multiplied by the material colour
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = "rgba(0,0,0,0.16)"; // panes: a touch darker than the wall
  const cols = 3;
  const rows = 4;
  const m = 9;
  const gw = (px - m * 2) / cols;
  const gh = (px - m * 2) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      ctx.fillRect(m + i * gw + 2, m + j * gh + 2, gw - 4, gh - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Two brand accents the blinking billboards pulse between.
const BRAND_BLUE = new THREE.Color("#00209C");
const BRAND_YELLOW = new THREE.Color("#FDBA16");

// "ApexRide" wordmark + a little tagline, baked once (white, transparent bg).
function makeWordmarkTexture(): THREE.Texture {
  const w = 256;
  const h = 96;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 46px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("ApexRide", w / 2, 48);
  ctx.globalAlpha = 0.82;
  ctx.font = "400 22px system-ui, sans-serif";
  ctx.fillText("Ride in style", w / 2, 80);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A roadside ApexRide AD: a brand-accent panel with the logo as the hero and a
// small "ApexRide" wordmark. Some billboards blink between the two brand accents.
function Billboard({
  x,
  z,
  rotY,
  accent,
  post,
  dark,
  tex,
  wordTex,
  blink,
}: {
  x: number;
  z: number;
  rotY: number;
  accent: string;
  post: string;
  dark: boolean;
  tex: THREE.Texture;
  wordTex: THREE.Texture;
  blink: boolean;
}) {
  const panelRef = useRef<THREE.MeshStandardMaterial>(null);
  const logoW = 1.15;
  const logoH = (logoW * LOGO_H) / LOGO_W;
  useFrame((state) => {
    const m = panelRef.current;
    if (!blink || !m) return;
    const t = (Math.sin(state.clock.elapsedTime * 1.6) + 1) / 2;
    m.color.lerpColors(BRAND_BLUE, BRAND_YELLOW, t);
    m.emissive.copy(m.color);
  });
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {/* two posts */}
      {[-1.35, 1.35].map((px) => (
        <mesh key={px} position={[px, 1.65, 0]} castShadow>
          <boxGeometry args={[0.16, 3.3, 0.16]} />
          <meshStandardMaterial color={post} flatShading />
        </mesh>
      ))}
      {/* the AD panel — a brand-accent board (blinks on some billboards) */}
      <mesh position={[0, 4.2, 0]} castShadow>
        <boxGeometry args={[3.5, 2.1, 0.14]} />
        <meshStandardMaterial
          ref={panelRef}
          color={accent}
          emissive={accent}
          emissiveIntensity={dark ? 0.55 : 0.14}
          flatShading
        />
      </mesh>
      {/* the logo is the HERO of the ad (white on the brand panel) */}
      <mesh position={[0, 4.6, 0.09]}>
        <planeGeometry args={[logoW, logoH]} />
        <meshStandardMaterial
          map={tex}
          transparent
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={dark ? 0.5 : 0.18}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* "ApexRide" + tagline beneath the logo */}
      <mesh position={[0, 3.78, 0.09]}>
        <planeGeometry args={[2.7, 1.01]} />
        <meshStandardMaterial map={wordTex} transparent color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// SVG(600) → world transform — identical to cityModel, so positions line up.
const HALF = 300;
const S = 0.2;

// Every accent in the scene EXCEPT the driving logo is held at this opacity, so
// the hovering ApexRide logo is the only thing that reads at full strength.
const ACCENT_DIM = 0.35;

// The ApexRide logo, self-driving over the city roads using the SAME navigator as
// the landing-page mini-map — but hovering above the streets in 3D. The marker
// glides along the street graph and its apex points the way it's heading.
function RoadLogo({
  accent,
  dark,
  tex,
}: {
  accent: string;
  dark: boolean;
  tex: THREE.Texture;
}) {
  const nav = useMemo(() => createNavigator(), []);
  const ref = useRef<THREE.Group>(null);
  const sm = useRef({ x: 0, z: 0, rot: 0, ready: false });
  const logoW = 2.0; // smaller so it stays on the road, not overhanging buildings
  const logoH = (logoW * LOGO_H) / LOGO_W;
  const HOVER_Y = 0.8; // hovers just above the road surface (Y.lane ≈ 0.27)
  const SPEED = 20; // svg units / second — a calm glide

  useFrame((state, dt) => {
    const g = ref.current;
    if (!nav || !g) return;
    const p = nav.advance(SPEED * Math.min(dt, 0.05));
    const x = (p.x - HALF) * S;
    const z = (p.y - HALF) * S;
    const rot = -(p.angle * Math.PI) / 180 - Math.PI / 2; // apex faces travel dir
    const s = sm.current;
    if (!s.ready) {
      s.x = x;
      s.z = z;
      s.rot = rot;
      s.ready = true;
    }
    const k = 1 - Math.exp(-16 * dt); // tight catch-up so it hugs the road (incl. the ring)
    s.x += (x - s.x) * k;
    s.z += (z - s.z) * k;
    let dr = (rot - s.rot) % (Math.PI * 2); // shortest-arc heading ease
    if (dr > Math.PI) dr -= Math.PI * 2;
    if (dr < -Math.PI) dr += Math.PI * 2;
    s.rot += dr * k;
    const bob = Math.sin(state.clock.elapsedTime * 1.8) * 0.12; // gentle hover bob
    g.position.set(s.x, HOVER_Y + bob, s.z);
    g.rotation.y = s.rot;
  });

  if (!nav) return null;
  return (
    <group ref={ref}>
      {/* flat logo lying face-up, gliding over the roads (accent-tinted, glows) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[logoW, logoH]} />
        <meshStandardMaterial
          map={tex}
          transparent
          color={accent}
          emissive={accent}
          emissiveIntensity={dark ? 1 : 0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ===========================================================================
//  CINEMATIC 404 — a self-driving camera that keeps cutting to random vantage
//  points (atop a building, behind a streetlight, riding the logo) while the
//  ApexRide logo glides the streets and ALWAYS passes through wherever we look.
// ===========================================================================

const LOGO_HOVER_Y = 0.8; // matches RoadLogo's hover height

type RoutePt = { x: number; z: number };
type Route = { pts: RoutePt[]; cum: number[]; total: number };
// Live position of the driving logo, updated each frame inside CinematicRig and
// read by the camera director so its focus is always a point the logo reaches.
type LogoState = {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  idx: number;
  ready: boolean;
};
type BuildingAnchor = { x: number; z: number; topY: number };
type StreetLight = { x: number; z: number; rotY: number };

// Bake the navigator's endless drive into a long world-space polyline ONCE, so
// both the logo and the camera share the exact same road path.
function buildRoute(): Route | null {
  const nav = createNavigator();
  if (!nav) return null;
  const pts: RoutePt[] = [];
  const push = (sx: number, sy: number) => {
    const x = (sx - HALF) * S;
    const z = (sy - HALF) * S;
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(x - last.x, z - last.z) > 1e-3) pts.push({ x, z });
  };
  push(nav.start.x, nav.start.y);
  for (let i = 0; i < 2600; i++) {
    const p = nav.advance(6);
    push(p.x, p.y);
  }
  if (pts.length < 2) return null;
  const cum = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    cum.push(total);
  }
  return { pts, cum, total };
}

// Recover each building's world centre + roof height from the SAME footprint
// data + hash the geometry builder uses, so "on top of a building" lands on a
// real roof.
function buildBuildingAnchors(): BuildingAnchor[] {
  const baseY = 0.14; // Y.base in cityModel
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  return CITY.buildings.map((b) => {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const r = hash(b.x, b.y);
    const h = b.landmark ? 15 : 1.3 + r * r * 5.4;
    return { x: (cx - HALF) * S, z: (cy - HALF) * S, topY: baseY + h };
  });
}

// Streetlights line the route at the kerb (offset perpendicular, alternating
// sides) — so they sit beside roads the logo actually drives.
function buildStreetlights(pts: RoutePt[]): StreetLight[] {
  const out: StreetLight[] = [];
  const STEP = 60;
  const OFFSET = 2.9; // world units from road centre to kerb
  for (let i = STEP; i < pts.length - 1; i += STEP) {
    const a = pts[i];
    const b = pts[i + 1];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const side = (i / STEP) % 2 === 0 ? 1 : -1;
    out.push({
      x: a.x - dz * OFFSET * side,
      z: a.z + dx * OFFSET * side,
      rotY: Math.atan2(dx, dz),
    });
  }
  return out;
}

function Streetlights({ lights, mode }: { lights: StreetLight[]; mode: Mode }) {
  const dark = mode === "dark";
  const pole = dark ? "#2c3742" : "#9aa3ad";
  const lamp = THEME[mode].accent;
  const H = 4.6;
  return (
    <group>
      {lights.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.rotY, 0]}>
          <mesh position={[0, H / 2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, H, 6]} />
            <meshStandardMaterial color={pole} flatShading />
          </mesh>
          <mesh position={[0, H - 0.1, 0.5]}>
            <boxGeometry args={[0.08, 0.08, 1.0]} />
            <meshStandardMaterial color={pole} flatShading />
          </mesh>
          <mesh position={[0, H - 0.16, 1.0]}>
            <boxGeometry args={[0.34, 0.14, 0.5]} />
            <meshStandardMaterial
              color={lamp}
              emissive={lamp}
              emissiveIntensity={dark ? 1.1 : 0.5}
              flatShading
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// Minimal shape of drei's OrbitControls we drive imperatively.
type ControlsLike = {
  target: THREE.Vector3;
  update: () => void;
  addEventListener?: (e: string, cb: () => void) => void;
  removeEventListener?: (e: string, cb: () => void) => void;
};

type Director = {
  phase: "ease" | "hold" | "ride";
  interacting: boolean;
  fromPos: THREE.Vector3;
  fromTar: THREE.Vector3;
  toPos: THREE.Vector3;
  toTar: THREE.Vector3;
  t: number;
  dur: number;
  holdLeft: number;
  rideLeft: number;
  rideBack: number;
  rideUp: number;
  rideSide: number;
  rideLook: number;
};

// Drives the logo along the shared route AND directs the camera — kept in one
// component so every mutated ref is local (the producer/consumer never cross a
// prop boundary). It renders the gliding logo and, each frame, picks random
// vantage points and glides the camera between them. Every static shot looks at
// a point a little AHEAD of the logo on the route, so the logo always drives
// into frame; ride shots sit just behind/above it.
function CinematicRig({
  route,
  buildings,
  lights,
  mode,
}: {
  route: Route;
  buildings: BuildingAnchor[];
  lights: StreetLight[];
  mode: Mode;
}) {
  const accent = THEME[mode].accent;
  const dark = mode === "dark";
  const tex = useMemo(() => makeLogoTexture(), []);
  const logoW = 2.0;
  const logoH = (logoW * LOGO_H) / LOGO_W;
  const SPEED = 5.4; // world units / second — a calm glide

  // drei OrbitControls (makeDefault) registers itself here. Used only to attach
  // start/end listeners; per-frame reads/writes go through the useFrame state so
  // we never mutate a render-scope value.
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  // --- logo drive state (all local refs) ---
  const groupRef = useRef<THREE.Group>(null);
  const sm = useRef({ x: 0, z: 0, rot: 0, ready: false });
  const dist = useRef(0);
  const seg = useRef(0);
  const logo = useRef<LogoState>({
    x: 0,
    z: 0,
    dirX: 1,
    dirZ: 0,
    idx: 0,
    ready: false,
  });
  // --- camera director state ---
  const dir = useRef<Director | null>(null);

  useEffect(() => {
    if (!controls?.addEventListener) return;
    const onStart = () => {
      if (dir.current) dir.current.interacting = true;
    };
    const onEnd = () => {
      const D = dir.current;
      if (D) {
        D.interacting = false;
        D.phase = "hold";
        D.holdLeft = 5.5; // let them look before the next cut
      }
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    return () => {
      controls.removeEventListener?.("start", onStart);
      controls.removeEventListener?.("end", onEnd);
    };
  }, [controls]);

  const nearest = <T extends { x: number; z: number }>(
    arr: T[],
    fx: number,
    fz: number,
    min: number,
    max: number,
    extra?: (a: T) => boolean,
  ): T | null => {
    let best: T | null = null;
    let bestD = Infinity;
    for (const a of arr) {
      const d = Math.hypot(a.x - fx, a.z - fz);
      if (d < min || d > max) continue;
      if (extra && !extra(a)) continue;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  };

  const chooseShot = (cam: THREE.Camera, ctrl: ControlsLike, first = false) => {
    const D = dir.current!;
    D.fromPos.copy(cam.position);
    D.fromTar.copy(ctrl.target);

    const roll = Math.random();
    if (!first && roll < 0.45) {
      // ride the moving logo
      D.phase = "ride";
      D.rideLeft = 4 + Math.random() * 3;
      D.rideBack = 6 + Math.random() * 2.4;
      D.rideUp = 2.8 + Math.random() * 1.8;
      D.rideSide = (Math.random() * 2 - 1) * 2.2;
      D.rideLook = 3 + Math.random() * 2;
      return;
    }

    // a static vantage that looks at a road point the logo will reach soon
    const { pts } = route;
    const lead = 40 + Math.floor(Math.random() * 130);
    const fi = (logo.current.idx + lead) % (pts.length - 1);
    const focus = new THREE.Vector3(pts[fi].x, 1.0, pts[fi].z);
    const pos = new THREE.Vector3();

    // First load opens on a wide establishing aerial; afterwards mix rooftop and
    // streetlight vantages.
    const kind = first
      ? "aerial"
      : roll < 0.72
        ? "building"
        : roll < 0.9
          ? "light"
          : "aerial";
    let placed = false;
    if (kind === "building") {
      // high above a nearby rooftop, looking down at the street below
      const b = nearest(buildings, focus.x, focus.z, 5, 20, (a) => a.topY > 2);
      if (b) {
        pos.set(b.x, b.topY + 7 + Math.random() * 4, b.z);
        placed = true;
      }
    } else if (kind === "light") {
      // just behind a streetlight (the pole frames the foreground)
      const sl = nearest(lights, focus.x, focus.z, 3, 22);
      if (sl) {
        const dx = sl.x - focus.x;
        const dz = sl.z - focus.z;
        const l = Math.hypot(dx, dz) || 1;
        pos.set(sl.x + (dx / l) * 1.6, 4.6 + Math.random() * 1.2, sl.z + (dz / l) * 1.6);
        placed = true;
      }
    }
    if (!placed) {
      // aerial three-quarter on the focus (also the establishing/first shot)
      const ang = Math.random() * Math.PI * 2;
      const rad = first ? 26 + Math.random() * 8 : 15 + Math.random() * 10;
      const hi = first ? 18 + Math.random() * 6 : 11 + Math.random() * 7;
      pos.set(focus.x + Math.cos(ang) * rad, hi, focus.z + Math.sin(ang) * rad);
    }

    // Guarantee we look DOWN at the focus from a sane distance, so the street
    // (and the logo passing it) is always framed — never grazing a rooftop.
    const hx = pos.x - focus.x;
    const hz = pos.z - focus.z;
    const hd = Math.hypot(hx, hz);
    if (hd < 6) {
      const a = hd > 1e-3 ? Math.atan2(hz, hx) : Math.random() * Math.PI * 2;
      pos.x = focus.x + Math.cos(a) * 8;
      pos.z = focus.z + Math.sin(a) * 8;
    }
    if (pos.y - focus.y < 5) pos.y = focus.y + 6;

    D.toPos.copy(pos);
    D.toTar.copy(focus);
    D.t = 0;
    D.dur = first ? 1.7 : 1.2 + Math.random() * 0.8;
    D.holdLeft = 3.5 + Math.random() * 3;
    D.phase = "ease";
  };

  useFrame((s, dt) => {
    // ---- 1) drive the logo along the route ----
    const g = groupRef.current;
    if (g) {
      const { pts, cum, total } = route;
      let d = dist.current + SPEED * Math.min(dt, 0.05);
      if (d >= total) {
        d -= total;
        seg.current = 0;
      }
      dist.current = d;
      let i = seg.current;
      while (i < cum.length - 2 && cum[i + 1] < d) i++;
      seg.current = i;
      const segLen = cum[i + 1] - cum[i] || 1;
      const f = Math.min(1, Math.max(0, (d - cum[i]) / segLen));
      const a = pts[i];
      const b = pts[i + 1];
      const x = a.x + (b.x - a.x) * f;
      const z = a.z + (b.z - a.z) * f;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const ln = Math.hypot(dx, dz) || 1;
      dx /= ln;
      dz /= ln;
      const rot = -Math.atan2(dz, dx) - Math.PI / 2; // apex faces travel dir
      const st = sm.current;
      if (!st.ready) {
        st.x = x;
        st.z = z;
        st.rot = rot;
        st.ready = true;
      }
      const k = 1 - Math.exp(-16 * dt);
      st.x += (x - st.x) * k;
      st.z += (z - st.z) * k;
      let dr = (rot - st.rot) % (Math.PI * 2);
      if (dr > Math.PI) dr -= Math.PI * 2;
      if (dr < -Math.PI) dr += Math.PI * 2;
      st.rot += dr * k;
      const bob = Math.sin(s.clock.elapsedTime * 1.8) * 0.12;
      g.position.set(st.x, LOGO_HOVER_Y + bob, st.z);
      g.rotation.y = st.rot;
      const L = logo.current;
      L.x = st.x;
      L.z = st.z;
      L.dirX = dx;
      L.dirZ = dz;
      L.idx = i;
      L.ready = true;
    }

    // ---- 2) direct the camera ----
    // Reach camera/controls through the frame state (not render-scope closures)
    // so we never mutate a captured render value.
    const cam = s.camera;
    const ctrl = s.controls as unknown as ControlsLike | null;
    if (!ctrl || !logo.current.ready) return;
    if (!dir.current) {
      dir.current = {
        phase: "hold",
        interacting: false,
        fromPos: new THREE.Vector3(),
        fromTar: new THREE.Vector3(),
        toPos: new THREE.Vector3(),
        toTar: new THREE.Vector3(),
        t: 0,
        dur: 1.4,
        holdLeft: 0,
        rideLeft: 0,
        rideBack: 6,
        rideUp: 3,
        rideSide: 0,
        rideLook: 4,
      };
      chooseShot(cam, ctrl, true); // open on an establishing aerial
    }
    const D = dir.current;
    if (D.interacting) return; // hands off while the user is dragging

    const step = Math.min(dt, 0.05);
    if (D.phase === "ease") {
      D.t = Math.min(1, D.t + step / D.dur);
      const e = easeInOut(D.t);
      cam.position.lerpVectors(D.fromPos, D.toPos, e);
      ctrl.target.lerpVectors(D.fromTar, D.toTar, e);
      ctrl.update();
      if (D.t >= 1) D.phase = "hold";
    } else if (D.phase === "hold") {
      D.holdLeft -= step;
      if (D.holdLeft <= 0) chooseShot(cam, ctrl);
    } else {
      // ride: smoothly follow just behind/above the logo
      const L = logo.current;
      const sideX = -L.dirZ;
      const sideZ = L.dirX;
      const wantX = L.x - L.dirX * D.rideBack + sideX * D.rideSide;
      const wantZ = L.z - L.dirZ * D.rideBack + sideZ * D.rideSide;
      const wantY = LOGO_HOVER_Y + D.rideUp;
      const k = 1 - Math.exp(-2.6 * step);
      cam.position.x += (wantX - cam.position.x) * k;
      cam.position.y += (wantY - cam.position.y) * k;
      cam.position.z += (wantZ - cam.position.z) * k;
      ctrl.target.x += (L.x + L.dirX * D.rideLook - ctrl.target.x) * k;
      ctrl.target.y += (0.9 - ctrl.target.y) * k;
      ctrl.target.z += (L.z + L.dirZ * D.rideLook - ctrl.target.z) * k;
      ctrl.update();
      D.rideLeft -= step;
      if (D.rideLeft <= 0) chooseShot(cam, ctrl);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[logoW, logoH]} />
        <meshStandardMaterial
          map={tex}
          transparent
          color={accent}
          emissive={accent}
          emissiveIntensity={dark ? 1 : 0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// One label baked to a canvas (Google-Maps style: soft text with a halo). Returns
// the texture + its aspect so the ground plane can be sized to the text.
function makeLabelTexture(
  text: string,
  kind: string,
  dark: boolean,
): { tex: THREE.Texture; aspect: number } {
  const fontPx = 44;
  const weight = kind === "street" ? 600 : 700;
  const font = `${weight} ${fontPx}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = font;
  const tw = meas.measureText(text).width;
  const pad = 16;
  const c = document.createElement("canvas");
  c.width = Math.ceil(tw + pad * 2);
  c.height = fontPx + pad * 2;
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = dark ? "rgba(12,18,26,0.85)" : "rgba(255,255,255,0.92)";
  ctx.strokeText(text, c.width / 2, c.height / 2);
  ctx.fillStyle = dark
    ? kind === "street"
      ? "#aeb7c4"
      : "#cdd4de"
    : kind === "street"
      ? "#566273"
      : "#3a4150";
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: c.width / c.height };
}

// Street + area names laid FLAT on the ground (just above the road), like a map.
function Labels({ dark }: { dark: boolean }) {
  const items = useMemo(
    () => CITY.labels.map((l) => ({ l, ...makeLabelTexture(l.text, l.kind, dark) })),
    [dark],
  );
  return (
    <group>
      {items.map(({ l, tex, aspect }, i) => {
        const hWorld = l.size * S * 1.15;
        return (
          <mesh
            key={i}
            position={[(l.x - HALF) * S, 0.32, (l.y - HALF) * S]}
            rotation={[-Math.PI / 2, 0, (l.rot * Math.PI) / 180]}
          >
            <planeGeometry args={[hWorld * aspect, hWorld]} />
            <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function City({
  mode,
  unifiedBuildings = false,
  cinematic = false,
}: {
  mode: Mode;
  unifiedBuildings?: boolean;
  cinematic?: boolean;
}) {
  const model = useMemo(() => buildCityModel(), []);
  const tex = useMemo(() => makeLogoTexture(), []);
  const winTex = useMemo(() => makeWindowTexture(), []);
  const wordTex = useMemo(() => makeWordmarkTexture(), []);
  const t = THEME[mode];
  const dark = mode === "dark";
  const post = dark ? "#3a4854" : "#b9bfc8";

  return (
    <group>
      {(Object.entries(model.groups) as [MatKey, THREE.BufferGeometry][]).map(
        ([key, geo]) => {
          const isBuilding = key.startsWith("building") || key === "landmark";
          // In unified mode the rooftop accent band (trim) folds into the single
          // building colour too, so buildings really are just one colour.
          const unifyBuild = unifiedBuildings && (isBuilding || key === "trim");
          const isAccent = !unifyBuild && (key === "lane" || key === "trim");
          const color = unifyBuild
            ? t.building
            : isAccent
              ? t.accent
              : t.mats[key];
          return (
            <mesh
              key={key}
              geometry={geo}
              castShadow={CASTERS.has(key)}
              receiveShadow={FLAT.has(key)}
            >
              <meshStandardMaterial
                color={color}
                map={isBuilding ? winTex : undefined}
                flatShading
                side={FLAT.has(key) ? THREE.DoubleSide : THREE.FrontSide}
                emissive={isAccent ? t.accent : "#000000"}
                emissiveIntensity={isAccent && dark ? 0.4 : 0}
                // every accent EXCEPT the driving logo is dialled down, so the
                // hovering logo is the only full-strength accent in the scene
                transparent={isAccent}
                opacity={isAccent ? ACCENT_DIM : 1}
              />
            </mesh>
          );
        },
      )}

      {model.billboards.map((b, i) => (
        <Billboard
          key={i}
          x={b.x}
          z={b.z}
          rotY={b.rotY}
          accent={t.accent}
          post={post}
          dark={dark}
          tex={tex}
          wordTex={wordTex}
          blink={i % 2 === 1} // every other billboard pulses blue↔yellow
        />
      ))}

      {/* street + area names, written flat on the ground like a map */}
      <Labels dark={dark} />

      {/* the ApexRide logo, self-driving over the streets like the mini-map marker.
          In cinematic mode the CinematicRig renders + drives the logo instead. */}
      {!cinematic && <RoadLogo accent={t.accent} dark={dark} tex={tex} />}
    </group>
  );
}

export default function CityScene({
  mode,
  cinematic = false,
  unifiedBuildings = false,
}: {
  mode: Mode;
  cinematic?: boolean;
  unifiedBuildings?: boolean;
}) {
  const t = THEME[mode];
  const isDark = mode === "dark";
  const route = useMemo(() => (cinematic ? buildRoute() : null), [cinematic]);
  const buildings = useMemo(
    () => (cinematic ? buildBuildingAnchors() : []),
    [cinematic],
  );
  const lights = useMemo(
    () => (cinematic && route ? buildStreetlights(route.pts) : []),
    [cinematic, route],
  );
  const useCine = cinematic && !!route;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      // Cinematic mode drives the camera + logo every frame, so keep the loop
      // running continuously (don't let it idle into "demand" and freeze).
      frameloop="always"
      camera={{
        position: cinematic ? [42, 30, 42] : [86, 56, 86],
        fov: cinematic ? 52 : 42,
        near: 0.5,
        far: 2000,
      }}
    >
      <color attach="background" args={[t.bg]} />
      <fog attach="fog" args={[t.bg, t.fog[0], t.fog[1]]} />

      <ambientLight intensity={isDark ? 0.9 : 0.95} />
      <directionalLight
        position={[70, 115, 50]}
        intensity={isDark ? 2.1 : 2.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={400}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-60, 45, -45]} intensity={isDark ? 0.6 : 0.6} />

      <Suspense fallback={null}>
        <City mode={mode} unifiedBuildings={unifiedBuildings} cinematic={useCine} />
      </Suspense>

      {useCine && route && (
        <>
          <Streetlights lights={lights} mode={mode} />
          <CinematicRig
            route={route}
            buildings={buildings}
            lights={lights}
            mode={mode}
          />
        </>
      )}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={!cinematic}
        minDistance={cinematic ? 3 : 26}
        maxDistance={cinematic ? 320 : 260}
        maxPolarAngle={1.5}
        target={cinematic ? undefined : [0, 2, 0]}
      />
    </Canvas>
  );
}
