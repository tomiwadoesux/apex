"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
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
  { bg: string; fog: [number, number]; accent: string; mats: Pal }
> = {
  light: {
    bg: "#e9edf2",
    fog: [210, 540],
    accent: "#00209C",
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

function City({ mode }: { mode: Mode }) {
  const model = useMemo(() => buildCityModel(), []);
  const tex = useMemo(makeLogoTexture, []);
  const winTex = useMemo(makeWindowTexture, []);
  const wordTex = useMemo(makeWordmarkTexture, []);
  const t = THEME[mode];
  const dark = mode === "dark";
  const post = dark ? "#3a4854" : "#b9bfc8";

  return (
    <group>
      {(Object.entries(model.groups) as [MatKey, THREE.BufferGeometry][]).map(
        ([key, geo]) => {
          const isAccent = key === "lane" || key === "trim";
          const isBuilding = key.startsWith("building") || key === "landmark";
          const color = isAccent ? t.accent : t.mats[key];
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

      {/* the ApexRide logo, self-driving over the streets like the mini-map marker */}
      <RoadLogo accent={t.accent} dark={dark} tex={tex} />
    </group>
  );
}

export default function CityScene({ mode }: { mode: Mode }) {
  const t = THEME[mode];
  const isDark = mode === "dark";
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [86, 56, 86], fov: 42, near: 0.5, far: 2000 }}
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
        <City mode={mode} />
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={26}
        maxDistance={260}
        maxPolarAngle={1.45}
        target={[0, 2, 0]}
      />
    </Canvas>
  );
}
