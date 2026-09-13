// Regenerates public/data/borders.json: the outline of every country the
// price data covers, simplified enough to ship and to repaint on every frame
// of the timeline.
//
// Run with: pnpm sync:borders
import { writeFile } from "node:fs/promises";

const GISCO =
  "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2024_4326_LEVL_0.geojson";
// ~2 km. The smallest thing on the map is a country, so finer detail is only
// weight: it cannot change which shape a click lands in.
const TOLERANCE = 0.02;
const DECIMALS = 3;
// Rings smaller than this are dropped: at the zoom a whole continent needs,
// they are sub-pixel. Malta and Cyprus are whole countries, so they are
// exempt and keep every ring they have.
const MIN_AREA = 0.01;
const KEEP_EVERY_RING = new Set(["MT", "CY", "LU"]);

/** Douglas-Peucker, iterative so a long coastline cannot blow the stack. */
function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return ring;
  const keep = new Array(ring.length).fill(false);
  keep[0] = true;
  keep[ring.length - 1] = true;
  const segments = [[0, ring.length - 1]];
  while (segments.length > 0) {
    const [first, last] = segments.pop();
    let furthest = -1;
    let maxDistance = 0;
    const [x1, y1] = ring[first];
    const [x2, y2] = ring[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    for (let index = first + 1; index < last; index += 1) {
      const [x0, y0] = ring[index];
      const distance = length
        ? Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / length
        : Math.hypot(x0 - x1, y0 - y1);
      if (distance > maxDistance) {
        maxDistance = distance;
        furthest = index;
      }
    }
    if (furthest !== -1 && maxDistance > tolerance) {
      keep[furthest] = true;
      segments.push([first, furthest], [furthest, last]);
    }
  }
  return ring.filter((_, index) => keep[index]);
}

/** Shoelace, unsigned. Degrees squared, which is all the threshold needs. */
function ringArea(ring) {
  let total = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    total += x1 * y2 - x2 * y1;
  }
  return Math.abs(total) / 2;
}

const response = await fetch(GISCO, {
  headers: { "User-Agent": "food-prices (personal project)" },
  signal: AbortSignal.timeout(180_000),
});
if (!response.ok) throw new Error(`GISCO responded with ${response.status}`);
const countries = await response.json();

const features = [];
for (const feature of countries.features) {
  const code = feature.properties?.NUTS_ID;
  if (!code) continue;
  const geometry = feature.geometry;
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  const kept = [];
  for (const polygon of polygons) {
    // Only the outer ring: no country here has a hole worth 2 km of detail.
    const outer = simplifyRing(polygon[0], TOLERANCE).map(([lon, lat]) => [
      Number(lon.toFixed(DECIMALS)),
      Number(lat.toFixed(DECIMALS)),
    ]);
    if (outer.length < 4) continue;
    if (!KEEP_EVERY_RING.has(code) && ringArea(outer) < MIN_AREA) continue;
    kept.push([outer]);
  }
  if (kept.length === 0) continue;

  features.push({
    type: "Feature",
    properties: { code, name: feature.properties.NAME_ENGL },
    geometry: { type: "MultiPolygon", coordinates: kept },
  });
}

features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));

const target = new URL("../public/data/borders.json", import.meta.url);
await writeFile(
  target,
  `${JSON.stringify({ type: "FeatureCollection", features })}\n`,
);

const points = features.reduce(
  (total, feature) =>
    total +
    feature.geometry.coordinates.reduce((sum, poly) => sum + poly[0].length, 0),
  0,
);
console.log(`borders.json: ${features.length} countries, ${points} points`);
