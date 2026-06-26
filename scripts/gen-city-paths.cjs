// One-off generator: extract the four landmark silhouettes from the overlay SVG
// and emit src/components/city/cityPaths.ts (paths + their vertical extents).
const fs = require("fs");
const svg = fs.readFileSync("public/images/city-overlay.svg", "utf8");

const grab = (re) => {
  const m = svg.match(re);
  return m ? m[1] : null;
};
const shapes = {
  BILLBOARD: grab(/<g id="BILLBOARD[\s\S]*?<path d="([^"]+)" fill="#D9D9D9"/),
  LAGOS: grab(/<g id="LAGOS">[\s\S]*?<path d="([^"]+)" fill="#D9D9D9"/),
  BRIDGE: grab(/id="BRIDGE"[\s\S]*?\bd="([^"]+)"/),
  ABUJA: grab(/id="ABUJA"\s+d="([^"]+)"/),
};

// Minimal path walker → x/y bounding extents, enough for the reveal wipe rects.
function bounds(d) {
  const t = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?\d+(?:\.\d+)?/g) || [];
  let x = 0, y = 0, cmd = "", k = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const num = (i) => parseFloat(t[i]);
  while (k < t.length) {
    const tok = t[k];
    if (/[A-Za-z]/.test(tok)) { cmd = tok; k++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "M" || C === "L" || C === "T") { x = rel ? x + num(k) : num(k); y = rel ? y + num(k + 1) : num(k + 1); k += 2; }
    else if (C === "H") { x = rel ? x + num(k) : num(k); k += 1; }
    else if (C === "V") { y = rel ? y + num(k) : num(k); k += 1; }
    else if (C === "C") { x = rel ? x + num(k + 4) : num(k + 4); y = rel ? y + num(k + 5) : num(k + 5); k += 6; }
    else if (C === "S" || C === "Q") { x = rel ? x + num(k + 2) : num(k + 2); y = rel ? y + num(k + 3) : num(k + 3); k += 4; }
    else if (C === "A") { x = rel ? x + num(k + 5) : num(k + 5); y = rel ? y + num(k + 6) : num(k + 6); k += 7; }
    else { k++; continue; }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const r = (n) => Math.round(n * 10) / 10;
  return { x: [r(minX), r(maxX)], y: [r(minY), r(maxY)] };
}

const xr = {}, yr = {};
for (const [k, v] of Object.entries(shapes)) {
  if (!v) { console.error("MISSING " + k); process.exit(1); }
  const b = bounds(v);
  xr[k] = b.x;
  yr[k] = b.y;
  console.error(k + "  len=" + v.length + "  x=" + JSON.stringify(b.x) + "  y=" + JSON.stringify(b.y));
}

const lines = [];
lines.push("// AUTO-GENERATED from public/images/city-overlay.svg by scripts/gen-city-paths.cjs.");
lines.push("// The four landmark silhouettes (userSpace 2688x1520) used as reveal clips,");
lines.push("// plus each shape's [leftX, rightX] and [topY, bottomY] bounding extents.");
for (const [k, v] of Object.entries(shapes)) {
  lines.push("export const " + k + " = " + JSON.stringify(v) + ";");
}
lines.push("export const X_RANGE = " + JSON.stringify(xr) + ";");
lines.push("export const Y_RANGE = " + JSON.stringify(yr) + ";");
fs.writeFileSync("src/components/city/cityPaths.ts", lines.join("\n") + "\n");
console.error("WROTE src/components/city/cityPaths.ts");
