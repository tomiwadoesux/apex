// Quick offline validation of the street graph.
// Run: node --experimental-strip-types scripts/test-city.ts
import { buildStreetGraph, CITY, ROUNDABOUTS } from "../src/app/map-trail/city.ts";

const g = buildStreetGraph();
const deg = new Array(g.nodes.length).fill(0);
for (const e of g.edges) {
  deg[e.a]++;
  deg[e.b]++;
}
const used = g.adj.map((a) => a.length > 0);
const degs = deg.filter((_, i) => used[i]);
const dead = degs.filter((d) => d === 1).length;
const min = Math.min(...degs);
const max = Math.max(...degs);

// connectivity check over the returned edges
const seen = new Set<number>();
let start = g.edges[0]?.a ?? 0;
const stack = [start];
seen.add(start);
while (stack.length) {
  const n = stack.pop()!;
  for (const ei of g.adj[n]) {
    const e = g.edges[ei];
    const o = e.a === n ? e.b : e.a;
    if (!seen.has(o)) {
      seen.add(o);
      stack.push(o);
    }
  }
}
const reachable = seen.size;
const totalUsed = used.filter(Boolean).length;

// does any edge pass through a roundabout interior? sample along the segment,
// not just the midpoint (a road straight through the center has its midpoint AT
// the center, but a half-arm's midpoint is outside — so sample densely).
let throughRing = 0;
for (const e of g.edges) {
  for (let s = 1; s < 10; s++) {
    const t = s / 10;
    const x = g.nodes[e.a].x + (g.nodes[e.b].x - g.nodes[e.a].x) * t;
    const y = g.nodes[e.a].y + (g.nodes[e.b].y - g.nodes[e.a].y) * t;
    if (ROUNDABOUTS.some((rb) => Math.hypot(x - rb.cx, y - rb.cy) < rb.r - 3)) {
      throughRing++;
      break;
    }
  }
}
// ring must be wired into the live network
const ringNodes = g.nodes.filter(
  (n, i) => used[i] && ROUNDABOUTS.some((rb) => Math.abs(Math.hypot(n.x - rb.cx, n.y - rb.cy) - rb.r) < 2),
).length;

console.log("nodes(used):", totalUsed, "edges:", g.edges.length);
console.log("degree min/max:", min, max, " dead-ends(deg1):", dead);
console.log("connected:", reachable, "/", totalUsed, reachable === totalUsed ? "OK" : "FAIL");
console.log("edges through roundabout interior:", throughRing, throughRing === 0 ? "OK" : "FAIL");
console.log("ring nodes wired into network:", ringNodes, ringNodes >= 6 ? "OK" : "FAIL");
console.log(
  "render: roads",
  CITY.roads.length,
  "buildings",
  CITY.buildings.length,
  "labels",
  CITY.labels.length,
  "fountains",
  CITY.fountains.length,
);
