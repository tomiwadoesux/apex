"use client";

// A 3D render of the Apex brand mark (the navigation delta + dot), extruded.
// It replaces the flat <Logo> glyph in the top-left lockup: same size, same
// brand colour, dead still by default. When `trigger` changes (the "Contact"
// button is clicked) it plays a single smooth 3D tumble — rotate + a little
// lift/pop toward the viewer — then settles exactly back to rest.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";
import Logo from "@/components/Logo";
import { useReducedMotion } from "@/components/useReducedMotion";

const LOGO_URL = "/3d/logo.gltf";

export type Mode = "light" | "dark";

// brand mark colour per page mode — matches the rest of the lockup
const COLOR: Record<Mode, string> = {
  light: "#00209C",
  dark: "#FDBA16",
};

const DURATION = 1.15; // contact tumble length, seconds

// zero 1st-derivative at both ends → no velocity jump in or out
const smootherstep = (x: number) => {
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function LogoModel({
  mode,
  trigger,
  reduced,
}: {
  mode: Mode;
  trigger: number;
  reduced: boolean;
}) {
  const gltf = useGLTF(LOGO_URL);
  // clone so our scale/material edits never corrupt the useGLTF cache on remount
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  // on-demand rendering: we only draw while something is actually moving, then
  // stop — a static logo shouldn't burn 60fps. invalidate() asks for a frame.
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const target = useRef(new THREE.Color(COLOR[mode]));

  const didSetup = useRef(false);
  const animStart = useRef<number | null>(null);
  const pending = useRef(false);
  const prevTrigger = useRef(trigger);

  // one-time: normalise to unit height (the Illustrator export is ~0.06 units
  // and already centred on the origin) and give each mesh its own brand-coloured
  // material so recolouring one logo never bleeds into the cached gltf.
  useEffect(() => {
    if (didSetup.current) return;
    didSetup.current = true;

    scene.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    // normalise to unit height
    scene.scale.setScalar(1 / size.y);
    // The Illustrator export is a near-flat sheet (depth ≈ 9% of width), so
    // edge-on it reads as a thin line. Override the Z scale to give the
    // extrusion real, chunky depth — a proper solid that shows its side walls
    // as it turns. TARGET_DEPTH is depth as a fraction of the (unit) height.
    const TARGET_DEPTH = 0.34;
    scene.scale.z = TARGET_DEPTH / size.z;

    const collected: THREE.MeshStandardMaterial[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = new THREE.MeshStandardMaterial({
        color: COLOR[mode].toString(),
        metalness: 0.15,
        roughness: 0.5,
      });
      mesh.material = m;
      collected.push(m);
    });
    mats.current = collected;
    invalidate(); // draw the set-up model once
  }, [scene, mode, invalidate]);

  // retarget colour on mode change (lerped in useFrame) and wake the loop
  useEffect(() => {
    target.current.set(COLOR[mode]);
    invalidate();
  }, [mode, invalidate]);

  // a new trigger value queues one tumble (skipped under reduced motion); the
  // first frame after consumes it so we can read the render clock.
  useEffect(() => {
    if (trigger !== prevTrigger.current) {
      prevTrigger.current = trigger;
      if (!reduced) {
        pending.current = true;
        invalidate();
      }
    }
  }, [trigger, reduced, invalidate]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    // smooth colour follow so the mode toggle recolours the mark too; snap when
    // close enough so it doesn't lerp forever (and keep the loop awake until then)
    let colourSettled = true;
    for (const m of mats.current) {
      m.color.lerp(target.current, 0.12);
      const d =
        Math.abs(m.color.r - target.current.r) +
        Math.abs(m.color.g - target.current.g) +
        Math.abs(m.color.b - target.current.b);
      if (d < 0.004) m.color.copy(target.current);
      else colourSettled = false;
    }

    if (pending.current) {
      pending.current = false;
      animStart.current = state.clock.elapsedTime;
    }

    if (animStart.current !== null) {
      const t = (state.clock.elapsedTime - animStart.current) / DURATION;
      if (t >= 1) {
        animStart.current = null;
        g.rotation.set(0, 0, 0);
        g.position.set(0, 0, 0);
      } else {
        const spin = smootherstep(t); // 0→1 over the whole tumble
        const arc = Math.sin(t * Math.PI); // 0→1→0, out-and-back for the lift/tilt
        g.rotation.y = spin * Math.PI * 2; // one full turn about the vertical
        g.rotation.x = arc * 0.45; // tip forward and recover
        g.position.y = arc * 0.1; // small lift
        g.position.z = arc * 0.28; // pop toward the viewer and back
      }
    } else {
      g.rotation.set(0, 0, 0);
      g.position.set(0, 0, 0);
    }

    // keep drawing only while there's motion or colour still in flight
    if (!colourSettled || animStart.current !== null) invalidate();
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

// if the 3D mark fails to load for any reason, fall back to the flat SVG glyph
// so the lockup never goes blank.
class LogoBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Logo3D({
  mode,
  trigger,
  size = 34,
}: {
  mode: Mode;
  trigger: number;
  /** Rendered box in px — the glyph is framed to read ~28px tall, like <Logo size={28} />. */
  size?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <LogoBoundary
      fallback={<Logo size={28} color={COLOR[mode]} />}
    >
      <div style={{ width: size, height: size }} className="pointer-events-none">
        <Canvas
          dpr={[1, 2]}
          frameloop="demand"
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 30, position: [0, 0, 2.35] }}
        >
          {/* ambient keeps the front face close to the true brand colour at rest;
              the side-lit key + soft fill shade the extruded walls as it turns so
              the depth reads as a solid 3D form (not a flat card). */}
          <ambientLight intensity={0.72} />
          <directionalLight position={[3, 2, 1.5]} intensity={0.85} />
          <directionalLight position={[-2.5, -1, 1]} intensity={0.28} />
          <Suspense fallback={null}>
            <LogoModel mode={mode} trigger={trigger} reduced={reduced} />
          </Suspense>
        </Canvas>
      </div>
    </LogoBoundary>
  );
}

useGLTF.preload(LOGO_URL);
