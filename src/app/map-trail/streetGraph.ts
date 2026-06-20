// Drives a believable, rule-following self-driving walk over the Apex District
// street graph (built in city.ts): bounded steering (no instant snaps/U-turns),
// commit-before-turning, prefer the straightest continuation, slow into turns,
// and avoid short loops. Because the graph has no dead ends, the navigator never
// has to turn back — it just keeps flowing through intersections, like traffic.

import { buildStreetGraph, CANVAS, type Graph } from "./city";

type Pt = { x: number; y: number };

const RECENT = 14; // remember the last N edges to avoid short circles

export type Navigator = {
  start: Pt;
  startDir: Pt; // unit vector of the first segment
  advance: (dist: number) => { x: number; y: number; angle: number };
};

// --- steering feel ----------------------------------------------------------
const MIN_COMMIT = 26; // units to drive after a turn before turning again
const STRAIGHT_DEG = 30; // |turn| under this counts as "going straight"
const MAX_TURN_DEG = 120; // never take a turn sharper than this (unless forced)
const TURN_RATE = 12; // max degrees the heading eases per unit travelled
const MARGIN = 120; // keep starts (and bias steering) inside the framed area (~half of VIEW)

export function createNavigator(): Navigator | null {
  const graph: Graph = buildStreetGraph();
  const { nodes, edges, adj } = graph;
  if (!edges.length) return null;

  // seeded fresh each load so the drive differs every visit
  let seed = (Math.random() * 0x100000000) >>> 0;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const recent: number[] = [];
  const remember = (eid: number) => {
    recent.push(eid);
    if (recent.length > RECENT) recent.shift();
  };
  const other = (eid: number, from: number) =>
    edges[eid].a === from ? edges[eid].b : edges[eid].a;
  const headingOf = (eid: number, from: number) => {
    const o = other(eid, from);
    return (Math.atan2(nodes[o].y - nodes[from].y, nodes[o].x - nodes[from].x) * 180) / Math.PI;
  };
  // 0 = same direction, 180 = a full reverse
  const turnBetween = (aDeg: number, bDeg: number) =>
    Math.abs(((aDeg - bDeg + 540) % 360) - 180);

  const inView = (n: number) =>
    nodes[n].x >= MARGIN &&
    nodes[n].x <= CANVAS - MARGIN &&
    nodes[n].y >= MARGIN &&
    nodes[n].y <= CANVAS - MARGIN;

  // Choose which edge to leave `at` by, having arrived via `arrived` (heading
  // `inDeg`). Rules: no instant reverse; reject hairpins; keep straight until
  // committed; bias toward the straightest, fresh, in-bounds continuation.
  const chooseEdge = (
    at: number,
    arrived: number,
    inDeg: number,
    committed: boolean,
  ): { eid: number; turn: number } => {
    const opts = (adj[at] ?? []).filter((e) => e !== arrived);
    if (!opts.length) return { eid: arrived, turn: 180 }; // (shouldn't happen — no dead ends)
    const scored = opts.map((eid) => ({ eid, turn: turnBetween(headingOf(eid, at), inDeg) }));
    let allowed = scored.filter((s) => s.turn <= MAX_TURN_DEG);
    if (!allowed.length) allowed = scored;
    // Roundabout discipline: the moment we're driving ON the ring, leave by the
    // first usable EXIT (a non-ring road) rather than staying on it. Without this
    // the "prefer-straight / commit-before-turning" rules treat going around the
    // island as the straight option and the marker can lap it forever (it gets
    // "stuck in the roundabout"). Off the ring, keep the normal commit-to-straight.
    const onRing = edges[arrived]?.ring;
    if (onRing) {
      const exits = allowed.filter((s) => !edges[s.eid].ring);
      if (exits.length) allowed = exits;
    } else if (!committed) {
      const straight = allowed.filter((s) => s.turn <= STRAIGHT_DEG);
      if (straight.length) allowed = straight;
    }
    const weight = (s: { eid: number; turn: number }) =>
      Math.pow(1 - s.turn / 180, 3) *
        (recent.includes(s.eid) ? 0.1 : 1) *
        (inView(other(s.eid, at)) ? 1 : 0.04) +
      1e-4;
    let total = 0;
    for (const s of allowed) total += weight(s);
    let r = rng() * total;
    let chosen = allowed[0];
    for (const s of allowed) {
      r -= weight(s);
      if (r <= 0) {
        chosen = s;
        break;
      }
    }
    return chosen;
  };

  // Start anywhere on an in-view road, length-weighted, so the opening frame is
  // always filled with map.
  const pool: number[] = [];
  for (let ei = 0; ei < edges.length; ei++) {
    if (inView(edges[ei].a) && inView(edges[ei].b)) pool.push(ei);
  }
  const starts = pool.length ? pool : edges.map((_, i) => i);
  let totalLen = 0;
  for (const ei of starts) totalLen += edges[ei].len;
  let pick = rng() * totalLen;
  let curEdge = starts[starts.length - 1];
  for (const ei of starts) {
    pick -= edges[ei].len;
    if (pick <= 0) {
      curEdge = ei;
      break;
    }
  }

  let curNode = edges[curEdge].a; // travelling toward edge.b
  remember(curEdge);
  let prog = rng() * edges[curEdge].len;
  let sinceTurn = MIN_COMMIT;

  let heading = headingOf(curEdge, curNode);
  const startDir = {
    x: Math.cos((heading * Math.PI) / 180),
    y: Math.sin((heading * Math.PI) / 180),
  };
  const sA = nodes[curNode];
  const sB = nodes[other(curEdge, curNode)];
  const sT = edges[curEdge].len > 0 ? prog / edges[curEdge].len : 0;
  const start = { x: sA.x + (sB.x - sA.x) * sT, y: sA.y + (sB.y - sA.y) * sT };

  const advance = (dist: number) => {
    // Ease off the throttle while the facing is still catching up to the road.
    const misalign = turnBetween(heading, headingOf(curEdge, curNode));
    const speedScale = 0.45 + 0.55 * Math.max(0, Math.cos((misalign * Math.PI) / 180));
    const moved = dist * speedScale;
    sinceTurn += moved;

    let remaining = moved;
    for (let guard = 0; guard < 10000; guard++) {
      const e = edges[curEdge];
      if (prog + remaining < e.len) {
        prog += remaining;
        break;
      }
      remaining -= e.len - prog;
      const arriveNode = other(curEdge, curNode);
      const inDeg = headingOf(curEdge, curNode);
      const choice = chooseEdge(arriveNode, curEdge, inDeg, sinceTurn >= MIN_COMMIT);
      curNode = arriveNode;
      curEdge = choice.eid;
      remember(curEdge);
      if (choice.turn > STRAIGHT_DEG) sinceTurn = 0;
      prog = 0;
    }

    // Ease the facing toward the road direction, bounded per distance moved.
    const target = headingOf(curEdge, curNode);
    const maxStep = TURN_RATE * moved;
    const dh = ((target - heading + 540) % 360) - 180;
    heading += Math.abs(dh) <= maxStep ? dh : Math.sign(dh) * maxStep;
    heading = ((heading % 360) + 360) % 360;

    const A = nodes[curNode];
    const B = nodes[other(curEdge, curNode)];
    const e = edges[curEdge];
    const t = e.len > 0 ? prog / e.len : 0;
    return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, angle: heading };
  };

  return { start, startDir, advance };
}
