"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";

export type Mode = "light" | "dark";

const MODEL_URL = "/3d/low-poly-city.glb";

// Only buildings + trees cast shadows. The flat, near-coplanar pieces (ground,
// roads, lane lines, route) only RECEIVE — casting from them just produces
// shadow acne where they sit a few centimetres apart.
const CAST = ["Buildings", "Trees"];

type Palette = Record<string, string>;

// The material NAMES are the contract baked into the GLB (see the Blender
// export). Each mode just supplies a colour per name — same approach as the
// car configurator's THEME map.
const THEME: Record<
  Mode,
  { bg: string; routeEmissive: number; mats: Palette }
> = {
  // Daytime: white-grey towers, light roads, bright parks, glossy blue route.
  light: {
    bg: "#eef1f5",
    routeEmissive: 0.12,
    mats: {
      Ground: "#d9dde3",
      Grass: "#c0e3b3",
      Road: "#c4c9d2",
      RoadLine: "#ffffff",
      Building_A: "#e9ebef",
      Building_B: "#dee2e9",
      Building_C: "#f4f5f8",
      TreeFoliage: "#6fc173",
      TreeTrunk: "#aab4bf",
      Route: "#2b6bff",
    },
  },
  // Dusk: dark teal-slate towers, muted roads, deep green parks, glowing cyan route.
  dark: {
    bg: "#0f1822",
    routeEmissive: 0.85,
    mats: {
      Ground: "#18222c",
      Grass: "#1f4a3e",
      Road: "#36424f",
      RoadLine: "#5d6f7e",
      Building_A: "#2c3a48",
      Building_B: "#34434f",
      Building_C: "#3e4e5d",
      TreeFoliage: "#2f6f63",
      TreeTrunk: "#2a3742",
      Route: "#38e1ff",
    },
  },
};

useGLTF.preload(MODEL_URL);

function City({ mode }: { mode: Mode }) {
  const gltf = useGLTF(MODEL_URL);
  // Clone the scene so remounts/HMR never corrupt the cached graph; materials
  // stay shared by reference, so recolouring the `materials` record still works.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const materials = gltf.materials as Record<string, THREE.Material>;

  // One-time: shadow flags + crisp faceted (low-poly) shading.
  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = CAST.some((n) => m.name.includes(n));
      m.receiveShadow = true;
    });
    for (const mm of Object.values(materials)) {
      const sm = mm as THREE.MeshStandardMaterial;
      sm.flatShading = true;
      sm.needsUpdate = true;
    }
  }, [scene, materials]);

  // Recolour whenever the mode flips.
  useEffect(() => {
    const t = THEME[mode];
    for (const [name, hex] of Object.entries(t.mats)) {
      const m = materials[name] as THREE.MeshStandardMaterial | undefined;
      if (!m) continue;
      m.color.set(hex);
      if (name === "Route") {
        m.emissive.set(hex);
        m.emissiveIntensity = t.routeEmissive;
      }
      m.needsUpdate = true;
    }
  }, [mode, materials]);

  return <primitive object={scene} />;
}

export default function CityScene({ mode }: { mode: Mode }) {
  const t = THEME[mode];
  const isDark = mode === "dark";
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [74, 42, 74], fov: 42, near: 0.5, far: 2000 }}
    >
      <color attach="background" args={[t.bg]} />
      <fog attach="fog" args={[t.bg, 190, 520]} />

      {/* Even low-poly lighting: soft ambient + a key sun that casts shadows,
          plus a dim opposite fill so shaded faces never go fully flat. */}
      <ambientLight intensity={isDark ? 0.55 : 0.95} />
      <directionalLight
        position={[70, 115, 50]}
        intensity={isDark ? 1.5 : 2.4}
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
      <directionalLight position={[-60, 45, -45]} intensity={isDark ? 0.4 : 0.6} />

      <Suspense fallback={null}>
        <City mode={mode} />
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={26}
        maxDistance={240}
        maxPolarAngle={1.45}
        target={[0, 1.5, 0]}
      />
    </Canvas>
  );
}
