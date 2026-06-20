"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Fisheye, Grid, useGLTF } from "@react-three/drei";
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/components/useReducedMotion";
import { cameraTuning } from "@/components/car/cameraTuning";
import { LOGO_PATHS, LOGO_VIEWBOX, LOGO_W, LOGO_H } from "@/components/Logo";

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
// Wheel accent = the INNER assembly only, never the outer rim. The accent lives
// on the brake + hub + suspension cluster sitting inside the wheel (the parts
// seen through the spokes — discs, caliper and the coil spring) so the
// monoblock rim itself reads natural and the colour pops from within.
// (BRABUS badge stays accent.)
const ACCENT_PARTS = [
  "right_wheel.002", // brake caliper (inside the wheel, behind the spokes)
  "right_wheel_0.002", // inner brake/hub + suspension spring cluster
  "right_wheel_1.002", // brake disc / hub face
  "monoblock_m_chrome", // the "B" emblem on the wheel centre cap
  "tgn_brabus_g900_2020_102__0.002", // the rear "BRABUS" lettering/badge
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
const SERVICE_DWELL = 0.65;
// On the LANDING tour the wheels are STILL over the hero/Airport, then ramp up to
// full roll once the camera reaches the WEDDING section and keep rolling for the
// rest of the tour. Wedding is band 1 of the 7-band tour (6 services + footer):
// reached at p ≈ 1/7 (0.143), held through ≈ 2/7 (0.286).
const WHEEL_ROLL_START = 0.15; // ≈ 1/7 — Wedding section reached
const WHEEL_ROLL_FULL = 0.25; // full roll while still on Wedding
const SPIN = 0.08; // turntable speed once parked (rad/s) — slower for buttery look
const SPIN_RAMP = 2.5; // turntable eases in over this many seconds

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3); // decelerate → "brake"

// --- scroll tour ----------------------------------------------------------
// The scroll camera poses live in `cameraTuning` (normalised values, edited live
// by the CameraTuner panel). Each pose is CYLINDRICAL around the car's centre —
// angle `a` is from the nose (+z), measured in the CAR'S OWN FRAME — so the frame
// loop converts them to world coords each frame and sweeps AROUND the car.

const BASE_FOV = 30; // resting lens before the tour widens it

function Car({
  mode,
  fit = 1.5,
  onLoaded,
  tourProgress,
  reduced = false,
  staticView = false,
  floorAnchor,
}: {
  mode: Mode;
  fit?: number;
  onLoaded?: () => void;
  /** scroll progress through the services tour, 0..1 (mutable ref, no re-renders) */
  tourProgress?: { current: number };
  /** prefers-reduced-motion: skip the auto intro / orbit / spin / wheel roll */
  reduced?: boolean;
  /** force the parked, dead-still side view (no intro, orbit, spin, or wheel
      roll) regardless of motion preference — the scroll tour still drives the
      camera on top. Used by the landing page. */
  staticView?: boolean;
  /** world position the car comes to rest at — written here in setup so the
      floor grid/tiles can centre their pattern under the parked car. */
  floorAnchor?: { current: THREE.Vector3 };
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
  const staticViewRef = useRef(staticView);
  staticViewRef.current = staticView;
  const carGroup = useRef<THREE.Group>(null);
  const staticRef = useRef<THREE.Group>(null); // holds the logo so it never spins
  const pivots = useRef<THREE.Group[]>([]);
  const didSetup = useRef(false);
  const loadedFired = useRef(false); // onLoaded fires on the first FRAMED frame
  const colorsInit = useRef(true); // snap (not lerp) materials to theme on frame 1
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
    wsizeY: number; // car height Hc — pose multiplier base
    L: number; // car length — pose distance / look-Z base
    wx: number; // car width — pose look-X base
    groundY: number; // world Y of the floor top the car sits on — camera floor
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
  const floorMatsRef = useRef<THREE.Material[]>([]); // cloned floor-logo mats (fade on scroll)

  // one-time: recenter + scale, frame a fixed side-view camera, build wheel pivots.
  // useLayoutEffect (not useEffect) so the scale-down + hide happen BEFORE the
  // first paint — otherwise <primitive> renders the GLB at its raw (huge) scale
  // for a frame and a giant car flashes up while loading.
  useLayoutEffect(() => {
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
    cam.fov = BASE_FOV;
    const aspect = size.width / Math.max(1, size.height);
    const halfV = Math.tan((cam.fov / 2) * (Math.PI / 180));
    // looking along X: length (Z) fills width, height (Y) fills the frame height
    const distH = wsize.z / 2 / (halfV * aspect);
    const distV = wsize.y / 2 / halfV;
    // Anchor the car to a consistent fraction of the viewport WIDTH on any
    // landscape screen (desktop / Mac / ultrawide all match — the car is always
    // ~1/fit of the width); only fall back to fit-both on portrait, where
    // width-fit would shrink it too far. So size never drifts with screen shape.
    const dist = (aspect >= 1 ? distH : Math.max(distH, distV)) * fit; // higher fit = car smaller
    cam.near = 0.04; // small so the ultra-close fisheye tour shots don't clip the car
    // far enough to clear the floor grid's fade (≈120u from the car) from any
    // tour angle — otherwise low/wide shots hard-clip the receding floor and a
    // whole patch of grid vanishes instead of fading out.
    cam.far = Math.max(dist * 12, 400);
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

    // the car comes to rest with group.position.z = R, so its world centre is
    // (wc.x, _, wc.z + R). Hand that to the floor field so the grid/tiles centre
    // their pattern (and the empty box) right under the parked car.
    if (floorAnchor) floorAnchor.current.set(wc.x, 0, wc.z + R);

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

    // The scroll-tour poses themselves live in `cameraTuning` (normalised); the
    // frame loop converts them with these size bases (L, Hc, wx) each frame.
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
      wsizeY: wsize.y, // Hc
      L: wsize.z,
      wx: wsize.x,
      groundY: 0, // refined below from the floor-logo top (the car's ground plane)
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
      // NB: this model's nose is the "B" (+z) end, so the real FRONT wheels are
      // the ones bucketed "B". They steer: yaw (Y) must wrap the roll (X) → YXZ.
      if (key.endsWith("B")) {
        pivot.userData.front = true;
        pivot.rotation.order = "YXZ";
      }
      group.add(pivot);
      ws.forEach((w) => pivot.attach(w.mesh)); // keep world transform, change pivot
      ps.push(pivot);
    }
    pivots.current = ps;

    // keep the floor logo static — it must NOT rotate with the car
    const stat = staticRef.current;
    if (stat) {
      // collect the floor-logo mesh(es): the named node, or fall back to any
      // node named like it / using a logo material.
      const floorParts: THREE.Object3D[] = [];
      let named: THREE.Object3D | null = null;
      scene.traverse((o) => {
        if (o.name === "logo_floor") named = o;
      });
      if (named) {
        floorParts.push(named);
      } else {
        scene.traverse((o) => {
          if (
            o.name.toLowerCase().includes("logo_floor") ||
            ((o as THREE.Mesh).isMesh && /logo/i.test(((o as THREE.Mesh).material as THREE.Material | undefined)?.name ?? ""))
          ) {
            floorParts.push(o);
          }
        });
      }

      if (floorParts.length) {
        const fb = new THREE.Box3();
        floorParts.forEach((m) => fb.expandByObject(m));
        // the top of this disc is the ground the car rests on → the camera floor
        if (rig.current) rig.current.groundY = fb.max.y;

        // Clone the floor logo's material(s) and make them transparent, so we can
        // fade ONLY the floor logo out on scroll without touching the car's badge
        // (which may share the same material instance). The clones are recoloured
        // toward the logo colour each frame to keep theme-switching working.
        const fades: THREE.Material[] = [];
        for (const part of floorParts) {
          part.traverse((o) => {
            const mm = o as THREE.Mesh;
            if (!mm.isMesh) return;
            if (Array.isArray(mm.material)) {
              mm.material = mm.material.map((m) => {
                const c = m.clone();
                c.transparent = true;
                fades.push(c);
                return c;
              });
            } else {
              const c = mm.material.clone();
              c.transparent = true;
              mm.material = c;
              fades.push(c);
            }
          });
        }
        floorMatsRef.current = fades;
      }

      floorParts.forEach((m) => stat.attach(m));
      // 95% footprint, but squashed in Y so the logo lies much flatter against
      // the floor (the group sits at ground y≈0, so this presses it down).
      stat.scale.set(0.95, 0.2, 0.95);

      // No single big logo directly under the car — the floor pattern is the
      // tiled grid logos. Hide it (groundY was already measured from it above).
      floorParts.forEach((m) => (m.visible = false));
    }

    // hide the car until it drives in — the opening frame is just the logo line
    group.visible = false;
    group.position.z = carStartZ;
    // NOTE: onLoaded is intentionally NOT called here. The camera isn't framed
    // until the first useFrame runs; firing now would fade the poster out over a
    // default-camera frame (car too big). We fire it from the frame loop instead.
  }, [scene, camera, size, fit, floorAnchor]);

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
      aPos: new THREE.Vector3(),
      bPos: new THREE.Vector3(),
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
    // reduced motion (or the landing page's staticView): jump past the whole
    // timed intro to the parked state, so there's no auto-play choreography —
    // only the scroll-driven tour moves.
    const reduced = reducedRef.current || staticViewRef.current;
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

    // Landing hero: sit the parked car LOWER in the frame. Raising the camera and
    // its look-target by the same amount is a clean vertical pan (same angle, no
    // distortion) that drops the car to a grounded lower-third. It blends away as
    // the scroll tour engages (the tour camera/look take over), and only applies
    // to the static landing view — /car and the close-ups are unaffected.
    if (staticViewRef.current) {
      const drop = data.wsizeY * 0.45; // higher = car sits lower
      idlePos.y += drop;
      look.y += drop;
    }

    // --- scroll tour: ease toward the page's scroll progress, then derive the
    // camera from it. Poses are in the car's frame (offset by its CURRENT yaw),
    // so the tour picks up from wherever the turntable stopped — no reset.
    // click-to-pose (jumpTo) wins over scroll: ease toward that pose's progress
    const jt = cameraTuning.jumpTo;
    const targetP =
      jt != null && cameraTuning.poses.length > 1
        ? jt / cameraTuning.poses.length
        : tourProgress?.current ?? 0;
    smoothTourP.current += (targetP - smoothTourP.current) * (1 - Math.exp(-4.5 * dt));
    if (targetP === 0 && smoothTourP.current < 0.0005) smoothTourP.current = 0;
    const p = smoothTourP.current;
    let w = 0; // tour blend weight: 0 = idle animation, 1 = tour camera
    let tourFov = BASE_FOV; // lens at the tour position
    const tunePoses = cameraTuning.poses;
    const nPoses = tunePoses.length;
    if (nPoses >= 1 && (cameraTuning.freeze || p > 0)) {
      const L = data.L, Hc = data.wsizeY, wx = data.wx;
      let A: typeof tunePoses[number], B: typeof tunePoses[number], segT: number;
      let segIdx = -1; // which segment we're transitioning ACROSS (i0 → i0+1)
      if (cameraTuning.freeze) {
        // hold the selected pose, ignoring scroll — lets a pose be tuned still
        w = 1;
        A = B = tunePoses[Math.min(nPoses - 1, Math.max(0, cameraTuning.active))];
        segT = 0;
      } else {
        // walk through every pose, but HOLD (dwell) on each one before a quick
        // transition to the next: you snap to a framing fast, then have to
        // actually scroll to leave it.
        w = sm(Math.min(1, p / 0.05)); // engage the tour almost immediately
        const u = p * nPoses; // one equal scroll band per service pose
        const i0 = Math.min(nPoses - 1, Math.floor(u));
        segIdx = i0;
        A = tunePoses[i0];
        B = tunePoses[Math.min(nPoses - 1, i0 + 1)];
        const f = u - i0; // progress within this pose's band
        segT = sm(Math.max(0, f - SERVICE_DWELL) / (1 - SERVICE_DWELL));
      }
      const th = g.rotation.y;
      tourFov = A.fov + (B.fov - A.fov) * segT;
      // Wedding → Corporate (segment 1→2): widen the lens at the midpoint so the
      // whole car reads while the camera dollies back (see the pull-out below).
      if (segIdx === 1) tourFov += Math.sin(segT * Math.PI) * 22;
      // responsive framing: a narrow (portrait / mobile) canvas pulls the camera
      // back so the same part stays fully in frame; wide canvases stay as authored
      const aspect = state.size.width / Math.max(1, state.size.height);
      const radScale = Math.min(2.5, Math.max(1, 1.85 / aspect));
      const cx = data.wc.x;
      const cz = data.wc.z + g.position.z;
      // a pose's world position — FREE (direct x/y/z in the car frame) or ORBIT
      // (a point on the cylinder around the car: angle a, radius r, height h).
      const posOf = (P: typeof A, out: THREE.Vector3) => {
        if (P.mode === "free") {
          const fx = L * P.px, fz = L * P.pz;
          return out.set(
            cx + fx * Math.cos(th) + fz * Math.sin(th),
            Hc * P.py,
            cz + fz * Math.cos(th) - fx * Math.sin(th),
          );
        }
        const ang = Math.PI * P.a + th;
        const rad = L * P.r * radScale;
        return out.set(cx + Math.sin(ang) * rad, Hc * P.h, cz + Math.cos(ang) * rad);
      };
      if (A.mode !== "free" && B.mode !== "free") {
        // both orbit → interpolate the ANGLE so the move arcs (never cuts through)
        const aA = Math.PI * A.a;
        let da = Math.PI * B.a - aA;
        da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        const ang = aA + da * segT + th;
        const rad = L * (A.r + (B.r - A.r) * segT) * radScale;
        tmps.tourPos.set(cx + Math.sin(ang) * rad, Hc * (A.h + (B.h - A.h) * segT), cz + Math.cos(ang) * rad);
      } else {
        // at least one free pose → straight lerp between the two world positions,
        // then BOW the path outward at the midpoint: the camera dollies back so
        // the car reads in perspective, then comes forward into the framing.
        // BUT only between two FREE poses — when one end is an ORBIT pose (e.g. the
        // City Tours shot) the bow makes the camera swing out and only turn to face
        // the framing on the way in ("move, then turn"). Skipping it lets the move
        // and the turn happen together and finish at the same time.
        tmps.tourPos.lerpVectors(posOf(A, tmps.aPos), posOf(B, tmps.bPos), segT);
        const bow =
          A.mode === "free" && B.mode === "free" ? Math.sin(segT * Math.PI) : 0; // 0 at both ends → 1 mid
        if (bow > 0.001) {
          const dx = tmps.tourPos.x - cx, dz = tmps.tourPos.z - cz;
          const d = Math.hypot(dx, dz) || 1;
          const push = bow * L * 0.4; // how far back it pulls at the midpoint
          tmps.tourPos.x += (dx / d) * push;
          tmps.tourPos.z += (dz / d) * push;
        }
        // Wedding → Corporate (segment 1→2): a BIG dolly-out + lift at the
        // midpoint, so the camera pulls right back to reveal the FULL car and you
        // watch it travel in, then it settles into the Corporate framing.
        const wideArc = segIdx === 1 ? Math.sin(segT * Math.PI) : 0;
        if (wideArc > 0.001) {
          const dx = tmps.tourPos.x - cx, dz = tmps.tourPos.z - cz;
          const d = Math.hypot(dx, dz) || 1;
          const push = wideArc * L * 1.8; // far enough back to frame the whole car
          tmps.tourPos.x += (dx / d) * push;
          tmps.tourPos.z += (dz / d) * push;
          tmps.tourPos.y += wideArc * Hc * 0.5; // lift for a 3/4 overview
        }
      }
      // never dip below the floor the car sits on — that's as low as it goes
      if (tmps.tourPos.y < data.groundY) tmps.tourPos.y = data.groundY;
      // look target (car frame) lerped per component, then rotated by car yaw
      const llx = wx * (A.lx + (B.lx - A.lx) * segT);
      const lly = Hc * (A.ly + (B.ly - A.ly) * segT);
      const llz = L * (A.lz + (B.lz - A.lz) * segT);
      tmps.tourLook.set(
        cx + llx * Math.cos(th) + llz * Math.sin(th),
        lly,
        cz + llz * Math.cos(th) - llx * Math.sin(th),
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

    // blend the lens from the resting BASE_FOV toward the tour pose's fov by the
    // same tour weight, so the bottom angle widens out dramatically on scroll.
    const desiredFov = BASE_FOV + (tourFov - BASE_FOV) * w;
    if (Math.abs(cam.fov - desiredFov) > 0.01) {
      cam.fov = desiredFov;
      cam.updateProjectionMatrix();
    }

    // first frame with the camera actually framed + the car visible → tell the
    // page it's ready so the poster cross-fades out onto a matching frame (no
    // "big then snaps" flash from the default/intro camera).
    if (!loadedFired.current && g.visible && didSetup.current) {
      loadedFired.current = true;
      onLoaded?.();
    }

    // Wheel ROLL. On the LANDING (staticView) the wheels stay still until the
    // camera reaches the Group front-on view, then ramp up (so they start rolling
    // right where the front wheels also steer). On /car (the timed drive-in intro)
    // they roll normally. Gated by genuine OS reduced-motion for a11y.
    const rollFactor = staticViewRef.current
      ? sm((smoothTourP.current - WHEEL_ROLL_START) / (WHEEL_ROLL_FULL - WHEEL_ROLL_START))
      : 1;
    if (g.visible && !reducedRef.current && rollFactor > 0) {
      for (const piv of pivots.current) {
        piv.rotation.x += WHEEL * dt * rollFactor;
      }
    }

    // front-wheel STEER: the two front tyres turn LEFT during the Wedding →
    // Corporate transition (segment 1 → 2) — synced to the SAME dwell→move easing
    // the camera uses for that big dolly-out, so you watch the wheels steer AS the
    // car travels in and they finish exactly as Corporate is framed (not after
    // you've reached Corporate and scrolled on). They then stay turned.
    if (g.visible) {
      const nPoses = cameraTuning.poses.length;
      const uSteer = smoothTourP.current * nPoses;
      // progress of the Wedding→Corporate move: 0 during the Wedding dwell, ramps
      // to 1 across the transition (u 1.65→2), then holds at 1 from Corporate on.
      const moveT = c01((uSteer - 1 - SERVICE_DWELL) / (1 - SERVICE_DWELL));
      const steer = sm(moveT) * 0.5; // ~28° left, complete as it reaches Corporate
      for (const p of pivots.current) {
        if (p.userData.front) p.rotation.y = steer;
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
    //    can't overshoot the target). On the very FIRST frame snap straight to
    //    the target (factor 1) instead of lerping: otherwise the GLB's raw
    //    material colours (a dark body) show for the first ~12 frames and read
    //    as a black flash the instant the poster swaps to the 3D — most visible
    //    in dark mode, where the car should already be near-white.
    const lerpSpeed = colorsInit.current ? 1 : Math.min(1, 5 * dt);
    colorsInit.current = false;
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
    // floor logo: keep it the logo colour, and FADE IT OUT as the scroll tour
    // engages (w: 0 at the top → 1 in the tour) so focus moves to the car.
    for (const m of floorMatsRef.current) {
      const sm2 = m as THREE.MeshStandardMaterial;
      if (sm2.color) sm2.color.lerp(targetLogoColor.current, lerpSpeed);
      sm2.opacity = 1 - w;
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

// Grid line colours per mode — a plain DARK grid now (the accent lives on the
// logos, not the section lines). Section lines stay a touch more prominent than
// the cells so the boxes still read.
// section colours are pre-blended toward the page backdrop so the grid reads at
// a low, faint opacity (drei's <Grid> has no opacity prop — line visibility is
// just its colour's contrast against the floor).
const FLOOR: Record<Mode, { cell: string; section: string }> = {
  light: { cell: "#4a4a52", section: "#8a8f99" },
  dark: { cell: "#2f2f37", section: "#7c7c86" },
};

// Floor-logo tint — yellow accent on the light floor, blue on the dark floor.
const LOGO_TILE: Record<Mode, string> = {
  light: "#FDBA16",
  dark: "#2A4FD0",
};

// Infinite studio grid sitting on the car's ground plane (world y = 0, where the
// tyres rest). It fades out into the distance so it reads as the floor extending
// all around the car — revealed as the scroll tour cranes the camera low/wide.
function Floor({ mode }: { mode: Mode }) {
  const ref = useRef<THREE.Mesh>(null);
  // Theme colours are LERPED (not snapped) so the grid changes in lockstep with
  // the car's own colour fade. The cellColor/sectionColor props are CONSTANT, so
  // R3F never re-applies them on a mode switch — we own the uniforms below.
  const targetCell = useRef(new THREE.Color(FLOOR[mode].cell));
  const targetSection = useRef(new THREE.Color(FLOOR[mode].section));
  useEffect(() => {
    targetCell.current.set(FLOOR[mode].cell);
    targetSection.current.set(FLOOR[mode].section);
  }, [mode]);
  useFrame((_, dt) => {
    const mat = ref.current?.material as THREE.ShaderMaterial | undefined;
    if (!mat?.uniforms) return;
    const k = Math.min(1, 5 * dt); // same rate as the car colour lerp
    mat.uniforms.cellColor.value.lerp(targetCell.current, k);
    mat.uniforms.sectionColor.value.lerp(targetSection.current, k);
  });
  return (
    <Grid
      ref={ref}
      // a hair above 0 (z-fight), and offset by half a section so the local
      // origin — the car's parked spot (the FloorField group sits there) — lands
      // in the CENTRE of a blue box, not on a line.
      position={[3, 0.002, 3]}
      // only the big section boxes — the small cell lines are hidden (thickness 0)
      cellSize={1.2}
      cellThickness={0}
      cellColor={FLOOR.light.cell}
      sectionSize={6}
      sectionThickness={1}
      sectionColor={FLOOR.light.section}
      // reach far enough (and fade gently) that the grid fills the viewport —
      // including the foreground in front of the car — instead of dissolving
      // into the backdrop just past the car.
      fadeDistance={120}
      fadeStrength={1}
      fadeFrom={0}
      infiniteGrid
      followCamera={false}
    />
  );
}

// A white-silhouette logo texture (tinted per theme via the material colour, so
// one texture serves both modes). Built from the brand paths as an inline SVG.
//
// `blur` (in viewBox units, 0 = crisp) softens the mark with an feGaussianBlur —
// used on the light floor so the tiles read as a soft reflection. The viewBox is
// padded by TILE_PAD_FRAC on every side so the blur halo isn't clipped; the same
// padding is baked into both modes' textures (TILE_SCALE compensates) so the
// on-floor logo size stays identical whether blurred or not.
const TILE_PAD_FRAC = 0.22;
function makeLogoTexture(blur = 0): THREE.Texture {
  const padX = LOGO_W * TILE_PAD_FRAC;
  const padY = LOGO_H * TILE_PAD_FRAC;
  const w = LOGO_W * (1 + 2 * TILE_PAD_FRAC);
  const h = LOGO_H * (1 + 2 * TILE_PAD_FRAC);
  const defs =
    blur > 0
      ? `<defs><filter id="lf" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>`
      : "";
  const filterAttr = blur > 0 ? ` filter="url(#lf)"` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `${defs}<g transform="translate(${padX},${padY})"${filterAttr}>` +
    `<path d="${LOGO_PATHS[0]}" fill="#ffffff"/><path d="${LOGO_PATHS[1]}" fill="#ffffff"/></g></svg>`;
  const tex = new THREE.TextureLoader().load(
    "data:image/svg+xml;utf8," + encodeURIComponent(svg),
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// The flat logo, repeated across the floor in a CHECKERBOARD of grid cells (one
// cell on, one off), each one small and lying flat. Instanced so the whole field
// is a single draw call. The colour lerps with the theme like the car's logo.
const TILE_CELL = 6; // matches the Floor grid's sectionSize → the BLUE boxes
const TILE_RADIUS = 24; // how far the field spreads from the car (within the fade)
// logo size inside each blue box (smaller than the 6-box). Scaled up by the
// texture's padding factor so the white mark itself keeps the same on-floor size
// despite the transparent blur margin baked into the texture.
const TILE_SCALE = 2.6 * (1 + 2 * TILE_PAD_FRAC);

function LogoFloorTiles({ mode }: { mode: Mode }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // crisp on the dark floor, softly blurred on the light floor
  const sharpTex = useMemo(() => makeLogoTexture(0), []);
  const blurTex = useMemo(() => makeLogoTexture(3.5), []);
  const tex = mode === "light" ? blurTex : sharpTex;
  const target = useRef(new THREE.Color(LOGO_TILE[mode]));
  useEffect(() => {
    target.current.set(LOGO_TILE[mode]);
  }, [mode]);

  // checkerboard of BLUE-box CENTRES. With the grid offset by half a section,
  // box centres land on multiples of TILE_CELL — so origin (0,0) is a box centre
  // (where the car parks). The parity skip leaves THAT box empty for the car.
  const cells = useMemo(() => {
    const n = Math.ceil(TILE_RADIUS / TILE_CELL);
    const out: [number, number][] = [];
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        // inverted checker: logos now live on the boxes that used to be empty…
        if (((i + j) & 1) === 1) continue;
        // …but the car's centre box stays empty (it's an even box otherwise).
        if (i === 0 && j === 0) continue;
        out.push([i * TILE_CELL, j * TILE_CELL]);
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    // lay the plane flat (face up), flipped 180° in-plane so the logo points the
    // other way, and keep the logo's tall aspect ratio
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI));
    const s = new THREE.Vector3(TILE_SCALE, TILE_SCALE * (LOGO_H / LOGO_W), 1);
    const v = new THREE.Vector3();
    cells.forEach(([x, z], idx) => {
      v.set(x, 0.004, z); // just above the grid lines
      m.compose(v, q, s);
      mesh.setMatrixAt(idx, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [cells]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    (mesh.material as THREE.MeshBasicMaterial).color.lerp(target.current, Math.min(1, 5 * dt));
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, cells.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={0.45}
        depthWrite={false}
        toneMapped={false}
        color={LOGO_TILE[mode]}
      />
    </instancedMesh>
  );
}

// The grid + logo tiles, parented to a group that sits at the car's PARKED
// centre (written into `anchor` by Car's setup). The car rests at the rendezvous
// z, not the world origin, so centring the pattern here is what makes the car
// land in the middle of its (empty) grid box rather than off to one side.
function FloorField({
  mode,
  anchor,
}: {
  mode: Mode;
  anchor: { current: THREE.Vector3 };
}) {
  const groupRef = useRef<THREE.Group>(null);
  // anchor is set once on model load; copying each frame just applies it after
  // load (cheap — a single Vector3 copy) and survives any later re-measure.
  useFrame(() => {
    if (groupRef.current) groupRef.current.position.copy(anchor.current);
  });
  return (
    <group ref={groupRef}>
      <Floor mode={mode} />
      <LogoFloorTiles mode={mode} />
      {/* soft contact shadow the car casts on the floor (sits just above the
          grid/logos so it grounds the car) */}
      <ContactShadows
        position={[0, 0.02, 0]}
        scale={11}
        far={5}
        blur={2.6}
        opacity={0.6}
        color="#000000"
        resolution={512}
      />
    </group>
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

export type LensType = "perspective" | "fisheye";

export default function CarStage({
  mode,
  bg,
  fit,
  transparent = false,
  onLoaded,
  tourProgress,
  staticView = false,
  lens = "perspective",
  fisheyeZoom = 0.5,
}: {
  mode: Mode;
  bg?: string;
  fit?: number;
  /** Render the canvas transparent so the page background shows through. */
  transparent?: boolean;
  onLoaded?: () => void;
  /** scroll progress through the services tour, 0..1 (mutable ref, no re-renders) */
  tourProgress?: { current: number };
  /** Park the car dead-still at the side view (no intro/orbit/spin/wheel roll);
      the scroll tour still drives the camera. */
  staticView?: boolean;
  /** Camera projection: standard perspective, or a real (cubemap) fisheye. */
  lens?: LensType;
  /** Fisheye spread (0 = widest, 1 = tighter). Only used when lens="fisheye". */
  fisheyeZoom?: number;
}) {
  const reduced = useReducedMotion();
  // the car's parked world centre — written by Car's setup, read by FloorField so
  // the grid/tiles centre their (empty) box under the parked car.
  const floorAnchor = useRef(new THREE.Vector3());
  const scene = (
    <>
      <StageLights mode={mode} />
      <FloorField mode={mode} anchor={floorAnchor} />
      <Car
        mode={mode}
        fit={fit}
        onLoaded={onLoaded}
        tourProgress={tourProgress}
        reduced={reduced}
        staticView={staticView}
        floorAnchor={floorAnchor}
      />
      <Environment preset="city" />
    </>
  );
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
          {lens === "fisheye" ? <Fisheye zoom={fisheyeZoom}>{scene}</Fisheye> : scene}
        </Suspense>
      </Canvas>
    </GLErrorBoundary>
  );
}

useGLTF.preload(MODEL_URL);
