// Procedural low-poly geometry for the Apex District, built from the SAME data
// that draws the landing-page mini-map SVG (`CITY` in app/map-trail/city.ts) — so
// the 3D city matches the SVG by construction: same avenues, roundabout, mall,
// plaza, park, lake and building footprints.
//
// Everything is merged into one BufferGeometry per material "key", so the scene
// renders the whole city in a handful of draw calls (one flat-shaded mesh each).
//
// Browser-only: uses SVGLoader (needs DOMParser), so call build() from the
// client (the scene's useMemo), never at module top level / on the server.

import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CITY, type Pt } from "@/app/map-trail/city";

// --- svg(600×600) → world transform ---------------------------------------
const HALF = 300;
const S = 0.2; // world units per svg unit → city ≈ 120×120
const X = (sx: number) => (sx - HALF) * S;
const Z = (sy: number) => (sy - HALF) * S;
const L = (d: number) => d * S;

// stacked heights (world Y) so coplanar pieces never z-fight
const Y = {
  ground: 0,
  water: 0.05,
  grass: 0.08,
  plaza: 0.1,
  island: 0.12,
  sidewalk: 0.14,
  road: 0.22,
  lane: 0.27,
  base: 0.14, // building / tree / fountain base sits on the kerb level
};

export type MatKey =
  | "ground"
  | "water"
  | "grass"
  | "plaza"
  | "sidewalk"
  | "road"
  | "lane"
  | "buildingA"
  | "buildingB"
  | "buildingC"
  | "landmark"
  | "trim"
  | "treeFoliage"
  | "treeTrunk"
  | "fountain"
  | "fountainWater"
  | "island";

export type Billboard = { x: number; z: number; rotY: number };
export type CityModel = {
  groups: Partial<Record<MatKey, THREE.BufferGeometry>>;
  billboards: Billboard[];
};

// --- helpers ---------------------------------------------------------------
function parsePoly(d: string): Pt[] {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) pts.push({ x: n[i], y: n[i + 1] });
  return pts;
}

// force every vertex normal to +Y (these are flat, ground-hugging surfaces, lit
// from above) and let the material be double-sided so winding never culls them.
function flatUp(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const c = g.attributes.position.count;
  const arr = new Float32Array(c * 3);
  for (let i = 0; i < c; i++) arr[i * 3 + 1] = 1;
  g.setAttribute("normal", new THREE.Float32BufferAttribute(arr, 3));
  return g;
}

// A flat ribbon following a polyline (svg coords), `widthSvg` wide, at world `y`.
// Miter-offset on both sides so straight grid roads stay a constant width.
function ribbon(ptsSvg: Pt[], widthSvg: number, y: number): THREE.BufferGeometry | null {
  const raw = ptsSvg.map((p) => [X(p.x), Z(p.y)] as [number, number]);
  const P: [number, number][] = [];
  for (const q of raw) {
    const last = P[P.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1e-4) P.push(q);
  }
  if (P.length < 2) return null;

  const half = L(widthSvg) / 2;
  const dir = (a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l] as [number, number];
  };
  const perp = (d: [number, number]) => [d[1], -d[0]] as [number, number]; // right normal

  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < P.length; i++) {
    const dPrev = i > 0 ? dir(P[i - 1], P[i]) : null;
    const dNext = i < P.length - 1 ? dir(P[i], P[i + 1]) : null;
    let nx: number, nz: number, scale = half;
    if (dPrev && dNext) {
      const pp = perp(dPrev),
        pn = perp(dNext);
      let mx = pp[0] + pn[0],
        mz = pp[1] + pn[1];
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml;
      mz /= ml;
      const cosA = mx * pp[0] + mz * pp[1];
      scale = half / Math.max(0.35, cosA);
      nx = mx;
      nz = mz;
    } else {
      const d = (dPrev || dNext)!;
      const pr = perp(d);
      nx = pr[0];
      nz = pr[1];
    }
    left.push([P[i][0] + nx * scale, P[i][1] + nz * scale]);
    right.push([P[i][0] - nx * scale, P[i][1] - nz * scale]);
  }

  const pos: number[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const l0 = left[i],
      r0 = right[i],
      l1 = left[i + 1],
      r1 = right[i + 1];
    pos.push(l0[0], y, l0[1], r0[0], y, r0[1], r1[0], y, r1[1]);
    pos.push(l0[0], y, l0[1], r1[0], y, r1[1], l1[0], y, l1[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return flatUp(g);
}

// SVG path fills (parks/plaza/mall/water) → flat ShapeGeometry on the XZ plane.
function shapeFills(dStrings: string[], y: number): THREE.BufferGeometry[] {
  if (!dStrings.length) return [];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">` +
    dStrings.map((d) => `<path d="${d}"/>`).join("") +
    `</svg>`;
  const data = new SVGLoader().parse(svg);
  const out: THREE.BufferGeometry[] = [];
  for (const path of data.paths) {
    for (const shape of SVGLoader.createShapes(path)) {
      const g = new THREE.ShapeGeometry(shape, 6);
      g.translate(-HALF, -HALF, 0);
      g.scale(S, S, 1);
      g.rotateX(Math.PI / 2); // (x,y,0) → (x,0,y): svg-y becomes world Z
      g.translate(0, y, 0);
      out.push(flatUp(g));
    }
  }
  return out;
}

// deterministic 0..1 from a footprint position (stable building heights)
function hash(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function box(
  cxSvg: number,
  cySvg: number,
  wSvg: number,
  hSvg: number,
  height: number,
  baseY: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(L(wSvg), height, L(hSvg));
  // The window texture (applied in CityScene) tiles per box face — keep it OFF
  // the top + bottom faces (the roof shouldn't have windows) by pointing those
  // faces' UVs at the texture's blank margin. BoxGeometry face order is
  // +X,-X,+Y,-Y,+Z,-Z (4 verts each), so +Y/-Y are uv indices 8..15.
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 8; i <= 15; i++) uv.setXY(i, 0.05, 0.05);
  uv.needsUpdate = true;
  g.translate(X(cxSvg), baseY + height / 2, Z(cySvg));
  return g;
}

function disc(
  cxSvg: number,
  cySvg: number,
  rSvg: number,
  thickness: number,
  baseY: number,
  seg = 14,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(L(rSvg), L(rSvg), thickness, seg);
  g.translate(X(cxSvg), baseY + thickness / 2, Z(cySvg));
  return g;
}

export function buildCityModel(): CityModel {
  const bins: Partial<Record<MatKey, THREE.BufferGeometry[]>> = {};
  const add = (k: MatKey, g: THREE.BufferGeometry | null) => {
    if (!g) return;
    (bins[k] ||= []).push(g);
  };

  // ground slab
  {
    const g = new THREE.PlaneGeometry(170, 170);
    g.rotateX(-Math.PI / 2);
    g.translate(0, Y.ground, 0);
    add("ground", g);
  }

  // area fills (exact SVG shapes)
  shapeFills(CITY.water, Y.water).forEach((g) => add("water", g));
  shapeFills(CITY.parks, Y.grass).forEach((g) => add("grass", g));
  shapeFills(
    [...CITY.plazas, ...CITY.malls.map((m) => m.d)],
    Y.plaza,
  ).forEach((g) => add("plaza", g));

  // roads: kerb/sidewalk ribbon (casing width) + asphalt ribbon (road width) on
  // top; arterials also get a thin accent centre line.
  for (const r of CITY.roads) {
    const pts = parsePoly(r.d);
    add("sidewalk", ribbon(pts, r.casing, Y.sidewalk));
    add("road", ribbon(pts, r.w, Y.road));
    if (r.arterial) add("lane", ribbon(pts, 1.1, Y.lane));
  }

  // buildings (extruded footprints). Landmark = Eko Hotel — the tallest tower.
  for (const b of CITY.buildings) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (b.landmark) {
      const h = 15; // clearly the tallest building in the city

      add("landmark", box(cx, cy, b.w, b.h, h, Y.base));
      // subtle accent crown
      add("trim", box(cx, cy, b.w * 0.96, b.h * 0.96, 0.18, Y.base + h));
      continue;
    }
    const r = hash(b.x, b.y);
    const h = 1.3 + r * r * 5.4; // mostly low, a few taller
    const key: MatKey = r < 0.4 ? "buildingA" : r < 0.75 ? "buildingB" : "buildingC";
    add(key, box(cx, cy, b.w, b.h, h, Y.base));
    if (h > 4.6) add("trim", box(cx, cy, b.w * 0.9, b.h * 0.9, 0.16, Y.base + h)); // accent rooftop band
  }

  // trees (cone foliage + trunk)
  for (const t of CITY.trees) {
    const rr = L(t.r);
    const trunk = new THREE.CylinderGeometry(rr * 0.16, rr * 0.2, 0.5, 5);
    trunk.translate(X(t.cx), Y.grass + 0.25, Z(t.cy));
    add("treeTrunk", trunk);
    const fol = new THREE.ConeGeometry(rr * 1.5, 1.5, 6);
    fol.translate(X(t.cx), Y.grass + 0.5 + 0.75, Z(t.cy));
    add("treeFoliage", fol);
  }

  // roundabout islands (grass discs)
  for (const is of CITY.islands) add("island", disc(is.cx, is.cy, is.r, 0.22, Y.island, 18));

  // fountains: stone basin + a water disc on top
  for (const f of CITY.fountains) {
    add("fountain", disc(f.cx, f.cy, f.r, 0.3, Y.plaza, 12));
    add("fountainWater", disc(f.cx, f.cy, f.r * 0.72, 0.08, Y.plaza + 0.3, 12));
  }

  // merge each bin into one geometry
  const groups: Partial<Record<MatKey, THREE.BufferGeometry>> = {};
  for (const k of Object.keys(bins) as MatKey[]) {
    const arr = bins[k]!;
    const merged = arr.length === 1 ? arr[0] : mergeGeometries(arr, false);
    if (merged) groups[k] = merged;
  }

  // billboards: roadside spots (svg coords) + facing angle. Kept off water/park.
  const spots: { sx: number; sy: number; rotY: number }[] = [
    { sx: 240, sy: 120, rotY: Math.PI / 2 }, // near the mall, facing Apex Ave
    { sx: 360, sy: 240, rotY: 0 }, // approaching the roundabout
    { sx: 120, sy: 360, rotY: Math.PI / 2 }, // by the park
    { sx: 470, sy: 360, rotY: -Math.PI / 2 }, // by the lake
    { sx: 360, sy: 470, rotY: 0 }, // south arterial
  ];
  const billboards: Billboard[] = spots.map((s) => ({ x: X(s.sx), z: Z(s.sy), rotY: s.rotY }));

  return { groups, billboards };
}
