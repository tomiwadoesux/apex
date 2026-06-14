"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/components/useReducedMotion";

const MODEL_URL = "/3d/benz-car.glb";

export type Mode = "light" | "dark";

const CAR_PAINT = "bodypaint.002";
const LOGO_MATERIALS = ["Logo_Circle_Black", "Logo_Triangle_Black"];
const TYRE_RE = /tire_shader/i; // material(s) for the rubber — never black
const WHEEL_RE = /tire_shader|monoblock/i; // tyre + rim meshes (for spinning)
// the red interior bits to recolor
const INTERIOR = [
  "ptn_leather_016_lcao.002",
  "plastic5_1.002",
  "plastic5_2.002",
  "plastic5_12.002",
  "plastic5_17.002",
];

const TYRE_COLOR = "#0a0a0a"; // tyres are always black, regardless of mode

// The brand accent, picked up on a few small EXTERIOR wheel details so the car
// gets a tasteful pop of colour — subtle, but visible. Light → brand yellow,
// dark → brand blue (the opposite of the page's text accent, so it pops against
// the car: yellow on the black car, blue on the white one).
const ACCENT: Record<Mode, string> = {
  light: "#FDBA16",
  dark: "#00209C",
};
// Coordinated wheel accents only (the big spoke faces & body panels stay black/
// white): the rim lip ring, the centre cap, the lug bolts, and the rear
// spare-wheel cover ring. Keeps it from looking like too much.
const ACCENT_PARTS = [
  "right_wheel_0.002", // rim lip / barrel ring (sits right at the tyre)
  "monoblock_m_silver.001", // wheel centre cap
  "monoblock_m_bolts", // lug bolts
  "right_wheel_1.002", // rear spare-wheel cover ring
];

const THEME: Record<
  Mode,
  { car: string; logo: string; bg: string; intA: string; intB: string }
> = {
  // light bg → black car + black logo; black-car interior stays warm amber
  light: { car: "#0c0c0e", logo: "#0c0c0e", bg: "#e9eaee", intA: "#caa24a", intB: "#caa24a" },
  // dark bg → white car + white logo; white-car interior is blue + dark blue
  dark: { car: "#e6e8ec", logo: "#ffffff", bg: "#0b0f14", intA: "#2a4fd0", intB: "#0a1742" },
};

class GLErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-red-300/80">
          Couldn’t display the 3D model: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function setColor(
  materials: Record<string, THREE.Material>,
  name: string,
  hex: string,
) {
  const m = materials[name] as THREE.MeshStandardMaterial | undefined;
  if (m) {
    m.color.set(hex);
    m.needsUpdate = true;
  }
}

// --- intro choreography, in seconds --------------------------------------
// The phases are explicitly TIMED (not all driven by one progress value), so
// each element moves on its own clock: the logo travels alone first, the car
// arrives later, and the camera swing is synced to the car's stop.
const T_RISE = 4.5; // [0,4.5] logo glides far + camera rises; car not on screen yet
const CAR_START = 2.2; // car enters from the bottom (off-frame) while logo is still gliding
const CAR_END = 6.5; // car reaches the logo and brakes
const SWING_START = 4.8; // camera begins swinging to the side faster
const SWING_END = 8.0; // camera settles on the side
const WHEEL = 1.6; // wheel roll speed (rad/s) - runs constantly
const SPIN = 0.08; // turntable speed once parked (rad/s) — slower for buttery look
const SPIN_RAMP = 2.5; // turntable eases in over this many seconds

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3); // decelerate → "brake"

// --- scroll tour ----------------------------------------------------------
// Six camera poses, one per service section. Each pose is CYLINDRICAL around
// the car's centre — angle `a` is measured from the car's nose (+z), so poses
// live in the CAR'S OWN FRAME: whatever angle the turntable stopped at, the
// shot frames the same part of the car. Interpolating angle/radius/height
// makes the camera sweep AROUND the car (crane move), never through it.
interface TourPose {
  a: number; // angle around the car, 0 = dead ahead of the nose
  r: number; // distance from the car centre
  h: number; // camera height (world units)
  look: THREE.Vector3; // look target in the car frame
}
// fraction of each section's scroll spent travelling between poses — the rest
// is the dwell, so leaving a service takes noticeably more scroll than arriving
const TOUR_TRANS = 0.42;

function Car({
  mode,
  fit = 1.5,
  onLoaded,
  tourProgress,
  reduced = false,
}: {
  mode: Mode;
  fit?: number;
  onLoaded?: () => void;
  /** scroll progress through the services tour, 0..1 (mutable ref, no re-renders) */
  tourProgress?: { current: number };
  /** prefers-reduced-motion: skip the auto intro / orbit / spin / wheel roll */
  reduced?: boolean;
}) {
  const gltf = useGLTF(MODEL_URL);
  // clone so our mutations (recenter / wheel re-parenting) never corrupt the
  // useGLTF cache on remount; materials stay shared so recolouring still works.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const materials = gltf.materials as Record<string, THREE.Material>;

  const { camera, size } = useThree();
  // mirror the prop into a ref so the imperative frame loop always reads the latest
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const carGroup = useRef<THREE.Group>(null);
  const staticRef = useRef<THREE.Group>(null); // holds the logo so it never spins
  const pivots = useRef<THREE.Group[]>([]);
  const didSetup = useRef(false);
  // Cinematic intro in distinct TIMED phases (each element on its own clock):
  //   [0,3]  the floor logo glides far forward while the camera rises HIGH + FAST
  //          (the car is still off-screen) — they never move together.
  //   3s→    the car drives in from the bottom of the frame to meet the now-parked
  //          logo, braking as it arrives.
  //   ~5.7s  as the car gets close, the camera starts swinging to the side, timed
  //          to almost reach the final side view exactly as the car stops.
  //   6.4s   the instant the car arrives it begins a slow turntable spin.
  const rig = useRef<{
    camRise: THREE.CatmullRomCurve3; // open-on-logo → high/far behind
    camSwing: THREE.CatmullRomCurve3; // high/far → side profile
    gazeStart: THREE.Vector3; // look target while the logo sits at its start
    gazeR: THREE.Vector3; // look target at the rendezvous (floor)
    carLook: THREE.Vector3; // side-view look target (car centre at rendezvous)
    R: number; // rendezvous Z (where the logo travels to and the car meets it)
    carStartZ: number; // car's off-frame start Z
    dist: number;
    wc: THREE.Vector3;
    wsizeY: number;
    poses: TourPose[]; // scroll-tour camera poses, in the car's frame
  } | null>(null);
  const introStart = useRef<number | null>(null);
  const spinStart = useRef<number | null>(null);
  const freezeT = useRef<number | null>(null); // debug: /#t=4.5 freezes the intro at 4.5s
  const smoothTourP = useRef(0); // eased copy of tourProgress — the camera "catches up"

  const targetCarColor = useRef(new THREE.Color(THEME[mode].car));
  const targetLogoColor = useRef(new THREE.Color(THEME[mode].logo));
  const targetIntAColor = useRef(new THREE.Color(THEME[mode].intA));
  const targetIntBColor = useRef(new THREE.Color(THEME[mode].intB));
  const targetAccentColor = useRef(new THREE.Color(ACCENT[mode]));

  // one-time: recenter + scale, frame a fixed side-view camera, build wheel pivots
  useEffect(() => {
    if (didSetup.current) return;
    const group = carGroup.current;
    if (!group) return;
    didSetup.current = true;

    // Manually add scene to group so matrix conversions and parent-child transforms work immediately
    group.add(scene);

    scene.updateMatrixWorld(true);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const sceneSize = box.getSize(new THREE.Vector3());
    // centre on x/z, drop bottom to y = 0 (sits on the ground)
    scene.position.x -= center.x;
    scene.position.z -= center.z;
    scene.position.y -= box.min.y;
    const TARGET = 4.2;
    group.scale.setScalar(TARGET / Math.max(sceneSize.x, sceneSize.y, sceneSize.z));
    group.updateMatrixWorld(true);

    // fixed side-view camera, framed tightly to the car's profile (no orbit/zoom)
    const wb = new THREE.Box3().setFromObject(group);
    const wc = wb.getCenter(new THREE.Vector3());
    const wsize = wb.getSize(new THREE.Vector3());
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 30;
    const aspect = size.width / Math.max(1, size.height);
    const halfV = Math.tan((cam.fov / 2) * (Math.PI / 180));
    // looking along X: length (Z) fills width, height (Y) fills the frame height
    const distH = wsize.z / 2 / (halfV * aspect);
    const distV = wsize.y / 2 / halfV;
    const dist = Math.max(distH, distV) * fit; // higher fit = camera further back, car smaller
    cam.near = dist * 0.05;
    cam.far = dist * 12;
    cam.updateProjectionMatrix();

    // --- cinematic intro rig (rear = -Z, so the camera comes from BEHIND) ---
    // Two camera curves on separate clocks: a RISE (open-on-logo → high & far
    // behind) played over [0,T_RISE], then a SWING (high → side profile) played
    // over [SWING_START, SWING_END]. The high point is shared by both so the
    // hand-off is seamless. The car and logo travel on their own time-based
    // ramps (see useFrame) — never tied to the camera's progress.
    const span = wsize.z; // car length (the drive axis)
    const logoY = 0.04;
    const R = span * 0.85; // rendezvous: the logo glides this far forward; the car meets it here
    const carStartZ = wc.z - dist * 1.25; // car begins off-frame at the bottom

    const lineP = new THREE.Vector3(wc.x, logoY + 0.02, wc.z - dist * 0.5); // skim the floor → logo reads as a line
    const highPoint = new THREE.Vector3(wc.x, wc.y + wsize.y * 3.6, wc.z - dist * 2.15); // HIGH + FAR behind (higher than before)
    const camRise = new THREE.CatmullRomCurve3(
      [lineP, new THREE.Vector3(wc.x, wc.y * 1.6, wc.z - dist * 1.2), highPoint],
      false,
      "centripetal",
    );

    const sidePos = new THREE.Vector3(dist, wc.y + wsize.y * 0.12, wc.z + R); // true side view, level with the rendezvous
    const camSwing = new THREE.CatmullRomCurve3(
      [highPoint, new THREE.Vector3(dist * 0.98, wc.y + wsize.y * 0.95, wc.z - dist * 0.3), sidePos],
      false,
      "centripetal",
    );

    const gazeStart = new THREE.Vector3(wc.x, logoY, wc.z); // logo at its start (origin)
    const gazeR = new THREE.Vector3(wc.x, logoY, wc.z + R); // rendezvous on the floor
    const carLook = new THREE.Vector3(wc.x, wc.y, wc.z + R); // car centre at the rendezvous (side aim)

    // --- scroll-tour poses (car frame: a = angle from the nose, +x side) ----
    // A continuous crane AROUND the car that lingers on its coolest details,
    // front → side → rear → up. Wheel shots (1 & 3) get their look re-aimed at
    // the real spinning rims below.
    //   0 face        — front ¾, low & aggressive: round headlamps + grille star
    //   1 front wheel — tight on the front rim/arch (visibly spinning)
    //   2 profile     — the iconic boxy side: door, hinges, mirror
    //   3 rear wheel  — low & tight on the rear haunch + rim
    //   4 rear ¾      — tailgate spare wheel + vertical taillights
    //   5 crane       — high top-down beauty drift over the boxy roof
    const L = wsize.z;
    const Hc = wsize.y;
    const poses: TourPose[] = [
      { a: Math.PI * 0.20, r: L * 0.98, h: Hc * 0.16, look: new THREE.Vector3(0, Hc * 0.34, L * 0.30) },
      { a: Math.PI * 0.33, r: L * 0.56, h: Hc * 0.22, look: new THREE.Vector3(wsize.x * 0.3, Hc * 0.18, L * 0.34) },
      { a: Math.PI * 0.50, r: L * 1.14, h: Hc * 0.30, look: new THREE.Vector3(0, Hc * 0.34, 0) },
      { a: Math.PI * 0.66, r: L * 0.56, h: Hc * 0.13, look: new THREE.Vector3(wsize.x * 0.3, Hc * 0.16, -L * 0.34) },
      { a: Math.PI * 0.84, r: L * 0.98, h: Hc * 0.40, look: new THREE.Vector3(0, Hc * 0.44, -L * 0.34) },
      { a: Math.PI * 0.80, r: L * 0.82, h: L * 1.28, look: new THREE.Vector3(0, Hc * 0.34, -L * 0.06) },
    ];

    rig.current = {
      camRise,
      camSwing,
      gazeStart,
      gazeR,
      carLook,
      R,
      carStartZ,
      dist,
      wc,
      wsizeY: wsize.y,
      poses,
    };
    // open on the logo line: camera skimming the floor, looking at the floor logo
    cam.up.set(0, 1, 0);
    cam.position.copy(lineP);
    cam.lookAt(gazeStart.x, gazeStart.y, gazeStart.z);

    // build 4 wheel pivots (road wheels only — skip the high-mounted spare)
    const minY = wb.min.y;
    const carH = wb.max.y - wb.min.y;
    const wheels: { mesh: THREE.Mesh; c: THREE.Vector3 }[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const nm = (mesh.material as THREE.Material | undefined)?.name ?? "";
      if (!WHEEL_RE.test(nm)) return;
      const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      if (c.y > minY + carH * 0.42) return; // exclude the spare wheel
      wheels.push({ mesh, c });
    });
    const buckets: Record<string, { mesh: THREE.Mesh; c: THREE.Vector3 }[]> = {};
    for (const w of wheels) {
      const key = (w.c.x < wc.x ? "L" : "R") + (w.c.z < wc.z ? "F" : "B");
      (buckets[key] ??= []).push(w);
    }
    const ps: THREE.Group[] = [];
    for (const key in buckets) {
      const ws = buckets[key];
      const gb = new THREE.Box3();
      ws.forEach((w) => gb.expandByObject(w.mesh));
      const ctr = gb.getCenter(new THREE.Vector3());
      const pivot = new THREE.Group();
      pivot.position.copy(group.worldToLocal(ctr.clone()));
      group.add(pivot);
      ws.forEach((w) => pivot.attach(w.mesh)); // keep world transform, change pivot
      ps.push(pivot);
    }
    pivots.current = ps;

    // aim the two wheel poses at the real rims on the +x side (front = nose-most,
    // rear = tail-most), in the same car frame as the other pose looks
    let fw: THREE.Vector3 | null = null; // front +x wheel
    let rw: THREE.Vector3 | null = null; // rear  +x wheel
    for (const p of ps) {
      const w = p.position.clone().multiplyScalar(group.scale.x); // → world units
      if (w.x <= 0) continue;
      if (!fw || w.z > fw.z) fw = w;
      if (!rw || w.z < rw.z) rw = w;
    }
    if (fw) poses[1].look.set(fw.x - wc.x, fw.y + wsize.y * 0.05, fw.z - wc.z);
    if (rw) poses[3].look.set(rw.x - wc.x, rw.y + wsize.y * 0.05, rw.z - wc.z);

    // keep the floor logo static — it must NOT rotate with the car
    const stat = staticRef.current;
    if (stat) {
      let floorLogo: THREE.Object3D | null = null;
      scene.traverse((o) => {
        if (o.name === "logo_floor") {
          floorLogo = o;
        }
      });
      if (floorLogo) {
        stat.attach(floorLogo);
      } else {
        // Fallback: search for nodes containing "logo_floor" or with logo material name
        const logoMeshes: THREE.Object3D[] = [];
        scene.traverse((o) => {
          if (
            o.name.toLowerCase().includes("logo_floor") ||
            ((o as THREE.Mesh).isMesh && /logo/i.test(((o as THREE.Mesh).material as THREE.Material | undefined)?.name ?? ""))
          ) {
            logoMeshes.push(o);
          }
        });
        logoMeshes.forEach((m) => stat.attach(m));
      }
      stat.scale.setScalar(0.95); // make the floor logo larger (95% of original size)
    }

    // hide the car until it drives in — the opening frame is just the logo line
    group.visible = false;
    group.position.z = carStartZ;

    if (onLoaded) {
      onLoaded();
    }
  }, [scene, camera, size, fit, onLoaded]);

  // One-time initialization of tyre color
  useEffect(() => {
    for (const key in materials) {
      if (TYRE_RE.test(key)) setColor(materials, key, TYRE_COLOR);
    }
  }, [materials]);

  // Set target colors when theme mode changes
  useEffect(() => {
    const t = THEME[mode];
    targetCarColor.current.set(t.car);
    targetLogoColor.current.set(t.logo);
    targetIntAColor.current.set(t.intA);
    targetIntBColor.current.set(t.intB);
    targetAccentColor.current.set(ACCENT[mode]);
  }, [mode]);

  // debug only: /car#t=4.5 pins the intro to 4.5s so a frame can be inspected
  useEffect(() => {
    const s = typeof window !== "undefined" ? window.location.hash + window.location.search : "";
    const m = /[#&?]t=([\d.]+)/.exec(s);
    freezeT.current = m ? parseFloat(m[1]) : null;
  }, []);

  // Each element is its own explicit function of TIME (not one shared progress),
  // so the phases are independent: logo first, car second, camera swing synced to
  // the car's stop, then a slow spin. Everything is a continuous function of t, so
  // there are no holds that stutter and no hand-off branch.
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmps = useMemo(
    () => ({
      idlePos: new THREE.Vector3(),
      tourPos: new THREE.Vector3(),
      tourLook: new THREE.Vector3(),
      lookLocal: new THREE.Vector3(),
      finalLook: new THREE.Vector3(),
    }),
    [],
  );
  useFrame((state, dt) => {
    const g = carGroup.current;
    const stat = staticRef.current;
    const data = rig.current;
    if (!g || !data) return;
    const cam = camera as THREE.PerspectiveCamera;
    const c01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    // smootherstep: zero 1st derivative at both ends → no velocity jump
    const sm = (x: number) => {
      x = c01(x);
      return x * x * x * (x * (x * 6 - 15) + 10);
    };

    if (introStart.current === null) introStart.current = state.clock.elapsedTime;
    const now = state.clock.elapsedTime;
    // reduced motion: jump past the whole timed intro to the parked state, so
    // there's no auto-play choreography — only the scroll-driven tour moves.
    const reduced = reducedRef.current;
    const t = reduced
      ? 1e6
      : freezeT.current != null
        ? freezeT.current
        : now - introStart.current;

    // 1) the logo glides far forward over [0, T_RISE], then holds at the rendezvous
    const logoP = sm(c01(t / T_RISE));
    if (stat) stat.position.z = data.R * logoP;

    // 2) the car drives in from off-frame after T_RISE, braking (ease-out) at the logo
    const carIn = c01((t - CAR_START) / (CAR_END - CAR_START));
    g.visible = t >= CAR_START;
    g.position.z = data.carStartZ + (data.R - data.carStartZ) * easeOutCubic(carIn);

    // 3) camera: rise (open→high) over [0,T_RISE] and hold, then swing (high→side)
    //    over [SWING_START, SWING_END]. The shared high point keeps it seamless.
    //    Beyond SWING_END, it transitions directly into a slow continuous orbit so it
    //    never stops. This idle path is ALWAYS computed — the scroll tour blends on
    //    top of it, so leaving the tour returns to the live animation, not a reset.
    cam.up.set(0, 1, 0);
    const idlePos = tmps.idlePos;
    if (t < SWING_START) {
      idlePos.copy(data.camRise.getPoint(sm(c01(t / T_RISE))));
    } else if (t < SWING_END) {
      idlePos.copy(
        data.camSwing.getPoint(sm(c01((t - SWING_START) / (SWING_END - SWING_START)))),
      );
    } else {
      // Slow continuous camera orbit around the car's rendezvous center
      // (frozen at the side view under reduced motion)
      const driftAngle = reduced ? 0 : (t - SWING_END) * 0.05; // 0.05 rad/s
      idlePos.set(
        data.wc.x + data.dist * Math.cos(driftAngle),
        data.wc.y + data.wsizeY * 0.12,
        data.wc.z + data.R + data.dist * Math.sin(driftAngle),
      );
    }

    // look: follow the gliding logo, hold at the rendezvous, then ease onto the
    // car's profile as the camera swings to the side.
    let look: THREE.Vector3;
    if (t < T_RISE) look = tmp.lerpVectors(data.gazeStart, data.gazeR, sm(c01(t / T_RISE)));
    else if (t < SWING_START) look = data.gazeR;
    else {
      const swingProgress = sm(c01((t - SWING_START) / (SWING_END - SWING_START)));
      look = tmp.lerpVectors(data.gazeR, data.carLook, swingProgress);
    }

    // --- scroll tour: ease toward the page's scroll progress, then derive the
    // camera from it. Poses are in the car's frame (offset by its CURRENT yaw),
    // so the tour picks up from wherever the turntable stopped — no reset.
    const targetP = tourProgress?.current ?? 0;
    smoothTourP.current += (targetP - smoothTourP.current) * (1 - Math.exp(-4.5 * dt));
    if (targetP === 0 && smoothTourP.current < 0.0005) smoothTourP.current = 0;
    const p = smoothTourP.current;
    let w = 0; // tour blend weight: 0 = idle animation, 1 = tour camera
    if (p > 0 && data.poses.length === 6) {
      const s = p * 6; // section-space progress, one unit per service
      w = sm(Math.min(1, s / 0.5));
      const si = Math.min(5, Math.floor(s));
      const st = s - si;
      // within a section: travel from the previous pose during the first
      // TOUR_TRANS of the scroll, then DWELL on the framing for the rest —
      // leaving a service takes more scroll than arriving.
      const vt = si === 0 ? 0 : si - 1 + sm(Math.min(1, st / TOUR_TRANS));
      const i0 = Math.min(5, Math.floor(vt));
      const i1 = Math.min(5, i0 + 1);
      const f = vt - i0;
      const A = data.poses[i0];
      const B = data.poses[i1];
      // sweep around the car (cylindrical lerp, shortest arc) — never through it
      let da = B.a - A.a;
      da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const th = g.rotation.y;
      const ang = A.a + da * f + th;
      // responsive framing: a narrow (portrait / mobile) canvas pulls the camera
      // back so the same part stays fully in frame; wide canvases stay as authored
      const aspect = state.size.width / Math.max(1, state.size.height);
      const radScale = Math.min(2.5, Math.max(1, 1.85 / aspect));
      const rad = (A.r + (B.r - A.r) * f) * radScale;
      const cx = data.wc.x;
      const cz = data.wc.z + g.position.z;
      tmps.tourPos.set(
        cx + Math.sin(ang) * rad,
        A.h + (B.h - A.h) * f,
        cz + Math.cos(ang) * rad,
      );
      const ll = tmps.lookLocal.lerpVectors(A.look, B.look, f);
      tmps.tourLook.set(
        cx + ll.x * Math.cos(th) + ll.z * Math.sin(th),
        ll.y,
        cz + ll.z * Math.cos(th) - ll.x * Math.sin(th),
      );
    }

    if (w > 0) {
      cam.position.lerpVectors(idlePos, tmps.tourPos, w);
      const fl = tmps.finalLook.lerpVectors(look, tmps.tourLook, w);
      cam.lookAt(fl.x, fl.y, fl.z);
    } else {
      cam.position.copy(idlePos);
      cam.lookAt(look.x, look.y, look.z);
    }

    // wheels roll constantly whenever the car is visible (still under reduced motion)
    if (g.visible && !reduced) {
      for (const p of pivots.current) {
        p.rotation.x += WHEEL * dt;
      }
    }

    // 4) turntable spin starts easing in 1.5s before the car fully stops, so they
    //    transition smoothly. The tour weight gates it: scrolling freezes the spin
    //    where it is, and scrolling back up resumes it from that exact angle.
    const spinT = CAR_END - 1.5;
    if (t >= spinT && spinStart.current === null) {
      spinStart.current = now;
    }
    const spinVel =
      spinStart.current === null ? 0 : SPIN * sm((now - spinStart.current) / SPIN_RAMP);
    g.rotation.y += spinVel * dt * (1 - w) * (reduced ? 0 : 1);

    // 5) Lerp colors for a smooth theme transition (clamped so a long frame
    //    can't overshoot the target)
    const lerpSpeed = Math.min(1, 5 * dt);
    const carMat = materials[CAR_PAINT] as THREE.MeshStandardMaterial | undefined;
    if (carMat) {
      carMat.color.lerp(targetCarColor.current, lerpSpeed);
      carMat.needsUpdate = true;
    }
    for (const n of LOGO_MATERIALS) {
      const logoMat = materials[n] as THREE.MeshStandardMaterial | undefined;
      if (logoMat) {
        logoMat.color.lerp(targetLogoColor.current, lerpSpeed);
        logoMat.needsUpdate = true;
      }
    }
    INTERIOR.forEach((n, i) => {
      const intMat = materials[n] as THREE.MeshStandardMaterial | undefined;
      if (intMat) {
        const target = i % 2 === 0 ? targetIntAColor.current : targetIntBColor.current;
        intMat.color.lerp(target, lerpSpeed);
        intMat.needsUpdate = true;
      }
    });
    // brand accent on the small exterior wheel details
    for (const n of ACCENT_PARTS) {
      const accMat = materials[n] as THREE.MeshStandardMaterial | undefined;
      if (accMat) {
        accMat.color.lerp(targetAccentColor.current, lerpSpeed);
        accMat.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <group ref={carGroup}>
        <primitive object={scene} />
      </group>
      {/* static — the logo is re-parented here so it stays put while the car spins */}
      <group ref={staticRef} />
    </>
  );
}

function StageLights({ mode }: { mode: Mode }) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);

  const targetAmbient = mode === "light" ? 0.7 : 0.35;
  const targetDir = mode === "light" ? 1.6 : 1.1;

  useFrame((state, dt) => {
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        targetAmbient,
        5 * dt
      );
    }
    if (dirRef.current) {
      dirRef.current.intensity = THREE.MathUtils.lerp(
        dirRef.current.intensity,
        targetDir,
        5 * dt
      );
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={mode === "light" ? 0.7 : 0.35} />
      <directionalLight
        ref={dirRef}
        position={[6, 9, 4]}
        intensity={mode === "light" ? 1.6 : 1.1}
      />
    </>
  );
}

export default function CarStage({
  mode,
  bg,
  fit,
  transparent = false,
  onLoaded,
  tourProgress,
}: {
  mode: Mode;
  bg?: string;
  fit?: number;
  /** Render the canvas transparent so the page background shows through. */
  transparent?: boolean;
  onLoaded?: () => void;
  /** scroll progress through the services tour, 0..1 (mutable ref, no re-renders) */
  tourProgress?: { current: number };
}) {
  const reduced = useReducedMotion();
  return (
    <GLErrorBoundary>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 30, position: [8, 1.6, 1] }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      >
        {!transparent && (
          <color attach="background" args={[bg ?? THEME[mode].bg]} />
        )}
        <Suspense fallback={null}>
          <StageLights mode={mode} />
          <Car
            mode={mode}
            fit={fit}
            onLoaded={onLoaded}
            tourProgress={tourProgress}
            reduced={reduced}
          />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </GLErrorBoundary>
  );
}

useGLTF.preload(MODEL_URL);
