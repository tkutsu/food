/**
 * Colouring the map. One hue per button in the top bar, light to dark,
 * because the thing being shown is a magnitude: a price. Keyed by the button
 * rather than the sector, which is the same thing everywhere except meat,
 * where beef, pork and lamb share one.
 *
 * Every ramp is the same object as the validated sequential blue, moved to a
 * different hue: the same lightness band (0.905 down to 0.338 in OKLCH, even
 * steps) and the same chroma envelope (0.041 rising to 0.161 and easing back),
 * clamped where a hue cannot reach it in sRGB. Matching the envelope rather
 * than taking a share of each hue's gamut is what keeps them a family; red and
 * magenta can carry far more chroma than blue, and a share of maximum would
 * make one ramp shout while another whispered.
 *
 * All seven pass the sequential gates: monotone lightness, adjacent lightness
 * gaps of at least 0.06, hue spread under three degrees. Regenerate with
 * `pnpm ramps`.
 *
 * One set for both themes. Light is cheap and dark is dear, on paper and on
 * the dark page alike, because that is how people read a colour scale and a
 * legend that inverts when the theme changes has to be relearned. An earlier
 * version gave dark mode its own ramps running from near-black to bright; it
 * followed a textbook rule about the low end receding into the surface, and
 * read as backwards to the person actually looking at it.
 */

/** Low to high: pale for the cheapest country, dark for the dearest. */
const RAMPS: Record<string, readonly string[]> = {
  "olive-oil": ["#d8e5c9", "#b2cb94", "#8eb15e", "#6c971f", "#557816", "#3f5b0e", "#2b3f06"],
  fruit: ["#f9d7cc", "#eeb09b", "#e28969", "#d45d31", "#af4419", "#87310d", "#602005"],
  vegetables: ["#cbe8d4", "#98d1ab", "#60b983", "#249f5f", "#1a7f4b", "#116037", "#084325"],
  meat: ["#fad5d7", "#f0adb1", "#e3838b", "#d55667", "#b03d4e", "#882a39", "#621a26"],
  milk: ["#cce2fb", "#9ac6f3", "#67a8ea", "#238ae3", "#186eb6", "#0f528c", "#073963"],
  cereal: ["#e9dfc2", "#d3c086", "#bea142", "#a0841f", "#806816", "#614f0e", "#433606"],
  wine: ["#ecd7f1", "#d8b1e1", "#c48ad1", "#b062c2", "#9049a0", "#6e347b", "#4e2258"],
};

export const BIN_COUNT = RAMPS.milk.length;

/** Countries that reported nothing this month, told apart from any price. */
export const NO_DATA_FILL = "#898781";

export function ramp(groupId: string): readonly string[] {
  return RAMPS[groupId] ?? RAMPS.milk;
}

/**
 * The button's colour for the furniture that is not the map: the active
 * button, the tickboxes, the slider, and the panel's line. The fifth step of
 * its ramp, which carries the light paper colour as text at 4.5:1 or better
 * for every one of them, in either theme.
 */
export function groupAccent(groupId: string): string {
  return ramp(groupId)[4];
}

/** Text that sits on the accent. Fixed, because the accent does not change. */
export const ACCENT_INK = "#f4f3ee";

export interface Scale {
  /** Up to `BIN_COUNT - 1` boundaries between bins, ascending and distinct. */
  breaks: number[];
  min: number;
  max: number;
}

/** The value at `fraction` through the sorted list, interpolating between. */
function quantile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * Cuts the ramp at the quantiles of the values on screen, so each colour
 * carries roughly the same number of countries and all seven get used.
 *
 * Even-width bins do not survive this data. Extra virgin olive oil runs 1.50
 * to 9.65 euro a kilo in the four countries that press it at scale, and 27.44
 * to 29.34 in Malta, which reports something closer to a shop price; even
 * widths put the whole olive oil economy in two shades. The spread that
 * matters is the one inside the crowd.
 */
export function buildScale(values: readonly number[]): Scale | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);

  const breaks: number[] = [];
  for (let bin = 1; bin < BIN_COUNT; bin += 1) {
    const value = quantile(sorted, bin / BIN_COUNT);
    // A month flat enough to repeat a quantile would otherwise get a bin no
    // value can fall in, and a colour nothing ever wears.
    if (breaks.length === 0 || value > breaks[breaks.length - 1]) {
      breaks.push(value);
    }
  }
  return { breaks, min: sorted[0], max: sorted[sorted.length - 1] };
}

/** Which bin a price falls in; values past either end clamp to the ends. */
export function binOf(value: number, scale: Scale): number {
  let bin = 0;
  while (bin < scale.breaks.length && value >= scale.breaks[bin]) bin += 1;
  return bin;
}

export function colorFor(
  value: number | null | undefined,
  scale: Scale | null,
  groupId: string,
): string {
  if (value === null || value === undefined || !scale) return NO_DATA_FILL;
  return ramp(groupId)[binOf(value, scale)];
}

/**
 * A kilo of cereals and a kilo of olive oil are two orders of magnitude
 * apart, so the number of decimals has to follow the size of the thing. Two
 * decimals on a 15 cent price throws away the digits that tell one country
 * from another.
 */
export function formatPrice(value: number): string {
  if (value >= 100) return `€${Math.round(value).toLocaleString("en-GB")}`;
  if (value >= 10) return `€${value.toFixed(1)}`;
  if (value >= 1) return `€${value.toFixed(2)}`;
  return `€${value.toFixed(3)}`;
}

/**
 * A price as a share of a median income. Eurostat publishes the income a year
 * at a time, so a month takes its own year's figure, or the most recent one
 * published before it. Its survey year reports the year before it, so the
 * income trails the price it is dividing by roughly a year.
 */
export function incomeFor(
  byYear: Record<string, number> | undefined,
  month: string,
): number | null {
  if (!byYear) return null;
  const year = Number(month.slice(0, 4));
  for (let candidate = year; candidate >= year - 6; candidate -= 1) {
    const value = byYear[String(candidate)];
    if (typeof value === "number") return value;
  }
  return null;
}

/**
 * Days of a median income, which is what the normalised map colours by.
 * Calendar days of a whole year's income, not working days of a wage.
 *
 * Both sides are in euro at the market rate, and they stay that way. Eurostat
 * also publishes the income in purchasing power standards, and dividing by
 * that instead multiplies every country's answer by its own price level:
 * a PPS income is an income already divided by a basket of prices that food
 * is a large part of, so a food price over it counts the same thing twice and
 * flattens exactly the gap the map exists to show. Euro over euro is already
 * a real ratio.
 */
export function asDaysOfIncome(price: number, income: number): number {
  return (price / income) * 365;
}

export type IncomeUnit = "minutes" | "hours" | "days";

/**
 * A kilo of milk is a few minutes of a median income and a kilo of lamb is
 * most of a working day, so the unit is picked once for a sector and used for
 * every country in it. Mixed units either side of one colour ramp cannot be
 * compared at a glance.
 *
 * The step up happens at two of the larger unit, not one. A sector whose
 * middle sits just over an hour spans roughly a quarter of an hour to two,
 * and "0.28 hours" is not a number anyone reads. Two units of headroom keeps
 * the whole range on the readable side of the boundary.
 */
export function incomeUnitFor(typical: number): IncomeUnit {
  if (typical >= 2) return "days";
  if (typical * 24 >= 2) return "hours";
  return "minutes";
}

export function formatIncome(days: number, unit: IncomeUnit): string {
  const value =
    unit === "days" ? days : unit === "hours" ? days * 24 : days * 24 * 60;
  const name = unit === "minutes" ? "min" : unit;
  const rounded =
    value >= 100 ? Math.round(value) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return `${rounded} ${name}`;
}
