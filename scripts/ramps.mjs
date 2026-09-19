// Regenerates the sequential ramps in lib/scale.ts: one per button in the top
// bar, a single hue stepped down in lightness, matching the reference blue
// ramp's band and step size so all seven read as one family. Meat is one
// button over three sectors, which is why there are seven ramps here and nine
// files in public/data.
//
// Run with: pnpm ramps
// Then paste the output into LIGHT_RAMPS and re-run the palette validator.
const STEPS = 7;

// Low is pale, high is dark and saturated. The band and chroma envelope are
// the validated blue ramp's own.
const LIGHT = {
  from: 0.905,
  to: 0.338,
  chroma: [0.041, 0.079, 0.118, 0.161, 0.150, 0.128, 0.103],
};


function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
const inGamut = ([r, g, b]) => [r, g, b].every((v) => v >= -0.0005 && v <= 1.0005);
function gamma(v) {
  v = Math.min(1, Math.max(0, v));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}
const hex = (L, C, h) =>
  "#" + oklchToRgb(L, C, h).map((v) => Math.round(gamma(v) * 255).toString(16).padStart(2, "0")).join("");

/** Largest chroma that still fits in sRGB at this lightness and hue. */
function maxChroma(L, h) {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb(L, mid, h))) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * Every hue follows the same chroma envelope rather than a share of its own
 * gamut, because red and magenta can carry far more chroma than blue and
 * taking a fraction of each hue's maximum would make one ramp shout and
 * another whisper.
 */
function buildRamp(hue, band) {
  const out = [];
  for (let i = 0; i < STEPS; i += 1) {
    const L = band.from + ((band.to - band.from) * i) / (STEPS - 1);
    const C = Math.min(band.chroma[i], maxChroma(L, hue) * 0.92);
    out.push(hex(L, C, hue));
  }
  return out;
}

const SECTORS = {
  meat: 15, fruit: 40, cereal: 92, "olive-oil": 128, vegetables: 155,
  milk: 250, wine: 320,
};
// One set, used in both themes: pale for the cheapest, dark for the dearest.
for (const [id, hue] of Object.entries(SECTORS)) {
  console.log(`${id}\t${buildRamp(hue, LIGHT).join(",")}`);
}
