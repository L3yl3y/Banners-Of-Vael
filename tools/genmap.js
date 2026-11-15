const { Delaunay } = require("d3-delaunay");
const fs = require("fs");
const path = require("path");
const seeds = require("./seeds.js");

const box = seeds.box;
const sites = [];
for (const a of seeds.land) {
  sites.push(Object.assign({ type: "land" }, a));
}
for (const a of seeds.sea) {
  sites.push(Object.assign({ type: "sea" }, a));
}

const delaunay = Delaunay.from(sites.map(s => [s.x, s.y]));
const voronoi = delaunay.voronoi(box);

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let s = seed || 1;
  return function () {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function samePoint(p, q) {
  return Math.abs(p[0] - q[0]) < 0.01 && Math.abs(p[1] - q[1]) < 0.01;
}

function noisyLine(a, b, key, rough) {
  let flip = false;
  let p0 = a;
  let p1 = b;
  if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) {
    p0 = b;
    p1 = a;
    flip = true;
  }
  const rng = makeRng(hashString(key));
  let points = [p0, p1];
  for (let level = 0; level < 4; level++) {
    const next = [points[0]];
    for (let k = 0; k < points.length - 1; k++) {
      const p = points[k];
      const q = points[k + 1];
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy);
      const offset = (rng() * 2 - 1) * len * rough;
      const mid = [(p[0] + q[0]) / 2 - dy / len * offset, (p[1] + q[1]) / 2 + dx / len * offset];
      next.push(mid, q);
    }
    points = next;
  }
  if (flip) {
    points.reverse();
  }
  return points;
}

const polys = [];
for (let i = 0; i < sites.length; i++) {
  polys.push(voronoi.cellPolygon(i));
}

const adjacency = {};
const edges = [];
for (const s of sites) {
  adjacency[s.id] = [];
}

const cellPaths = [];
for (let i = 0; i < sites.length; i++) {
  const poly = polys[i];
  const outline = [];
  for (let k = 0; k < poly.length - 1; k++) {
    const a = poly[k];
    const b = poly[k + 1];
    let neighbour = -1;
    for (const j of voronoi.neighbors(i)) {
      const other = polys[j];
      let hasA = false;
      let hasB = false;
      for (const p of other) {
        if (samePoint(p, a)) {
          hasA = true;
        }
        if (samePoint(p, b)) {
          hasB = true;
        }
      }
      if (hasA && hasB) {
        neighbour = j;
      }
    }
    let segment = [a, b];
    if (neighbour >= 0) {
      const s1 = sites[i];
      const s2 = sites[neighbour];
      let kind = "border";
      let rough = 0.13;
      if (s1.type !== s2.type) {
        kind = "coast";
        rough = 0.2;
      } else if (s1.type === "sea") {
        kind = "seaborder";
        rough = 0.07;
      }
      const ids = [s1.id, s2.id].sort();
      segment = noisyLine(a, b, ids.join("|"), rough);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (i < neighbour && len > 8) {
        adjacency[s1.id].push(s2.id);
        adjacency[s2.id].push(s1.id);
        edges.push({ a: s1.id, b: s2.id, kind: kind, points: segment.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]) });
      }
    }
    for (let m = 0; m < segment.length - 1; m++) {
      outline.push(segment[m]);
    }
  }
  cellPaths.push(outline.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]));
}

function centroid(points) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < points.length; k++) {
    const p = points[k];
    const q = points[(k + 1) % points.length];
    const cross = p[0] * q[1] - q[0] * p[1];
    area += cross;
    cx += (p[0] + q[0]) * cross;
    cy += (p[1] + q[1]) * cross;
  }
  area = area / 2;
  return [cx / (6 * area), cy / (6 * area)];
}

const areas = sites.map((s, i) => {
  const c = centroid(cellPaths[i]);
  let ax = Math.round((s.x + c[0]) / 2);
  let ay = Math.round((s.y + c[1]) / 2);
  if (s.type === "sea") {
    ay = Math.min(ay, 822);
    ax = Math.max(70, Math.min(1130, ax));
  }
  const area = {
    id: s.id,
    name: s.name,
    type: s.type,
    x: ax,
    y: ay,
    poly: cellPaths[i]
  };
  if (s.type === "land") {
    area.castle = s.castle;
    area.barrels = s.barrels;
    area.crowns = s.crowns;
    area.home = s.home || null;
    area.garrison = s.garrison || 0;
    area.neutral = s.neutral || 0;
  }
  return area;
});

for (const id in adjacency) {
  adjacency[id].sort();
}

const out = { width: box[2], height: box[3], top: box[1], areas: areas, adjacency: adjacency, edges: edges };
const text = "var MAP_DATA = " + JSON.stringify(out) + ";\nif (typeof module !== \"undefined\") {\n  module.exports = MAP_DATA;\n}\n";
fs.writeFileSync(path.join(__dirname, "..", "src", "mapdata.js"), text);

for (const id in adjacency) {
  const site = sites.find(s => s.id === id);
  console.log(site.type.padEnd(5), id.padEnd(13), adjacency[id].join(", "));
}
