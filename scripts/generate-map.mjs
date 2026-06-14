import fs from "fs";

// Boston Public Garden + Common: lagoon (water), two parks (green),
// dense buildings, real streets.
const S = 42.3525, W = -71.0725, N = 42.358, E = -71.0645;

const q = `[out:json][timeout:60];
(
  way["highway"](${S},${W},${N},${E});
  way["building"](${S},${W},${N},${E});
  way["natural"="water"](${S},${W},${N},${E});
  way["waterway"="riverbank"](${S},${W},${N},${E});
  way["leisure"~"park|garden|pitch|playground|dog_park"](${S},${W},${N},${E});
  way["landuse"~"grass|forest|meadow|recreation_ground|cemetery|village_green"](${S},${W},${N},${E});
  relation["natural"="water"](${S},${W},${N},${E});
  relation["leisure"~"park|garden"](${S},${W},${N},${E});
);
out geom;`;

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function overpass(query) {
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "map-trail-demo/1.0 (svg basemap generator)",
          },
          body: "data=" + encodeURIComponent(query),
        });
        if (r.ok) return await r.json();
        console.error(`  try${attempt}`, url, "->", r.status);
      } catch (e) {
        console.error(`  try${attempt}`, url, "->", e.message);
      }
    }
    await sleep(4000 * (attempt + 1));
  }
  throw new Error("all Overpass endpoints failed");
}

const CACHE = "/tmp/osm-cache.json";
let data;
if (fs.existsSync(CACHE)) {
  data = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  console.error("using cached OSM data");
} else {
  data = await overpass(q);
  fs.writeFileSync(CACHE, JSON.stringify(data));
}
const els = data.elements || [];
console.error("elements:", els.length);

const midlat = (S + N) / 2;
const mLng = 111320 * Math.cos((midlat * Math.PI) / 180);
const mLat = 110540;
const widthM = (E - W) * mLng, heightM = (N - S) * mLat;
const SIZE = 600;
const scale = SIZE / Math.min(widthM, heightM); // cover the square
const offX = (SIZE - widthM * scale) / 2;
const offY = (SIZE - heightM * scale) / 2;
const projX = (lng) => offX + (lng - W) * mLng * scale;
const projY = (lat) => offY + (N - lat) * mLat * scale;
const toPath = (g) =>
  "M " + g.map((p) => `${projX(p.lon).toFixed(1)} ${projY(p.lat).toFixed(1)}`).join(" L ");

const layers = { water: [], green: [], building: [], road: [], path: [] };
const roadWidth = (t) =>
  ({ motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, residential: 4, unclassified: 4, living_street: 4, service: 3 }[t] || 4);

function addWay(geom, tags) {
  if (!geom || geom.length < 2) return;
  const t = tags || {};
  if (t.natural === "water" || t.waterway === "riverbank" || t.water)
    layers.water.push(toPath(geom) + " Z");
  else if ((t.leisure && /park|garden|pitch|playground|dog_park/.test(t.leisure)) ||
           (t.landuse && /grass|forest|meadow|recreation_ground|cemetery|village_green/.test(t.landuse)))
    layers.green.push(toPath(geom) + " Z");
  else if (t.building) layers.building.push(toPath(geom) + " Z");
  else if (t.highway) {
    if (/footway|path|cycleway|steps|pedestrian|track/.test(t.highway)) layers.path.push(toPath(geom));
    else layers.road.push({ d: toPath(geom), w: roadWidth(t.highway) });
  }
}

const roads = [];
const wayLen = (g) => {
  let L = 0;
  for (let i = 1; i < g.length; i++) {
    const dx = (g[i].lon - g[i - 1].lon) * mLng, dy = (g[i].lat - g[i - 1].lat) * mLat;
    L += Math.hypot(dx, dy);
  }
  return L;
};

for (const el of els) {
  if (el.type === "way" && el.geometry) {
    addWay(el.geometry, el.tags);
    const t = el.tags || {};
    if (t.highway && !/footway|path|cycleway|steps|pedestrian|track|service/.test(t.highway))
      roads.push(el);
  } else if (el.type === "relation" && el.members) {
    for (const m of el.members) if (m.geometry) addWay(m.geometry, el.tags);
  }
}

// Group road segments by name; pick the longest, central, named road.
const byName = new Map();
for (const el of roads) {
  const nm = el.tags.name;
  if (!nm) continue;
  if (!byName.has(nm)) byName.set(nm, []);
  byName.get(nm).push(el);
}
const nameStats = [...byName.entries()].map(([nm, segs]) => {
  const len = segs.reduce((s, e) => s + wayLen(e.geometry), 0);
  const mids = segs.map((e) => e.geometry[Math.floor(e.geometry.length / 2)]);
  const dc = mids.reduce((s, m) => s + Math.hypot(projX(m.lon) - 300, projY(m.lat) - 300), 0) / mids.length;
  return { nm, segs, len, dc, score: len - 2.4 * dc };
});
nameStats.sort((a, b) => b.score - a.score);
console.error("top roads:", nameStats.slice(0, 10).map((s) => `${s.nm} ${Math.round(s.len)}m d${Math.round(s.dc)}`));

// Stitch a road's segments (they share endpoint nodes) into one polyline.
const key = (p) => `${p.lat},${p.lon}`;
function stitch(segs) {
  const rem = segs.map((e) => e.geometry.slice());
  let line = rem.shift();
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < rem.length; i++) {
      const s = rem[i], h = line[0], t = line[line.length - 1];
      if (key(t) === key(s[0])) line = line.concat(s.slice(1));
      else if (key(t) === key(s[s.length - 1])) line = line.concat(s.slice(0, -1).reverse());
      else if (key(h) === key(s[s.length - 1])) line = s.slice(0, -1).concat(line);
      else if (key(h) === key(s[0])) line = s.slice(1).reverse().concat(line);
      else continue;
      rem.splice(i, 1);
      changed = true;
      break;
    }
  }
  return line;
}
const routeLine = stitch(nameStats[0].segs);
const ROUTE_NAME = nameStats[0].nm;
// Out-and-back closed loop → comet/heading stay correct and it loops seamlessly.
const fwd = routeLine.map((p) => `${projX(p.lon).toFixed(1)} ${projY(p.lat).toFixed(1)}`);
const ROUTE_D = "M " + fwd.concat([...fwd].reverse().slice(1)).join(" L ") + " Z";
console.error("route:", ROUTE_NAME, "segs", nameStats[0].segs.length, "pts", routeLine.length);

let svg = "";
svg += `<rect x="0" y="0" width="600" height="600" fill="#ecebe5"/>`;
svg += layers.green.map((d) => `<path d="${d}" fill="#c8e4ad" fill-rule="evenodd"/>`).join("");
svg += layers.water.map((d) => `<path d="${d}" fill="#a6d2e3" stroke="#8fc3d8" stroke-width="0.8" fill-rule="evenodd"/>`).join("");
svg += layers.building.map((d) => `<path d="${d}" fill="#e2dbd0" stroke="#d2cabd" stroke-width="0.5"/>`).join("");
svg += layers.path.map((d) => `<path d="${d}" fill="none" stroke="#e8dfd0" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2.5 2.5"/>`).join("");
svg += layers.road.map((r) => `<path d="${r.d}" fill="none" stroke="#e4ddcd" stroke-width="${r.w + 3}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
svg += layers.road.map((r) => `<path d="${r.d}" fill="none" stroke="#ffffff" stroke-width="${r.w}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");

const out =
  `/* eslint-disable */\n` +
  `// Auto-generated ONCE from OpenStreetMap (Overpass) — Boston Public Garden / Common.\n` +
  `// Baked static SVG; no runtime API. Regenerate via /tmp/genmap.mjs.\n` +
  `export const MAP_SVG = ${JSON.stringify(svg)};\n` +
  `export const ROUTE_D = ${JSON.stringify(ROUTE_D)};\n` +
  `export const ROUTE_NAME = ${JSON.stringify(ROUTE_NAME)};\n`;
fs.writeFileSync("/Users/ayotomiwa/Documents/my-app/src/app/map-trail/mapData.ts", out);
console.error("counts:", { water: layers.water.length, green: layers.green.length, building: layers.building.length, road: layers.road.length, path: layers.path.length });
console.error("svg bytes:", svg.length);
