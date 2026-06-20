// The "Apex District" — a small, hand-authored stylized city.
//
// Replaces the old OpenStreetMap basemap (curvy real roads + dead-end service
// stubs that the navigator kept driving into and U-turning out of). Everything
// here is built from a clean grid, so:
//   • roads are dead straight where they should be,
//   • every road connects to the network (no degree-1 nodes → no U-turns),
//   • places get real names (Apex Avenue, Apexride Mall, Greenwood Park …).
//
// Two things come out of this file:
//   • CITY               — geometry for *drawing* (crisp originals), theme-agnostic
//   • buildStreetGraph() — a planarized, dead-end-free graph for *driving*
//
// The layout is fully deterministic (fixed-seed RNG) so the server and client
// render byte-identical SVG — no hydration mismatch.

export type Pt = { x: number; y: number };

export const CANVAS = 600;

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) — fixed seed so the city never shuffles.
// ---------------------------------------------------------------------------
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The grid. Avenues run vertically, streets horizontally. Slightly irregular
// spacing reads more like a real neighborhood than a perfect lattice.
// ---------------------------------------------------------------------------
type Line = { v: number; name: string; rank: 1 | 2 | 3 };

const AVENUES: Line[] = [
  { v: 65, name: "Bourdillon Rd", rank: 3 },
  { v: 175, name: "Akin Adesola St", rank: 2 },
  { v: 300, name: "Ahmadu Bello Way", rank: 1 },
  { v: 425, name: "Adeola Odeku St", rank: 2 },
  { v: 535, name: "Ozumba Mbadiwe Ave", rank: 3 },
];
const STREETS: Line[] = [
  { v: 65, name: "Ribadu Rd", rank: 3 },
  { v: 175, name: "Kofo Abayomi St", rank: 2 },
  { v: 300, name: "Awolowo Rd", rank: 1 },
  { v: 425, name: "Sanusi Fafunwa St", rank: 2 },
  { v: 535, name: "Adeyemo Alakija St", rank: 3 },
];
const XS = AVENUES.map((a) => a.v);
const YS = STREETS.map((s) => s.v);

// One grand diagonal for character; endpoints sit exactly on grid nodes so it
// joins the network cleanly. Avoids the park block and the roundabout.
// Roundabout(s): a ring road with a fountain island in the middle.
export const ROUNDABOUTS = [{ cx: 300, cy: 300, r: 38 }];

// Reserved blocks (col,row) get a feature instead of generic buildings.
const MALL = { col: 1, row: 0 };
const PLAZA = { col: 2, row: 1 };
const PARK = { col: 0, row: 2 };
const LAKE = { col: 3, row: 3 };

// ---------------------------------------------------------------------------
// Small geometry helpers
// ---------------------------------------------------------------------------
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

function distToSeg(px: number, py: number, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - a.x) * dx + (py - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

const polyD = (pts: Pt[]) =>
  "M " + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");

function ringPts(cx: number, cy: number, r: number, n = 24): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

// Split a polyline into the sub-polylines that lie OUTSIDE every roundabout, so a
// straight arterial STOPS at the ring instead of drawing across the island.
function clipRoundabouts(pts: Pt[]): Pt[][] {
  const insidePt = (p: Pt) =>
    ROUNDABOUTS.some((rb) => Math.hypot(p.x - rb.cx, p.y - rb.cy) < rb.r);
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  const push = (p: Pt) => {
    const last = cur[cur.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-4) cur.push(p);
  };
  const flush = () => {
    if (cur.length >= 2) out.push(cur);
    cur = [];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ts: number[] = [0, 1];
    for (const rb of ROUNDABOUTS) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const fx = a.x - rb.cx, fy = a.y - rb.cy;
      const A = dx * dx + dy * dy;
      const B = 2 * (fx * dx + fy * dy);
      const C = fx * fx + fy * fy - rb.r * rb.r;
      const disc = B * B - 4 * A * C;
      if (A === 0 || disc <= 0) continue;
      const sq = Math.sqrt(disc);
      for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
        if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
      }
    }
    ts.sort((u, v) => u - v);
    for (let k = 0; k < ts.length - 1; k++) {
      const p0 = { x: a.x + dxAt(a, b, ts[k]), y: a.y + dyAt(a, b, ts[k]) };
      const p1 = { x: a.x + dxAt(a, b, ts[k + 1]), y: a.y + dyAt(a, b, ts[k + 1]) };
      const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      if (insidePt(mid)) flush();
      else {
        push(p0);
        push(p1);
      }
    }
  }
  flush();
  return out;
}
const dxAt = (a: Pt, b: Pt, t: number) => (b.x - a.x) * t;
const dyAt = (a: Pt, b: Pt, t: number) => (b.y - a.y) * t;

function roundRectD(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M ${x + rr} ${y} H ${x + w - rr} Q ${x + w} ${y} ${x + w} ${y + rr} ` +
    `V ${y + h - rr} Q ${x + w} ${y + h} ${x + w - rr} ${y + h} ` +
    `H ${x + rr} Q ${x} ${y + h} ${x} ${y + h - rr} ` +
    `V ${y + rr} Q ${x} ${y} ${x + rr} ${y} Z`
  );
}

function ellipseD(cx: number, cy: number, rx: number, ry: number) {
  return (
    `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 ` +
    `a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`
  );
}

// ---------------------------------------------------------------------------
// Render model
// ---------------------------------------------------------------------------
export type RenderRoad = { d: string; w: number; casing: number; arterial: boolean };
export type RenderBuilding = { x: number; y: number; w: number; h: number; landmark?: boolean };
export type Disc = { cx: number; cy: number; r: number };
export type Label = {
  x: number;
  y: number;
  text: string;
  rot: number;
  kind: "street" | "poi" | "park" | "water";
  size: number;
};

export type City = {
  roads: RenderRoad[];
  buildings: RenderBuilding[];
  malls: { d: string; label: Label }[];
  parks: string[];
  plazas: string[];
  water: string[];
  promenades: string[];
  trees: Disc[];
  islands: Disc[];
  fountains: Disc[];
  labels: Label[];
};

function rankWidth(rank: 1 | 2 | 3) {
  return rank === 1 ? 8 : rank === 2 ? 6 : 4.5;
}

function blockBox(col: number, row: number) {
  return { x0: XS[col], x1: XS[col + 1], y0: YS[row], y1: YS[row + 1] };
}

function isReserved(col: number, row: number) {
  return (
    (col === MALL.col && row === MALL.row) ||
    (col === PLAZA.col && row === PLAZA.row) ||
    (col === PARK.col && row === PARK.row) ||
    (col === LAKE.col && row === LAKE.row)
  );
}

function buildCity(): City {
  const rng = makeRng(0x1f2e3d4c);

  // --- roads (crisp straight originals, drawn directly) -------------------
  const roads: RenderRoad[] = [];
  const addRoad = (d: string, rank: 1 | 2 | 3) => {
    const w = rankWidth(rank);
    roads.push({ d, w, casing: w + 3.5, arterial: rank === 1 });
  };
  // arterials are clipped at the roundabout so they don't draw across the island
  for (const a of AVENUES)
    for (const seg of clipRoundabouts(YS.map((y) => ({ x: a.v, y }))))
      addRoad(polyD(seg), a.rank);
  for (const s of STREETS)
    for (const seg of clipRoundabouts(XS.map((x) => ({ x, y: s.v }))))
      addRoad(polyD(seg), s.rank);
  // smooth 48-gon for drawing
  for (const rb of ROUNDABOUTS) addRoad(polyD(ringPts(rb.cx, rb.cy, rb.r, 48)), 2);

  // --- features -----------------------------------------------------------
  const buildings: RenderBuilding[] = [];
  const malls: { d: string; label: Label }[] = [];
  const parks: string[] = [];
  const plazas: string[] = [];
  const water: string[] = [];
  const promenades: string[] = [];
  const trees: Disc[] = [];
  const islands: Disc[] = [];
  const fountains: Disc[] = [];
  const labels: Label[] = [];

  const nearRoundabout = (x: number, y: number, pad: number) =>
    ROUNDABOUTS.some((rb) => Math.hypot(x - rb.cx, y - rb.cy) < rb.r + pad);

  // Generic buildings for every non-reserved block.
  for (let col = 0; col < XS.length - 1; col++) {
    for (let row = 0; row < YS.length - 1; row++) {
      if (isReserved(col, row)) continue;
      const { x0, x1, y0, y1 } = blockBox(col, row);
      const pad = 15;
      const gap = 6;
      const bx0 = x0 + pad;
      const by0 = y0 + pad;
      const cols = 2 + Math.floor(rng() * 2);
      const rows = 2 + Math.floor(rng() * 2);
      const cw = (x1 - pad - bx0 - gap * (cols - 1)) / cols;
      const ch = (y1 - pad - by0 - gap * (rows - 1)) / rows;
      for (let ci = 0; ci < cols; ci++) {
        for (let ri = 0; ri < rows; ri++) {
          if (rng() < 0.16) continue; // occasional courtyard gap
          const jx = rng() * 2;
          const jy = rng() * 2;
          const x = bx0 + ci * (cw + gap) + jx;
          const y = by0 + ri * (ch + gap) + jy;
          const w = cw - jx - rng() * 3;
          const h = ch - jy - rng() * 3;
          if (w < 7 || h < 7) continue;
          const mx = x + w / 2;
          const my = y + h / 2;
          if (nearRoundabout(mx, my, 22)) continue; // keep buildings clear of the ring road
          buildings.push({ x, y, w, h });
        }
      }
    }
  }

  // Apexride Mall — a big footprint with internal divisions.
  {
    const { x0, x1, y0, y1 } = blockBox(MALL.col, MALL.row);
    const p = 13;
    const mx = x0 + p;
    const my = y0 + p;
    const mw = x1 - x0 - 2 * p;
    const mh = y1 - y0 - 2 * p;
    malls.push({
      d: roundRectD(mx, my, mw, mh, 5),
      label: {
        x: mx + mw / 2,
        y: my + mh / 2,
        text: "The Palms Mall",
        rot: 0,
        kind: "poi",
        size: 9.5,
      },
    });
  }

  // Civic Plaza — paved square, a landmark tower, a fountain.
  {
    const { x0, x1, y0, y1 } = blockBox(PLAZA.col, PLAZA.row);
    const p = 11;
    const px = x0 + p;
    const py = y0 + p;
    const pw = x1 - x0 - 2 * p;
    const ph = y1 - y0 - 2 * p;
    plazas.push(roundRectD(px, py, pw, ph, 6));
    buildings.push({ x: px + pw - 50, y: py + 8, w: 42, h: 42, landmark: true });
    fountains.push({ cx: px + pw * 0.34, cy: py + ph * 0.62, r: 8.5 });
    labels.push({
      x: px + pw * 0.34,
      y: py + ph * 0.62 + 18,
      text: "Eko Hotel",
      rot: 0,
      kind: "poi",
      size: 8.5,
    });
  }

  // Greenwood Park — lawn, scattered trees, a pond + fountain.
  {
    const { x0, x1, y0, y1 } = blockBox(PARK.col, PARK.row);
    const p = 6;
    const gx = x0 + p;
    const gy = y0 + p;
    const gw = x1 - x0 - 2 * p;
    const gh = y1 - y0 - 2 * p;
    parks.push(roundRectD(gx, gy, gw, gh, 12));
    const pondCx = gx + gw * 0.5;
    const pondCy = gy + gh * 0.66;
    water.push(ellipseD(pondCx, pondCy, gw * 0.32, gh * 0.16));
    fountains.push({ cx: pondCx, cy: pondCy, r: 5.5 });
    for (let i = 0; i < 9; i++) {
      const tx = gx + 8 + rng() * (gw - 16);
      const ty = gy + 8 + rng() * (gh - 16);
      if (Math.hypot(tx - pondCx, ty - pondCy) < gw * 0.34) continue;
      trees.push({ cx: tx, cy: ty, r: 3.5 + rng() * 2 });
    }
    labels.push({
      x: gx + gw * 0.5,
      y: gy + gh * 0.2,
      text: "Freedom Park",
      rot: 0,
      kind: "park",
      size: 9,
    });
  }

  // Crescent Lake — water blob with a promenade ring.
  {
    const { x0, x1, y0, y1 } = blockBox(LAKE.col, LAKE.row);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = (x1 - x0) / 2 - 8;
    const ry = (y1 - y0) / 2 - 8;
    water.push(ellipseD(cx, cy, rx, ry));
    promenades.push(ellipseD(cx, cy, rx + 6, ry + 6));
    labels.push({
      x: cx,
      y: cy,
      text: "Lagos Lagoon",
      rot: 0,
      kind: "water",
      size: 9,
    });
  }

  // Roundabout island + fountain (no label — it sat on the avenue and crossed it).
  for (const rb of ROUNDABOUTS) {
    islands.push({ cx: rb.cx, cy: rb.cy, r: rb.r - 7 });
    fountains.push({ cx: rb.cx, cy: rb.cy, r: 9 });
  }

  // --- street name labels (Google-Maps style, on the road) ----------------
  const street = (x: number, y: number, text: string, rot: number, size = 8) =>
    labels.push({ x, y, text, rot, kind: "street", size });
  // one name per road, each on a clear stretch of its OWN line, spread apart so
  // no two labels cross. Avenues run vertically (rot -90), streets horizontally.
  street(300, 132, "Ahmadu Bello Way", -90, 9); // arterial, north of the roundabout
  street(132, 300, "Awolowo Rd", 0, 9); // arterial, west of the roundabout
  street(65, 240, "Bourdillon Rd", -90, 7);
  street(175, 470, "Akin Adesola St", -90, 7);
  street(425, 360, "Adeola Odeku St", -90, 7);
  street(535, 240, "Ozumba Mbadiwe Ave", -90, 7);
  street(360, 65, "Ribadu Rd", 0, 7);
  street(470, 175, "Kofo Abayomi St", 0, 7);
  street(255, 425, "Sanusi Fafunwa St", 0, 7);
  street(300, 535, "Adeyemo Alakija St", 0, 7);

  return {
    roads,
    buildings,
    malls,
    parks,
    plazas,
    water,
    promenades,
    trees,
    islands,
    fountains,
    labels,
  };
}

export const CITY: City = buildCity();

// ---------------------------------------------------------------------------
// Routable street graph
// ---------------------------------------------------------------------------
export type GEdge = { a: number; b: number; len: number; ring: boolean };
export type Graph = { nodes: Pt[]; edges: GEdge[]; adj: number[][] };

// Insert a vertex at every interior crossing between road polylines, so the
// graph builder (which only merges *coincident* vertices) actually connects
// roads that cross — e.g. the diagonal over the grid, the ring over its arms.
function planarize(roads: Pt[][]): Pt[][] {
  const EPS = 1e-6;
  const splits: { t: number; pt: Pt }[][][] = roads.map((r) =>
    r.slice(1).map(() => []),
  );
  for (let i = 0; i < roads.length; i++) {
    for (let si = 0; si < roads[i].length - 1; si++) {
      const p1 = roads[i][si];
      const p2 = roads[i][si + 1];
      const rX = p2.x - p1.x;
      const rY = p2.y - p1.y;
      for (let j = i + 1; j < roads.length; j++) {
        for (let sj = 0; sj < roads[j].length - 1; sj++) {
          const p3 = roads[j][sj];
          const p4 = roads[j][sj + 1];
          const sX = p4.x - p3.x;
          const sY = p4.y - p3.y;
          const denom = cross(rX, rY, sX, sY);
          if (Math.abs(denom) < 1e-9) continue;
          const qx = p3.x - p1.x;
          const qy = p3.y - p1.y;
          const t = cross(qx, qy, sX, sY) / denom;
          const u = cross(qx, qy, rX, rY) / denom;
          if (t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS) {
            const pt = { x: p1.x + t * rX, y: p1.y + t * rY };
            splits[i][si].push({ t, pt });
            splits[j][sj].push({ t: u, pt });
          }
        }
      }
    }
  }
  return roads.map((r, i) => {
    const pts: Pt[] = [];
    for (let si = 0; si < r.length - 1; si++) {
      pts.push(r[si]);
      for (const s of splits[i][si].slice().sort((a, b) => a.t - b.t)) pts.push(s.pt);
    }
    pts.push(r[r.length - 1]);
    return pts;
  });
}

function navRoads(): { pts: Pt[]; ring: boolean }[] {
  const out: { pts: Pt[]; ring: boolean }[] = [];
  for (const a of AVENUES) out.push({ pts: YS.map((y) => ({ x: a.v, y })), ring: false });
  for (const s of STREETS) out.push({ pts: XS.map((x) => ({ x, y: s.v })), ring: false });
  // 22 segments (not a multiple of 4) so no ring vertex lands exactly on the
  // N/S/E/W arterials — that would be a vertex-touch, which planarize skips,
  // leaving the ring unconnected and roads cutting through the island.
  for (const rb of ROUNDABOUTS) out.push({ pts: ringPts(rb.cx, rb.cy, rb.r, 22), ring: true });
  return out;
}

export function buildStreetGraph(): Graph {
  const input = navRoads();
  const planar = planarize(input.map((r) => r.pts));
  const ringFlag = input.map((r) => r.ring);

  // snap-merge coincident vertices into shared nodes
  const SNAP = 0.8;
  const nodes: Pt[] = [];
  const idOf = new Map<string, number>();
  const getId = (p: Pt) => {
    const k = `${Math.round(p.x / SNAP)},${Math.round(p.y / SNAP)}`;
    let id = idOf.get(k);
    if (id === undefined) {
      id = nodes.length;
      idOf.set(k, id);
      nodes.push({ x: p.x, y: p.y });
    }
    return id;
  };

  type E = { a: number; b: number; len: number; ring: boolean };
  const edges: E[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < planar.length; i++) {
    const pts = planar[i];
    for (let s = 0; s < pts.length - 1; s++) {
      const a = getId(pts[s]);
      const b = getId(pts[s + 1]);
      if (a === b) continue;
      const ek = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(ek)) continue;
      seen.add(ek);
      const len = Math.hypot(nodes[b].x - nodes[a].x, nodes[b].y - nodes[a].y);
      edges.push({ a, b, len, ring: ringFlag[i] });
    }
  }

  // Carve the roundabout interior: drop any non-ring edge whose midpoint sits
  // inside the circle, so cars route *around* the island, never through it.
  let kept = edges.filter((e) => {
    if (e.ring) return true;
    const mx = (nodes[e.a].x + nodes[e.b].x) / 2;
    const my = (nodes[e.a].y + nodes[e.b].y) / 2;
    return !ROUNDABOUTS.some((rb) => Math.hypot(mx - rb.cx, my - rb.cy) < rb.r - 1);
  });

  // Iteratively shave off dead ends (degree-1 nodes) so the navigator can never
  // be forced into a U-turn.
  for (;;) {
    const deg = new Array(nodes.length).fill(0);
    for (const e of kept) {
      deg[e.a]++;
      deg[e.b]++;
    }
    const next = kept.filter((e) => deg[e.a] > 1 && deg[e.b] > 1);
    if (next.length === kept.length) break;
    kept = next;
  }

  // Keep only the largest connected component.
  const adjAll: number[][] = nodes.map(() => []);
  kept.forEach((e, i) => {
    adjAll[e.a].push(i);
    adjAll[e.b].push(i);
  });
  const comp = new Int32Array(nodes.length).fill(-1);
  let best = -1;
  let bestSize = 0;
  let c = 0;
  for (let s = 0; s < nodes.length; s++) {
    if (comp[s] !== -1 || adjAll[s].length === 0) continue;
    let size = 0;
    const stack = [s];
    comp[s] = c;
    while (stack.length) {
      const n = stack.pop()!;
      size++;
      for (const ei of adjAll[n]) {
        const e = kept[ei];
        const o = e.a === n ? e.b : e.a;
        if (comp[o] === -1) {
          comp[o] = c;
          stack.push(o);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = c;
    }
    c++;
  }

  const edges2 = kept.filter((e) => comp[e.a] === best).map((e) => ({ a: e.a, b: e.b, len: e.len, ring: e.ring }));
  const adj: number[][] = nodes.map(() => []);
  edges2.forEach((e, i) => {
    adj[e.a].push(i);
    adj[e.b].push(i);
  });

  return { nodes, edges: edges2, adj };
}
